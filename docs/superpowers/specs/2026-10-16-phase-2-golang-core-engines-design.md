# Phase 2: Golang Core Domain Engines Specification (GORM & shopspring/decimal)

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Principal ERP Architect

---

## 1. Executive Summary & Architecture

Toàn bộ Backend nghiệp vụ và 3 Bộ máy tính toán cốt lõi được chuyển giao sang ngôn ngữ **Golang (Go 1.27+)** đặt trong thư mục `backend/`:
- **ORM:** GORM (`gorm.io/gorm`, `gorm.io/driver/postgres`) với hỗ trợ transaction lồng `db.Transaction(func(tx *gorm.DB) error)`.
- **Số thực tài chính & kho:** `github.com/shopspring/decimal` (Zero floating-point errors, độ chính xác tuyệt đối).
- **Cấu trúc thư mục backend:**
  ```text
  backend/
  ├── go.mod
  ├── go.sum
  ├── internal/
  │   ├── model/                  # GORM Models & Enums (14 Enums, 19 Models)
  │   │   ├── enums.go
  │   │   ├── store.go
  │   │   ├── product.go
  │   │   ├── inventory.go
  │   │   ├── bom.go
  │   │   ├── sales.go
  │   │   ├── partner.go
  │   │   └── cashbook.go
  │   └── service/                # 3 Core Domain Engines
  │       ├── uom_service.go
  │       ├── inventory_ledger_service.go
  │       ├── bom_production_service.go
  │       └── errors.go
  └── tests/                      # Go Unit & Integration Tests
      ├── uom_service_test.go
      ├── inventory_ledger_service_test.go
      ├── bom_production_service_test.go
      └── acid_flow_test.go
  ```

---

## 2. Core Service Contracts in Go

### 2.1. `UOMService` (`backend/internal/service/uom_service.go`)
- `ToBaseQty(ctx context.Context, tx *gorm.DB, params ToBaseQtyParams) (decimal.Decimal, error)`
- `FromBaseQty(ctx context.Context, tx *gorm.DB, params FromBaseQtyParams) (decimal.Decimal, error)`
- `CalculateLinePrice(ctx context.Context, tx *gorm.DB, params CalculateLinePriceParams) (*LinePriceResult, error)`
- Xử lý lỗi `ErrVariableRatioWeightRequired`, `ErrMinPriceViolation`, `ErrVariantNotFound`, `ErrConversionNotFound`.

### 2.2. `InventoryLedgerService` (`backend/internal/service/inventory_ledger_service.go`)
- `RecordMovement(ctx context.Context, tx *gorm.DB, params RecordMovementParams) (*model.InventoryMovement, error)`
  - Ghi bản ghi `InventoryMovement`.
  - Cập nhật atomic `ProductVariant.CurrentStock += QtyInBaseUom`.
  - Cập nhật `InventoryBatch.RemainingQty` (nếu có `BatchID`).
- `CalculateNewWAC(ctx context.Context, tx *gorm.DB, variantID string, incomingQty, incomingCost decimal.Decimal) (decimal.Decimal, error)`
  - Công thức: $\text{New WAC} = (\text{Stock cũ} \times \text{WAC cũ} + \text{Qty mới} \times \text{Cost mới}) / (\text{Stock cũ} + \text{Qty mới})$.
- `StateTransform(ctx context.Context, tx *gorm.DB, params StateTransformParams) (*model.InventoryMovement, *model.InventoryMovement, error)`
  - Ghi 2 movement đối ứng trong 1 transaction (giảm kho nguồn, tăng kho đích, bảo toàn giá vốn).

### 2.3. `BOMProductionService` (`backend/internal/service/bom_production_service.go`)
- `ExecuteAssembly(ctx context.Context, tx *gorm.DB, params AssemblyParams) (*model.ProductionOrder, error)`
  - Kiểm tra tồn kho nguyên liệu.
  - Ghi nhận `PRODUCTION_CONSUME` cho các nguyên liệu.
  - Tính tổng chi phí = Nguyên liệu + Chi phí khác.
  - Nhập kho thành phẩm `PRODUCTION_YIELD`, tạo lô mới nếu có hạn dùng, cập nhật WAC.
- `ExecuteDisassembly(ctx context.Context, tx *gorm.DB, params DisassemblyParams) (*model.ProductionOrder, error)`
  - Trừ kho nguyên liệu đầu vào.
  - Phân bổ giá vốn theo `CostAllocationPercent` cho từng thành phẩm đầu ra.
  - Nhập kho từng thành phẩm với `PRODUCTION_YIELD`.
- `ExecuteBackflushDeduction(ctx context.Context, tx *gorm.DB, params BackflushParams) ([]*model.InventoryMovement, error)`
  - Đọc công thức định mức BOM của món, trừ kho nguyên liệu.
  - Phân tích `ModifiersJSON`, trừ kho nguyên liệu topping kèm theo.
- `RecordWastage(ctx context.Context, tx *gorm.DB, params WastageParams) (*model.InventoryMovement, *model.CashbookTransaction, error)`
  - Xuất kho `WASTAGE_SPOILAGE`.
  - Tính thiệt hại vốn và ghi sổ quỹ `CashbookTransaction` loại `OUTFLOW`.
