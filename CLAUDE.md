# Micro-ERP Architecture & Engineering Rules

## 1. Nguyên Tắc Tái Sử Dụng (Reuse-First Philosophy)
- **Hàm & Component dùng chung**: Tuyệt đối không sao chép - dán (copy-paste) mã nguồn. Bất kỳ logic nghiệp vụ hoặc pattern UI nào lặp lại từ 2 nơi trở lên PHẢI được trích xuất thành hàm tiện ích hoặc component dùng chung.
- **Vị trí Component dùng chung**:
  - `src/components/common/`: Chứa các atomic components và primitives (`Button`, `Input`, `Modal`, `Badge`, `PageHeader`, `EmptyState`, `LoadingState`, `AlertBanner`, `TableToolbar`, `SearchableSelect`, `ImageUploader`, `ConfirmDialog`).
  - `src/components/layout/`: Chứa khung ứng dụng (`Sidebar`, `Header`).
  - `src/components/{domain}/`: Chỉ chứa component phụ thuộc trực tiếp vào domain đó (`pos/`, `inventory/`, `partners/`, `categories/`, `units/`).
- **Single Source of Truth**:
  - Toàn bộ format tiền tệ (`formatVND`), số lượng (`formatQty`), tỷ lệ phần trăm (`formatPercent`) tập trung tại [frontend/src/lib/design-tokens.ts](frontend/src/lib/design-tokens.ts).
  - Toàn bộ helper kiểm tra kiểu sản phẩm (`isWeighableProduct`, `isMatrixProduct`, `isModifierProduct`, `getVariantStock`) tập trung tại [frontend/src/lib/utils.ts](frontend/src/lib/utils.ts).
  - Toàn bộ API client types và methods tập trung tại [frontend/src/lib/api.ts](frontend/src/lib/api.ts).

## 2. Chuẩn Tổ Chức Thư Mục (Directory Structure)
```
magic_store/
├── backend/                  # Golang API & Core Business Engines
│   ├── cmd/server/           # Entry point
│   ├── internal/api/         # HTTP handlers & routes
│   ├── internal/model/       # GORM domain models
│   ├── internal/service/     # Core services (UOM, Ledger WAC, BOM, Storage)
│   └── tests/                # Unit & Integration test suites
├── frontend/                 # Next.js 15 (App Router) + Tailwind CSS + Zustand
│   ├── src/
│   │   ├── app/              # Next.js routes (pages)
│   │   ├── components/
│   │   │   ├── common/       # Reusable UI primitives
│   │   │   ├── layout/       # App layout shell
│   │   │   └── {domain}/     # Domain-specific components
│   │   ├── lib/              # API, state stores, pure utility functions
│   │   └── styles/           # Design tokens, CSS variables, global styles
├── prisma/                   # Database schema & seeders
└── docs/                     # Specifications & implementation plans
```
- **Quy tắc dọn dẹp**: Xóa ngay lập tức mọi file thừa, code thử nghiệm mồ côi (orphaned) không còn tham chiếu hoặc đã bị thay thế bởi backend Go.

## 3. Quy Chuẩn Design Tokens & Triệt Tiêu AI Slop (Impeccable Standard)

### CẤM TUYỆT ĐỐI (Anti-AI Slop Bans)
1. **CẤM Kicker / Eyebrow**: Không đặt nhãn nhỏ phía trên tiêu đề chính (`h1`/`h2`). Tiêu đề phải tự mang ngữ nghĩa rõ ràng.
2. **CẤM Hero-metric ảo**: Không dùng các thẻ số to kèm nhãn trang trí giả tạo không có giá trị tác nghiệp thực tế.
3. **CẤM Card Grid rỗng**: Không chia trang thành các khối thẻ lặp lại cùng kích thước (icon + heading + text ngắn) thay cho nội dung thật.
4. **CẤM Gradient Text**: Không dùng chữ gradient đa sắc. Nhấn mạnh bằng font-weight và tỷ lệ typography scale.
5. **CẤM Glassmorphism vô cớ**: Không lạm dụng hiệu ứng làm mờ nền (`backdrop-blur`) để trang trí.
6. **CẤM Viền màu dày**: Không dùng `border-l-4` hoặc `border-r-4` sặc sỡ trên card, callout, table row.
7. **CẤM Bóng cứng giả cổ**: Không dùng `box-shadow: 4px 4px 0` khi không phải phong cách neobrutalist.
8. **CẤM Monospace làm cảnh**: Chỉ áp dụng font monospace cho mã SKU, barcode, số tiền (`tabular-nums`) và định lượng kỹ thuật.
9. **CẤM Emoji thay icon**: Mọi biểu tượng phải là SVG nhất quán từ thư viện `lucide-react` (stroke 1.5 - 2).

### BẮT BUỘC TUÂN THỦ (Craft Floor)
- **Tương phản (Contrast Ratio)**: Văn bản chính và placeholder đạt tối thiểu 4.5:1 so với nền; tiêu đề lớn tối thiểu 3:1.
- **Bề mặt trình duyệt (Browser Surfaces)**: Tùy biến `::selection`, thanh cuộn (`custom scrollbars`), con trỏ focus (`:focus-visible`) đồng nhất theo token thương hiệu.
- **Số liệu tài chính & kho (Tabular Numerals)**: Mọi ô tiền tệ, số lượng, phần trăm phải có class `tabular-nums` để tránh lệch cột.
- **Mật độ thông tin cao (High Density - Operate Mode)**: Micro-ERP & POS hướng tới hiệu quả thao tác nhanh của thu ngân và quản lý kho.
- **Đầy đủ 4 trạng thái**: Mọi màn hình tải dữ liệu phải xử lý rõ ràng: Loading, Empty, Error, Success Feedback qua các component dùng chung.
