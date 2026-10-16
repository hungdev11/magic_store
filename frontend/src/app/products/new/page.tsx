"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import { api, Category, CreateProductInput } from "@/lib/api";
import { getBadgeClasses, formatVND } from "@/lib/design-tokens";
import {
  slugify,
  generateVariantsFromAttributes,
  AttributeInput,
  GeneratedVariant,
} from "@/lib/matrix-utils";
import {
  ArrowLeft,
  Package,
  Layers,
  Scale,
  Factory,
  UtensilsCrossed,
  Plus,
  Trash2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Tag,
  Wand2,
} from "lucide-react";

const COMMON_UOMS = [
  "kg",
  "g",
  "cái",
  "hộp",
  "đòn",
  "con",
  "lon",
  "chai",
  "mét",
  "bộ",
  "khay",
  "túi",
];

const PRODUCT_TYPES = [
  { value: "FINISHED_GOOD", label: "Thành phẩm (Bán lẻ / Thành phẩm hoàn chỉnh)" },
  { value: "RAW_MATERIAL", label: "Nguyên vật liệu (Dùng để chế biến, nấu nướng)" },
  { value: "WIP_SEMI_FINISHED", label: "Bán thành phẩm (Đã sơ chế / chờ lắp ráp)" },
  { value: "SERVICE", label: "Dịch vụ (Công chế biến, vận chuyển, dịch vụ)" },
  { value: "COMBO", label: "Gói hàng Combo (Tập hợp nhiều món)" },
];

const PRODUCTION_MODES = [
  {
    value: "NONE",
    label: "Không áp dụng BOM (Hàng mua đi bán lại thông thường)",
    desc: "Sản phẩm không qua chế biến, xuất nhập trực tiếp theo tồn kho.",
  },
  {
    value: "BATCH_MANUFACTURE",
    label: "Sản xuất theo mẻ (ASSEMBLY)",
    desc: "Lập lệnh sản xuất mẻ thành phẩm (ví dụ: Nấu 50 đòn chả lụa), kho tự trừ nguyên vật liệu thịt/mỡ.",
  },
  {
    value: "POS_BACKFLUSH",
    label: "Bán hàng tự trừ nguyên vật liệu (POS_BACKFLUSH)",
    desc: "Khi thu ngân bấm bán tại POS (ví dụ: 1 ổ Bánh mì), kho tự động trừ vỏ bánh mì, pate, chả theo định mức.",
  },
  {
    value: "DISASSEMBLY",
    label: "Pha lóc / Mổ xẻ chia phần (DISASSEMBLY)",
    desc: "Nhập nguyên liệu nguyên con (ví dụ: Cá hồi 5kg), mổ xẻ ra thịt phi-lê, đầu cá, xương và tự động phân bổ giá vốn.",
  },
];

interface ConversionRow {
  uom_name: string;
  conversion_factor: number;
  is_variable_ratio: boolean;
  default_price_for_uom: number | undefined;
}

export default function NewProductPage() {
  const router = useRouter();
  const { isModuleEnabled, storeSetting } = useStoreProfile();

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Block 1: Basic Information
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [baseUom, setBaseUom] = useState("cái");
  const [customUom, setCustomUom] = useState("");
  const [productType, setProductType] = useState("FINISHED_GOOD");

  // Single-product pricing & inventory (when matrix is off)
  const [costPrice, setCostPrice] = useState<number>(0);
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(0);
  const [minSellingPrice, setMinSellingPrice] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);

  // Block 2: Matrix Variants (matrix_variants = true)
  const [useMatrix, setUseMatrix] = useState(false);
  const [attributes, setAttributes] = useState<AttributeInput[]>([
    { name: "Màu sắc", valuesStr: "Đỏ, Đen, Trắng" },
    { name: "Kích cỡ", valuesStr: "S, M, L" },
  ]);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);

  // Block 3: Catch-weight & Secondary Units (catch_weight = true)
  const [isWeighable, setIsWeighable] = useState(false);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  // Block 4: BOM Production (bom_production = true)
  const [productionMode, setProductionMode] = useState("NONE");

  // Block 5: Product Modifiers (product_modifiers = true)
  const [allowModifiers, setAllowModifiers] = useState(false);
  const [modifierNotes, setModifierNotes] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load initial categories
  useEffect(() => {
    api.getCategories()
      .then((cats) => {
        setCategories(cats || []);
        if (cats && cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục:", err);
      });
  }, []);

  // Sync default matrix state when module is loaded
  useEffect(() => {
    if (isModuleEnabled("matrix_variants")) {
      setUseMatrix(true);
    }
    if (isModuleEnabled("catch_weight")) {
      setIsWeighable(true);
    }
  }, [isModuleEnabled]);

  // Auto-generate code from name if code is empty
  const handleNameBlur = () => {
    if (!code && name.trim()) {
      const generatedCode = slugify(name);
      setCode(generatedCode);
    }
  };

  // Matrix generation handler
  const handleGenerateMatrix = () => {
    const variants = generateVariantsFromAttributes(
      code || slugify(name),
      name,
      attributes,
      costPrice,
      baseSellingPrice,
      minSellingPrice,
      initialStock
    );
    setGeneratedVariants(variants);
  };

  // Sync prices to all matrix variants
  const handleApplyBulkPrices = () => {
    setGeneratedVariants((prev) =>
      prev.map((v) => ({
        ...v,
        cost_price: costPrice,
        base_selling_price: baseSellingPrice,
        min_selling_price: minSellingPrice,
        current_stock: initialStock,
      }))
    );
  };

  const handleUpdateVariant = (
    index: number,
    field: keyof GeneratedVariant,
    value: any
  ) => {
    setGeneratedVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveVariant = (index: number) => {
    setGeneratedVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // Attribute list handlers
  const handleAddAttribute = () => {
    setAttributes((prev) => [...prev, { name: "", valuesStr: "" }]);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index: number, field: "name" | "valuesStr", value: string) => {
    setAttributes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // UOM Conversion handlers
  const handleAddConversion = () => {
    setConversions((prev) => [
      ...prev,
      {
        uom_name: "",
        conversion_factor: 1,
        is_variable_ratio: false,
        default_price_for_uom: undefined,
      },
    ]);
  };

  const handleRemoveConversion = (index: number) => {
    setConversions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConversionChange = (index: number, field: keyof ConversionRow, value: any) => {
    setConversions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Vui lòng nhập Tên sản phẩm.");
      return;
    }

    const finalCode = (code.trim() || slugify(name)).toUpperCase();
    if (!finalCode) {
      setFormError("Vui lòng nhập Mã sản phẩm (Code/SKU).");
      return;
    }

    const finalBaseUom = baseUom === "KHAC" ? customUom.trim() : baseUom;
    if (!finalBaseUom) {
      setFormError("Vui lòng chọn hoặc nhập Đơn vị tính cơ sở.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Resolve Category
      let resolvedCategoryId = categoryId;

      if (isAddingNewCat && newCatName.trim()) {
        const createdCat = await api.createCategory({ name: newCatName.trim() });
        resolvedCategoryId = createdCat.id;
      } else if (!resolvedCategoryId) {
        // If no category exists at all in the DB, create a default "Chung"
        if (categories.length === 0) {
          const defaultCat = await api.createCategory({ name: "Hàng hóa chung" });
          resolvedCategoryId = defaultCat.id;
        } else {
          resolvedCategoryId = categories[0].id;
        }
      }

      // 2. Prepare UOM conversions
      const uomConversionsPayload = conversions
        .filter((c) => c.uom_name.trim().length > 0 && c.conversion_factor > 0)
        .map((c) => ({
          uom_name: c.uom_name.trim(),
          conversion_factor: Number(c.conversion_factor),
          is_variable_ratio: !!c.is_variable_ratio,
          default_price_for_uom: c.default_price_for_uom ? Number(c.default_price_for_uom) : undefined,
        }));

      // 3. Prepare Payload
      const payload: CreateProductInput = {
        name: name.trim(),
        code: finalCode,
        category_id: resolvedCategoryId,
        product_type: productType,
        base_uom: finalBaseUom,
        is_weighable: isModuleEnabled("catch_weight") ? isWeighable : false,
        production_mode: isModuleEnabled("bom_production") ? productionMode : "NONE",
        track_inventory: true,
        uom_conversions: uomConversionsPayload,
      };

      // 4. Handle Matrix vs Single
      if (isModuleEnabled("matrix_variants") && useMatrix && generatedVariants.length > 0) {
        payload.variants = generatedVariants.map((gv) => ({
          sku: gv.sku.trim(),
          variant_name: gv.variant_name.trim(),
          attributes: JSON.stringify(gv.attributes),
          cost_price: Number(gv.cost_price || 0),
          base_selling_price: Number(gv.base_selling_price || 0),
          min_selling_price: Number(gv.min_selling_price || 0),
          current_stock: Number(gv.current_stock || 0),
        }));
      } else {
        // Single variant product
        payload.cost_price = Number(costPrice || 0);
        payload.base_selling_price = Number(baseSellingPrice || 0);
        payload.min_selling_price = Number(minSellingPrice || 0);
        payload.variants = [
          {
            sku: finalCode,
            barcode: barcode.trim() || undefined,
            variant_name: name.trim(),
            attributes: "{}",
            cost_price: Number(costPrice || 0),
            base_selling_price: Number(baseSellingPrice || 0),
            min_selling_price: Number(minSellingPrice || 0),
            current_stock: Number(initialStock || 0),
          },
        ];
      }

      // 5. Send API Request
      await api.createProduct(payload);

      // Redirect to list
      router.push("/products");
    } catch (err: any) {
      setFormError(err.message || "Lỗi khi tạo sản phẩm");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="p-2 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-muted text-text-sub hover:text-text-main transition shadow-sm"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand px-2 py-0.5 rounded bg-brand-light border border-emerald-200">
                Form thích ứng
              </span>
              <span className="text-xs text-text-sub">Thích ứng theo Feature Flags</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main mt-0.5">
              Thêm Sản phẩm Thông minh
            </h1>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-hover shadow-sm transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Tạo sản phẩm</span>
            </>
          )}
        </button>
      </div>

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* =========================================================================
            KHỐI 1: THÔNG TIN CƠ BẢN (LUÔN HIỆN)
        ========================================================================= */}
        <section className="bg-surface-card rounded-xl p-6 border border-border-subtle shadow-card space-y-5">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-brand" />
              <h2 className="text-base font-semibold text-text-main">
                1. Thông tin cơ bản
              </h2>
            </div>
            <span className="text-xs text-brand font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Bắt buộc
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text-main mb-1">
                Tên sản phẩm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Áo Thun Polo Cotton, Cá Hồi Tươi Nguyên Con, Bánh Mì Đặc Biệt..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
              />
            </div>

            {/* Product Code / SKU */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Mã sản phẩm / SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: AT-POLO, CA-HOI-01"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Mã vạch Barcode
              </label>
              <input
                type="text"
                placeholder="Nhập hoặc quét mã vạch (e.g. 893...)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-main">
                  Danh mục
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  {isAddingNewCat ? "Chọn danh mục có sẵn" : "+ Nhập danh mục mới"}
                </button>
              </div>

              {isAddingNewCat ? (
                <input
                  type="text"
                  placeholder="Nhập tên danh mục mới..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {categories.length === 0 && (
                    <option value="">(Tự động tạo danh mục Mặc định)</option>
                  )}
                </select>
              )}
            </div>

            {/* Base UOM */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Đơn vị tính cơ sở (ĐVT chuẩn) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={baseUom}
                  onChange={(e) => setBaseUom(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                >
                  {COMMON_UOMS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="KHAC">Khác (tự gõ)...</option>
                </select>
                {baseUom === "KHAC" && (
                  <input
                    type="text"
                    required
                    placeholder="Nhập ĐVT..."
                    value={customUom}
                    onChange={(e) => setCustomUom(e.target.value)}
                    className="w-32 px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                  />
                )}
              </div>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Loại hàng hóa (Product Type)
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
              >
                {PRODUCT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Stock inputs for non-matrix products */}
          {(!isModuleEnabled("matrix_variants") || !useMatrix) && (
            <div className="pt-4 mt-2 border-t border-border-subtle space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-sub">
                Định giá & Tồn kho ban đầu (Sản phẩm đơn thể)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Giá bán tiêu chuẩn (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={baseSellingPrice || ""}
                    onChange={(e) => setBaseSellingPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                  />
                  <div className="text-[11px] text-text-sub mt-0.5">
                    {formatVND(baseSellingPrice)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Giá vốn ban đầu / WAC (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={costPrice || ""}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                  />
                  <div className="text-[11px] text-text-sub mt-0.5">
                    {formatVND(costPrice)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Giá sàn bán lẻ (Min Price)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={minSellingPrice || ""}
                    onChange={(e) => setMinSellingPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                  />
                  <div className="text-[11px] text-text-sub mt-0.5">
                    {formatVND(minSellingPrice)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Tồn kho ban đầu
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialStock || ""}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                  />
                  <div className="text-[11px] text-text-sub mt-0.5">
                    Số lượng theo ĐVT: {baseUom}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            KHỐI 2: MA TRẬN BIẾN THỂ (CHỈ HIỆN KHI matrix_variants = true)
        ========================================================================= */}
        {isModuleEnabled("matrix_variants") && (
          <section className="bg-surface-card rounded-xl p-6 border border-purple-200 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="text-base font-semibold text-text-main flex items-center gap-2">
                    2. Ma trận Biến thể (Màu sắc × Kích cỡ)
                    <span className={getBadgeClasses("matrix")}>Mô-đun Thời trang</span>
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Tự động tính tích Descartes và sinh tổ hợp SKU đa thuộc tính.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMatrix}
                  onChange={(e) => setUseMatrix(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2 text-xs font-semibold text-text-main">
                  {useMatrix ? "Đang bật" : "Tắt ma trận"}
                </span>
              </label>
            </div>

            {useMatrix && (
              <div className="space-y-4">
                {/* Attribute Definition Rows */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-text-sub uppercase tracking-wider">
                    Danh sách Thuộc tính & Giá trị (phân cách bằng dấu phẩy)
                  </div>

                  {attributes.map((attr, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Tên thuộc tính (e.g. Màu sắc, Kích cỡ)"
                        value={attr.name}
                        onChange={(e) => handleAttributeChange(idx, "name", e.target.value)}
                        className="w-1/3 px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
                      />
                      <input
                        type="text"
                        placeholder="Các giá trị (e.g. Đỏ, Đen, Trắng hoặc S, M, L, XL)"
                        value={attr.valuesStr}
                        onChange={(e) => handleAttributeChange(idx, "valuesStr", e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttribute(idx)}
                        disabled={attributes.length <= 1}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-30"
                        title="Xóa thuộc tính này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAddAttribute}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm thuộc tính</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateMatrix}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-purple-600 px-4 py-2 rounded-lg hover:bg-purple-700 shadow-sm transition"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Sinh ma trận SKU (Descartes)</span>
                    </button>
                  </div>
                </div>

                {/* Generated Variants Table */}
                {generatedVariants.length > 0 && (
                  <div className="pt-3 border-t border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Danh sách biến thể đã sinh ({generatedVariants.length} SKU)</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyBulkPrices}
                        className="text-xs text-purple-700 hover:underline font-medium"
                        title="Gán giá bán, giá vốn, giá sàn mặc định cho tất cả các dòng"
                      >
                        Đồng bộ nhanh giá chung vào tất cả dòng
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border-subtle">
                      <table className="w-full text-xs">
                        <thead className="bg-purple-50/70 text-purple-900 font-semibold border-b border-border-subtle">
                          <tr>
                            <th className="py-2.5 px-3 text-left">Mã SKU</th>
                            <th className="py-2.5 px-3 text-left">Tên quy cách</th>
                            <th className="py-2.5 px-3 text-right w-28">Giá bán</th>
                            <th className="py-2.5 px-3 text-right w-28">Giá vốn WAC</th>
                            <th className="py-2.5 px-3 text-right w-28">Giá sàn</th>
                            <th className="py-2.5 px-3 text-right w-24">Tồn đầu</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-white">
                          {generatedVariants.map((v, i) => (
                            <tr key={i} className="hover:bg-purple-50/20">
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={v.sku}
                                  onChange={(e) => handleUpdateVariant(i, "sku", e.target.value)}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded font-mono font-medium"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={v.variant_name}
                                  onChange={(e) => handleUpdateVariant(i, "variant_name", e.target.value)}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={v.base_selling_price}
                                  onChange={(e) => handleUpdateVariant(i, "base_selling_price", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded text-right font-mono"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={v.cost_price}
                                  onChange={(e) => handleUpdateVariant(i, "cost_price", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded text-right font-mono"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={v.min_selling_price}
                                  onChange={(e) => handleUpdateVariant(i, "min_selling_price", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded text-right font-mono"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={v.current_stock}
                                  onChange={(e) => handleUpdateVariant(i, "current_stock", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-slate-50 border border-border-subtle rounded text-right font-mono"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(i)}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                  title="Xóa dòng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* =========================================================================
            KHỐI 3: CÂN ĐIỆN TỬ & ĐƠN VỊ PHỤ (CHỈ HIỆN KHI catch_weight = true)
        ========================================================================= */}
        {isModuleEnabled("catch_weight") && (
          <section className="bg-surface-card rounded-xl p-6 border border-cyan-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-600" />
                <div>
                  <h2 className="text-base font-semibold text-text-main flex items-center gap-2">
                    3. Cân điện tử & Đơn vị tính quy đổi
                    <span className={getBadgeClasses("catchweight")}>Mô-đun Hải sản / Cân ký</span>
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Hỗ trợ tỷ lệ biến thiên (Variable Ratio) bắt buộc cân thực tế tại quầy POS.
                  </p>
                </div>
              </div>
            </div>

            {/* Weighable Checkbox */}
            <div className="p-3.5 bg-cyan-50/50 rounded-lg border border-cyan-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="is_weighable_cb"
                checked={isWeighable}
                onChange={(e) => setIsWeighable(e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
              />
              <label htmlFor="is_weighable_cb" className="text-sm font-medium text-text-main cursor-pointer">
                Hàng cần cân thực tế tại quầy (<span className="font-mono text-cyan-700">is_weighable</span>)
              </label>
            </div>

            {/* UOM Conversions Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-sub uppercase tracking-wider">
                  Bảng quy đổi Đơn vị phụ (Con, Thùng, Khay, Két...)
                </span>
                <button
                  type="button"
                  onClick={handleAddConversion}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-200 hover:bg-cyan-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm đơn vị quy đổi</span>
                </button>
              </div>

              {conversions.length === 0 ? (
                <div className="text-xs text-text-sub italic bg-surface-muted/40 p-4 rounded-lg border border-dashed border-border-subtle text-center">
                  Chưa có đơn vị phụ. Bấm &quot;Thêm đơn vị quy đổi&quot; nếu sản phẩm bán theo Con, Rổ hoặc Thùng.
                </div>
              ) : (
                <div className="space-y-2">
                  {conversions.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-lg border border-border-subtle grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                          Tên đơn vị phụ
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Con, Thùng, Khay"
                          value={row.uom_name}
                          onChange={(e) => handleConversionChange(idx, "uom_name", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-border-subtle rounded font-medium"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                          Hệ số quy đổi ra {baseUom}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          placeholder="e.g. 1.2 hoặc 24"
                          value={row.conversion_factor}
                          onChange={(e) =>
                            handleConversionChange(idx, "conversion_factor", Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-border-subtle rounded font-mono text-right"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                          Giá bán theo đơn vị này (nếu có)
                        </label>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          placeholder="Để trống nếu tính theo kg"
                          value={row.default_price_for_uom || ""}
                          onChange={(e) =>
                            handleConversionChange(
                              idx,
                              "default_price_for_uom",
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-border-subtle rounded font-mono text-right"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center pt-3 sm:pt-0">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-cyan-900">
                          <input
                            type="checkbox"
                            checked={row.is_variable_ratio}
                            onChange={(e) =>
                              handleConversionChange(idx, "is_variable_ratio", e.target.checked)
                            }
                            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>Tỷ lệ biến thiên</span>
                        </label>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveConversion(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded hover:bg-rose-50 transition"
                          title="Xóa đơn vị này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================================================
            KHỐI 4: CÔNG THỨC CHẾ BIẾN & ĐỊNH MỨC BOM (CHỈ HIỆN KHI bom_production = true)
        ========================================================================= */}
        {isModuleEnabled("bom_production") && (
          <section className="bg-surface-card rounded-xl p-6 border border-indigo-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-base font-semibold text-text-main flex items-center gap-2">
                    4. Công thức Chế biến & Định mức BOM
                    <span className={getBadgeClasses("bom")}>Mô-đun Sản xuất / F&B</span>
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Lựa chọn chế độ cấu thành công thức định mức cho sản phẩm này.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-main mb-1.5">
                Chế độ sản xuất (Production Mode)
              </label>
              <select
                value={productionMode}
                onChange={(e) => setProductionMode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
              >
                {PRODUCTION_MODES.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Explanatory Notice */}
            <div className="p-3.5 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-950 space-y-1">
                <div className="font-semibold">
                  {PRODUCTION_MODES.find((m) => m.value === productionMode)?.label}
                </div>
                <div className="text-indigo-800 leading-relaxed">
                  {PRODUCTION_MODES.find((m) => m.value === productionMode)?.desc}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            KHỐI 5: ĐỒ ĂN KÈM / TOPPING (CHỈ HIỆN KHI product_modifiers = true)
        ========================================================================= */}
        {isModuleEnabled("product_modifiers") && (
          <section className="bg-surface-card rounded-xl p-6 border border-orange-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                <div>
                  <h2 className="text-base font-semibold text-text-main flex items-center gap-2">
                    5. Đồ ăn kèm / Topping
                    <span className={getBadgeClasses("modifier")}>Mô-đun F&B Topping</span>
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Cho phép gắn nhóm tùy chọn topping (Trân châu, Thạch, Trứng ốp la...) khi order tại quầy POS.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-orange-50/50 rounded-lg border border-orange-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="allow_modifiers_cb"
                checked={allowModifiers}
                onChange={(e) => setAllowModifiers(e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
              />
              <label htmlFor="allow_modifiers_cb" className="text-sm font-medium text-text-main cursor-pointer">
                Cho phép chọn món ăn kèm / Topping khi bán tại POS
              </label>
            </div>

            {allowModifiers && (
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Ghi chú nhóm Topping gợi ý
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Trân châu đường đen, Kem cheese, Thạch củ năng, Trứng ốp la thêm..."
                  value={modifierNotes}
                  onChange={(e) => setModifierNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>
            )}
          </section>
        )}

        {/* Action Button Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Link
            href="/products"
            className="px-5 py-2.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-muted text-text-sub hover:text-text-main text-sm font-medium transition"
          >
            Hủy bỏ
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-hover shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Tạo sản phẩm</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
