package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gorm.io/gorm"

	"magic_store/backend/internal/api"
	"magic_store/backend/internal/model"
)

func setupTestServerWithDB(t *testing.T) (*api.Server, *gorm.DB) {
	return setupAPITestServer(t)
}

func TestUnitsAPI_CRUD_And_ConflictCheck(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// 1. Create Unit
	createPayload := map[string]interface{}{
		"code":        "box", // test lowercase normalization
		"name":        "Hộp",
		"description": "Đóng gói dạng hộp",
		"is_active":   true,
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest("POST", "/api/units", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.ServeHTTP(w, req)

	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("expected 200/201, got %d: %s", w.Code, w.Body.String())
	}

	var created model.Unit
	json.NewDecoder(w.Body).Decode(&created)
	if created.Code != "BOX" {
		t.Errorf("expected code BOX, got %s", created.Code)
	}
	if created.ID == "" {
		t.Errorf("expected unit ID to be generated")
	}

	// 2. Link Unit to a Product base_uom
	cat := model.Category{Code: "CAT_UOM_TEST", Name: "Cat Test", IsActive: true}
	db.Create(&cat)
	prod := model.Product{
		Code:        "PROD_BOX_1",
		Name:        "Bánh Hộp",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "BOX",
	}
	db.Create(&prod)

	// 3. Attempt to delete Unit -> Must return 409 Conflict
	delReq := httptest.NewRequest("DELETE", "/api/units/"+created.ID, nil)
	delW := httptest.NewRecorder()
	server.ServeHTTP(delW, delReq)

	if delW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting linked unit, got %d: %s", delW.Code, delW.Body.String())
	}

	// 4. Test GET /api/units (with active_only filter)
	getReq := httptest.NewRequest("GET", "/api/units?active_only=true", nil)
	getW := httptest.NewRecorder()
	server.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET /api/units, got %d", getW.Code)
	}
	var units []model.Unit
	json.NewDecoder(getW.Body).Decode(&units)
	if len(units) == 0 {
		t.Errorf("expected at least 1 unit returned")
	}

	// 5. Test PUT /api/units/{id}
	updatePayload := map[string]interface{}{
		"name":        "Hộp Giấy",
		"description": "Đóng gói hộp giấy",
		"is_active":   true,
	}
	upBody, _ := json.Marshal(updatePayload)
	putReq := httptest.NewRequest("PUT", "/api/units/"+created.ID, bytes.NewReader(upBody))
	putReq.Header.Set("Content-Type", "application/json")
	putW := httptest.NewRecorder()
	server.ServeHTTP(putW, putReq)
	if putW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PUT /api/units/{id}, got %d: %s", putW.Code, putW.Body.String())
	}

	// 6. Test UomConversion referential conflict
	convUnitPayload := map[string]interface{}{
		"code":      "PACK",
		"name":      "Gói",
		"is_active": true,
	}
	cBody, _ := json.Marshal(convUnitPayload)
	cReq := httptest.NewRequest("POST", "/api/units", bytes.NewReader(cBody))
	cReq.Header.Set("Content-Type", "application/json")
	cW := httptest.NewRecorder()
	server.ServeHTTP(cW, cReq)
	var convUnit model.Unit
	json.NewDecoder(cW.Body).Decode(&convUnit)

	uomConv := model.UomConversion{
		VariantID: "dummy-variant",
		UomName:   "PACK",
	}
	db.Create(&uomConv)

	delConvReq := httptest.NewRequest("DELETE", "/api/units/"+convUnit.ID, nil)
	delConvW := httptest.NewRecorder()
	server.ServeHTTP(delConvW, delConvReq)
	if delConvW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting unit used in UomConversion, got %d: %s", delConvW.Code, delConvW.Body.String())
	}

	// 7. Delete unlinked unit -> 200 OK
	standalonePayload := map[string]interface{}{
		"code":      "BOTTLE",
		"name":      "Chai",
		"is_active": true,
	}
	sBody, _ := json.Marshal(standalonePayload)
	sReq := httptest.NewRequest("POST", "/api/units", bytes.NewReader(sBody))
	sReq.Header.Set("Content-Type", "application/json")
	sW := httptest.NewRecorder()
	server.ServeHTTP(sW, sReq)
	var standaloneUnit model.Unit
	json.NewDecoder(sW.Body).Decode(&standaloneUnit)

	delStandReq := httptest.NewRequest("DELETE", "/api/units/"+standaloneUnit.ID, nil)
	delStandW := httptest.NewRecorder()
	server.ServeHTTP(delStandW, delStandReq)
	if delStandW.Code != http.StatusOK && delStandW.Code != http.StatusNoContent {
		t.Fatalf("expected 200/204 when deleting unlinked unit, got %d: %s", delStandW.Code, delStandW.Body.String())
	}
}
