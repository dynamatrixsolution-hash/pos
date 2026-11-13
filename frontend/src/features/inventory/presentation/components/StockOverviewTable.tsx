"use client";

import React from "react";
import { Package, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { useInventoryStockStore } from "../../state/inventory-stock.store";
import { useInventoryUiStore } from "../../state/inventory-ui.store";
import { formatNPR } from "@/lib/currency";

export const StockOverviewTable: React.FC = () => {
  const inventory = useInventoryStockStore((s) => s.inventory);
  const loading = useInventoryStockStore((s) => s.loading);
  const openAdjustmentModal = useInventoryUiStore((s) => s.openAdjustmentModal);

  if (loading) {
    return (
      <div className="py-16 text-center rounded-xl border border-[#D8CEC1] bg-[#FFFCF7]">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
        <p className="text-xs text-[#71675E] font-medium mt-2">Loading inventory stock records...</p>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
        <Package className="h-8 w-8 text-[#71675E]/40 mx-auto" />
        <h3 className="text-sm font-bold text-[#292320]">No Inventory Items Found</h3>
        <p className="text-xs text-[#71675E]">
          Try adjusting your search query or clear the low stock filter.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F7F3EC] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
              <th className="py-3 px-4">Product Name &amp; SKU</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-right">Cost Price</th>
              <th className="py-3 px-3 text-right">Selling Price</th>
              <th className="py-3 px-3 text-right">Current Stock</th>
              <th className="py-3 px-3 text-right">Valuation</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                {/* Product Name & SKU */}
                <td className="py-3 px-4">
                  <div className="font-bold text-[#292320]">{item.name}</div>
                  <div className="text-[11px] text-[#71675E] flex items-center gap-2 mt-0.5">
                    <span>SKU: {item.sku || "N/A"}</span>
                    {item.barcode && <span>• Barcode: {item.barcode}</span>}
                  </div>
                </td>

                {/* Category */}
                <td className="py-3 px-3 text-[#71675E]">
                  <span className="px-2 py-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] font-medium">
                    {item.categoryName || "General"}
                  </span>
                </td>

                {/* Cost Price */}
                <td className="py-3 px-3 text-right font-mono tabular-nums text-[#71675E]">
                  {formatNPR(item.costPrice)}
                </td>

                {/* Selling Price */}
                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#292320]">
                  {formatNPR(item.sellingPrice)}
                </td>

                {/* Current Stock */}
                <td className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5 font-bold font-mono tabular-nums">
                    {item.isLowStock && (
                      <span title="Low stock threshold reached">
                        <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />
                      </span>
                    )}
                    <span className={item.isLowStock ? "text-[#B45309]" : "text-[#292320]"}>
                      {item.totalQuantity} {item.unitName || "pcs"}
                    </span>
                  </div>
                  {item.alertQuantity > 0 && (
                    <div className="text-[10px] text-[#71675E]">
                      Alert at {item.alertQuantity}
                    </div>
                  )}
                </td>

                {/* Valuation */}
                <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[#6B2837]">
                  {formatNPR(item.valuation)}
                </td>

                {/* Action */}
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => openAdjustmentModal(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                  >
                    <SlidersHorizontal className="h-3 w-3 text-[#6B2837]" />
                    <span>Adjust</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

