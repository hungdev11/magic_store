// Typed API client for Magic Store Micro-ERP backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export interface StoreSetting {
  id: string;
  name: string;
  currency: string;
  costing_method: string;
  enabled_modules: string | Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateSettingsInput {
  name?: string;
  currency?: string;
  costing_method?: string;
  enabled_modules?: string | Record<string, boolean>;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  code?: string;
  is_active?: boolean;
  parent_id?: string | null;
  parent?: Category;
  children?: Category[];
}

export type WarehouseType = "STORAGE" | "RETAIL_POS" | "KITCHEN_WIP" | "VIRTUAL_TRANSIT";

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type?: WarehouseType;
  allow_negative_stock?: boolean;
  address?: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
}

export interface WarehouseStockBalance {
  id: string;
  warehouse_id: string;
  variant_id: string;
  on_hand_base_qty: number | string;
  reserved_base_qty: number | string;
  locked_base_qty: number | string;
  in_transit_base_qty: number | string;
  on_hand_secondary_qty?: number | string | null;
  reserved_secondary_qty?: number | string | null;
  warehouse_wac_cost?: number | string;
  version?: number;
}

export interface VariantWarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  stock: number | string;
  on_hand?: number | string;
  reserved?: number | string;
  locked?: number | string;
  in_transit?: number | string;
  available?: number | string;
  secondary_qty?: number | string | null;
}

export interface VariantStockReport {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  base_uom: string;
  total_stock: number | string;
  total_on_hand?: number | string;
  total_reserved?: number | string;
  total_available?: number | string;
  by_warehouse: VariantWarehouseStock[];
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  variant_id: string;
  variant?: ProductVariant;
  batch_id?: string;
  batch?: BatchItem;
  qty: number | string;
  uom: string;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  from_warehouse?: Warehouse;
  to_warehouse_id: string;
  to_warehouse?: Warehouse;
  status: "DRAFT" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  notes?: string;
  items?: StockTransferItem[];
  created_at: string;
}

export interface CreateTransferInput {
  from_warehouse_id: string;
  to_warehouse_id: string;
  notes?: string;
  items: {
    variant_id: string;
    batch_id?: string;
    qty: number;
    uom: string;
  }[];
}

export type ProductArchetype = "STANDARD" | "MATRIX" | "CATCH_WEIGHT" | "MANUFACTURED" | "COMBO";

export interface UomConversion {
  id?: string;
  variant_id?: string;
  uom_name: string;
  conversion_factor: number | string;
  is_variable_ratio: boolean;
  default_price_for_uom?: number | string | null;
  barcode?: string;
  selling_price?: number | string | null;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  product?: Product;
  sku: string;
  barcode?: string;
  variant_name?: string;
  attributes?: Record<string, string> | string;
  cost_price: number | string;
  base_selling_price: number | string;
  min_selling_price: number | string;
  current_stock?: number | string;
  current_inventory?: number | string;
  min_stock_alert?: number | string;
  image_url?: string;
  shelf_life_days?: number | null;
  expiry_warning_days?: number | null;
  uom_conversions?: UomConversion[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category_id?: string;
  category?: Category;
  product_type: string;
  archetype?: ProductArchetype;
  base_uom: string;
  is_weighable: boolean;
  track_inventory: boolean;
  track_batches: boolean;
  shelf_life_days?: number | null;
  expiry_warning_days?: number | null;
  production_mode: string;
  image_url?: string;
  images?: string | string[];
  variants?: ProductVariant[];
  modifier_groups?: {
    id: string;
    product_id: string;
    modifier_group_id: string;
    modifier_group?: ModifierGroup;
    display_order?: number;
  }[];
}

export interface CreateProductInput {
  name: string;
  code: string;
  category_id?: string;
  product_type?: string;
  archetype?: ProductArchetype;
  base_uom: string;
  is_weighable?: boolean;
  track_inventory?: boolean;
  track_batches?: boolean;
  shelf_life_days?: number | null;
  expiry_warning_days?: number | null;
  production_mode?: string;
  image_url?: string;
  images?: string | string[];
  cost_price?: number;
  base_selling_price?: number;
  min_selling_price?: number;
  matrix_attributes?: Record<string, string[]>;
  uom_conversions?: {
    uom_name: string;
    conversion_factor: number;
    is_variable_ratio: boolean;
    default_price_for_uom?: number;
    barcode?: string;
    selling_price?: number;
  }[];
  variants?: Partial<ProductVariant>[];
  modifier_group_ids?: string[];
}

export interface ModifierItem {
  id?: string;
  modifier_group_id?: string;
  name: string;
  price: number | string;
  linked_variant_id?: string;
  linked_variant?: ProductVariant;
  deduct_qty?: number | string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection?: number | null;
  is_required: boolean;
  items?: ModifierItem[];
}

export interface CreateModifierGroupInput {
  name: string;
  min_selection?: number;
  max_selection?: number | null;
  is_required?: boolean;
  items: {
    name: string;
    price: number;
    linked_variant_id?: string;
    deduct_qty?: number;
  }[];
}

export interface DebtPartnerItem {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  partner_type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  current_debt_balance: number | string;
  credit_limit: number | string;
  recent_ledger_count: number;
  last_transaction_at?: string;
}

export interface DebtLedgerEntry {
  id: string;
  partner_id: string;
  partner?: Partner;
  transaction_type: string;
  reference_id?: string;
  amount: number | string;
  balance_after: number | string;
  note?: string;
  created_at: string;
}

export interface RecordDebtPaymentInput {
  partner_id: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  note?: string;
  reference_id?: string;
}

export interface CashbookTransaction {
  id: string;
  transaction_type: "INFLOW" | "OUTFLOW";
  category: string;
  amount: number | string;
  payment_method: "CASH" | "BANK_TRANSFER";
  partner_id?: string;
  partner?: Partner;
  sales_order_id?: string;
  pos_session_id?: string;
  description: string;
  created_at: string;
}

export interface CreateCashbookInput {
  transaction_type: "INFLOW" | "OUTFLOW";
  category: string;
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  partner_id?: string;
  description: string;
}

export interface CashbookSummary {
  total_inflow: number | string;
  total_outflow: number | string;
  net_balance: number | string;
  cash_inflow: number | string;
  cash_outflow: number | string;
  cash_balance: number | string;
  bank_inflow: number | string;
  bank_outflow: number | string;
  bank_balance: number | string;
}

export interface PnLDayStat {
  date: string;
  revenue: number | string;
  cogs: number | string;
  gross_profit: number | string;
  wastage_loss: number | string;
  operating_exp: number | string;
  net_profit: number | string;
}

export interface PnLReportResponse {
  from_date: string;
  to_date: string;
  total_revenue: number | string;
  total_cogs: number | string;
  gross_profit: number | string;
  gross_margin_percent: number | string;
  total_wastage_loss: number | string;
  total_operating_exp: number | string;
  net_profit: number | string;
  net_margin_percent: number | string;
  expenses_by_category: Record<string, number | string>;
  daily_breakdown: PnLDayStat[];
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  partner_type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  current_debt?: number | string;
  current_debt_balance?: number | string;
  price_tier?: string;
  credit_limit?: number | string;
  is_active?: boolean;
}

export interface BatchItem {
  id: string;
  variant_id: string;
  variant?: ProductVariant;
  batch_code: string;
  supplier_id?: string;
  supplier?: Partner;
  received_date: string;
  expiry_date?: string;
  initial_qty: number | string;
  remaining_qty: number | string;
  unit_cost: number | string;
  notes?: string;
}

export interface InventoryMovementItem {
  id: string;
  variant_id: string;
  batch_id?: string;
  movement_type: string;
  qty_in_base_uom: number | string;
  input_uom: string;
  input_qty: number | string;
  unit_cost_at_time: number | string;
  reference_id?: string;
  reason_note?: string;
  created_at: string;
}

export interface PurchaseItem {
  variant_id: string;
  qty: number;
  unit_cost: number;
  uom: string;
  batch_code?: string;
  expiry_date?: string;
}

export interface PurchaseInput {
  supplier_id?: string;
  warehouse_id?: string;
  reference_id?: string;
  notes?: string;
  payment_method?: string;
  amount_paid?: number;
  items: PurchaseItem[];
}

export interface ReceiptLineItem {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  base_uom: string;
  input_uom: string;
  input_qty: number | string;
  qty_in_base_uom: number | string;
  unit_cost_at_time: number | string;
  line_total: number | string;
  batch_code?: string;
  expiry_date?: string;
}

export interface InventoryReceipt {
  reference_id: string;
  movement_type: "PURCHASE_IN" | "WASTAGE_SPOILAGE" | string;
  created_at: string;
  item_count: number;
  total_qty: number | string;
  total_amount: number | string;
  partner_id?: string;
  partner_name?: string;
  notes?: string;
  items?: ReceiptLineItem[];
}

export interface WastageInput {
  variant_id: string;
  warehouse_id?: string;
  batch_id?: string;
  lost_qty: number;
  input_uom: string;
  reason_note: string;
  record_to_cashbook: boolean;
  reference_id?: string;
}

export interface BomItem {
  id?: string;
  recipe_id?: string;
  component_variant_id: string;
  component_variant?: ProductVariant;
  qty_required: number | string;
  cost_allocation_percent: number | string;
}

export interface BomRecipe {
  id: string;
  target_variant_id: string;
  target_variant?: ProductVariant;
  recipe_type: "ASSEMBLY" | "DISASSEMBLY";
  output_qty: number | string;
  expected_wastage_percent: number | string;
  estimated_unit_cost?: number;
  items: BomItem[];
}

export interface CreateBomRecipeInput {
  target_variant_id: string;
  recipe_type: "ASSEMBLY" | "DISASSEMBLY";
  output_qty: number;
  expected_wastage_percent: number;
  items: {
    component_variant_id: string;
    qty_required: number;
    cost_allocation_percent: number;
  }[];
}

export interface AssemblyInput {
  recipe_id: string;
  target_output_qty: number;
  batch_code?: string;
  other_cost?: number;
  expiry_date?: string;
  supplier_id?: string;
  notes?: string;
}

export interface DisassemblyYieldOutput {
  component_variant_id: string;
  actual_qty: number;
  batch_code?: string;
  expiry_date?: string;
}

export interface DisassemblyInput {
  recipe_id: string;
  input_qty: number;
  yield_outputs: DisassemblyYieldOutput[];
  batch_code?: string;
  other_cost?: number;
  notes?: string;
}

export interface PosCheckoutModifier {
  name: string;
  price: number;
  linked_variant_id?: string;
  deduct_qty?: number;
}

export interface PosCheckoutItemPayload {
  variant_id: string;
  sold_uom: string;
  sold_qty: number;
  actual_base_qty_deducted: number;
  original_unit_price?: number;
  actual_unit_price: number;
  line_total: number;
  is_return: boolean;
  modifiers?: PosCheckoutModifier[];
  modifiers_json?: string;
  batch_id?: string;
}

export interface PosCheckoutPayload {
  pos_session_id?: string;
  customer_id?: string;
  warehouse_id?: string;
  items: PosCheckoutItemPayload[];
  subtotal: number;
  discount_amount: number;
  surcharge_amount: number;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  payment_method: "CASH" | "BANK_QR" | "MIXED" | "CREDIT";
  notes?: string;
}

export interface PosCheckoutResponseItem {
  id: string;
  order_id: string;
  variant_id: string;
  variant?: ProductVariant;
  batch_id?: string;
  sold_uom: string;
  sold_qty: number | string;
  actual_base_qty_deducted: number | string;
  original_unit_price?: number | string;
  actual_unit_price: number | string;
  line_total: number | string;
  modifiers_json?: string;
  line_cogs?: number | string;
  is_return: boolean;
}

export interface PosCheckoutResponse {
  id: string;
  order_number: string;
  customer_id?: string;
  customer?: Partner;
  pos_session_id?: string;
  status: string;
  subtotal: number | string;
  discount_amount: number | string;
  surcharge_amount: number | string;
  total_amount: number | string;
  paid_amount: number | string;
  debt_amount: number | string;
  total_cogs?: number | string;
  payment_method: string;
  items?: PosCheckoutResponseItem[];
  created_at: string;
  updated_at?: string;
  offline?: boolean;
}

export interface PresignedUploadResponse {
  upload_url: string;
  file_url: string;
  object_name: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // no JSON body
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Store Settings
  getSettings: () => request<StoreSetting>("/settings"),
  updateSettings: (data: UpdateSettingsInput) =>
    request<StoreSetting>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  applyPreset: (preset: "SEAFOOD" | "APPAREL" | "FOOD") =>
    request<StoreSetting>("/settings/preset", {
      method: "POST",
      body: JSON.stringify({ preset }),
    }),

  // Warehouses & Locations
  getWarehouses: (activeOnly?: boolean) => {
    const query = activeOnly ? "?active_only=true" : "";
    return request<Warehouse[]>(`/warehouses${query}`);
  },
  createWarehouse: (data: Partial<Warehouse>) =>
    request<Warehouse>("/warehouses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWarehouse: (id: string, data: Partial<Warehouse>) =>
    request<Warehouse>(`/warehouses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteWarehouse: (id: string) =>
    request<{ message: string }>(`/warehouses/${id}`, {
      method: "DELETE",
    }),

  // Warehouse Stock & Transfers
  getWarehouseStock: () => request<VariantStockReport[]>("/inventory/stock"),
  getTransfers: () => request<StockTransfer[]>("/inventory/transfers"),
  createTransfer: (data: CreateTransferInput) =>
    request<StockTransfer>("/inventory/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  dispatchTransfer: (id: string) =>
    request<StockTransfer>(`/inventory/transfers/${id}/dispatch`, {
      method: "POST",
    }),
  receiveTransfer: (id: string, receivedQtys?: Record<string, number | string>) =>
    request<StockTransfer>(`/inventory/transfers/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({ received_qtys: receivedQtys }),
    }),
  completeTransfer: (id: string) =>
    request<StockTransfer>(`/inventory/transfers/${id}/complete`, {
      method: "POST",
    }),

  // Units
  getUnits: (activeOnly?: boolean) => {
    const query = activeOnly ? "?active_only=true" : "";
    return request<Unit[]>(`/units${query}`);
  },
  createUnit: (data: Partial<Unit> | { code?: string; name: string; description?: string; is_active?: boolean }) =>
    request<Unit>("/units", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUnit: (id: string, data: Partial<Unit>) =>
    request<Unit>(`/units/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteUnit: (id: string) =>
    request<{ message: string }>(`/units/${id}`, {
      method: "DELETE",
    }),

  // Categories & Products
  getCategories: () => request<Category[]>("/categories"),
  createCategory: (data: { name: string; code?: string; is_active?: boolean; parent_id?: string | null }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<Category>) =>
    request<Category>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: "DELETE",
    }),
  getProducts: () => request<Product[]>("/products"),
  getProductDetail: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (data: CreateProductInput) =>
    request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: Partial<CreateProductInput>) =>
    request<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<{ message: string }>(`/products/${id}`, {
      method: "DELETE",
    }),

  // F&B Modifiers & Options
  getModifierGroups: () => request<ModifierGroup[]>("/modifiers"),
  createModifierGroup: (data: CreateModifierGroupInput) =>
    request<ModifierGroup>("/modifiers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateModifierGroup: (id: string, data: CreateModifierGroupInput) =>
    request<ModifierGroup>(`/modifiers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteModifierGroup: (id: string) =>
    request<{ message: string }>(`/modifiers/${id}`, {
      method: "DELETE",
    }),
  getProductModifiers: (id: string) =>
    request<ModifierGroup[]>(`/products/${id}/modifiers`),
  setProductModifiers: (id: string, modifierGroupIds: string[]) =>
    request<{ message: string }>(`/products/${id}/modifiers`, {
      method: "POST",
      body: JSON.stringify({ modifier_group_ids: modifierGroupIds }),
    }),

  // Partners
  getPartners: (type?: "CUSTOMER" | "SUPPLIER" | "BOTH") => {
    const query = type ? `?type=${type}` : "";
    return request<Partner[]>(`/partners${query}`);
  },
  createPartner: (data: Partial<Partner>) =>
    request<Partner>("/partners", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePartner: (id: string, data: Partial<Partner>) =>
    request<Partner>(`/partners/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePartner: (id: string) =>
    request<{ message: string }>(`/partners/${id}`, {
      method: "DELETE",
    }),

  // Batches & Traceability
  getBatches: (params?: { q?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.append("q", params.q);
    if (params?.status) sp.append("status", params.status);
    const qs = sp.toString();
    return request<BatchItem[]>(`/batches${qs ? `?${qs}` : ""}`);
  },
  getBatchTrace: (id: string) =>
    request<InventoryMovementItem[]>(`/batches/${id}/trace`),
  updateBatch: (id: string, data: Partial<BatchItem> | { notes?: string; expiry_date?: string | null }) =>
    request<BatchItem>(`/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Inventory & Receipts
  getReceipts: (params?: { type?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.append("type", params.type);
    if (params?.q) sp.append("q", params.q);
    const qs = sp.toString();
    return request<InventoryReceipt[]>(`/inventory/receipts${qs ? `?${qs}` : ""}`);
  },
  getReceiptDetail: (id: string) =>
    request<InventoryReceipt>(`/inventory/receipts/${encodeURIComponent(id)}`),
  createPurchase: (data: PurchaseInput) =>
    request<{ message: string }>("/inventory/purchase", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  purchaseStock: (data: PurchaseInput) =>
    request<{ message: string }>("/inventory/purchase", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordWastage: (data: WastageInput) =>
    request<{ movement: any; cashbook_transaction?: any }>("/inventory/wastage", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // BOM & Production
  getBomRecipes: () => request<BomRecipe[]>("/bom/recipes"),
  getRecipes: () => request<BomRecipe[]>("/bom/recipes"),
  createBomRecipe: (data: CreateBomRecipeInput) =>
    request<BomRecipe>("/bom/recipes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  syncBomRecipeCost: (id: string) =>
    request<{ recipe_id: string; target_variant_id: string; estimated_unit_cost: number }>(`/bom/recipes/${id}/sync-cost`, {
      method: "POST",
    }),
  executeAssembly: (data: AssemblyInput) =>
    request<any>("/production/assembly", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  executeDisassembly: (data: DisassemblyInput) =>
    request<any>("/production/disassembly", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // POS Terminal
  checkoutOrder: (payload: PosCheckoutPayload) =>
    request<PosCheckoutResponse>("/pos/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Phase 5: CRM, Sổ Nợ & Quản lý Công nợ
  getDebts: (params?: { type?: string; only_debt?: boolean; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.append("type", params.type);
    if (params?.only_debt) sp.append("only_debt", "true");
    if (params?.q) sp.append("q", params.q);
    const qs = sp.toString();
    return request<DebtPartnerItem[]>(`/debts${qs ? `?${qs}` : ""}`);
  },
  recordDebtPayment: (data: RecordDebtPaymentInput) =>
    request<{
      partner_id: string;
      partner_name: string;
      amount_paid: number;
      new_debt_balance: number;
      debt_entry: DebtLedgerEntry;
      cashbook_transaction: CashbookTransaction;
    }>("/debts/payment", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPartnerDebtHistory: (partnerId: string) =>
    request<DebtLedgerEntry[]>(`/debts/${partnerId}/history`),

  // Phase 5: Sổ Quỹ Thu / Chi (Cashbook)
  getCashbook: (params?: {
    type?: string;
    category?: string;
    payment_method?: string;
    from?: string;
    to?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.append("type", params.type);
    if (params?.category) sp.append("category", params.category);
    if (params?.payment_method) sp.append("payment_method", params.payment_method);
    if (params?.from) sp.append("from", params.from);
    if (params?.to) sp.append("to", params.to);
    const qs = sp.toString();
    return request<CashbookTransaction[]>(`/cashbook${qs ? `?${qs}` : ""}`);
  },
  createCashbook: (data: CreateCashbookInput) =>
    request<CashbookTransaction>("/cashbook", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCashbookSummary: () => request<CashbookSummary>("/cashbook/summary"),

  // Phase 5: Báo Cáo Tài Chính Lãi / Lỗ Thực Tế (P&L)
  getPnLReport: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.append("from", params.from);
    if (params?.to) sp.append("to", params.to);
    const qs = sp.toString();
    return request<PnLReportResponse>(`/reports/pnl${qs ? `?${qs}` : ""}`);
  },

  // Direct File Upload & Storage Fallback
  uploadFile: async (file: File): Promise<{ file_url: string; filename: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      let errText = "Lỗi khi tải ảnh lên máy chủ";
      try {
        const errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch {}
      throw new Error(errText);
    }
    const data = await res.json();
    // Return relative or full URL based on server
    const fullUrl = data.file_url.startsWith("http")
      ? data.file_url
      : `${API_BASE.replace("/api", "")}${data.file_url}`;
    return { file_url: fullUrl, filename: data.filename || file.name };
  },

  // Image Upload & MinIO Storage
  getPresignedUploadUrl: (filename: string, contentType: string) =>
    request<PresignedUploadResponse>("/upload/presigned-url", {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType }),
    }),
  uploadToMinIO: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error("Tải ảnh lên MinIO thất bại");
    }
  },
};
