package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/api"
	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func setupAPITestServer(t *testing.T) (*api.Server, *gorm.DB) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite in-memory db: %v", err)
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

	uomSvc := service.NewUOMService(db)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)
	storageSvc, _ := service.NewStorageService(service.StorageConfig{
		Endpoint:   "localhost:9000",
		AccessKey:  "minioadmin",
		SecretKey:  "minioadmin",
		BucketName: "products",
		UseSSL:     false,
		PublicURL:  "http://localhost:9000",
	})
	srv := api.NewServer(db, uomSvc, ledgerSvc, bomSvc, storageSvc)

	return srv, db
}

func executeRequest(handler http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestAPI_SettingsAndPreset(t *testing.T) {
	srv, _ := setupAPITestServer(t)

	// 1. GET /api/settings - should create default if none exists
	req, _ := http.NewRequest(http.MethodGet, "/api/settings", nil)
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected GET /api/settings status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var setting model.StoreSetting
	if err := json.Unmarshal(rec.Body.Bytes(), &setting); err != nil {
		t.Fatalf("failed to unmarshal setting: %v", err)
	}
	if setting.ID == "" || setting.Name == "" {
		t.Fatalf("expected initialized store setting, got id=%s, name=%s", setting.ID, setting.Name)
	}

	// 2. PUT /api/settings - update store info
	updatePayload := map[string]interface{}{
		"name":            "Siêu Thị Hải Sản Tươi Sống",
		"currency":        "VND",
		"costing_method":  "WAC",
		"enabled_modules": `{"catch_weight":true,"batch_expiry":true}`,
	}
	body, _ := json.Marshal(updatePayload)
	req, _ = http.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected PUT /api/settings status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var updatedSetting model.StoreSetting
	if err := json.Unmarshal(rec.Body.Bytes(), &updatedSetting); err != nil {
		t.Fatalf("failed to parse updated setting: %v", err)
	}
	if updatedSetting.Name != "Siêu Thị Hải Sản Tươi Sống" {
		t.Fatalf("expected name 'Siêu Thị Hải Sản Tươi Sống', got '%s'", updatedSetting.Name)
	}

	// 3. POST /api/settings/preset - SEAFOOD
	presetPayload := map[string]string{"preset": "SEAFOOD"}
	body, _ = json.Marshal(presetPayload)
	req, _ = http.NewRequest(http.MethodPost, "/api/settings/preset", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected POST /api/settings/preset status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var seafoodSetting model.StoreSetting
	json.Unmarshal(rec.Body.Bytes(), &seafoodSetting)
	var modules map[string]interface{}
	json.Unmarshal([]byte(seafoodSetting.EnabledModules), &modules)
	if modules["catch_weight"] != true || modules["batch_expiry"] != true {
		t.Fatalf("expected seafood modules enabled, got: %s", seafoodSetting.EnabledModules)
	}

	// 4. POST /api/settings/preset - APPAREL
	presetPayload = map[string]string{"preset": "APPAREL"}
	body, _ = json.Marshal(presetPayload)
	req, _ = http.NewRequest(http.MethodPost, "/api/settings/preset", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected POST preset APPAREL status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var apparelSetting model.StoreSetting
	json.Unmarshal(rec.Body.Bytes(), &apparelSetting)
	json.Unmarshal([]byte(apparelSetting.EnabledModules), &modules)
	if modules["matrix_variants"] != true {
		t.Fatalf("expected matrix_variants true for APPAREL, got: %s", apparelSetting.EnabledModules)
	}
}

func TestAPI_CategoriesAndProducts(t *testing.T) {
	srv, _ := setupAPITestServer(t)

	// 1. POST /api/categories
	catPayload := map[string]string{
		"name": "Thời Trang Nam",
		"code": "CAT_FASHION",
	}
	body, _ := json.Marshal(catPayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/categories", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/categories status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdCat model.Category
	json.Unmarshal(rec.Body.Bytes(), &createdCat)
	if createdCat.ID == "" || createdCat.Code != "CAT_FASHION" {
		t.Fatalf("unexpected category: %+v", createdCat)
	}

	// 2. GET /api/categories
	req, _ = http.NewRequest(http.MethodGet, "/api/categories", nil)
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected GET /api/categories status 200, got %d", rec.Code)
	}
	var catList []model.Category
	json.Unmarshal(rec.Body.Bytes(), &catList)
	if len(catList) == 0 {
		t.Fatalf("expected at least 1 category, got %d", len(catList))
	}

	// 3. POST /api/products with matrix_attributes
	prodPayload := map[string]interface{}{
		"name":               "Áo Sơ Mi Oxford",
		"code":               "AO_SOMI",
		"category_id":        createdCat.ID,
		"product_type":       "FINISHED_GOOD",
		"base_uom":           "Cái",
		"cost_price":         150000,
		"base_selling_price": 300000,
		"min_selling_price":  250000,
		"matrix_attributes": map[string][]string{
			"color": {"Trắng", "Đen"},
			"size":  {"S", "M"},
		},
		"uom_conversions": []map[string]interface{}{
			{
				"uom_name":          "Hộp",
				"conversion_factor": 2,
			},
		},
	}
	body, _ = json.Marshal(prodPayload)
	req, _ = http.NewRequest(http.MethodPost, "/api/products", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/products status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdProd model.Product
	if err := json.Unmarshal(rec.Body.Bytes(), &createdProd); err != nil {
		t.Fatalf("failed to unmarshal created product: %v", err)
	}
	// 2 colors * 2 sizes = 4 variants
	if len(createdProd.Variants) != 4 {
		t.Fatalf("expected 4 matrix variants, got %d", len(createdProd.Variants))
	}
	for _, v := range createdProd.Variants {
		if len(v.UomConversions) != 1 {
			t.Fatalf("expected 1 UomConversion per variant, got %d on variant %s", len(v.UomConversions), v.Sku)
		}
	}

	// 4. GET /api/products - Preload Variants and Category
	req, _ = http.NewRequest(http.MethodGet, "/api/products", nil)
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected GET /api/products status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var prodList []model.Product
	json.Unmarshal(rec.Body.Bytes(), &prodList)
	if len(prodList) == 0 || prodList[0].Category == nil || len(prodList[0].Variants) != 4 {
		t.Fatalf("expected product list with preloaded category and variants, got: %+v", prodList)
	}

	// 5. GET /api/partners (filter by type)
	partnerPayload := map[string]interface{}{
		"name":         "Công Ty Cổ Phần Dệt May",
		"partner_type": "SUPPLIER",
		"phone":        "0987654321",
	}
	body, _ = json.Marshal(partnerPayload)
	// Create partner directly in DB for testing GET /api/partners
	supplier := &model.Partner{
		Name:        "Công Ty Cổ Phần Dệt May",
		PartnerType: model.PartnerTypeSupplier,
	}
	srv.DB().Create(supplier)

	req, _ = http.NewRequest(http.MethodGet, "/api/partners?type=SUPPLIER", nil)
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected GET /api/partners status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var partners []model.Partner
	json.Unmarshal(rec.Body.Bytes(), &partners)
	if len(partners) != 1 || partners[0].PartnerType != model.PartnerTypeSupplier {
		t.Fatalf("expected 1 supplier partner, got: %+v", partners)
	}
}

func TestAPI_PurchaseReceiving(t *testing.T) {
	srv, db := setupAPITestServer(t)

	cat := &model.Category{Name: "Hải Sản", Code: "CAT_HAI_SAN"}
	db.Create(cat)

	prod := &model.Product{
		Name:        "Cá Chẽm Sống",
		Code:        "CA_CHEM",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "kg",
	}
	db.Create(prod)

	variant := &model.ProductVariant{
		ProductID:        prod.ID,
		Sku:              "CA_CHEM_DEFAULT",
		VariantName:      "Cá Chẽm Chuẩn",
		CostPrice:        decimal.NewFromInt(0),
		BaseSellingPrice: decimal.NewFromInt(150000),
		CurrentStock:     decimal.NewFromInt(0),
	}
	db.Create(variant)

	supplier := &model.Partner{
		Name:        "HTX Biển Đông",
		PartnerType: model.PartnerTypeSupplier,
	}
	db.Create(supplier)

	// POST /api/inventory/purchase
	expiry := time.Now().AddDate(0, 1, 0)
	purchasePayload := map[string]interface{}{
		"supplier_id":  supplier.ID,
		"reference_id": "PO-TEST-001",
		"notes":        "Lô hàng nhập đầu tuần",
		"items": []map[string]interface{}{
			{
				"variant_id":  variant.ID,
				"qty":         100,
				"unit_cost":   80000,
				"uom":         "kg",
				"batch_code":  "LOT-FISH-001",
				"expiry_date": expiry.Format(time.RFC3339),
			},
		},
	}
	body, _ := json.Marshal(purchasePayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/inventory/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/inventory/purchase status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify variant stock & cost
	var updatedVar model.ProductVariant
	db.First(&updatedVar, "id = ?", variant.ID)
	if !updatedVar.CurrentStock.Equal(decimal.NewFromInt(100)) {
		t.Fatalf("expected stock 100, got %s", updatedVar.CurrentStock.String())
	}
	if !updatedVar.CostPrice.Equal(decimal.NewFromInt(80000)) {
		t.Fatalf("expected cost price 80000, got %s", updatedVar.CostPrice.String())
	}

	// Verify movement
	var mov model.InventoryMovement
	if err := db.Where("variant_id = ? AND movement_type = ?", variant.ID, model.MovementTypePurchaseIn).First(&mov).Error; err != nil {
		t.Fatalf("expected movement PURCHASE_IN, err: %v", err)
	}

	// Verify batch
	var batch model.InventoryBatch
	if err := db.Where("batch_code = ?", "LOT-FISH-001").First(&batch).Error; err != nil {
		t.Fatalf("expected batch LOT-FISH-001, err: %v", err)
	}
	if !batch.RemainingQty.Equal(decimal.NewFromInt(100)) {
		t.Fatalf("expected batch remaining qty 100, got %s", batch.RemainingQty.String())
	}
}

func TestAPI_AssemblyAndDisassembly(t *testing.T) {
	srv, db := setupAPITestServer(t)

	cat := &model.Category{Name: "Chế Biến", Code: "CAT_CHE_BIEN"}
	db.Create(cat)

	// Components
	prodThit := &model.Product{Name: "Thịt Heo Nạc", Code: "THIT_HEO", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodThit)
	varThit := &model.ProductVariant{ProductID: prodThit.ID, Sku: "THIT_HEO_SKU", VariantName: "Thịt Heo", CostPrice: decimal.NewFromInt(100000), CurrentStock: decimal.NewFromInt(50)}
	db.Create(varThit)

	prodMo := &model.Product{Name: "Mỡ Heo", Code: "MO_HEO", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodMo)
	varMo := &model.ProductVariant{ProductID: prodMo.ID, Sku: "MO_HEO_SKU", VariantName: "Mỡ Heo", CostPrice: decimal.NewFromInt(50000), CurrentStock: decimal.NewFromInt(20)}
	db.Create(varMo)

	// Target finished good
	prodCha := &model.Product{Name: "Chả Lụa", Code: "CHA_LUA", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "đòn", ProductionMode: model.ProductionModeBatchManufacture}
	db.Create(prodCha)
	varCha := &model.ProductVariant{ProductID: prodCha.ID, Sku: "CHA_LUA_SKU", VariantName: "Chả Lụa 500g", CostPrice: decimal.Zero, CurrentStock: decimal.Zero}
	db.Create(varCha)

	// 1. POST /api/bom/recipes (ASSEMBLY)
	recipePayload := map[string]interface{}{
		"target_variant_id":        varCha.ID,
		"recipe_type":              "ASSEMBLY",
		"output_qty":               1,
		"expected_wastage_percent": 0,
		"items": []map[string]interface{}{
			{
				"component_variant_id":    varThit.ID,
				"qty_required":            0.4,
				"cost_allocation_percent": 80,
			},
			{
				"component_variant_id":    varMo.ID,
				"qty_required":            0.1,
				"cost_allocation_percent": 20,
			},
		},
	}
	body, _ := json.Marshal(recipePayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/bom/recipes", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/bom/recipes status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdRecipe model.BomRecipe
	json.Unmarshal(rec.Body.Bytes(), &createdRecipe)
	if createdRecipe.ID == "" {
		t.Fatalf("failed to create assembly recipe")
	}

	// 2. GET /api/bom/recipes
	req, _ = http.NewRequest(http.MethodGet, "/api/bom/recipes", nil)
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected GET /api/bom/recipes status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var recipeList []model.BomRecipe
	json.Unmarshal(rec.Body.Bytes(), &recipeList)
	if len(recipeList) == 0 || len(recipeList[0].Items) != 2 {
		t.Fatalf("expected recipe list with items, got: %+v", recipeList)
	}

	// 3. POST /api/production/assembly
	asmPayload := map[string]interface{}{
		"recipe_id":         createdRecipe.ID,
		"target_output_qty": 10,
		"batch_code":        "BATCH-CHA-01",
		"other_cost":        5000,
	}
	body, _ = json.Marshal(asmPayload)
	req, _ = http.NewRequest(http.MethodPost, "/api/production/assembly", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/production/assembly status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Check yield stock: varCha should have 10
	var checkCha model.ProductVariant
	db.First(&checkCha, "id = ?", varCha.ID)
	if !checkCha.CurrentStock.Equal(decimal.NewFromInt(10)) {
		t.Fatalf("expected yield stock 10, got %s", checkCha.CurrentStock.String())
	}

	// 4. Test Disassembly:
	// Raw fish 5kg
	prodCaHoi := &model.Product{Name: "Cá Hồi Nguyên Con", Code: "CA_HOI", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "kg"}
	db.Create(prodCaHoi)
	varCaHoi := &model.ProductVariant{ProductID: prodCaHoi.ID, Sku: "CA_HOI_WHOLE", VariantName: "Cá Hồi Nguyên Con", CostPrice: decimal.NewFromInt(200000), CurrentStock: decimal.NewFromInt(10)}
	db.Create(varCaHoi)

	prodPhiLe := &model.Product{Name: "Phi Lê Cá Hồi", Code: "PHI_LE", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "kg"}
	db.Create(prodPhiLe)
	varPhiLe := &model.ProductVariant{ProductID: prodPhiLe.ID, Sku: "PHI_LE_SKU", VariantName: "Phi Lê", CostPrice: decimal.Zero, CurrentStock: decimal.Zero}
	db.Create(varPhiLe)

	prodDauXuong := &model.Product{Name: "Đầu Xương Cá Hồi", Code: "DAU_XUONG", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "kg"}
	db.Create(prodDauXuong)
	varDauXuong := &model.ProductVariant{ProductID: prodDauXuong.ID, Sku: "DAU_XUONG_SKU", VariantName: "Đầu Xương", CostPrice: decimal.Zero, CurrentStock: decimal.Zero}
	db.Create(varDauXuong)

	disRecipe := &model.BomRecipe{
		TargetVariantID: varCaHoi.ID,
		RecipeType:      model.RecipeTypeDisassembly,
		OutputQty:       decimal.NewFromInt(5),
		Items: []model.BomItem{
			{ComponentVariantID: varPhiLe.ID, QtyRequired: decimal.NewFromFloat(3.2), CostAllocationPercent: decimal.NewFromInt(70)},
			{ComponentVariantID: varDauXuong.ID, QtyRequired: decimal.NewFromFloat(1.3), CostAllocationPercent: decimal.NewFromInt(30)},
		},
	}
	db.Create(disRecipe)

	disPayload := map[string]interface{}{
		"recipe_id":  disRecipe.ID,
		"input_qty":  5,
		"batch_code": "LOT-DISASM-01",
		"other_cost": 20000,
		"yield_outputs": []map[string]interface{}{
			{"component_variant_id": varPhiLe.ID, "actual_qty": 3.2},
			{"component_variant_id": varDauXuong.ID, "actual_qty": 1.3},
		},
	}
	body, _ = json.Marshal(disPayload)
	req, _ = http.NewRequest(http.MethodPost, "/api/production/disassembly", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/production/disassembly status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify raw fish deducted by 5 (10 - 5 = 5)
	var checkCaHoi model.ProductVariant
	db.First(&checkCaHoi, "id = ?", varCaHoi.ID)
	if !checkCaHoi.CurrentStock.Equal(decimal.NewFromInt(5)) {
		t.Fatalf("expected raw fish stock 5, got %s", checkCaHoi.CurrentStock.String())
	}

	// Verify phi le stock increased by 3.2
	var checkPhiLe model.ProductVariant
	db.First(&checkPhiLe, "id = ?", varPhiLe.ID)
	if !checkPhiLe.CurrentStock.Equal(decimal.NewFromFloat(3.2)) {
		t.Fatalf("expected phi le stock 3.2, got %s", checkPhiLe.CurrentStock.String())
	}
}

func TestAPI_Wastage(t *testing.T) {
	srv, db := setupAPITestServer(t)

	cat := &model.Category{Name: "Đồ Uống", Code: "CAT_DRINK"}
	db.Create(cat)

	prod := &model.Product{Name: "Sữa Tươi", Code: "SUA_TUOI", CategoryID: cat.ID, ProductType: model.ProductTypeFinishedGood, BaseUom: "hộp"}
	db.Create(prod)

	variant := &model.ProductVariant{
		ProductID:    prod.ID,
		Sku:          "SUA_TUOI_1L",
		VariantName:  "Sữa Tươi 1L",
		CostPrice:    decimal.NewFromInt(30000),
		CurrentStock: decimal.NewFromInt(20),
	}
	db.Create(variant)

	// POST /api/inventory/wastage
	wastagePayload := map[string]interface{}{
		"variant_id":         variant.ID,
		"lost_qty":           4,
		"reason_note":        "Hộp bị vỡ rách trong vận chuyển",
		"record_to_cashbook": true,
	}
	body, _ := json.Marshal(wastagePayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/inventory/wastage", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("expected POST /api/inventory/wastage status 200/201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify stock reduced: 20 - 4 = 16
	var updatedVar model.ProductVariant
	db.First(&updatedVar, "id = ?", variant.ID)
	if !updatedVar.CurrentStock.Equal(decimal.NewFromInt(16)) {
		t.Fatalf("expected stock 16, got %s", updatedVar.CurrentStock.String())
	}

	// Verify cashbook entry created (4 * 30000 = 120000)
	var cashTx model.CashbookTransaction
	if err := db.Where("category = ?", model.CashbookCategoryOtherExpense).First(&cashTx).Error; err != nil {
		t.Fatalf("expected cashbook expense transaction: %v", err)
	}
	if !cashTx.Amount.Equal(decimal.NewFromInt(120000)) {
		t.Fatalf("expected expense amount 120000, got %s", cashTx.Amount.String())
	}
}

func TestAPI_PosCheckout(t *testing.T) {
	srv, db := setupAPITestServer(t)

	cat := &model.Category{Name: "Bán Hàng Tổng Hợp", Code: "CAT_POS"}
	db.Create(cat)

	// -------------------------------------------------------------------------
	// 1. Catch-weight fish sale (1.35 kg)
	// -------------------------------------------------------------------------
	prodFish := &model.Product{
		Name:        "Cá Chẽm Cân Ký",
		Code:        "PROD_FISH_CW",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	db.Create(prodFish)

	varFish := &model.ProductVariant{
		ProductID:        prodFish.ID,
		Sku:              "SKU-FISH-CW",
		VariantName:      "Cá Chẽm Tươi Sống",
		CostPrice:        decimal.NewFromInt(100000),
		BaseSellingPrice: decimal.NewFromInt(160000),
		MinSellingPrice:  decimal.NewFromInt(140000),
		CurrentStock:     decimal.NewFromInt(20),
	}
	db.Create(varFish)

	fishCheckoutReq := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"variant_id":               varFish.ID,
				"sold_uom":                 "con",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1.35,
				"actual_unit_price":        160000,
				"is_return":                false,
			},
		},
		"subtotal":         216000,
		"discount_amount":  0,
		"surcharge_amount": 0,
		"total_amount":     216000,
		"paid_amount":      216000,
		"debt_amount":      0,
		"payment_method":   "CASH",
		"notes":            "Bán cá chẽm cân 1.35kg",
	}
	body, _ := json.Marshal(fishCheckoutReq)
	req, _ := http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Test 1 (Catch-weight fish) failed: expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var updatedFish model.ProductVariant
	db.First(&updatedFish, "id = ?", varFish.ID)
	expectedFishStock := decimal.RequireFromString("18.65")
	if !updatedFish.CurrentStock.Equal(expectedFishStock) {
		t.Fatalf("expected fish stock %s, got %s", expectedFishStock, updatedFish.CurrentStock)
	}

	var fishMov model.InventoryMovement
	if err := db.Where("variant_id = ? AND movement_type = ?", varFish.ID, model.MovementTypeSaleOut).First(&fishMov).Error; err != nil {
		t.Fatalf("expected fish SALE_OUT movement: %v", err)
	}
	if !fishMov.QtyInBaseUom.Equal(decimal.RequireFromString("-1.35")) {
		t.Fatalf("expected fish movement qty -1.35, got %s", fishMov.QtyInBaseUom)
	}

	// -------------------------------------------------------------------------
	// 2. Apparel 1-touch exchange: Return shirt M (+1), take shirt L (-1)
	// -------------------------------------------------------------------------
	prodShirt := &model.Product{
		Name:        "Áo Sơ Mi Nam",
		Code:        "PROD_SHIRT",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "cái",
	}
	db.Create(prodShirt)

	varShirtM := &model.ProductVariant{
		ProductID:        prodShirt.ID,
		Sku:              "SHIRT-M",
		VariantName:      "Áo Sơ Mi Trắng Size M",
		CostPrice:        decimal.NewFromInt(200000),
		BaseSellingPrice: decimal.NewFromInt(350000),
		CurrentStock:     decimal.NewFromInt(5),
	}
	db.Create(varShirtM)

	varShirtL := &model.ProductVariant{
		ProductID:        prodShirt.ID,
		Sku:              "SHIRT-L",
		VariantName:      "Áo Sơ Mi Trắng Size L",
		CostPrice:        decimal.NewFromInt(220000),
		BaseSellingPrice: decimal.NewFromInt(380000),
		CurrentStock:     decimal.NewFromInt(5),
	}
	db.Create(varShirtL)

	exchangeReq := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"variant_id":               varShirtM.ID,
				"sold_uom":                 "cái",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1,
				"actual_unit_price":        350000,
				"is_return":                true,
			},
			{
				"variant_id":               varShirtL.ID,
				"sold_uom":                 "cái",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1,
				"actual_unit_price":        380000,
				"is_return":                false,
			},
		},
		"subtotal":         30000,
		"discount_amount":  0,
		"surcharge_amount": 0,
		"total_amount":     30000,
		"paid_amount":      30000,
		"debt_amount":      0,
		"payment_method":   "CASH",
		"notes":            "Đổi áo size M lấy L bù 30k",
	}
	body, _ = json.Marshal(exchangeReq)
	req, _ = http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Test 2 (Apparel exchange) failed: expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var freshShirtM, freshShirtL model.ProductVariant
	db.First(&freshShirtM, "id = ?", varShirtM.ID)
	db.First(&freshShirtL, "id = ?", varShirtL.ID)
	if !freshShirtM.CurrentStock.Equal(decimal.NewFromInt(6)) {
		t.Fatalf("expected shirt M stock 6, got %s", freshShirtM.CurrentStock)
	}
	if !freshShirtL.CurrentStock.Equal(decimal.NewFromInt(4)) {
		t.Fatalf("expected shirt L stock 4, got %s", freshShirtL.CurrentStock)
	}

	var returnMov model.InventoryMovement
	if err := db.Where("variant_id = ? AND movement_type = ?", varShirtM.ID, model.MovementTypeReturnIn).First(&returnMov).Error; err != nil {
		t.Fatalf("expected RETURN_IN movement for shirt M: %v", err)
	}

	// -------------------------------------------------------------------------
	// 3. Food sale with modifier topping (Trứng ốp la)
	// -------------------------------------------------------------------------
	prodCrust := &model.Product{Name: "Vỏ bánh mì", Code: "POS_CRUST", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "cái"}
	db.Create(prodCrust)
	varCrust := &model.ProductVariant{ProductID: prodCrust.ID, Sku: "SKU-CRUST-P", VariantName: "Vỏ bánh mì", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(2000)}
	db.Create(varCrust)

	prodEgg := &model.Product{Name: "Trứng gà tươi", Code: "POS_EGG", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "quả"}
	db.Create(prodEgg)
	varEgg := &model.ProductVariant{ProductID: prodEgg.ID, Sku: "SKU-EGG-P", VariantName: "Trứng gà tươi", CurrentStock: decimal.NewFromInt(30), CostPrice: decimal.NewFromInt(3000)}
	db.Create(varEgg)

	prodBanhMi := &model.Product{
		Name:           "Bánh Mì Kẹp",
		Code:           "POS_BANHMI",
		CategoryID:     cat.ID,
		ProductType:    model.ProductTypeFinishedGood,
		BaseUom:        "ổ",
		ProductionMode: model.ProductionModePosBackflush,
	}
	db.Create(prodBanhMi)

	varBanhMi := &model.ProductVariant{
		ProductID:        prodBanhMi.ID,
		Sku:              "SKU-BM-P",
		VariantName:      "Bánh Mì Thịt",
		CurrentStock:     decimal.Zero,
		CostPrice:        decimal.NewFromInt(10000),
		BaseSellingPrice: decimal.NewFromInt(25000),
	}
	db.Create(varBanhMi)

	recipeBM := &model.BomRecipe{
		TargetVariantID: varBanhMi.ID,
		RecipeType:      model.RecipeTypeAssembly,
		OutputQty:       decimal.NewFromInt(1),
		Items: []model.BomItem{
			{ComponentVariantID: varCrust.ID, QtyRequired: decimal.NewFromInt(1)},
		},
	}
	db.Create(recipeBM)

	foodReq := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"variant_id":               varBanhMi.ID,
				"sold_uom":                 "ổ",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1,
				"actual_unit_price":        25000,
				"is_return":                false,
				"modifiers": []map[string]interface{}{
					{
						"name":              "Trứng Ốp La",
						"price":             5000,
						"linked_variant_id": varEgg.ID,
						"deduct_qty":        1,
					},
				},
			},
		},
		"subtotal":         30000,
		"discount_amount":  0,
		"surcharge_amount": 0,
		"total_amount":     30000,
		"paid_amount":      30000,
		"debt_amount":      0,
		"payment_method":   "CASH",
		"notes":            "Bánh mì thêm trứng",
	}
	body, _ = json.Marshal(foodReq)
	req, _ = http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Test 3 (Food with modifier) failed: expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var freshCrust, freshEgg model.ProductVariant
	db.First(&freshCrust, "id = ?", varCrust.ID)
	db.First(&freshEgg, "id = ?", varEgg.ID)
	if !freshCrust.CurrentStock.Equal(decimal.NewFromInt(49)) {
		t.Fatalf("expected crust stock 49 (deducted by backflush), got %s", freshCrust.CurrentStock)
	}
	if !freshEgg.CurrentStock.Equal(decimal.NewFromInt(29)) {
		t.Fatalf("expected egg stock 29 (deducted by modifier), got %s", freshEgg.CurrentStock)
	}

	// -------------------------------------------------------------------------
	// 4. Credit sale (debt_amount > 0)
	// -------------------------------------------------------------------------
	customer := &model.Partner{
		Name:               "Nguyễn Văn A",
		PartnerType:        model.PartnerTypeCustomer,
		CurrentDebtBalance: decimal.NewFromInt(50000),
	}
	db.Create(customer)

	creditReq := map[string]interface{}{
		"customer_id": customer.ID,
		"items": []map[string]interface{}{
			{
				"variant_id":               varShirtL.ID,
				"sold_uom":                 "cái",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1,
				"actual_unit_price":        380000,
				"is_return":                false,
			},
		},
		"subtotal":         380000,
		"discount_amount":  0,
		"surcharge_amount": 0,
		"total_amount":     380000,
		"paid_amount":      100000,
		"debt_amount":      280000,
		"payment_method":   "MIXED",
		"notes":            "Khách trả trước 100k ghi nợ 280k",
	}
	body, _ = json.Marshal(creditReq)
	req, _ = http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Test 4 (Credit sale) failed: expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var freshCustomer model.Partner
	db.First(&freshCustomer, "id = ?", customer.ID)
	expectedDebt := decimal.NewFromInt(330000) // 50,000 + 280,000 = 330,000
	if !freshCustomer.CurrentDebtBalance.Equal(expectedDebt) {
		t.Fatalf("expected customer debt %s, got %s", expectedDebt, freshCustomer.CurrentDebtBalance)
	}

	var debtLedger model.DebtLedger
	if err := db.Where("partner_id = ? AND transaction_type = ?", customer.ID, model.DebtTransactionTypeSaleDebt).First(&debtLedger).Error; err != nil {
		t.Fatalf("expected SALE_DEBT ledger entry: %v", err)
	}
	if !debtLedger.Amount.Equal(decimal.NewFromInt(280000)) {
		t.Fatalf("expected debt ledger amount 280000, got %s", debtLedger.Amount)
	}
	if !debtLedger.BalanceAfter.Equal(expectedDebt) {
		t.Fatalf("expected debt ledger balance_after %s, got %s", expectedDebt, debtLedger.BalanceAfter)
	}

	// -------------------------------------------------------------------------
	// 5. Min selling price violation check (should fail 400)
	// -------------------------------------------------------------------------
	violatingReq := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"variant_id":               varFish.ID, // min selling price is 140,000
				"sold_uom":                 "con",
				"sold_qty":                 1,
				"actual_base_qty_deducted": 1,
				"actual_unit_price":        100000, // below 140,000!
				"is_return":                false,
			},
		},
		"total_amount": 100000,
		"paid_amount":  100000,
	}
	body, _ = json.Marshal(violatingReq)
	req, _ = http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for min selling price violation, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAPI_BOM_BackflushWithUntrackedInventoryAndAutoCost(t *testing.T) {
	srv, db := setupAPITestServer(t)

	cat := &model.Category{Name: "Đồ Uống Pha Chế", Code: "BEV_HANDMADE"}
	db.Create(cat)

	// Raw coffee: 50g @ 200 VND/g
	prodCoffee := &model.Product{Name: "Cà phê Robusta", Code: "RAW_CF", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "g"}
	db.Create(prodCoffee)
	varCoffee := &model.ProductVariant{ProductID: prodCoffee.ID, Sku: "SKU-RAW-CF", VariantName: "Cà phê", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(200)}
	db.Create(varCoffee)

	// Raw milk: 50g @ 100 VND/g
	prodMilk := &model.Product{Name: "Sữa dừa béo", Code: "RAW_COCONUT", CategoryID: cat.ID, ProductType: model.ProductTypeRawMaterial, BaseUom: "g"}
	db.Create(prodMilk)
	varMilk := &model.ProductVariant{ProductID: prodMilk.ID, Sku: "SKU-RAW-COCO", VariantName: "Sữa dừa", CurrentStock: decimal.NewFromInt(50), CostPrice: decimal.NewFromInt(100)}
	db.Create(varMilk)

	// Finished drink: TrackInventory = false, ProductionMode = NONE initially, CostPrice = 0
	prodDrink := &model.Product{
		Name:           "Cà Phê Cốt Dừa Đá",
		Code:           "FG_COCO_COFFEE",
		CategoryID:     cat.ID,
		ProductType:    model.ProductTypeFinishedGood,
		BaseUom:        "ly",
		TrackInventory: false,
		ProductionMode: model.ProductionModeNone,
	}
	db.Create(prodDrink)
	db.Model(prodDrink).Update("track_inventory", false)

	varDrink := &model.ProductVariant{
		ProductID:        prodDrink.ID,
		Sku:              "SKU-COCO-COFFEE",
		VariantName:      "Cà Phê Cốt Dừa Ly Lớn",
		CurrentStock:     decimal.Zero,
		CostPrice:        decimal.Zero,
		BaseSellingPrice: decimal.NewFromInt(35000),
	}
	db.Create(varDrink)

	// 1. Create BOM recipe via API: 20g coffee + 30g milk = 20*200 + 30*100 = 7,000 VND
	recipePayload := map[string]interface{}{
		"target_variant_id":        varDrink.ID,
		"recipe_type":              "ASSEMBLY",
		"output_qty":               1,
		"expected_wastage_percent": 0,
		"items": []map[string]interface{}{
			{"component_variant_id": varCoffee.ID, "qty_required": 20, "cost_allocation_percent": 0},
			{"component_variant_id": varMilk.ID, "qty_required": 30, "cost_allocation_percent": 0},
		},
	}
	body, _ := json.Marshal(recipePayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/bom/recipes", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := executeRequest(srv, req)
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("expected 201 for BOM recipe creation, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdRecipe model.BomRecipe
	json.Unmarshal(rec.Body.Bytes(), &createdRecipe)
	expectedUnitCost := decimal.NewFromInt(7000)
	if !createdRecipe.EstimatedUnitCost.Equal(expectedUnitCost) {
		t.Errorf("expected estimated unit cost %v, got %v", expectedUnitCost, createdRecipe.EstimatedUnitCost)
	}

	// Verify TargetVariant CostPrice updated in DB to 7,000
	var checkVarDrink model.ProductVariant
	db.First(&checkVarDrink, "id = ?", varDrink.ID)
	if !checkVarDrink.CostPrice.Equal(expectedUnitCost) {
		t.Errorf("expected variant CostPrice in DB %v, got %v", expectedUnitCost, checkVarDrink.CostPrice)
	}

	// Verify Product production_mode updated to POS_BACKFLUSH
	var checkProdDrink model.Product
	db.First(&checkProdDrink, "id = ?", prodDrink.ID)
	if checkProdDrink.ProductionMode != model.ProductionModePosBackflush {
		t.Errorf("expected production mode POS_BACKFLUSH, got %v", checkProdDrink.ProductionMode)
	}

	// 2. POS Checkout: Sell 2 cups
	checkoutReq := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"variant_id":               varDrink.ID,
				"sold_uom":                 "ly",
				"sold_qty":                 2,
				"actual_base_qty_deducted": 2,
				"actual_unit_price":        35000,
				"is_return":                false,
			},
		},
		"subtotal":       70000,
		"total_amount":   70000,
		"paid_amount":    70000,
		"payment_method": "CASH",
	}
	body, _ = json.Marshal(checkoutReq)
	req, _ = http.NewRequest(http.MethodPost, "/api/pos/checkout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = executeRequest(srv, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected POS checkout status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdOrder model.SalesOrder
	json.Unmarshal(rec.Body.Bytes(), &createdOrder)

	// Verify total COGS: 2 * 7,000 = 14,000 VND
	expectedTotalCogs := decimal.NewFromInt(14000)
	if !createdOrder.TotalCogs.Equal(expectedTotalCogs) {
		t.Errorf("expected total COGS %v, got %v", expectedTotalCogs, createdOrder.TotalCogs)
	}

	// Verify ingredients deducted:
	// Coffee: 50 - 2*20 = 10g
	var freshCoffee model.ProductVariant
	db.First(&freshCoffee, "id = ?", varCoffee.ID)
	if !freshCoffee.CurrentStock.Equal(decimal.NewFromInt(10)) {
		t.Errorf("expected coffee stock 10, got %v", freshCoffee.CurrentStock)
	}

	// Milk: 50 - 2*30 = -10g
	var freshMilk model.ProductVariant
	db.First(&freshMilk, "id = ?", varMilk.ID)
	if !freshMilk.CurrentStock.Equal(decimal.NewFromInt(-10)) {
		t.Errorf("expected milk stock -10, got %v", freshMilk.CurrentStock)
	}

	// Finished drink stock: must NOT be decremented (stays 0) because TrackInventory = false
	db.First(&checkVarDrink, "id = ?", varDrink.ID)
	if !checkVarDrink.CurrentStock.Equal(decimal.Zero) {
		t.Errorf("expected untracked drink stock to remain 0, got %v", checkVarDrink.CurrentStock)
	}

	// 3. Test POST /api/bom/recipes/{id}/sync-cost
	syncReq, _ := http.NewRequest(http.MethodPost, "/api/bom/recipes/"+createdRecipe.ID+"/sync-cost", nil)
	recSync := executeRequest(srv, syncReq)
	if recSync.Code != http.StatusOK {
		t.Fatalf("expected sync-cost status 200, got %d: %s", recSync.Code, recSync.Body.String())
	}
}
