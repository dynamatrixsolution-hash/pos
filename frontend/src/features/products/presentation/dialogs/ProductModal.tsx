"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  UtensilsCrossed,
  Package,
  ShoppingBag,
  Barcode,
  Save,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import {
  FormMode,
  KITCHEN_UNITS,
  KITCHEN_STATIONS,
  ProductFormData,
} from "../../models/product.types";

export const ProductModal: React.FC = () => {
  const isProductModalOpen = useProductsUiStore((s) => s.isProductModalOpen);
  const closeProductModal = useProductsUiStore((s) => s.closeProductModal);
  const formMode = useProductsUiStore((s) => s.formMode);
  const setFormMode = useProductsUiStore((s) => s.setFormMode);
  const editingProduct = useProductsUiStore((s) => s.editingProduct);

  const categories = useProductsStore((s) => s.categories);
  const subcategories = useProductsStore((s) => s.subcategories);
  const units = useProductsStore((s) => s.units);
  const isSaving = useProductsStore((s) => s.isSaving);
  const createProduct = useProductsStore((s) => s.createProduct);
  const updateProduct = useProductsStore((s) => s.updateProduct);

  // Form State
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    sku: "",
    barcode: "",
    costPrice: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    alertQuantity: 5,
    categoryId: "",
    subcategoryId: "",
    initialStock: 0,
    isVatItem: false,
    image: "",
    isRestaurantDish: formMode === "MENU_DISH",
    unitName: "pcs",
    description: "",
    prepTimeMinutes: 15,
    kitchenStation: "Main Kitchen",
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill form when editingProduct or formMode changes
  useEffect(() => {
    if (editingProduct) {
      const isDish = Boolean(editingProduct.menuItems && editingProduct.menuItems.length > 0);
      const menuItem = editingProduct.menuItems?.[0];

      setFormData({
        name: editingProduct.name || "",
        sku: editingProduct.sku || "",
        barcode: editingProduct.barcode || "",
        costPrice: Number(editingProduct.costPrice) || 0,
        sellingPrice: Number(editingProduct.sellingPrice) || 0,
        wholesalePrice: Number(editingProduct.wholesalePrice) || 0,
        alertQuantity: Number(editingProduct.alertQuantity) || 5,
        categoryId: editingProduct.categoryId || "",
        subcategoryId: editingProduct.subcategoryId || "",
        initialStock: 0,
        isVatItem: Boolean(editingProduct.isVatItem),
        image: editingProduct.image || "",
        isRestaurantDish: isDish,
        unitName: editingProduct.unit?.name || "pcs",
        description: editingProduct.description || "",
        prepTimeMinutes: menuItem?.prepTimeMinutes ?? 15,
        kitchenStation: menuItem?.kitchenStation || "Main Kitchen",
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        costPrice: 0,
        sellingPrice: 0,
        wholesalePrice: 0,
        alertQuantity: formMode === "KITCHEN_STOCK" ? 10 : 5,
        categoryId: categories[0]?.id || "",
        subcategoryId: "",
        initialStock: formMode === "KITCHEN_STOCK" ? 20 : 0,
        isVatItem: false,
        image: "",
        isRestaurantDish: formMode === "MENU_DISH",
        unitName: formMode === "KITCHEN_STOCK" ? "kg" : "pcs",
        description: "",
        prepTimeMinutes: 15,
        kitchenStation: "Main Kitchen",
      });
    }
    setFormError(null);
  }, [editingProduct, formMode, categories]);

  if (!isProductModalOpen) return null;

  // Filter subcategories for the selected category
  const filteredSubcategories = subcategories.filter(
    (sub) => sub.categoryId === formData.categoryId
  );

  const handleGenerateBarcode = () => {
    const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData((prev) => ({
      ...prev,
      barcode: random12,
      sku: prev.sku || `SKU-${random12.slice(-6)}`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    setFormError(null);
    const payload: ProductFormData = {
      ...formData,
      isRestaurantDish: formMode === "MENU_DISH",
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      wholesalePrice: Number(formData.wholesalePrice) || 0,
      alertQuantity: Number(formData.alertQuantity) || 0,
      initialStock: Number(formData.initialStock) || 0,
      prepTimeMinutes: formMode === "MENU_DISH" ? Number(formData.prepTimeMinutes) || 15 : null,
      kitchenStation: formMode === "MENU_DISH" ? formData.kitchenStation : null,
    };

    let ok = false;
    if (editingProduct) {
      ok = await updateProduct(editingProduct.id, payload);
    } else {
      ok = await createProduct(payload);
    }

    if (!ok) {
      setFormError("Failed to save product. Please check your inputs and try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              {formMode === "MENU_DISH" ? (
                <UtensilsCrossed className="h-4 w-4" />
              ) : formMode === "KITCHEN_STOCK" ? (
                <Package className="h-4 w-4" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingProduct ? `Edit ${editingProduct.name}` : "Create New Product"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {formMode === "MENU_DISH"
                  ? "Configure menu dish pricing, prep time, and kitchen KDS station"
                  : formMode === "KITCHEN_STOCK"
                  ? "Add raw ingredients and food stock for recipes & inventory tracking"
                  : "Add retail items, packaged goods, or merchandise"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeProductModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs (when creating) */}
        {!editingProduct && (
          <div className="px-5 py-2.5 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-[#71675E] uppercase tracking-wider mr-1">
              Item Type:
            </span>
            <button
              type="button"
              onClick={() => setFormMode("MENU_DISH")}
              className={`h-7 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                formMode === "MENU_DISH"
                  ? "bg-[#6B2837] text-white shadow-2xs"
                  : "bg-[#FFFCF7] text-[#71675E] border border-[#D8CEC1] hover:text-[#292320]"
              }`}
            >
              <UtensilsCrossed className="h-3 w-3" />
              <span>Menu Dish</span>
            </button>

            <button
              type="button"
              onClick={() => setFormMode("KITCHEN_STOCK")}
              className={`h-7 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                formMode === "KITCHEN_STOCK"
                  ? "bg-[#6B2837] text-white shadow-2xs"
                  : "bg-[#FFFCF7] text-[#71675E] border border-[#D8CEC1] hover:text-[#292320]"
              }`}
            >
              <Package className="h-3 w-3" />
              <span>Kitchen Raw Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setFormMode("RETAIL")}
              className={`h-7 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                formMode === "RETAIL"
                  ? "bg-[#6B2837] text-white shadow-2xs"
                  : "bg-[#FFFCF7] text-[#71675E] border border-[#D8CEC1] hover:text-[#292320]"
              }`}
            >
              <ShoppingBag className="h-3 w-3" />
              <span>Retail Merchandise</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {formError}
            </div>
          )}

          {/* Row 1: Name & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">
                Product Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={
                  formMode === "MENU_DISH"
                    ? "e.g. Royal Thakali Mutton Thali"
                    : formMode === "KITCHEN_STOCK"
                    ? "e.g. Basmati Rice (25kg Bag)"
                    : "e.g. Mineral Water 1L"
                }
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#292320]">Barcode</label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[10px] text-[#6B2837] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Auto Generate</span>
                </button>
              </div>
              <div className="relative">
                <Barcode className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={formData.barcode || ""}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono focus:border-[#6B2837] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Category, Subcategory & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Category</label>
              <select
                value={formData.categoryId || ""}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: "" })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Subcategory</label>
              <select
                value={formData.subcategoryId || ""}
                onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                disabled={!formData.categoryId || filteredSubcategories.length === 0}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="">Select Subcategory</option>
                {filteredSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Unit of Measure</label>
              <select
                value={formData.unitName || "pcs"}
                onChange={(e) => setFormData({ ...formData, unitName: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                {KITCHEN_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
                {units.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Pricing & VAT */}
          <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC]/60 space-y-3">
            <h4 className="text-xs font-bold text-[#292320]">Pricing &amp; Margins</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#71675E]">Cost Price (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#292320]">Selling Price (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#71675E]">Wholesale / Corporate (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.wholesalePrice || 0}
                  onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#D8CEC1]/50 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#292320]">
                <input
                  type="checkbox"
                  checked={formData.isVatItem}
                  onChange={(e) => setFormData({ ...formData, isVatItem: e.target.checked })}
                  className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                />
                <span>Subject to 13% VAT</span>
              </label>

              {formData.sellingPrice > 0 && (
                <div className="text-[11px] font-mono text-[#71675E]">
                  Gross Margin:{" "}
                  <span className="font-bold text-[#16A34A]">
                    {(((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Restaurant Dish Specific Settings (Prep time & KDS station) */}
          {formMode === "MENU_DISH" && (
            <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
              <h4 className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5 text-[#6B2837]" />
                <span>Kitchen Display &amp; Cooking Routing</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#71675E]">Kitchen Station</label>
                  <select
                    value={formData.kitchenStation || "Main Kitchen"}
                    onChange={(e) => setFormData({ ...formData, kitchenStation: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                  >
                    {KITCHEN_STATIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#71675E] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#71675E]" />
                    <span>Prep Time (Minutes)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={formData.prepTimeMinutes || 15}
                    onChange={(e) => setFormData({ ...formData, prepTimeMinutes: parseInt(e.target.value) || 15 })}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Non-dish Inventory Settings */}
          {formMode !== "MENU_DISH" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#71675E]">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={formData.alertQuantity || 5}
                  onChange={(e) => setFormData({ ...formData, alertQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              {!editingProduct && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#71675E]">Initial Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.initialStock || 0}
                    onChange={(e) => setFormData({ ...formData, initialStock: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Image URL & Description */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Image URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.image || ""}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Description / Notes</label>
              <textarea
                rows={2}
                placeholder="Dish taste profile, allergens, or retail specs..."
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeProductModal}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

