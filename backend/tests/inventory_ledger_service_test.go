package tests

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func setupLedgerTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	err = db.AutoMigrate(
		&model.Warehouse{},
		&model.WarehouseStock{},
		&model.WarehouseStockBalance{},
		&model.StockTransfer{},
		&model.StockTransferItem{},
		&model.Category{},
		&model.Product{},
		&model.ProductVariant{},
		&model.InventoryBatch{},
		&model.InventoryMovement{},
		&model.UomConversion{},
		&model.Partner{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

func TestInventoryLedgerService_RecordMovement_StockUpdate(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_goods", Name: "Goods", Code: "CAT_GOODS"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_rice",
		Name:        "Gạo ST25",
		Code:        "P_RICE",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "kg",
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ID:           "v_rice_1",
		ProductID:    prod.ID,
		Sku:          "SKU-RICE-1",
		VariantName:  "Gạo ST25 1kg",
		CurrentStock: decimal.NewFromInt(100),
		CostPrice:    decimal.NewFromInt(30000),
	}
	db.Create(variant)

	batch := &model.InventoryBatch{
		ID:           "b_rice_001",
		VariantID:    variant.ID,
		BatchCode:    "BATCH-RICE-202610",
		InitialQty:   decimal.NewFromInt(50),
		RemainingQty: decimal.NewFromInt(50),
		UnitCost:     decimal.NewFromInt(30000),
		ReceivedDate: time.Now(),
	}
	db.Create(batch)

	t.Run("Stock In with Batch updates CurrentStock and RemainingQty atomically", func(t *testing.T) {
		incomingQty := decimal.NewFromInt(20)
		unitCost := decimal.NewFromInt(30000)
		batchID := batch.ID
		ref := "PO-1001"

		mov, err := ledgerSvc.RecordMovement(ctx, nil, service.RecordMovementParams{
			VariantID:      variant.ID,
			BatchID:        &batchID,
			MovementType:   model.MovementTypePurchaseIn,
			QtyInBaseUom:   incomingQty,
			InputUOM:       "kg",
			InputQty:       incomingQty,
			UnitCostAtTime: unitCost,
			ReferenceID:    &ref,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mov == nil {
			t.Fatalf("expected non-nil movement")
		}
		if mov.ID == "" {
			t.Errorf("expected generated movement ID")
		}

		var updatedVariant model.ProductVariant
		db.First(&updatedVariant, "id = ?", variant.ID)
		expectedStock := decimal.NewFromInt(120) // 100 + 20
		if !updatedVariant.CurrentStock.Equal(expectedStock) {
			t.Errorf("expected variant current_stock %s, got %s", expectedStock, updatedVariant.CurrentStock)
		}

		var updatedBatch model.InventoryBatch
		db.First(&updatedBatch, "id = ?", batch.ID)
		expectedBatchQty := decimal.NewFromInt(70) // 50 + 20
		if !updatedBatch.RemainingQty.Equal(expectedBatchQty) {
			t.Errorf("expected batch remaining_qty %s, got %s", expectedBatchQty, updatedBatch.RemainingQty)
		}
	})

	t.Run("Stock Out without Batch updates CurrentStock atomically", func(t *testing.T) {
		outQty := decimal.NewFromInt(-15) // negative for stock-out
		unitCost := decimal.NewFromInt(30000)
		ref := "SO-2001"

		mov, err := ledgerSvc.RecordMovement(ctx, nil, service.RecordMovementParams{
			VariantID:      variant.ID,
			MovementType:   model.MovementTypeSaleOut,
			QtyInBaseUom:   outQty,
			InputUOM:       "kg",
			InputQty:       outQty,
			UnitCostAtTime: unitCost,
			ReferenceID:    &ref,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mov == nil {
			t.Fatalf("expected non-nil movement")
		}

		var updatedVariant model.ProductVariant
		db.First(&updatedVariant, "id = ?", variant.ID)
		expectedStock := decimal.NewFromInt(105) // 120 - 15
		if !updatedVariant.CurrentStock.Equal(expectedStock) {
			t.Errorf("expected variant current_stock %s, got %s", expectedStock, updatedVariant.CurrentStock)
		}
	})

	t.Run("Non-existent variant returns ErrVariantNotFound", func(t *testing.T) {
		_, err := ledgerSvc.RecordMovement(ctx, nil, service.RecordMovementParams{
			VariantID:      "v_ghost",
			MovementType:   model.MovementTypePurchaseIn,
			QtyInBaseUom:   decimal.NewFromInt(10),
			InputUOM:       "kg",
			InputQty:       decimal.NewFromInt(10),
			UnitCostAtTime: decimal.NewFromInt(100),
		})
		if err != service.ErrVariantNotFound {
			t.Fatalf("expected ErrVariantNotFound, got %v", err)
		}
	})
}

func TestInventoryLedgerService_CalculateNewWAC(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_mat", Name: "Materials", Code: "CAT_MAT"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_mat",
		Name:        "Thép cuộn",
		Code:        "P_MAT",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
	}
	db.Create(prod)

	t.Run("Normal case: (10 * 100 + 10 * 200) / 20 = 150", func(t *testing.T) {
		variant := &model.ProductVariant{
			ID:           "v_wac_norm",
			ProductID:    prod.ID,
			Sku:          "SKU-WAC-NORM",
			VariantName:  "Thép phi 10",
			CurrentStock: decimal.NewFromInt(10),
			CostPrice:    decimal.NewFromInt(100),
		}
		db.Create(variant)

		incomingQty := decimal.NewFromInt(10)
		incomingCost := decimal.NewFromInt(200)

		newWAC, err := ledgerSvc.CalculateNewWAC(ctx, nil, variant.ID, incomingQty, incomingCost)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expectedWAC := decimal.NewFromInt(150)
		if !newWAC.Equal(expectedWAC) {
			t.Errorf("expected new WAC %s, got %s", expectedWAC, newWAC)
		}

		// Verify persisted to variant in DB
		var freshVariant model.ProductVariant
		db.First(&freshVariant, "id = ?", variant.ID)
		if !freshVariant.CostPrice.Equal(expectedWAC) {
			t.Errorf("expected persisted cost_price %s, got %s", expectedWAC, freshVariant.CostPrice)
		}
	})

	t.Run("Zero existing stock: WAC = incoming cost", func(t *testing.T) {
		variant := &model.ProductVariant{
			ID:           "v_wac_zero",
			ProductID:    prod.ID,
			Sku:          "SKU-WAC-ZERO",
			VariantName:  "Thép phi 12",
			CurrentStock: decimal.Zero,
			CostPrice:    decimal.Zero,
		}
		db.Create(variant)

		incomingQty := decimal.NewFromInt(15)
		incomingCost := decimal.NewFromInt(300)

		newWAC, err := ledgerSvc.CalculateNewWAC(ctx, nil, variant.ID, incomingQty, incomingCost)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expectedWAC := incomingCost
		if !newWAC.Equal(expectedWAC) {
			t.Errorf("expected new WAC %s, got %s", expectedWAC, newWAC)
		}

		var freshVariant model.ProductVariant
		db.First(&freshVariant, "id = ?", variant.ID)
		if !freshVariant.CostPrice.Equal(expectedWAC) {
			t.Errorf("expected persisted cost_price %s, got %s", expectedWAC, freshVariant.CostPrice)
		}
	})

	t.Run("Negative existing stock: WAC = incoming cost", func(t *testing.T) {
		variant := &model.ProductVariant{
			ID:           "v_wac_neg",
			ProductID:    prod.ID,
			Sku:          "SKU-WAC-NEG",
			VariantName:  "Thép phi 14",
			CurrentStock: decimal.NewFromInt(-5),
			CostPrice:    decimal.NewFromInt(80),
		}
		db.Create(variant)

		incomingQty := decimal.NewFromInt(20)
		incomingCost := decimal.NewFromInt(250)

		newWAC, err := ledgerSvc.CalculateNewWAC(ctx, nil, variant.ID, incomingQty, incomingCost)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expectedWAC := incomingCost
		if !newWAC.Equal(expectedWAC) {
			t.Errorf("expected new WAC %s, got %s", expectedWAC, newWAC)
		}

		var freshVariant model.ProductVariant
		db.First(&freshVariant, "id = ?", variant.ID)
		if !freshVariant.CostPrice.Equal(expectedWAC) {
			t.Errorf("expected persisted cost_price %s, got %s", expectedWAC, freshVariant.CostPrice)
		}
	})
}

func TestInventoryLedgerService_StateTransform_LiveToDeadFish(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_seafood", Name: "Thủy hải sản", Code: "CAT_SEAFOOD"}
	db.Create(cat)

	prodLive := &model.Product{
		ID:          "p_fish_live",
		Name:        "Cá Điêu Hồng Sống",
		Code:        "P_FISH_LIVE",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	prodDead := &model.Product{
		ID:          "p_fish_dead",
		Name:        "Cá Điêu Hồng Ngộp",
		Code:        "P_FISH_DEAD",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prodLive)
	db.Create(prodDead)

	vLive := &model.ProductVariant{
		ID:           "v_live_fish",
		ProductID:    prodLive.ID,
		Sku:          "SKU-FISH-LIVE",
		VariantName:  "Cá Sống",
		CurrentStock: decimal.NewFromInt(50),
		CostPrice:    decimal.NewFromInt(120000),
	}
	vDead := &model.ProductVariant{
		ID:           "v_dead_fish",
		ProductID:    prodDead.ID,
		Sku:          "SKU-FISH-DEAD",
		VariantName:  "Cá Ngộp",
		CurrentStock: decimal.Zero,
		CostPrice:    decimal.Zero,
	}
	db.Create(vLive)
	db.Create(vDead)

	transformQty := decimal.NewFromInt(5)
	ref := "TRANSFORM-001"
	note := "Cá chết chuyển sang cá ngộp"

	outMov, inMov, err := ledgerSvc.StateTransform(ctx, nil, service.StateTransformParams{
		FromVariantID: vLive.ID,
		ToVariantID:   vDead.ID,
		QtyInBaseUom:  transformQty,
		ReferenceID:   &ref,
		ReasonNote:    &note,
	})
	if err != nil {
		t.Fatalf("unexpected error during state transform: %v", err)
	}

	if outMov == nil || inMov == nil {
		t.Fatalf("expected non-nil outMov and inMov")
	}

	// Verify movement types and cost inheritance
	if outMov.MovementType != model.MovementTypeStateTransform {
		t.Errorf("expected outMov MovementType %s, got %s", model.MovementTypeStateTransform, outMov.MovementType)
	}
	if inMov.MovementType != model.MovementTypeStateTransform {
		t.Errorf("expected inMov MovementType %s, got %s", model.MovementTypeStateTransform, inMov.MovementType)
	}

	inheritedCost := decimal.NewFromInt(120000)
	if !outMov.UnitCostAtTime.Equal(inheritedCost) {
		t.Errorf("expected outMov UnitCostAtTime %s, got %s", inheritedCost, outMov.UnitCostAtTime)
	}
	if !inMov.UnitCostAtTime.Equal(inheritedCost) {
		t.Errorf("expected inMov UnitCostAtTime %s, got %s", inheritedCost, inMov.UnitCostAtTime)
	}

	// Verify quantities on movements
	if !outMov.QtyInBaseUom.Equal(decimal.NewFromInt(-5)) {
		t.Errorf("expected outMov QtyInBaseUom -5, got %s", outMov.QtyInBaseUom)
	}
	if !inMov.QtyInBaseUom.Equal(decimal.NewFromInt(5)) {
		t.Errorf("expected inMov QtyInBaseUom 5, got %s", inMov.QtyInBaseUom)
	}

	// Verify FromVariant stock: 50kg -> 45kg
	var freshLive model.ProductVariant
	db.First(&freshLive, "id = ?", vLive.ID)
	expectedLiveStock := decimal.NewFromInt(45)
	if !freshLive.CurrentStock.Equal(expectedLiveStock) {
		t.Errorf("expected FromVariant stock %s, got %s", expectedLiveStock, freshLive.CurrentStock)
	}

	// Verify ToVariant stock: 0kg -> 5kg, inherited cost 120,000 VND
	var freshDead model.ProductVariant
	db.First(&freshDead, "id = ?", vDead.ID)
	expectedDeadStock := decimal.NewFromInt(5)
	if !freshDead.CurrentStock.Equal(expectedDeadStock) {
		t.Errorf("expected ToVariant stock %s, got %s", expectedDeadStock, freshDead.CurrentStock)
	}
	if !freshDead.CostPrice.Equal(inheritedCost) {
		t.Errorf("expected ToVariant cost_price %s, got %s", inheritedCost, freshDead.CostPrice)
	}
}

func TestInventoryLedgerService_ComposableTransaction(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	cat := &model.Category{ID: "cat_drink", Name: "Drinks", Code: "CAT_DRINK"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_water",
		Name:        "Nước Suối Aquafina",
		Code:        "P_WATER",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "Chai",
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ID:           "v_water_500",
		ProductID:    prod.ID,
		Sku:          "SKU-WATER-500",
		VariantName:  "Aquafina 500ml",
		CurrentStock: decimal.NewFromInt(100),
		CostPrice:    decimal.NewFromInt(5000),
	}
	db.Create(variant)

	t.Run("Transaction Rollback restores stock", func(t *testing.T) {
		err := db.Transaction(func(tx *gorm.DB) error {
			qty := decimal.NewFromInt(-20)
			cost := decimal.NewFromInt(5000)
			_, err := ledgerSvc.RecordMovement(ctx, tx, service.RecordMovementParams{
				VariantID:      variant.ID,
				MovementType:   model.MovementTypeSaleOut,
				QtyInBaseUom:   qty,
				InputUOM:       "Chai",
				InputQty:       qty,
				UnitCostAtTime: cost,
			})
			if err != nil {
				return err
			}

			// Simulating forced error to cause rollback
			return gorm.ErrInvalidTransaction
		})

		if err != gorm.ErrInvalidTransaction {
			t.Fatalf("expected rollback error, got %v", err)
		}

		var freshVariant model.ProductVariant
		db.First(&freshVariant, "id = ?", variant.ID)
		if !freshVariant.CurrentStock.Equal(decimal.NewFromInt(100)) {
			t.Errorf("expected stock rolled back to 100, got %s", freshVariant.CurrentStock)
		}
	})
}

func TestRecordMovement_StockUpdate(t *testing.T) {
	TestInventoryLedgerService_RecordMovement_StockUpdate(t)
}

func TestCalculateNewWAC(t *testing.T) {
	TestInventoryLedgerService_CalculateNewWAC(t)
}

func TestStateTransform_LiveToDeadFish(t *testing.T) {
	TestInventoryLedgerService_StateTransform_LiveToDeadFish(t)
}

func TestInventoryLedgerService_DeductStockAtomic_AndCatchWeightAutoZeroing(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	wh := &model.Warehouse{
		ID:                 "wh_pos",
		Code:               "WH_POS",
		Name:               "Quầy Bán Lẻ Chợ",
		Type:               model.WarehouseTypeRetailPos,
		AllowNegativeStock: false,
		IsActive:           true,
	}
	db.Create(wh)

	cat := &model.Category{ID: "cat_fresh", Name: "Hải sản tươi", Code: "CAT_FRESH"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_chem",
		Name:        "Cá Chẽm Bơi",
		Code:        "P_CHEM",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ID:           "v_chem_1",
		ProductID:    prod.ID,
		Sku:          "SKU-CHEM-LIVE",
		VariantName:  "Cá Chẽm Sống Nguyên Con",
		CurrentStock: decimal.NewFromFloat(30.0),
		CostPrice:    decimal.NewFromInt(120000),
	}
	db.Create(variant)

	sec20 := decimal.NewFromInt(20)
	balance := &model.WarehouseStockBalance{
		ID:                 "bal_chem_1",
		WarehouseID:        wh.ID,
		VariantID:          variant.ID,
		OnHandBaseQty:      decimal.NewFromFloat(30.0), // 30.0 kg
		ReservedBaseQty:    decimal.NewFromFloat(5.0),  // 5.0 kg đã giữ chỗ cho đơn Zalo
		LockedBaseQty:      decimal.Zero,
		InTransitBaseQty:   decimal.Zero,
		OnHandSecondaryQty: &sec20, // 20 Con
		WarehouseWacCost:   decimal.NewFromInt(120000),
		Version:            1,
	}
	db.Create(balance)

	// Available = 30.0 - 5.0 = 25.0 kg.
	// 1. Thử bán vượt quá tồn khả dụng (26.0 kg) -> phải báo ErrInsufficientStock
	_, err := ledgerSvc.DeductStockAtomic(ctx, nil, service.DeductStockParams{
		WarehouseID:    wh.ID,
		VariantID:      variant.ID,
		QtyInBaseUom:   decimal.NewFromFloat(26.0),
		UnitCostAtTime: variant.CostPrice,
	})
	if err != service.ErrInsufficientStock {
		t.Fatalf("expected ErrInsufficientStock when available is 25kg and requesting 26kg, got: %v", err)
	}

	// 2. Bán thành công 3 con cá (nặng 4.5 kg)
	sec3 := decimal.NewFromInt(3)
	mov, err := ledgerSvc.DeductStockAtomic(ctx, nil, service.DeductStockParams{
		WarehouseID:    wh.ID,
		VariantID:      variant.ID,
		QtyInBaseUom:   decimal.NewFromFloat(4.5),
		SecondaryQty:   &sec3,
		UnitCostAtTime: variant.CostPrice,
		SoldUom:        "kg",
		SoldQty:        decimal.NewFromFloat(4.5),
	})
	if err != nil {
		t.Fatalf("unexpected error on valid deduction: %v", err)
	}
	if mov.MovementType != model.MovementTypeSaleOut {
		t.Fatalf("expected SALE_OUT movement type, got: %v", mov.MovementType)
	}

	var freshWSB model.WarehouseStockBalance
	db.First(&freshWSB, "id = ?", balance.ID)
	expectedOnHand := decimal.NewFromFloat(25.5) // 30.0 - 4.5
	if !freshWSB.OnHandBaseQty.Equal(expectedOnHand) {
		t.Fatalf("expected on_hand %v, got %v", expectedOnHand, freshWSB.OnHandBaseQty)
	}
	expectedSec := decimal.NewFromInt(17) // 20 - 3
	if freshWSB.OnHandSecondaryQty == nil || !freshWSB.OnHandSecondaryQty.Equal(expectedSec) {
		t.Fatalf("expected secondary %v, got %v", expectedSec, freshWSB.OnHandSecondaryQty)
	}

	// 3. Khách Zalo hủy đơn -> giải phóng 5.0kg giữ chỗ
	err = ledgerSvc.CancelStockReservation(ctx, nil, service.CancelReservationParams{
		WarehouseID:      wh.ID,
		VariantID:        variant.ID,
		EstimatedBaseQty: decimal.NewFromFloat(5.0),
	})
	if err != nil {
		t.Fatalf("unexpected error cancelling reservation: %v", err)
	}

	// 4. Catch-Weight Auto-Zeroing:
	// Bán nốt 17 con còn lại, nhưng cân thực tế hao hụt chỉ ra 25.0 kg (còn dư 0.5 kg trên sổ sách do bốc hơi)
	sec17 := decimal.NewFromInt(17)
	_, err = ledgerSvc.DeductStockAtomic(ctx, nil, service.DeductStockParams{
		WarehouseID:    wh.ID,
		VariantID:      variant.ID,
		QtyInBaseUom:   decimal.NewFromFloat(25.0),
		SecondaryQty:   &sec17,
		UnitCostAtTime: variant.CostPrice,
		SoldUom:        "kg",
		SoldQty:        decimal.NewFromFloat(25.0),
	})
	if err != nil {
		t.Fatalf("unexpected error selling last batch of fish: %v", err)
	}

	// Sau khi bán hết 17 con cuối cùng (secondary = 0), Auto-Zeroing phải tự động đưa on_hand_base_qty về đúng 0!
	db.First(&freshWSB, "id = ?", balance.ID)
	if !freshWSB.OnHandBaseQty.IsZero() {
		t.Fatalf("expected on_hand to be auto-zeroed to 0, got %v", freshWSB.OnHandBaseQty)
	}

	// Kiểm tra đã sinh bút toán NATURAL_SHRINKAGE cho lượng 0.5kg
	var shrinkageMov model.InventoryMovement
	if err := db.Where("movement_type = ?", model.MovementTypeNaturalShrinkage).First(&shrinkageMov).Error; err != nil {
		t.Fatalf("expected NATURAL_SHRINKAGE ledger movement to be recorded: %v", err)
	}
	if !shrinkageMov.QtyInBaseUom.Equal(decimal.NewFromFloat(-0.5)) {
		t.Fatalf("expected shrinkage qty -0.5, got %v", shrinkageMov.QtyInBaseUom)
	}
}

func TestInventoryLedgerService_TwoPhaseMultiOrderReservation(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	wh := &model.Warehouse{
		ID:                 "wh_kitchen",
		Code:               "WH_KITCHEN",
		Name:               "Kho Bếp Tổng",
		Type:               model.WarehouseTypeKitchenWip,
		AllowNegativeStock: false,
		IsActive:           true,
	}
	db.Create(wh)

	cat := &model.Category{ID: "cat_dry", Name: "Khô & Đóng gói", Code: "CAT_DRY"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_meat",
		Name:        "Thịt Bò Úc",
		Code:        "P_MEAT",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ID:           "v_meat_1",
		ProductID:    prod.ID,
		Sku:          "SKU-BEEF",
		VariantName:  "Bò Úc Nguyên Tảng",
		CurrentStock: decimal.NewFromFloat(50.0),
		CostPrice:    decimal.NewFromInt(250000),
	}
	db.Create(variant)

	sec10 := decimal.NewFromInt(10)
	balance := &model.WarehouseStockBalance{
		ID:                 "bal_meat_1",
		WarehouseID:        wh.ID,
		VariantID:          variant.ID,
		OnHandBaseQty:      decimal.NewFromFloat(50.0),
		ReservedBaseQty:    decimal.Zero,
		LockedBaseQty:      decimal.Zero,
		OnHandSecondaryQty: &sec10, // 10 tảng
		Version:            1,
	}
	db.Create(balance)

	// Step 1: Đơn sỉ Zalo đặt trước 5 tảng bò (ước tính 25.0 kg) -> Reserve
	sec5 := decimal.NewFromInt(5)
	err := ledgerSvc.ReserveStock(ctx, nil, service.ReserveStockParams{
		WarehouseID:        wh.ID,
		VariantID:          variant.ID,
		EstimatedBaseQty:   decimal.NewFromFloat(25.0),
		EstimatedSecondary: &sec5,
	})
	if err != nil {
		t.Fatalf("unexpected error reserving stock: %v", err)
	}

	var freshWSB model.WarehouseStockBalance
	db.First(&freshWSB, "id = ?", balance.ID)
	// OnHand vẫn giữ nguyên 50.0 kg, Reserved tăng lên 25.0 kg
	if !freshWSB.OnHandBaseQty.Equal(decimal.NewFromFloat(50.0)) {
		t.Fatalf("expected OnHand to remain 50.0kg, got %v", freshWSB.OnHandBaseQty)
	}
	if !freshWSB.ReservedBaseQty.Equal(decimal.NewFromFloat(25.0)) {
		t.Fatalf("expected Reserved to be 25.0kg, got %v", freshWSB.ReservedBaseQty)
	}
	// Available = 50 - 25 = 25 kg. Thử reserve 26 kg -> phải lỗi
	err = ledgerSvc.ReserveStock(ctx, nil, service.ReserveStockParams{
		WarehouseID:      wh.ID,
		VariantID:        variant.ID,
		EstimatedBaseQty: decimal.NewFromFloat(26.0),
	})
	if err != service.ErrInsufficientStock {
		t.Fatalf("expected ErrInsufficientStock on oversell attempt, got %v", err)
	}

	// Step 2 & 3: Soạn cân thực tế (Over-delivery tolerance)
	// Đặt ước tính 25.0 kg (5 tảng), nhưng cân thực tế ra 26.4 kg!
	mov, err := ledgerSvc.CommitReservedFulfillment(ctx, nil, service.CommitFulfillmentParams{
		WarehouseID:              wh.ID,
		VariantID:                variant.ID,
		EstimatedBaseQty:         decimal.NewFromFloat(25.0),
		ActualFulfilledBaseQty:   decimal.NewFromFloat(26.4),
		EstimatedSecondary:       &sec5,
		ActualFulfilledSecondary: &sec5,
		UnitCostAtTime:           variant.CostPrice,
		SoldUom:                  "kg",
		SoldQty:                  decimal.NewFromFloat(26.4),
	})
	if err != nil {
		t.Fatalf("unexpected error committing fulfillment: %v", err)
	}
	if !mov.QtyInBaseUom.Equal(decimal.NewFromFloat(-26.4)) {
		t.Fatalf("expected SALE_OUT movement for actual 26.4kg, got %v", mov.QtyInBaseUom)
	}

	// Reserved giải phóng về 0, OnHand trừ đúng thực tế 26.4kg: 50.0 - 26.4 = 23.6 kg
	db.First(&freshWSB, "id = ?", balance.ID)
	if !freshWSB.ReservedBaseQty.IsZero() {
		t.Fatalf("expected reserved to be released to 0, got %v", freshWSB.ReservedBaseQty)
	}
	expectedRemaining := decimal.NewFromFloat(23.6)
	if !freshWSB.OnHandBaseQty.Equal(expectedRemaining) {
		t.Fatalf("expected OnHand remaining %v, got %v", expectedRemaining, freshWSB.OnHandBaseQty)
	}
	// Số tảng còn lại: 10 - 5 = 5 tảng
	if freshWSB.OnHandSecondaryQty == nil || !freshWSB.OnHandSecondaryQty.Equal(decimal.NewFromInt(5)) {
		t.Fatalf("expected secondary remaining 5, got %v", freshWSB.OnHandSecondaryQty)
	}
}

func TestInventoryLedgerService_TwoStepInterWarehouseTransferWithTransitWastage(t *testing.T) {
	db := setupLedgerTestDB(t)
	ledgerSvc := service.NewInventoryLedgerService(db)
	ctx := context.Background()

	whSender := &model.Warehouse{
		ID:                 "wh_sender",
		Code:               "WH_COLD_MAIN",
		Name:               "Kho Đông Lạnh Tổng",
		Type:               model.WarehouseTypeStorage,
		AllowNegativeStock: false,
		IsActive:           true,
	}
	whReceiver := &model.Warehouse{
		ID:                 "wh_receiver",
		Code:               "WH_MARKET",
		Name:               "Sạp Bán Lẻ Chợ",
		Type:               model.WarehouseTypeRetailPos,
		AllowNegativeStock: false,
		IsActive:           true,
	}
	db.Create(whSender)
	db.Create(whReceiver)

	cat := &model.Category{ID: "cat_seafood_trf", Name: "Hải sản", Code: "CAT_SEAFOOD_TRF"}
	db.Create(cat)

	prod := &model.Product{
		ID:          "p_mackerel",
		Name:        "Cá Thu",
		Code:        "P_MACKEREL",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ID:           "v_mackerel",
		ProductID:    prod.ID,
		Sku:          "SKU-MACKEREL",
		VariantName:  "Cá Thu Đông Lạnh",
		CurrentStock: decimal.NewFromFloat(100.0),
		CostPrice:    decimal.NewFromInt(150000),
	}
	db.Create(variant)

	// Kho tổng có 100kg
	balSender := &model.WarehouseStockBalance{
		ID:            "bal_sender",
		WarehouseID:   whSender.ID,
		VariantID:     variant.ID,
		OnHandBaseQty: decimal.NewFromFloat(100.0),
		Version:       1,
	}
	db.Create(balSender)

	transfer := &model.StockTransfer{
		ID:              "trf_001",
		TransferNumber:  "TRF-20261016-001",
		FromWarehouseID: whSender.ID,
		ToWarehouseID:   whReceiver.ID,
		Status:          model.StockTransferStatusDraft,
		Items: []model.StockTransferItem{
			{
				ID:         "item_trf_1",
				TransferID: "trf_001",
				VariantID:  variant.ID,
				Qty:        decimal.NewFromFloat(50.0),
				Uom:        "kg",
			},
		},
	}
	db.Create(transfer)

	// BƯỚC 1: Xuất chuyển kho (DISPATCH)
	err := ledgerSvc.DispatchStockTransfer(ctx, nil, transfer.ID)
	if err != nil {
		t.Fatalf("unexpected error dispatching transfer: %v", err)
	}

	// Kiểm tra trạng thái: Kho tổng giảm 50kg, Kho sạp chợ tăng in_transit 50kg
	var freshSenderWSB model.WarehouseStockBalance
	db.First(&freshSenderWSB, "id = ?", balSender.ID)
	if !freshSenderWSB.OnHandBaseQty.Equal(decimal.NewFromFloat(50.0)) {
		t.Fatalf("expected sender OnHand 50.0kg, got %v", freshSenderWSB.OnHandBaseQty)
	}

	var freshReceiverWSB model.WarehouseStockBalance
	db.Where("warehouse_id = ? AND variant_id = ?", whReceiver.ID, variant.ID).First(&freshReceiverWSB)
	if !freshReceiverWSB.InTransitBaseQty.Equal(decimal.NewFromFloat(50.0)) {
		t.Fatalf("expected receiver InTransit 50.0kg, got %v", freshReceiverWSB.InTransitBaseQty)
	}
	if !freshReceiverWSB.OnHandBaseQty.IsZero() {
		t.Fatalf("expected receiver OnHand to be 0 before receipt, got %v", freshReceiverWSB.OnHandBaseQty)
	}

	// BƯỚC 2: Nhận hàng (RECEIVE) có hao hụt (chỉ thực nhận 49.2 kg, hao 0.8 kg nước đá)
	receivedQtys := map[string]decimal.Decimal{
		"item_trf_1": decimal.NewFromFloat(49.2),
	}
	err = ledgerSvc.ReceiveStockTransfer(ctx, nil, transfer.ID, receivedQtys)
	if err != nil {
		t.Fatalf("unexpected error receiving transfer: %v", err)
	}

	// Kiểm tra sau khi nhận: in_transit = 0, OnHand = 49.2 kg
	db.Where("warehouse_id = ? AND variant_id = ?", whReceiver.ID, variant.ID).First(&freshReceiverWSB)
	if !freshReceiverWSB.InTransitBaseQty.IsZero() {
		t.Fatalf("expected receiver InTransit to be 0 after receipt, got %v", freshReceiverWSB.InTransitBaseQty)
	}
	if !freshReceiverWSB.OnHandBaseQty.Equal(decimal.NewFromFloat(49.2)) {
		t.Fatalf("expected receiver OnHand 49.2kg, got %v", freshReceiverWSB.OnHandBaseQty)
	}

	// Kiểm tra tự động ghi nhận sổ cái TRANSIT_WASTAGE cho lượng 0.8kg chênh lệch
	var wastageMov model.InventoryMovement
	if err := db.Where("movement_type = ?", model.MovementTypeTransitWastage).First(&wastageMov).Error; err != nil {
		t.Fatalf("expected TRANSIT_WASTAGE ledger movement: %v", err)
	}
	if !wastageMov.QtyInBaseUom.Equal(decimal.NewFromFloat(-0.8)) {
		t.Fatalf("expected wastage qty -0.8kg, got %v", wastageMov.QtyInBaseUom)
	}
}
