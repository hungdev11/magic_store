# Phase 3: Adaptive Product & Inventory UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng toàn diện REST API Server bằng Golang và ứng dụng Frontend Next.js 15 (Tailwind CSS, Lucide Icons, Zustand) thích ứng động theo Feature Flags cho 5 màn hình quản trị nghiệp vụ cốt lõi: Cài đặt Module, Tạo sản phẩm thông minh, Nhập hàng PO, Chế biến/Phân rã BOM, và Hủy hàng/Hao hụt.

**Architecture:** 
- **Backend:** Go REST API server (`backend/cmd/server/main.go`) định tuyến qua Go `net/http` router, tích hợp GORM models và 3 Core Service Engines.
- **Frontend:** Next.js 15 App Router (`frontend/`), Zustand store (`useStoreProfile`) đồng bộ hóa trạng thái cờ tính năng tức thì, giao diện Tailwind CSS trực quan chuẩn tiếng Việt.

**Tech Stack:** Go 1.27, GORM, `shopspring/decimal`, Next.js 15, TypeScript, Tailwind CSS, Lucide React, Zustand.

## Global Constraints
- Thuật ngữ hiển thị UI hoàn toàn bằng tiếng Việt thân thiện với chủ shop nhỏ.
- Mọi trường nhập liệu và menu sidebar phải thích ứng động theo `enabled_modules`.
- REST API trả về JSON chuẩn, xử lý lỗi tường minh với status code HTTP chuẩn (200, 201, 400, 404, 500).
- Frontend kiểm thử build thành công với `npm run build` không có lỗi TypeScript/ESLint.

---

### Task 1: Xây dựng REST API Server & Handlers bằng Golang

**Files:**
- Create: `backend/internal/api/handlers.go`
- Create: `backend/internal/api/routes.go`
- Create: `backend/cmd/server/main.go`
- Create: `backend/tests/api_test.go`

**Interfaces:**
- Consumes: 3 Core Go Services (`UOMService`, `InventoryLedgerService`, `BOMProductionService`), GORM models
- Produces: HTTP Server lắng nghe cổng `:8080`, phục vụ các API:
  - `GET /api/settings`, `PUT /api/settings`, `POST /api/settings/preset`
  - `GET /api/categories`, `POST /api/categories`
  - `GET /api/products`, `POST /api/products`
  - `GET /api/partners`
  - `POST /api/inventory/purchase`
  - `GET /api/bom/recipes`, `POST /api/production/assembly`, `POST /api/production/disassembly`
  - `POST /api/inventory/wastage`

- [ ] **Step 1: Viết test failing cho các API routes**

Tạo `backend/tests/api_test.go` dùng `httptest` kiểm tra các endpoints settings, product creation, purchase receiving, assembly/disassembly, wastage.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestAPI`
Kỳ vọng: FAIL vì chưa có package `internal/api`.

- [ ] **Step 3: Cài đặt API Handlers và Router**

Viết `backend/internal/api/handlers.go`, `backend/internal/api/routes.go`, và `backend/cmd/server/main.go`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestAPI`
Kỳ vọng: PASS toàn bộ các endpoint tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/
git commit -m "feat(backend): implement rest api server and handlers for inventory and bom"
```

---

### Task 2: Khởi tạo Frontend Next.js 15 & Cấu trúc Store Profile

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/store.ts`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: REST API từ backend
- Produces: Khung ứng dụng Next.js với Sidebar tự ẩn/hiện menu theo `enabled_modules`, Zustand store `useStoreProfile`.

- [ ] **Step 1: Khởi tạo frontend package.json và cài đặt dependencies**

Cài đặt `next`, `react`, `react-dom`, `lucide-react`, `zustand`, `tailwindcss`, `@types/node`, `@types/react`.

- [ ] **Step 2: Cài đặt API Client và Zustand Store**

Tạo `frontend/src/lib/api.ts` và `frontend/src/lib/store.ts` hỗ trợ tải và đồng bộ `enabled_modules`.

- [ ] **Step 3: Xây dựng Layout & Sidebar Thích ứng**

Tạo `Sidebar.tsx` tự động ẩn/hiện mục "Chế biến & Định mức" khi tắt `bom_production`, ẩn "Sổ nợ" khi tắt `credit_ledger`.

- [ ] **Step 4: Kiểm tra build TypeScript**

Chạy: `cd frontend && npm run build`
Kỳ vọng: Build thành công.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/
git commit -m "feat(frontend): initialize next.js 15 app with adaptive zustand store and layout"
```

---

### Task 3: Xây dựng Màn hình Cài đặt Mô-đun Cửa hàng

**Files:**
- Create: `frontend/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `useStoreProfile`, `api.updateSettings`, `api.applyPreset`
- Produces: Màn hình `/settings` với bộ chuyển nhanh 3 Presets (Sạp cá, Thời trang, F&B) và 7 công tắc toggle tính năng độc lập.

- [ ] **Step 1: Viết giao diện Cài đặt Module**

Tạo `frontend/src/app/settings/page.tsx` với giao diện 3 Preset cards (Hải sản, Quần áo, Chế biến) và bảng công tắc Switch cho từng tính năng kèm giải thích chi tiết.

- [ ] **Step 2: Kiểm tra build**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 3: Commit Task 3**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(frontend): implement adaptive store settings and preset switcher screen"
```

---

### Task 4: Xây dựng Màn hình Tạo Sản phẩm Thông minh

**Files:**
- Create: `frontend/src/app/products/new/page.tsx`
- Create: `frontend/src/app/products/page.tsx`

**Interfaces:**
- Consumes: `useStoreProfile`, `api.getProducts`, `api.createProduct`
- Produces: Màn hình danh sách sản phẩm và form tạo sản phẩm tự co giãn (Ma trận Size/Màu, Cân ký điện tử, Định mức BOM, Topping).

- [ ] **Step 1: Xây dựng màn hình danh sách sản phẩm**

Tạo `frontend/src/app/products/page.tsx` hiển thị tồn kho, giá vốn, giá bán, nhãn loại sản phẩm.

- [ ] **Step 2: Xây dựng form tạo sản phẩm thông minh**

Tạo `frontend/src/app/products/new/page.tsx`:
- Ẩn/Hiện Ma trận Size/Màu kèm bộ sinh SKU tự động khi `matrix_variants = true`.
- Ẩn/Hiện Cân thực tế & Đơn vị phụ khi `catch_weight = true`.
- Ẩn/Hiện Chế độ chế biến khi `bom_production = true`.
- Ẩn/Hiện Nhóm đồ ăn kèm khi `product_modifiers = true`.

- [ ] **Step 3: Kiểm tra build**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 4: Commit Task 4**

```bash
git add frontend/src/app/products/
git commit -m "feat(frontend): implement smart adaptive product creation and product list"
```

---

### Task 5: Xây dựng Màn hình Nhập hàng Nhà cung cấp (PO)

**Files:**
- Create: `frontend/src/app/inventory/purchase/page.tsx`

**Interfaces:**
- Consumes: `useStoreProfile`, `api.purchaseStock`, `api.getPartners`
- Produces: Màn hình tạo phiếu nhập kho với quản lý Lô/Hạn dùng và xem trước Giá vốn WAC mới.

- [ ] **Step 1: Xây dựng giao diện Nhập hàng PO**

Tạo `frontend/src/app/inventory/purchase/page.tsx` hỗ trợ chọn NCC, thêm nhiều dòng sản phẩm, nhập số lô/hạn dùng (khi `batch_expiry = true`), tính nhẩm WAC trước khi lưu.

- [ ] **Step 2: Kiểm tra build**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 3: Commit Task 5**

```bash
git add frontend/src/app/inventory/purchase/page.tsx
git commit -m "feat(frontend): implement purchase order and batch receiving screen"
```

---

### Task 6: Xây dựng Màn hình Chế biến & Phân rã BOM

**Files:**
- Create: `frontend/src/app/production/page.tsx`

**Interfaces:**
- Consumes: `api.executeAssembly`, `api.executeDisassembly`, `api.getRecipes`
- Produces: Giao diện 2 Tab: Nấu mẻ thành phẩm (ASSEMBLY) và Mổ xẻ pha lóc (DISASSEMBLY).

- [ ] **Step 1: Xây dựng giao diện Chế biến & Phân rã**

Tạo `frontend/src/app/production/page.tsx`:
- Tab Chế biến mẻ: Hiển thị định mức nguyên liệu cần dùng, cảnh báo thiếu kho, tạo mã lô mới.
- Tab Mổ xẻ: Nhập nguyên liệu vào, nhập các phần thịt/cá thu được, hiển thị phân bổ % giá vốn và % hao hụt.

- [ ] **Step 2: Kiểm tra build**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 3: Commit Task 6**

```bash
git add frontend/src/app/production/page.tsx
git commit -m "feat(frontend): implement bom assembly and disassembly butchery screen"
```

---

### Task 7: Xây dựng Màn hình Ghi nhận Hao hụt / Hủy hàng & Toàn diện Phase 3

**Files:**
- Create: `frontend/src/app/inventory/wastage/page.tsx`

**Interfaces:**
- Consumes: `api.recordWastage`, `api.getProducts`
- Produces: Màn hình xuất hủy mất mát hàng hóa, tính tổn thất vốn tức thì và hạch toán sổ quỹ.

- [ ] **Step 1: Xây dựng giao diện Hủy hàng Hao hụt**

Tạo `frontend/src/app/inventory/wastage/page.tsx` cho phép chọn sản phẩm, nhập số lượng hỏng, chọn lý do, tự động tính tổng tiền mất mát và tùy chọn ghi sổ quỹ.

- [ ] **Step 2: Kiểm tra toàn diện Frontend Build & Backend Test**

Chạy:
1. `cd backend && /usr/local/go/bin/go test -v ./...`
2. `cd frontend && npm run build`
Kỳ vọng: 100% PASS không có lỗi.

- [ ] **Step 3: Commit Task 7**

```bash
git add frontend/src/app/inventory/wastage/page.tsx
git commit -m "feat(frontend): implement inventory wastage and spoilage tracking screen"
```
