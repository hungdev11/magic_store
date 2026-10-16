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
}

export interface UomConversion {
  id?: string;
  variant_id?: string;
  uom_name: string;
  conversion_factor: number | string;
  is_variable_ratio: boolean;
  default_price_for_uom?: number | string | null;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
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
  uom_conversions?: UomConversion[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category_id?: string;
  category?: Category;
  product_type: string;
  base_uom: string;
  is_weighable: boolean;
  track_inventory: boolean;
  track_batches: boolean;
  production_mode: string;
  variants?: ProductVariant[];
}

export interface CreateProductInput {
  name: string;
  code: string;
  category_id?: string;
  product_type?: string;
  base_uom: string;
  is_weighable?: boolean;
  track_inventory?: boolean;
  track_batches?: boolean;
  production_mode?: string;
  cost_price?: number;
  base_selling_price?: number;
  min_selling_price?: number;
  matrix_attributes?: Record<string, string[]>;
  uom_conversions?: {
    uom_name: string;
    conversion_factor: number;
    is_variable_ratio: boolean;
    default_price_for_uom?: number;
  }[];
  variants?: Partial<ProductVariant>[];
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
  reference_id?: string;
  notes?: string;
  items: PurchaseItem[];
}

export interface WastageInput {
  variant_id: string;
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

  // Units
  getUnits: (activeOnly?: boolean) => {
    const query = activeOnly ? "?active_only=true" : "";
    return request<Unit[]>(`/units${query}`);
  },
  createUnit: (data: Partial<Unit> | { code: string; name: string; description?: string; is_active?: boolean }) =>
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
  createProduct: (data: CreateProductInput) =>
    request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
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

  // Inventory
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
};
