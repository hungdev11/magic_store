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

## 4. Đặc Tả Đa Kho, Đơn Vị Kép & Xử Lý Đơn Hàng Đồng Thời (Multi-Warehouse, Dual-UOM & Concurrent Order Engine)

### 4.1. Cấu Trúc Bảng Đa Kho & 4 Trạng Thái Tồn Kho (Warehouse Stock Balances)
Không lưu tồn kho trực tiếp trên bảng `product_variants`. Dùng bảng `warehouse_stock_balances` với composite key `[warehouse_id, variant_id]`, hỗ trợ song song Base UOM (gram, cái, ml) và Secondary Catch-Weight UOM (con cá, khay, bao):
- `warehouses`:
  - `id`, `code`, `name` (ví dụ: "Kho Đông Lạnh Tổng", "Quầy Bán Lẻ Chợ", "Bếp Chế Biến", "Cửa Hàng Quận 1"), `type` (`STORAGE`, `RETAIL_POS`, `KITCHEN_WIP`, `VIRTUAL_TRANSIT`), `allow_negative_stock` (boolean).
- `warehouse_stock_balances` (`[warehouse_id, variant_id]`):
  - `on_hand_base_qty` (`DECIMAL(15,4)`): Tồn kho vật lý thực tế trên kệ theo Base UOM.
  - `reserved_base_qty` (`DECIMAL(15,4)`): Tồn kho giữ chỗ cho các đơn hàng chưa hoàn tất.
  - `locked_base_qty` (`DECIMAL(15,4)`): Tồn kho phong tỏa / hỏng / hết hạn chờ tiêu hủy.
  - `in_transit_base_qty` (`DECIMAL(15,4)`): Hàng đang chuyển từ kho khác tới chưa ký nhận.
  - `on_hand_secondary_qty` (`DECIMAL(15,2)`, nullable): Số đếm vật lý mặt hàng trọng lượng động (ví dụ: `18 con cá`).
  - `reserved_secondary_qty` (`DECIMAL(15,2)`, nullable): Số đếm giữ chỗ cho hàng trọng lượng động.
  - `warehouse_wac_cost` (`DECIMAL(15,4)`): Giá vốn bình quân gia quyền tại kho (hoặc global WAC).
  - `version` (`INT`): Optimistic concurrency control counter.
- **Công thức bán được (Available to Promise):**
  $$Q_{\text{available}} = Q_{\text{on\_hand\_base}} - Q_{\text{reserved\_base}} - Q_{\text{locked\_base}}$$

### 4.2. Quy Tắc Đơn Vị Tính & Trọng Lượng Động (Multi-UOM & Catch-Weight)
1. **Lưu trữ đơn vị nguyên tử (Atomic Base Unit):** Mọi đại lượng tuyến tính lưu bằng đơn vị nhỏ nhất không thể chia tách (`g`, `ml`, `pc`) hoặc số thập phân chuẩn (`DECIMAL(15,4)`).
2. **Hàm giải rã đa đơn vị đọc được (`formatMultiUomStock`):**
   - Với `baseQty = 53` và phân cấp UOM `[{name: 'Thùng', factor: 24}, {name: 'Lốc', factor: 6}, {name: 'Lon', factor: 1}]`, hiển thị cả tổng gốc (`53 Lon`) và phân rã vật lý (`2 Thùng, 5 Lon lẻ`).
3. **Quy tắc Auto-Zeroing hao hụt tự nhiên (Thịt/Cá tươi sống):**
   - Khi bán hết con cuối cùng (`on_hand_secondary_qty` từ `1 Con` về `0 Con`), nếu `on_hand_base_qty` còn số dư nhỏ (ví dụ `0.35 kg` do mất nước / sai số cân), hệ thống tự động kết chuyển phần dư thành bút toán hao hụt `NATURAL_SHRINKAGE`, đưa cả 2 số tồn về `0`.

### 4.3. Máy Trạng Thái Giữ Hàng & Xuất Hàng Đồng Thời (Concurrency Engine)
Hỗ trợ 2 luồng bán song song trên cùng một kho:
- **Luồng A: Bán trực tiếp tại POS (`IMMEDIATE_SALE`):**
  - Update nguyên tử có điều kiện (Atomic conditional update):
    ```sql
    UPDATE warehouse_stock_balances
    SET on_hand_base_qty = on_hand_base_qty - :sold_qty,
        version = version + 1,
        updated_at = NOW()
    WHERE warehouse_id = :warehouse_id AND variant_id = :variant_id
      AND (on_hand_base_qty - reserved_base_qty - locked_base_qty) >= :sold_qty;
    ```
- **Luồng B: Đơn đa kênh / Giao hàng / Bếp (`RESERVE_THEN_FULFILL`):**
  - **Bước 1 (`RESERVE`):** Chốt đơn $\rightarrow$ tăng `reserved_base_qty` theo `estimated_base_qty`. Không trừ `on_hand_base_qty`.
  - **Bước 2 (`PICK_AND_WEIGH`):** Nhân viên kho nhặt hàng hoặc cân thực tế $\rightarrow$ xác định `actual_fulfilled_base_qty`.
  - **Bước 3 (`SHIP_COMMIT`):** Transaction nguyên tử:
    - Trừ `reserved_base_qty` theo `estimated_base_qty`.
    - Trừ `on_hand_base_qty` theo `actual_fulfilled_base_qty`.
    - Ghi nhận `SALE_OUT` vào `inventory_movements` theo `actual_fulfilled_base_qty`.
  - **Bước 4 (`CANCEL_RELEASE`):** Hủy đơn trước khi xuất $\rightarrow$ trừ `reserved_base_qty` giải phóng tồn kho.

### 4.4. Quy Trình Chuyển Kho 2 Pha (`stock_transfers`)
- **Bước 1 (`DISPATCH` từ Kho A):** Trừ `A.on_hand_base_qty` đi `sent_qty`; cộng `B.in_transit_base_qty` thêm `sent_qty`.
- **Bước 2 (`RECEIVE` tại Kho B):** Nhập `actual_received_qty`. Trừ `B.in_transit_base_qty` đi `sent_qty`; cộng `B.on_hand_base_qty` thêm `actual_received_qty`. Nếu `actual_received_qty < sent_qty`, ghi nhận chênh lệch vào sổ cái dạng `TRANSIT_WASTAGE`.

