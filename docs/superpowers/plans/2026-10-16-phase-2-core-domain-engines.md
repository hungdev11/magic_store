# Phase 2: Core Domain Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng 3 Service tính toán nghiệp vụ cốt lõi (Core Domain Engines) bằng TypeScript đảm bảo xử lý chính xác theo chuẩn ACID Transaction: UOM & Catch-Weight Engine, Inventory Ledger & WAC Calculator, BOM Production & Wastage Processor.

**Architecture:** 3 Service độc lập theo mô hình Modular Service Classes. Mỗi hàm chấp nhận tham số tùy chọn `tx?: Prisma.TransactionClient`, nếu không truyền thì tự động bọc trong `prisma.$transaction`. Mọi tính toán số học sử dụng `Prisma.Decimal` (không dùng float JS). Kiểm thử tự động bằng `node:test` và `node:assert/strict` chạy qua `tsx --test`.

**Tech Stack:** Node.js v22, TypeScript, `@prisma/client`, Prisma.Decimal, `node:test`, `node:assert/strict`, `tsx`.

## Global Constraints
- Không dùng số thực float IEEE-754 của JS cho tính toán tồn kho hoặc tiền tệ. Mọi phép toán bắt buộc dùng `Prisma.Decimal`.
- Đơn vị tính cơ sở `base_uom` là chân lý duy nhất của sổ cái kho.
- Kiểm soát nghiêm ngặt `is_variable_ratio = true`: bắt buộc có `actual_weight`.
- Kiểm soát giá sàn `min_selling_price`: cấm bán dưới sàn khi chưa có cờ cấp phép.
- Hỗ trợ Composable ACID Transaction: cho phép gộp các thao tác từ nhiều service vào cùng một transaction client.

---

### Task 1: Xây dựng UOM & Catch-Weight Conversion Engine

**Files:**
- Create: `src/services/uom.service.ts`
- Create: `tests/services/uom.service.test.ts`

**Interfaces:**
- Consumes: `@prisma/client`, `Prisma.Decimal`
- Produces: `UomEngine` class với các phương thức:
  - `toBaseQty(params: ToBaseQtyParams, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal>`
  - `fromBaseQty(params: FromBaseQtyParams, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal>`
  - `calculateLinePrice(params: CalculateLinePriceParams, tx?: Prisma.TransactionClient): Promise<LinePriceResult>`

- [ ] **Step 1: Viết test failing cho UomEngine**

Tạo `tests/services/uom.service.test.ts` kiểm tra các ca:
1. Quy đổi UOM cố định (1 Thùng = 24 Lon).
2. Bắt lỗi khi UOM biến thiên (`is_variable_ratio: true`) mà không truyền `actual_weight`.
3. Quy đổi UOM biến thiên khi có `actual_weight` chuẩn xác theo cân số thực.
4. Kiểm tra chặn giá sàn `min_selling_price` khi người bán tự ý hạ giá.
5. Tính `line_total` chính xác cho cả hàng cân ký và hàng số lượng nguyên.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `npx tsx --test tests/services/uom.service.test.ts`
Kỳ vọng: FAIL vì chưa có file `src/services/uom.service.ts`.

- [ ] **Step 3: Cài đặt UomEngine trong src/services/uom.service.ts**

Viết class `UomEngine` với logic:
- Tìm `ProductVariant` và `UomConversion`.
- Xử lý `toBaseQty`: nếu `input_uom === variant.product.base_uom` trả về `input_qty`. Nếu khác, đọc conversion. Nếu `is_variable_ratio` mà thiếu `actual_weight` thì quăng `VariableRatioWeightRequiredError`.
- Xử lý `calculateLinePrice`: kiểm tra `min_selling_price`, nhân số tiền bằng `Prisma.Decimal.mul()`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `npx tsx --test tests/services/uom.service.test.ts`
Kỳ vọng: PASS toàn bộ các test cases.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/services/uom.service.ts tests/services/uom.service.test.ts
git commit -m "feat: implement uom and catch-weight conversion engine"
```

---

### Task 2: Xây dựng Inventory Ledger & WAC Calculator Engine

**Files:**
- Create: `src/services/inventory-ledger.service.ts`
- Create: `tests/services/inventory-ledger.service.test.ts`

**Interfaces:**
- Consumes: `UomEngine`, `@prisma/client`, `Prisma.Decimal`
- Produces: `InventoryLedgerEngine` class với các phương thức:
  - `recordMovement(params: RecordMovementParams, tx?: Prisma.TransactionClient): Promise<InventoryMovement>`
  - `calculateNewWac(params: CalculateWacParams, tx?: Prisma.TransactionClient): Promise<Prisma.Decimal>`
  - `stateTransform(params: StateTransformParams, tx?: Prisma.TransactionClient): Promise<{ source_movement: InventoryMovement, target_movement: InventoryMovement }>`

- [ ] **Step 1: Viết test failing cho InventoryLedgerEngine**

Tạo `tests/services/inventory-ledger.service.test.ts` kiểm tra:
1. Ghi nhận `recordMovement` cập nhật atomic `ProductVariant.current_stock` và `InventoryBatch.remaining_qty`.
2. Tính toán WAC chuẩn công thức:
   $$New WAC = \frac{(Stock cũ \times WAC cũ) + (Qty nhập \times Giá nhập)}{Stock cũ + Qty nhập}$$
   và xử lý biên khi tồn kho cũ $\le 0$.
3. Nghiệp vụ chuyển đổi trạng thái `stateTransform`: trừ kho nguồn, cộng kho đích, kế thừa đúng giá vốn tại thời điểm chuyển đổi.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `npx tsx --test tests/services/inventory-ledger.service.test.ts`
Kỳ vọng: FAIL vì chưa có file `src/services/inventory-ledger.service.ts`.

- [ ] **Step 3: Cài đặt InventoryLedgerEngine trong src/services/inventory-ledger.service.ts**

Viết class `InventoryLedgerEngine` xử lý atomic update, transaction bọc ngoài nếu `tx` không được truyền, và tính toán WAC hoàn toàn bằng `Prisma.Decimal`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `npx tsx --test tests/services/inventory-ledger.service.test.ts`
Kỳ vọng: PASS toàn bộ các test cases.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/services/inventory-ledger.service.ts tests/services/inventory-ledger.service.test.ts
git commit -m "feat: implement inventory ledger and weighted average cost engine"
```

---

### Task 3: Xây dựng BOM Production & Wastage Processor Engine

**Files:**
- Create: `src/services/bom-production.service.ts`
- Create: `tests/services/bom-production.service.test.ts`

**Interfaces:**
- Consumes: `InventoryLedgerEngine`, `@prisma/client`, `Prisma.Decimal`
- Produces: `BomProductionEngine` class với các phương thức:
  - `executeAssembly(params: AssemblyParams, tx?: Prisma.TransactionClient): Promise<ProductionOrder>`
  - `executeDisassembly(params: DisassemblyParams, tx?: Prisma.TransactionClient): Promise<ProductionOrder>`
  - `executeBackflushDeduction(params: BackflushParams, tx?: Prisma.TransactionClient): Promise<InventoryMovement[]>`
  - `recordWastage(params: WastageParams, tx?: Prisma.TransactionClient): Promise<{ movement: InventoryMovement, expense?: CashbookTransaction }>`

- [ ] **Step 1: Viết test failing cho BomProductionEngine**

Tạo `tests/services/bom-production.service.test.ts` kiểm tra:
1. `executeAssembly`: Trừ kho nguyên liệu định mức, tính giá vốn thành phẩm = tổng nguyên liệu + chi phí khác, nhập kho thành phẩm.
2. `executeDisassembly`: Mổ xẻ 1 nguyên liệu ra nhiều thành phẩm, phân bổ giá vốn chính xác theo `cost_allocation_percent`.
3. `executeBackflushDeduction`: Bán món tự động trừ kho nguyên liệu cấu thành + trừ kho topping/đồ ăn kèm từ `modifiers_json`.
4. `recordWastage`: Xuất hủy hao hụt, tính giá trị thiệt hại vốn và ghi sổ quỹ `CashbookTransaction`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `npx tsx --test tests/services/bom-production.service.test.ts`
Kỳ vọng: FAIL vì chưa có file `src/services/bom-production.service.ts`.

- [ ] **Step 3: Cài đặt BomProductionEngine trong src/services/bom-production.service.ts**

Viết class `BomProductionEngine` phối hợp với `InventoryLedgerEngine` thực hiện toàn bộ các thao tác trong 1 transaction ACID.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `npx tsx --test tests/services/bom-production.service.test.ts`
Kỳ vọng: PASS toàn bộ các test cases.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/services/bom-production.service.ts tests/services/bom-production.service.test.ts
git commit -m "feat: implement bom production and wastage processor engine"
```

---

### Task 4: Kiểm thử tích hợp chu trình ACID toàn diện (End-to-End ACID Integration Flow)

**Files:**
- Create: `tests/integration/phase2-acid-flow.test.ts`
- Modify: `package.json` (thêm script `"test"`)

**Interfaces:**
- Consumes: Cả 3 Engine (`UomEngine`, `InventoryLedgerEngine`, `BomProductionEngine`)
- Produces: Suite kiểm thử tích hợp mô phỏng chu trình thực tế từ bán cá cân ký $\rightarrow$ tính giá $\rightarrow$ trừ kho $\rightarrow$ cập nhật sổ quỹ trong 1 ACID transaction duy nhất, và kiểm chứng rollback khi có lỗi xảy ra.

- [ ] **Step 1: Viết test tích hợp kịch bản chu trình bán hàng & sản xuất ACID**

Viết test mô phỏng:
1. Bán cá chẽm cân số thực: `UomEngine.calculateLinePrice` $\rightarrow$ `InventoryLedgerEngine.recordMovement(SALE_OUT)` $\rightarrow$ tạo đơn hàng $\rightarrow$ ghi nhận sổ quỹ.
2. Bán bánh mì kẹp thịt có topping: `BomProductionEngine.executeBackflushDeduction` trừ kho vỏ bánh mì, pate, chả lụa và trứng ốp la.
3. Kịch bản Transaction Rollback: Nếu một bước gặp lỗi (vd vi phạm giá sàn hoặc lỗi kết nối), toàn bộ biến động kho và sổ quỹ phải được hoàn tác (rollback) nguyên vẹn.

- [ ] **Step 2: Cấu hình npm test trong package.json**

Thêm `"test": "tsx --test tests/**/*.test.ts"` vào `package.json`.

- [ ] **Step 3: Chạy toàn bộ test suite để xác nhận PASS 100%**

Chạy: `npm test`
Kỳ vọng: Toàn bộ Unit & Integration tests của 3 Engine đều PASS mà không có lỗi.

- [ ] **Step 4: Commit Task 4**

```bash
git add package.json tests/integration/phase2-acid-flow.test.ts
git commit -m "test: add comprehensive end-to-end acid integration tests for phase 2 engines"
```
