"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  Category,
  CreateProductInput,
  ProductArchetype,
  Unit,
  Product,
} from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import {
  slugify,
  generateVariantsFromAttributes,
  AttributeInput,
  GeneratedVariant,
} from "@/lib/matrix-utils";
import {
  ImageUploader,
  PageHeader,
  Badge,
  Button,
  AlertBanner,
  Modal,
  SearchableSelect,
} from "@/components/common";
import {
  Package,
  Layers,
  Scale,
  Factory,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Wand2,
  ArrowRightLeft,
  CheckCircle2,
  Coffee,
  Image as ImageIcon,
  Boxes,
  CookingPot,
  Wrench,
  Tag,
  Clock,
} from "lucide-react";

interface ConversionRow {
  uom_name: string;
  conversion_factor: number;
  is_variable_ratio: boolean;
  default_price_for_uom: number | undefined;
  barcode?: string;
  selling_price?: number | undefined;
}

interface FnbSizeRow {
  name: string;
  price: number;
  cost: number;
}

interface FnbModifierRow {
  name: string;
  price: number;
  linked_variant_id?: string;
  deduct_qty?: number;
}

const PRODUCT_TYPES = [
  {
    key: "FINISHED_GOOD",
    label: "Thành phẩm",
    desc: "Hàng hóa hoàn chỉnh sẵn sàng bán lẻ / giao khách (Bia, Áo, Trà sữa, Bánh mì...)",
    icon: Package,
    color: "border-brand text-brand bg-brand/5",
  },
  {
    key: "RAW_MATERIAL",
    label: "Nguyên vật liệu",
    desc: "Nguyên liệu thô để nấu, pha chế, làm topping hoặc đóng gói (Trân châu, Bột, Đường, Vỏ hộp...)",
    icon: CookingPot,
    color: "border-amber-600 text-amber-700 bg-amber-50",
  },
  {
    key: "WIP_SEMI_FINISHED",
    label: "Bán thành phẩm",
    desc: "Đã qua sơ chế hoặc chế biến dở dang (Nước cốt trà, Pate tự làm, Cá đã làm sạch...)",
    icon: Boxes,
    color: "border-blue-600 text-blue-700 bg-blue-50",
  },
  {
    key: "SERVICE",
    label: "Dịch vụ",
    desc: "Phí dịch vụ, công gia công chế biến, phí vận chuyển không quản lý tồn kho",
    icon: Wrench,
    color: "border-purple-600 text-purple-700 bg-purple-50",
  },
  {
    key: "COMBO",
    label: "Gói / Combo đóng gói",
    desc: "Bộ sản phẩm gồm nhiều mặt hàng (1 Bánh mì + 1 Nước ngọt, Set quà tặng...)",
    icon: Boxes,
    color: "border-teal-600 text-teal-700 bg-teal-50",
  },
];

const ARCHETYPES: {
  key: ProductArchetype;
  label: string;
  subLabel: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "STANDARD",
    label: "Hàng đóng gói / Tiêu chuẩn",
    subLabel: "Đa ĐVT (Thùng/Lốc/Lon)",
    desc: "Bia, nước ngọt, bánh kẹo, hàng tiêu dùng. Quét barcode riêng cho từng đơn vị tính.",
    icon: Package,
  },
  {
    key: "MATRIX",
    label: "Thời trang / Đa biến thể",
    subLabel: "Màu sắc × Kích cỡ",
    desc: "Quần áo, giày dép, phụ kiện. Tự động sinh ma trận SKU theo tổ hợp thuộc tính kèm ảnh riêng.",
    icon: Layers,
  },
  {
    key: "CATCH_WEIGHT",
    label: "Hàng tươi sống / Cân ký",
    subLabel: "Cân thực tế & Lô HSD",
    desc: "Cá tươi, tôm, thịt, rau củ quả. Bắt buộc cân tại POS và theo dõi số lô hạn dùng.",
    icon: Scale,
  },
  {
    key: "MANUFACTURED",
    label: "Chế biến / F&B (BOM)",
    subLabel: "Size, Topping & Công thức",
    desc: "Trà sữa, cà phê, bánh mì, pha lóc. Cấu hình size giá, topping đồ kèm và trừ kho tự động.",
    icon: Factory,
  },
  {
    key: "COMBO",
    label: "Combo / Gói sản phẩm",
    subLabel: "Đóng gói nhiều mặt hàng",
    desc: "Bữa sáng, combo ăn trưa, set quà tặng. Gồm các sản phẩm con, bán tự trừ kho từng món.",
    icon: Boxes,
  },
];

const COMMON_CONVERSION_RULES: Record<
  string,
  { uom_name: string; conversion_factor: number; is_variable_ratio: boolean }[]
> = {
  kg: [
    { uom_name: "g", conversion_factor: 0.001, is_variable_ratio: false },
    { uom_name: "con", conversion_factor: 1, is_variable_ratio: true },
  ],
  thùng: [
    { uom_name: "lon", conversion_factor: 24, is_variable_ratio: false },
    { uom_name: "chai", conversion_factor: 24, is_variable_ratio: false },
    { uom_name: "lốc", conversion_factor: 6, is_variable_ratio: false },
  ],
  hộp: [
    { uom_name: "cái", conversion_factor: 10, is_variable_ratio: false },
    { uom_name: "gói", conversion_factor: 10, is_variable_ratio: false },
  ],
  lít: [
    { uom_name: "ml", conversion_factor: 0.001, is_variable_ratio: false },
  ],
  bao: [
    { uom_name: "kg", conversion_factor: 50, is_variable_ratio: false },
  ],
};

const COMMON_UOMS = [
  "cái",
  "ly",
  "tô",
  "dĩa",
  "lon",
  "chai",
  "hộp",
  "gói",
  "kg",
  "g",
  "lít",
  "ml",
  "thùng",
  "lốc",
  "bao",
  "con",
  "đòn",
  "bộ",
];

const PRODUCTION_MODES = [
  {
    value: "POS_BACKFLUSH",
    label: "Bán hàng tự trừ nguyên vật liệu (POS_BACKFLUSH)",
    desc: "Thu ngân bấm bán tại POS (ví dụ: 1 ly Trà sữa / 1 ổ Bánh mì), kho tự trừ nguyên liệu & topping.",
  },
  {
    value: "BATCH_MANUFACTURE",
    label: "Sản xuất theo mẻ (ASSEMBLY)",
    desc: "Lập lệnh sản xuất mẻ thành phẩm (ví dụ: Nấu 50 đòn chả lụa), kho tự trừ thịt/mỡ.",
  },
  {
    value: "DISASSEMBLY",
    label: "Pha lóc / Mổ xẻ chia phần (DISASSEMBLY)",
    desc: "Nhập nguyên con (ví dụ: Cá hồi 5kg), mổ xẻ ra phi-lê, đầu cá và tự phân bổ giá vốn.",
  },
  {
    value: "NONE",
    label: "Chỉ quản lý Size & Topping (Không trừ kho công thức)",
    desc: "Phù hợp quán ăn nhỏ chưa cần quản lý kho nguyên vật liệu pha chế chi tiết.",
  },
];

export default function NewProductPage() {
  const router = useRouter();

  // 1. Phân loại sản phẩm (Product Type)
  const [productType, setProductType] = useState("FINISHED_GOOD");

  // 2. Bản chất hàng hóa (Product Archetype)
  const [archetype, setArchetype] = useState<ProductArchetype>("STANDARD");

  // Master Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Entity Creation Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [isToppingModalOpen, setIsToppingModalOpen] = useState(false);
  const [newToppingName, setNewToppingName] = useState("");
  const [newToppingPrice, setNewToppingPrice] = useState<number>(5000);
  const [newToppingCost, setNewToppingCost] = useState<number>(2000);
  const [newToppingUom, setNewToppingUom] = useState("phần");

  // Block 1: Basic Information
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [baseUom, setBaseUom] = useState("cái");
  const [imageUrl, setImageUrl] = useState("");

  // Shelf Life & Expiry Warning
  const [shelfLifeDays, setShelfLifeDays] = useState<number | null>(null);
  const [expiryWarningDays, setExpiryWarningDays] = useState<number | null>(null);

  // Pricing & Inventory (Standard single variant)
  const [costPrice, setCostPrice] = useState<number>(0);
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(0);
  const [minSellingPrice, setMinSellingPrice] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);

  // Archetype: STANDARD -> Multi-UOM Conversions
  const [conversions, setConversions] = useState<ConversionRow[]>([]);

  // Archetype: MATRIX -> Color x Size Variants
  const [attributes, setAttributes] = useState<AttributeInput[]>([
    { name: "Màu sắc", valuesStr: "Đỏ, Đen, Trắng" },
    { name: "Kích cỡ", valuesStr: "S, M, L" },
  ]);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);

  // Archetype: CATCH_WEIGHT -> Weighable & Batches
  const [isWeighable, setIsWeighable] = useState(true);
  const [trackBatches, setTrackBatches] = useState(true);

  // Archetype: MANUFACTURED -> F&B Sizes & Toppings
  const [productionMode, setProductionMode] = useState("POS_BACKFLUSH");
  const [hasSizes, setHasSizes] = useState(true);
  const [fnbSizes, setFnbSizes] = useState<FnbSizeRow[]>([
    { name: "Size M (Vừa)", price: 25000, cost: 10000 },
    { name: "Size L (Lớn)", price: 32000, cost: 13000 },
  ]);
  const [fnbModifiers, setFnbModifiers] = useState<FnbModifierRow[]>([]);

  // Archetype: COMBO -> Bundle components
  interface ComboComponentRow {
    variant_id: string;
    product_name: string;
    variant_name: string;
    qty: number;
    cost_price: number;
    selling_price: number;
  }
  const [comboComponents, setComboComponents] = useState<ComboComponentRow[]>([]);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load initial categories, units, and products for topping link
  const loadMasterData = async () => {
    try {
      const [cats, uoms, prods] = await Promise.all([
        api.getCategories(),
        api.getUnits(true),
        api.getProducts(),
      ]);
      setCategories(cats || []);
      if (cats && cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
      setUnits(uoms || []);
      if (uoms && uoms.length > 0 && !baseUom) {
        setBaseUom(uoms[0].name.toLowerCase());
      }
      setAllProducts(prods || []);
    } catch (err) {
      console.error("Lỗi khi tải master data:", err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Modal 1: Quick Create Category
  const handleQuickCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const created = await api.createCategory({ name: newCatName.trim() });
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName("");
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Lỗi tạo danh mục");
    }
  };

  // Modal 2: Quick Create Unit
  const handleQuickCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      const created = await api.createUnit({ name: newUnitName.trim() });
      setUnits((prev) => [...prev, created]);
      setBaseUom(created.name.toLowerCase());
      setNewUnitName("");
      setIsUnitModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Lỗi tạo đơn vị tính");
    }
  };

  // Modal 3: Quick Create Topping Product (as RAW_MATERIAL)
  const handleQuickCreateTopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToppingName.trim()) return;
    try {
      const tCode = `TOP_${slugify(newToppingName).toUpperCase()}`;
      const defaultCatId = categoryId || (categories[0] ? categories[0].id : undefined);

      const created = await api.createProduct({
        name: newToppingName.trim(),
        code: tCode,
        category_id: defaultCatId,
        product_type: "RAW_MATERIAL",
        archetype: "STANDARD",
        base_uom: newToppingUom.trim().toLowerCase(),
        cost_price: Number(newToppingCost || 0),
        base_selling_price: Number(newToppingPrice || 0),
      });

      setAllProducts((prev) => [...prev, created]);
      const vId = created.variants?.[0]?.id;
      setFnbModifiers((prev) => [
        ...prev,
        {
          name: created.name,
          price: Number(newToppingPrice || 0),
          linked_variant_id: vId,
          deduct_qty: 1,
        },
      ]);
      setNewToppingName("");
      setIsToppingModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Lỗi tạo nguyên liệu topping");
    }
  };

  // Combo Component Handlers
  const handleAddComboComponent = (variantId: string) => {
    if (!variantId) return;
    for (const p of allProducts) {
      const v = (p.variants || []).find((varItem) => varItem.id === variantId);
      if (v) {
        if (comboComponents.some((c) => c.variant_id === v.id)) return;
        setComboComponents((prev) => [
          ...prev,
          {
            variant_id: v.id,
            product_name: p.name,
            variant_name: v.variant_name || p.name,
            qty: 1,
            cost_price: Number(v.cost_price || 0),
            selling_price: Number(v.base_selling_price || 0),
          },
        ]);
        break;
      }
    }
  };

  const handleUpdateComboComponentQty = (idx: number, qty: number) => {
    setComboComponents((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(0.01, qty) };
      return next;
    });
  };

  const handleRemoveComboComponent = (idx: number) => {
    setComboComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const suggestedComboCost = useMemo(() => {
    return comboComponents.reduce((sum, c) => sum + c.cost_price * c.qty, 0);
  }, [comboComponents]);

  const suggestedComboRetail = useMemo(() => {
    return comboComponents.reduce((sum, c) => sum + c.selling_price * c.qty, 0);
  }, [comboComponents]);

  useEffect(() => {
    if (archetype === "COMBO" && comboComponents.length > 0) {
      setCostPrice(suggestedComboCost);
      if (baseSellingPrice === 0) {
        setBaseSellingPrice(suggestedComboRetail);
      }
    }
  }, [archetype, comboComponents.length, suggestedComboCost, suggestedComboRetail, baseSellingPrice]);

  // Hierarchical Category Options
  const categoryOptions = useMemo(() => {
    const parentMap = new Map<string, Category>();
    const childrenMap = new Map<string, Category[]>();

    categories.forEach((c) => {
      if (!c.parent_id) {
        parentMap.set(c.id, c);
      } else {
        const list = childrenMap.get(c.parent_id) || [];
        list.push(c);
        childrenMap.set(c.parent_id, list);
      }
    });

    const opts: { value: string; label: string; badge?: string }[] = [];
    categories.forEach((c) => {
      if (!c.parent_id) {
        opts.push({ value: c.id, label: c.name, badge: "Danh mục cha" });
        const kids = childrenMap.get(c.id) || [];
        kids.forEach((k) => {
          opts.push({ value: k.id, label: `└─ ${k.name}`, badge: c.name });
        });
      }
    });

    categories.forEach((c) => {
      if (c.parent_id && !parentMap.has(c.parent_id)) {
        opts.push({ value: c.id, label: c.name });
      }
    });

    return opts;
  }, [categories]);

  // Unit Options
  const unitOptions = useMemo(() => {
    return units.map((u) => ({
      value: u.name.toLowerCase(),
      label: u.name,
    }));
  }, [units]);

  // Eligible Topping Products (Food & Beverage only, strictly excludes clothing/fashion)
  const eligibleToppingProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const cat = categories.find((c) => c.id === p.category_id);
      const catName = (cat?.name || "").toLowerCase();
      const prodName = p.name.toLowerCase();

      const isFashion =
        /thời trang|quần áo|may mặc|giày|dép|áo thun|sơ mi|quần jean|phụ kiện vải/i.test(catName) ||
        /áo |quần |giày |váy |đầm /i.test(prodName);
      if (isFashion) return false;

      return (
        p.product_type === "RAW_MATERIAL" ||
        p.product_type === "WIP_SEMI_FINISHED" ||
        p.product_type === "FINISHED_GOOD"
      );
    });
  }, [allProducts, categories]);

  // When base UOM changes, auto-suggest conversions if empty
  const handleBaseUomChange = (newUom: string) => {
    setBaseUom(newUom);
    if (conversions.length === 0) {
      const matched = COMMON_CONVERSION_RULES[newUom.toLowerCase().trim()];
      if (matched && matched.length > 0) {
        setConversions(
          matched.map((m) => ({
            uom_name: m.uom_name,
            conversion_factor: m.conversion_factor,
            is_variable_ratio: m.is_variable_ratio,
            default_price_for_uom: undefined,
          }))
        );
      }
    }
  };

  const handleApplySuggestedConversions = () => {
    const key = baseUom.toLowerCase().trim();
    const matched = COMMON_CONVERSION_RULES[key];
    if (matched && matched.length > 0) {
      setConversions(
        matched.map((m) => ({
          uom_name: m.uom_name,
          conversion_factor: m.conversion_factor,
          is_variable_ratio: m.is_variable_ratio,
          default_price_for_uom: undefined,
        }))
      );
    }
  };

  const handleNameBlur = () => {
    if (!code && name.trim()) {
      setCode(slugify(name));
    }
  };

  // Matrix handlers
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

  const handleAddAttribute = () => {
    setAttributes((prev) => [...prev, { name: "", valuesStr: "" }]);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (
    index: number,
    field: "name" | "valuesStr",
    value: string
  ) => {
    setAttributes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Conversion handlers
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

  const handleConversionChange = (
    index: number,
    field: keyof ConversionRow,
    value: any
  ) => {
    setConversions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // F&B Size handlers
  const handleAddFnbSize = () => {
    setFnbSizes((prev) => [
      ...prev,
      { name: `Size ${String.fromCharCode(65 + prev.length)}`, price: 30000, cost: 12000 },
    ]);
  };

  const handleRemoveFnbSize = (index: number) => {
    setFnbSizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFnbSize = (index: number, field: keyof FnbSizeRow, val: any) => {
    setFnbSizes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // F&B Modifier handlers
  const handleAddFnbModifierFromExisting = (variantId: string) => {
    const prod = allProducts.find((p) => (p.variants || []).some((v) => v.id === variantId));
    const variant = prod?.variants?.find((v) => v.id === variantId);
    if (!variant) return;

    setFnbModifiers((prev) => [
      ...prev,
      {
        name: variant.variant_name || prod?.name || "Topping",
        price: Number(variant.base_selling_price || 5000),
        linked_variant_id: variant.id,
        deduct_qty: 1,
      },
    ]);
  };

  const handleRemoveFnbModifier = (index: number) => {
    setFnbModifiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFnbModifier = (index: number, field: keyof FnbModifierRow, val: any) => {
    setFnbModifiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
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

    if (!baseUom.trim()) {
      setFormError("Vui lòng chọn Đơn vị tính cơ sở.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Resolve Category
      let resolvedCategoryId = categoryId;
      if (!resolvedCategoryId) {
        if (categories.length === 0) {
          const defaultCat = await api.createCategory({ name: "Hàng hóa chung" });
          resolvedCategoryId = defaultCat.id;
        } else {
          resolvedCategoryId = categories[0].id;
        }
      }

      // 2. Prepare UOM conversions (STANDARD or CATCH_WEIGHT)
      const uomConversionsPayload =
        archetype === "STANDARD" || archetype === "CATCH_WEIGHT"
          ? conversions
              .filter((c) => c.uom_name.trim().length > 0 && c.conversion_factor > 0)
              .map((c) => ({
                uom_name: c.uom_name.trim(),
                conversion_factor: Number(c.conversion_factor),
                is_variable_ratio: !!c.is_variable_ratio,
                default_price_for_uom: c.selling_price
                  ? Number(c.selling_price)
                  : c.default_price_for_uom
                  ? Number(c.default_price_for_uom)
                  : undefined,
                barcode: c.barcode?.trim() || undefined,
                selling_price: c.selling_price ? Number(c.selling_price) : undefined,
              }))
          : [];

      // 3. Handle F&B Modifier Group creation if provided
      const createdModifierGroupIds: string[] = [];
      if (archetype === "MANUFACTURED" && fnbModifiers.length > 0) {
        const validMods = fnbModifiers.filter((m) => m.name.trim().length > 0);
        if (validMods.length > 0) {
          const modGroup = await api.createModifierGroup({
            name: `Topping / Món kèm - ${name.trim()}`,
            min_selection: 0,
            is_required: false,
            items: validMods.map((m) => ({
              name: m.name.trim(),
              price: Number(m.price || 0),
              linked_variant_id: m.linked_variant_id,
              deduct_qty: Number(m.deduct_qty || 1),
            })),
          });
          createdModifierGroupIds.push(modGroup.id);
        }
      }

      // 4. Prepare Payload
      const payload: CreateProductInput = {
        name: name.trim(),
        code: finalCode,
        category_id: resolvedCategoryId,
        product_type: productType,
        archetype,
        base_uom: baseUom.trim().toLowerCase(),
        image_url: imageUrl.trim() || undefined,
        track_inventory: productType !== "SERVICE",
        is_weighable: archetype === "CATCH_WEIGHT" ? isWeighable : false,
        track_batches:
          archetype === "CATCH_WEIGHT" ? trackBatches : shelfLifeDays ? true : false,
        shelf_life_days: shelfLifeDays,
        expiry_warning_days: expiryWarningDays,
        production_mode:
          archetype === "MANUFACTURED"
            ? productionMode
            : archetype === "COMBO"
            ? "POS_BACKFLUSH"
            : "NONE",
        uom_conversions: uomConversionsPayload,
        modifier_group_ids: createdModifierGroupIds,
      };

      // 5. Handle Variants based on Archetype
      if (archetype === "MATRIX" && generatedVariants.length > 0) {
        payload.variants = generatedVariants.map((gv) => ({
          sku: gv.sku.trim(),
          variant_name: gv.variant_name.trim(),
          attributes: JSON.stringify(gv.attributes),
          cost_price: Number(gv.cost_price || 0),
          base_selling_price: Number(gv.base_selling_price || 0),
          min_selling_price: Number(gv.min_selling_price || 0),
          current_stock: Number(gv.current_stock || 0),
          image_url: gv.image_url || imageUrl.trim() || undefined,
          shelf_life_days: shelfLifeDays,
          expiry_warning_days: expiryWarningDays,
        }));
      } else if (archetype === "MANUFACTURED" && hasSizes && fnbSizes.length > 0) {
        payload.variants = fnbSizes.map((sz) => ({
          sku: `${finalCode}_${slugify(sz.name).toUpperCase()}`,
          variant_name: `${name.trim()} (${sz.name.trim()})`,
          attributes: JSON.stringify({ Size: sz.name.trim() }),
          cost_price: Number(sz.cost || 0),
          base_selling_price: Number(sz.price || 0),
          min_selling_price: Number(sz.cost || 0),
          current_stock: 0,
          image_url: imageUrl.trim() || undefined,
          shelf_life_days: shelfLifeDays,
          expiry_warning_days: expiryWarningDays,
        }));
      } else {
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
            image_url: imageUrl.trim() || undefined,
            shelf_life_days: shelfLifeDays,
            expiry_warning_days: expiryWarningDays,
          },
        ];
      }

      const created = await api.createProduct(payload);

      if (archetype === "COMBO" && comboComponents.length > 0 && created.variants?.[0]?.id) {
        await api
          .createBomRecipe({
            target_variant_id: created.variants[0].id,
            recipe_type: "ASSEMBLY",
            output_qty: 1,
            expected_wastage_percent: 0,
            items: comboComponents.map((c) => ({
              component_variant_id: c.variant_id,
              qty_required: Number(c.qty || 1),
              cost_allocation_percent: 0,
            })),
          })
          .catch((e) => console.warn("Lỗi khi tạo định mức combo:", e));
      }

      router.push("/products");
    } catch (err: any) {
      setFormError(err.message || "Lỗi khi tạo sản phẩm");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <PageHeader
        backHref="/products"
        title="Thêm Sản Phẩm Mới"
        description="Xác định phân loại hàng hóa và bản chất kinh doanh để biểu mẫu tinh giản tối ưu."
      />

      {formError && (
        <AlertBanner
          type="error"
          message={formError}
          onClose={() => setFormError(null)}
        />
      )}

      {/* =========================================================================
          BƯỚC 1: PHÂN LOẠI SẢN PHẨM (PRODUCT TYPE) - ĐẦU FORM
      ========================================================================= */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-text-sub">
          1. Phân loại sản phẩm trong chuỗi cung ứng *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRODUCT_TYPES.map((pt) => {
            const Icon = pt.icon;
            const isSelected = productType === pt.key;
            return (
              <button
                type="button"
                key={pt.key}
                onClick={() => setProductType(pt.key)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? "border-brand bg-surface-card ring-2 ring-brand/20 shadow-xs"
                    : "border-border-default bg-surface-card hover:bg-surface-app"
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-brand absolute top-3 right-3" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        isSelected
                          ? "bg-brand text-white border-brand"
                          : "bg-surface-app text-text-sub border-border-subtle"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-text-main">
                      {pt.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-sub leading-snug line-clamp-2">
                    {pt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          BƯỚC 2: CHỌN BẢN CHẤT HÀNG HÓA (PRODUCT ARCHETYPE)
      ========================================================================= */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-text-sub">
          2. Bản chất thương mại (Cách 2 - Tinh giản giao diện) *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ARCHETYPES.map((arch) => {
            const Icon = arch.icon;
            const isSelected = archetype === arch.key;
            return (
              <button
                type="button"
                key={arch.key}
                onClick={() => setArchetype(arch.key)}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? "border-brand bg-surface-card ring-2 ring-brand/20 shadow-xs"
                    : "border-border-default bg-surface-card hover:bg-surface-app"
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-brand absolute top-3 right-3" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        isSelected
                          ? "bg-brand text-white border-brand"
                          : "bg-surface-app text-text-sub border-border-subtle"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-text-main line-clamp-1">
                      {arch.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-sub leading-snug line-clamp-2">
                    {arch.desc}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[10px] font-mono text-text-disabled">
                    {arch.subLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* =========================================================================
            KHỐI 3: THÔNG TIN CƠ BẢN
        ========================================================================= */}
        <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-border-default shadow-xs space-y-4">
          <div className="border-b border-border-subtle pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main">
              3. Thông tin định danh & Cấu hình ĐVT
            </h2>
            <Badge variant="default">Cơ sở dữ liệu</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tên sản phẩm */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text-main mb-1">
                Tên sản phẩm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Bia Heineken Lon 330ml, Áo Thun Polo Cotton, Trà Sữa Trân Châu Đường Đen..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                className="w-full px-3.5 py-2 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
              />
            </div>

            {/* Mã sản phẩm */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Mã sản phẩm / SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: BIA-HEINEKEN, AT-POLO, TRA-SUA"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            {/* Barcode gốc */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Mã vạch Barcode (Đơn vị gốc)
              </label>
              <input
                type="text"
                placeholder="893000000001 (Quét hoặc tự gõ)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.trim())}
                className="w-full px-3.5 py-2 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            {/* Danh mục (SearchableSelect phân cấp + Tạo nhanh inline) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-main">
                  Danh mục
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs text-brand hover:underline font-semibold"
                >
                  + Tạo nhanh danh mục
                </button>
              </div>

              <SearchableSelect
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                onCreate={async (query) => {
                  const created = await api.createCategory({ name: query });
                  setCategories((prev) => [...prev, created]);
                  setCategoryId(created.id);
                }}
                createLabel="Tạo danh mục mới"
                placeholder="Chọn danh mục..."
              />
            </div>

            {/* Đơn vị tính cơ sở (SearchableSelect + Tạo nhanh inline) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-main">
                  Đơn vị tính cơ sở <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(true)}
                  className="text-xs text-brand hover:underline font-semibold"
                >
                  + Tạo nhanh ĐVT
                </button>
              </div>

              <SearchableSelect
                options={unitOptions.length > 0 ? unitOptions : COMMON_UOMS.map((u) => ({ value: u, label: u }))}
                value={baseUom}
                onChange={handleBaseUomChange}
                onCreate={async (query) => {
                  const created = await api.createUnit({ name: query });
                  setUnits((prev) => [...prev, created]);
                  handleBaseUomChange(created.name.toLowerCase());
                }}
                createLabel="Tạo ĐVT mới"
                placeholder="Chọn ĐVT cơ sở..."
              />
            </div>

            {/* Hạn sử dụng mặc định & Cảnh báo cận date */}
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Hạn sử dụng mặc định (Số ngày)
              </label>
              <input
                type="number"
                min="0"
                placeholder="VD: 30 (Tự tính HSD khi nhập hàng)"
                value={shelfLifeDays !== null ? shelfLifeDays : ""}
                onChange={(e) =>
                  setShelfLifeDays(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3.5 py-2 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Cảnh báo cận date trước (Số ngày)
              </label>
              <input
                type="number"
                min="0"
                placeholder="VD: 7 (Cảnh báo trước 7 ngày)"
                value={expiryWarningDays !== null ? expiryWarningDays : ""}
                onChange={(e) =>
                  setExpiryWarningDays(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full px-3.5 py-2 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            {/* Ảnh đại diện */}
            <div className="md:col-span-2 pt-2 border-t border-border-subtle">
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                onRemove={() => setImageUrl("")}
                label="Ảnh đại diện sản phẩm"
              />
            </div>
          </div>

          {/* Pricing & Stock inputs for non-matrix, non-fnb size products */}
          {archetype !== "MATRIX" && (archetype !== "MANUFACTURED" || !hasSizes) && (
            <div className="pt-4 border-t border-border-subtle space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-sub block">
                Định giá & Tồn kho ban đầu ({baseUom})
              </span>
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
                    className="w-full px-3 py-2 text-sm bg-surface-app border border-border-default rounded-lg text-right font-mono font-semibold text-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Giá vốn ban đầu WAC (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={costPrice || ""}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-surface-app border border-border-default rounded-lg text-right font-mono text-text-main"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Giá sàn tối thiểu (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={minSellingPrice || ""}
                    onChange={(e) => setMinSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-surface-app border border-border-default rounded-lg text-right font-mono text-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-sub mb-1">
                    Số lượng tồn ban đầu
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={initialStock || ""}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-surface-app border border-border-default rounded-lg text-right font-mono font-bold text-text-main"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            KHỐI 4 (CHUYÊN NGÀNH): CHỈ HIỂN THỊ ĐÚNG 1 KHỐI THEO ARCHETYPE
        ========================================================================= */}

        {/* NHÓM 1: ĐA ĐƠN VỊ TÍNH (STANDARD) */}
        {archetype === "STANDARD" && (
          <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-emerald-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-brand" />
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    4. Bảng quy đổi Đa Đơn Vị Tính & Barcode riêng
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Hỗ trợ quét barcode thùng, lốc, lon tại POS với giá bán riêng từng quy cách.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplySuggestedConversions}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20 hover:bg-brand/20 transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Gợi ý quy đổi &quot;{baseUom}&quot;</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddConversion}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-brand px-3 py-1.5 rounded-lg hover:bg-brand-hover transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm đơn vị</span>
                </button>
              </div>
            </div>

            {conversions.length === 0 ? (
              <div className="text-xs text-text-sub italic bg-surface-app p-4 rounded-lg border border-dashed border-border-default text-center space-y-2">
                <p>
                  Sản phẩm hiện bán theo đơn vị gốc &quot;{baseUom}&quot;. Bấm &quot;Thêm đơn vị&quot; nếu bán thêm theo Thùng, Lốc hoặc Hộp.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversions.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface-app rounded-lg border border-border-default grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-text-sub mb-0.5">
                        Tên ĐVT phụ
                      </label>
                      <SearchableSelect
                        options={unitOptions.length > 0 ? unitOptions : COMMON_UOMS.map((u) => ({ value: u, label: u }))}
                        value={row.uom_name}
                        onChange={(val) => handleConversionChange(idx, "uom_name", val)}
                        onCreate={async (query) => {
                          const created = await api.createUnit({ name: query });
                          setUnits((prev) => [...prev, created]);
                          handleConversionChange(idx, "uom_name", created.name.toLowerCase());
                        }}
                        createLabel="Tạo ĐVT mới"
                        placeholder="Chọn hoặc tạo ĐVT..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-text-sub mb-0.5">
                        Hệ số quy đổi ({baseUom})
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.0001"
                        placeholder="24"
                        value={row.conversion_factor}
                        onChange={(e) =>
                          handleConversionChange(
                            idx,
                            "conversion_factor",
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded font-mono text-right text-text-main"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-text-sub mb-0.5">
                        Mã vạch Barcode riêng
                      </label>
                      <input
                        type="text"
                        placeholder="893000000024"
                        value={row.barcode || ""}
                        onChange={(e) =>
                          handleConversionChange(idx, "barcode", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded font-mono text-text-main"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-text-sub mb-0.5">
                        Giá bán ĐVT này (VND)
                      </label>
                      <input
                        type="number"
                        step="500"
                        min="0"
                        placeholder="VD: 240.000"
                        value={row.selling_price || ""}
                        onChange={(e) =>
                          handleConversionChange(
                            idx,
                            "selling_price",
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded font-mono text-right text-brand font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveConversion(idx)}
                        className="text-text-disabled hover:text-rose-600 p-1 rounded"
                        title="Xóa ĐVT này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* NHÓM 2: MA TRẬN MÀU × SIZE (MATRIX) */}
        {archetype === "MATRIX" && (
          <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-purple-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    4. Ma trận thuộc tính Màu sắc × Kích cỡ & Ảnh từng SKU
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Tổ hợp thuộc tính để tự động tạo danh sách SKU bán lẻ thời trang kèm ảnh và HSD riêng.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {attributes.map((attr, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-surface-app rounded-lg border border-border-default"
                >
                  <div className="w-1/3">
                    <label className="block text-[11px] font-semibold text-text-sub mb-1">
                      Tên thuộc tính
                    </label>
                    <input
                      type="text"
                      placeholder="Màu sắc, Size..."
                      value={attr.name}
                      onChange={(e) =>
                        handleAttributeChange(idx, "name", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded font-medium"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-text-sub mb-1">
                      Các giá trị (phân tách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      placeholder="Đỏ, Đen, Trắng hoặc S, M, L, XL"
                      value={attr.valuesStr}
                      onChange={(e) =>
                        handleAttributeChange(idx, "valuesStr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded"
                    />
                  </div>
                  {attributes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(idx)}
                      className="text-text-disabled hover:text-rose-600 p-1 mt-4"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddAttribute}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Thêm thuộc tính</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateMatrix}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" />
                  <span>Sinh danh sách SKU</span>
                </Button>
              </div>

              {generatedVariants.length > 0 && (
                <div className="pt-3 border-t border-border-subtle space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                    <span>Đã sinh {generatedVariants.length} SKU biến thể</span>
                    <button
                      type="button"
                      onClick={handleApplyBulkPrices}
                      className="text-purple-700 hover:underline"
                    >
                      Đồng bộ giá chung cho tất cả
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-border-default rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-50 text-purple-950 font-semibold border-b border-border-default">
                        <tr>
                          <th className="py-2.5 px-3 text-left w-16">Ảnh</th>
                          <th className="py-2.5 px-3 text-left">Mã SKU</th>
                          <th className="py-2.5 px-3 text-left">Quy cách</th>
                          <th className="py-2.5 px-3 text-right w-28">Giá bán</th>
                          <th className="py-2.5 px-3 text-right w-28">Giá vốn</th>
                          <th className="py-2.5 px-3 text-right w-24">Tồn đầu</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default bg-surface-card">
                        {generatedVariants.map((v, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3">
                              {v.image_url ? (
                                <div className="relative w-8 h-8 rounded border border-border-default overflow-hidden group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={v.image_url}
                                    alt="thumb"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateVariant(i, "image_url", "")}
                                    className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px]"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <label className="w-8 h-8 rounded border border-dashed border-border-default hover:border-brand flex items-center justify-center cursor-pointer text-text-sub hover:text-brand">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const up = await api.uploadFile(file);
                                          handleUpdateVariant(i, "image_url", up.file_url);
                                        } catch {}
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-text-main">
                              <input
                                type="text"
                                value={v.sku}
                                onChange={(e) =>
                                  handleUpdateVariant(i, "sku", e.target.value)
                                }
                                className="w-full px-2 py-1 bg-surface-app border border-border-default rounded font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-text-main">
                              {v.variant_name}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={v.base_selling_price}
                                onChange={(e) =>
                                  handleUpdateVariant(
                                    i,
                                    "base_selling_price",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-right font-mono text-brand font-semibold text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={v.cost_price}
                                onChange={(e) =>
                                  handleUpdateVariant(
                                    i,
                                    "cost_price",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-right font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={v.current_stock}
                                onChange={(e) =>
                                  handleUpdateVariant(
                                    i,
                                    "current_stock",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-right font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(i)}
                                className="text-text-disabled hover:text-rose-600 p-1"
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
          </section>
        )}

        {/* NHÓM 3: HÀNG TƯƠI SỐNG / CÂN KÝ (CATCH_WEIGHT) */}
        {archetype === "CATCH_WEIGHT" && (
          <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-cyan-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-600" />
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    4. Cân điện tử & Quản lý Lô / Hạn sử dụng
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Hàng hóa tươi sống (cá, thịt, tôm) cần nhập trọng lượng thực tế tại POS và theo dõi cận date.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start gap-2.5 p-3.5 bg-surface-app rounded-lg border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWeighable}
                  onChange={(e) => setIsWeighable(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="text-xs font-bold text-text-main block">
                    Bắt buộc cân ký thực tế tại quầy POS
                  </span>
                  <span className="text-[11px] text-text-sub block mt-0.5">
                    Khi thu ngân quét sản phẩm, màn hình POS sẽ bật cửa sổ cân trọng lượng (kg).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3.5 bg-surface-app rounded-lg border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackBatches}
                  onChange={(e) => setTrackBatches(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="text-xs font-bold text-text-main block">
                    Theo dõi Số lô & Hạn sử dụng (Batch/Expiry)
                  </span>
                  <span className="text-[11px] text-text-sub block mt-0.5">
                    Theo dõi ngày đánh bắt, hạn dùng ngắn ngày và tự động cảnh báo cận date.
                  </span>
                </div>
              </label>
            </div>
          </section>
        )}

        {/* NHÓM 4: CHẾ BIẾN / F&B (MANUFACTURED) - SIZES & TOPPINGS */}
        {archetype === "MANUFACTURED" && (
          <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-indigo-300 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    4. Cấu hình F&B: Kích cỡ (Sizes) & Toppings (Chọn từ Sản phẩm)
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Topping là sản phẩm nguyên liệu trong kho, tự động trừ kho nguyên liệu khi bán.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. Sizes configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-text-main">
                  <input
                    type="checkbox"
                    checked={hasSizes}
                    onChange={(e) => setHasSizes(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Bán theo nhiều kích cỡ (Size S, M, L...)</span>
                </label>
                {hasSizes && (
                  <button
                    type="button"
                    onClick={handleAddFnbSize}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Size</span>
                  </button>
                )}
              </div>

              {hasSizes && (
                <div className="space-y-2">
                  {fnbSizes.map((sz, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 bg-surface-app rounded-lg border border-border-default"
                    >
                      <div className="flex-1">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Tên kích cỡ
                        </label>
                        <input
                          type="text"
                          placeholder="Size M, Size L..."
                          value={sz.name}
                          onChange={(e) =>
                            handleUpdateFnbSize(idx, "name", e.target.value)
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded font-medium"
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Giá bán (VND)
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={sz.price}
                          onChange={(e) =>
                            handleUpdateFnbSize(idx, "price", Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono font-bold text-brand"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Giá vốn ước tính
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={sz.cost}
                          onChange={(e) =>
                            handleUpdateFnbSize(idx, "cost", Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono text-text-sub"
                        />
                      </div>
                      {fnbSizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFnbSize(idx)}
                          className="p-1 text-text-disabled hover:text-rose-600 mt-3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Toppings / Modifiers (Chọn từ sản phẩm có sẵn + Tạo nhanh) */}
            <div className="space-y-3 pt-3 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-text-main">
                    Đồ kèm / Toppings cho món này (Liên kết kho sản phẩm)
                  </h3>
                  <p className="text-[11px] text-text-sub">
                    Chọn từ sản phẩm nguyên vật liệu có sẵn, hoặc tạo nhanh nguyên liệu mới để tự trừ kho.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsToppingModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-brand font-bold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tạo mới nguyên liệu Topping</span>
                  </button>
                </div>
              </div>

              {/* Quick selector from existing catalog */}
              <div className="flex items-center gap-2 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-200">
                <span className="text-xs font-semibold text-indigo-900 shrink-0">
                  Thêm từ danh mục:
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddFnbModifierFromExisting(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-indigo-300 rounded focus:outline-none focus:border-indigo-500 font-medium text-text-main"
                >
                  <option value="">-- Chọn sản phẩm làm topping (Đồ ăn, thức uống, nguyên liệu) --</option>
                  {eligibleToppingProducts.map((p) =>
                    (p.variants || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        [{p.product_type === "RAW_MATERIAL" ? "Nguyên liệu" : "Món"}] {p.name}{" "}
                        {v.variant_name !== p.name ? `(${v.variant_name})` : ""} - Bán: {formatVND(Number(v.base_selling_price || 0))}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Toppings Table */}
              {fnbModifiers.length > 0 && (
                <div className="space-y-2">
                  {fnbModifiers.map((mod, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 bg-surface-app rounded-lg border border-border-default"
                    >
                      <div className="flex-1">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Tên món kèm
                        </label>
                        <input
                          type="text"
                          value={mod.name}
                          onChange={(e) =>
                            handleUpdateFnbModifier(idx, "name", e.target.value)
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded font-medium"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Giá cộng thêm (VND)
                        </label>
                        <input
                          type="number"
                          step="500"
                          value={mod.price}
                          onChange={(e) =>
                            handleUpdateFnbModifier(idx, "price", Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono font-semibold text-brand"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-[10px] text-text-sub mb-0.5 font-medium">
                          Số lượng trừ kho
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          value={mod.deduct_qty ?? 1}
                          onChange={(e) =>
                            handleUpdateFnbModifier(idx, "deduct_qty", Number(e.target.value))
                          }
                          className="w-full px-2.5 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono text-text-main"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFnbModifier(idx)}
                        className="p-1 text-text-disabled hover:text-rose-600 mt-3"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Production Mode */}
            <div className="pt-3 border-t border-border-subtle space-y-2">
              <label className="text-xs font-bold text-text-main block">
                Chế độ Trừ kho & Sản xuất
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {PRODUCTION_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      productionMode === mode.value
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500"
                        : "border-border-default bg-surface-app hover:bg-surface-card"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <input
                        type="radio"
                        name="prod_mode"
                        value={mode.value}
                        checked={productionMode === mode.value}
                        onChange={(e) => setProductionMode(e.target.value)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-text-main">
                        {mode.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-sub pl-5 leading-relaxed">
                      {mode.desc}
                    </p>
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* NHÓM 5: COMBO / GÓI SẢN PHẨM (COMBO) */}
        {archetype === "COMBO" && (
          <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-teal-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    4. Cấu hình Thành phần Gói Combo (Bundling)
                  </h2>
                  <p className="text-xs text-text-sub mt-0.5">
                    Gói combo gồm nhiều sản phẩm con cấu thành. Khi bán tại POS, hệ thống tự động trừ kho từng món thành phần.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick add product to combo */}
            <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-teal-50/50 rounded-lg border border-teal-200">
              <span className="text-xs font-semibold text-teal-900 shrink-0">
                Thêm sản phẩm vào combo:
              </span>
              <div className="flex-1 w-full">
                <SearchableSelect
                  options={allProducts.flatMap((p) =>
                    (p.variants || []).map((v) => ({
                      value: v.id,
                      label: `${p.name} ${v.variant_name && v.variant_name !== p.name ? `(${v.variant_name})` : ""}`,
                      subLabel: `Mã: ${v.sku} - Giá vốn: ${formatVND(Number(v.cost_price || 0))} - Bán: ${formatVND(Number(v.base_selling_price || 0))}`,
                      badge: p.base_uom,
                    }))
                  )}
                  value=""
                  onChange={(val) => handleAddComboComponent(val)}
                  placeholder="Tìm và chọn sản phẩm thành phần..."
                />
              </div>
            </div>

            {/* Components table */}
            {comboComponents.length === 0 ? (
              <div className="text-xs text-text-sub italic bg-surface-app p-4 rounded-lg border border-dashed border-border-default text-center">
                Chưa có mặt hàng nào trong combo. Chọn sản phẩm ở ô trên để thêm vào gói.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border border-border-default rounded-lg overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                      <tr>
                        <th className="py-2 px-3 text-left">Sản phẩm thành phần</th>
                        <th className="py-2 px-3 text-right w-24">Số lượng</th>
                        <th className="py-2 px-3 text-right w-32">Giá vốn thành phần</th>
                        <th className="py-2 px-3 text-right w-32">Giá lẻ thông thường</th>
                        <th className="py-2 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default bg-surface-card">
                      {comboComponents.map((comp, idx) => (
                        <tr key={comp.variant_id} className="hover:bg-surface-app/40">
                          <td className="py-2 px-3 text-text-main">
                            <div className="font-semibold">{comp.product_name}</div>
                            {comp.variant_name !== comp.product_name && (
                              <div className="text-[11px] text-text-sub">{comp.variant_name}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0.01"
                              step="1"
                              value={comp.qty}
                              onChange={(e) =>
                                handleUpdateComboComponentQty(idx, Number(e.target.value))
                              }
                              className="w-16 px-2 py-1 text-xs bg-surface-app border border-border-default rounded text-right font-mono font-bold text-text-main"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-text-sub tabular-nums">
                            {formatVND(comp.cost_price * comp.qty)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-text-main tabular-nums">
                            {formatVND(comp.selling_price * comp.qty)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveComboComponent(idx)}
                              className="p-1 text-text-disabled hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary calculation */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-surface-app rounded-lg border border-border-default text-xs">
                  <div>
                    <span className="text-text-sub">Tổng giá lẻ các món: </span>
                    <span className="font-mono font-bold text-text-main">
                      {formatVND(suggestedComboRetail)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-sub">Tổng giá vốn các món: </span>
                    <span className="font-mono font-bold text-rose-600">
                      {formatVND(suggestedComboCost)}
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                    💡 Giá bán combo và giá vốn đã được đồng bộ tự động lên phần định giá!
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Action Bottom Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <Link href="/products">
            <Button variant="secondary" size="sm">
              Hủy bỏ
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            <span>Lưu sản phẩm</span>
          </Button>
        </div>
      </form>

      {/* =========================================================================
          MODAL CON 1: TẠO NHANH DANH MỤC (ÁP DỤNG NGAY)
      ========================================================================= */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Tạo Danh Mục Mới"
        >
          <form onSubmit={handleQuickCreateCategory} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên danh mục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ví dụ: Đồ Uống, Trà Sữa, Hải Sản Tươi, Quần Áo..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-medium text-text-main"
              />
            </div>
            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsCategoryModalOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Lưu & Chọn ngay</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL CON 2: TẠO NHANH ĐƠN VỊ TÍNH (ÁP DỤNG NGAY)
      ========================================================================= */}
      {isUnitModalOpen && (
        <Modal
          isOpen={isUnitModalOpen}
          onClose={() => setIsUnitModalOpen(false)}
          title="Tạo Đơn Vị Tính Mới"
        >
          <form onSubmit={handleQuickCreateUnit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên đơn vị tính <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ví dụ: ly, cốc, phần, đĩa, đòn, set..."
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-medium text-text-main"
              />
            </div>
            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsUnitModalOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Lưu & Chọn ngay</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL CON 3: TẠO NHANH TOPPING / NGUYÊN LIỆU (ÁP DỤNG NGAY)
      ========================================================================= */}
      {isToppingModalOpen && (
        <Modal
          isOpen={isToppingModalOpen}
          onClose={() => setIsToppingModalOpen(false)}
          title="Tạo Mới Nguyên Liệu / Topping F&B"
        >
          <form onSubmit={handleQuickCreateTopping} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên nguyên liệu / Topping <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ví dụ: Trân châu hoàng kim, Kem phô mai, Trứng cút lộn..."
                value={newToppingName}
                onChange={(e) => setNewToppingName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-medium text-text-main"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">
                  Giá bán phụ thu (VND)
                </label>
                <input
                  type="number"
                  step="500"
                  value={newToppingPrice}
                  onChange={(e) => setNewToppingPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg font-mono font-bold text-brand text-right focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">
                  Giá vốn ước tính (VND)
                </label>
                <input
                  type="number"
                  step="500"
                  value={newToppingCost}
                  onChange={(e) => setNewToppingCost(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg font-mono text-text-main text-right focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Đơn vị định lượng
              </label>
              <input
                type="text"
                value={newToppingUom}
                onChange={(e) => setNewToppingUom(e.target.value)}
                placeholder="phần, muỗng, g, ml..."
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-mono text-text-main"
              />
            </div>

            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              Món này sẽ tự động lưu vào CSDL dưới dạng <strong>Nguyên vật liệu (RAW_MATERIAL)</strong> và thêm vào danh sách Topping kèm định lượng trừ kho.
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsToppingModalOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Lưu & Thêm vào Topping</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
