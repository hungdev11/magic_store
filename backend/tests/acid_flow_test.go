package tests

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func setupACIDTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	err = db.AutoMigrate(
		&model.StoreSetting{},
		&model.Unit{},
		&model.Category{},
		&model.Product{},
		&model.ProductVariant{},
		&model.UomConversion{},
		&model.ModifierGroup{},
		&model.ModifierItem{},
		&model.ProductModifierGroup{},
		&model.InventoryBatch{},
		&model.InventoryMovement{},
		&model.BomRecipe{},
		&model.BomItem{},
		&model.ProductionOrder{},
		&model.Partner{},
		&model.PosSession{},
		&model.SalesOrder{},
		&model.SalesOrderItem{},
		&model.DebtLedger{},
		&model.CashbookTransaction{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

// TestACID_SeafoodSaleCompleteFlow verifies a complete POS seafood sale in 1 ACID transaction:
// - Live fish catch-weight line price calculation (1.35kg * 160,000 VND/kg = 216,000 VND)
// - Stock deduction via InventoryLedgerService.RecordMovement (SALE_OUT, -1.35kg)
// - SalesOrder and SalesOrderItem creation with accurate COGS and totals
// - CashbookTransaction creation (INFLOW, SALES_REVENUE, 216,000 VND)
// - Post-commit verification: stock is exactly 18.65kg, order and cashbook written.
func TestACID_SeafoodSaleCompleteFlow(t *testing.T) {
	db := setupACIDTestDB(t)
	uomSvc := service.NewUOMService(db)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	// 1. Fixtures setup
	cat := &model.Category{ID: "cat_seafood", Name: "Thủy Hải Sản", Code: "SEAFOOD"}
	db.Create(cat)

	prodFish := &model.Product{
		ID:          "p_fish_live",
		Name:        "Cá Điêu Hồng Sống",
		Code:        "FISH_DIEUHONG",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prodFish)

	initStock := decimal.NewFromInt(20)          // 20 kg
	costPrice := decimal.NewFromInt(100000)      // 100,000 VND/kg
	sellingPrice := decimal.NewFromInt(160000)   // 160,000 VND/kg
	minSellingPrice := decimal.NewFromInt(140000) // 140,000 VND/kg

	variantFish := &model.ProductVariant{
		ID:               "v_fish_live",
		ProductID:        prodFish.ID,
		Sku:              "SKU-FISH-DH",
		VariantName:      "Cá Điêu Hồng Sống",
		CurrentStock:     initStock,
		CostPrice:        costPrice,
		BaseSellingPrice: sellingPrice,
		MinSellingPrice:  minSellingPrice,
	}
	db.Create(variantFish)

	// Catch-weight conversion: 1 con sold by actual weight (variable ratio)
	uomConv := &model.UomConversion{
		ID:               "conv_fish_con",
		VariantID:        variantFish.ID,
		UomName:          "con",
		ConversionFactor: decimal.NewFromInt(1),
		IsVariableRatio:  true,
	}
	db.Create(uomConv)

	posSession := &model.PosSession{
		ID:          "pos_session_01",
		CashierName: "Thu Ngân 01",
		OpeningCash: decimal.NewFromInt(1000000),
		Status:      model.PosSessionStatusOpen,
		StartedAt:   time.Now(),
	}
	db.Create(posSession)

	orderID := "SO-SEAFOOD-20261016-001"
	soldWeight := decimal.RequireFromString("1.35") // 1.35 kg

	// 2. ACID Transaction Execution
	err := db.Transaction(func(tx *gorm.DB) error {
		// Step A: Calculate line price via UOMService
		priceResult, err := uomSvc.CalculateLinePrice(ctx, tx, service.CalculateLinePriceParams{
			VariantID:     variantFish.ID,
			SoldUOM:       "con",
			SoldQty:       decimal.NewFromInt(1),
			ActualBaseQty: &soldWeight,
		})
		if err != nil {
			return err
		}

		expectedTotal := decimal.NewFromInt(216000) // 1.35 * 160,000 = 216,000 VND
		if !priceResult.LineTotal.Equal(expectedTotal) {
			t.Fatalf("expected line total %s, got %s", expectedTotal, priceResult.LineTotal)
		}
		if !priceResult.ActualDeductedQty.Equal(soldWeight) {
			t.Fatalf("expected deducted qty %s, got %s", soldWeight, priceResult.ActualDeductedQty)
		}

		// Step B: Deduct stock via InventoryLedgerService
		movNote := "Xuất bán hải sản cân ký tại quầy"
		_, err = ledgerSvc.RecordMovement(ctx, tx, service.RecordMovementParams{
			VariantID:      variantFish.ID,
			MovementType:   model.MovementTypeSaleOut,
			QtyInBaseUom:   priceResult.ActualDeductedQty.Neg(), // -1.35 kg
			InputUOM:       "con",
			InputQty:       decimal.NewFromInt(-1),
			UnitCostAtTime: variantFish.CostPrice,
			ReferenceID:    &orderID,
			ReasonNote:     &movNote,
		})
		if err != nil {
			return err
		}

		// Step C: Create SalesOrder and SalesOrderItem
		lineCogs := priceResult.ActualDeductedQty.Mul(variantFish.CostPrice) // 1.35 * 100,000 = 135,000 VND
		salesOrder := &model.SalesOrder{
			ID:             orderID,
			OrderNumber:    "ORD-SEAFOOD-001",
			PosSessionID:   &posSession.ID,
			Status:         model.OrderStatusCompleted,
			Subtotal:       priceResult.LineTotal,
			DiscountAmount: decimal.Zero,
			TotalAmount:    priceResult.LineTotal,
			PaidAmount:     priceResult.LineTotal,
			DebtAmount:     decimal.Zero,
			TotalCogs:      lineCogs,
			PaymentMethod:  model.PaymentMethodCash,
			Items: []model.SalesOrderItem{
				{
					ID:                    "item_seafood_01",
					OrderID:               orderID,
					VariantID:             variantFish.ID,
					SoldUom:               "con",
					SoldQty:               decimal.NewFromInt(1),
					ActualBaseQtyDeducted: priceResult.ActualDeductedQty,
					OriginalUnitPrice:     priceResult.UnitPrice,
					ActualUnitPrice:       priceResult.UnitPrice,
					LineTotal:             priceResult.LineTotal,
					LineCogs:              lineCogs,
				},
			},
		}
		if err := tx.Create(salesOrder).Error; err != nil {
			return err
		}

		// Step D: Create CashbookTransaction (INFLOW, SALES_REVENUE, 216,000 VND)
		cashTx := &model.CashbookTransaction{
			ID:              "cbt_seafood_01",
			TransactionType: model.CashbookTypeInflow,
			Category:        model.CashbookCategorySalesRevenue,
			Amount:          priceResult.LineTotal,
			PaymentMethod:   model.CashbookPaymentMethodCash,
			SalesOrderID:    &orderID,
			PosSessionID:    &posSession.ID,
			Description:     "Thu tiền bán cá điêu hồng cân ký",
		}
		if err := tx.Create(cashTx).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		t.Fatalf("transaction failed: %v", err)
	}

	// 3. Post-Transaction State Verification
	var updatedVariant model.ProductVariant
	if err := db.First(&updatedVariant, "id = ?", variantFish.ID).Error; err != nil {
		t.Fatalf("failed to query updated variant: %v", err)
	}
	expectedRemainingStock := decimal.RequireFromString("18.65") // 20 - 1.35 = 18.65 kg
	if !updatedVariant.CurrentStock.Equal(expectedRemainingStock) {
		t.Errorf("expected stock %s, got %s", expectedRemainingStock, updatedVariant.CurrentStock)
	}

	var movement model.InventoryMovement
	if err := db.First(&movement, "reference_id = ?", orderID).Error; err != nil {
		t.Fatalf("expected movement record: %v", err)
	}
	if movement.MovementType != model.MovementTypeSaleOut {
		t.Errorf("expected movement type %s, got %s", model.MovementTypeSaleOut, movement.MovementType)
	}
	if !movement.QtyInBaseUom.Equal(decimal.RequireFromString("-1.35")) {
		t.Errorf("expected movement qty -1.35, got %s", movement.QtyInBaseUom)
	}

	var order model.SalesOrder
	if err := db.Preload("Items").First(&order, "id = ?", orderID).Error; err != nil {
		t.Fatalf("expected sales order record: %v", err)
	}
	if !order.TotalAmount.Equal(decimal.NewFromInt(216000)) {
		t.Errorf("expected total amount 216000, got %s", order.TotalAmount)
	}
	if !order.TotalCogs.Equal(decimal.NewFromInt(135000)) {
		t.Errorf("expected total cogs 135000, got %s", order.TotalCogs)
	}
	if len(order.Items) != 1 {
		t.Fatalf("expected 1 order item, got %d", len(order.Items))
	}
	if !order.Items[0].ActualBaseQtyDeducted.Equal(soldWeight) {
		t.Errorf("expected item deducted qty %s, got %s", soldWeight, order.Items[0].ActualBaseQtyDeducted)
	}

	var cashbookEntry model.CashbookTransaction
	if err := db.First(&cashbookEntry, "sales_order_id = ?", orderID).Error; err != nil {
		t.Fatalf("expected cashbook transaction: %v", err)
	}
	if cashbookEntry.TransactionType != model.CashbookTypeInflow {
		t.Errorf("expected cashbook INFLOW, got %s", cashbookEntry.TransactionType)
	}
	if cashbookEntry.Category != model.CashbookCategorySalesRevenue {
		t.Errorf("expected cashbook SALES_REVENUE, got %s", cashbookEntry.Category)
	}
	if !cashbookEntry.Amount.Equal(decimal.NewFromInt(216000)) {
		t.Errorf("expected cashbook amount 216000, got %s", cashbookEntry.Amount)
	}
}

// TestACID_RollbackVerification verifies that any failure prior to commit completely rolls back:
// - Variant stock remains untouched at 20kg
// - No movement records created
// - No sales order or order items created
// - No cashbook transaction created
func TestACID_RollbackVerification(t *testing.T) {
	db := setupACIDTestDB(t)
	uomSvc := service.NewUOMService(db)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_seafood_rb", Name: "Thủy Hải Sản", Code: "SEAFOOD_RB"}
	db.Create(cat)

	prodFish := &model.Product{
		ID:          "p_fish_live_rb",
		Name:        "Cá Điêu Hồng Sống Rollback",
		Code:        "FISH_DH_RB",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prodFish)

	initStock := decimal.NewFromInt(20)
	costPrice := decimal.NewFromInt(100000)
	sellingPrice := decimal.NewFromInt(160000)

	variantFish := &model.ProductVariant{
		ID:               "v_fish_live_rb",
		ProductID:        prodFish.ID,
		Sku:              "SKU-FISH-DH-RB",
		VariantName:      "Cá Điêu Hồng Sống",
		CurrentStock:     initStock,
		CostPrice:        costPrice,
		BaseSellingPrice: sellingPrice,
		MinSellingPrice:  sellingPrice,
	}
	db.Create(variantFish)

	uomConv := &model.UomConversion{
		ID:               "conv_fish_con_rb",
		VariantID:        variantFish.ID,
		UomName:          "con",
		ConversionFactor: decimal.NewFromInt(1),
		IsVariableRatio:  true,
	}
	db.Create(uomConv)

	posSession := &model.PosSession{
		ID:          "pos_session_rb",
		CashierName: "Thu Ngân Rollback",
		OpeningCash: decimal.NewFromInt(500000),
		Status:      model.PosSessionStatusOpen,
		StartedAt:   time.Now(),
	}
	db.Create(posSession)

	orderID := "SO-ROLLBACK-001"
	soldWeight := decimal.RequireFromString("1.35")
	simulatedErr := errors.New("simulated fatal error: payment gateway timeout before commit")

	// Execute transaction that intentionally fails at the end
	err := db.Transaction(func(tx *gorm.DB) error {
		priceResult, err := uomSvc.CalculateLinePrice(ctx, tx, service.CalculateLinePriceParams{
			VariantID:     variantFish.ID,
			SoldUOM:       "con",
			SoldQty:       decimal.NewFromInt(1),
			ActualBaseQty: &soldWeight,
		})
		if err != nil {
			return err
		}

		movNote := "Xuất bán cá trước lỗi rollback"
		_, err = ledgerSvc.RecordMovement(ctx, tx, service.RecordMovementParams{
			VariantID:      variantFish.ID,
			MovementType:   model.MovementTypeSaleOut,
			QtyInBaseUom:   priceResult.ActualDeductedQty.Neg(),
			InputUOM:       "con",
			InputQty:       decimal.NewFromInt(-1),
			UnitCostAtTime: variantFish.CostPrice,
			ReferenceID:    &orderID,
			ReasonNote:     &movNote,
		})
		if err != nil {
			return err
		}

		lineCogs := priceResult.ActualDeductedQty.Mul(variantFish.CostPrice)
		salesOrder := &model.SalesOrder{
			ID:             orderID,
			OrderNumber:    "ORD-RB-001",
			PosSessionID:   &posSession.ID,
			Status:         model.OrderStatusCompleted,
			Subtotal:       priceResult.LineTotal,
			TotalAmount:    priceResult.LineTotal,
			PaidAmount:     priceResult.LineTotal,
			TotalCogs:      lineCogs,
			PaymentMethod:  model.PaymentMethodCash,
			Items: []model.SalesOrderItem{
				{
					ID:                    "item_rb_01",
					OrderID:               orderID,
					VariantID:             variantFish.ID,
					SoldUom:               "con",
					SoldQty:               decimal.NewFromInt(1),
					ActualBaseQtyDeducted: priceResult.ActualDeductedQty,
					OriginalUnitPrice:     priceResult.UnitPrice,
					ActualUnitPrice:       priceResult.UnitPrice,
					LineTotal:             priceResult.LineTotal,
					LineCogs:              lineCogs,
				},
			},
		}
		if err := tx.Create(salesOrder).Error; err != nil {
			return err
		}

		cashTx := &model.CashbookTransaction{
			ID:              "cbt_rb_01",
			TransactionType: model.CashbookTypeInflow,
			Category:        model.CashbookCategorySalesRevenue,
			Amount:          priceResult.LineTotal,
			PaymentMethod:   model.CashbookPaymentMethodCash,
			SalesOrderID:    &orderID,
			PosSessionID:    &posSession.ID,
			Description:     "Thu tiền giao dịch giả định rollback",
		}
		if err := tx.Create(cashTx).Error; err != nil {
			return err
		}

		// Intentionally fail to trigger transaction rollback
		return simulatedErr
	})

	if !errors.Is(err, simulatedErr) {
		t.Fatalf("expected simulated error %v, got %v", simulatedErr, err)
	}

	// Verify Rollback: Stock must remain untouched at 20kg
	var freshVariant model.ProductVariant
	if err := db.First(&freshVariant, "id = ?", variantFish.ID).Error; err != nil {
		t.Fatalf("failed to query variant: %v", err)
	}
	if !freshVariant.CurrentStock.Equal(initStock) {
		t.Errorf("expected rolled back stock %s, got %s", initStock, freshVariant.CurrentStock)
	}

	// Verify Rollback: Zero movements created
	var movCount int64
	db.Model(&model.InventoryMovement{}).Where("variant_id = ? OR reference_id = ?", variantFish.ID, orderID).Count(&movCount)
	if movCount != 0 {
		t.Errorf("expected 0 movements after rollback, found %d", movCount)
	}

	// Verify Rollback: Zero sales orders created
	var orderCount int64
	db.Model(&model.SalesOrder{}).Where("id = ?", orderID).Count(&orderCount)
	if orderCount != 0 {
		t.Errorf("expected 0 sales orders after rollback, found %d", orderCount)
	}

	// Verify Rollback: Zero sales order items created
	var itemCount int64
	db.Model(&model.SalesOrderItem{}).Where("order_id = ?", orderID).Count(&itemCount)
	if itemCount != 0 {
		t.Errorf("expected 0 order items after rollback, found %d", itemCount)
	}

	// Verify Rollback: Zero cashbook transactions created
	var cashCount int64
	db.Model(&model.CashbookTransaction{}).Where("sales_order_id = ?", orderID).Count(&cashCount)
	if cashCount != 0 {
		t.Errorf("expected 0 cashbook entries after rollback, found %d", cashCount)
	}
}

// TestACID_FoodBackflushWithModifiersFlow verifies complete POS sale of Bánh Mì with modifier topping (Trứng Ốp La):
// - Deducts base ingredients (vỏ bánh, pate, chả lụa) AND modifier ingredients (trứng gà) in 1 transaction
// - Creates order and cashbook
// - Verifies all stocks decremented accurately
func TestACID_FoodBackflushWithModifiersFlow(t *testing.T) {
	db := setupACIDTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_fnb", Name: "Đồ Ăn Nhanh F&B", Code: "FNB"}
	db.Create(cat)

	// 1. Base Ingredients
	// Vỏ bánh mì: 50 cái, 2,000 VND
	prodCrust := &model.Product{ID: "p_crust", Name: "Vỏ bánh mì", Code: "ING_CRUST", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "cái"}
	db.Create(prodCrust)
	varCrust := &model.ProductVariant{ID: "v_crust", ProductID: prodCrust.ID, Sku: "SKU-CRUST", VariantName: "Vỏ bánh mì", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(2000)}
	db.Create(varCrust)

	// Pate: 1000g, 20 VND/g
	prodPate := &model.Product{ID: "p_pate", Name: "Pate gan", Code: "ING_PATE", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "g"}
	db.Create(prodPate)
	varPate := &model.ProductVariant{ID: "v_pate", ProductID: prodPate.ID, Sku: "SKU-PATE", VariantName: "Pate gan", CurrentStock: decimal.NewFromInt(1000), CostPrice: decimal.NewFromInt(20)}
	db.Create(varPate)

	// Chả lụa: 1000g, 30 VND/g
	prodChaLua := &model.Product{ID: "p_cha_lua", Name: "Chả lụa", Code: "ING_CHALUA", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "g"}
	db.Create(prodChaLua)
	varChaLua := &model.ProductVariant{ID: "v_cha_lua", ProductID: prodChaLua.ID, Sku: "SKU-CHALUA", VariantName: "Chả lụa", CurrentStock: decimal.NewFromInt(1000), CostPrice: decimal.NewFromInt(30)}
	db.Create(varChaLua)

	// 2. Modifier Ingredient (Topping)
	// Trứng gà: 30 quả, 3,000 VND
	prodEgg := &model.Product{ID: "p_egg", Name: "Trứng gà tươi", Code: "ING_EGG", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "quả"}
	db.Create(prodEgg)
	varEgg := &model.ProductVariant{ID: "v_egg", ProductID: prodEgg.ID, Sku: "SKU-EGG", VariantName: "Trứng gà tươi", CurrentStock: decimal.NewFromInt(30), CostPrice: decimal.NewFromInt(3000)}
	db.Create(varEgg)

	// 3. Finished Dish: Bánh Mì Đặc Biệt
	prodBanhMi := &model.Product{
		ID:             "p_banh_mi",
		Name:           "Bánh Mì Kẹp Chả Pate",
		Code:           "FG_BANHMI_DB",
		CategoryID:     cat.ID,
		ProductType:    model.ProductTypeFinishedGood,
		BaseUom:        "ổ",
		ProductionMode: model.ProductionModePosBackflush,
	}
	db.Create(prodBanhMi)

	dishSellingPrice := decimal.NewFromInt(30000) // 30,000 VND
	varBanhMi := &model.ProductVariant{
		ID:               "v_banh_mi",
		ProductID:        prodBanhMi.ID,
		Sku:              "SKU-BANHMI-DB",
		VariantName:      "Bánh Mì Kẹp Chả Pate",
		CurrentStock:     decimal.Zero,
		CostPrice:        decimal.NewFromInt(4100), // 2,000 + 30*20 + 50*30 = 4,100 VND
		BaseSellingPrice: dishSellingPrice,
	}
	db.Create(varBanhMi)

	// BOM Recipe: 1 Bánh Mì = 1 Vỏ bánh + 30g Pate + 50g Chả lụa
	recipe := &model.BomRecipe{
		ID:              "recipe_banh_mi_db",
		TargetVariantID: varBanhMi.ID,
		RecipeType:      model.RecipeTypeAssembly,
		OutputQty:       decimal.NewFromInt(1),
		Items: []model.BomItem{
			{RecipeID: "recipe_banh_mi_db", ComponentVariantID: varCrust.ID, QtyRequired: decimal.NewFromInt(1)},
			{RecipeID: "recipe_banh_mi_db", ComponentVariantID: varPate.ID, QtyRequired: decimal.NewFromInt(30)},
			{RecipeID: "recipe_banh_mi_db", ComponentVariantID: varChaLua.ID, QtyRequired: decimal.NewFromInt(50)},
		},
	}
	db.Create(recipe)

	posSession := &model.PosSession{
		ID:          "pos_session_fnb",
		CashierName: "Bếp & Thu Ngân",
		OpeningCash: decimal.NewFromInt(200000),
		Status:      model.PosSessionStatusOpen,
		StartedAt:   time.Now(),
	}
	db.Create(posSession)

	// Modifier JSON: Thêm Trứng Ốp La (deduct 1 quả trứng gà)
	modifiersJSON := `[{"name": "Trứng Ốp La", "price": 5000, "deduct_qty": 1, "linked_variant_id": "v_egg"}]`
	orderID := "ORD-FNB-20261016-002"

	// Total calculation:
	// Base dish: 30,000 VND
	// Modifier topping: 5,000 VND
	// Total: 35,000 VND
	// Total COGS: Base 4,100 + Trứng 3,000 = 7,100 VND
	saleTotal := decimal.NewFromInt(35000)
	totalCogs := decimal.NewFromInt(7100)

	// Execute Backflush + POS Order + Cashbook in 1 ACID Transaction
	err := db.Transaction(func(tx *gorm.DB) error {
		// Step A: Backflush base ingredients + modifier ingredients
		movements, err := bomSvc.ExecuteBackflushDeduction(ctx, tx, service.BackflushParams{
			Items: []service.BackflushItem{
				{
					VariantID:     varBanhMi.ID,
					Qty:           decimal.NewFromInt(1),
					ModifiersJSON: modifiersJSON,
					ReferenceID:   &orderID,
				},
			},
		})
		if err != nil {
			return err
		}

		// Expected 4 movements: Vỏ bánh (1), Pate (30g), Chả lụa (50g), Trứng gà (1)
		if len(movements) != 4 {
			t.Fatalf("expected 4 backflush movements, got %d", len(movements))
		}

		// Step B: Create SalesOrder and SalesOrderItem
		salesOrder := &model.SalesOrder{
			ID:             orderID,
			OrderNumber:    "ORD-FNB-002",
			PosSessionID:   &posSession.ID,
			Status:         model.OrderStatusCompleted,
			Subtotal:       saleTotal,
			DiscountAmount: decimal.Zero,
			TotalAmount:    saleTotal,
			PaidAmount:     saleTotal,
			DebtAmount:     decimal.Zero,
			TotalCogs:      totalCogs,
			PaymentMethod:  model.PaymentMethodCash,
			Items: []model.SalesOrderItem{
				{
					ID:                    "item_fnb_01",
					OrderID:               orderID,
					VariantID:             varBanhMi.ID,
					SoldUom:               "ổ",
					SoldQty:               decimal.NewFromInt(1),
					ActualBaseQtyDeducted: decimal.NewFromInt(1),
					OriginalUnitPrice:     saleTotal,
					ActualUnitPrice:       saleTotal,
					LineTotal:             saleTotal,
					ModifiersJSON:         &modifiersJSON,
					LineCogs:              totalCogs,
				},
			},
		}
		if err := tx.Create(salesOrder).Error; err != nil {
			return err
		}

		// Step C: Create Cashbook entry (INFLOW, SALES_REVENUE, 35,000 VND)
		cashTx := &model.CashbookTransaction{
			ID:              "cbt_fnb_01",
			TransactionType: model.CashbookTypeInflow,
			Category:        model.CashbookCategorySalesRevenue,
			Amount:          saleTotal,
			PaymentMethod:   model.CashbookPaymentMethodCash,
			SalesOrderID:    &orderID,
			PosSessionID:    &posSession.ID,
			Description:     "Thu tiền bán Bánh Mì kẹp kèm Trứng Ốp La",
		}
		if err := tx.Create(cashTx).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		t.Fatalf("ACID food transaction failed: %v", err)
	}

	// 4. Verification of All Stocks Decremented
	// Vỏ bánh: 50 - 1 = 49 cái
	var freshCrust model.ProductVariant
	db.First(&freshCrust, "id = ?", varCrust.ID)
	expectedCrustStock := decimal.NewFromInt(49)
	if !freshCrust.CurrentStock.Equal(expectedCrustStock) {
		t.Errorf("expected crust stock %s, got %s", expectedCrustStock, freshCrust.CurrentStock)
	}

	// Pate: 1000 - 30 = 970 g
	var freshPate model.ProductVariant
	db.First(&freshPate, "id = ?", varPate.ID)
	expectedPateStock := decimal.NewFromInt(970)
	if !freshPate.CurrentStock.Equal(expectedPateStock) {
		t.Errorf("expected pate stock %s, got %s", expectedPateStock, freshPate.CurrentStock)
	}

	// Chả lụa: 1000 - 50 = 950 g
	var freshChaLua model.ProductVariant
	db.First(&freshChaLua, "id = ?", varChaLua.ID)
	expectedChaLuaStock := decimal.NewFromInt(950)
	if !freshChaLua.CurrentStock.Equal(expectedChaLuaStock) {
		t.Errorf("expected cha lua stock %s, got %s", expectedChaLuaStock, freshChaLua.CurrentStock)
	}

	// Modifier Ingredient: Trứng gà: 30 - 1 = 29 quả
	var freshEgg model.ProductVariant
	db.First(&freshEgg, "id = ?", varEgg.ID)
	expectedEggStock := decimal.NewFromInt(29)
	if !freshEgg.CurrentStock.Equal(expectedEggStock) {
		t.Errorf("expected egg stock %s, got %s", expectedEggStock, freshEgg.CurrentStock)
	}

	// Verify all 4 movements are MovementTypeProductionConsume
	var movements []model.InventoryMovement
	if err := db.Where("reference_id = ?", orderID).Find(&movements).Error; err != nil {
		t.Fatalf("failed to query movements: %v", err)
	}
	if len(movements) != 4 {
		t.Errorf("expected 4 movements in db, got %d", len(movements))
	}
	for _, m := range movements {
		if m.MovementType != model.MovementTypeProductionConsume {
			t.Errorf("expected movement type %s, got %s", model.MovementTypeProductionConsume, m.MovementType)
		}
	}

	// Verify SalesOrder and Cashbook Transaction
	var order model.SalesOrder
	if err := db.First(&order, "id = ?", orderID).Error; err != nil {
		t.Fatalf("sales order not found: %v", err)
	}
	if !order.TotalAmount.Equal(saleTotal) {
		t.Errorf("expected order total %s, got %s", saleTotal, order.TotalAmount)
	}
	if !order.TotalCogs.Equal(totalCogs) {
		t.Errorf("expected order cogs %s, got %s", totalCogs, order.TotalCogs)
	}

	var cashTx model.CashbookTransaction
	if err := db.First(&cashTx, "sales_order_id = ?", orderID).Error; err != nil {
		t.Fatalf("cashbook entry not found: %v", err)
	}
	if !cashTx.Amount.Equal(saleTotal) {
		t.Errorf("expected cashbook amount %s, got %s", saleTotal, cashTx.Amount)
	}
	if cashTx.TransactionType != model.CashbookTypeInflow {
		t.Errorf("expected cashbook INFLOW, got %s", cashTx.TransactionType)
	}
	if cashTx.Category != model.CashbookCategorySalesRevenue {
		t.Errorf("expected cashbook category SALES_REVENUE, got %s", cashTx.Category)
	}
}
