# Magic Store - Micro-ERP & POS Đa Ngành, Đa Kho, Đa Đơn Vị Tính

Hệ thống quản trị bán lẻ và chuỗi cung ứng toàn diện kết hợp POS bán hàng, quản lý kho bãi đa chi nhánh, quản lý công nợ, sổ quỹ thu chi và báo cáo tài chính lãi/lỗ thực tế.

---

## 1. Điểm Nhấn Kiến Trúc & Nghiệp Vụ Cốt Lõi

### 1.1. Phân Loại Hàng Hóa & 4 Bản Chất Thương Mại (Archetypes)
Hệ thống phân tách rõ ràng **Phân loại cung ứng** và **Bản chất kinh doanh**:
- **Phân loại trong chuỗi**: Thành phẩm (`FINISHED_GOOD`), Bán thành phẩm (`WIP_SEMI_FINISHED`), Nguyên vật liệu (`RAW_MATERIAL`), Dịch vụ (`SERVICE`).
- **4 Bản chất thương mại (Cách 2 - Tinh giản giao diện)**:
  1. **Hàng đóng gói / Tiêu chuẩn (`STANDARD`)**: Quản lý đa đơn vị tính (thùng, lốc, lon, hộp), mỗi quy cách có mã vạch barcode và giá bán riêng để quét tại quầy.
  2. **Thời trang / Đa biến thể (`MATRIX`)**: Tự động sinh ma trận SKU theo tổ hợp thuộc tính (Màu sắc × Kích cỡ), tải ảnh riêng và cấu hình HSD độc lập cho từng SKU.
  3. **Hàng tươi sống / Cân ký (`CATCH_WEIGHT`)**: Bắt buộc cân trọng lượng thực tế tại POS (kg), quản lý số lô nhập kho, hạn sử dụng theo số ngày (`shelf_life_days`) và cảnh báo cận date.
  4. **Chế biến / F&B (`MANUFACTURED`)**: Cấu hình kích cỡ (Size S/M/L) với giá riêng, nhóm đồ kèm/topping liên kết trực tiếp với sản phẩm nguyên liệu trong kho để tự động trừ kho nguyên liệu khi bán tại POS. Hỗ trợ định mức BOM sản xuất mẻ (`ASSEMBLY`) và mổ xẻ pha lóc cá/thịt (`DISASSEMBLY`).

### 1.2. Phân Hệ Đa Kho & Đa Chi Nhánh (Multi-Warehouse)
- **Quản lý danh mục kho**: Thêm, sửa, xóa, thiết lập kho chính mặc định.
- **Tồn kho đa chi nhánh**: Báo cáo ma trận số lượng tồn kho theo thời gian thực tại từng kho và tổng toàn hệ thống.
- **Điều chuyển kho (`StockTransfer`)**: Lập phiếu xuất/nhận giữa các kho, theo dõi trạng thái `IN_TRANSIT` và `COMPLETED`, bảo toàn tính cân bằng hàng hóa.
- **Gắn kho tác nghiệp**: Quầy POS, phiếu nhập mua và phiếu xuất hủy đều gắn trực tiếp với kho tương ứng.

### 1.3. CRM & Quản Lý Đối Tác Độc Lập
- **Khách hàng (`/customers`)**: Quản lý danh bạ khách hàng, phân hạng giá (Khách lẻ / Khách buôn), thông tin liên hệ và hạn mức nợ tối đa.
- **Nhà cung cấp (`/suppliers`)**: Quản lý đầu mối nguồn hàng, thông tin kho bãi và giao nhận.

### 1.4. Tài Chính, Sổ Nợ & Báo Cáo Lãi/Lỗ Thực Tế (P&L)
- **Sổ Công Nợ (`/finance/debts`)**:
  - Tách bạch: Công nợ phải thu (Khách nợ) và Công nợ phải trả (Nợ nhà cung cấp).
  - Thu nợ / Trả nợ: Giảm trừ dư nợ, ghi nhật ký biến động `DebtLedger`, tự động sinh phiếu Thu/Chi vào Sổ Quỹ.
  - Xem lịch sử đối soát nợ của từng đối tác.
- **Sổ Quỹ Thu / Chi (`/finance/cashbook`)**:
  - Quản lý dòng tiền vào (Inflow) và ra (Outflow) thực tế.
  - Tách bạch Quỹ Tiền Mặt tại két và Tài Khoản Ngân Hàng.
  - Lập phiếu Thu/Chi chi phí vận hành: Thuê mặt bằng (`RENT`), Điện nước (`ELECTRICITY`), Lương nhân viên (`STAFF_WAGE`), Bao bì vật tư (`ICE_PACKAGING`), Cước vận chuyển (`SHIPPING`).
- **Báo Cáo Lãi / Lỗ Thực Tế (`/finance/pnl`)**:
  - Bóc tách theo chuẩn báo cáo kết quả kinh doanh:
    ```
    (+) 1. Doanh thu thuần bán hàng POS
    (-) 2. Giá vốn hàng bán (COGS theo WAC thời gian thực)
    (=) 3. Lợi nhuận gộp (Gross Profit) & Tỷ suất LN gộp (%)
    (-) 4. Chi phí hao hụt & Xuất hủy hàng (Wastage Spoilage)
    (-) 5. Chi phí vận hành cửa hàng (OPEX từ Sổ quỹ)
    (=) 6. Lợi nhuận thuần thực tế (Net Profit) & Tỷ suất LN ròng (%)
    ```
  - Bảng thống kê chi tiết theo từng ngày trong kỳ.

---

## 2. Công Nghệ & Yêu Cầu Cài Đặt

- **Backend**: Golang 1.22+ (Native GORM, Pure Go SQLite 100% CGO-free via `github.com/glebarez/sqlite`, hỗ trợ PostgreSQL qua biến môi trường).
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons, Zustand State Store.
- **Lưu trữ ảnh**: Endpoint upload trực tiếp `/api/upload` lưu trữ disk `/uploads/` kèm hỗ trợ MinIO Object Storage.

---

## 3. Khởi Chạy Nhanh (Quick Start)

### 3.1. Chạy Toàn Bộ Hệ Thống Bằng Docker (Khuyên dùng)

Yêu cầu: Đã cài Docker & Docker Desktop.

```bash
# 1. Khởi động toàn bộ dịch vụ ngầm (Postgres, Backend API, Frontend Web)
docker compose up -d

# 2. Nạp dữ liệu mẫu ban đầu (chạy 1 lần duy nhất)
docker compose --profile seed run --rm seed
```

Hoặc dùng npm script tại root:
```bash
npm run docker:up     # Bật toàn bộ container
npm run docker:seed   # Nạp dữ liệu mẫu phong phú
npm run docker:logs   # Xem log theo thời gian thực
npm run docker:down   # Tắt toàn bộ container
```

**Bảng quản lý container:**
| Thao tác | Lệnh |
| :--- | :--- |
| **Bật / Khởi chạy** | `docker compose up -d` |
| **Tắt toàn bộ** | `docker compose down` |
| **Tạm dừng / Tiếp tục** | `docker compose stop` / `docker compose start` |
| **Khởi động lại riêng lẻ** | `docker compose restart backend` hoặc `docker compose restart frontend` |
| **Build lại khi sửa code** | `docker compose up -d --build` |
| **Xem log dịch vụ** | `docker compose logs -f backend` |

**Địa chỉ truy cập:**
- Frontend: **`http://localhost:3000`**
- Backend REST API: **`http://localhost:8080/api`**
- PostgreSQL: `localhost:5432` (User: `postgres`, Pass: `postgres`, DB: `magic_store`)

---

### 3.2. Khởi Chạy Thủ Công (Local Development)

#### Bước 1: Nạp Dữ Liệu Mẫu (Seed Data)
```bash
cd backend
go run ./cmd/seed
```

#### Bước 2: Khởi Động Backend API
```bash
cd backend
go run ./cmd/server
```
API lắng nghe tại `http://localhost:8080/api`.

#### Bước 3: Khởi Động Frontend
```bash
cd frontend
npm install
npm run dev
```
Truy cập tại `http://localhost:3000`.

---

## 4. Danh Mục Các Phân Hệ & Đường Dẫn (Route Catalog)

| Phân hệ | Đường dẫn (URL) | Mô tả nghiệp vụ |
| :--- | :--- | :--- |
| **Bán hàng POS** | `/pos` | Màn hình bán lẻ POS tốc độ cao, quét barcode, cân ký, bán nợ ghi sổ, chọn chi nhánh kho |
| **Sản phẩm** | `/products` | Danh sách hàng hóa, lọc theo phân loại, xem chi tiết, sửa từng SKU, tải ảnh riêng |
| **Thêm sản phẩm** | `/products/new` | Form tạo mới với 4 bản chất hàng hóa, tạo nhanh danh mục, ĐVT, topping nguyên liệu |
| **Danh mục** | `/categories` | Quản lý cây danh mục sản phẩm |
| **Đơn vị tính** | `/units` | Danh mục đơn vị tính cơ sở & quy đổi |
| **Tồn kho chi nhánh** | `/inventory/stock` | Báo cáo ma trận tồn kho thời gian thực qua tất cả các kho |
| **Chuyển kho** | `/inventory/transfers` | Lập và xác nhận phiếu điều chuyển hàng hóa liên chi nhánh |
| **Danh mục kho bãi** | `/inventory/warehouses` | Quản lý thêm/sửa/xóa và gán kho chính mặc định |
| **Quản lý Lô & HSD** | `/inventory/batches` | Danh sách lô hàng, theo dõi hạn sử dụng, cảnh báo cận date và hết hạn |
| **Nhập kho** | `/inventory/purchase` | Danh sách & Lập phiếu nhập hàng NCC, tự tính HSD theo shelf life và mã lô |
| **Xuất hủy** | `/inventory/wastage` | Ghi nhận mất mát cá ngộp, hư hỏng, cận date, tự sinh phiếu chi hạch toán |
| **Khách hàng (CRM)** | `/customers` | Quản lý thông tin khách hàng, phân hạng giá bán lẻ / bán buôn, hạn mức nợ |
| **Nhà cung cấp** | `/suppliers` | Quản lý thông tin đầu mối nhà cung ứng hàng hóa |
| **Sổ Nợ & Công Nợ** | `/finance/debts` | Quản lý nợ phải thu từ khách và nợ phải trả NCC, thu nợ, trả nợ, lịch sử đối soát |
| **Sổ Quỹ Thu / Chi** | `/finance/cashbook` | Sổ quỹ tiền mặt và ngân hàng, lập phiếu thu chi chi phí vận hành |
| **Báo Cáo Lãi / Lỗ** | `/finance/pnl` | Dashboard P&L bóc tách Doanh thu, Giá vốn WAC, Hao hụt xuất hủy và Chi phí vận hành |
| **Định mức BOM** | `/production` | Công thức sản xuất mẻ và mổ xẻ pha lóc |
| **Cài đặt** | `/settings` | Tên cửa hàng, tiền tệ, phương pháp giá vốn WAC |
