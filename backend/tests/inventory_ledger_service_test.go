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

func setupLedgerTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	err = db.AutoMigrate(
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
