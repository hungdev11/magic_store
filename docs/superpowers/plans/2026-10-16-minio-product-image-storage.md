# MinIO Product & Variant Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Tích hợp dịch vụ lưu trữ đối tượng MinIO cục bộ (qua Docker Compose), cung cấp endpoint ký Presigned PUT URL từ backend Go, cập nhật model `Product` và `ProductVariant` lưu URL ảnh, và xây dựng component Upload ảnh trực tiếp trên giao diện sản phẩm và POS.

**Architecture:**
- **Infrastructure:** MinIO Object Storage container chạy port 9000 (S3 API) và 9001 (Web Console), tự động tạo bucket `products` với chính sách public download.
- **Backend (Go 1.27):** Sử dụng `github.com/minio/minio-go/v7`. Service `StorageService` ký presigned URL trực tiếp (PUT 15 phút) và endpoint `POST /api/upload/presigned-url`. CSDL bổ sung các trường `image_url` và `images`.
- **Frontend (Next.js 15):** Xây dựng component `ImageUploader` dùng chung trong `@/components/common`, tích hợp vào form tạo sản phẩm `/products/new` và hiển thị ảnh thumbnail trên thẻ POS `/pos`.

**Tech Stack:** Go 1.27, GORM, MinIO Go SDK (`minio-go/v7`), Docker Compose, Next.js 15, TypeScript, Tailwind CSS, Lucide React.

## Global Constraints
- **Presigned Direct Upload:** Client upload trực tiếp lên MinIO, Backend Go không buffer file nhị phân vào RAM hay ổ cứng máy chủ.
- **Bảo toàn dữ liệu:** Model `Product` và `ProductVariant` mở rộng trường `image_url` không làm phá vỡ logic tính WAC, UOM hay Transaction ACID hiện có.
- **Anti-AI Slop & Token Rules:** Component `ImageUploader` tuân thủ viền 1px (`border-border-default`), bo góc `rounded-sm`/`rounded-md`, không hiệu ứng blur hay shadow nặng.
- **TDD:** Kiểm thử Backend Go và TypeScript build sạch 100% trước khi hoàn tất mỗi task.

---

### Task 1: Thiết Lập Hạ Tầng MinIO Docker Compose & Go SDK Dependencies

**Files:**
- Create: `docker-compose.yml`
- Modify: `backend/go.mod`
- Modify: `backend/internal/model/product.go`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: MinIO service container trên port 9000 & 9001.
- Produces: Trường `ImageURL` & `Images` trên model `Product`, trường `ImageURL` trên `ProductVariant`.

- [x] **Step 1: Cấu hình `docker-compose.yml`**

Tạo file `docker-compose.yml`:
```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:RELEASE.2024-11-07T00-52-20Z
    container_name: magic_store_minio
    restart: always
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  minio-init:
    image: minio/mc:RELEASE.2024-11-05T11-41-28Z
    container_name: magic_store_minio_init
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 2;
      /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin;
      /usr/bin/mc mb --ignore-existing myminio/products;
      /usr/bin/mc anonymous set download myminio/products;
      exit 0;
      "

volumes:
  minio_data:
```

- [x] **Step 2: Thêm MinIO Go SDK vào `backend/go.mod`**

Chạy lệnh cài đặt SDK:
```bash
cd backend && /usr/local/go/bin/go get github.com/minio/minio-go/v7@v7.0.80
```

- [x] **Step 3: Cập nhật model `Product` và `ProductVariant`**

Trong `backend/internal/model/product.go`:
```go
// Thêm vào struct Product:
ImageURL       string                 `gorm:"size:512" json:"image_url,omitempty"`
Images         string                 `gorm:"type:text;default:'[]'" json:"images,omitempty"`

// Thêm vào struct ProductVariant:
ImageURL       string                 `gorm:"size:512" json:"image_url,omitempty"`
```

Đồng thời cập nhật `prisma/schema.prisma` cho model `Product` (`image_url String?`, `images Json? @default("[]")`) và `ProductVariant` (`image_url String?`).

- [x] **Step 4: Kiểm tra migration và tests hiện tại của Go**

Chạy: `cd backend && /usr/local/go/bin/go test -v ./...`  
Kỳ vọng: PASS (các test model CRUD tự động chạy AutoMigrate thêm cột mới).

- [x] **Step 5: Commit Task 1**

```bash
git add docker-compose.yml backend/go.mod backend/go.sum backend/internal/model/product.go prisma/schema.prisma
git commit -m "feat(infra): add minio docker-compose and extend product models with image fields"
```

---

### Task 2: Xây Dựng MinIO Storage Service & Presigned URL API Endpoint

**Files:**
- Create: `backend/internal/service/storage_service.go`
- Modify: `backend/internal/api/handlers.go`
- Modify: `backend/internal/api/routes.go`
- Create: `backend/tests/storage_api_test.go`

**Interfaces:**
- Produces: `StorageService` với phương thức `GetPresignedUploadURL(ctx, filename, contentType)`
- Produces: Endpoint `POST /api/upload/presigned-url` trả về `upload_url`, `file_url`, `object_name`.

- [x] **Step 1: Viết test failing cho Presigned URL Endpoint**

Tạo `backend/tests/storage_api_test.go`:
```go
package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStorageAPI_PresignedUploadURL(t *testing.T) {
	server, _ := setupTestServerWithDB(t)

	// 1. Invalid content type -> Expect 400 Bad Request
	badPayload := map[string]string{
		"filename":     "virus.exe",
		"content_type": "application/x-msdownload",
	}
	body, _ := json.Marshal(badPayload)
	req := httptest.NewRequest("POST", "/api/upload/presigned-url", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid content type, got %d", w.Code)
	}

	// 2. Valid image -> Expect 200 OK with upload_url and file_url
	validPayload := map[string]string{
		"filename":     "ao-so-mi-trang.jpg",
		"content_type": "image/jpeg",
	}
	body, _ = json.Marshal(validPayload)
	req = httptest.NewRequest("POST", "/api/upload/presigned-url", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	server.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	json.NewDecoder(w.Body).Decode(&res)
	if res["upload_url"] == "" || res["file_url"] == "" {
		t.Fatalf("expected non-empty upload_url and file_url, got %+v", res)
	}
}
```

- [x] **Step 2: Chạy test để xác nhận FAIL**

Chạy: `cd backend && /usr/local/go/bin/go test -v -run TestStorageAPI_PresignedUploadURL ./tests`  
Kỳ vọng: FAIL (endpoint chưa được cấu hình).

- [x] **Step 3: Cài đặt `StorageService` trong `backend/internal/service/storage_service.go`**

```go
package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var (
	ErrInvalidContentType = errors.New("chỉ hỗ trợ định dạng ảnh (.jpg, .jpeg, .png, .webp, .gif)")
	ErrMissingFilename    = errors.New("tên file không được để trống")
)

type StorageConfig struct {
	Endpoint   string
	AccessKey  string
	SecretKey  string
	BucketName string
	UseSSL     bool
	PublicURL  string
}

type StorageService struct {
	client     *minio.Client
	bucketName string
	publicURL  string
}

type PresignedURLResponse struct {
	UploadURL  string `json:"upload_url"`
	FileURL    string `json:"file_url"`
	ObjectName string `json:"object_name"`
}

func NewStorageService(cfg StorageConfig) (*StorageService, error) {
	if cfg.Endpoint == "" {
		cfg.Endpoint = "localhost:9000"
	}
	if cfg.BucketName == "" {
		cfg.BucketName = "products"
	}
	if cfg.PublicURL == "" {
		cfg.PublicURL = fmt.Sprintf("http://%s", cfg.Endpoint)
	}

	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("không thể khởi tạo MinIO client: %w", err)
	}

	svc := &StorageService{
		client:     client,
		bucketName: cfg.BucketName,
		publicURL:  strings.TrimRight(cfg.PublicURL, "/"),
	}

	return svc, nil
}

func (s *StorageService) GetPresignedUploadURL(ctx context.Context, filename, contentType string) (*PresignedURLResponse, error) {
	if strings.TrimSpace(filename) == "" {
		return nil, ErrMissingFilename
	}

	validTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}
	if !validTypes[contentType] {
		return nil, ErrInvalidContentType
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".jpg"
	}

	objectName := fmt.Sprintf("%s-%s%s", time.Now().Format("20060102"), uuid.New().String()[:8], ext)

	// Presigned URL for PUT with 15 mins expiry
	expiry := 15 * time.Minute
	presignedURL, err := s.client.PresignedPutObject(ctx, s.bucketName, objectName, expiry)
	if err != nil {
		return nil, fmt.Errorf("lỗi tạo presigned URL: %w", err)
	}

	fileURL := fmt.Sprintf("%s/%s/%s", s.publicURL, s.bucketName, objectName)

	return &PresignedURLResponse{
		UploadURL:  presignedURL.String(),
		FileURL:    fileURL,
		ObjectName: objectName,
	}, nil
}
```

- [x] **Step 4: Thêm API Handler & Route trong Backend**

1. Trong `backend/internal/api/routes.go`: Thêm `mux.HandleFunc("POST /api/upload/presigned-url", s.handleGetPresignedUploadURL)`.
2. Trong `backend/internal/api/handlers.go`:
```go
type PresignedUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
}

func (s *Server) handleGetPresignedUploadURL(w http.ResponseWriter, r *http.Request) {
	var req PresignedUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON không hợp lệ"})
		return
	}

	res, err := s.storageService.GetPresignedUploadURL(r.Context(), req.Filename, req.ContentType)
	if err != nil {
		if errors.Is(err, service.ErrInvalidContentType) || errors.Is(err, service.ErrMissingFilename) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, res)
}
```
3. Cập nhật `setupTestServerWithDB` để tích hợp `storageService`.

- [x] **Step 5: Chạy test để xác nhận PASS**

Chạy: `cd backend && /usr/local/go/bin/go test -v -run TestStorageAPI_PresignedUploadURL ./tests`  
Kỳ vọng: PASS.

- [x] **Step 6: Commit Task 2**

```bash
git add backend/internal/service/storage_service.go backend/internal/api/ backend/tests/storage_api_test.go
git commit -m "feat(backend): implement storage service and presigned upload url endpoint"
```

---

### Task 3: Xây Dựng Component `ImageUploader` Trên Frontend & API Client

**Files:**
- Create: `frontend/src/components/common/ImageUploader.tsx`
- Modify: `frontend/src/components/common/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `api.getPresignedUploadUrl(filename, contentType)`
- Produces: `api.uploadFileToMinIO(uploadUrl, file)`
- Produces: `ImageUploader` component (`value`, `onChange`, `onRemove`, `label`)

- [x] **Step 1: Mở rộng `frontend/src/lib/api.ts`**

Thêm các phương thức gọi API upload:
```typescript
export interface PresignedUploadResponse {
  upload_url: string;
  file_url: string;
  object_name: string;
}

// Trong object api:
async getPresignedUploadUrl(filename: string, contentType: string): Promise<PresignedUploadResponse> {
  const res = await fetch(`${API_BASE_URL}/upload/presigned-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Không thể lấy link tải ảnh");
  }
  return res.json();
},

async uploadToMinIO(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Tải ảnh lên MinIO thất bại");
  }
},
```

- [x] **Step 2: Tạo component `frontend/src/components/common/ImageUploader.tsx`**

```tsx
"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";

export interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  onRemove,
  label = "Ảnh sản phẩm",
  className = "",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file hình ảnh hợp lệ (.jpg, .png, .webp)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh tối đa là 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const presigned = await api.getPresignedUploadUrl(file.name, file.type);
      await api.uploadToMinIO(presigned.upload_url, file);
      onChange(presigned.file_url);
    } catch (err: any) {
      setError(err?.message || "Lỗi tải ảnh lên");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-text-sub block">{label}</label>}

      <div className="relative">
        {value ? (
          <div className="relative w-32 h-32 rounded-sm border border-border-default overflow-hidden group bg-surface-muted flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (onRemove) onRemove();
                else onChange("");
              }}
              className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
              title="Xóa ảnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 rounded-sm border border-dashed border-border-default hover:border-brand bg-surface-app hover:bg-surface-muted/50 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors p-2 text-center"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
                <span className="text-[11px] text-text-sub font-medium">Đang tải...</span>
              </>
            ) : (
              <>
                <div className="p-2 rounded-sm bg-surface-muted text-text-sub">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-text-sub font-medium">Chọn hoặc kéo ảnh</span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-outflow">{error}</p>}
    </div>
  );
};
```

- [x] **Step 3: Export `ImageUploader` trong `frontend/src/components/common/index.ts`**

- [x] **Step 4: Kiểm tra biên dịch TypeScript**

Chạy: `cd frontend && rtk tsc --noEmit`  
Kỳ vọng: Không có lỗi.

- [x] **Step 5: Commit Task 3**

```bash
git add frontend/src/lib/api.ts frontend/src/components/common/ImageUploader.tsx frontend/src/components/common/index.ts
git commit -m "feat(frontend): implement ImageUploader component with direct minio presigned upload"
```

---

### Task 4: Tích Hợp Ảnh Vào Màn Hình Quản Lý Sản Phẩm & POS Product Grid

**Files:**
- Modify: `frontend/src/app/products/new/page.tsx`
- Modify: `frontend/src/components/pos/PosProductGrid.tsx`
- Modify: `frontend/src/components/pos/modals/PosMatrixModal.tsx`

**Interfaces:**
- Consumes: `ImageUploader`
- Produces: Form tạo sản phẩm cho phép upload ảnh và POS hiển thị thumbnail ảnh thật khi có.

- [x] **Step 1: Tích hợp `ImageUploader` vào form `/products/new`**

Thêm trường `imageUrl` vào state form `ProductForm`.
Khi cấu hình biến thể (Matrix / Standard), cho phép gán `image_url` cho biến thể.

- [x] **Step 2: Cập nhật `PosProductGrid.tsx` hiển thị ảnh sản phẩm**

Trong thẻ sản phẩm (`ProductCard`):
- Nếu `product.image_url` tồn tại, render thẻ `<img>` với `object-cover`.
- Nếu không có ảnh, fallback về icon đặc trưng ngành (Scale / Layers / Utensils).

- [x] **Step 3: Cập nhật `PosMatrixModal.tsx` hiển thị ảnh của biến thể**

Khi người dùng chọn thuộc tính (Color/Size), nếu biến thể tương ứng có `image_url`, hiển thị ảnh biến thể trong khung preview.

- [x] **Step 4: Kiểm tra toàn diện Backend Tests & Next.js Build**

Chạy:
1. `cd backend && /usr/local/go/bin/go test -v ./...`
2. `cd frontend && rtk tsc --noEmit`
3. `cd frontend && npx next build`
Kỳ vọng: 100% PASS không có lỗi.

- [x] **Step 5: Commit Task 4**

```bash
git add frontend/src/app/products/new/page.tsx frontend/src/components/pos/
git commit -m "feat(pos): display product and variant images in pos grid and product creation form"
```
