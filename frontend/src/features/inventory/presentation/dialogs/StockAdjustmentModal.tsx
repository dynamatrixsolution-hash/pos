"use client";

import React, { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useInventoryUiStore } from "../../state/inventory-ui.store";
import { useInventoryStockStore } from "../../state/inventory-stock.store";

export const StockAdjustmentModal: React.FC = () => {
  const isOpen = useInventoryUiStore((s) => s.isAdjustmentModalOpen);
  const close = useInventoryUiStore((s) => s.closeAdjustmentModal);
  const selectedProduct = useInventoryUiStore((s) => s.selectedProductForAdjustment);

  const branches = useInventoryStockStore((s) => s.branches);
  const submitAdjustment = useInventoryStockStore((s) => s.submitAdjustment);
  const submitting = useInventoryStockStore((s) => s.submittingAdjustment);

  const [type, setType] = useState<"STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "CORRECTION">("STOCK_IN");
  const [quantity, setQuantity] = useState("1");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [notes, setNotes] = useState("");

  if (!isOpen || !selectedProduct) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;

    await submitAdjustment({
      productId: selectedProduct.id,
      branchId: branchId || undefined,
      type,
      quantity: qty,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#6B2837]" />
            <div>
              <h3 className="text-sm font-bold text-[#292320]">Adjust Stock Quantity</h3>
              <p className="text-[11px] text-[#71675E]">{selectedProduct.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="p-3 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] text-xs flex justify-between">
            <span className="text-[#71675E]">Current Stock Level:</span>
            <span className="font-bold font-mono text-[#292320]">
              {selectedProduct.totalQuantity} {selectedProduct.unitName || "pcs"}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Adjustment Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="STOCK_IN">Stock In (Receive / Restock)</option>
              <option value="STOCK_OUT">Stock Out (Usage / Return)</option>
              <option value="DAMAGE">Damage / Wastage</option>
              <option value="CORRECTION">Manual Count Correction</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            {branches.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-[#292320] mb-1">Target Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Broken in storage, physical audit variance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white cursor-pointer shadow-xs transition-colors"
            >
              {submitting ? "Applying..." : "Confirm Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

