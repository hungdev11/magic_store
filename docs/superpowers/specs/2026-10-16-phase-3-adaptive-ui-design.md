# Phase 3: Adaptive Product & Inventory UI Specification

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Principal ERP Architect

---

## 1. Executive Summary & Goals

Phase 3 xây dựng phân hệ Quản trị Hàng hóa & Kho (Adaptive Product & Inventory UI) với giao diện người dùng bằng tiếng Việt, thiết kế thích ứng động theo cấu hình cửa hàng (Feature Flags).

Hệ thống gồm 2 thành phần chính:
1. **Backend REST API Server (Golang):** Mở các API endpoints trên nền 3 Core Domain Engines (`UOMService`, `InventoryLedgerService`, `BOMProductionService`) tại `backend/cmd/server/main.go`.
2. **Frontend Adaptive UI (Next.js 15, Tailwind CSS, Lucide Icons, Zustand):** Được xây dựng trong thư mục `frontend/`, tự động co giãn và ẩn/hiện trường nhập liệu theo `enabled_modules`.

---

## 2. Backend REST API Specification

Cổng mặc định: `:8080`. Hỗ trợ CORS cho frontend `:3000`.

### 2.1. Store Configuration & Presets
- `GET /api/settings`: Trả về thông tin cửa hàng và JSON `enabled_modules`.
- `PUT /api/settings`: Cập nhật cấu hình và bật/tắt các cờ tính năng.
- `POST /api/settings/preset`: Nhận `{ preset: "SEAFOOD" | "APPAREL" | "FOOD" }`, kích hoạt cấu hình tương ứng.

### 2.2. Product & Category Management
- `GET /api/categories`: Danh sách danh mục.
- `POST /api/categories`: Tạo danh mục mới.
- `GET /api/products`: Danh sách sản phẩm kèm biến thể, tồn kho và quy đổi đơn vị.
- `POST /api/products`: Tạo sản phẩm đa hình. Hỗ trợ:
  - Sinh biến thể đơn hoặc ma trận biến thể (attributes matrix).
  - Cấu hình đơn vị tính quy đổi (`uom_conversions`).
  - Gắn công thức chế biến BOM nếu có.
  - Gắn nhóm Modifier/Topping nếu có.

### 2.3. Procurement & Inventory Movement
- `GET /api/partners`: Danh sách đối tác lọc theo loại (`SUPPLIER` / `CUSTOMER`).
- `POST /api/inventory/purchase`: Tiếp nhận lô hàng nhập kho, ghi nhận `PURCHASE_IN`, tạo `InventoryBatch` và cập nhật WAC.
- `POST /api/inventory/wastage`: Ghi nhận hủy hàng hao hụt `WASTAGE_SPOILAGE`, tính tổn thất vốn và hạch toán sổ quỹ.

### 2.4. Production & BOM
- `GET /api/bom/recipes`: Lấy danh sách công thức định mức.
- `POST /api/bom/recipes`: Tạo công thức mới (ASSEMBLY hoặc DISASSEMBLY).
- `POST /api/production/assembly`: Thực thi mẻ chế biến thành phẩm.
- `POST /api/production/disassembly`: Thực thi mổ xẻ pha lóc và phân bổ giá vốn.

---

## 3. Frontend Architecture & 5 Core Screens (`frontend/`)

### 3.1. Zustand Store Profile (`useStoreProfile`)
- Lưu trữ `storeSetting` và `enabled_modules`.
- Khi người dùng đổi module hoặc chọn preset, toàn bộ UI lập tức cập nhật trạng thái hiển thị.

### 3.2. Màn hình 1: Cài đặt Mô-đun Cửa hàng (`/settings`)
- Bộ chọn 1-Click Preset (Sạp cá / Shop quần áo / Tiệm F&B).
- Danh sách toggle switches cho từng cờ nghiệp vụ:
  - `matrix_variants`: Ma trận Size & Màu.
  - `catch_weight`: Cân số thực & Đơn vị tính biến thiên.
  - `bom_production`: Chế biến mẻ & Phân rã mổ xẻ.
  - `batch_expiry`: Quản lý Lô & Hạn sử dụng.
  - `dynamic_pos_pricing`: Cho phép sửa giá / mặc cả tại quầy.
  - `credit_ledger`: Quản lý công nợ khách & NCC.
  - `product_modifiers`: Đồ ăn kèm / Topping cấu hình được.

### 3.3. Màn hình 2: Tạo Sản phẩm Thông minh (`/products/new`)
- Tự động co giãn theo các cờ kích hoạt:
  - Khối cơ bản: Tên, Đơn vị tính chuẩn (`base_uom`), Danh mục, Giá vốn, Giá bán.
  - Khối ma trận (`matrix_variants = true`): Nhập Màu $\times$ Size $\rightarrow$ tự động tạo bảng danh sách SKU biến thể cho phép chỉnh sửa giá hàng loạt.
  - Khối cân ký (`catch_weight = true`): Tích chọn "Cần cân thực tế", thêm đơn vị phụ quy đổi (ví dụ: Con $\approx$ 1.2kg, `is_variable_ratio = true`).
  - Khối chế biến (`bom_production = true`): Chọn chế độ chế biến (`BATCH_MANUFACTURE`, `POS_BACKFLUSH`, `DISASSEMBLY`), tạo định mức nguyên liệu.
  - Khối đồ ăn kèm (`product_modifiers = true`): Chọn nhóm topping gắn kèm món.

### 3.4. Màn hình 3: Nhập hàng Nhà cung cấp (`/inventory/purchase`)
- Chọn Nhà cung cấp, chọn sản phẩm, nhập số lượng và giá mua.
- Hiển thị ô nhập Lô hàng & Hạn dùng khi bật `batch_expiry`.
- Hiển thị tính toán trực quan Giá vốn WAC mới trước khi bấm lưu phiếu.

### 3.5. Màn hình 4: Chế biến & Phân rã BOM (`/production`)
- 2 Tab chuyển đổi:
  - **Chế biến (ASSEMBLY):** Chọn món thành phẩm $\rightarrow$ hiển thị nguyên liệu định mức và kiểm tra đủ tồn kho hay không $\rightarrow$ nhập số lượng mẻ, chi phí phụ trợ, mã lô mới $\rightarrow$ bấm thực thi.
  - **Phân rã (DISASSEMBLY):** Chọn nguyên liệu đầu vào (e.g. Cá Hồi 5kg) $\rightarrow$ nhập sản lượng các phần thu được (phi lê, đầu xương) $\rightarrow$ kiểm tra tỷ lệ phân bổ giá vốn và hao hụt $\rightarrow$ bấm thực thi.

### 3.6. Màn hình 5: Ghi nhận Hao hụt / Hủy hàng (`/inventory/wastage`)
- Chọn mặt hàng bị mất mát/hỏng.
- Nhập số lượng và lý do (Hết hạn, Hư hỏng, Thất thoát).
- Tính ngay giá trị vốn tổn thất và tùy chọn hạch toán phiếu chi chi phí vào sổ quỹ.
