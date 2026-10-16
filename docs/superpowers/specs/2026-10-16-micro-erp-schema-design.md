# Micro-ERP & POS Core Database Schema & Seed Data Specification

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Principal ERP Architect

---

## 1. Executive Summary & Goals

Thiết kế kiến trúc cơ sở dữ liệu cốt lõi (Core Schema) cho hệ thống Micro-ERP & POS đa ngành nghề chạy trên nền PostgreSQL và Prisma ORM.

Hệ thống giải quyết trọn vẹn 3 mô hình kinh doanh có tính chất đối lập:
1. **Sạp cá tươi sống:** Quản lý hàng biến thiên trọng lượng (Catch-weight & Dual-unit), lô nhập & hạn dùng tươi sống, chuyển đổi trạng thái (cá sống chết thành cá ngộp) và mổ xẻ pha lóc (Disassembly butchery).
2. **Shop thời trang & may mặc:** Quản lý biến thể đa chiều (Matrix variants: Màu x Size), tạo mã SKU tự động, đổi trả hàng 1 chạm tại POS trong cùng một hóa đơn.
3. **Tiệm chế biến đồ ăn & F&B:** Quản lý công thức định mức nguyên vật liệu (BOM Recipe), chế biến theo mẻ (Batch Cooking) và tự động trừ kho nguyên liệu khi bán hàng tại POS (POS Backflushing).

Toàn bộ hệ sinh thái tuân thủ nghiêm ngặt 4 nguyên tắc:
- Không tạo bảng riêng cho từng ngành (Zero Industry Silos).
- Toàn bộ biến động kho ghi nhận qua Sổ cái bất biến (`inventory_movements`) quy đổi chuẩn về Đơn vị tính cơ sở (`base_uom`).
- Giao diện và hành vi POS thích ứng động qua cờ tính năng (`StoreSetting.enabled_modules`).
- Độ chính xác tuyệt đối với số thực tài chính: Số lượng/Khối lượng dùng `DECIMAL(12,4)`, Tiền tệ dùng `DECIMAL(15,2)`.

---

## 2. Architecture & Data Model

### 2.1. Cấu hình Cửa hàng (Store Configuration)
- **`StoreSetting`**:
  - `id`: Cuid / UUID.
  - `name`: Tên cửa hàng.
  - `currency`: Mặc định "VND".
  - `costing_method`: Enum `CostingMethod` (`WAC`, `FIFO`).
  - `enabled_modules`: Json chứa:
    - `matrix_variants`: boolean
    - `catch_weight`: boolean
    - `bom_production`: boolean
    - `batch_expiry`: boolean
    - `dynamic_pos_pricing`: boolean
    - `credit_ledger`: boolean

### 2.2. Danh mục, Sản phẩm đa hình & Đơn vị tính (Multi-UOM)
- **`Category`**:
  - `id`, `name`, `code`, `parent_id` (tự tham chiếu phân cấp).
- **`Product`**:
  - `id`, `name`, `code`, `category_id`.
  - `product_type`: Enum `ProductType` (`RAW_MATERIAL`, `WIP_SEMI_FINISHED`, `FINISHED_GOOD`, `SERVICE`, `COMBO`).
  - `base_uom`: Đơn vị tính cơ sở (e.g., `g`, `kg`, `pc`, `ml`).
  - Cờ hành vi (`behavior_flags`):
    - `is_weighable`: boolean (yêu cầu bàn cân / cân số thực tại POS).
    - `track_inventory`: boolean (theo dõi tồn kho).
    - `track_batches`: boolean (theo dõi số lô & hạn sử dụng).
    - `production_mode`: Enum `ProductionMode` (`NONE`, `BATCH_MANUFACTURE`, `POS_BACKFLUSH`, `DISASSEMBLY`).
- **`ProductVariant`**:
  - `id`, `product_id`, `sku` (Unique), `barcode` (Unique, Nullable), `variant_name`.
  - `attributes`: Json (e.g. `{"color": "Đỏ", "size": "L"}` hoặc `{"grade": "Loại 1"}`).
  - `cost_price`: `Decimal(15,2)` (Giá vốn bình quân gia quyền theo `base_uom`).
  - `base_selling_price`: `Decimal(15,2)` (Giá bán chuẩn theo `base_uom`).
  - `min_selling_price`: `Decimal(15,2)` (Giá sàn cho phép sửa giá tại quầy).
  - `current_stock`: `Decimal(12,4)` (Tồn kho thực tế theo `base_uom`).
  - `min_stock_alert`: `Decimal(12,4)`.
- **`UomConversion`**:
  - `id`, `variant_id`, `uom_name` (e.g. "Thùng", "Con", "Rổ").
  - `conversion_factor`: `Decimal(12,4)` (Hệ số quy đổi ra `base_uom`).
  - `is_variable_ratio`: boolean (true khi tỷ lệ quy đổi không cố định, ví dụ 1 con cá khoảng 1.2kg nhưng bán phải cân thực tế).
  - `default_price_for_uom`: `Decimal(15,2)`.

### 2.3. Quản lý Lô & Sổ cái kho bất biến (Immutable Stock Ledger)
- **`InventoryBatch`**:
  - `id`, `variant_id`, `batch_code`, `supplier_id` (Nullable), `received_date`, `expiry_date` (Nullable).
  - `initial_qty`: `Decimal(12,4)`.
  - `remaining_qty`: `Decimal(12,4)`.
  - `unit_cost`: `Decimal(15,2)`.
- **`InventoryMovement`**:
  - `id`, `variant_id`, `batch_id` (Nullable).
  - `movement_type`: Enum `MovementType` (`PURCHASE_IN`, `SALE_OUT`, `RETURN_IN`, `PRODUCTION_CONSUME`, `PRODUCTION_YIELD`, `STATE_TRANSFORM`, `WASTAGE_SPOILAGE`, `STOCKTAKE_ADJUST`).
  - `qty_in_base_uom`: `Decimal(12,4)` (Có dấu: dương là tăng kho, âm là giảm kho).
  - `input_uom`: String (Đơn vị lúc nhập/bán).
  - `input_qty`: `Decimal(12,4)` (Số lượng gõ trên màn hình).
  - `unit_cost_at_time`: `Decimal(15,2)` (Giá vốn thời điểm giao dịch).
  - `reference_id`: String (Mã đơn hàng, mã phiếu sản xuất, mã phiếu hủy).
  - `reason_note`: String (Nullable).
  - `created_at`: DateTime.

### 2.4. Công thức định mức & Lệnh sản xuất (BOM & Production)
- **`BomRecipe`**:
  - `id`, `target_variant_id`.
  - `recipe_type`: Enum `RecipeType` (`ASSEMBLY`, `DISASSEMBLY`).
  - `output_qty`: `Decimal(12,4)`.
  - `expected_wastage_percent`: `Decimal(5,2)`.
- **`BomItem`**:
  - `id`, `recipe_id`, `component_variant_id`.
  - `qty_required`: `Decimal(12,4)`.
  - `cost_allocation_percent`: `Decimal(5,2)` (Phân bổ giá trị khi mổ xẻ pha lóc).
- **`ProductionOrder`**:
  - `id`, `recipe_id`, `batch_code`, `status`: Enum `ProductionStatus` (`DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  - `input_qty`: `Decimal(12,4)`.
  - `actual_yield_qty`: `Decimal(12,4)`.
  - `total_material_cost`: `Decimal(15,2)`.
  - `other_cost`: `Decimal(15,2)`.
  - `notes`: String (Nullable).

### 2.5. Bán hàng, Thu ngân & Đổi trả (Sales & POS)
- **`PosSession`**:
  - `id`, `cashier_name`, `started_at`, `closed_at` (Nullable).
  - `opening_cash`: `Decimal(15,2)`.
  - `closing_cash_actual`: `Decimal(15,2)`.
  - `total_sales_amount`: `Decimal(15,2)`.
  - `total_cash_collected`: `Decimal(15,2)`.
  - `total_bank_collected`: `Decimal(15,2)`.
  - `status`: Enum `PosSessionStatus` (`OPEN`, `CLOSED`).
- **`SalesOrder`**:
  - `id`, `order_number` (Unique), `customer_id` (Nullable), `pos_session_id` (Nullable).
  - `status`: Enum `OrderStatus` (`COMPLETED`, `PARTIAL_PAID`, `DEBT`, `RETURNED`, `CANCELLED`).
  - `subtotal`: `Decimal(15,2)`.
  - `discount_amount`: `Decimal(15,2)`.
  - `surcharge_amount`: `Decimal(15,2)`.
  - `total_amount`: `Decimal(15,2)`.
  - `paid_amount`: `Decimal(15,2)`.
  - `debt_amount`: `Decimal(15,2)`.
  - `total_cogs`: `Decimal(15,2)`.
  - `payment_method`: Enum `PaymentMethod` (`CASH`, `BANK_QR`, `MIXED`, `CREDIT`).
- **`SalesOrderItem`**:
  - `id`, `order_id`, `variant_id`, `batch_id` (Nullable).
  - `sold_uom`: String.
  - `sold_qty`: `Decimal(12,4)`.
  - `actual_base_qty_deducted`: `Decimal(12,4)`.
  - `original_unit_price`: `Decimal(15,2)`.
  - `actual_unit_price`: `Decimal(15,2)`.
  - `modifiers_json`: Json (Nullable).
  - `line_cogs`: `Decimal(15,2)`.
  - `is_return`: Boolean (Hỗ trợ đổi trả 1 chạm ngay trên POS).

### 2.6. Đối tác, Sổ nợ & Sổ quỹ dòng tiền (CRM, Debt & Cashbook)
- **`Partner`**:
  - `id`, `partner_type`: Enum `PartnerType` (`CUSTOMER`, `SUPPLIER`, `BOTH`).
  - `name`, `phone` (Nullable), `address` (Nullable).
  - `price_tier`: String (default "RETAIL").
  - `current_debt_balance`: `Decimal(15,2)`.
  - `credit_limit`: `Decimal(15,2)`.
- **`DebtLedger`**:
  - `id`, `partner_id`.
  - `transaction_type`: Enum `DebtTransactionType` (`SALE_DEBT`, `DEBT_REPAYMENT`, `SUPPLIER_INVOICE`, `SUPPLIER_PAYMENT`).
  - `reference_id`: String.
  - `amount`: `Decimal(15,2)`.
  - `balance_after`: `Decimal(15,2)`.
  - `note`: String (Nullable).
  - `created_at`: DateTime.
- **`CashbookTransaction`**:
  - `id`, `transaction_type`: Enum `CashbookType` (`INFLOW`, `OUTFLOW`).
  - `category`: Enum `CashbookCategory` (`SALES_REVENUE`, `DEBT_COLLECTION`, `SUPPLIER_PAYMENT`, `RENT`, `ELECTRICITY`, `ICE_PACKAGING`, `STAFF_WAGE`, `SHIPPING`, `OTHER_EXPENSE`).
  - `amount`: `Decimal(15,2)`.
  - `payment_method`: Enum `CashbookPaymentMethod` (`CASH`, `BANK_TRANSFER`).
  - `partner_id` (Nullable), `sales_order_id` (Nullable), `pos_session_id` (Nullable).
  - `description`: String.
  - `created_at`: DateTime.

---

## 3. Seed Data Specification (`seed.ts`)

`seed.ts` hỗ trợ biến môi trường `STORE_PROFILE` (giá trị: `SEAFOOD`, `APPAREL`, `FOOD`, hoặc `ALL` - mặc định `ALL` nếu không truyền, nạp theo kịch bản phù hợp):

1. **Profile 1: Sạp cá tươi sống "Hải Sản Biển Đông"**
   - Cấu hình: `catch_weight: true`, `batch_expiry: true`, `bom_production: true`, `dynamic_pos_pricing: true`, `matrix_variants: false`.
   - Sản phẩm: Cá Chẽm Sống (Base: `kg`, Uom: `Con` biến thiên trọng lượng 1.2kg), Cá Thu Tươi, Phi Lê Cá Hồi.
   - Luồng nghiệp vụ:
     - Nhập lô cá sống 100kg giá 120.000đ/kg kèm `batch_code`.
     - Chuyển đổi trạng thái (State Transform): 5kg cá ngộp chết chuyển sang Cá ngộp lạnh giá vốn giữ nguyên.
     - Pha lóc (Disassembly): 1 cá hồi 5kg mổ thành 3.2kg phi lê (70% giá vốn) + 1.3kg đầu xương (25% giá vốn) + 0.5kg hao hụt (5%).
     - Đơn bán POS: Bán 1 con cá chẽm cân thực 1.35kg, giảm giá cuối ngày còn 150.000đ/kg.

2. **Profile 2: Shop thời trang "Modern Chic Apparel"**
   - Cấu hình: `matrix_variants: true`, `credit_ledger: true`, `catch_weight: false`, `bom_production: false`.
   - Sản phẩm: Áo Sơ Mi Oxford (Thuộc tính: Màu [Trắng, Đen] x Size [S, M, L] -> 6 SKU sinh tự động).
   - Luồng nghiệp vụ:
     - Nhập kho 6 SKU biến thể số lượng mỗi loại 20 cái.
     - Đơn đổi hàng 1 chạm tại POS: Khách trả Áo Sơ Mi Trắng Size M (+1 cái vào kho), lấy Áo Sơ Mi Đen Size L (-1 cái khỏi kho), bù trừ tiền chênh lệch.
     - Khách quen nợ lại tiền, ghi nhận `DebtLedger`.

3. **Profile 3: Tiệm chế biến đồ ăn "Bếp Bánh Mì & Giò Chả Sài Gòn"**
   - Cấu hình: `bom_production: true`, `batch_expiry: true`, `matrix_variants: false`, `catch_weight: false`.
   - Sản phẩm:
     - Nguyên liệu: Thịt heo nạc (`g`), Mỡ heo (`g`), Lá chuối (`pc`), Gia vị (`g`), Bánh mì vỏ (`pc`), Pate (`g`).
     - Thành phẩm: Chả Lụa Đòn 500g, Bánh Mì Thập Cẩm.
   - Luồng nghiệp vụ:
     - Lệnh sản xuất theo mẻ: Nấu mẻ 50 đòn chả lụa -> trừ kho thịt, mỡ, lá chuối theo định mức BOM.
     - Bán POS chế độ Backflush: Bán 2 Bánh mì thập cẩm -> tự động trừ ngầm 2 ổ bánh mì, 100g pate, 100g chả lụa.
     - Hủy hao hụt cuối ngày: Hủy 5 ổ bánh mì hỏng, ghi nhận vào `WASTAGE_SPOILAGE` và sổ chi phí.
