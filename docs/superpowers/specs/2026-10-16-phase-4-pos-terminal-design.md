# Phase 4: Adaptive POS Terminal Specification (Catch-Weight, Matrix Exchange, Toppings & Offline-First)

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Principal ERP Architect

---

## 1. Executive Summary & Goals

Phase 4 xây dựng Màn hình Bán hàng Siêu Tốc (Adaptive POS Terminal) tại `/pos`:
1. **Bán hàng theo trọng lượng thực tế (Catch-weight & Dual-unit):** Bàn phím số nhanh nhập số kg cân lẻ, cho phép sửa giá trực tiếp tại quầy (giảm giá cuối ngày) có kiểm tra giá sàn `min_selling_price`.
2. **Đổi trả hàng 1 chạm (1-Screen Exchange Flow cho thời trang):** Khách trả lại Áo Trắng Size M (`is_return: true`, cộng tồn kho `+1`, bù tiền) và lấy Áo Đen Size L (`-1` kho), hệ thống tự động bù trừ tiền chênh lệch trong cùng 1 hóa đơn.
3. **Đồ ăn kèm & Topping (F&B Modifier Deduction):** Chọn topping (trứng ốp la, pate) có cộng thêm tiền và tự động trừ kho nguyên liệu ăn kèm theo công thức.
4. **Thanh toán đa phương thức & Ghi nợ khách hàng:** Tiền mặt (tính tiền thối), Chuyển khoản QR, Ghi nợ tự động vào `DebtLedger`.
5. **Offline-First Resilience:** Bán hàng mượt mà khi mất mạng nhờ Zustand + LocalStorage queue, tự động đồng bộ khi có kết nối trở lại.
6. **Backend Composable ACID Transaction:** Endpoint `POST /api/pos/checkout` đảm bảo 100% tính toàn vẹn giữa Ledger kho, Công nợ và Sổ quỹ dòng tiền.

---

## 2. Backend POS API Specification

### Endpoint: `POST /api/pos/checkout`

- **Request Body:**
```json
{
  "pos_session_id": "optional-string",
  "customer_id": "optional-string",
  "items": [
    {
      "variant_id": "v_fish_live",
      "sold_uom": "Con",
      "sold_qty": 1,
      "actual_base_qty_deducted": 1.35,
      "actual_unit_price": 150000,
      "is_return": false
    },
    {
      "variant_id": "v_shirt_white_m",
      "sold_uom": "Cái",
      "sold_qty": 1,
      "actual_base_qty_deducted": 1,
      "actual_unit_price": 350000,
      "is_return": true
    },
    {
      "variant_id": "v_shirt_black_l",
      "sold_uom": "Cái",
      "sold_qty": 1,
      "actual_base_qty_deducted": 1,
      "actual_unit_price": 380000,
      "is_return": false
    },
    {
      "variant_id": "v_banh_mi",
      "sold_uom": "Ổ",
      "sold_qty": 1,
      "actual_base_qty_deducted": 1,
      "actual_unit_price": 25000,
      "is_return": false,
      "modifiers": [
        {
          "name": "Thêm Trứng Ốp La",
          "price": 10000,
          "linked_variant_id": "v_trung_ga",
          "deduct_qty": 1
        }
      ]
    }
  ],
  "subtotal": 415000,
  "discount_amount": 0,
  "surcharge_amount": 0,
  "total_amount": 415000,
  "paid_amount": 400000,
  "debt_amount": 15000,
  "payment_method": "MIXED",
  "notes": "Đơn đổi áo + cá cân lẻ"
}
```

- **Logic xử lý trong Transaction:**
  1. Kiểm tra tồn tại sản phẩm, kiểm tra `min_selling_price`.
  2. Ghi `InventoryMovement`:
     - Bán thường: `SALE_OUT` (`-qty`), tính WAC COGS.
     - Đổi trả: `RETURN_IN` (`+qty`), hoàn lại tồn kho.
     - Topping: Trừ kho nguyên liệu liên kết.
     - Backflush: Trừ kho nguyên liệu cấu thành nếu có BOM.
  3. Tạo `SalesOrder` và `SalesOrderItem`.
  4. Nếu `debt_amount > 0`: Ghi nhận `DebtLedger` (`SALE_DEBT`) và cộng dồn nợ đối tác `Partner.current_debt_balance`.
  5. Nếu `paid_amount > 0`: Ghi nhận `CashbookTransaction` (`INFLOW`, `SALES_REVENUE`).
  6. Trả về thông tin hóa đơn hoàn chỉnh kèm mã đơn.

---

## 3. Frontend Architecture & POS Screen (`/pos`)

### 3.1. Zustand POS Store (`frontend/src/lib/pos-store.ts`)
- Quản lý `cart`, `customer`, `paymentDetails`, `offlineQueue`, `isOnline`.
- Hàm `addToCart`, `updateCartItem`, `toggleReturnItem`, `setOverridePrice`, `checkout`, `syncOfflineQueue`.
- Tự động lưu LocalStorage để không mất giỏ hàng khi reload trình duyệt.

### 3.2. POS Screen Components (`frontend/src/app/pos/page.tsx`)
1. **Top Navigation Bar:**
   - Badge trạng thái Online/Offline.
   - Thống kê đơn chờ đồng bộ (`N đơn offline`).
   - Phím tắt gợi ý: `F2` (Tìm kiếm), `F4` (Khách hàng), `F8` (Thanh toán), `F9` (Đổi trả).
2. **Product Grid (Cột Trái):**
   - Danh mục filter tabs.
   - Ô tìm kiếm / quét mã vạch Barcode bắt focus.
   - Card sản phẩm với giá bán, tồn kho, và badge ngành nghề.
   - Click card mở Popup nhập liệu chuyên biệt:
     - **Quick Weight Modal:** Bàn phím số cảm ứng nhập cân nặng kg + sửa giá.
     - **Matrix Variant Modal:** Lưới chọn Size x Màu 1 chạm.
     - **Modifier Modal:** Chọn danh sách Topping thêm vào món.
3. **Adaptive Cart (Cột Phải):**
   - Dòng hàng bán hiển thị rõ: Số lượng, Đơn vị bán, Số cân thực tế, Đơn vị phụ, Topping đính kèm.
   - Nút **"Đổi trả (Trả lại)"** chuyển dòng hàng sang trạng thái màu đỏ cam (`is_return: true`, số tiền hiển thị dấu trừ `-`).
   - Nút **"Sửa giá quầy"** mở prompt sửa đơn giá (báo vàng nếu dưới giá niêm yết, báo đỏ nếu dưới giá sàn).
4. **Payment Panel:**
   - Chọn Khách hàng (hiển thị số nợ cũ).
   - Chọn phương thức: Tiền mặt, Chuyển khoản VietQR, Ghi nợ 100%.
   - Ô nhập tiền khách đưa $\rightarrow$ tự động hiển thị tiền thối hoặc tiền nợ lại.
   - Nút **"THANH TOÁN (F8)"** cỡ lớn nổi bật.
