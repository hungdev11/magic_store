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

export interface Category {
  id: string;
  name: string;
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
  attributes?: Record<string, string>;
  cost_price: number | string;
  base_selling_price: number | string;
  min_selling_price: number | string;
  current_inventory?: number | string;
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
  current_debt: number | string;
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

  // Categories & Products
  getCategories: () => request<Category[]>("/categories"),
  createCategory: (data: { name: string }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
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

  // Inventory
  createPurchase: (data: PurchaseInput) =>
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
};
