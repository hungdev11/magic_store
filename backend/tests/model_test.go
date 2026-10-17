package tests

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

func TestModelMigration(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to sqlite in-memory db: %v", err)
	}

	models := []interface{}{
		&model.StoreSetting{},
		&model.Warehouse{},
		&model.WarehouseStock{},
		&model.WarehouseStockBalance{},
		&model.StockTransfer{},
		&model.StockTransferItem{},
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
	}

	err = db.AutoMigrate(models...)
	if err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	for _, m := range models {
		if !db.Migrator().HasTable(m) {
			t.Errorf("expected table for model %T to exist", m)
		}
	}
}

func TestWarehouseStockBalance_AvailableAndConstraints(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.Warehouse{}, &model.Product{}, &model.ProductVariant{}, &model.WarehouseStockBalance{}); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	wh := &model.Warehouse{
		Code:      "WH_TEST",
		Name:      "Kho Test",
		Type:      model.WarehouseTypeStorage,
		IsActive:  true,
		IsDefault: true,
	}
	if err := db.Create(wh).Error; err != nil {
		t.Fatalf("failed to create warehouse: %v", err)
	}

	variant := &model.ProductVariant{
		Sku:         "SKU_FISH",
		VariantName: "Cá Chẽm Tươi",
	}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("failed to create variant: %v", err)
	}

	secCount := decimal.NewFromInt(20) // 20 Con
	balance := &model.WarehouseStockBalance{
		WarehouseID:        wh.ID,
		VariantID:          variant.ID,
		OnHandBaseQty:      decimal.NewFromFloat(30.0), // 30.0 kg
		ReservedBaseQty:    decimal.NewFromFloat(7.5),  // 7.5 kg
		LockedBaseQty:      decimal.NewFromFloat(1.5),  // 1.5 kg
		InTransitBaseQty:   decimal.NewFromFloat(5.0),
		OnHandSecondaryQty: &secCount,
		WarehouseWacCost:   decimal.NewFromFloat(120000),
		Version:            1,
	}
	if err := db.Create(balance).Error; err != nil {
		t.Fatalf("failed to create warehouse stock balance: %v", err)
	}

	// Available = OnHand (30.0) - Reserved (7.5) - Locked (1.5) = 21.0
	expectedAvailable := decimal.NewFromFloat(21.0)
	if !balance.AvailableBaseQty().Equal(expectedAvailable) {
		t.Fatalf("expected available %v, got %v", expectedAvailable, balance.AvailableBaseQty())
	}
}

func TestModelCRUD(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&model.Category{}, &model.Product{}, &model.ProductVariant{}); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	category := &model.Category{
		Name: "Beverages",
		Code: "BEV",
	}
	if err := db.Create(category).Error; err != nil {
		t.Fatalf("failed to create category: %v", err)
	}
	if category.ID == "" {
		t.Fatalf("expected category ID to be auto-generated")
	}

	product := &model.Product{
		Name:           "Coffee",
		Code:           "COF01",
		CategoryID:     category.ID,
		ProductType:    model.ProductTypeFinishedGood,
		BaseUom:        "cup",
		ProductionMode: model.ProductionModePosBackflush,
	}
	if err := db.Create(product).Error; err != nil {
		t.Fatalf("failed to create product: %v", err)
	}

	variant := &model.ProductVariant{
		ProductID:   product.ID,
		Sku:         "COF-ICED",
		VariantName: "Iced Coffee",
	}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("failed to create variant: %v", err)
	}
	if variant.ID == "" {
		t.Fatalf("expected variant ID to be auto-generated")
	}
}

func TestPhase1Models_UnitAndExtensions(t *testing.T) {
	db := setupTestDB(t)

	// Test Unit model
	unit := model.Unit{
		Code:        "KG",
		Name:        "Kilogram",
		Description: "Đơn vị khối lượng tiêu chuẩn",
		IsActive:    true,
	}
	if err := db.Create(&unit).Error; err != nil {
		t.Fatalf("failed to create unit: %v", err)
	}
	if unit.ID == "" {
		t.Errorf("expected auto-generated ID for unit")
	}

	// Test Category.IsActive
	cat := model.Category{
		Name:     "Hải Sản Tươi",
		Code:     "SEAFOOD_TEST",
		IsActive: true,
	}
	if err := db.Create(&cat).Error; err != nil {
		t.Fatalf("failed to create category: %v", err)
	}

	// Test Partner.IsActive
	partner := model.Partner{
		PartnerType: model.PartnerTypeSupplier,
		Name:        "NCC Biển Đông",
		IsActive:    true,
	}
	if err := db.Create(&partner).Error; err != nil {
		t.Fatalf("failed to create partner: %v", err)
	}

	var loadedCat model.Category
	if err := db.First(&loadedCat, "code = ?", "SEAFOOD_TEST").Error; err != nil {
		t.Fatalf("failed to load cat: %v", err)
	}
	if !loadedCat.IsActive {
		t.Errorf("expected loadedCat.IsActive to be true")
	}

	// Test InventoryBatch.Notes
	batch := model.InventoryBatch{
		VariantID: "v_test",
		BatchCode: "BATCH_TEST",
		Notes:     "Ghi chú kiểm tra lô",
	}
	if err := db.Create(&batch).Error; err != nil {
		t.Fatalf("failed to create batch: %v", err)
	}
	var loadedBatch model.InventoryBatch
	if err := db.First(&loadedBatch, "batch_code = ?", "BATCH_TEST").Error; err != nil {
		t.Fatalf("failed to load batch: %v", err)
	}
	if loadedBatch.Notes != "Ghi chú kiểm tra lô" {
		t.Errorf("expected batch notes %q, got %q", "Ghi chú kiểm tra lô", loadedBatch.Notes)
	}
}

