"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useStoreProfile } from "@/lib/store";
import {
  api,
  Product,
  ProductVariant,
  BomRecipe,
  CreateBomRecipeInput,
  AssemblyInput,
  DisassemblyInput,
} from "@/lib/api";
import {
  formatVND,
  formatQty,
  formatPercent,
} from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  AlertBanner,
} from "@/components/common";
import {
  Factory,
  Fish,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  RefreshCw,
  Scale,
  CalendarClock,
  ArrowRight,
  Info,
  X,
  Loader2,
  Check,
  ChevronDown,
  Wand2,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface FlatVariant {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  fullName: string;
  sku: string;
  baseUom: string;
  costPrice: number;
  currentStock: number;
  productType: string;
}

interface DisassemblyYieldRow {
  component_variant_id: string;
  actual_qty: number;
  cost_allocation_percent: number;
  batch_code?: string;
  expiry_date?: string;
}

interface ToastNotification {
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

export default function ProductionPage() {
  const { isModuleEnabled } = useStoreProfile();
  const hasBatchExpiry = isModuleEnabled("batch_expiry");
  const hasBomProduction = isModuleEnabled("bom_production");

  // Master Data
  const [recipes, setRecipes] = useState<BomRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Active Tab: ASSEMBLY (Chế biến thành phẩm) or DISASSEMBLY (Phân rã mổ xẻ)
  const [activeTab, setActiveTab] = useState<"ASSEMBLY" | "DISASSEMBLY">("ASSEMBLY");

  // Assembly State
  const [selectedAssemblyRecipeId, setSelectedAssemblyRecipeId] = useState<string>("");
  const [batchOutputQty, setBatchOutputQty] = useState<number>(1);
  const [assemblyOtherCost, setAssemblyOtherCost] = useState<number>(0);
  const [assemblyBatchCode, setAssemblyBatchCode] = useState<string>("");
  const [assemblyExpiryDate, setAssemblyExpiryDate] = useState<string>("");
  const [assemblyNotes, setAssemblyNotes] = useState<string>("");
  const [isExecutingAssembly, setIsExecutingAssembly] = useState<boolean>(false);
  const [isSyncingCost, setIsSyncingCost] = useState<boolean>(false);

  // Disassembly State
  const [selectedDisassemblyRecipeId, setSelectedDisassemblyRecipeId] = useState<string>("");
  const [disassemblyInputQty, setDisassemblyInputQty] = useState<number>(5);
  const [disassemblyOtherCost, setDisassemblyOtherCost] = useState<number>(0);
  const [disassemblyBatchCode, setDisassemblyBatchCode] = useState<string>("");
  const [disassemblyNotes, setDisassemblyNotes] = useState<string>("");
  const [disassemblyYields, setDisassemblyYields] = useState<DisassemblyYieldRow[]>([]);
  const [isExecutingDisassembly, setIsExecutingDisassembly] = useState<boolean>(false);

  // Quick Recipe Modal State
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [modalRecipeType, setModalRecipeType] = useState<"ASSEMBLY" | "DISASSEMBLY">("ASSEMBLY");
  const [modalTargetVariantId, setModalTargetVariantId] = useState<string>("");
  const [modalOutputQty, setModalOutputQty] = useState<number>(1);
  const [modalWastagePercent, setModalWastagePercent] = useState<number>(0);
  const [modalItems, setModalItems] = useState<
    Array<{ component_variant_id: string; qty_required: number; cost_allocation_percent: number }>
  >([
    { component_variant_id: "", qty_required: 1, cost_allocation_percent: 0 },
  ]);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load all master data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const [recipeRes, prodRes] = await Promise.all([
        api.getRecipes(),
        api.getProducts(),
      ]);
      setRecipes(recipeRes || []);
      setProducts(prodRes || []);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Lỗi tải dữ liệu",
        message: err.message || "Không thể kết nối đến máy chủ",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map of all variants for fast lookup
  const variantMap = useMemo(() => {
    const map = new Map<string, FlatVariant>();
    for (const p of products) {
      for (const v of p.variants || []) {
        const stock =
          typeof v.current_stock === "number"
            ? v.current_stock
            : parseFloat((v.current_stock as any) || (v.current_inventory as any) || "0");
        const cost =
          typeof v.cost_price === "number"
            ? v.cost_price
            : parseFloat((v.cost_price as any) || "0");
        const variantTitle =
          v.variant_name && v.variant_name !== p.name
            ? `${p.name} - ${v.variant_name}`
            : p.name;
        map.set(v.id, {
          id: v.id,
          productId: p.id,
          productName: p.name,
          variantName: v.variant_name || p.name,
          fullName: `${variantTitle} (${v.sku})`,
          sku: v.sku,
          baseUom: p.base_uom || "đơn vị",
          costPrice: isNaN(cost) ? 0 : cost,
          currentStock: isNaN(stock) ? 0 : stock,
          productType: p.product_type,
        });
      }
    }
    return map;
  }, [products]);

  // Filter recipes by type
  const assemblyRecipes = useMemo(
    () => recipes.filter((r) => r.recipe_type === "ASSEMBLY"),
    [recipes]
  );
  const disassemblyRecipes = useMemo(
    () => recipes.filter((r) => r.recipe_type === "DISASSEMBLY"),
    [recipes]
  );

  // Sync selected assembly recipe
  useEffect(() => {
    if (assemblyRecipes.length > 0 && !selectedAssemblyRecipeId) {
      const first = assemblyRecipes[0];
      setSelectedAssemblyRecipeId(first.id);
      const defaultQty = Number(first.output_qty) || 1;
      setBatchOutputQty(defaultQty);
    }
  }, [assemblyRecipes, selectedAssemblyRecipeId]);

  // Sync selected disassembly recipe
  useEffect(() => {
    if (disassemblyRecipes.length > 0 && !selectedDisassemblyRecipeId) {
      const first = disassemblyRecipes[0];
      setSelectedDisassemblyRecipeId(first.id);
      const defaultInQty = Number(first.output_qty) || 5;
      setDisassemblyInputQty(defaultInQty);

      // Initialize yields from recipe items
      const initialYields: DisassemblyYieldRow[] = (first.items || []).map((it) => ({
        component_variant_id: it.component_variant_id,
        actual_qty: Number(it.qty_required) || 1,
        cost_allocation_percent: Number(it.cost_allocation_percent) || 0,
        batch_code: "",
        expiry_date: "",
      }));
      setDisassemblyYields(initialYields);
    }
  }, [disassemblyRecipes, selectedDisassemblyRecipeId]);

  // Handle recipe selection changes for ASSEMBLY
  const handleSelectAssemblyRecipe = (recipeId: string) => {
    setSelectedAssemblyRecipeId(recipeId);
    const rec = assemblyRecipes.find((r) => r.id === recipeId);
    if (rec) {
      const stdQty = Number(rec.output_qty) || 1;
      setBatchOutputQty(stdQty);
      // Auto-generate batch code if batch_expiry is enabled
      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const randStr = Math.floor(100 + Math.random() * 900);
      setAssemblyBatchCode(`LO-ME-${todayStr}-${randStr}`);
    }
  };

  // Handle recipe selection changes for DISASSEMBLY
  const handleSelectDisassemblyRecipe = (recipeId: string) => {
    setSelectedDisassemblyRecipeId(recipeId);
    const rec = disassemblyRecipes.find((r) => r.id === recipeId);
    if (rec) {
      const stdQty = Number(rec.output_qty) || 5;
      setDisassemblyInputQty(stdQty);
      const rows: DisassemblyYieldRow[] = (rec.items || []).map((it) => ({
        component_variant_id: it.component_variant_id,
        actual_qty: Number(it.qty_required) || 1,
        cost_allocation_percent: Number(it.cost_allocation_percent) || 0,
        batch_code: "",
        expiry_date: "",
      }));
      setDisassemblyYields(rows);
      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const randStr = Math.floor(100 + Math.random() * 900);
      setDisassemblyBatchCode(`LO-MO-${todayStr}-${randStr}`);
    }
  };

  // -------------------------------------------------------------
  // ASSEMBLY CALCULATIONS
  // -------------------------------------------------------------
  const selectedAssemblyRecipe = useMemo(
    () => assemblyRecipes.find((r) => r.id === selectedAssemblyRecipeId),
    [assemblyRecipes, selectedAssemblyRecipeId]
  );

  const assemblyTargetVariant = useMemo(() => {
    if (!selectedAssemblyRecipe) return null;
    return variantMap.get(selectedAssemblyRecipe.target_variant_id) || null;
  }, [selectedAssemblyRecipe, variantMap]);

  const assemblyStdOutputQty = Number(selectedAssemblyRecipe?.output_qty) || 1;

  const assemblyMaterials = useMemo(() => {
    if (!selectedAssemblyRecipe) return [];
    const multiplier =
      assemblyStdOutputQty > 0 ? batchOutputQty / assemblyStdOutputQty : 1;

    return (selectedAssemblyRecipe.items || []).map((item) => {
      const variant = variantMap.get(item.component_variant_id);
      const stdItemQty = Number(item.qty_required) || 0;
      const unitQuota = assemblyStdOutputQty > 0 ? stdItemQty / assemblyStdOutputQty : stdItemQty;
      const totalNeeded = stdItemQty * multiplier;
      const currentStock = variant ? variant.currentStock : 0;
      const isShort = currentStock < totalNeeded;
      const shortageAmount = isShort ? totalNeeded - currentStock : 0;
      const unitCost = variant ? variant.costPrice : 0;
      const itemTotalCost = totalNeeded * unitCost;

      return {
        ...item,
        variant,
        unitQuota,
        totalNeeded,
        currentStock,
        isShort,
        shortageAmount,
        unitCost,
        itemTotalCost,
      };
    });
  }, [selectedAssemblyRecipe, variantMap, assemblyStdOutputQty, batchOutputQty]);

  const assemblyTotalMaterialCost = useMemo(() => {
    return assemblyMaterials.reduce((acc, m) => acc + m.itemTotalCost, 0);
  }, [assemblyMaterials]);

  const assemblyTotalBatchCost = assemblyTotalMaterialCost + (Number(assemblyOtherCost) || 0);

  const assemblyEstimatedNewUnitCost =
    batchOutputQty > 0 ? assemblyTotalBatchCost / batchOutputQty : 0;

  const assemblyHasShortage = assemblyMaterials.some((m) => m.isShort);

  // -------------------------------------------------------------
  // DISASSEMBLY CALCULATIONS
  // -------------------------------------------------------------
  const selectedDisassemblyRecipe = useMemo(
    () => disassemblyRecipes.find((r) => r.id === selectedDisassemblyRecipeId),
    [disassemblyRecipes, selectedDisassemblyRecipeId]
  );

  const disassemblyRawVariant = useMemo(() => {
    if (!selectedDisassemblyRecipe) return null;
    return variantMap.get(selectedDisassemblyRecipe.target_variant_id) || null;
  }, [selectedDisassemblyRecipe, variantMap]);

  const disassemblyRawUnitCost = disassemblyRawVariant ? disassemblyRawVariant.costPrice : 0;
  const disassemblyTotalRawCost = disassemblyInputQty * disassemblyRawUnitCost;
  const disassemblyTotalCost = disassemblyTotalRawCost + (Number(disassemblyOtherCost) || 0);

  const disassemblyTotalYieldQty = useMemo(() => {
    return disassemblyYields.reduce((acc, y) => acc + (Number(y.actual_qty) || 0), 0);
  }, [disassemblyYields]);

  const disassemblyWasteQty = disassemblyInputQty - disassemblyTotalYieldQty;
  const disassemblyWastePercent =
    disassemblyInputQty > 0 ? (disassemblyWasteQty / disassemblyInputQty) * 100 : 0;

  const disassemblyTotalAllocationPercent = useMemo(() => {
    return disassemblyYields.reduce(
      (acc, y) => acc + (Number(y.cost_allocation_percent) || 0),
      0
    );
  }, [disassemblyYields]);

  const isAllocationBalanced = Math.abs(disassemblyTotalAllocationPercent - 100) < 0.01;
  const isInputQtyOverStock = disassemblyRawVariant
    ? disassemblyInputQty > disassemblyRawVariant.currentStock
    : false;

  // -------------------------------------------------------------
  // EXECUTE ASSEMBLY
  // -------------------------------------------------------------
  const handleExecuteAssembly = async () => {
    if (!selectedAssemblyRecipe) {
      setToast({
        type: "error",
        title: "Thiếu dữ liệu",
        message: "Vui lòng chọn công thức chế biến mẻ",
      });
      return;
    }
    if (batchOutputQty <= 0) {
      setToast({
        type: "error",
        title: "Số lượng không hợp lệ",
        message: "Số lượng mẻ làm được phải lớn hơn 0",
      });
      return;
    }

    setIsExecutingAssembly(true);
    try {
      const payload: AssemblyInput = {
        recipe_id: selectedAssemblyRecipe.id,
        target_output_qty: batchOutputQty,
        other_cost: Number(assemblyOtherCost) || 0,
        notes: assemblyNotes.trim() ? assemblyNotes.trim() : undefined,
      };

      if (hasBatchExpiry && assemblyBatchCode.trim()) {
        payload.batch_code = assemblyBatchCode.trim();
      }
      if (hasBatchExpiry && assemblyExpiryDate) {
        payload.expiry_date = new Date(assemblyExpiryDate).toISOString();
      }

      const res = await api.executeAssembly(payload);
      setToast({
        type: "success",
        title: "Chế biến mẻ thành công!",
        message: `Đã nhập kho ${formatQty(batchOutputQty, assemblyTargetVariant?.baseUom)} với giá vốn ước tính ${formatVND(assemblyEstimatedNewUnitCost)}/${assemblyTargetVariant?.baseUom}.`,
      });

      // Reload products and inventory
      await loadData(true);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Thực thi chế biến thất bại",
        message: err.message || "Lỗi khi gọi API chế biến mẻ",
      });
    } finally {
      setIsExecutingAssembly(false);
    }
  };

  const handleSyncRecipeCost = async () => {
    if (!selectedAssemblyRecipe) return;
    setIsSyncingCost(true);
    try {
      const res = await api.syncBomRecipeCost(selectedAssemblyRecipe.id);
      setToast({
        type: "success",
        title: "Đồng bộ giá vốn thành công!",
        message: `Đã cập nhật giá vốn của ${assemblyTargetVariant?.productName} thành ${formatVND(res.estimated_unit_cost)} dựa trên định mức BOM.`,
      });
      await loadData(true);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Đồng bộ thất bại",
        message: err.message || "Lỗi khi đồng bộ giá vốn BOM",
      });
    } finally {
      setIsSyncingCost(false);
    }
  };

  // -------------------------------------------------------------
  // EXECUTE DISASSEMBLY
  // -------------------------------------------------------------
  const handleExecuteDisassembly = async () => {
    if (!selectedDisassemblyRecipe) {
      setToast({
        type: "error",
        title: "Thiếu dữ liệu",
        message: "Vui lòng chọn công thức mổ xẻ pha lóc",
      });
      return;
    }
    if (disassemblyInputQty <= 0) {
      setToast({
        type: "error",
        title: "Số lượng không hợp lệ",
        message: "Khối lượng nguyên liệu đưa vào phải lớn hơn 0",
      });
      return;
    }
    if (!isAllocationBalanced) {
      setToast({
        type: "error",
        title: "Chưa cân bằng giá vốn",
        message: `Tổng tỷ lệ phân bổ giá vốn phải bằng đúng 100% (hiện tại: ${disassemblyTotalAllocationPercent}%).`,
      });
      return;
    }

    const invalidYield = disassemblyYields.some((y) => Number(y.actual_qty) <= 0);
    if (invalidYield) {
      setToast({
        type: "error",
        title: "Sản lượng thu được không hợp lệ",
        message: "Tất cả các bộ phận thu được phải có khối lượng lớn hơn 0",
      });
      return;
    }

    setIsExecutingDisassembly(true);
    try {
      const payload: DisassemblyInput = {
        recipe_id: selectedDisassemblyRecipe.id,
        input_qty: disassemblyInputQty,
        other_cost: Number(disassemblyOtherCost) || 0,
        notes: disassemblyNotes.trim() ? disassemblyNotes.trim() : undefined,
        yield_outputs: disassemblyYields.map((y) => {
          const itemPayload: any = {
            component_variant_id: y.component_variant_id,
            actual_qty: Number(y.actual_qty),
          };
          if (hasBatchExpiry && y.batch_code?.trim()) {
            itemPayload.batch_code = y.batch_code.trim();
          }
          if (hasBatchExpiry && y.expiry_date) {
            itemPayload.expiry_date = new Date(y.expiry_date).toISOString();
          }
          return itemPayload;
        }),
      };

      if (hasBatchExpiry && disassemblyBatchCode.trim()) {
        payload.batch_code = disassemblyBatchCode.trim();
      }

      await api.executeDisassembly(payload);
      setToast({
        type: "success",
        title: "Hoàn tất mổ xẻ pha lóc!",
        message: `Đã phân rã ${formatQty(disassemblyInputQty, disassemblyRawVariant?.baseUom)} ${disassemblyRawVariant?.productName} thành ${disassemblyYields.length} phần thành phẩm với giá vốn cập nhật.`,
      });

      // Reload products and inventory
      await loadData(true);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Thực thi phân rã thất bại",
        message: err.message || "Lỗi khi gọi API mổ xẻ pha lóc",
      });
    } finally {
      setIsExecutingDisassembly(false);
    }
  };

  // -------------------------------------------------------------
  // QUICK RECIPE CREATION MODAL
  // -------------------------------------------------------------
  const openQuickRecipeModal = (type: "ASSEMBLY" | "DISASSEMBLY") => {
    setModalRecipeType(type);
    setModalOutputQty(type === "ASSEMBLY" ? 1 : 5);
    setModalWastagePercent(0);
    setModalError(null);

    // Pick first available variant as default target
    const allVariants = Array.from(variantMap.values());
    if (allVariants.length > 0) {
      setModalTargetVariantId(allVariants[0].id);
      if (allVariants.length > 1) {
        setModalItems([
          {
            component_variant_id: allVariants[1].id,
            qty_required: 1,
            cost_allocation_percent: type === "DISASSEMBLY" ? 100 : 0,
          },
        ]);
      } else {
        setModalItems([
          {
            component_variant_id: allVariants[0].id,
            qty_required: 1,
            cost_allocation_percent: type === "DISASSEMBLY" ? 100 : 0,
          },
        ]);
      }
    }
    setShowRecipeModal(true);
  };

  const handleAddModalItem = () => {
    const allVariants = Array.from(variantMap.values());
    const fallbackId = allVariants[0]?.id || "";
    setModalItems((prev) => [
      ...prev,
      {
        component_variant_id: fallbackId,
        qty_required: 1,
        cost_allocation_percent: 0,
      },
    ]);
  };

  const handleRemoveModalItem = (index: number) => {
    setModalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveModalRecipe = async () => {
    setModalError(null);
    if (!modalTargetVariantId) {
      setModalError("Vui lòng chọn sản phẩm / nguyên liệu chính");
      return;
    }
    if (modalOutputQty <= 0) {
      setModalError("Sản lượng chuẩn phải lớn hơn 0");
      return;
    }
    if (modalItems.length === 0) {
      setModalError("Công thức phải có ít nhất 1 thành phần");
      return;
    }

    for (let i = 0; i < modalItems.length; i++) {
      const it = modalItems[i];
      if (!it.component_variant_id) {
        setModalError(`Dòng ${i + 1}: Chưa chọn mặt hàng`);
        return;
      }
      if (modalRecipeType === "ASSEMBLY" && it.qty_required <= 0) {
        setModalError(`Dòng ${i + 1}: Số lượng định mức phải lớn hơn 0`);
        return;
      }
    }

    if (modalRecipeType === "DISASSEMBLY") {
      const sumPercent = modalItems.reduce(
        (sum, it) => sum + (Number(it.cost_allocation_percent) || 0),
        0
      );
      if (Math.abs(sumPercent - 100) > 0.01) {
        setModalError(`Tổng % phân bổ giá vốn phải bằng đúng 100% (Hiện tại: ${sumPercent}%)`);
        return;
      }
    }

    setIsCreatingRecipe(true);
    try {
      const payload: CreateBomRecipeInput = {
        target_variant_id: modalTargetVariantId,
        recipe_type: modalRecipeType,
        output_qty: modalOutputQty,
        expected_wastage_percent: modalWastagePercent || 0,
        items: modalItems.map((it) => ({
          component_variant_id: it.component_variant_id,
          qty_required: Number(it.qty_required) || 0,
          cost_allocation_percent: Number(it.cost_allocation_percent) || 0,
        })),
      };

      const newRec = await api.createBomRecipe(payload);
      setToast({
        type: "success",
        title: "Tạo công thức thành công!",
        message: `Đã lưu công thức định mức mới cho ${variantMap.get(modalTargetVariantId)?.productName}.`,
      });

      setShowRecipeModal(false);
      await loadData(true);

      // Select newly created recipe
      if (modalRecipeType === "ASSEMBLY") {
        setActiveTab("ASSEMBLY");
        setSelectedAssemblyRecipeId(newRec.id);
        setBatchOutputQty(Number(newRec.output_qty) || 1);
      } else {
        setActiveTab("DISASSEMBLY");
        setSelectedDisassemblyRecipeId(newRec.id);
        setDisassemblyInputQty(Number(newRec.output_qty) || 5);
      }
    } catch (err: any) {
      setModalError(err.message || "Lỗi khi lưu công thức định mức");
    } finally {
      setIsCreatingRecipe(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md w-full shadow-lg rounded-xl border p-4 flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : toast.type === "error"
              ? "bg-rose-50 border-rose-300 text-rose-900"
              : "bg-indigo-50 border-indigo-300 text-indigo-900"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{toast.title}</h4>
            <p className="text-xs mt-0.5 text-text-sub">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-text-disabled hover:text-text-main p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Module Inactive Warning Banner (if bom_production is off) */}
      {!hasBomProduction && (
        <AlertBanner
          type="warning"
          message="Mô-đun Chế biến & Định mức BOM hiện đang tắt trong cấu hình cửa hàng. Bạn vẫn có thể thử nghiệm tính toán."
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="Quản lý Chế biến & Định mức BOM"
        description="Chế biến ghép (ASSEMBLY) và Mổ xẻ pha lóc (DISASSEMBLY) tự động phân bổ giá vốn WAC."
        badge={
          <Badge variant="bom">
            {recipes.length} công thức
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-brand" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openQuickRecipeModal(activeTab)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Tạo công thức</span>
            </Button>
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="bg-surface-card border border-border-subtle rounded-xl p-1.5 shadow-card flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setActiveTab("ASSEMBLY")}
          className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "ASSEMBLY"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
              : "text-text-sub hover:bg-surface-card-hover hover:text-text-main"
          }`}
        >
          <Factory className={`w-4 h-4 ${activeTab === "ASSEMBLY" ? "text-indigo-600" : "text-text-sub"}`} />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span>Chế biến thành phẩm (ASSEMBLY)</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-100/70 text-indigo-800">
                Nấu mẻ / Ghép
              </span>
            </div>
            <p className="text-[11px] font-normal text-text-sub hidden sm:block">
              N nguyên liệu đầu vào cấu thành 1 thành phẩm hoàn chỉnh
            </p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("DISASSEMBLY")}
          className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "DISASSEMBLY"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm"
              : "text-text-sub hover:bg-surface-card-hover hover:text-text-main"
          }`}
        >
          <Fish className={`w-4 h-4 ${activeTab === "DISASSEMBLY" ? "text-emerald-600" : "text-text-sub"}`} />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span>Phân rã / Mổ xẻ pha lóc (DISASSEMBLY)</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-100/70 text-emerald-800">
                Thịt & Hải sản
              </span>
            </div>
            <p className="text-[11px] font-normal text-text-sub hidden sm:block">
              1 nguyên liệu chia tách thành N thành phẩm có phân bổ % giá vốn
            </p>
          </div>
        </button>
      </div>

      {/* Main Tab Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-surface-card border border-border-subtle rounded-2xl">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-text-main">Đang tải dữ liệu định mức BOM & kho hàng...</p>
        </div>
      ) : activeTab === "ASSEMBLY" ? (
        /* ==============================================================
           TAB 1: ASSEMBLY - Chế biến thành phẩm
           ============================================================== */
        assemblyRecipes.length === 0 ? (
          /* Empty State for Assembly */
          <div className="bg-surface-card border border-dashed border-indigo-200 rounded-2xl p-12 text-center shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Factory className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-text-main mb-1">
              Chưa có công thức Chế biến thành phẩm (ASSEMBLY) nào
            </h3>
            <p className="text-xs text-text-sub max-w-md mx-auto mb-6">
              Tạo công thức định mức cho các món như Chả lụa đòn 500g, Bánh mì thập cẩm, hoặc Combo đóng gói để bắt đầu sản xuất mẻ.
            </p>
            <button
              onClick={() => openQuickRecipeModal("ASSEMBLY")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo nhanh công thức Chế biến</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Config Card */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-card space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Recipe Selection */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Chọn công thức định mức chế biến
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAssemblyRecipeId}
                      onChange={(e) => handleSelectAssemblyRecipe(e.target.value)}
                      className="w-full h-10 px-3 pr-8 bg-surface-app border border-border-default rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition appearance-none"
                    >
                      {assemblyRecipes.map((rec) => {
                        const targetV = variantMap.get(rec.target_variant_id);
                        const label = targetV
                          ? `${targetV.productName} (${targetV.sku})`
                          : `Công thức #${rec.id.slice(0, 8)}`;
                        return (
                          <option key={rec.id} value={rec.id}>
                            {label} - [Định mức chuẩn: {rec.output_qty} {targetV?.baseUom || "đơn vị"}]
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-text-sub absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Batch Size Input */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Số lượng mẻ muốn chế biến ({assemblyTargetVariant?.baseUom || "đơn vị"})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={batchOutputQty}
                      onChange={(e) => setBatchOutputQty(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full h-10 px-3 bg-surface-app border border-border-default rounded-lg text-sm text-text-main font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      placeholder="e.g. 50"
                    />
                  </div>
                  <span className="text-[11px] text-text-sub mt-1 block">
                    Định mức chuẩn: {assemblyStdOutputQty} {assemblyTargetVariant?.baseUom} (Hệ số mẻ:{" "}
                    {(assemblyStdOutputQty > 0 ? batchOutputQty / assemblyStdOutputQty : 1).toFixed(2)}x)
                  </span>
                </div>

                {/* Other Cost Input */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Chi phí phụ trợ / gia công khác (₫)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={assemblyOtherCost}
                    onChange={(e) => setAssemblyOtherCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-surface-app border border-border-default rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    placeholder="Bao bì, nhân công, gia vị..."
                  />
                  <span className="text-[11px] text-text-sub mt-1 block">
                    Bao bì, điện nước, phụ liệu: {formatVND(assemblyOtherCost)}
                  </span>
                </div>
              </div>

              {/* Target Variant Card Info */}
              {assemblyTargetVariant && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-indigo-950">
                          {assemblyTargetVariant.productName}
                        </span>
                        {assemblyTargetVariant.variantName !== assemblyTargetVariant.productName && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
                            {assemblyTargetVariant.variantName}
                          </span>
                        )}
                        <span className="text-xs font-mono text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                          SKU: {assemblyTargetVariant.sku}
                        </span>
                      </div>
                      <div className="text-xs text-indigo-800/80 mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                        <span>Đơn vị tính chuẩn: <strong>{assemblyTargetVariant.baseUom}</strong></span>
                        <span>•</span>
                        <span>
                          Tồn kho hiện tại:{" "}
                          <strong className="text-indigo-900">
                            {formatQty(assemblyTargetVariant.currentStock, assemblyTargetVariant.baseUom)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Giá vốn hiện hành:{" "}
                          <strong className="text-indigo-900 font-mono tabular-nums">{formatVND(assemblyTargetVariant.costPrice)}</strong>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1.5 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded text-indigo-900">
                          <span>Định mức BOM:</span>
                          <strong className="text-indigo-950 font-mono tabular-nums">
                            {formatVND(selectedAssemblyRecipe?.estimated_unit_cost || (assemblyTotalMaterialCost / (assemblyStdOutputQty || 1)))}
                          </strong>
                          <button
                            type="button"
                            onClick={handleSyncRecipeCost}
                            disabled={isSyncingCost}
                            className="ml-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-950 underline inline-flex items-center gap-1"
                            title="Đồng bộ giá vốn định mức BOM vào giá vốn của sản phẩm"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncingCost ? "animate-spin" : ""}`} />
                            <span>Đồng bộ</span>
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Batch & Expiry inputs if batch_expiry enabled */}
                  {hasBatchExpiry && (
                    <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-indigo-200/80 pt-3 sm:pt-0 sm:pl-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Mã Lô thành phẩm mới
                        </label>
                        <input
                          type="text"
                          value={assemblyBatchCode}
                          onChange={(e) => setAssemblyBatchCode(e.target.value)}
                          placeholder="e.g. LOT-TP-01"
                          className="h-8 px-2.5 bg-white border border-indigo-200 rounded text-xs text-text-main font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                          Hạn sử dụng Lô
                        </label>
                        <input
                          type="date"
                          value={assemblyExpiryDate}
                          onChange={(e) => setAssemblyExpiryDate(e.target.value)}
                          className="h-8 px-2.5 bg-white border border-indigo-200 rounded text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Raw Materials BOM Table */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <span>Bảng định mức nguyên vật liệu tiêu hao</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                      {assemblyMaterials.length} nguyên liệu
                    </span>
                  </h3>
                  <p className="text-xs text-text-sub mt-0.5">
                    Số lượng cần dùng = Định mức đơn vị × {batchOutputQty} {assemblyTargetVariant?.baseUom}
                  </p>
                </div>

                {assemblyHasShortage && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Cảnh báo: Tồn kho không đủ cho toàn bộ mẻ nấu!</span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted/50 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-sub">
                      <th className="py-3 px-4">Tên nguyên vật liệu</th>
                      <th className="py-3 px-4 text-right">Định mức / 1 {assemblyTargetVariant?.baseUom}</th>
                      <th className="py-3 px-4 text-right">Cần cho cả mẻ ({batchOutputQty})</th>
                      <th className="py-3 px-4 text-right">Tồn kho thực tế</th>
                      <th className="py-3 px-4 text-center">Trạng thái kho</th>
                      <th className="py-3 px-4 text-right">Đơn giá vốn WAC</th>
                      <th className="py-3 px-4 text-right">Thành tiền ước tính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {assemblyMaterials.map((mat, idx) => {
                      const uom = mat.variant?.baseUom || "";
                      return (
                        <tr
                          key={mat.id || idx}
                          className={`hover:bg-surface-card-hover transition ${
                            mat.isShort ? "bg-rose-50/30" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-medium text-text-main">
                            <div className="font-semibold text-text-main">
                              {mat.variant?.productName || "Nguyên liệu không xác định"}
                            </div>
                            <div className="text-[11px] text-text-sub font-mono">
                              SKU: {mat.variant?.sku || mat.component_variant_id}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-text-sub">
                            {formatQty(mat.unitQuota, uom)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold font-mono text-indigo-700">
                            {formatQty(mat.totalNeeded, uom)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-text-main">
                            {formatQty(mat.currentStock, uom)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {mat.isShort ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                Thiếu {formatQty(mat.shortageAmount, uom)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Đủ nguyên liệu
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-text-sub">
                            {formatVND(mat.unitCost)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold font-mono text-text-main">
                            {formatVND(mat.itemTotalCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes Input in Card Footer */}
              <div className="p-4 bg-surface-muted/30 border-t border-border-subtle">
                <label className="block text-xs font-medium text-text-sub mb-1">
                  Ghi chú lệnh chế biến (tùy chọn)
                </label>
                <input
                  type="text"
                  value={assemblyNotes}
                  onChange={(e) => setAssemblyNotes(e.target.value)}
                  placeholder="Ví dụ: Nấu mẻ sáng sớm, thêm 10% tiêu đen..."
                  className="w-full h-9 px-3 bg-white border border-border-default rounded-lg text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Cost Summary & Unit Cost Estimation */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-700/50 pb-5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Bạch hóa chi phí sản xuất
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Tổng kết Chi phí Mẻ & Ước tính Giá Vốn Thành Phẩm Mới
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-indigo-300">Công thức tính:</span>
                  <div className="text-xs font-mono text-indigo-200 mt-0.5">
                    (Vật tư + Phụ trợ) / Số lượng làm được
                  </div>
                </div>
              </div>

              {/* 4 Stat Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-indigo-200 block">1. Chi phí nguyên vật liệu</span>
                  <span className="text-lg font-bold font-mono text-white mt-1 block">
                    {formatVND(assemblyTotalMaterialCost)}
                  </span>
                  <span className="text-[11px] text-indigo-300/80 mt-1 block">
                    Từ {assemblyMaterials.length} thành phần BOM
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-indigo-200 block">2. Chi phí gia công khác</span>
                  <span className="text-lg font-bold font-mono text-white mt-1 block">
                    {formatVND(assemblyOtherCost)}
                  </span>
                  <span className="text-[11px] text-indigo-300/80 mt-1 block">
                    Bao bì, nhân công, gia vị
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-indigo-200 block">3. Tổng chi phí cả mẻ</span>
                  <span className="text-xl font-extrabold font-mono text-indigo-200 mt-1 block">
                    {formatVND(assemblyTotalBatchCost)}
                  </span>
                  <span className="text-[11px] text-indigo-300/80 mt-1 block">
                    Cho {formatQty(batchOutputQty, assemblyTargetVariant?.baseUom)}
                  </span>
                </div>

                <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-4">
                  <span className="text-xs font-semibold text-emerald-300 block">
                    4. Ước tính Giá Vốn Mới / {assemblyTargetVariant?.baseUom}
                  </span>
                  <span className="text-2xl font-extrabold font-mono text-emerald-300 mt-1 block">
                    {formatVND(assemblyEstimatedNewUnitCost)}
                  </span>
                  <div className="text-[11px] text-emerald-200 mt-1 flex items-center gap-1.5">
                    <span>Giá vốn cũ: {formatVND(assemblyTargetVariant?.costPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-indigo-200">
                  {assemblyHasShortage ? (
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Lưu ý: Kho bị âm nguyên liệu nếu vẫn thực thi lệnh này.
                    </span>
                  ) : (
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Tồn kho nguyên liệu đáp ứng hoàn hảo cho mẻ chế biến này.
                    </span>
                  )}
                </div>

                <button
                  onClick={handleExecuteAssembly}
                  disabled={isExecutingAssembly || batchOutputQty <= 0}
                  className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  {isExecutingAssembly ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang trừ kho & nhập thành phẩm...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Thực thi Lệnh Chế biến ({formatQty(batchOutputQty, assemblyTargetVariant?.baseUom)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ==============================================================
           TAB 2: DISASSEMBLY - Phân rã / Mổ xẻ pha lóc (Thịt & Hải sản)
           ============================================================== */
        disassemblyRecipes.length === 0 ? (
          /* Empty State for Disassembly */
          <div className="bg-surface-card border border-dashed border-emerald-200 rounded-2xl p-12 text-center shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Fish className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-text-main mb-1">
              Chưa có công thức Phân rã / Mổ xẻ pha lóc (DISASSEMBLY) nào
            </h3>
            <p className="text-xs text-text-sub max-w-md mx-auto mb-6">
              Tạo công thức mổ xẻ pha lóc cho Cá Hồi Nguyên Con, Bò/Heo nguyên tảng để tự động phân bổ giá vốn thành phi lê, đầu xương và hao hụt.
            </p>
            <button
              onClick={() => openQuickRecipeModal("DISASSEMBLY")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo nhanh công thức Mổ xẻ pha lóc</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input Raw Material Selection Card */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-card space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Select Recipe */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Chọn nguyên liệu đầu vào mổ xẻ pha lóc
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDisassemblyRecipeId}
                      onChange={(e) => handleSelectDisassemblyRecipe(e.target.value)}
                      className="w-full h-10 px-3 pr-8 bg-surface-app border border-border-default rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition appearance-none"
                    >
                      {disassemblyRecipes.map((rec) => {
                        const targetV = variantMap.get(rec.target_variant_id);
                        const label = targetV
                          ? `${targetV.productName} (${targetV.sku})`
                          : `Công thức mổ xẻ #${rec.id.slice(0, 8)}`;
                        return (
                          <option key={rec.id} value={rec.id}>
                            {label} - [Mẫu chuẩn: {rec.output_qty} {targetV?.baseUom || "kg"}]
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-text-sub absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Input Qty to Break Down */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Khối lượng nguyên liệu đưa vào ({disassemblyRawVariant?.baseUom || "kg"})
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={disassemblyInputQty}
                    onChange={(e) => setDisassemblyInputQty(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-surface-app border border-border-default rounded-lg text-sm text-text-main font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    placeholder="e.g. 5.0"
                  />
                  <span className="text-[11px] text-text-sub mt-1 block">
                    Tổng chi phí nguyên liệu: {formatVND(disassemblyTotalRawCost)}
                  </span>
                </div>

                {/* Other Processing Cost */}
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Chi phí nhân công / phụ trợ mổ xẻ (₫)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={disassemblyOtherCost}
                    onChange={(e) => setDisassemblyOtherCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-surface-app border border-border-default rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    placeholder="e.g. 50000"
                  />
                  <span className="text-[11px] text-text-sub mt-1 block">
                    Tổng chi phí đưa vào phân bổ: {formatVND(disassemblyTotalCost)}
                  </span>
                </div>
              </div>

              {/* Raw Variant Info Card */}
              {disassemblyRawVariant && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      <Fish className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-950">
                          {disassemblyRawVariant.productName}
                        </span>
                        <span className="text-xs font-mono text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                          SKU: {disassemblyRawVariant.sku}
                        </span>
                        {isInputQtyOverStock && (
                          <span className="text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                            Khối lượng đưa vào &gt; Tồn kho
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-800/80 mt-0.5 flex items-center gap-3">
                        <span>Đơn vị tính chuẩn: <strong>{disassemblyRawVariant.baseUom}</strong></span>
                        <span>•</span>
                        <span>
                          Tồn kho hiện tại:{" "}
                          <strong className="text-emerald-950">
                            {formatQty(disassemblyRawVariant.currentStock, disassemblyRawVariant.baseUom)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Giá vốn WAC hiện hành:{" "}
                          <strong className="text-emerald-950">{formatVND(disassemblyRawVariant.costPrice)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {hasBatchExpiry && (
                    <div className="border-t sm:border-t-0 sm:border-l border-emerald-200/80 pt-3 sm:pt-0 sm:pl-4">
                      <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                        Mã Lô phân rã / mổ xẻ
                      </label>
                      <input
                        type="text"
                        value={disassemblyBatchCode}
                        onChange={(e) => setDisassemblyBatchCode(e.target.value)}
                        placeholder="e.g. LO-MO-01"
                        className="h-8 px-2.5 bg-white border border-emerald-200 rounded text-xs text-text-main font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Yields Breakdown Table */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <span>Bảng thành phẩm thu được sau pha lóc</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {disassemblyYields.length} bộ phận
                    </span>
                  </h3>
                  <p className="text-xs text-text-sub mt-0.5">
                    Nhập khối lượng thực tế cân được và % phân bổ giá vốn (Tổng % phân bổ phải bằng 100%)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isAllocationBalanced ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Tổng phân bổ: {disassemblyTotalAllocationPercent}% (Cần: 100%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Phân bổ cân bằng: 100%</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted/50 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-sub">
                      <th className="py-3 px-4">Bộ phận / Thành phẩm thu được</th>
                      <th className="py-3 px-4 w-40">Khối lượng thu được</th>
                      <th className="py-3 px-4 w-36 text-center">% Phân bổ giá vốn</th>
                      <th className="py-3 px-4 text-right">Chi phí phân bổ</th>
                      <th className="py-3 px-4 text-right">Đơn giá vốn ước tính</th>
                      {hasBatchExpiry && <th className="py-3 px-4 w-48">Mã Lô & Hạn dùng</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs">
                    {disassemblyYields.map((yieldRow, idx) => {
                      const yieldVariant = variantMap.get(yieldRow.component_variant_id);
                      const uom = yieldVariant?.baseUom || "kg";
                      const allocPct = Number(yieldRow.cost_allocation_percent) || 0;
                      const allocatedCost = (disassemblyTotalCost * allocPct) / 100;
                      const actualQty = Number(yieldRow.actual_qty) || 0;
                      const unitCost = actualQty > 0 ? allocatedCost / actualQty : 0;

                      return (
                        <tr key={idx} className="hover:bg-surface-card-hover transition">
                          <td className="py-3.5 px-4 font-medium text-text-main">
                            <div className="font-semibold text-text-main">
                              {yieldVariant?.productName || "Thành phẩm thu được"}
                            </div>
                            <div className="text-[11px] text-text-sub font-mono">
                              SKU: {yieldVariant?.sku || yieldRow.component_variant_id}
                            </div>
                          </td>

                          {/* Editable Actual Qty */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={yieldRow.actual_qty}
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setDisassemblyYields((prev) => {
                                    const next = [...prev];
                                    next[idx].actual_qty = val;
                                    return next;
                                  });
                                }}
                                className="w-24 h-8 px-2 bg-surface-app border border-border-default rounded text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                              />
                              <span className="text-xs text-text-sub">{uom}</span>
                            </div>
                          </td>

                          {/* Editable Cost Allocation % */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={yieldRow.cost_allocation_percent}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                  setDisassemblyYields((prev) => {
                                    const next = [...prev];
                                    next[idx].cost_allocation_percent = val;
                                    return next;
                                  });
                                }}
                                className="w-16 h-8 px-2 text-center bg-surface-app border border-border-default rounded text-xs font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                              />
                              <span className="text-xs text-text-sub">%</span>
                            </div>
                          </td>

                          {/* Allocated Cost */}
                          <td className="py-3.5 px-4 text-right font-mono text-text-main font-medium">
                            {formatVND(allocatedCost)}
                          </td>

                          {/* Resulting Unit Cost */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-bold font-mono text-emerald-700 text-sm block">
                              {formatVND(unitCost)}
                            </span>
                            <span className="text-[11px] text-text-sub font-mono">
                              / {uom}
                            </span>
                          </td>

                          {/* Batch Expiry Column */}
                          {hasBatchExpiry && (
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  placeholder="Mã lô riêng"
                                  value={yieldRow.batch_code || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDisassemblyYields((prev) => {
                                      const next = [...prev];
                                      next[idx].batch_code = val;
                                      return next;
                                    });
                                  }}
                                  className="w-full h-7 px-2 bg-surface-app border border-border-default rounded text-[11px] font-mono"
                                />
                                <input
                                  type="date"
                                  value={yieldRow.expiry_date || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDisassemblyYields((prev) => {
                                      const next = [...prev];
                                      next[idx].expiry_date = val;
                                      return next;
                                    });
                                  }}
                                  className="w-full h-7 px-2 bg-surface-app border border-border-default rounded text-[11px]"
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes Input in Card Footer */}
              <div className="p-4 bg-surface-muted/30 border-t border-border-subtle">
                <label className="block text-xs font-medium text-text-sub mb-1">
                  Ghi chú mổ xẻ pha lóc (tùy chọn)
                </label>
                <input
                  type="text"
                  value={disassemblyNotes}
                  onChange={(e) => setDisassemblyNotes(e.target.value)}
                  placeholder="Ví dụ: Cá tươi nhập ca sáng từ Nauy, tỷ lệ phi lê đạt 64%..."
                  className="w-full h-9 px-3 bg-white border border-border-default rounded-lg text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Disassembly Summary Card */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/40 pb-5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Cân bằng khối lượng & phân bổ giá vốn
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Thống kê Mổ xẻ & Bảo toàn Vốn Đầu vào
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-emerald-300">Quy tắc kế toán:</span>
                  <div className="text-xs font-mono text-emerald-200 mt-0.5">
                    ∑ (Khối lượng yield × Đơn giá vốn mới) = Tổng chi phí đầu vào
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-emerald-200 block">Khối lượng đưa vào</span>
                  <span className="text-lg font-bold font-mono text-white mt-1 block">
                    {formatQty(disassemblyInputQty, disassemblyRawVariant?.baseUom)}
                  </span>
                  <span className="text-[11px] text-emerald-300/80 mt-1 block">
                    Vốn ban đầu: {formatVND(disassemblyTotalCost)}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-emerald-200 block">Tổng khối lượng thu được</span>
                  <span className="text-lg font-bold font-mono text-white mt-1 block">
                    {formatQty(disassemblyTotalYieldQty, disassemblyRawVariant?.baseUom)}
                  </span>
                  <span className="text-[11px] text-emerald-300/80 mt-1 block">
                    Thu từ {disassemblyYields.length} bộ phận
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-emerald-200 block">Hao hụt khối lượng</span>
                  <span
                    className={`text-lg font-bold font-mono mt-1 block ${
                      disassemblyWasteQty > 0 ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {formatQty(disassemblyWasteQty, disassemblyRawVariant?.baseUom)}
                  </span>
                  <span className="text-[11px] text-emerald-300/80 mt-1 block">
                    Tỷ lệ hao hụt: {formatPercent(disassemblyWastePercent)}
                  </span>
                </div>

                <div
                  className={`rounded-xl p-4 border ${
                    isAllocationBalanced
                      ? "bg-emerald-500/20 border-emerald-400/40"
                      : "bg-rose-500/20 border-rose-400/40"
                  }`}
                >
                  <span className="text-xs font-semibold block text-emerald-200">
                    Tổng % phân bổ giá vốn
                  </span>
                  <span
                    className={`text-2xl font-extrabold font-mono mt-1 block ${
                      isAllocationBalanced ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {disassemblyTotalAllocationPercent}%
                  </span>
                  <span className="text-[11px] mt-1 block text-emerald-200">
                    {isAllocationBalanced ? "Chính xác 100% ✓" : "Phải cân bằng đúng 100%!"}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs">
                  {!isAllocationBalanced ? (
                    <span className="text-rose-300 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Không thể thực thi: Tổng tỷ lệ phân bổ giá vốn phải bằng đúng 100%.
                    </span>
                  ) : (
                    <span className="text-emerald-300 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Giá vốn các thành phẩm đã được phân bổ cân bằng 100%.
                    </span>
                  )}
                </div>

                <button
                  onClick={handleExecuteDisassembly}
                  disabled={
                    isExecutingDisassembly ||
                    !isAllocationBalanced ||
                    disassemblyInputQty <= 0 ||
                    disassemblyYields.some((y) => Number(y.actual_qty) <= 0)
                  }
                  className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  {isExecutingDisassembly ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang phân bổ giá vốn & trừ kho...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Hoàn tất Mổ xẻ Pha lóc</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ==============================================================
          QUICK BOM RECIPE CREATION MODAL
          ============================================================== */}
      {showRecipeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-main">
                    Tạo nhanh công thức định mức (BOM Recipe)
                  </h3>
                  <p className="text-xs text-text-sub">
                    Lập định mức chế biến mẻ (ASSEMBLY) hoặc phân rã mổ xẻ (DISASSEMBLY)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="text-text-disabled hover:text-text-main p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Recipe Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">
                  Loại công thức
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalRecipeType("ASSEMBLY");
                      setModalOutputQty(1);
                    }}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                      modalRecipeType === "ASSEMBLY"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                        : "bg-surface-app border-border-default text-text-sub"
                    }`}
                  >
                    <Factory className="w-4 h-4" />
                    <span>Chế biến mẻ (ASSEMBLY)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalRecipeType("DISASSEMBLY");
                      setModalOutputQty(5);
                    }}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                      modalRecipeType === "DISASSEMBLY"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm"
                        : "bg-surface-app border-border-default text-text-sub"
                    }`}
                  >
                    <Fish className="w-4 h-4" />
                    <span>Mổ xẻ pha lóc (DISASSEMBLY)</span>
                  </button>
                </div>
              </div>

              {/* Target Variant Selection */}
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5">
                  {modalRecipeType === "ASSEMBLY"
                    ? "Sản phẩm thành phẩm đầu ra"
                    : "Nguyên liệu mổ xẻ đầu vào (e.g. Cá Hồi 5kg)"}
                </label>
                <div className="relative">
                  <select
                    value={modalTargetVariantId}
                    onChange={(e) => setModalTargetVariantId(e.target.value)}
                    className="w-full h-10 px-3 pr-8 bg-surface-app border border-border-default rounded-lg text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition appearance-none"
                  >
                    {Array.from(variantMap.values()).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.fullName} - Tồn: {v.currentStock} {v.baseUom}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-sub absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Output Qty and Wastage Percent */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    {modalRecipeType === "ASSEMBLY"
                      ? "Sản lượng mẻ chuẩn (Đầu ra)"
                      : "Khối lượng mổ xẻ chuẩn (Đầu vào)"}
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={modalOutputQty}
                    onChange={(e) => setModalOutputQty(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 bg-surface-app border border-border-default rounded-lg text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1.5">
                    Tỷ lệ hao hụt dự kiến (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={modalWastagePercent}
                    onChange={(e) => setModalWastagePercent(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 bg-surface-app border border-border-default rounded-lg text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Recipe Items List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-main">
                    {modalRecipeType === "ASSEMBLY"
                      ? "Danh sách nguyên vật liệu cấu thành"
                      : "Danh sách thành phẩm thu được sau pha lóc"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddModalItem}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm thành phần</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {modalItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-surface-muted/50 border border-border-subtle rounded-lg flex items-center gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <select
                          value={item.component_variant_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModalItems((prev) => {
                              const next = [...prev];
                              next[idx].component_variant_id = val;
                              return next;
                            });
                          }}
                          className="w-full h-8 px-2 bg-white border border-border-default rounded text-xs text-text-main"
                        >
                          {Array.from(variantMap.values()).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.fullName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {modalRecipeType === "ASSEMBLY" ? (
                        <div className="w-28 flex items-center gap-1">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            placeholder="Số lượng"
                            value={item.qty_required}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setModalItems((prev) => {
                                const next = [...prev];
                                next[idx].qty_required = val;
                                return next;
                              });
                            }}
                            className="w-full h-8 px-2 bg-white border border-border-default rounded text-xs font-mono"
                          />
                        </div>
                      ) : (
                        <div className="w-28 flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            placeholder="% Phân bổ"
                            value={item.cost_allocation_percent}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setModalItems((prev) => {
                                const next = [...prev];
                                next[idx].cost_allocation_percent = val;
                                return next;
                              });
                            }}
                            className="w-full h-8 px-2 bg-white border border-border-default rounded text-xs font-mono font-bold text-emerald-700"
                          />
                          <span className="text-[11px] text-text-sub">%</span>
                        </div>
                      )}

                      {modalItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveModalItem(idx)}
                          className="p-1.5 text-text-disabled hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {modalRecipeType === "DISASSEMBLY" && (
                  <div className="text-right text-[11px] font-semibold">
                    Tổng % phân bổ:{" "}
                    <span
                      className={
                        Math.abs(
                          modalItems.reduce(
                            (s, it) => s + (Number(it.cost_allocation_percent) || 0),
                            0
                          ) - 100
                        ) < 0.01
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }
                    >
                      {modalItems.reduce(
                        (s, it) => s + (Number(it.cost_allocation_percent) || 0),
                        0
                      )}
                      % / 100%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setShowRecipeModal(false)}
                className="px-4 py-2 border border-border-subtle text-text-sub hover:text-text-main rounded-lg text-xs font-medium transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveModalRecipe}
                disabled={isCreatingRecipe}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {isCreatingRecipe ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Lưu công thức định mức</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
