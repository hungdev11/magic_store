package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shopspring/decimal"
	"magic_store/backend/internal/model"
)

func decimalFromFloat(v float64) decimal.Decimal {
	return decimal.NewFromFloat(v)
}

func TestCategoryAndDeleteConflict(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// 1. Conflict with Products
	cat := model.Category{Code: "DEL_CAT_1", Name: "Cat To Delete", IsActive: true}
	db.Create(&cat)

	prod := model.Product{
		Code:        "PROD_CAT_DEL",
		Name:        "Product in Cat",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "KG",
	}
	db.Create(&prod)

	delReq := httptest.NewRequest("DELETE", "/api/categories/"+cat.ID, nil)
	delW := httptest.NewRecorder()
	server.ServeHTTP(delW, delReq)

	if delW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting category with products, got %d: %s", delW.Code, delW.Body.String())
	}

	// 2. Conflict with Child Categories
	parentCat := model.Category{Code: "PARENT_CAT", Name: "Parent Cat", IsActive: true}
	db.Create(&parentCat)

	childCat := model.Category{Code: "CHILD_CAT", Name: "Child Cat", IsActive: true, ParentID: &parentCat.ID}
	db.Create(&childCat)

	delParentReq := httptest.NewRequest("DELETE", "/api/categories/"+parentCat.ID, nil)
	delParentW := httptest.NewRecorder()
	server.ServeHTTP(delParentW, delParentReq)

	if delParentW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting category with child category, got %d: %s", delParentW.Code, delParentW.Body.String())
	}

	// 3. Update Category (PUT)
	updatePayload := map[string]interface{}{
		"name":      "Updated Child Cat",
		"code":      "CHILD_CAT_UPDATED",
		"is_active": false,
	}
	upBody, _ := json.Marshal(updatePayload)
	putReq := httptest.NewRequest("PUT", "/api/categories/"+childCat.ID, bytes.NewReader(upBody))
	putReq.Header.Set("Content-Type", "application/json")
	putW := httptest.NewRecorder()
	server.ServeHTTP(putW, putReq)

	if putW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PUT /api/categories/{id}, got %d: %s", putW.Code, putW.Body.String())
	}

	var updatedCat model.Category
	if err := json.NewDecoder(putW.Body).Decode(&updatedCat); err != nil {
		t.Fatalf("failed to decode updated category: %v", err)
	}
	if updatedCat.Name != "Updated Child Cat" || updatedCat.Code != "CHILD_CAT_UPDATED" || updatedCat.IsActive != false {
		t.Fatalf("category fields not properly updated: %+v", updatedCat)
	}

	// 4. Delete Unlinked Category
	standaloneCat := model.Category{Code: "STANDALONE_CAT", Name: "Standalone Cat", IsActive: true}
	db.Create(&standaloneCat)

	delStandReq := httptest.NewRequest("DELETE", "/api/categories/"+standaloneCat.ID, nil)
	delStandW := httptest.NewRecorder()
	server.ServeHTTP(delStandW, delStandReq)

	if delStandW.Code != http.StatusOK && delStandW.Code != http.StatusNoContent {
		t.Fatalf("expected 200/204 when deleting standalone category, got %d: %s", delStandW.Code, delStandW.Body.String())
	}
}

func TestPartnerAndDeleteConflict(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// 1. Conflict with Batches
	supplier := model.Partner{
		PartnerType: model.PartnerTypeSupplier,
		Name:        "Supplier To Del",
		IsActive:    true,
	}
	db.Create(&supplier)

	prod := model.Product{
		Code:        "PROD_SUP_DEL",
		Name:        "Prod",
		CategoryID:  "dummy_cat",
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "KG",
	}
	db.Create(&prod)
	variant := model.ProductVariant{
		ProductID:   prod.ID,
		Sku:         "SKU_SUP_DEL",
		VariantName: "Var",
	}
	db.Create(&variant)
	batch := model.InventoryBatch{
		VariantID:   variant.ID,
		BatchCode:   "BATCH_SUP_DEL",
		SupplierID:  &supplier.ID,
		InitialQty:  decimalFromFloat(10),
		RemainingQty: decimalFromFloat(10),
	}
	db.Create(&batch)

	delReq := httptest.NewRequest("DELETE", "/api/partners/"+supplier.ID, nil)
	delW := httptest.NewRecorder()
	server.ServeHTTP(delW, delReq)

	if delW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting supplier with batches, got %d: %s", delW.Code, delW.Body.String())
	}

	// 2. Conflict with Orders
	customer := model.Partner{
		PartnerType: model.PartnerTypeCustomer,
		Name:        "Customer With Order",
		IsActive:    true,
	}
	db.Create(&customer)

	order := model.SalesOrder{
		OrderNumber: "ORD_DEL_TEST_1",
		CustomerID:  &customer.ID,
		TotalAmount: decimalFromFloat(100),
		Subtotal:    decimalFromFloat(100),
	}
	db.Create(&order)

	delCustReq := httptest.NewRequest("DELETE", "/api/partners/"+customer.ID, nil)
	delCustW := httptest.NewRecorder()
	server.ServeHTTP(delCustW, delCustReq)

	if delCustW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting customer with orders, got %d: %s", delCustW.Code, delCustW.Body.String())
	}

	// 3. Conflict with Debt Ledger
	debtPartner := model.Partner{
		PartnerType: model.PartnerTypeCustomer,
		Name:        "Partner With Debt",
		IsActive:    true,
	}
	db.Create(&debtPartner)

	debtEntry := model.DebtLedger{
		PartnerID:       debtPartner.ID,
		TransactionType: model.DebtTransactionTypeSaleDebt,
		Amount:          decimalFromFloat(500),
		BalanceAfter:    decimalFromFloat(500),
	}
	db.Create(&debtEntry)

	delDebtReq := httptest.NewRequest("DELETE", "/api/partners/"+debtPartner.ID, nil)
	delDebtW := httptest.NewRecorder()
	server.ServeHTTP(delDebtW, delDebtReq)

	if delDebtW.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting partner with debt ledger, got %d: %s", delDebtW.Code, delDebtW.Body.String())
	}

	// 4. Update Partner (PUT)
	updatePartnerPayload := map[string]interface{}{
		"name":        "Supplier Updated Name",
		"partner_type": "SUPPLIER",
		"price_tier":  "WHOLESALE",
		"is_active":   true,
	}
	upPartnerBody, _ := json.Marshal(updatePartnerPayload)
	putPartnerReq := httptest.NewRequest("PUT", "/api/partners/"+supplier.ID, bytes.NewReader(upPartnerBody))
	putPartnerReq.Header.Set("Content-Type", "application/json")
	putPartnerW := httptest.NewRecorder()
	server.ServeHTTP(putPartnerW, putPartnerReq)

	if putPartnerW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PUT /api/partners/{id}, got %d: %s", putPartnerW.Code, putPartnerW.Body.String())
	}

	var updatedPartner model.Partner
	if err := json.NewDecoder(putPartnerW.Body).Decode(&updatedPartner); err != nil {
		t.Fatalf("failed to decode updated partner: %v", err)
	}
	if updatedPartner.Name != "Supplier Updated Name" || updatedPartner.PriceTier != "WHOLESALE" {
		t.Fatalf("partner fields not updated properly: %+v", updatedPartner)
	}

	// 5. Query Filter GET /api/partners?type=CUSTOMER
	getReq := httptest.NewRequest("GET", "/api/partners?type=CUSTOMER", nil)
	getW := httptest.NewRecorder()
	server.ServeHTTP(getW, getReq)

	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET /api/partners?type=CUSTOMER, got %d", getW.Code)
	}
	var customerList []model.Partner
	json.NewDecoder(getW.Body).Decode(&customerList)
	for _, p := range customerList {
		if p.PartnerType != model.PartnerTypeCustomer {
			t.Fatalf("expected only CUSTOMER type, got %s", p.PartnerType)
		}
	}

	// 6. Delete Unlinked Partner
	unlinkedPartner := model.Partner{
		PartnerType: model.PartnerTypeSupplier,
		Name:        "Unlinked Partner",
		IsActive:    true,
	}
	db.Create(&unlinkedPartner)

	delUnlinkedReq := httptest.NewRequest("DELETE", "/api/partners/"+unlinkedPartner.ID, nil)
	delUnlinkedW := httptest.NewRecorder()
	server.ServeHTTP(delUnlinkedW, delUnlinkedReq)

	if delUnlinkedW.Code != http.StatusOK && delUnlinkedW.Code != http.StatusNoContent {
		t.Fatalf("expected 200/204 when deleting unlinked partner, got %d: %s", delUnlinkedW.Code, delUnlinkedW.Body.String())
	}
}
