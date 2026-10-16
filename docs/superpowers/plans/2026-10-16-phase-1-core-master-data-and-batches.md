# Pha 1: Core Components, Master Data & Quản Lý Lô Hàng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng component `SearchableSelect` dùng chung, hoàn thiện full CRUD với kiểm tra ràng buộc toàn vẹn cho Đơn vị tính (Units), Danh mục (Categories), Đối tác (Nhà cung cấp / Khách hàng), cùng module Quản lý Số Lô & Truy vết biến động kho.

**Architecture:** Bổ sung model `Unit` và mở rộng các model master trong Prisma và Go GORM; xây dựng REST API endpoints với xử lý lỗi 409 Conflict khi xóa dữ liệu đang liên kết; phát triển `SearchableSelect` chuẩn design token (chống AI slop); chuyển đổi UI sang mô hình List View + Modal Form (chỉ hiện khi tạo/sửa) và bố trí lại Sidebar navigation.

**Tech Stack:** Go (GORM, net/http ServeMux), PostgreSQL (Prisma Schema), Next.js 15 (App Router, React 19), Tailwind CSS, Lucide React, TypeScript.

## Global Constraints
- Bắt buộc tuân thủ nguyên tắc Frontend Design Token trong `CLAUDE.md`: Cấm `rounded-2xl`, `rounded-3xl`, `shadow-xl`, `backdrop-blur`; chỉ dùng `rounded-sm` (4px), `rounded-md` (6-8px), viền 1px `border-border-default`/`border-border-subtle`.
- Số liệu tiền tệ, số lượng, ngày tháng, mã barcode, SKU bắt buộc dùng class `font-mono tabular-nums`.
- Các API xóa (DELETE) master data khi đã có dữ liệu liên kết phải trả về HTTP `409 Conflict` kèm thông báo lỗi rõ ràng tiếng Việt.
- Luôn tiền tố lệnh bằng `rtk` (ví dụ `rtk go test ./...`, `rtk npm run build`).

---

### Task 1: Database Schema & Go Models

**Files:**
- Modify: `prisma/schema.prisma:126-137`
- Modify: `prisma/schema.prisma:238-259`
- Modify: `prisma/schema.prisma:332-348`
- Create: `backend/internal/model/unit.go`
- Modify: `backend/internal/model/category.go:12-23`
- Modify: `backend/internal/model/partner.go:1-25`
- Modify: `backend/internal/model/inventory.go:10-30`
- Test: `backend/tests/model_test.go`

**Interfaces:**
- Produces: `model.Unit` struct (`ID`, `Code`, `Name`, `Description`, `IsActive`, `CreatedAt`, `UpdatedAt`)
- Produces: `model.Category.IsActive`, `model.Partner.IsActive`, `model.InventoryBatch.Notes`

- [ ] **Step 1: Write failing model tests for Unit, Category.IsActive, Partner.IsActive, and InventoryBatch.Notes**

Thêm các test case vào `backend/tests/model_test.go`:
```go
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

	// Test InventoryBatch.Notes
	var loadedCat model.Category
	if err := db.First(&loadedCat, "code = ?", "SEAFOOD_TEST").Error; err != nil {
		t.Fatalf("failed to load cat: %v", err)
	}
	if !loadedCat.IsActive {
		t.Errorf("expected loadedCat.IsActive to be true")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestPhase1Models_UnitAndExtensions ./tests`  
Expected: FAIL due to `model.Unit undefined` and missing fields.

- [ ] **Step 3: Update Prisma schema and implement Go models**

1. Cập nhật `prisma/schema.prisma` thêm model `Unit` và các trường `is_active`, `notes`.
2. Tạo file `backend/internal/model/unit.go`:
```go
package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Unit defines a standardized unit of measure.
type Unit struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	Code        string    `gorm:"uniqueIndex;not null;size:50" json:"code"`
	Name        string    `gorm:"not null;size:100" json:"name"`
	Description string    `gorm:"size:255" json:"description,omitempty"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (u *Unit) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
```

3. Thêm trường `IsActive bool` vào `backend/internal/model/category.go` và `backend/internal/model/partner.go`.
4. Thêm trường `Notes string` vào `backend/internal/model/inventory.go` trong `InventoryBatch`.
5. Đăng ký migrate `&model.Unit{}` vào `setupTestDB` trong `backend/tests/api_test.go` và `backend/tests/model_test.go`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestPhase1Models_UnitAndExtensions ./tests`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add prisma/schema.prisma backend/internal/model/ backend/tests/model_test.go && rtk git commit -m "feat(backend): add unit model and extend category, partner, and batch models

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend Units CRUD API with Referential Integrity

**Files:**
- Modify: `backend/internal/api/routes.go:37-67`
- Modify: `backend/internal/api/handlers.go`
- Test: `backend/tests/units_api_test.go`

**Interfaces:**
- Produces: `GET /api/units`, `POST /api/units`, `PUT /api/units/:id`, `DELETE /api/units/:id`
- Produces HTTP 409 Conflict if unit is referenced by any `Product.BaseUom` or `UomConversion.UomName`.

- [ ] **Step 1: Write failing tests for Units API**

Tạo `backend/tests/units_api_test.go`:
```go
package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"magic_store/backend/internal/model"
)

func TestUnitsAPI_CRUD_And_ConflictCheck(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// 1. Create Unit
	createPayload := map[string]interface{}{
		"code":        "BOX",
		"name":        "Hộp",
		"description": "Đóng gói dạng hộp",
		"is_active":    true,
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
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestUnitsAPI_CRUD_And_ConflictCheck ./tests`  
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement Units API handlers and routes**

1. Trong `backend/internal/api/routes.go`:
```go
mux.HandleFunc("GET /api/units", s.handleGetUnits)
mux.HandleFunc("POST /api/units", s.handleCreateUnit)
mux.HandleFunc("PUT /api/units/{id}", s.handleUpdateUnit)
mux.HandleFunc("DELETE /api/units/{id}", s.handleDeleteUnit)
```
2. Trong `backend/internal/api/handlers.go`, viết `handleGetUnits`, `handleCreateUnit`, `handleUpdateUnit`, `handleDeleteUnit`:
- `handleDeleteUnit`: kiểm tra `db.Model(&model.Product{}).Where("base_uom = ?", unit.Code).Count(&prodCount)` và `db.Model(&model.UomConversion{}).Where("uom_name = ?", unit.Code).Count(&convCount)`. Nếu `prodCount > 0 || convCount > 0`, trả `w.WriteHeader(http.StatusConflict)` và JSON `{"error": "Đơn vị đang được sử dụng ở sản phẩm hoặc bảng quy đổi, không thể xóa."}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestUnitsAPI_CRUD_And_ConflictCheck ./tests`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add backend/internal/api/ backend/tests/units_api_test.go && rtk git commit -m "feat(backend): implement units CRUD API with referential conflict check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend Categories & Partners Update/Delete with Conflict Checks

**Files:**
- Modify: `backend/internal/api/routes.go`
- Modify: `backend/internal/api/handlers.go`
- Test: `backend/tests/categories_partners_api_test.go`

**Interfaces:**
- Produces: `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`
- Produces: `PUT /api/partners/{id}`, `DELETE /api/partners/{id}`
- Produces: `GET /api/partners?type=SUPPLIER` / `CUSTOMER`

- [ ] **Step 1: Write failing tests for Categories & Partners delete conflict checks**

Tạo `backend/tests/categories_partners_api_test.go`:
```go
package tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"magic_store/backend/internal/model"
)

func TestCategoryAndDeleteConflict(t *testing.T) {
	server, db := setupTestServerWithDB(t)

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
}

func TestPartnerAndDeleteConflict(t *testing.T) {
	server, db := setupTestServerWithDB(t)

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
		ProductID: prod.ID,
		SKU:       "SKU_SUP_DEL",
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
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run "TestCategoryAndDeleteConflict|TestPartnerAndDeleteConflict" ./tests`  
Expected: FAIL (404/405)

- [ ] **Step 3: Implement Category & Partner Update & Delete Handlers**

1. Thêm routes trong `backend/internal/api/routes.go`:
```go
mux.HandleFunc("PUT /api/categories/{id}", s.handleUpdateCategory)
mux.HandleFunc("DELETE /api/categories/{id}", s.handleDeleteCategory)
mux.HandleFunc("PUT /api/partners/{id}", s.handleUpdatePartner)
mux.HandleFunc("DELETE /api/partners/{id}", s.handleDeletePartner)
```
2. Thêm handlers trong `backend/internal/api/handlers.go`:
- `handleDeleteCategory`: đếm `products` (`category_id = :id`) và con `categories` (`parent_id = :id`). Nếu có, trả 409 Conflict: `"Danh mục đang chứa sản phẩm hoặc danh mục con, không thể xóa."`
- `handleDeletePartner`: đếm `inventory_batches` (`supplier_id = :id`), `sales_orders` (`customer_id = :id`), `debt_ledgers` (`partner_id = :id`). Nếu có, trả 409 Conflict: `"Đối tác đã phát sinh giao dịch, không thể xóa."`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run "TestCategoryAndDeleteConflict|TestPartnerAndDeleteConflict" ./tests`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add backend/internal/api/ backend/tests/categories_partners_api_test.go && rtk git commit -m "feat(backend): add category and partner update/delete with referential protection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Backend Batches List & Traceability API

**Files:**
- Modify: `backend/internal/api/routes.go`
- Modify: `backend/internal/api/handlers.go`
- Test: `backend/tests/batches_api_test.go`

**Interfaces:**
- Produces: `GET /api/batches?status=...&q=...`
- Produces: `GET /api/batches/{id}/trace`
- Produces: `PUT /api/batches/{id}`

- [ ] **Step 1: Write failing test for Batches List, Update, and Traceability**

Tạo `backend/tests/batches_api_test.go`:
```go
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

func TestBatchesAPI_List_Update_And_Trace(t *testing.T) {
	server, db := setupTestServerWithDB(t)

	// Create test batch
	cat := model.Category{Code: "CAT_B1", Name: "Cat B1", IsActive: true}
	db.Create(&cat)
	prod := model.Product{Code: "PROD_B1", Name: "Product Batch 1", CategoryID: cat.ID, BaseUom: "KG"}
	db.Create(&prod)
	variant := model.ProductVariant{ProductID: prod.ID, SKU: "SKU_B1"}
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
		VariantID:       variant.ID,
		BatchID:         &batch.ID,
		MovementType:    model.MovementTypePurchaseIn,
		QtyInBaseUom:    decimalFromFloat(50),
		InputUom:        "KG",
		InputQty:        decimalFromFloat(50),
		ReferenceID:     strPtr("PO-001"),
		ReasonNote:      strPtr("Nhập từ NCC"),
	}
	db.Create(&movement)

	// 1. Test GET /api/batches
	reqList := httptest.NewRequest("GET", "/api/batches?q=LOT-2026", nil)
	wList := httptest.NewRecorder()
	server.ServeHTTP(wList, reqList)
	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wList.Code, wList.Body.String())
	}

	// 2. Test GET /api/batches/{id}/trace
	reqTrace := httptest.NewRequest("GET", "/api/batches/"+batch.ID+"/trace", nil)
	wTrace := httptest.NewRecorder()
	server.ServeHTTP(wTrace, reqTrace)
	if wTrace.Code != http.StatusOK {
		t.Fatalf("expected 200 for trace, got %d: %s", wTrace.Code, wTrace.Body.String())
	}

	// 3. Test PUT /api/batches/{id} update notes
	updatePayload := map[string]interface{}{
		"notes": "Đã kiểm định lại chất lượng",
	}
	body, _ := json.Marshal(updatePayload)
	reqUpdate := httptest.NewRequest("PUT", "/api/batches/"+batch.ID, bytes.NewReader(body))
	reqUpdate.Header.Set("Content-Type", "application/json")
	wUpdate := httptest.NewRecorder()
	server.ServeHTTP(wUpdate, reqUpdate)
	if wUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 for update batch, got %d: %s", wUpdate.Code, wUpdate.Body.String())
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestBatchesAPI_List_Update_And_Trace ./tests`  
Expected: FAIL (404)

- [ ] **Step 3: Implement Batches Handlers and Routes**

1. Trong `backend/internal/api/routes.go`:
```go
mux.HandleFunc("GET /api/batches", s.handleGetBatches)
mux.HandleFunc("GET /api/batches/{id}/trace", s.handleGetBatchTrace)
mux.HandleFunc("PUT /api/batches/{id}", s.handleUpdateBatch)
```
2. Trong `backend/internal/api/handlers.go`:
- `handleGetBatches`: truy vấn `InventoryBatch` preloaded với `Variant.Product` và `Supplier`, hỗ trợ lọc theo search query `q` và trạng thái `status` (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `OUT_OF_STOCK`).
- `handleGetBatchTrace`: lấy danh sách `InventoryMovement` có `batch_id = :id` sắp xếp theo `created_at DESC`.
- `handleUpdateBatch`: cập nhật `expiry_date` và `notes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/hungpp/magic_store/backend && rtk go test -v -run TestBatchesAPI_List_Update_And_Trace ./tests`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add backend/internal/api/ backend/tests/batches_api_test.go && rtk git commit -m "feat(backend): implement batches list, update, and movement trace API

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend Shared Component: `SearchableSelect`

**Files:**
- Create: `frontend/src/components/common/SearchableSelect.tsx`
- Test: Build verification & TypeScript check

**Interfaces:**
- Produces: `SearchableSelect` React component
```typescript
export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}
```

- [ ] **Step 1: Create SearchableSelect component with anti-AI slop styling**

Tạo `frontend/src/components/common/SearchableSelect.tsx`:
- Sử dụng input tìm kiếm tức thì bên trong popover.
- Hỗ trợ bàn phím: `ArrowDown`, `ArrowUp`, `Enter`, `Escape`.
- Tuân thủ token: bo góc `rounded-md`, viền `border border-border-default`, nền `bg-surface-card`, text `text-text-main`, không dùng shadow lòe loẹt hay glassmorphism.
- Render badge nếu có (ví dụ: mã code, trạng thái).

- [ ] **Step 2: Check TypeScript compilation**

Run: `cd /home/hungpp/magic_store/frontend && rtk npx tsc --noEmit`  
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/components/common/SearchableSelect.tsx && rtk git commit -m "feat(frontend): create SearchableSelect component with token-compliant styling

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend API Client Extension

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `api.getUnits`, `api.createUnit`, `api.updateUnit`, `api.deleteUnit`
- Produces: `api.updateCategory`, `api.deleteCategory`
- Produces: `api.updatePartner`, `api.deletePartner`
- Produces: `api.getBatches`, `api.getBatchTrace`, `api.updateBatch`

- [ ] **Step 1: Add types and API methods to `frontend/src/lib/api.ts`**

Bổ sung interface `Unit`, `BatchItem`, `InventoryMovementItem` và các hàm gọi API:
```typescript
export interface Unit {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface BatchItem {
  id: string;
  variant_id: string;
  variant?: ProductVariant;
  batch_code: string;
  supplier_id?: string;
  supplier?: Partner;
  received_date: string;
  expiry_date?: string;
  initial_qty: number | string;
  remaining_qty: number | string;
  unit_cost: number | string;
  notes?: string;
}

export interface InventoryMovementItem {
  id: string;
  variant_id: string;
  batch_id?: string;
  movement_type: string;
  qty_in_base_uom: number | string;
  input_uom: string;
  input_qty: number | string;
  unit_cost_at_time: number | string;
  reference_id?: string;
  reason_note?: string;
  created_at: string;
}
```

Bổ sung các phương thức vào object `api`:
- Units: `getUnits()`, `createUnit(data)`, `updateUnit(id, data)`, `deleteUnit(id)`
- Categories: `updateCategory(id, data)`, `deleteCategory(id)`
- Partners: `updatePartner(id, data)`, `deletePartner(id)`
- Batches: `getBatches(params)`, `getBatchTrace(id)`, `updateBatch(id, data)`

- [ ] **Step 2: Run typecheck**

Run: `cd /home/hungpp/magic_store/frontend && rtk npx tsc --noEmit`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/lib/api.ts && rtk git commit -m "feat(frontend): extend API client with Units, Batches, and master data mutation endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend Units Management Page (`/units`)

**Files:**
- Create: `frontend/src/app/units/page.tsx`

**Interfaces:**
- Route: `/units`
- Uses: `api.getUnits`, `api.createUnit`, `api.updateUnit`, `api.deleteUnit`

- [ ] **Step 1: Implement Units management page**

Tạo `frontend/src/app/units/page.tsx`:
- Bảng danh sách: Mã đơn vị (`font-mono font-medium`), Tên đơn vị, Mô tả, Trạng thái (Badge Active/Inactive), Thao tác (Sửa, Xóa).
- Thanh công cụ đầu trang: Ô tìm kiếm, Bộ lọc trạng thái, Nút `+ Thêm đơn vị` góc phải.
- Modal tạo/sửa: Form chỉ hiện khi bấm Thêm/Sửa. Validation mã không để trống, tự động in hoa mã đơn vị.
- Xử lý khi xóa: Hiển thị dialog xác nhận. Nếu API trả lỗi 409 Conflict, hiển thị thông báo lỗi rõ ràng của server.
- Tuân thủ token: Mật độ cao (hàng cao 38px, `px-3 py-2`), không rounded to, không shadow to.

- [ ] **Step 2: Test Next.js build with new route**

Run: `cd /home/hungpp/magic_store/frontend && rtk npm run build`  
Expected: Route `/units` built successfully.

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/app/units/page.tsx && rtk git commit -m "feat(frontend): implement Units management screen with CRUD modal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend Categories Management Page (`/categories`)

**Files:**
- Create: `frontend/src/app/categories/page.tsx`

**Interfaces:**
- Route: `/categories`
- Uses: `api.getCategories`, `api.createCategory`, `api.updateCategory`, `api.deleteCategory`
- Uses: `SearchableSelect` để chọn danh mục cha (Parent Category)

- [ ] **Step 1: Implement Categories management page**

Tạo `frontend/src/app/categories/page.tsx`:
- Bảng danh sách danh mục: Mã danh mục (`font-mono`), Tên danh mục, Danh mục cha, Số lượng sản phẩm trực thuộc, Trạng thái, Thao tác (Sửa, Xóa).
- Modal Thêm/Sửa danh mục: Tên, Mã, Danh mục cha (dùng `SearchableSelect` từ danh sách danh mục hiện có), Trạng thái kích hoạt.
- Xử lý lỗi 409 Conflict khi xóa danh mục có chứa sản phẩm hoặc danh mục con.
- Chuẩn token anti-slop, font-mono cho mã.

- [ ] **Step 2: Verify build**

Run: `cd /home/hungpp/magic_store/frontend && rtk npm run build`  
Expected: Route `/categories` compiled successfully.

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/app/categories/page.tsx && rtk git commit -m "feat(frontend): implement Categories management screen with parent selection and conflict handling

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend Partners Management (Suppliers & Customers Tabs)

**Files:**
- Modify: `frontend/src/app/partners/page.tsx`

**Interfaces:**
- Route: `/partners?type=SUPPLIER` hoặc `/partners?type=CUSTOMER`
- Uses: `api.getPartners`, `api.createPartner`, `api.updatePartner`, `api.deletePartner`

- [ ] **Step 1: Refactor Partners screen to dedicated Tab view & Modal Form**

Cập nhật `frontend/src/app/partners/page.tsx`:
- Header chứa Tab chuyển đổi: **"Nhà cung cấp"** và **"Khách hàng"**.
- Bảng danh sách: Tên đối tác, Số điện thoại, Địa chỉ, Hạn mức nợ (`font-mono tabular-nums text-right`), Dư nợ hiện tại (`font-mono tabular-nums text-right text-outflow`), Trạng thái, Thao tác (Sửa, Xóa).
- Form Thêm/Sửa chuyển vào Modal (chỉ hiện khi nhấn Tạo hoặc Sửa, không để cố định trên màn hình).
- Xử lý xác nhận xóa và bắt lỗi 409 Conflict khi đối tác đã có đơn hàng/lô hàng liên kết.

- [ ] **Step 2: Verify build**

Run: `cd /home/hungpp/magic_store/frontend && rtk npm run build`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/app/partners/page.tsx && rtk git commit -m "feat(frontend): refactor partners management into tabbed view with modal forms and conflict protection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Frontend Batches Management & Movement Traceability Drawer

**Files:**
- Create: `frontend/src/app/inventory/batches/page.tsx`

**Interfaces:**
- Route: `/inventory/batches`
- Uses: `api.getBatches`, `api.getBatchTrace`, `api.updateBatch`

- [ ] **Step 1: Implement Batches Management & Traceability Drawer**

Tạo `frontend/src/app/inventory/batches/page.tsx`:
- Bảng danh sách: Mã lô (`font-mono font-medium`), Tên sản phẩm & SKU, Nhà cung cấp, Tồn còn lại / Ban đầu (`font-mono tabular-nums text-right`), Hạn sử dụng, Badge trạng thái (Còn hạn / Cận date < 30 ngày / Hết hạn), Thao tác ("Sửa HSD", "Truy vết").
- Bộ lọc: Lọc theo tình trạng tồn (Còn hàng, Hết hàng) và hạn dùng (Cận date, Đã hết hạn).
- Modal Sửa: Cho phép sửa Ngày hết hạn (`expiry_date`) và Ghi chú (`notes`).
- Slide-over Drawer "Truy vết biến động lô":
  - Khi nhấn "Truy vết", mở drawer bên phải hiển thị lịch sử biến động kho (`InventoryMovementItem`) của lô đó.
  - Hiển thị: Thời gian, Loại biến động (Nhập hàng, Bán lẻ, Xuất hủy), Số lượng thay đổi (`+` màu xanh, `-` màu đỏ), Mã phiếu tham chiếu, Ghi chú lý do.

- [ ] **Step 2: Verify build**

Run: `cd /home/hungpp/magic_store/frontend && rtk npm run build`  
Expected: Route `/inventory/batches` compiled successfully.

- [ ] **Step 3: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/app/inventory/batches/page.tsx && rtk git commit -m "feat(frontend): implement Batches management and movement traceability drawer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Sidebar Navigation Restructuring & Full System Verification

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Run End-to-End Build & Tests

- [ ] **Step 1: Update Sidebar.tsx navigation links**

Cập nhật thanh điều hướng `frontend/src/components/Sidebar.tsx` theo cấu trúc nghiệp vụ:
- Danh mục & Hàng hóa:
  - Sản phẩm (`/products`)
  - Danh mục (`/categories`)
  - Đơn vị tính (`/units`)
- Kho & Vật tư:
  - Quản lý Lô & HSD (`/inventory/batches`)
  - Nhập kho (`/inventory/purchase`)
  - Xuất hủy (`/inventory/wastage`)
- Đối tác:
  - Nhà cung cấp (`/partners?type=SUPPLIER`)
  - Khách hàng (`/partners?type=CUSTOMER`)
- Sản xuất & Cài đặt:
  - Định mức BOM (`/production`)
  - Cài đặt (`/settings`)

- [ ] **Step 2: Run all backend tests**

Run: `cd /home/hungpp/magic_store/backend && rtk go test ./...`  
Expected: All tests pass.

- [ ] **Step 3: Run frontend production build**

Run: `cd /home/hungpp/magic_store/frontend && rtk npm run build`  
Expected: All routes compile cleanly with zero errors.

- [ ] **Step 4: Commit**

```bash
cd /home/hungpp/magic_store && rtk git add frontend/src/components/Sidebar.tsx && rtk git commit -m "feat(frontend): update sidebar navigation with modularized master data and batches routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
