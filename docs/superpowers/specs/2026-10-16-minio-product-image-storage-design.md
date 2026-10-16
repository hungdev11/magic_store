# MinIO Object Storage for Product & Variant Images Specification

## 1. Overview
Hệ sinh thái lưu trữ ảnh sản phẩm tập trung dựa trên dịch vụ lưu trữ đối tượng tương thích S3 (MinIO Object Storage).
Hệ thống sử dụng cơ chế **Presigned PUT URL**:
- Client (Frontend) yêu cầu một URL ký trước kèm chữ ký tạm thời từ Backend Go.
- Client trực tiếp upload file ảnh lên MinIO bucket mà không cần truyền payload file qua backend server, tối ưu băng thông và tài nguyên.
- Bucket được cấu hình quyền đọc công khai (Read-only anonymous access) để cho phép client hiển thị ảnh trực tiếp qua URL tĩnh.

## 2. Infrastructure Architecture
### 2.1 Docker Compose (`docker-compose.yml`)
- Service: `minio`
  - Image: `minio/minio:RELEASE.2024-11-07T00-52-20Z` (hoặc bản mới ổn định).
  - Ports:
    - `9000:9000` (S3 API).
    - `9001:9001` (MinIO Web Console).
  - Environment:
    - `MINIO_ROOT_USER=minioadmin`
    - `MINIO_ROOT_PASSWORD=minioadmin`
  - Command: `server /data --console-address ":9001"`
  - Volumes: `minio_data:/data`
- Service phụ trợ: `minio-create-bucket` (tùy chọn hoặc backend Go tự khởi tạo bucket khi khởi động):
  - Khởi tạo bucket `products`.
  - Set policy `download` (public read).

### 2.2 Backend Environment Configuration
- `MINIO_ENDPOINT`: `localhost:9000` (mặc định)
- `MINIO_ACCESS_KEY`: `minioadmin`
- `MINIO_SECRET_KEY`: `minioadmin`
- `MINIO_BUCKET`: `products`
- `MINIO_USE_SSL`: `false`
- `MINIO_PUBLIC_URL`: `http://localhost:9000` (URL công khai trả về cho client)

## 3. Data Model Changes

### 3.1 Backend Go Models (`backend/internal/model/product.go`)
- `Product`:
  - `ImageURL string` (`gorm:"size:512" json:"image_url,omitempty"`)
  - `Images string` (`gorm:"type:text;default:'[]'" json:"images,omitempty"`)
- `ProductVariant`:
  - `ImageURL string` (`gorm:"size:512" json:"image_url,omitempty"`)

### 3.2 Prisma Schema (`prisma/schema.prisma`)
- Model `Product`:
  - `image_url String?`
  - `images Json? @default("[]")`
- Model `ProductVariant`:
  - `image_url String?`

## 4. Backend Service & API Specification

### 4.1 MinIO Storage Service (`backend/internal/service/storage_service.go`)
- Sử dụng package `github.com/minio/minio-go/v7`.
- Phương thức `NewStorageService(cfg StorageConfig) (*StorageService, error)`:
  - Khởi tạo client kết nối MinIO.
  - Tự động gọi `EnsureBucketExists(ctx)`: nếu bucket chưa có thì tạo mới và thiết lập public read policy.
- Phương thức `GetPresignedUploadURL(ctx context.Context, originalFilename string, contentType string) (*PresignedURLResponse, error)`:
  - Kiểm tra extension hợp lệ: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.
  - Tạo key đối tượng ngẫu nhiên: `{uuid}-{sanitized_filename}`.
  - Ký URL PUT với thời gian hết hạn 15 phút (`time.Minute * 15`).
  - Trả về:
    - `UploadURL`: URL chứa chữ ký bảo mật dùng cho phương thức HTTP PUT.
    - `FileURL`: URL tĩnh công khai dùng để lưu vào CSDL (`http://localhost:9000/products/{object_name}`).

### 4.2 REST API Endpoints (`backend/internal/api/`)
- `POST /api/upload/presigned-url`:
  - Request Body:
    ```json
    {
      "filename": "ao-so-mi-oxford.jpg",
      "content_type": "image/jpeg"
    }
    ```
  - Validation:
    - Bắt buộc có `filename` và `content_type`.
    - `content_type` phải thuộc định dạng ảnh: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
  - Response (200 OK):
    ```json
    {
      "upload_url": "http://localhost:9000/products/4f2a1b...-ao-so-mi-oxford.jpg?X-Amz-Algorithm=...",
      "file_url": "http://localhost:9000/products/4f2a1b...-ao-so-mi-oxford.jpg",
      "object_name": "4f2a1b...-ao-so-mi-oxford.jpg"
    }
    ```

## 5. Frontend Integration

### 5.1 Reusable Component `ImageUploader` (`frontend/src/components/common/ImageUploader.tsx`)
- Props:
  - `value?: string` (URL ảnh hiện tại)
  - `onChange: (url: string) => void`
  - `onRemove?: () => void`
  - `label?: string`
  - `aspectRatio?: "square" | "video"`
- Hoạt động:
  1. Người dùng chọn ảnh hoặc kéo thả file.
  2. Component gọi `api.getPresignedUploadUrl(file.name, file.type)`.
  3. Dùng `fetch(res.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`.
  4. Sau khi PUT thành công (status 200), gọi `onChange(res.file_url)`.
  5. Hiển thị thumbnail xem trước, kèm nút Xóa (Trash) và Thay đổi (Pencil).

### 5.2 Product Management Integration
- Màn hình `/products/new` & modal sửa:
  - Thêm phần chọn ảnh đại diện cho Sản phẩm.
  - Khi cấu hình ma trận biến thể: cho phép gán ảnh riêng cho từng dòng biến thể SKU.
- Màn hình POS `/pos`:
  - Hiển thị thumbnail ảnh sản phẩm trên thẻ card trong `PosProductGrid`.
  - Nếu sản phẩm không có ảnh, hiển thị icon theo nhóm ngành (Scale cho hải sản, Layers cho thời trang, Utensils cho F&B).

## 6. Testing & Quality Gates
- **Backend Tests:**
  - Viết unit test mock cho `StorageService` và test API endpoint `POST /api/upload/presigned-url` trong `backend/tests/`.
  - Kiểm tra trường hợp extension không hợp lệ trả về mã lỗi 400.
- **Frontend Verification:**
  - Kiểm tra biên dịch TypeScript `tsc --noEmit` đạt 0 lỗi.
  - Kiểm tra Next.js build đạt 100% thành công.
