"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, Product, Category, ProductVariant, Unit, ProductArchetype } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  TableToolbar,
  LoadingState,
  EmptyState,
  AlertBanner,
  Modal,
  ConfirmDialog,
  ImageUploader,
  SearchableSelect,
} from "@/components/common";
import {
  Package,
  Plus,
  Scale,
  Layers,
  Factory,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Tag,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Clock,
  Boxes,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  Coffee,
  ArrowRightLeft,
  Wrench,
  CookingPot,
} from "lucide-react";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FINISHED_GOOD: "Thành phẩm",
  RAW_MATERIAL: "Nguyên vật liệu",
  WIP_SEMI_FINISHED: "Bán thành phẩm",
  SERVICE: "Dịch vụ",
  COMBO: "Gói / Combo",
};

interface ConversionRow {
  uom_name: string;
  conversion_factor: number;
  is_variable_ratio: boolean;
  default_price_for_uom?: number;
  barcode?: string;
  selling_price?: number;
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

interface ComboComponentRow {
  variant_id: string;
  product_name: string;
  variant_name: string;
  qty: number;
  cost_price: number;
  selling_price: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Action Modals State
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Edit Modal Tabs & Form State
  const [editTab, setEditTab] = useState<"INFO" | "CONFIG">("INFO");
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editProductType, setEditProductType] = useState("FINISHED_GOOD");
  const [editArchetype, setEditArchetype] = useState<ProductArchetype>("STANDARD");
  const [editBaseUom, setEditBaseUom] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editShelfLife, setEditShelfLife] = useState<number | null>(null);
  const [editExpiryWarning, setEditExpiryWarning] = useState<number | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);
  const [editMinSellingPrice, setEditMinSellingPrice] = useState<number>(0);
  const [editIsWeighable, setEditIsWeighable] = useState(false);
  const [editTrackBatches, setEditTrackBatches] = useState(false);
  const [editProductionMode, setEditProductionMode] = useState("NONE");
  const [editConversions, setEditConversions] = useState<ConversionRow[]>([]);
  const [editFnbSizes, setEditFnbSizes] = useState<FnbSizeRow[]>([]);
  const [editFnbModifiers, setEditFnbModifiers] = useState<FnbModifierRow[]>([]);
  const [editComboComponents, setEditComboComponents] = useState<ComboComponentRow[]>([]);
  const [editVariants, setEditVariants] = useState<Partial<ProductVariant>[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, unitRes] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getUnits(true).catch(() => []),
      ]);
      setProducts(prodRes || []);
      setCategories(catRes || []);
      setUnits(unitRes || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

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

  const unitOptions = useMemo(() => {
    return units.map((u) => ({
      value: u.name.toLowerCase(),
      label: u.name,
    }));
  }, [units]);

  // Food / Beverage / Raw materials for Toppings (strictly excludes clothing / fashion)
  const eligibleToppingProducts = useMemo(() => {
    return products.filter((p) => {
      if (editingProduct && p.id === editingProduct.id) return false;
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
  }, [products, categories, editingProduct]);

  const handleOpenEdit = async (p: Product) => {
    setEditingProduct(p);
    setEditTab("INFO");
    setEditName(p.name);
    setEditCode(p.code);
    setEditCategoryId(p.category_id || "");
    setEditProductType(p.product_type || "FINISHED_GOOD");
    setEditArchetype(p.archetype || "STANDARD");
    setEditBaseUom(p.base_uom || "cái");
    setEditImageUrl(p.image_url || "");
    setEditShelfLife(p.shelf_life_days ?? null);
    setEditExpiryWarning(p.expiry_warning_days ?? null);
    setEditIsWeighable(Boolean(p.is_weighable));
    setEditTrackBatches(Boolean(p.track_batches));
    setEditProductionMode(p.production_mode || "NONE");

    const vars = (p.variants || []).map((v) => ({ ...v }));
    setEditVariants(vars);

    const firstVar = vars[0];
    if (firstVar) {
      setEditSellingPrice(Number(firstVar.base_selling_price || 0));
      setEditCostPrice(Number(firstVar.cost_price || 0));
      setEditMinSellingPrice(Number(firstVar.min_selling_price || 0));
    } else {
      setEditSellingPrice(0);
      setEditCostPrice(0);
      setEditMinSellingPrice(0);
    }

    // Initialize F&B sizes from variants
    const sizes = vars
      .filter((v) =>
        typeof v.attributes === "string"
          ? v.attributes.includes("Size")
          : Boolean(v.attributes && typeof v.attributes === "object" && (v.attributes as Record<string, any>).Size)
      )
      .map((v) => {
        let sizeName = v.variant_name;
        try {
          const parsed = typeof v.attributes === "string" ? JSON.parse(v.attributes || "{}") : v.attributes || {};
          if (parsed.Size) sizeName = parsed.Size;
        } catch {}
        return {
          name: sizeName || "Size tiêu chuẩn",
          price: Number(v.base_selling_price || 0),
          cost: Number(v.cost_price || 0),
        };
      });
    setEditFnbSizes(
      sizes.length > 0
        ? sizes
        : [
            { name: "Size M (Vừa)", price: 25000, cost: 10000 },
            { name: "Size L (Lớn)", price: 32000, cost: 13000 },
          ]
    );

    // Conversions & Modifiers from full detail
    setEditConversions([]);
    setEditFnbModifiers([]);
    setEditComboComponents([]);

    try {
      const detail = await api.getProductDetail(p.id);
      if (detail) {
        if (detail.variants?.[0]?.uom_conversions) {
          setEditConversions(
            detail.variants[0].uom_conversions.map((uc: any) => ({
              uom_name: uc.uom_name,
              conversion_factor: Number(uc.conversion_factor || 1),
              is_variable_ratio: Boolean(uc.is_variable_ratio),
              selling_price: uc.selling_price ? Number(uc.selling_price) : undefined,
              barcode: uc.barcode || "",
            }))
          );
        }
        if (detail.modifier_groups && detail.modifier_groups.length > 0) {
          const mg = detail.modifier_groups[0].modifier_group;
          if (mg?.items) {
            setEditFnbModifiers(
              mg.items.map((it: any) => ({
                name: it.name,
                price: Number(it.price || 0),
                linked_variant_id: it.linked_variant_id,
                deduct_qty: Number(it.deduct_qty || 1),
              }))
            );
          }
        }
      }
    } catch (err) {
      console.warn("Lỗi khi tải chi tiết conversions / modifiers:", err);
    }
  };

  // UOM Conversion Handlers
  const handleAddEditConversion = () => {
    setEditConversions((prev) => [
      ...prev,
      {
        uom_name: "thùng",
        conversion_factor: 24,
        is_variable_ratio: false,
        selling_price: editSellingPrice ? editSellingPrice * 24 : undefined,
      },
    ]);
  };

  const handleUpdateEditConversion = (idx: number, field: keyof ConversionRow, val: any) => {
    setEditConversions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveEditConversion = (idx: number) => {
    setEditConversions((prev) => prev.filter((_, i) => i !== idx));
  };

  // F&B Size Handlers
  const handleAddEditFnbSize = () => {
    setEditFnbSizes((prev) => [
      ...prev,
      { name: `Size ${prev.length + 1}`, price: editSellingPrice || 30000, cost: editCostPrice || 12000 },
    ]);
  };

  const handleUpdateEditFnbSize = (idx: number, field: keyof FnbSizeRow, val: any) => {
    setEditFnbSizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveEditFnbSize = (idx: number) => {
    setEditFnbSizes((prev) => prev.filter((_, i) => i !== idx));
  };

  // Topping Handlers
  const handleAddEditFnbModifierFromExisting = (variantId: string) => {
    for (const p of products) {
      const v = (p.variants || []).find((varItem) => varItem.id === variantId);
      if (v) {
        setEditFnbModifiers((prev) => [
          ...prev,
          {
            name: `${p.name} ${v.variant_name !== p.name ? `(${v.variant_name})` : ""}`.trim(),
            price: Number(v.base_selling_price || 5000),
            linked_variant_id: v.id,
            deduct_qty: 1,
          },
        ]);
        break;
      }
    }
  };

  const handleUpdateEditFnbModifier = (idx: number, field: keyof FnbModifierRow, val: any) => {
    setEditFnbModifiers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveEditFnbModifier = (idx: number) => {
    setEditFnbModifiers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Combo Handlers
  const handleAddEditComboComponent = (variantId: string) => {
    if (!variantId) return;
    for (const p of products) {
      const v = (p.variants || []).find((varItem) => varItem.id === variantId);
      if (v) {
        if (editComboComponents.some((c) => c.variant_id === v.id)) return;
        setEditComboComponents((prev) => [
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

  const handleUpdateEditComboComponentQty = (idx: number, qty: number) => {
    setEditComboComponents((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(0.01, qty) };
      return next;
    });
  };

  const handleRemoveEditComboComponent = (idx: number) => {
    setEditComboComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const suggestedComboCost = useMemo(() => {
    return editComboComponents.reduce((sum, c) => sum + c.cost_price * c.qty, 0);
  }, [editComboComponents]);

  const suggestedComboRetail = useMemo(() => {
    return editComboComponents.reduce((sum, c) => sum + c.selling_price * c.qty, 0);
  }, [editComboComponents]);

  const handleAddEditVariant = () => {
    if (!editingProduct) return;
    const count = editVariants.length + 1;
    setEditVariants((prev) => [
      ...prev,
      {
        id: "",
        sku: `${editCode}_VAR${count}`,
        variant_name: `${editName} (Mẫu ${count})`,
        base_selling_price: editSellingPrice,
        cost_price: editCostPrice,
        min_selling_price: editCostPrice,
        shelf_life_days: editShelfLife,
        image_url: "",
      },
    ]);
  };

  const handleUpdateEditVariant = (idx: number, field: keyof ProductVariant, val: any) => {
    setEditVariants((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveEditVariant = (idx: number) => {
    setEditVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setIsSavingEdit(true);
    try {
      const uomConversionsPayload =
        editArchetype === "STANDARD"
          ? editConversions
              .filter((c) => c.uom_name.trim().length > 0 && c.conversion_factor > 0)
              .map((c) => ({
                uom_name: c.uom_name.trim().toLowerCase(),
                conversion_factor: Number(c.conversion_factor),
                is_variable_ratio: Boolean(c.is_variable_ratio),
                barcode: c.barcode?.trim() || undefined,
                selling_price: c.selling_price ? Number(c.selling_price) : undefined,
              }))
          : [];

      const createdModifierGroupIds: string[] = [];
      if (editArchetype === "MANUFACTURED" && editFnbModifiers.length > 0) {
        const validMods = editFnbModifiers.filter((m) => m.name.trim().length > 0);
        if (validMods.length > 0) {
          const modGroup = await api.createModifierGroup({
            name: `Topping / Món kèm - ${editName.trim()}`,
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

      let variantsToSave = editVariants;
      if (editArchetype === "MANUFACTURED" && editFnbSizes.length > 0) {
        variantsToSave = editFnbSizes.map((sz, idx) => {
          const existing = editVariants[idx];
          return {
            id: existing?.id || "",
            sku: `${editCode}_${sz.name.replace(/\s+/g, "").toUpperCase()}`,
            variant_name: `${editName.trim()} (${sz.name.trim()})`,
            attributes: JSON.stringify({ Size: sz.name.trim() }),
            cost_price: Number(sz.cost || 0),
            base_selling_price: Number(sz.price || 0),
            min_selling_price: Number(sz.cost || 0),
            shelf_life_days: editShelfLife,
            expiry_warning_days: editExpiryWarning,
          };
        });
      }

      await api.updateProduct(editingProduct.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        category_id: editCategoryId,
        product_type: editProductType,
        archetype: editArchetype,
        base_uom: editBaseUom.trim().toLowerCase(),
        image_url: editImageUrl.trim(),
        shelf_life_days: editShelfLife,
        expiry_warning_days: editExpiryWarning,
        is_weighable: editArchetype === "CATCH_WEIGHT" ? editIsWeighable : false,
        track_batches:
          editArchetype === "CATCH_WEIGHT" ? editTrackBatches : editShelfLife ? true : false,
        production_mode:
          editArchetype === "MANUFACTURED"
            ? (editProductionMode as any)
            : editArchetype === "COMBO"
            ? "POS_BACKFLUSH"
            : "NONE",
        base_selling_price: editSellingPrice,
        cost_price: editCostPrice,
        min_selling_price: editMinSellingPrice,
        uom_conversions: uomConversionsPayload,
        modifier_group_ids: createdModifierGroupIds,
        variants: variantsToSave as any,
      });

      if (editArchetype === "COMBO" && editComboComponents.length > 0 && editVariants[0]?.id) {
        await api
          .createBomRecipe({
            target_variant_id: editVariants[0].id,
            recipe_type: "ASSEMBLY",
            output_qty: 1,
            expected_wastage_percent: 0,
            items: editComboComponents.map((c) => ({
              component_variant_id: c.variant_id,
              qty_required: Number(c.qty || 1),
              cost_allocation_percent: 0,
            })),
          })
          .catch((e) => console.warn("Lỗi khi tạo định mức combo:", e));
      }

      setSuccessMsg(`Đã cập nhật sản phẩm "${editName}" thành công!`);
      setEditingProduct(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi khi cập nhật sản phẩm");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await api.deleteProduct(deletingProduct.id);
      setSuccessMsg(`Đã xóa sản phẩm "${deletingProduct.name}"!`);
      setDeletingProduct(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi khi xóa sản phẩm");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesCode = p.code.toLowerCase().includes(term);
        const matchesVariant = p.variants?.some(
          (v) =>
            v.sku.toLowerCase().includes(term) ||
            (v.variant_name && v.variant_name.toLowerCase().includes(term))
        );
        if (!matchesName && !matchesCode && !matchesVariant) return false;
      }

      if (selectedCategory !== "ALL" && p.category_id !== selectedCategory) {
        return false;
      }

      if (selectedType !== "ALL" && p.product_type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedType]);

  const getProductStats = (p: Product) => {
    const variants = p.variants || [];
    const variantCount = variants.length;
    const isMatrix = variantCount > 1 || p.archetype === "MATRIX";
    let totalStock = 0;
    let hasStockAlert = false;
    let minSelling = Infinity;
    let maxSelling = -Infinity;
    let minCost = Infinity;
    let maxCost = -Infinity;

    if (variantCount > 0) {
      for (const v of variants) {
        const stock = Number(v.current_stock ?? v.current_inventory ?? 0);
        totalStock += stock;
        const alertThreshold = Number(v.min_stock_alert ?? 0);
        if (alertThreshold > 0 && stock < alertThreshold) {
          hasStockAlert = true;
        }

        const sell = Number(v.base_selling_price || 0);
        const cost = Number(v.cost_price || 0);
        if (sell < minSelling) minSelling = sell;
        if (sell > maxSelling) maxSelling = sell;
        if (cost < minCost) minCost = cost;
        if (cost > maxCost) maxCost = cost;
      }
    } else {
      minSelling = 0;
      maxSelling = 0;
      minCost = 0;
      maxCost = 0;
    }

    if (minSelling === Infinity) minSelling = 0;
    if (maxSelling === -Infinity) maxSelling = 0;
    if (minCost === Infinity) minCost = 0;
    if (maxCost === -Infinity) maxCost = 0;

    return {
      variantCount,
      isMatrix,
      totalStock,
      hasStockAlert,
      minSelling,
      maxSelling,
      minCost,
      maxCost,
    };
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <PageHeader
        title="Quản lý Hàng hóa & Sản phẩm"
        description="Xem danh mục, điều chỉnh giá, chỉnh sửa chi tiết từng SKU và phân bổ ảnh biến thể."
        badge={
          <Badge variant="brand">
            {products.length} mặt hàng
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Link href="/products/new">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Thêm sản phẩm</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Alerts */}
      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {successMsg && (
        <AlertBanner
          type="success"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}

      {/* Search and Filters */}
      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo tên sản phẩm, mã SKU, barcode..."
        filters={
          <>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-text-sub shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-surface-muted/50 border border-border-subtle rounded-md focus:outline-none focus:border-brand text-text-main"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-text-sub shrink-0" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-surface-muted/50 border border-border-subtle rounded-md focus:outline-none focus:border-brand text-text-main"
              >
                <option value="ALL">Tất cả loại hàng</option>
                {Object.entries(PRODUCT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      {/* Main Table */}
      {isLoading ? (
        <LoadingState
          message="Đang tải danh mục hàng hóa..."
          submessage="Truy vấn CSDL Micro-ERP"
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm nào"
          description={
            searchTerm || selectedCategory !== "ALL" || selectedType !== "ALL"
              ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
              : "Hệ thống chưa có sản phẩm nào. Hãy tạo sản phẩm đầu tiên."
          }
          action={
            <Link href="/products/new">
              <Button variant="primary" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>Tạo sản phẩm mới</span>
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3 w-10 text-center"></th>
                  <th className="py-3 px-3 w-14 text-center">Ảnh</th>
                  <th className="py-3 px-3">Tên & Mã sản phẩm</th>
                  <th className="py-3 px-3">Phân loại</th>
                  <th className="py-3 px-3">Danh mục</th>
                  <th className="py-3 px-3 text-center">ĐVT</th>
                  <th className="py-3 px-3 text-right">Tồn khả dụng</th>
                  <th className="py-3 px-3 text-right">Giá bán & Giá vốn</th>
                  <th className="py-3 px-3">Đặc tính</th>
                  <th className="py-3 px-3 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredProducts.map((p) => {
                  const stats = getProductStats(p);
                  const isExpanded = expandedProductIds.has(p.id);

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-surface-app/50 transition-colors">
                        {/* Expand toggle */}
                        <td className="py-2.5 px-3 text-center">
                          {stats.isMatrix ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="p-1 hover:bg-surface-app rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-brand" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                        </td>

                        {/* Thumbnail */}
                        <td className="py-2.5 px-3 text-center">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-9 h-9 rounded object-cover border border-border-default mx-auto"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-surface-app border border-border-subtle flex items-center justify-center text-text-disabled mx-auto">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* Product Name & Code */}
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setViewingProduct(p)}
                            className="font-bold text-text-main hover:text-brand text-left line-clamp-1"
                          >
                            {p.name}
                          </button>
                          <div className="text-[11px] text-text-sub font-mono tabular-nums mt-0.5">
                            {p.code}
                          </div>
                        </td>

                        {/* Product Type */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.product_type === "RAW_MATERIAL"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : p.product_type === "WIP_SEMI_FINISHED"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : p.product_type === "SERVICE"
                                ? "bg-purple-50 text-purple-800 border border-purple-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {PRODUCT_TYPE_LABELS[p.product_type] || p.product_type}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-text-main">
                            {p.category?.name || "Chưa phân loại"}
                          </div>
                        </td>

                        {/* Base UOM */}
                        <td className="py-2.5 px-3 text-center font-mono">
                          <Badge variant="default">{p.base_uom}</Badge>
                        </td>

                        {/* Available Stock */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-bold text-text-main font-mono tabular-nums">
                            {formatQty(stats.totalStock, p.base_uom)}
                          </div>
                          {stats.hasStockAlert && (
                            <div className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Sắp hết</span>
                            </div>
                          )}
                        </td>

                        {/* Selling Price & WAC Cost */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="font-bold text-brand">
                            {stats.minSelling === stats.maxSelling
                              ? formatVND(stats.minSelling)
                              : `${formatVND(stats.minSelling)} - ${formatVND(stats.maxSelling)}`}
                          </div>
                          <div className="text-[11px] text-text-sub mt-0.5">
                            Vốn:{" "}
                            {stats.minCost === stats.maxCost
                              ? formatVND(stats.minCost)
                              : `${formatVND(stats.minCost)} - ${formatVND(stats.maxCost)}`}
                          </div>
                        </td>

                        {/* Module Badges */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {p.is_weighable && (
                              <Badge variant="catchweight">
                                <Scale className="w-3 h-3 mr-1" /> Cân ký
                              </Badge>
                            )}
                            {p.shelf_life_days && (
                              <Badge variant="alert">
                                <Clock className="w-3 h-3 mr-1" /> HSD: {p.shelf_life_days}d
                              </Badge>
                            )}
                            {p.production_mode && p.production_mode !== "NONE" && (
                              <Badge variant="bom">
                                <Factory className="w-3 h-3 mr-1" /> BOM
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingProduct(p)}
                              className="p-1.5 text-text-sub hover:text-brand hover:bg-surface-app rounded"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 text-text-sub hover:text-indigo-600 hover:bg-surface-app rounded"
                              title="Chỉnh sửa sản phẩm & SKU"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(p)}
                              className="p-1.5 text-text-sub hover:text-rose-600 hover:bg-surface-app rounded"
                              title="Xóa sản phẩm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Matrix Variants */}
                      {isExpanded && stats.isMatrix && (
                        <tr className="bg-purple-50/20">
                          <td colSpan={10} className="p-3 pl-12 border-b border-border-default">
                            <div className="bg-surface-card rounded-lg border border-border-default p-3 shadow-xs">
                              <div className="text-xs font-semibold text-purple-950 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Danh sách biến thể ({p.variants?.length} SKU)</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenEdit(p);
                                    setEditTab("CONFIG");
                                  }}
                                  className="text-purple-700 hover:underline font-bold"
                                >
                                  Chỉnh sửa các SKU này →
                                </button>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border-default text-text-sub font-semibold">
                                    <th className="py-1.5 px-2.5 text-left w-12">Ảnh</th>
                                    <th className="py-1.5 px-2.5 text-left">Mã SKU</th>
                                    <th className="py-1.5 px-2.5 text-left">Quy cách</th>
                                    <th className="py-1.5 px-2.5 text-right">Tồn kho</th>
                                    <th className="py-1.5 px-2.5 text-right">Giá bán</th>
                                    <th className="py-1.5 px-2.5 text-right">Giá vốn</th>
                                    <th className="py-1.5 px-2.5 text-center">HSD SKU</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-default font-mono tabular-nums">
                                  {p.variants?.map((v) => (
                                    <tr key={v.id} className="hover:bg-surface-app/40">
                                      <td className="py-1.5 px-2.5">
                                        {v.image_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={v.image_url}
                                            alt={v.sku}
                                            className="w-7 h-7 rounded object-cover border border-border-default"
                                          />
                                        ) : (
                                          <div className="w-7 h-7 rounded bg-surface-app border border-border-subtle flex items-center justify-center text-text-disabled">
                                            <ImageIcon className="w-3.5 h-3.5" />
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-2.5 font-bold text-text-main">
                                        {v.sku}
                                      </td>
                                      <td className="py-1.5 px-2.5 font-sans text-text-main">
                                        {v.variant_name || p.name}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-medium">
                                        {formatQty(v.current_stock ?? v.current_inventory ?? 0, p.base_uom)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-bold text-brand">
                                        {formatVND(v.base_selling_price)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right text-text-sub">
                                        {formatVND(v.cost_price)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-center font-sans text-text-sub">
                                        {v.shelf_life_days ? `${v.shelf_life_days}d` : p.shelf_life_days ? `${p.shelf_life_days}d (SP)` : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: XEM CHI TIẾT SẢN PHẨM
      ========================================================================= */}
      {viewingProduct && (
        <Modal
          isOpen={Boolean(viewingProduct)}
          onClose={() => setViewingProduct(null)}
          title={`Chi tiết sản phẩm: ${viewingProduct.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Basic Info & Photo */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-surface-app rounded-xl border border-border-default">
              {viewingProduct.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewingProduct.image_url}
                  alt={viewingProduct.name}
                  className="w-24 h-24 rounded-lg object-cover border border-border-default shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-surface-card border border-border-default flex items-center justify-center text-text-disabled shrink-0">
                  <Package className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-text-sub block">Mã sản phẩm (Code):</span>
                  <span className="font-mono font-bold text-text-main text-sm">
                    {viewingProduct.code}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-sub block">Phân loại:</span>
                  <span className="font-semibold text-text-main">
                    {PRODUCT_TYPE_LABELS[viewingProduct.product_type] || viewingProduct.product_type}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-sub block">Danh mục:</span>
                  <span className="font-semibold text-text-main">
                    {viewingProduct.category?.name || "Chưa phân loại"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-sub block">Đơn vị tính cơ sở:</span>
                  <span className="font-mono font-semibold text-brand">
                    {viewingProduct.base_uom}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-sub block">Bản chất hàng hóa:</span>
                  <Badge variant="default">{viewingProduct.archetype || "STANDARD"}</Badge>
                </div>
                {viewingProduct.shelf_life_days && (
                  <div>
                    <span className="text-[11px] text-text-sub block">Hạn dùng mặc định:</span>
                    <span className="font-mono text-text-main">
                      {viewingProduct.shelf_life_days} ngày
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Variants & Pricing */}
            <div>
              <span className="font-bold text-text-main block mb-2">
                Danh sách biến thể & Quy cách ({viewingProduct.variants?.length || 0})
              </span>
              <div className="border border-border-default rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                    <tr>
                      <th className="py-2 px-3 text-left w-12">Ảnh</th>
                      <th className="py-2 px-3 text-left">SKU</th>
                      <th className="py-2 px-3 text-left">Quy cách</th>
                      <th className="py-2 px-3 text-right">Giá bán</th>
                      <th className="py-2 px-3 text-right">Giá vốn</th>
                      <th className="py-2 px-3 text-right">Tồn kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card">
                    {(viewingProduct.variants || []).map((v) => (
                      <tr key={v.id}>
                        <td className="py-2 px-3">
                          {v.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.image_url}
                              alt={v.sku}
                              className="w-7 h-7 rounded object-cover border border-border-default"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-surface-app border border-border-subtle flex items-center justify-center text-text-disabled">
                              <ImageIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-text-main">
                          {v.sku}
                        </td>
                        <td className="py-2 px-3 text-text-main">
                          {v.variant_name || viewingProduct.name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-brand">
                          {formatVND(v.base_selling_price)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-text-sub">
                          {formatVND(v.cost_price)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-text-main">
                          {formatQty(v.current_stock ?? v.current_inventory ?? 0, viewingProduct.base_uom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              {viewingProduct.production_mode && viewingProduct.production_mode !== "NONE" ? (
                <Link
                  href="/production"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                >
                  <Factory className="w-3.5 h-3.5" />
                  <span>Quản lý định mức BOM & Chế biến →</span>
                </Link>
              ) : <div />}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const p = viewingProduct;
                  setViewingProduct(null);
                  handleOpenEdit(p);
                }}
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                <span>Chỉnh sửa sản phẩm & SKU</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: CHỈNH SỬA SẢN PHẨM TOÀN DIỆN & TỪNG SKU
      ========================================================================= */}
      {editingProduct && (
        <Modal
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          title={`Chỉnh sửa: ${editingProduct.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Modal Tabs Header */}
            <div className="flex items-center gap-1 border-b border-border-default pb-2">
              <button
                type="button"
                onClick={() => setEditTab("INFO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  editTab === "INFO"
                    ? "bg-brand text-white shadow-xs"
                    : "bg-surface-app text-text-sub hover:bg-surface-card"
                }`}
              >
                1. Thông tin chung & Định giá
              </button>
              <button
                type="button"
                onClick={() => setEditTab("CONFIG")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  editTab === "CONFIG"
                    ? "bg-brand text-white shadow-xs"
                    : "bg-surface-app text-text-sub hover:bg-surface-card"
                }`}
              >
                {editArchetype === "STANDARD" && <Package className="w-3.5 h-3.5" />}
                {editArchetype === "MATRIX" && <Layers className="w-3.5 h-3.5" />}
                {editArchetype === "CATCH_WEIGHT" && <Scale className="w-3.5 h-3.5" />}
                {editArchetype === "MANUFACTURED" && <Coffee className="w-3.5 h-3.5" />}
                {editArchetype === "COMBO" && <Boxes className="w-3.5 h-3.5" />}
                <span>
                  {editArchetype === "STANDARD" && `2. Quy đổi ĐVT & Barcode (${editConversions.length})`}
                  {editArchetype === "MATRIX" && `2. Quản lý SKU & Ảnh (${editVariants.length} SKU)`}
                  {editArchetype === "CATCH_WEIGHT" && "2. Cân điện tử & Lô HSD"}
                  {editArchetype === "MANUFACTURED" && `2. Kích cỡ & Topping (${editFnbModifiers.length})`}
                  {editArchetype === "COMBO" && `2. Thành phần Gói Combo (${editComboComponents.length})`}
                </span>
              </button>
            </div>

            {/* TAB 1: THÔNG TIN CHUNG & ĐỊNH GIÁ */}
            {editTab === "INFO" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Tên sản phẩm *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main font-medium focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Mã SKU / Code *
                    </label>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg font-mono text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Phân loại sản phẩm
                    </label>
                    <select
                      value={editProductType}
                      onChange={(e) => setEditProductType(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
                    >
                      {Object.entries(PRODUCT_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Bản chất hàng hóa (Archetype)
                    </label>
                    <select
                      value={editArchetype}
                      onChange={(e) => setEditArchetype(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand font-medium"
                    >
                      <option value="STANDARD">Hàng đóng gói / Tiêu chuẩn (Đa ĐVT)</option>
                      <option value="MATRIX">Thời trang / Đa biến thể (Màu × Size)</option>
                      <option value="CATCH_WEIGHT">Hàng tươi sống / Cân ký & Lô HSD</option>
                      <option value="MANUFACTURED">Chế biến / F&B (Size, Topping, BOM)</option>
                      <option value="COMBO">Combo / Gói sản phẩm (Tự trừ kho con)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Danh mục (Phân cấp)
                    </label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={editCategoryId}
                      onChange={setEditCategoryId}
                      onCreate={async (query) => {
                        const created = await api.createCategory({ name: query });
                        setCategories((prev) => [...prev, created]);
                        setEditCategoryId(created.id);
                      }}
                      createLabel="Tạo danh mục mới"
                      placeholder="Chọn danh mục..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Đơn vị tính cơ sở *
                    </label>
                    <SearchableSelect
                      options={unitOptions}
                      value={editBaseUom}
                      onChange={setEditBaseUom}
                      onCreate={async (query) => {
                        const created = await api.createUnit({ name: query });
                        setUnits((prev) => [...prev, created]);
                        setEditBaseUom(created.name.toLowerCase());
                      }}
                      createLabel="Tạo ĐVT mới"
                      placeholder="Chọn hoặc tạo ĐVT..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Hạn sử dụng mặc định (ngày)
                    </label>
                    <input
                      type="number"
                      placeholder="VD: 30"
                      value={editShelfLife !== null ? editShelfLife : ""}
                      onChange={(e) =>
                        setEditShelfLife(e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg font-mono text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-main mb-1">
                      Cảnh báo cận date trước (ngày)
                    </label>
                    <input
                      type="number"
                      placeholder="VD: 7"
                      value={editExpiryWarning !== null ? editExpiryWarning : ""}
                      onChange={(e) =>
                        setEditExpiryWarning(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg font-mono text-text-main focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Pricing Block for Standard / Single Variant */}
                <div className="p-3 bg-surface-app rounded-lg border border-border-default space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-sub block">
                    Định giá tiêu chuẩn ({editBaseUom})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                        Giá bán lẻ (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={editSellingPrice || ""}
                        onChange={(e) => setEditSellingPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-surface-card border border-border-default rounded text-right font-mono font-bold text-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                        Giá vốn WAC (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={editCostPrice || ""}
                        onChange={(e) => setEditCostPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-surface-card border border-border-default rounded text-right font-mono text-text-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-sub mb-0.5">
                        Giá sàn tối thiểu (VND)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={editMinSellingPrice || ""}
                        onChange={(e) => setEditMinSellingPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-surface-card border border-border-default rounded text-right font-mono text-rose-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Main Product Image */}
                <div className="pt-2 border-t border-border-subtle">
                  <ImageUploader
                    value={editImageUrl}
                    onChange={setEditImageUrl}
                    onRemove={() => setEditImageUrl("")}
                    label="Ảnh đại diện chính của sản phẩm"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: CẤU HÌNH CHUYÊN NGÀNH */}
            {editTab === "CONFIG" && (
              <div className="space-y-4">
                {/* 1. STANDARD: Multi-UOM Conversions */}
                {editArchetype === "STANDARD" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-text-main">
                          Bảng quy đổi Đa ĐVT ({editConversions.length} đơn vị)
                        </h3>
                        <p className="text-[11px] text-text-sub">
                          Quét mã vạch thùng, lon, lốc tại quầy POS với giá bán riêng từng quy cách.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddEditConversion}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Thêm ĐVT</span>
                      </Button>
                    </div>

                    {editConversions.length === 0 ? (
                      <div className="text-xs text-text-sub italic bg-surface-app p-4 rounded-lg border border-dashed border-border-default text-center">
                        Sản phẩm hiện chỉ bán theo ĐVT gốc &quot;{editBaseUom}&quot;. Bấm &quot;Thêm ĐVT&quot; để thiết lập bán theo Thùng, Lốc, Hộp.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editConversions.map((conv, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-surface-app rounded-lg border border-border-default grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                          >
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-text-sub font-semibold mb-0.5">
                                ĐVT phụ
                              </label>
                              <SearchableSelect
                                options={unitOptions}
                                value={conv.uom_name}
                                onChange={(val) => handleUpdateEditConversion(idx, "uom_name", val)}
                                onCreate={async (query) => {
                                  const created = await api.createUnit({ name: query });
                                  setUnits((prev) => [...prev, created]);
                                  handleUpdateEditConversion(idx, "uom_name", created.name.toLowerCase());
                                }}
                                createLabel="Tạo ĐVT mới"
                                placeholder="Chọn ĐVT..."
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-text-sub font-semibold mb-0.5">
                                Hệ số quy đổi
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                value={conv.conversion_factor}
                                onChange={(e) =>
                                  handleUpdateEditConversion(idx, "conversion_factor", Number(e.target.value))
                                }
                                className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono text-text-main"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-text-sub font-semibold mb-0.5">
                                Barcode riêng
                              </label>
                              <input
                                type="text"
                                placeholder="Barcode..."
                                value={conv.barcode || ""}
                                onChange={(e) =>
                                  handleUpdateEditConversion(idx, "barcode", e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded font-mono text-text-main"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-text-sub font-semibold mb-0.5">
                                Giá bán ĐVT này (VND)
                              </label>
                              <input
                                type="number"
                                step="500"
                                value={conv.selling_price || ""}
                                onChange={(e) =>
                                  handleUpdateEditConversion(
                                    idx,
                                    "selling_price",
                                    e.target.value ? Number(e.target.value) : undefined
                                  )
                                }
                                className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono font-bold text-brand"
                              />
                            </div>
                            <div className="sm:col-span-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveEditConversion(idx)}
                                className="p-1 text-text-disabled hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. MATRIX: Variant SKUs Management */}
                {editArchetype === "MATRIX" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-text-main">
                          Danh sách biến thể SKU ({editVariants.length})
                        </h3>
                        <p className="text-[11px] text-text-sub">
                          Sửa mã SKU, barcode, giá bán, giá vốn, hạn dùng và ảnh riêng cho từng mẫu.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddEditVariant}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Thêm SKU</span>
                      </Button>
                    </div>

                    <div className="border border-border-default rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-xs min-w-[650px]">
                        <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default sticky top-0">
                          <tr>
                            <th className="py-2 px-2.5 w-14 text-center">Ảnh</th>
                            <th className="py-2 px-2.5">Mã SKU</th>
                            <th className="py-2 px-2.5">Tên quy cách</th>
                            <th className="py-2 px-2.5">Barcode</th>
                            <th className="py-2 px-2.5 text-right w-28">Giá bán</th>
                            <th className="py-2 px-2.5 text-right w-28">Giá vốn</th>
                            <th className="py-2 px-2.5 text-center w-20">HSD</th>
                            <th className="py-2 px-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-default bg-surface-card">
                          {editVariants.map((v, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 px-2 text-center">
                                {v.image_url ? (
                                  <div className="relative w-8 h-8 rounded border border-border-default overflow-hidden group mx-auto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={v.image_url}
                                      alt="sku"
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateEditVariant(idx, "image_url", "")}
                                      className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px]"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <label className="w-8 h-8 rounded border border-dashed border-border-default hover:border-brand flex items-center justify-center cursor-pointer text-text-sub hover:text-brand mx-auto">
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
                                            handleUpdateEditVariant(idx, "image_url", up.file_url);
                                          } catch {}
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={v.sku || ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(idx, "sku", e.target.value.toUpperCase())
                                  }
                                  className="w-full px-2 py-1 bg-surface-app border border-border-default rounded font-mono font-bold text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={v.variant_name || ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(idx, "variant_name", e.target.value)
                                  }
                                  className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={v.barcode || ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(idx, "barcode", e.target.value)
                                  }
                                  placeholder="Barcode..."
                                  className="w-full px-2 py-1 bg-surface-app border border-border-default rounded font-mono text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="number"
                                  step="500"
                                  value={v.base_selling_price || ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(
                                      idx,
                                      "base_selling_price",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-right font-mono font-bold text-brand text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="number"
                                  step="500"
                                  value={v.cost_price || ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(idx, "cost_price", Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 bg-surface-app border border-border-default rounded text-right font-mono text-text-sub text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="number"
                                  placeholder={editShelfLife ? `${editShelfLife}` : "HSD"}
                                  value={v.shelf_life_days !== null && v.shelf_life_days !== undefined ? v.shelf_life_days : ""}
                                  onChange={(e) =>
                                    handleUpdateEditVariant(
                                      idx,
                                      "shelf_life_days",
                                      e.target.value ? Number(e.target.value) : null
                                    )
                                  }
                                  className="w-full px-1.5 py-1 bg-surface-app border border-border-default rounded text-center font-mono text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                {editVariants.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEditVariant(idx)}
                                    className="p-1 text-text-disabled hover:text-rose-600 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. CATCH_WEIGHT: Weighable & Batches */}
                {editArchetype === "CATCH_WEIGHT" && (
                  <div className="p-3 bg-surface-app rounded-lg border border-border-default space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsWeighable}
                        onChange={(e) => setEditIsWeighable(e.target.checked)}
                        className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-text-main block">
                          Bắt buộc cân ký thực tế tại POS (Cân điện tử)
                        </span>
                        <span className="text-[11px] text-text-sub block">
                          Khi chọn món này tại màn hình POS, hệ thống sẽ mở cửa sổ nhập trọng lượng thực tế (kg).
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-border-subtle">
                      <input
                        type="checkbox"
                        checked={editTrackBatches}
                        onChange={(e) => setEditTrackBatches(e.target.checked)}
                        className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-text-main block">
                          Theo dõi số lô & hạn sử dụng (Batch / Expiry Date)
                        </span>
                        <span className="text-[11px] text-text-sub block">
                          Quản lý xuất nhập theo từng lô và cảnh báo cận date trong phân hệ &quot;Quản lý Lô & HSD&quot;.
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* 4. MANUFACTURED: F&B Sizes & Toppings */}
                {editArchetype === "MANUFACTURED" && (
                  <div className="space-y-4">
                    {/* Sizes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-main">
                          Kích cỡ món (Size M, L...)
                        </span>
                        <button
                          type="button"
                          onClick={handleAddEditFnbSize}
                          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm Size</span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editFnbSizes.map((sz, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 bg-surface-app rounded border border-border-default"
                          >
                            <input
                              type="text"
                              value={sz.name}
                              onChange={(e) => handleUpdateEditFnbSize(idx, "name", e.target.value)}
                              className="flex-1 px-2 py-1 text-xs bg-surface-card border border-border-default rounded"
                              placeholder="Tên Size..."
                            />
                            <div className="w-28">
                              <input
                                type="number"
                                step="500"
                                value={sz.price}
                                onChange={(e) => handleUpdateEditFnbSize(idx, "price", Number(e.target.value))}
                                className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono font-bold text-brand"
                                placeholder="Giá bán..."
                              />
                            </div>
                            <div className="w-24">
                              <input
                                type="number"
                                step="500"
                                value={sz.cost}
                                onChange={(e) => handleUpdateEditFnbSize(idx, "cost", Number(e.target.value))}
                                className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono text-text-sub"
                                placeholder="Giá vốn..."
                              />
                            </div>
                            {editFnbSizes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveEditFnbSize(idx)}
                                className="p-1 text-text-disabled hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Toppings / Modifiers */}
                    <div className="space-y-2 pt-3 border-t border-border-subtle">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-text-main block">
                            Đồ kèm / Toppings cho món
                          </span>
                          <span className="text-[11px] text-text-sub">
                            Chỉ chọn từ sản phẩm đồ ăn, thức uống, nguyên liệu (bảo vệ chống chọn nhầm hàng thời trang).
                          </span>
                        </div>
                      </div>

                      {/* Dropdown to add from eligible products */}
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded border border-indigo-200">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddEditFnbModifierFromExisting(e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-white border border-indigo-300 rounded focus:outline-none text-text-main"
                        >
                          <option value="">-- Chọn sản phẩm làm topping / đồ kèm --</option>
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

                      {/* Topping list */}
                      {editFnbModifiers.length > 0 && (
                        <div className="space-y-2">
                          {editFnbModifiers.map((mod, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2 bg-surface-app rounded border border-border-default"
                            >
                              <input
                                type="text"
                                value={mod.name}
                                onChange={(e) => handleUpdateEditFnbModifier(idx, "name", e.target.value)}
                                className="flex-1 px-2 py-1 text-xs bg-surface-card border border-border-default rounded"
                              />
                              <div className="w-28">
                                <input
                                  type="number"
                                  step="500"
                                  value={mod.price}
                                  onChange={(e) => handleUpdateEditFnbModifier(idx, "price", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono font-bold text-brand"
                                />
                              </div>
                              <div className="w-20">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.5"
                                  value={mod.deduct_qty ?? 1}
                                  onChange={(e) => handleUpdateEditFnbModifier(idx, "deduct_qty", Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs bg-surface-card border border-border-default rounded text-right font-mono"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditFnbModifier(idx)}
                                className="p-1 text-text-disabled hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. COMBO: Bundling Members */}
                {editArchetype === "COMBO" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-text-main">
                          Thành phần gói Combo ({editComboComponents.length} món)
                        </h3>
                        <p className="text-[11px] text-text-sub">
                          Hệ thống tự động trừ kho từng món thành phần khi thu ngân bán combo tại POS.
                        </p>
                      </div>
                    </div>

                    {/* Selector */}
                    <div className="p-2.5 bg-teal-50/50 rounded-lg border border-teal-200">
                      <SearchableSelect
                        options={products.flatMap((p) =>
                          (p.variants || []).map((v) => ({
                            value: v.id,
                            label: `${p.name} ${v.variant_name && v.variant_name !== p.name ? `(${v.variant_name})` : ""}`,
                            subLabel: `SKU: ${v.sku} - Giá vốn: ${formatVND(Number(v.cost_price || 0))} - Bán: ${formatVND(Number(v.base_selling_price || 0))}`,
                            badge: p.base_uom,
                          }))
                        )}
                        value=""
                        onChange={(val) => handleAddEditComboComponent(val)}
                        placeholder="Tìm và thêm sản phẩm vào combo..."
                      />
                    </div>

                    {/* Combo Table */}
                    {editComboComponents.length === 0 ? (
                      <div className="text-xs text-text-sub italic bg-surface-app p-4 rounded-lg border border-dashed border-border-default text-center">
                        Chưa có sản phẩm nào trong combo. Chọn ở trên để thêm vào.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="border border-border-default rounded-lg overflow-x-auto">
                          <table className="w-full text-xs min-w-[500px]">
                            <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                              <tr>
                                <th className="py-2 px-3 text-left">Sản phẩm con</th>
                                <th className="py-2 px-3 text-right w-20">SL</th>
                                <th className="py-2 px-3 text-right w-28">Vốn món</th>
                                <th className="py-2 px-3 text-right w-28">Giá lẻ</th>
                                <th className="py-2 px-2 text-center w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-default bg-surface-card">
                              {editComboComponents.map((comp, idx) => (
                                <tr key={comp.variant_id}>
                                  <td className="py-1.5 px-3">
                                    <div className="font-semibold text-text-main">{comp.product_name}</div>
                                    {comp.variant_name !== comp.product_name && (
                                      <div className="text-[10px] text-text-sub">{comp.variant_name}</div>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="1"
                                      value={comp.qty}
                                      onChange={(e) =>
                                        handleUpdateEditComboComponentQty(idx, Number(e.target.value))
                                      }
                                      className="w-14 px-1.5 py-0.5 text-xs bg-surface-app border border-border-default rounded text-right font-mono font-bold"
                                    />
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-text-sub">
                                    {formatVND(comp.cost_price * comp.qty)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-mono text-text-main">
                                    {formatVND(comp.selling_price * comp.qty)}
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEditComboComponent(idx)}
                                      className="p-1 text-text-disabled hover:text-rose-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="p-2.5 bg-surface-app rounded border border-border-default flex items-center justify-between text-xs">
                          <div>
                            <span className="text-text-sub">Tổng vốn: </span>
                            <span className="font-mono font-bold text-rose-600">
                              {formatVND(suggestedComboCost)}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-sub">Tổng lẻ: </span>
                            <span className="font-mono font-bold text-text-main">
                              {formatVND(suggestedComboRetail)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingProduct(null)}
                disabled={isSavingEdit}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                isLoading={isSavingEdit}
                disabled={isSavingEdit}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Lưu thay đổi toàn bộ</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          CONFIRM DELETE DIALOG
      ========================================================================= */}
      {deletingProduct && (
        <ConfirmDialog
          isOpen={Boolean(deletingProduct)}
          title={`Xác nhận xóa sản phẩm: ${deletingProduct.name}`}
          description="Hành động này sẽ xóa vĩnh viễn sản phẩm và các biến thể liên quan khỏi danh mục. Bạn có chắc chắn muốn xóa không?"
          confirmLabel="Xác nhận xóa"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteProduct}
          onCancel={() => setDeletingProduct(null)}
        />
      )}
    </div>
  );
}
