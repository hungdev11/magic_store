# Thiết Kế Chi Tiết: Pha 1 - Core Components, Master Data & Quản Lý Lô Hàng

**Ngày:** 2026-10-16  
**Dự án:** Magic Store (Micro-ERP & Retail POS)  
**Trạng thái:** Đã phê duyệt  
**Phạm vi:** Pha 1 trong lộ trình Refactor 3 pha (Core Master Data, Component dùng chung, Lô hàng & Truy vết)

---

## 1. Mục Tiêu & Bối Cảnh

Hệ thống hiện tại thiếu các module quản lý danh mục dùng chung (Đơn vị tính, Lô hàng, Danh mục sản phẩm, Nhà cung cấp tách riêng). Một số màn hình đang nhồi nhét form trực tiếp vào giao diện chính, dropdown dữ liệu lớn thiếu tính năng tìm kiếm, và thiếu cơ chế bảo vệ toàn vẹn dữ liệu khi xóa danh mục master.

Pha 1 giải quyết triệt để:
1. Xây dựng component `SearchableSelect` dùng chung chống AI slop, hỗ trợ tìm kiếm tức thì.
2. Thiết kế và triển khai module Quản lý Đơn vị tính (`Unit`) chuẩn hóa trong DB và API.
3. Hoàn thiện full CRUD cho Danh mục (`Category`) và Đối tác (`Partner`), tách riêng luồng Nhà cung cấp (Suppliers) và Khách hàng (Customers).
4. Thiết lập quy tắc chặn xóa an toàn (Referential Integrity Check): Chặn xóa nếu thực thể đang được sử dụng ở sản phẩm/giao dịch.
5. Xây dựng module Quản lý Số Lô (`InventoryBatch`): Danh sách lô, cảnh báo hạn dùng, chỉnh sửa ghi chú/hạn sử dụng, truy vết lịch sử biến động kho theo từng lô (`InventoryMovement`).
6. Cơ cấu lại Sidebar Menu và điều hướng trang.

---

## 2. Kiến Trúc Dữ Liệu & Database Schema

### 2.1. Prisma Schema (`prisma/schema.prisma`)

Bổ sung model `Unit` và các trường hỗ trợ:

```prisma
model Unit {
  id          String   @id @default(cuid())
  code        String   @unique // vd: KG, HOP, CHAI, GOI
  name        String   // vd: Kilogram, Hộp, Chai, Gói
  description String?
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([code])
}
```

Mở rộng `Category`:
```prisma
// Thêm trường is_active
model Category {
  // ... các trường hiện tại
  is_active   Boolean  @default(true)
  // ...
}
```

Mở rộng `Partner`:
```prisma
// Thêm trường is_active
model Partner {
  // ... các trường hiện tại
  is_active   Boolean  @default(true)
  // ...
}
```

Mở rộng `InventoryBatch`:
```prisma
// Thêm trường notes
model InventoryBatch {
  // ... các trường hiện tại
  notes       String?
  // ...
}
```

### 2.2. Backend Go Models (`backend/internal/model/`)

1. **`unit.go` (Mới):**
   ```go
   type Unit struct {
       ID          string    `gorm:"primaryKey;size:64" json:"id"`
       Code        string    `gorm:"uniqueIndex;not null;size:50" json:"code"`
       Name        string    `gorm:"not null;size:100" json:"name"`
       Description string    `gorm:"size:255" json:"description,omitempty"`
       IsActive    bool      `gorm:"default:true" json:"is_active"`
       CreatedAt   time.Time `json:"created_at"`
       UpdatedAt   time.Time `json:"updated_at"`
   }
   ```
2. **Cập nhật `category.go`:** Bổ sung `IsActive bool` (`json:"is_active"`).
3. **Cập nhật `partner.go`:** Bổ sung `IsActive bool` (`json:"is_active"`).
4. **Cập nhật `inventory.go`:** Bổ sung `Notes string` (`json:"notes,omitempty"`).

---

## 3. Backend API Endpoints & Logic Kiểm Soát Ràng Buộc

### 3.1. Quản lý Đơn vị tính (`/api/units`)
*   `GET /api/units?active_only=true|false`: Lấy danh sách đơn vị tính.
*   `POST /api/units`: Tạo đơn vị tính mới (`code`, `name`, `description`). Mã `code` chuẩn hóa chữ hoa, không trùng.
*   `PUT /api/units/:id`: Cập nhật tên, mô tả, trạng thái hoạt động.
*   `DELETE /api/units/:id`: Kiểm tra ràng buộc trước khi xóa:
    *   Truy vấn bảng `products` có `base_uom = unit.code` hoặc bảng `uom_conversions` có `uom_name = unit.code`.
    *   Nếu tồn tại bản ghi liên kết: Trả về HTTP `409 Conflict` với thông báo: `"Đơn vị đang được sử dụng ở sản phẩm, không thể xóa. Vui lòng chuyển trạng thái sang Vô hiệu hóa."`
    *   Nếu không có liên kết: Thực hiện xóa và trả về HTTP `200 OK`.

### 3.2. Quản lý Danh mục (`/api/categories`)
*   `GET /api/categories`: Lấy danh sách danh mục (kèm đếm số lượng sản phẩm trực thuộc `product_count`).
*   `GET /api/categories/:id`: Chi tiết 1 danh mục.
*   `POST /api/categories`: Tạo danh mục mới (`name`, `code`, `parent_id`).
*   `PUT /api/categories/:id`: Cập nhật thông tin danh mục.
*   `DELETE /api/categories/:id`: Kiểm tra bảng `products` có `category_id = :id` hoặc danh mục con có `parent_id = :id`.
    *   Nếu có sản phẩm hoặc danh mục con: Trả về HTTP `409 Conflict`.
    *   Nếu không: Xóa danh mục.

### 3.3. Quản lý Đối tác (`/api/partners`)
*   `GET /api/partners?type=SUPPLIER|CUSTOMER`: Lọc nhanh danh sách đối tác theo vai trò.
*   `POST /api/partners`: Tạo mới đối tác.
*   `PUT /api/partners/:id`: Cập nhật thông tin đối tác (tên, sđt, địa chỉ, hạn mức nợ, active).
*   `DELETE /api/partners/:id`:
    *   Với NCC: Kiểm tra bảng `inventory_batches` (`supplier_id = :id`) và phiếu mua hàng.
    *   Với Khách hàng: Kiểm tra bảng `sales_orders` (`customer_id = :id`) và `debt_ledgers`.
    *   Nếu có giao dịch: Trả về HTTP `409 Conflict`.

### 3.4. Quản lý Số Lô & Truy Vết (`/api/batches`)
*   `GET /api/batches?status=ACTIVE|EXPIRED|EXPIRING_SOON|OUT_OF_STOCK&q=...`:
    *   Tìm kiếm theo mã lô, tên sản phẩm, mã SKU.
    *   Phân loại hạn sử dụng: Cận date (< 30 ngày so với thời điểm hiện tại), Đã hết hạn, Còn hạn tốt.
*   `GET /api/batches/:id/trace`:
    *   Truy vấn bảng `inventory_movements` có `batch_id = :id`, sắp xếp thời gian giảm dần.
    *   Trả về lịch sử toàn bộ các biến động: Phiếu nhập (`PURCHASE_IN`), Bán hàng (`SALE_OUT`), Hao hụt (`WASTAGE_SPOILAGE`), Sản xuất (`PRODUCTION_YIELD`/`PRODUCTION_CONSUME`).
*   `PUT /api/batches/:id`:
    *   Cho phép cập nhật ngày hết hạn (`expiry_date`) và ghi chú (`notes`). Không cho phép sửa số lượng tồn thủ công tại đây (phải qua nghiệp vụ kiểm kê/hao hụt để đảm bảo tính toàn vẹn sổ cái kho).

---

## 4. Thiết Kế Frontend & Trải Nghiệm Người Dùng (UI/UX)

### 4.1. Core Component: `SearchableSelect`
Vị trí: `frontend/src/components/common/SearchableSelect.tsx`
*   **Props:**
    *   `options`: Mảng `{ value: string; label: string; subLabel?: string; badge?: string }`
    *   `value`: Giá trị đang chọn
    *   `onChange`: Callback khi chọn
    *   `placeholder`: Chuỗi gợi ý
    *   `disabled`: Trạng thái khóa
    *   `autoFocus`: Tự động focus
*   **Hành vi & Tương tác:**
    *   Bấm vào hiển thị dropdown với ô tìm kiếm tức thì.
    *   Hỗ trợ phím `ArrowDown`, `ArrowUp`, `Enter` để chọn, `Escape` để thoát.
    *   Tuân thủ triệt để token: Nền `bg-surface-card`, viền `border-border-default`, bo góc `rounded-md`, chữ `text-text-main`, không shadow to, không gradient.

### 4.2. Khung Màn Hình Danh Sách & Form Modal (Pattern Chuẩn)
*   **Màn hình chính (Index View):**
    *   Luôn là danh sách bảng (Table).
    *   Header gồm: Tiêu đề trang, thanh tìm kiếm + bộ lọc trạng thái (Active / Inactive), nút chính `+ Thêm mới`.
    *   Mỗi dòng bảng có cột thao tác: Nút "Sửa" và "Xóa" tinh gọn.
*   **Modal Form (Chỉ xuất hiện khi bấm Tạo hoặc Sửa):**
    *   Dùng backdrop mờ nhẹ tiêu chuẩn, hộp thoại ở giữa với viền `border-border-subtle`, header có nút Đóng `X` và phím tắt `Esc`.
    *   Form có validation đầy đủ, báo lỗi tại từng ô input.
    *   Nút Lưu có trạng thái loading spinner ngăn bấm lặp.

### 4.3. Các Màn Hình Mới Cần Xây Dựng
1.  **Quản lý Đơn vị tính (`frontend/src/app/units/page.tsx`):**
    *   Bảng hiển thị: Mã đơn vị (`font-mono`), Tên đơn vị, Mô tả, Trạng thái (Active/Inactive), Thao tác.
    *   Modal Thêm/Sửa đơn vị tính.
2.  **Quản lý Danh mục (`frontend/src/app/categories/page.tsx`):**
    *   Bảng hiển thị: Mã danh mục (`font-mono`), Tên danh mục, Danh mục cha (nếu có), Số lượng sản phẩm trực thuộc, Trạng thái, Thao tác.
    *   Modal Thêm/Sửa danh mục với `SearchableSelect` để chọn danh mục cha.
3.  **Quản lý Nhà cung cấp & Khách hàng (`frontend/src/app/partners/`):**
    *   Tách tab hoặc 2 trang chuyên biệt: Nhà cung cấp (`/partners?type=SUPPLIER`) và Khách hàng (`/partners?type=CUSTOMER`).
    *   Bảng danh sách với công nợ hiện tại (`font-mono tabular-nums text-right`), số điện thoại, địa chỉ, trạng thái.
    *   Modal Thêm/Sửa đối tác.
4.  **Quản lý Số Lô & Hạn Dùng (`frontend/src/app/inventory/batches/page.tsx`):**
    *   Bảng danh sách lô: Mã lô (`font-mono`), Tên sản phẩm & SKU, Nhà cung cấp, Tồn hiện tại / Ban đầu (`font-mono tabular-nums`), Ngày nhập, Ngày hết hạn, Badge trạng thái (Còn hạn / Cận date / Đã hết hạn), Nút "Truy vết" và "Sửa HSD".
    *   Slide-over Drawer / Modal "Lịch sử biến động lô": Liệt kê timeline các lần nhập, bán, hủy hao hụt liên quan đến lô đó.

### 4.4. Tái Cấu Trúc Sidebar Navigation (`frontend/src/components/Sidebar.tsx`)
Nhóm điều hướng rõ ràng, trực quan:
*   **HÀNG HÓA & DANH MỤC:**
    *   Sản phẩm (`/products`)
    *   Danh mục (`/categories`)
    *   Đơn vị tính (`/units`)
*   **KHO & VẬT TƯ:**
    *   Quản lý Số Lô & HSD (`/inventory/batches`)
    *   Nhập kho (`/inventory/purchase`)
    *   Xuất hủy & Hao hụt (`/inventory/wastage`)
*   **ĐỐI TÁC:**
    *   Nhà cung cấp (`/partners?type=SUPPLIER`)
    *   Khách hàng (`/partners?type=CUSTOMER`)
*   **SẢN XUẤT & CHẾ BIẾN:**
    *   Định mức BOM & Gia công (`/production`)
*   **HỆ THỐNG:**
    *   Cài đặt (`/settings`)

---

## 5. Kế Hoạch Kiểm Thử & Xác Minh (Verification Strategy)

1.  **Kiểm tra Ràng buộc Khóa ngoại (Referential Integrity):**
    *   Tạo Đơn vị tính mới -> Gán vào sản phẩm -> Gọi API xóa Đơn vị tính -> Xác minh API trả về lỗi 409 Conflict.
    *   Tạo Danh mục mới -> Gán sản phẩm -> Gọi API xóa Danh mục -> Xác minh trả về lỗi 409 Conflict.
    *   Tạo Nhà cung cấp -> Nhập kho tạo lô -> Gọi API xóa Nhà cung cấp -> Xác minh trả về lỗi 409 Conflict.
2.  **Kiểm tra Component `SearchableSelect`:**
    *   Render với danh sách 50+ mục.
    *   Gõ từ khóa tìm kiếm -> Kiểm tra kết quả hiển thị chính xác.
    *   Dùng phím mũi tên và Enter để chọn giá trị.
3.  **Kiểm tra Truy vết Lô Hàng:**
    *   Tạo phiếu nhập kho 100 sản phẩm theo lô L001.
    *   Xuất hao hụt 5 sản phẩm từ lô L001.
    *   Mở màn hình Quản lý Lô -> Nhấn "Truy vết" lô L001 -> Kiểm tra hiển thị đủ 2 dòng biến động `PURCHASE_IN` (+100) và `WASTAGE_SPOILAGE` (-5), số dư còn 95.
4.  **Kiểm tra Build & Type Safety:**
    *   Backend: Chạy `go build` / `go test` không có lỗi compile.
    *   Frontend: Chạy `pnpm build` hoặc `npm run build` xác nhận không có lỗi TypeScript / JSX.
