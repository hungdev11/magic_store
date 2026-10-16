# Phase 2: Golang Core Domain Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh 3 Service tính toán nghiệp vụ cốt lõi bằng Golang (Go 1.27) sử dụng GORM và `shopspring/decimal`, hỗ trợ đầy đủ Composable ACID Transactions: UOM & Catch-Weight Service, Inventory Ledger & WAC Service, BOM Production & Wastage Service.

**Architecture:** Tổ chức trong thư mục `backend/` theo Go standard layout. Mô hình dữ liệu GORM khớp 100% với 14 Enums và 19 Models từ CSDL. Mọi phép toán tài chính và tồn kho dùng `decimal.Decimal`. Mọi service method nhận tham số `ctx context.Context, tx *gorm.DB`. Kiểm thử tự động bằng Go testing framework chuẩn (`go test ./...`).

**Tech Stack:** Go 1.27 (`/usr/local/go/bin/go`), GORM (`gorm.io/gorm`), SQLite/Postgres GORM drivers cho unit testing, `github.com/shopspring/decimal`.

## Global Constraints
- Không dùng float32/float64 cho số lượng, trọng lượng, đơn giá hay tiền tệ. Bắt buộc dùng `decimal.Decimal`.
- Đơn vị tính cơ sở `base_uom` là chân lý duy nhất của kho.
- Bắt buộc kiểm tra `actual_weight` khi `is_variable_ratio = true`.
- Bắt buộc kiểm tra giá sàn `min_selling_price`.
- Thao tác kho luôn ghi `InventoryMovement` bất biến và cập nhật atomic trong transaction.

---

### Task 1: Khởi tạo Go Module & GORM Models

**Files:**
- Create: `backend/go.mod`
- Create: `backend/internal/model/enums.go`
- Create: `backend/internal/model/store.go`
- Create: `backend/internal/model/product.go`
- Create: `backend/internal/model/inventory.go`
- Create: `backend/internal/model/bom.go`
- Create: `backend/internal/model/sales.go`
- Create: `backend/internal/model/partner.go`
- Create: `backend/internal/model/cashbook.go`
- Create: `backend/tests/model_test.go`

**Interfaces:**
- Consumes: Go 1.27
- Produces: Các GORM models khớp chính xác với Prisma schema, có typesafe enums và decimal tags.

- [ ] **Step 1: Khởi tạo module go và cài đặt dependencies**

Chạy:
```bash
mkdir -p backend/internal/model backend/internal/service backend/tests
cd backend && /usr/local/go/bin/go mod init magic_store/backend
/usr/local/go/bin/go get gorm.io/gorm gorm.io/driver/sqlite github.com/shopspring/decimal github.com/google/uuid
```

- [ ] **Step 2: Viết các model structs và enums**

Định nghĩa toàn bộ 14 Enums và 19 Models trong `backend/internal/model/`.

- [ ] **Step 3: Viết test AutoMigrate trong backend/tests/model_test.go**

Tạo test dùng GORM sqlite in-memory để kiểm tra `db.AutoMigrate(...)` chạy thành công cho toàn bộ 19 models.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestModelMigration`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/
git commit -m "feat(backend): initialize go module and gorm models"
```

---

### Task 2: Xây dựng UOM & Catch-Weight Engine in Go

**Files:**
- Create: `backend/internal/service/errors.go`
- Create: `backend/internal/service/uom_service.go`
- Create: `backend/tests/uom_service_test.go`

**Interfaces:**
- Consumes: `backend/internal/model`, `decimal.Decimal`, `gorm.DB`
- Produces: `UOMService` struct với:
  - `ToBaseQty(ctx context.Context, tx *gorm.DB, params ToBaseQtyParams) (decimal.Decimal, error)`
  - `FromBaseQty(ctx context.Context, tx *gorm.DB, params FromBaseQtyParams) (decimal.Decimal, error)`
  - `CalculateLinePrice(ctx context.Context, tx *gorm.DB, params CalculateLinePriceParams) (*LinePriceResult, error)`

- [ ] **Step 1: Viết test failing cho UOMService**

Tạo `backend/tests/uom_service_test.go` kiểm tra quy đổi cố định, bắt lỗi thiếu cân thực tế khi `is_variable_ratio`, quy đổi khi có cân thực tế, chặn giá sàn `min_selling_price`, tính `line_total`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestUOMService`
Kỳ vọng: FAIL vì chưa implement service.

- [ ] **Step 3: Cài đặt UOMService**

Viết `backend/internal/service/uom_service.go` và `backend/internal/service/errors.go`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestUOMService`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/internal/service/uom_service.go backend/internal/service/errors.go backend/tests/uom_service_test.go
git commit -m "feat(backend): implement uom and catch-weight engine in go"
```

---

### Task 3: Xây dựng Inventory Ledger & WAC Calculator Engine in Go

**Files:**
- Create: `backend/internal/service/inventory_ledger_service.go`
- Create: `backend/tests/inventory_ledger_service_test.go`

**Interfaces:**
- Consumes: `backend/internal/model`, `UOMService`, `decimal.Decimal`, `gorm.DB`
- Produces: `InventoryLedgerService` struct với:
  - `RecordMovement(ctx context.Context, tx *gorm.DB, params RecordMovementParams) (*model.InventoryMovement, error)`
  - `CalculateNewWAC(ctx context.Context, tx *gorm.DB, variantID string, incomingQty, incomingCost decimal.Decimal) (decimal.Decimal, error)`
  - `StateTransform(ctx context.Context, tx *gorm.DB, params StateTransformParams) (*model.InventoryMovement, *model.InventoryMovement, error)`

- [ ] **Step 1: Viết test failing cho InventoryLedgerService**

Tạo `backend/tests/inventory_ledger_service_test.go` kiểm tra ghi movement cập nhật tồn kho variant & lô hàng, tính WAC, và chuyển đổi trạng thái cá sống chết thành cá ngộp giữ nguyên giá vốn.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestInventoryLedgerService`
Kỳ vọng: FAIL.

- [ ] **Step 3: Cài đặt InventoryLedgerService**

Viết `backend/internal/service/inventory_ledger_service.go`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestInventoryLedgerService`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add backend/internal/service/inventory_ledger_service.go backend/tests/inventory_ledger_service_test.go
git commit -m "feat(backend): implement inventory ledger and wac engine in go"
```

---

### Task 4: Xây dựng BOM Production & Wastage Processor Engine in Go

**Files:**
- Create: `backend/internal/service/bom_production_service.go`
- Create: `backend/tests/bom_production_service_test.go`

**Interfaces:**
- Consumes: `backend/internal/model`, `InventoryLedgerService`, `decimal.Decimal`, `gorm.DB`
- Produces: `BOMProductionService` struct với:
  - `ExecuteAssembly(ctx context.Context, tx *gorm.DB, params AssemblyParams) (*model.ProductionOrder, error)`
  - `ExecuteDisassembly(ctx context.Context, tx *gorm.DB, params DisassemblyParams) (*model.ProductionOrder, error)`
  - `ExecuteBackflushDeduction(ctx context.Context, tx *gorm.DB, params BackflushParams) ([]*model.InventoryMovement, error)`
  - `RecordWastage(ctx context.Context, tx *gorm.DB, params WastageParams) (*model.InventoryMovement, *model.CashbookTransaction, error)`

- [ ] **Step 1: Viết test failing cho BOMProductionService**

Tạo `backend/tests/bom_production_service_test.go` kiểm tra chế biến mẻ giò chả, mổ xẻ cá hồi ra phi lê và đầu xương phân bổ giá vốn theo %, bán bánh mì backflush kèm trừ topping, xuất hủy hao hụt.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestBOMProductionService`
Kỳ vọng: FAIL.

- [ ] **Step 3: Cài đặt BOMProductionService**

Viết `backend/internal/service/bom_production_service.go`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestBOMProductionService`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/internal/service/bom_production_service.go backend/tests/bom_production_service_test.go
git commit -m "feat(backend): implement bom production and wastage engine in go"
```

---

### Task 5: End-to-End Composable ACID Flow & Rollback Test in Go

**Files:**
- Create: `backend/tests/acid_flow_test.go`

**Interfaces:**
- Consumes: Cả 3 Go Services (`UOMService`, `InventoryLedgerService`, `BOMProductionService`)
- Produces: Kiểm thử chu trình bán hàng thực tế trong `db.Transaction(...)` và kiểm thử rollback khi gặp lỗi.

- [ ] **Step 1: Viết test tích hợp end-to-end ACID**

Tạo `backend/tests/acid_flow_test.go` thực hiện giao dịch phức tạp: tính giá bán cá cân ký + xuất kho ledger + tạo hóa đơn + ghi nhận sổ quỹ trong 1 transaction, và xác nhận rollback khi bước cuối bị lỗi cố tình.

- [ ] **Step 2: Chạy toàn bộ test suite backend Go**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./...`
Kỳ vọng: 100% test PASS.

- [ ] **Step 3: Commit Task 5**

```bash
git add backend/tests/acid_flow_test.go
git commit -m "test(backend): add end-to-end composable acid flow tests in go"
```
