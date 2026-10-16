# Magic Store - Hướng Dẫn Chạy Ứng Dụng

Hệ thống Micro-ERP & POS đa ngành nghề: Sạp cá tươi sống, Shop thời trang, Tiệm F&B.

## Yêu Cầu Cài Đặt

- **Docker Desktop** (PostgreSQL & MinIO)
- **Go 1.22+** (Backend API)
- **Node.js 18+ & npm** (Frontend Next.js & Prisma)

---

## 1. Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc dự án:

```env
# Database PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/magic_store?sslmode=disable"

# Backend Server
PORT=8080

# MinIO Object Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=products
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_USE_SSL=false

# Frontend API Endpoint
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## 2. Khởi Động Hạ Tầng (PostgreSQL & MinIO)

Chạy container nền qua Docker Compose:

```bash
docker compose up -d
```

- PostgreSQL: `localhost:5432`
- MinIO API: `localhost:9000`
- MinIO Console: `http://localhost:9001` (User/Pass: `minioadmin` / `minioadmin`)

---

## 3. Khởi Tạo Cơ Sở Dữ Liệu & Seed Dữ Liệu Mẫu

Chạy tại thư mục gốc:

```bash
# Cài đặt dependency
npm install

# Đồng bộ schema vào PostgreSQL
npx prisma db push

# Nạp dữ liệu mẫu 3 ngành nghề (Sạp cá, Thời trang, F&B)
npx prisma db seed
```

---

## 4. Chạy Backend (Go API)

```bash
cd backend

# Build server (nếu chưa có server.exe)
go build -o server.exe ./cmd/server

# Chạy trên Git Bash (tự nạp biến môi trường từ .env)
set -a && source ../.env && set +a && ./server.exe

# Hoặc chạy trên PowerShell:
# $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/magic_store?sslmode=disable"
# .\server.exe
```

- API Base: `http://localhost:8080/api`
- Kiểm tra trạng thái:
  ```bash
  curl http://localhost:8080/api/settings
  ```

---

## 5. Chạy Frontend (Next.js)

Mở terminal mới:

```bash
cd frontend

# Cài đặt dependency
npm install

# Khởi chạy chế độ phát triển
npm run dev
```

- Web UI & POS: `http://localhost:3000`
- Giao diện POS bán hàng: `http://localhost:3000/pos`
- Quản lý sản phẩm: `http://localhost:3000/products`
- Quản lý lô hàng & nguồn gốc: `http://localhost:3000/inventory/batches`
- Cài đặt & chuyển đổi ngành nghề: `http://localhost:3000/settings`
