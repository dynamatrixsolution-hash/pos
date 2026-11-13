"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import {
  UtensilsCrossed,
  Package,
  ShoppingBag,
  Edit2,
  Trash2,
  BookOpen,
  ArrowUpDown,
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

export const ProductGridView: React.FC = () => {
  const products = useProductsStore((s) => s.products);
  const deleteProduct = useProductsStore((s) => s.deleteProduct);

  const search = useProductsUiStore((s) => s.search);
  const selectedCategoryId = useProductsUiStore((s) => s.selectedCategoryId);
  const productTypeFilter = useProductsUiStore((s) => s.productTypeFilter);
  const onlyLowStock = useProductsUiStore((s) => s.onlyLowStock);

  const openEditModal = useProductsUiStore((s) => s.openEditModal);
  const openAdjustModal = useProductsUiStore((s) => s.openAdjustModal);
  const openBomModal = useProductsUiStore((s) => s.openBomModal);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productTypeFilter === "RESTAURANT") {
        if (!p.menuItems || p.menuItems.length === 0) return false;
      } else if (productTypeFilter === "INGREDIENTS") {
        if (!p.recipeIngredients || p.recipeIngredients.length === 0) return false;
      } else if (productTypeFilter === "RETAIL") {
        const isDish = Boolean(p.menuItems && p.menuItems.length > 0);
        const isIng = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);
        if (isDish || isIng) return false;
      }

      if (selectedCategoryId !== "ALL" && p.categoryId !== selectedCategoryId) {
        return false;
      }

      const totalStock = (p.productStocks || []).reduce((acc, s) => acc + s.quantity, 0);
      if (onlyLowStock) {
        if (!p.alertQuantity || totalStock > p.alertQuantity) return false;
      }

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-8">
      {filteredProducts.map((p) => {
        const isDish = Boolean(p.menuItems && p.menuItems.length > 0);
        const isIng = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);

        const totalStock = (p.productStocks || []).reduce((acc, s) => acc + s.quantity, 0);
        const isLowStock = Boolean(p.alertQuantity && totalStock <= p.alertQuantity);
        const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
        const unitLabel = p.unit?.name || "units";

        return (
          <div
            key={p.id}
            className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-3 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-all group"
          >
            {/* Top Media & Type Badge */}
            <div className="relative h-36 rounded-lg bg-[#F7F3EC] overflow-hidden border border-[#D8CEC1] flex items-center justify-center">
              {p.image ? (
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 300px"
                />
              ) : (
                <div className="text-center p-4">
                  {isDish ? (
                    <UtensilsCrossed className="h-8 w-8 text-[#6B2837]/40 mx-auto mb-1" />
                  ) : isIng ? (
                    <Package className="h-8 w-8 text-[#B45309]/40 mx-auto mb-1" />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-[#1E40AF]/40 mx-auto mb-1" />
                  )}
                  <span className="text-[10px] text-[#71675E]">No image uploaded</span>
                </div>
              )}

              {/* Badges on image */}
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                    isDish
                      ? "bg-[#6B2837] text-white"
                      : isIng
                      ? "bg-[#B45309] text-white"
                      : "bg-[#1E40AF] text-white"
                  }`}
                >
                  {isDish ? "Dish" : isIng ? "Stock" : "Retail"}
                </span>
                {p.isVatItem && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] shadow-xs">
                    13% VAT
                  </span>
                )}
              </div>

              {isLowStock && !isDish && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white flex items-center gap-1 shadow-xs">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>Low Stock</span>
                </div>
              )}
            </div>

            {/* Information */}
            <div className="space-y-1.5 flex-1">
              <div className="flex items-start justify-between gap-1">
                <h4 className="font-bold text-xs text-[#292320] line-clamp-1 group-hover:text-[#6B2837] transition-colors">
                  {p.name}
                </h4>
              </div>

              <p className="text-[11px] text-[#71675E] truncate">
                {p.category?.name || "Uncategorized"}
                {p.subcategory?.name && ` › ${p.subcategory.name}`}
              </p>

              <div className="pt-2 border-t border-[#D8CEC1]/50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-[#71675E] block">Selling Price</span>
                  <span className="font-mono font-black text-[#6B2837] tabular-nums">
                    {formatNPR(p.sellingPrice)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#71675E] block">
                    {isDish ? "Gross Margin" : "Stock"}
                  </span>
                  {isDish ? (
                    <span className="font-mono font-bold text-xs text-[#16A34A] tabular-nums">
                      {margin.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-xs text-[#292320] tabular-nums">
                      {totalStock} {unitLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-between gap-1.5">
              {isDish ? (
                <button
                  type="button"
                  onClick={() => openBomModal(p)}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#6B2837] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <BookOpen className="h-3 w-3" />
                  <span>Recipe BOM</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAdjustModal(p)}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#2D6A4F] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  <span>Adjust Stock</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openEditModal(p)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Edit item"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(p)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Delete item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

