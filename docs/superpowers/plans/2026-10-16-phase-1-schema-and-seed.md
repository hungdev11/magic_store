# Phase 1: Micro-ERP Database Schema & Multi-Industry Seed Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh file `prisma/schema.prisma` chuẩn kiến trúc Core Micro-ERP đa hình (Polymorphic Core) và file `prisma/seed.ts` nạp sẵn 3 bộ dữ liệu mẫu độc lập cho Sạp cá tươi sống, Shop thời trang và Tiệm chế biến F&B.

**Architecture:** Sử dụng PostgreSQL + Prisma ORM với kiểu dữ liệu tài chính chính xác (`Decimal(12,4)` cho tồn kho/trọng lượng, `Decimal(15,2)` cho giá trị tiền tệ, `JsonB` cho thuộc tính ma trận và cờ cấu hình). Mọi biến động kho đều đi qua Sổ cái bất biến `inventory_movements`. Hỗ trợ công thức định mức BOM 2 chiều (ASSEMBLY và DISASSEMBLY) và quy đổi đơn vị tính biến thiên (Catch-weight & Variable-ratio UOM).

**Tech Stack:** Node.js (v22), TypeScript, Prisma ORM, PostgreSQL, `@prisma/client`, `tsx`.

## Global Constraints
- Không tạo bảng riêng cho từng ngành (Zero Industry Silos).
- Tồn kho luôn ghi nhận theo `base_uom` (g, kg, pc, ml).
- Độ chính xác số lượng/khối lượng: `@db.Decimal(12, 4)`.
- Độ chính xác tiền tệ: `@db.Decimal(15, 2)`.
- Độ chính xác tỷ lệ phần trăm: `@db.Decimal(5, 2)`.
- Thuộc tính biến thể, modifier và cờ mô-đun lưu bằng `@db.JsonB`.
- Cú pháp mã nguồn tiếng Anh, nhãn dữ liệu và thuật ngữ kinh doanh tiếng Việt.

---

### Task 1: Khởi tạo Project & Cấu hình Prisma Toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env`
- Create: `prisma/schema.prisma`

**Interfaces:**
- Consumes: Node.js 22 & npm
- Produces: Project npm có sẵn Prisma CLI, TypeScript compiler và cấu hình DB connection.

- [ ] **Step 1: Khởi tạo package.json với các dependency cần thiết**

Tạo `package.json` khai báo `prisma`, `@prisma/client`, `typescript`, `@types/node`, `tsx`.

- [ ] **Step 2: Cấu hình tsconfig.json cho TypeScript module resolution**

Tạo `tsconfig.json` với `target: "ES2022"`, `moduleResolution: "node"`, `strict: true`.

- [ ] **Step 3: Cấu hình file .env chứa chuỗi kết nối PostgreSQL**

Tạo `.env` chứa `DATABASE_URL`.

- [ ] **Step 4: Cài đặt dependencies qua npm**

Chạy: `npm install`
Kiểm tra: `npx prisma --version`

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json package-lock.json tsconfig.json .env
git commit -m "chore: initialize project with prisma and typescript"
```

---

### Task 2: Viết schema.prisma hoàn chỉnh cho toàn bộ Core Micro-ERP

**Files:**
- Create: `prisma/schema.prisma`

**Interfaces:**
- Consumes: Đặc tả `docs/superpowers/specs/2026-10-16-micro-erp-schema-design.md`
- Produces: Mô hình CSDL chuẩn gồm 14 Enums và 15 Models:
  - Enums: `CostingMethod`, `ProductType`, `ProductionMode`, `MovementType`, `RecipeType`, `ProductionStatus`, `PosSessionStatus`, `OrderStatus`, `PaymentMethod`, `PartnerType`, `DebtTransactionType`, `CashbookType`, `CashbookCategory`, `CashbookPaymentMethod`.
  - Models: `StoreSetting`, `Category`, `Product`, `ProductVariant`, `UomConversion`, `InventoryBatch`, `InventoryMovement`, `BomRecipe`, `BomItem`, `ProductionOrder`, `Partner`, `SalesOrder`, `SalesOrderItem`, `PosSession`, `DebtLedger`, `CashbookTransaction`.

- [ ] **Step 1: Định nghĩa datasource, generator và 14 Enums**

Khai báo generator `prisma-client-js`, datasource `postgresql`, và đầy đủ 14 Enums phục vụ cấu hình, trạng thái kho, BOM, đơn hàng, sổ nợ và dòng tiền.

- [ ] **Step 2: Định nghĩa các Model Danh mục & Sản phẩm đa hình**

Viết các model `StoreSetting`, `Category`, `Product`, `ProductVariant`, `UomConversion` với đầy đủ quan hệ, cờ hành vi và kiểu Decimal(12,4), Decimal(15,2), JsonB.

- [ ] **Step 3: Định nghĩa các Model Quản lý Kho, Lô & Sổ cái bất biến**

Viết `InventoryBatch` và `InventoryMovement` bảo đảm lưu vết chuẩn mực theo `base_uom`, liên kết khóa ngoại với `ProductVariant` và `InventoryBatch`.

- [ ] **Step 4: Định nghĩa các Model Định mức kỹ thuật & Sản xuất (BOM)**

Viết `BomRecipe`, `BomItem`, `ProductionOrder` hỗ trợ cả 2 chế độ `ASSEMBLY` và `DISASSEMBLY` cùng tỷ lệ phân bổ giá vốn `cost_allocation_percent`.

- [ ] **Step 5: Định nghĩa các Model Bán hàng, POS, Đối tác, Sổ nợ & Sổ quỹ**

Viết `PosSession`, `SalesOrder`, `SalesOrderItem`, `Partner`, `DebtLedger`, `CashbookTransaction` kèm các quan hệ khóa ngoại chặt chẽ.

- [ ] **Step 6: Kiểm tra cú pháp schema qua Prisma format và validate**

Chạy: `npx prisma format` và `npx prisma validate`
Kỳ vọng: Cú pháp hợp lệ 100%, không có lỗi thiếu quan hệ ngược hay sai lệch kiểu.

- [ ] **Step 7: Sinh Prisma Client**

Chạy: `npx prisma generate`
Kỳ vọng: Prisma Client được sinh thành công trong `node_modules/@prisma/client`.

- [ ] **Step 8: Commit schema.prisma**

```bash
git add prisma/schema.prisma
git commit -m "feat: complete polymorphic core micro-erp prisma schema"
```

---

### Task 3: Viết file seed.ts nạp 3 kịch bản cửa hàng mẫu

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: Prisma Client từ Task 2
- Produces: Kịch bản nạp dữ liệu chạy qua `npx tsx prisma/seed.ts`, chấp nhận tham số `STORE_PROFILE` (`SEAFOOD`, `APPAREL`, `FOOD`, hoặc `ALL` mặc định).

- [ ] **Step 1: Viết cấu trúc khung cho seed.ts và hàm dọn sạch dữ liệu**

Thiết lập kết nối Prisma, đọc biến môi trường `STORE_PROFILE`, và viết hàm `cleanDatabase()` dọn sạch bảng theo thứ tự tôn trọng ràng buộc khóa ngoại.

- [ ] **Step 2: Viết kịch bản Seed 1 - Sạp cá tươi sống "Hải Sản Biển Đông"**

- Cấu hình: `StoreSetting` bật `catch_weight`, `batch_expiry`, `bom_production`, `dynamic_pos_pricing`.
- Sản phẩm & Biến thể: Cá Chẽm Sống (Base `kg`, UOM "Con" biến thiên 1.2kg), Cá Chẽm Ngộp, Cá Hồi Nguyên Con, Phi Lê Cá Hồi, Đầu Xương Cá Hồi.
- Dữ liệu giao dịch:
  - Nhập lô cá sống 100kg kèm `InventoryBatch`.
  - Chuyển đổi trạng thái `STATE_TRANSFORM`: 5kg cá sống chết chuyển thành cá ngộp.
  - Phân rã pha lóc `DISASSEMBLY`: 1 con cá hồi 5kg mổ thành 3.2kg phi lê (70% giá vốn) + 1.3kg đầu xương (25% giá vốn) + 0.5kg hao hụt.
  - Đơn bán POS: 1 con cá chẽm cân 1.35kg, sửa giá sàn 150.000đ/kg.

- [ ] **Step 3: Viết kịch bản Seed 2 - Shop thời trang "Modern Chic Apparel"**

- Cấu hình: `StoreSetting` bật `matrix_variants`, `credit_ledger`.
- Sản phẩm: Áo Sơ Mi Oxford tạo ma trận 6 SKU (Màu: Trắng, Đen x Size: S, M, L).
- Dữ liệu giao dịch:
  - Nhập tồn kho đầu kỳ cho cả 6 biến thể.
  - Đơn đổi trả 1 chạm tại POS: Trả Áo Trắng Size M (`+1` cái kho, `is_return: true`), lấy Áo Đen Size L (`-1` cái kho), bù trừ tiền chênh lệch.
  - Ghi nhận nợ khách hàng vào `DebtLedger` và số dư `current_debt_balance`.

- [ ] **Step 4: Viết kịch bản Seed 3 - Tiệm chế biến đồ ăn "Bếp Bánh Mì & Giò Chả Sài Gòn"**

- Cấu hình: `StoreSetting` bật `bom_production`, `batch_expiry`.
- Sản phẩm: Nguyên liệu (Thịt heo nạc, Mỡ heo, Lá chuối, Vỏ bánh mì, Pate) & Thành phẩm (Chả lụa đòn 500g, Bánh mì thập cẩm).
- Dữ liệu giao dịch:
  - Công thức định mức BOM `ASSEMBLY` cho Chả Lụa và Bánh Mì Thập Cẩm.
  - Lệnh sản xuất theo mẻ `ProductionOrder`: Chế biến mẻ 50 đòn chả lụa.
  - Đơn bán POS chế độ Backflush: Bán 2 Bánh mì thập cẩm tự động trừ ngầm nguyên liệu.
  - Ghi nhận hủy hao hụt `WASTAGE_SPOILAGE`: Hủy 5 ổ bánh mì hỏng kèm chi phí vào sổ quỹ `CashbookTransaction`.

- [ ] **Step 5: Kiểm tra biên dịch TypeScript cho seed.ts**

Chạy: `npx tsc --noEmit`
Kỳ vọng: Không có bất kỳ lỗi cú pháp type nào trong `seed.ts`.

- [ ] **Step 6: Cấu hình lệnh seed trong package.json và commit**

Thêm `"prisma": { "seed": "tsx prisma/seed.ts" }` vào `package.json`.
```bash
git add prisma/seed.ts package.json
git commit -m "feat: implement comprehensive seed script for 3 store profiles"
```
