package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"magic_store/backend/internal/model"
)

func strPtr(s string) *string {
	return &s
}

func TestBatchesAPI_List_Update_And_Trace(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// Create test batch
	cat := model.Category{Code: "CAT_B1", Name: "Cat B1", IsActive: true}
	db.Create(&cat)
	prod := model.Product{Code: "PROD_B1", Name: "Product Batch 1", CategoryID: cat.ID, BaseUom: "KG"}
	db.Create(&prod)
	variant := model.ProductVariant{ProductID: prod.ID, Sku: "SKU_B1"}
	db.Create(&variant)

	now := time.Now()
	expiry := now.AddDate(0, 0, 15) // expiring in 15 days
	batch := model.InventoryBatch{
		VariantID:    variant.ID,
		BatchCode:    "LOT-2026-001",
		InitialQty:   decimalFromFloat(50),
		RemainingQty: decimalFromFloat(45),
		ExpiryDate:   &expiry,
		Notes:        "Ghi chú ban đầu",
	}
	db.Create(&batch)

	// Add movement for trace
	movement := model.InventoryMovement{
		VariantID:    variant.ID,
		BatchID:      &batch.ID,
		MovementType: model.MovementTypePurchaseIn,
		QtyInBaseUom: decimalFromFloat(50),
		InputUom:     "KG",
		InputQty:     decimalFromFloat(50),
		ReferenceID:  strPtr("PO-001"),
		ReasonNote:   strPtr("Nhập từ NCC"),
	}
	db.Create(&movement)

	// 1. Test GET /api/batches
	reqList := httptest.NewRequest("GET", "/api/batches?q=LOT-2026", nil)
	wList := httptest.NewRecorder()
	server.ServeHTTP(wList, reqList)
	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wList.Code, wList.Body.String())
	}

	var batches []model.InventoryBatch
	if err := json.NewDecoder(wList.Body).Decode(&batches); err != nil {
		t.Fatalf("failed to decode batches response: %v", err)
	}
	if len(batches) != 1 || batches[0].BatchCode != "LOT-2026-001" {
		t.Fatalf("unexpected batches returned: %+v", batches)
	}
	if batches[0].Variant == nil || batches[0].Variant.Product == nil {
		t.Fatalf("expected preloaded Variant.Product, got: %+v", batches[0].Variant)
	}

	// 1b. Test GET /api/batches with status filters
	reqActive := httptest.NewRequest("GET", "/api/batches?status=ACTIVE", nil)
	wActive := httptest.NewRecorder()
	server.ServeHTTP(wActive, reqActive)
	if wActive.Code != http.StatusOK {
		t.Fatalf("expected 200 for ACTIVE status, got %d: %s", wActive.Code, wActive.Body.String())
	}
	var activeBatches []model.InventoryBatch
	_ = json.NewDecoder(wActive.Body).Decode(&activeBatches)
	if len(activeBatches) != 1 {
		t.Fatalf("expected 1 active batch, got %d", len(activeBatches))
	}

	reqExpiring := httptest.NewRequest("GET", "/api/batches?status=EXPIRING_SOON", nil)
	wExpiring := httptest.NewRecorder()
	server.ServeHTTP(wExpiring, reqExpiring)
	if wExpiring.Code != http.StatusOK {
		t.Fatalf("expected 200 for EXPIRING_SOON status, got %d: %s", wExpiring.Code, wExpiring.Body.String())
	}
	var expiringBatches []model.InventoryBatch
	_ = json.NewDecoder(wExpiring.Body).Decode(&expiringBatches)
	if len(expiringBatches) != 1 {
		t.Fatalf("expected 1 expiring soon batch, got %d", len(expiringBatches))
	}

	reqExpired := httptest.NewRequest("GET", "/api/batches?status=EXPIRED", nil)
	wExpired := httptest.NewRecorder()
	server.ServeHTTP(wExpired, reqExpired)
	if wExpired.Code != http.StatusOK {
		t.Fatalf("expected 200 for EXPIRED status, got %d: %s", wExpired.Code, wExpired.Body.String())
	}
	var expiredBatches []model.InventoryBatch
	_ = json.NewDecoder(wExpired.Body).Decode(&expiredBatches)
	if len(expiredBatches) != 0 {
		t.Fatalf("expected 0 expired batches, got %d", len(expiredBatches))
	}

	reqOOS := httptest.NewRequest("GET", "/api/batches?status=OUT_OF_STOCK", nil)
	wOOS := httptest.NewRecorder()
	server.ServeHTTP(wOOS, reqOOS)
	if wOOS.Code != http.StatusOK {
		t.Fatalf("expected 200 for OUT_OF_STOCK status, got %d: %s", wOOS.Code, wOOS.Body.String())
	}
	var oosBatches []model.InventoryBatch
	_ = json.NewDecoder(wOOS.Body).Decode(&oosBatches)
	if len(oosBatches) != 0 {
		t.Fatalf("expected 0 out of stock batches, got %d", len(oosBatches))
	}

	// 2. Test GET /api/batches/{id}/trace
	reqTrace := httptest.NewRequest("GET", "/api/batches/"+batch.ID+"/trace", nil)
	wTrace := httptest.NewRecorder()
	server.ServeHTTP(wTrace, reqTrace)
	if wTrace.Code != http.StatusOK {
		t.Fatalf("expected 200 for trace, got %d: %s", wTrace.Code, wTrace.Body.String())
	}

	var traceMovements []model.InventoryMovement
	if err := json.NewDecoder(wTrace.Body).Decode(&traceMovements); err != nil {
		t.Fatalf("failed to decode trace response: %v", err)
	}
	if len(traceMovements) != 1 || traceMovements[0].ID != movement.ID {
		t.Fatalf("unexpected movements returned for trace: %+v", traceMovements)
	}

	// 3. Test PUT /api/batches/{id} update notes and expiry_date
	newExpiry := now.AddDate(0, 1, 0)
	updatePayload := map[string]interface{}{
		"notes":       "Đã kiểm định lại chất lượng",
		"expiry_date": newExpiry.Format(time.RFC3339),
	}
	body, _ := json.Marshal(updatePayload)
	reqUpdate := httptest.NewRequest("PUT", "/api/batches/"+batch.ID, bytes.NewReader(body))
	reqUpdate.Header.Set("Content-Type", "application/json")
	wUpdate := httptest.NewRecorder()
	server.ServeHTTP(wUpdate, reqUpdate)
	if wUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 for update batch, got %d: %s", wUpdate.Code, wUpdate.Body.String())
	}

	var updatedBatch model.InventoryBatch
	if err := json.NewDecoder(wUpdate.Body).Decode(&updatedBatch); err != nil {
		t.Fatalf("failed to decode updated batch response: %v", err)
	}
	if updatedBatch.Notes != "Đã kiểm định lại chất lượng" {
		t.Fatalf("expected updated notes, got %s", updatedBatch.Notes)
	}
	if updatedBatch.ExpiryDate == nil || updatedBatch.ExpiryDate.Format(time.RFC3339) != newExpiry.Format(time.RFC3339) {
		t.Fatalf("expected updated expiry date %v, got %v", newExpiry, updatedBatch.ExpiryDate)
	}
}
