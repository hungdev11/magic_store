# Phase 4: Adaptive POS Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trọn vẹn màn hình Bán hàng POS Siêu tốc (Adaptive POS Terminal) tại `/pos`: hỗ trợ nhập số cân lẻ + sửa giá trực tiếp (cho cá/thịt), chọn ma trận Size/Màu + Đổi trả 1 chạm bù trừ tiền (cho thời trang), chọn Topping/Modifier trừ kho nguyên liệu (cho F&B), thanh toán ghi nợ, và chế độ Offline-First lưu queue đồng bộ tự động.

**Architecture:**
- **Backend:** Thêm endpoint `POST /api/pos/checkout` vào Go REST server (`backend/internal/api/handlers.go`), xử lý toàn bộ chu trình bán hàng, trừ/cộng kho Base UOM, công nợ và sổ quỹ trong 1 ACID transaction.
- **Frontend:** Xây dựng Zustand store `usePosStore` với LocalStorage persistence và offline queue (`frontend/src/lib/pos-store.ts`), cùng giao diện POS toàn màn hình với phím tắt bàn phím (`frontend/src/app/pos/page.tsx`).

**Tech Stack:** Go 1.27, GORM, `shopspring/decimal`, Next.js 15, TypeScript, Tailwind CSS, Lucide React, Zustand.

## Global Constraints
- Bán hàng và tính toán tiền tệ chính xác 100%, không sai số dấu phẩy động.
- Dòng đổi trả (`is_return = true`) phải ghi nhận `RETURN_IN` cộng kho và trừ tiền đơn hàng.
- Bắt buộc kiểm tra giá sàn `min_selling_price` khi người bán tự sửa giá.
- Offline-First: khi mất mạng vẫn hoàn tất đơn hàng và tự động sync về backend khi online trở lại.

---

### Task 1: Xây dựng Backend POS Checkout API Endpoint

**Files:**
- Modify: `backend/internal/api/handlers.go`
- Modify: `backend/internal/api/routes.go`
- Modify: `backend/tests/api_test.go`

**Interfaces:**
- Consumes: GORM DB, `UOMService`, `InventoryLedgerService`, `BOMProductionService`
- Produces: `POST /api/pos/checkout` endpoint xử lý checkout trong 1 transaction ACID.

- [ ] **Step 1: Viết test failing cho POS checkout API**

Tạo `TestAPI_PosCheckout` trong `backend/tests/api_test.go`:
1. Bán cá chẽm cân số thực (1.35 kg).
2. Đơn đổi trả áo: Trả áo Size M (`is_return: true`), lấy áo Size L (`is_return: false`), bù trừ tiền chênh lệch.
3. Bán bánh mì kèm topping trứng ốp la tự trừ kho trứng.
4. Ghi nợ đối tác khi `debt_amount > 0`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestAPI_PosCheckout`
Kỳ vọng: FAIL vì chưa có handler `handlePosCheckout`.

- [ ] **Step 3: Cài đặt handler POS Checkout trong backend/internal/api/handlers.go**

Viết `handlePosCheckout`:
- Đọc `PosCheckoutRequest`.
- Mở `tx := s.db.Begin()`.
- Lặp qua items: kiểm tra `min_selling_price`, ghi `InventoryMovement` (`SALE_OUT` hoặc `RETURN_IN`), trừ topping, trừ backflush.
- Tạo `SalesOrder` và `SalesOrderItem`.
- Ghi `DebtLedger` nếu `debt_amount > 0`.
- Ghi `CashbookTransaction` nếu `paid_amount > 0`.
- `tx.Commit()`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./tests -run TestAPI_PosCheckout`
Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/
git commit -m "feat(backend): implement atomic pos checkout endpoint with return and modifiers"
```

---

### Task 2: Xây dựng Zustand POS Store & Offline Queue Persistence

**Files:**
- Create: `frontend/src/lib/pos-store.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `api.ts`
- Produces: `usePosStore` với LocalStorage persistence, giỏ hàng thích ứng, chuyển đổi đổi trả `toggleReturnItem`, bàn phím số cân điện tử, và hàng đợi offline queue tự sync.

- [ ] **Step 1: Mở rộng api.ts với hàm checkout**

Thêm `api.checkoutOrder(payload)` vào `frontend/src/lib/api.ts`.

- [ ] **Step 2: Cài đặt usePosStore trong frontend/src/lib/pos-store.ts**

Viết `usePosStore`:
- Quản lý `cartItems`: hỗ trợ `actual_base_qty_deducted`, `actual_unit_price`, `is_return`, `modifiers`.
- Tính toán tổng tiền: `subtotal`, `discount`, `surcharge`, `total`, `paidAmount`, `debtAmount`.
- `checkout()`: nếu online gọi `api.checkoutOrder`, nếu offline lưu vào `offlineQueue` LocalStorage.
- `syncOfflineQueue()`: đồng bộ các đơn offline lên server khi kết nối trở lại.

- [ ] **Step 3: Kiểm tra build TypeScript**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 4: Commit Task 2**

```bash
git add frontend/src/lib/pos-store.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): implement zustand pos store with offline queue and adaptive cart actions"
```

---

### Task 3: Xây dựng Giao diện POS Fullscreen & Lưới Sản Phẩm Chạm Nhanh

**Files:**
- Create: `frontend/src/app/pos/page.tsx`
- Modify: `frontend/src/components/Header.tsx` (thêm nút vào nhanh POS)
- Modify: `frontend/src/components/Sidebar.tsx` (thêm link Bán hàng POS)

**Interfaces:**
- Consumes: `usePosStore`, `useStoreProfile`, `api.getProducts`, `api.getPartners`
- Produces: Màn hình bán hàng siêu tốc `/pos` với danh mục tabs, ô tìm kiếm/quét mã vạch tự động bắt focus, lưới card sản phẩm cảm ứng.

- [ ] **Step 1: Xây dựng Khung POS & Product Grid**

Viết phần Header POS (trạng thái mạng online/offline, badge đơn chờ sync), thanh tìm kiếm Barcode, danh mục tabs, lưới sản phẩm chạm nhanh.

- [ ] **Step 2: Tích hợp Popups nhập liệu đặc thù theo ngành**
  - **Catch-weight Modal:** Bàn phím số cảm ứng nhập số kg cân lẻ (vd `1.35` kg) + ô sửa giá quầy.
  - **Matrix Modal:** Lưới chọn Size x Màu 1 chạm.
  - **Modifier Modal:** Chọn danh sách Topping thêm vào món ăn.

- [ ] **Step 3: Kiểm tra build**

Chạy: `cd frontend && npm run build`
Kỳ vọng: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add frontend/src/app/pos/page.tsx frontend/src/components/
git commit -m "feat(frontend): implement pos fullscreen layout, quick-touch grid, and industry input modals"
```

---

### Task 4: Xây dựng Giỏ Hàng Thích Ứng, Đổi Trả 1 Chạm & Thanh Toán Ghi Nợ

**Files:**
- Modify: `frontend/src/app/pos/page.tsx`

**Interfaces:**
- Consumes: `usePosStore`
- Produces: Cột giỏ hàng thích ứng với tính năng Đổi trả 1 chạm (`is_return: true`), sửa giá trực tiếp tại quầy, chọn khách hàng, tính tiền thối và ghi nợ.

- [ ] **Step 1: Xây dựng Giỏ Hàng Thích Ứng (Adaptive Cart Items)**
  - Hiển thị từng dòng hàng: số lượng, khối lượng cân lẻ, đơn vị bán, topping.
  - Nút **"Đổi trả (Trả lại)"**: Biến dòng hàng thành màu cam đỏ, số lượng `+1 vào kho`, đơn giá hiển thị `-Giá tiền`.
  - Nút **"Sửa giá"**: Popup sửa nhanh giá bán tại quầy có kiểm tra giá sàn `min_selling_price`.

- [ ] **Step 2: Xây dựng Khối Thanh Toán & Sổ Nợ Khách Hàng**
  - Dropdown chọn Khách hàng (hiển thị số nợ cũ).
  - Khối nhập tiền: Tiền khách đưa $\rightarrow$ tự động tính tiền thối hoặc chuyển phần thiếu thành **Ghi nợ**.
  - Phương thức: Tiền mặt, Chuyển khoản QR, Ghi nợ 100%.
  - Phím tắt bàn phím: `F8` thanh toán, `F2` tìm kiếm, `Escape` hủy.
  - Nút **"THANH TOÁN (F8)"** cỡ lớn nổi bật, in hóa đơn popup và hoàn tất đơn trong 0.5s.

- [ ] **Step 3: Kiểm tra toàn diện Backend Test & Frontend Build**

Chạy:
1. `cd backend && /usr/local/go/bin/go test -v ./...`
2. `cd frontend && npm run build`
Kỳ vọng: 100% PASS không có lỗi.

- [ ] **Step 4: Commit Task 4**

```bash
git add frontend/src/app/pos/page.tsx
git commit -m "feat(frontend): implement adaptive cart with 1-screen exchange flow and credit payment"
```
