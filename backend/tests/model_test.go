package tests

import (
	"testing"

	"gorm.io/driver/sqlite"
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

	if len(models) != 19 {
		t.Fatalf("expected 19 models, got %d", len(models))
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
