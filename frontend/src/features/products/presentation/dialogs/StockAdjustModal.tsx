"use client";

import React, { useState } from "react";
import {
  X,
  ArrowUpDown,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import { StockAdjustmentType } from "../../models/product.types";

export const StockAdjustModal: React.FC = () => {
  const isAdjustModalOpen = useProductsUiStore((s) => s.isAdjustModalOpen);
  const closeAdjustModal = useProductsUiStore((s) => s.closeAdjustModal);
  const adjustProduct = useProductsUiStore((s) => s.adjustProduct);

  const branches = useProductsStore((s) => s.branches);
  const isAdjusting = useProductsStore((s) => s.isAdjusting);
  const adjustStock = useProductsStore((s) => s.adjustStock);

  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [type, setType] = useState<StockAdjustmentType>("RESTOCK");
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isAdjustModalOpen || !adjustProduct) return null;

  const currentBranchStock =
    adjustProduct.productStocks?.find((st) => st.branchId === branchId)?.quantity || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setError("Please select a branch.");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    setError(null);
    const ok = await adjustStock({
      productId: adjustProduct.id,
      branchId,
      type,
      quantity,
      reason: reason.trim() || `Manual adjustment: ${type}`,
    });

    if (!ok) {
      setError("Failed to record stock adjustment. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#2D6A4F] text-white">
              <ArrowUpDown className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Adjust Stock — {adjustProduct.name}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Record replenishment, spoilage, damage, or inventory count correction
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAdjustModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current Stock Banner */}
        <div className="px-5 py-3 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 flex items-center justify-between text-xs">
          <span className="text-[#71675E]">Current Branch Stock:</span>
          <span className="font-mono font-bold text-sm text-[#292320] tabular-nums">
            {currentBranchStock.toLocaleString()} {adjustProduct.unit?.name || "units"}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Branch */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Target Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isMain ? "(Main Outlet)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Adjustment Reason / Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StockAdjustmentType)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="RESTOCK">Stock In / Replenishment (+)</option>
              <option value="DAMAGE">Kitchen Spoilage / Damage (-)</option>
              <option value="CORRECTION">Physical Audit Correction (±)</option>
              <option value="DECREASE">Manual Stock Out (-)</option>
            </select>
          </div>

          {/* Quantity */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Quantity ({adjustProduct.unit?.name || "units"})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Notes / Audit Reason */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Audit Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Expired batch, morning supplier delivery, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeAdjustModal}
              disabled={isAdjusting}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isAdjusting}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#2D6A4F] hover:bg-[#24533E] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isAdjusting ? "Updating..." : "Commit Stock"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

