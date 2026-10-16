package tests

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func setupBOMTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	err = db.AutoMigrate(
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
		&model.CashbookTransaction{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

// TestExecuteAssembly tests N raw materials -> 1 finished good (50 rolls of Chả lụa),
// checking raw material consumption, yield movement, batch creation, and production order creation.
func TestBOMProductionService_ExecuteAssembly(t *testing.T) {
	db := setupBOMTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_processed", Name: "Thực phẩm chế biến", Code: "PROCESSED"}
	db.Create(cat)

	// Raw 1: Pork (Thịt heo)
	prodPork := &model.Product{ID: "p_pork", Name: "Thịt heo nạc", Code: "RAW_PORK", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodPork)
	varPork := &model.ProductVariant{ID: "v_pork", ProductID: prodPork.ID, Sku: "SKU-PORK", VariantName: "Thịt heo", CurrentStock: decimal.NewFromInt(20), CostPrice: decimal.NewFromInt(100000)}
	db.Create(varPork)

	// Raw 2: Fat (Mỡ phần)
	prodFat := &model.Product{ID: "p_fat", Name: "Mỡ heo", Code: "RAW_FAT", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodFat)
	varFat := &model.ProductVariant{ID: "v_fat", ProductID: prodFat.ID, Sku: "SKU-FAT", VariantName: "Mỡ heo", CurrentStock: decimal.NewFromInt(10), CostPrice: decimal.NewFromInt(60000)}
	db.Create(varFat)

	// Finished Good: Chả lụa
	prodChaLua := &model.Product{ID: "p_cha_lua", Name: "Chả lụa", Code: "FG_CHALUA", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "cây"}
	db.Create(prodChaLua)
	varChaLua := &model.ProductVariant{ID: "v_cha_lua", ProductID: prodChaLua.ID, Sku: "SKU-CHALUA", VariantName: "Chả lụa 500g", CurrentStock: decimal.Zero, CostPrice: decimal.Zero}
	db.Create(varChaLua)

	// Recipe: 50 rolls of Chả lụa requires 10kg pork and 2.5kg fat
	recipe := &model.BomRecipe{
		ID:              "recipe_cha_lua",
		TargetVariantID: varChaLua.ID,
		RecipeType:      model.RecipeTypeAssembly,
		OutputQty:       decimal.NewFromInt(50),
		Items: []model.BomItem{
			{RecipeID: "recipe_cha_lua", ComponentVariantID: varPork.ID, QtyRequired: decimal.NewFromInt(10)},
			{RecipeID: "recipe_cha_lua", ComponentVariantID: varFat.ID, QtyRequired: decimal.NewFromFloat(2.5)},
		},
	}
	db.Create(recipe)

	batchCode := "BATCH-CHALUA-001"
	expiry := time.Now().Add(7 * 24 * time.Hour)
	otherCost := decimal.NewFromInt(50000) // gia vị, lá gói, điện

	order, err := bomSvc.ExecuteAssembly(ctx, nil, service.AssemblyParams{
		RecipeID:        recipe.ID,
		TargetOutputQty: decimal.NewFromInt(50),
		BatchCode:       &batchCode,
		OtherCost:       otherCost,
		ExpiryDate:      &expiry,
	})
	if err != nil {
		t.Fatalf("ExecuteAssembly failed: %v", err)
	}

	if order == nil {
		t.Fatalf("expected non-nil ProductionOrder")
	}
	if order.Status != model.ProductionStatusCompleted {
		t.Errorf("expected order status COMPLETED, got %v", order.Status)
	}
	// Total material cost = 10 * 100,000 + 2.5 * 60,000 = 1,000,000 + 150,000 = 1,150,000
	expectedMatCost := decimal.NewFromInt(1150000)
	if !order.TotalMaterialCost.Equal(expectedMatCost) {
		t.Errorf("expected material cost %v, got %v", expectedMatCost, order.TotalMaterialCost)
	}
	// Total cost = 1,150,000 + 50,000 = 1,200,000 => Cost per roll = 1,200,000 / 50 = 24,000
	expectedUnitCost := decimal.NewFromInt(24000)

	// Check finished good stock and WAC
	var updatedChaLua model.ProductVariant
	db.First(&updatedChaLua, "id = ?", varChaLua.ID)
	if !updatedChaLua.CurrentStock.Equal(decimal.NewFromInt(50)) {
		t.Errorf("expected stock 50, got %v", updatedChaLua.CurrentStock)
	}
	if !updatedChaLua.CostPrice.Equal(expectedUnitCost) {
		t.Errorf("expected cost price %v, got %v", expectedUnitCost, updatedChaLua.CostPrice)
	}

	// Check raw material stock deduction
	var updatedPork model.ProductVariant
	db.First(&updatedPork, "id = ?", varPork.ID)
	if !updatedPork.CurrentStock.Equal(decimal.NewFromInt(10)) {
		t.Errorf("expected pork stock 10, got %v", updatedPork.CurrentStock)
	}

	var updatedFat model.ProductVariant
	db.First(&updatedFat, "id = ?", varFat.ID)
	if !updatedFat.CurrentStock.Equal(decimal.NewFromFloat(7.5)) {
		t.Errorf("expected fat stock 7.5, got %v", updatedFat.CurrentStock)
	}

	// Check batch creation
	var batch model.InventoryBatch
	err = db.First(&batch, "batch_code = ?", batchCode).Error
	if err != nil {
		t.Fatalf("expected batch created, got error: %v", err)
	}
	if !batch.RemainingQty.Equal(decimal.NewFromInt(50)) {
		t.Errorf("expected batch remaining qty 50, got %v", batch.RemainingQty)
	}
	if !batch.UnitCost.Equal(expectedUnitCost) {
		t.Errorf("expected batch unit cost %v, got %v", expectedUnitCost, batch.UnitCost)
	}

	// Check inventory movements
	var movements []model.InventoryMovement
	db.Where("reference_id = ?", order.ID).Find(&movements)
	if len(movements) != 3 {
		t.Fatalf("expected 3 movements (2 consumes + 1 yield), got %d", len(movements))
	}
}

// TestExecuteDisassembly tests 1 raw material (5kg Whole Salmon) -> multiple yields
// (3.2kg fillet with 70% cost allocation, 1.3kg bone/head with 25% cost allocation, 0.5kg waste with 5% cost allocation),
// checking cost per kg of each yield.
func TestBOMProductionService_ExecuteDisassembly(t *testing.T) {
	db := setupBOMTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_seafood", Name: "Hải sản tươi sống", Code: "SEAFOOD"}
	db.Create(cat)

	// Whole salmon: 10kg @ 200,000 VND/kg
	prodWhole := &model.Product{ID: "p_salmon_whole", Name: "Cá hồi nguyên con", Code: "RAW_SALMON_WHOLE", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodWhole)
	varWhole := &model.ProductVariant{ID: "v_salmon_whole", ProductID: prodWhole.ID, Sku: "SKU-SALMON-WHOLE", VariantName: "Cá hồi nguyên con", CurrentStock: decimal.NewFromInt(10), CostPrice: decimal.NewFromInt(200000)}
	db.Create(varWhole)

	// Yield variants
	prodFillet := &model.Product{ID: "p_salmon_fillet", Name: "Phi lê cá hồi", Code: "YIELD_FILLET", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "kg"}
	db.Create(prodFillet)
	varFillet := &model.ProductVariant{ID: "v_fillet", ProductID: prodFillet.ID, Sku: "SKU-FILLET", VariantName: "Phi lê cá hồi", CurrentStock: decimal.Zero, CostPrice: decimal.Zero}
	db.Create(varFillet)

	prodBone := &model.Product{ID: "p_salmon_bone", Name: "Đầu xương cá hồi", Code: "YIELD_BONE", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "kg"}
	db.Create(prodBone)
	varBone := &model.ProductVariant{ID: "v_bone", ProductID: prodBone.ID, Sku: "SKU-BONE", VariantName: "Đầu xương cá hồi", CurrentStock: decimal.Zero, CostPrice: decimal.Zero}
	db.Create(varBone)

	prodWaste := &model.Product{ID: "p_salmon_waste", Name: "Dè vây vụn cá", Code: "YIELD_WASTE", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "kg"}
	db.Create(prodWaste)
	varWaste := &model.ProductVariant{ID: "v_waste", ProductID: prodWaste.ID, Sku: "SKU-WASTE", VariantName: "Dè vây vụn cá", CurrentStock: decimal.Zero, CostPrice: decimal.Zero}
	db.Create(varWaste)

	// Recipe: Disassembly of Whole Salmon
	recipe := &model.BomRecipe{
		ID:              "recipe_salmon_disasm",
		TargetVariantID: varWhole.ID,
		RecipeType:      model.RecipeTypeDisassembly,
		OutputQty:       decimal.NewFromInt(5),
		Items: []model.BomItem{
			{RecipeID: "recipe_salmon_disasm", ComponentVariantID: varFillet.ID, CostAllocationPercent: decimal.NewFromInt(70)},
			{RecipeID: "recipe_salmon_disasm", ComponentVariantID: varBone.ID, CostAllocationPercent: decimal.NewFromInt(25)},
			{RecipeID: "recipe_salmon_disasm", ComponentVariantID: varWaste.ID, CostAllocationPercent: decimal.NewFromInt(5)},
		},
	}
	db.Create(recipe)

	order, err := bomSvc.ExecuteDisassembly(ctx, nil, service.DisassemblyParams{
		RecipeID: recipe.ID,
		InputQty: decimal.NewFromInt(5), // 5kg salmon
		YieldOutputs: []service.DisassemblyYieldOutput{
			{ComponentVariantID: varFillet.ID, ActualQty: decimal.RequireFromString("3.2")},
			{ComponentVariantID: varBone.ID, ActualQty: decimal.RequireFromString("1.3")},
			{ComponentVariantID: varWaste.ID, ActualQty: decimal.RequireFromString("0.5")},
		},
	})
	if err != nil {
		t.Fatalf("ExecuteDisassembly failed: %v", err)
	}

	if order == nil {
		t.Fatalf("expected non-nil ProductionOrder")
	}

	// 5kg Whole salmon @ 200,000 = 1,000,000 VND
	// Fillet: 70% of 1,000,000 = 700,000 VND for 3.2kg => 218,750 VND/kg
	// Bone: 25% of 1,000,000 = 250,000 VND for 1.3kg => 250,000 / 1.3 = 192,307.69...
	// Waste: 5% of 1,000,000 = 50,000 VND for 0.5kg => 100,000 VND/kg
	expectedFilletUnitCost := decimal.NewFromInt(700000).Div(decimal.RequireFromString("3.2"))
	expectedBoneUnitCost := decimal.NewFromInt(250000).Div(decimal.RequireFromString("1.3"))
	expectedWasteUnitCost := decimal.NewFromInt(50000).Div(decimal.RequireFromString("0.5"))

	var resFillet model.ProductVariant
	db.First(&resFillet, "id = ?", varFillet.ID)
	if !resFillet.CurrentStock.Equal(decimal.RequireFromString("3.2")) {
		t.Errorf("expected fillet stock 3.2, got %v", resFillet.CurrentStock)
	}
	if !resFillet.CostPrice.Round(2).Equal(expectedFilletUnitCost.Round(2)) {
		t.Errorf("expected fillet unit cost %v, got %v", expectedFilletUnitCost, resFillet.CostPrice)
	}

	var resBone model.ProductVariant
	db.First(&resBone, "id = ?", varBone.ID)
	if !resBone.CurrentStock.Equal(decimal.RequireFromString("1.3")) {
		t.Errorf("expected bone stock 1.3, got %v", resBone.CurrentStock)
	}
	if !resBone.CostPrice.Round(2).Equal(expectedBoneUnitCost.Round(2)) {
		t.Errorf("expected bone unit cost %v, got %v", expectedBoneUnitCost, resBone.CostPrice)
	}

	var resWaste model.ProductVariant
	db.First(&resWaste, "id = ?", varWaste.ID)
	if !resWaste.CurrentStock.Equal(decimal.RequireFromString("0.5")) {
		t.Errorf("expected waste stock 0.5, got %v", resWaste.CurrentStock)
	}
	if !resWaste.CostPrice.Round(2).Equal(expectedWasteUnitCost.Round(2)) {
		t.Errorf("expected waste unit cost %v, got %v", expectedWasteUnitCost, resWaste.CostPrice)
	}

	// Verify whole salmon deducted by 5kg
	var resWhole model.ProductVariant
	db.First(&resWhole, "id = ?", varWhole.ID)
	if !resWhole.CurrentStock.Equal(decimal.NewFromInt(5)) {
		t.Errorf("expected whole salmon stock 5, got %v", resWhole.CurrentStock)
	}
}

// TestExecuteBackflushDeduction tests selling Bánh Mì with modifier topping (thêm pate, thêm trứng),
// checking automatic deduction of bread ingredients and modifier linked variants.
func TestBOMProductionService_ExecuteBackflushDeduction(t *testing.T) {
	db := setupBOMTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_food", Name: "Đồ ăn nhanh", Code: "FASTFOOD"}
	db.Create(cat)

	// Bread ingredients
	prodCrust := &model.Product{ID: "p_crust", Name: "Vỏ bánh mì", Code: "RAW_CRUST", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "Ổ"}
	db.Create(prodCrust)
	varCrust := &model.ProductVariant{ID: "v_crust", ProductID: prodCrust.ID, Sku: "SKU-CRUST", VariantName: "Vỏ bánh mì", CurrentStock: decimal.NewFromInt(100), CostPrice: decimal.NewFromInt(2000)}
	db.Create(varCrust)

	prodStdPate := &model.Product{ID: "p_std_pate", Name: "Pate tiêu chuẩn", Code: "RAW_PATE", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodStdPate)
	varStdPate := &model.ProductVariant{ID: "v_std_pate", ProductID: prodStdPate.ID, Sku: "RAW-PATE", VariantName: "Pate hộp", CurrentStock: decimal.NewFromInt(10), CostPrice: decimal.NewFromInt(120000)}
	db.Create(varStdPate)

	// Modifier raw materials
	prodEgg := &model.Product{ID: "p_egg", Name: "Trứng gà", Code: "RAW_EGG", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "Quả"}
	db.Create(prodEgg)
	varEgg := &model.ProductVariant{ID: "v_egg", ProductID: prodEgg.ID, Sku: "RAW-TRUNG-GA", VariantName: "Trứng gà", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(3000)}
	db.Create(varEgg)

	// Finished dish: Bánh Mì
	prodBanhMi := &model.Product{ID: "p_banh_mi", Name: "Bánh Mì Kẹp", Code: "FG_BANHMI", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "Ổ", ProductionMode: model.ProductionModePosBackflush}
	db.Create(prodBanhMi)
	varBanhMi := &model.ProductVariant{ID: "v_banh_mi", ProductID: prodBanhMi.ID, Sku: "SKU-BANHMI", VariantName: "Bánh Mì Kẹp Thịt", CurrentStock: decimal.Zero, CostPrice: decimal.Zero}
	db.Create(varBanhMi)

	// BOM Recipe for 1 Bánh Mì: 1 Vỏ bánh mì + 0.03kg Pate tiêu chuẩn
	recipe := &model.BomRecipe{
		ID:              "recipe_banh_mi",
		TargetVariantID: varBanhMi.ID,
		RecipeType:      model.RecipeTypeAssembly,
		OutputQty:       decimal.NewFromInt(1),
		Items: []model.BomItem{
			{RecipeID: "recipe_banh_mi", ComponentVariantID: varCrust.ID, QtyRequired: decimal.NewFromInt(1)},
			{RecipeID: "recipe_banh_mi", ComponentVariantID: varStdPate.ID, QtyRequired: decimal.NewFromFloat(0.03)},
		},
	}
	db.Create(recipe)

	// Sell 2 Bánh Mì, each with modifiers: Thêm Trứng (1 quả), Thêm Pate (0.02kg)
	modifiersJSON := `[
		{"name": "Thêm Trứng Ốp La", "price": 10000, "deduct_qty": 1, "linked_sku": "RAW-TRUNG-GA"},
		{"name": "Thêm Pate", "price": 5000, "deduct_qty": 0.02, "linked_variant_id": "v_std_pate"}
	]`

	refID := "ORDER-POS-001"
	movements, err := bomSvc.ExecuteBackflushDeduction(ctx, nil, service.BackflushParams{
		Items: []service.BackflushItem{
			{
				VariantID:     varBanhMi.ID,
				Qty:           decimal.NewFromInt(2),
				ModifiersJSON: modifiersJSON,
				ReferenceID:   &refID,
			},
		},
	})
	if err != nil {
		t.Fatalf("ExecuteBackflushDeduction failed: %v", err)
	}

	// Should have deducted:
	// - Vỏ: 2 * 1 = 2 Ổ
	// - Pate tiêu chuẩn: 2 * 0.03 = 0.06 kg
	// - Trứng topping: 2 * 1 = 2 quả
	// - Pate topping: 2 * 0.02 = 0.04 kg
	// Total movements: 4
	if len(movements) != 4 {
		t.Fatalf("expected 4 deduction movements, got %d", len(movements))
	}

	var updatedCrust model.ProductVariant
	db.First(&updatedCrust, "id = ?", varCrust.ID)
	if !updatedCrust.CurrentStock.Equal(decimal.NewFromInt(98)) {
		t.Errorf("expected crust stock 98, got %v", updatedCrust.CurrentStock)
	}

	var updatedPate model.ProductVariant
	db.First(&updatedPate, "id = ?", varStdPate.ID)
	// 10 - 0.06 (BOM) - 0.04 (Topping) = 9.90 kg
	expectedPateStock := decimal.NewFromFloat(9.90)
	if !updatedPate.CurrentStock.Equal(expectedPateStock) {
		t.Errorf("expected pate stock %v, got %v", expectedPateStock, updatedPate.CurrentStock)
	}

	var updatedEgg model.ProductVariant
	db.First(&updatedEgg, "id = ?", varEgg.ID)
	if !updatedEgg.CurrentStock.Equal(decimal.NewFromInt(48)) {
		t.Errorf("expected egg stock 48, got %v", updatedEgg.CurrentStock)
	}
}

// TestRecordWastage tests spoilage recording (e.g. 5 spoiled bread rolls),
// checking stock deduction and CashbookTransaction expense creation.
func TestBOMProductionService_RecordWastage(t *testing.T) {
	db := setupBOMTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_bakery", Name: "Bánh tươi", Code: "BAKERY"}
	db.Create(cat)

	prodBread := &model.Product{ID: "p_bread", Name: "Bánh mì hoa cúc", Code: "BREAD_CHAMOMILE", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "Ổ"}
	db.Create(prodBread)
	varBread := &model.ProductVariant{ID: "v_bread", ProductID: prodBread.ID, Sku: "SKU-BREAD-01", VariantName: "Bánh mì hoa cúc", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(15000)}
	db.Create(varBread)

	ref := "WASTE-20261016-01"
	mov, cashTx, err := bomSvc.RecordWastage(ctx, nil, service.WastageParams{
		VariantID:        varBread.ID,
		LostQty:          decimal.NewFromInt(5),
		InputUOM:         "Ổ",
		ReasonNote:       "Bánh mì mốc quá hạn sử dụng",
		RecordToCashbook: true,
		ReferenceID:      &ref,
	})
	if err != nil {
		t.Fatalf("RecordWastage failed: %v", err)
	}

	if mov == nil {
		t.Fatalf("expected non-nil InventoryMovement")
	}
	if mov.MovementType != model.MovementTypeWastageSpoilage {
		t.Errorf("expected movement type WASTAGE_SPOILAGE, got %v", mov.MovementType)
	}
	if !mov.QtyInBaseUom.Equal(decimal.NewFromInt(-5)) {
		t.Errorf("expected movement qty -5, got %v", mov.QtyInBaseUom)
	}

	// Verify variant stock deducted: 50 - 5 = 45
	var updatedBread model.ProductVariant
	db.First(&updatedBread, "id = ?", varBread.ID)
	if !updatedBread.CurrentStock.Equal(decimal.NewFromInt(45)) {
		t.Errorf("expected variant stock 45, got %v", updatedBread.CurrentStock)
	}

	// Verify cashbook transaction
	if cashTx == nil {
		t.Fatalf("expected non-nil CashbookTransaction")
	}
	if cashTx.TransactionType != model.CashbookTypeOutflow {
		t.Errorf("expected cashbook transaction type OUTFLOW, got %v", cashTx.TransactionType)
	}
	if cashTx.Category != model.CashbookCategoryOtherExpense {
		t.Errorf("expected cashbook category OTHER_EXPENSE, got %v", cashTx.Category)
	}
	// Expense amount = 5 * 15,000 = 75,000 VND
	expectedExpense := decimal.NewFromInt(75000)
	if !cashTx.Amount.Equal(expectedExpense) {
		t.Errorf("expected cashbook amount %v, got %v", expectedExpense, cashTx.Amount)
	}

	// Verify persisted in DB
	var dbCashTx model.CashbookTransaction
	err = db.First(&dbCashTx, "id = ?", cashTx.ID).Error
	if err != nil {
		t.Fatalf("expected cashbook tx persisted in DB, got: %v", err)
	}
}
