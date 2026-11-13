"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import {
  UtensilsCrossed,
  Package,
  ShoppingBag,
  Edit2,
  Trash2,
  ArrowUpDown,
  BookOpen,
  Clock,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import { ProductItem } from "../../models/product.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const ProductTable: React.FC = () => {
  const products = useProductsStore((s) => s.products);
  const isLoading = useProductsStore((s) => s.isLoading);
  const deleteProduct = useProductsStore((s) => s.deleteProduct);

  const search = useProductsUiStore((s) => s.search);
  const selectedCategoryId = useProductsUiStore((s) => s.selectedCategoryId);
  const productTypeFilter = useProductsUiStore((s) => s.productTypeFilter);
  const onlyLowStock = useProductsUiStore((s) => s.onlyLowStock);

  const openEditModal = useProductsUiStore((s) => s.openEditModal);
  const openAdjustModal = useProductsUiStore((s) => s.openAdjustModal);
  const openBomModal = useProductsUiStore((s) => s.openBomModal);

  // Filter products locally for instantaneous responsiveness
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Type Filter
      if (productTypeFilter === "RESTAURANT") {
        if (!p.menuItems || p.menuItems.length === 0) return false;
      } else if (productTypeFilter === "INGREDIENTS") {
        if (!p.recipeIngredients || p.recipeIngredients.length === 0) return false;
      } else if (productTypeFilter === "RETAIL") {
        const isDish = Boolean(p.menuItems && p.menuItems.length > 0);
        const isIng = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);
        if (isDish || isIng) return false;
      }

      // 2. Category Filter
      if (selectedCategoryId !== "ALL" && p.categoryId !== selectedCategoryId) {
        return false;
      }

      // 3. Low stock filter
      const totalStock = (p.productStocks || []).reduce((acc, s) => acc + s.quantity, 0);
      if (onlyLowStock) {
        if (!p.alertQuantity || totalStock > p.alertQuantity) return false;
      }

      // 4. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (p.name || "").toLowerCase();
        const barcode = (p.barcode || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const cat = (p.category?.name || "").toLowerCase();
        if (!name.includes(q) && !barcode.includes(q) && !sku.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [products, productTypeFilter, selectedCategoryId, onlyLowStock, search]);

  const handleDelete = async (p: ProductItem) => {
    if (window.confirm(`Are you sure you want to delete "${p.name}"? This action cannot be undone.`)) {
      await deleteProduct(p.id);
    }
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[#EEE7DD]/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <Package className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <h3 className="font-bold text-sm text-[#292320]">No products found</h3>
        <p className="text-xs text-[#71675E] max-w-sm mx-auto">
          No items match your selected filters or search query. Try clearing your filters or create a new product.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Product / Item</th>
              <th className="py-3 px-3">Type &amp; Category</th>
              <th className="py-3 px-3 text-right">Cost Price</th>
              <th className="py-3 px-3 text-right">Selling Price</th>
              <th className="py-3 px-3 text-right">Margin</th>
              <th className="py-3 px-3 text-center">Stock Level</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {filteredProducts.map((p) => {
              const isDish = Boolean(p.menuItems && p.menuItems.length > 0);
              const isIng = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);

              const totalStock = (p.productStocks || []).reduce((acc, s) => acc + s.quantity, 0);
              const isLowStock = Boolean(p.alertQuantity && totalStock <= p.alertQuantity);

              const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
              const unitLabel = p.unit?.name || "units";

              return (
                <tr
                  key={p.id}
                  className="hover:bg-[#F7F3EC]/50 transition-colors group text-[#292320]"
                >
                  {/* Product Info with Image/Icon */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] overflow-hidden shrink-0 relative flex items-center justify-center">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : isDish ? (
                          <UtensilsCrossed className="h-4 w-4 text-[#6B2837]" />
                        ) : isIng ? (
                          <Package className="h-4 w-4 text-[#B45309]" />
                        ) : (
                          <ShoppingBag className="h-4 w-4 text-[#1E40AF]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[#292320] truncate group-hover:text-[#6B2837] transition-colors">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#71675E] font-mono mt-0.5">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>• Barcode: {p.barcode}</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Type & Category */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDish
                            ? "bg-[#F8EEF0] text-[#6B2837] border border-[#E9CDD3]"
                            : isIng
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-blue-50 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {isDish ? "Restaurant Dish" : isIng ? "Kitchen Raw Stock" : "Retail Merchandise"}
                      </span>
                      <div className="text-[11px] text-[#71675E] truncate">
                        {p.category?.name || "Uncategorized"}
                        {p.subcategory?.name && ` › ${p.subcategory.name}`}
                      </div>
                    </div>
                  </td>

                  {/* Cost Price */}
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#71675E]">
                    {formatNPR(p.costPrice)}
                  </td>

                  {/* Selling Price */}
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold tabular-nums text-[#292320]">
                    {formatNPR(p.sellingPrice)}
                    {p.isVatItem && (
                      <span className="block text-[9px] font-sans text-[#71675E] font-normal">
                        +13% VAT
                      </span>
                    )}
                  </td>

                  {/* Margin % */}
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold tabular-nums">
                    <span
                      className={
                        margin >= 50
                          ? "text-[#16A34A]"
                          : margin >= 25
                          ? "text-[#B45309]"
                          : "text-[#DC2626]"
                      }
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </td>

                  {/* Stock Level */}
                  <td className="py-3 px-3 text-center">
                    {isDish ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#F7F3EC] text-[#71675E]">
                        <Layers className="h-3 w-3" />
                        <span>Made to Order</span>
                      </span>
                    ) : (
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`font-mono font-bold text-xs tabular-nums ${
                            isLowStock ? "text-[#DC2626]" : "text-[#292320]"
                          }`}
                        >
                          {totalStock.toLocaleString()} {unitLabel}
                        </span>
                        {isLowStock && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-red-100 text-[#DC2626] border border-red-200 mt-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            <span>Low Stock</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isDish && (
                        <button
                          type="button"
                          onClick={() => openBomModal(p)}
                          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#6B2837] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="View / Edit Dish Recipe BOM"
                        >
                          <BookOpen className="h-3 w-3" />
                          <span>Recipe</span>
                        </button>
                      )}

                      {!isDish && (
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p)}
                          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#2D6A4F] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Quick Stock Adjustment"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                          <span>Stock</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        title="Edit Product"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        title="Delete Product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

