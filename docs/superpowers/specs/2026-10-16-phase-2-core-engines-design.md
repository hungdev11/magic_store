# Phase 2: Core Domain Engines Specification (UOM, Ledger & WAC, BOM & Wastage)

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Principal ERP Architect

---

## 1. Executive Summary & Core Principles

Phase 2 xây dựng 3 bộ máy tính toán nghiệp vụ cốt lõi (Core Domain Engines) bằng TypeScript, bảo đảm tính toàn vẹn dữ liệu tài chính và kho theo chuẩn ACID Transaction:

1. **UOM & Catch-Weight Engine (`src/services/uom.service.ts`):** Quy đổi đơn vị tính cơ sở (`base_uom`) và đơn vị giao dịch, xử lý nghiêm ngặt cân điện tử số thực (Catch-weight) khi `is_variable_ratio = true`, kiểm soát giá bán và giá sàn (`min_selling_price`).
2. **Inventory Ledger & WAC Calculator (`src/services/inventory-ledger.service.ts`):** Quản lý sổ cái kho bất biến (`inventory_movements`), tính giá vốn bình quân gia quyền (Weighted Average Cost - WAC), theo dõi trừ tồn kho theo lô (`inventory_batches`), chuyển đổi trạng thái (`STATE_TRANSFORM`) bảo toàn giá vốn.
3. **BOM Assembly/Disassembly & Wastage Processor (`src/services/bom-production.service.ts`):** Thực thi lệnh chế biến ghép (`ASSEMBLY`), mổ xẻ pha lóc cá/thịt (`DISASSEMBLY`) phân bổ giá vốn theo tỷ lệ %, trừ kho tự động khi bán tại POS (`POS_BACKFLUSH`) bao gồm cả Topping/Đồ ăn kèm có cấu hình, và ghi nhận xuất hủy hao hụt (`WASTAGE_SPOILAGE`) hạch toán chi phí vào sổ quỹ.

Mọi phép toán sử dụng `Prisma.Decimal` (độ chính xác cao, không dùng số thực float IEEE-754 của JS). Mọi phương thức đều nhận tham số `tx?: Prisma.TransactionClient` cho phép lồng ghép nhiều thao tác vào cùng 1 ACID transaction duy nhất.

---

## 2. Detailed Engine Architecture

### 2.1. UOM & Catch-Weight Engine (`UomEngine`)

```typescript
export interface ToBaseQtyParams {
  variant_id: string;
  input_uom: string;
  input_qty: Prisma.Decimal | number | string;
  actual_weight?: Prisma.Decimal | number | string;
}

export interface CalculateLinePriceParams {
  variant_id: string;
  sold_uom: string;
  sold_qty: Prisma.Decimal | number | string;
  actual_base_qty?: Prisma.Decimal | number | string;
  override_unit_price?: Prisma.Decimal | number | string;
  allow_below_min_price?: boolean;
}

export interface LinePriceResult {
  unit_price: Prisma.Decimal;
  line_total: Prisma.Decimal;
  actual_deducted_qty: Prisma.Decimal;
  is_price_overridden: boolean;
}
```

- **Logic:**
  1. Nếu `input_uom` trùng với `product.base_uom`: hệ số là `1`.
  2. Nếu khác `base_uom`: tìm trong `UomConversion`. Nếu `is_variable_ratio = true` và không có `actual_weight`: ném ngoại lệ `VariableRatioWeightRequiredError`. Khi có `actual_weight`, số lượng quy về Base UOM chính là `actual_weight`.
  3. Giá bán: Nếu người dùng override đơn giá, kiểm tra với `min_selling_price`. Nếu thấp hơn và `allow_below_min_price = false`: ném ngoại lệ `MinPriceViolationError`.
  4. Tính `line_total`: Đối với hàng cân ký (`is_weighable` hoặc `is_variable_ratio`), `line_total = actual_deducted_qty * unit_price`. Đối với hàng đơn vị cố định, `line_total = sold_qty * unit_price`.

### 2.2. Inventory Ledger & WAC Engine (`InventoryLedgerEngine`)

```typescript
export interface RecordMovementParams {
  variant_id: string;
  batch_id?: string | null;
  movement_type: MovementType;
  qty_in_base_uom: Prisma.Decimal | number | string; // Dương là tăng kho, Âm là giảm kho
  input_uom: string;
  input_qty: Prisma.Decimal | number | string;
  unit_cost_at_time: Prisma.Decimal | number | string;
  reference_id?: string | null;
  reason_note?: string | null;
}

export interface StateTransformParams {
  from_variant_id: string;
  to_variant_id: string;
  qty_in_base_uom: Prisma.Decimal | number | string;
  from_batch_id?: string | null;
  reference_id?: string | null;
  reason_note?: string | null;
}
```

- **Logic:**
  1. `recordMovement`:
     - Ghi 1 bản ghi vào `InventoryMovement`.
     - Cập nhật atomic `ProductVariant.current_stock`: `increment: qty_in_base_uom`.
     - Nếu có `batch_id`: cập nhật atomic `InventoryBatch.remaining_qty`: `increment: qty_in_base_uom`. Nếu xuất âm vượt quá lô tồn: ném lỗi nếu cấu hình cấm âm kho.
  2. `calculateNewWac`:
     $$\text{New WAC} = \frac{(\text{Current Stock} \times \text{Current WAC}) + (\text{Incoming Qty} \times \text{Incoming Cost})}{\text{Current Stock} + \text{Incoming Qty}}$$
     Nếu tồn kho cũ $\le 0$, WAC mới bằng chính `Incoming Cost`.
  3. `stateTransform`:
     - Trong 1 transaction: lấy WAC hiện tại của `from_variant`.
     - Ghi 1 movement xuất `-qty` ở `from_variant`.
     - Ghi 1 movement nhập `+qty` ở `to_variant` với `unit_cost_at_time = from_variant.cost_price`.
     - Cập nhật WAC của `to_variant` tương ứng.

### 2.3. BOM Production & Wastage Engine (`BomProductionEngine`)

```typescript
export interface AssemblyParams {
  recipe_id: string;
  target_output_qty: Prisma.Decimal | number | string;
  batch_code?: string;
  other_cost?: Prisma.Decimal | number | string;
  expiry_date?: Date | null;
  supplier_id?: string | null;
}

export interface DisassemblyParams {
  recipe_id: string;
  input_qty: Prisma.Decimal | number | string; // Khối lượng nguyên liệu đưa vào
  yield_outputs: Array<{
    component_variant_id: string;
    actual_qty: Prisma.Decimal | number | string;
  }>;
  batch_code?: string;
  other_cost?: Prisma.Decimal | number | string;
}

export interface BackflushParams {
  items: Array<{
    variant_id: string;
    qty: Prisma.Decimal | number | string;
    modifiers_json?: any;
    reference_id?: string;
  }>;
}

export interface WastageParams {
  variant_id: string;
  batch_id?: string | null;
  lost_qty: Prisma.Decimal | number | string;
  input_uom: string;
  reason_note: string;
  record_to_cashbook?: boolean;
  reference_id?: string | null;
}
```

- **Logic:**
  1. `executeAssembly`:
     - Kiểm tra nguyên liệu theo định mức `qty_required * target_output_qty`.
     - Ghi nhận `PRODUCTION_CONSUME` cho từng nguyên liệu.
     - Tính tổng chi phí nguyên vật liệu `total_material_cost`.
     - Đơn giá vốn thành phẩm: $(\text{total\_material\_cost} + \text{other\_cost}) / \text{actual\_yield\_qty}$.
     - Ghi nhận `PRODUCTION_YIELD` cho thành phẩm, tạo lô hàng mới nếu có hạn dùng, cập nhật WAC.
  2. `executeDisassembly`:
     - Xuất nguyên liệu đầu vào với `PRODUCTION_CONSUME`.
     - Tính tổng giá vốn nguyên liệu = $\text{input\_qty} \times \text{nguyên liệu WAC} + \text{other\_cost}$.
     - Dựa trên `cost_allocation_percent` của từng thành phẩm, tính giá vốn và nhập kho `PRODUCTION_YIELD` từng phần.
  3. `executeBackflushDeduction`:
     - Tìm `BomRecipe` của sản phẩm. Trừ nguyên liệu cơ bản.
     - Phân tích `modifiers_json`: nếu có `linked_variant_id` và `deduct_qty`, xuất kho nguyên liệu topping kèm theo.
  4. `recordWastage`:
     - Ghi `WASTAGE_SPOILAGE` trừ kho.
     - Tính chi phí tổn thất = $\text{lost\_qty} \times \text{WAC}$.
     - Nếu `record_to_cashbook = true`, ghi 1 dòng `CashbookTransaction` loại `OUTFLOW`, danh mục `OTHER_EXPENSE` (hoặc tạo category `WASTAGE_EXPENSE`) để bóc tách rõ chi phí hao hụt.
