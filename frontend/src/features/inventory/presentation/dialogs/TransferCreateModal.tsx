"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowRightLeft, Plus, Trash2, Building2, Save } from "lucide-react";
import { useInventoryTransfersStore } from "../../state/inventory-transfers.store";

interface TransferLineDraft {
  productId: string;
  quantity: number;
  remarks?: string;
}

export const TransferCreateModal: React.FC = () => {
  const isCreateModalOpen = useInventoryTransfersStore((s) => s.isCreateModalOpen);
  const closeCreateModal = useInventoryTransfersStore((s) => s.closeCreateModal);
  const branches = useInventoryTransfersStore((s) => s.branches);
  const products = useInventoryTransfersStore((s) => s.products);
  const stockOverview = useInventoryTransfersStore((s) => s.stockOverview);
  const createTransfer = useInventoryTransfersStore((s) => s.createTransfer);
  const isSaving = useInventoryTransfersStore((s) => s.isSaving);

  const [sourceBranchId, setSourceBranchId] = useState("");
  const [destinationBranchId, setDestinationBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TransferLineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length >= 2) {
      setSourceBranchId(branches[0].id);
      setDestinationBranchId(branches[1].id);
    } else if (branches.length === 1) {
      setSourceBranchId(branches[0].id);
      setDestinationBranchId("");
    }
    setNotes("");
    if (products.length > 0) {
      setLines([{ productId: products[0].id, quantity: 1, remarks: "" }]);
    } else {
      setLines([]);
    }
    setError(null);
  }, [isCreateModalOpen, branches, products]);

  if (!isCreateModalOpen) return null;

  const handleAddLine = () => {
    if (products.length > 0) {
      setLines((prev) => [...prev, { productId: products[0].id, quantity: 1, remarks: "" }]);
    }
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, field: keyof TransferLineDraft, val: any) => {
    setLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, [field]: val } : line))
    );
  };

  const getSourceStock = (productId: string): number => {
    const stockItem = stockOverview.find(
      (s: any) => s.productId === productId && s.branchId === sourceBranchId
    );
    return stockItem?.quantity || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBranchId) {
      setError("Please select source branch");
      return;
    }
    if (!destinationBranchId) {
      setError("Please select destination branch");
      return;
    }
    if (sourceBranchId === destinationBranchId) {
      setError("Source and destination branch cannot be identical");
      return;
    }
    if (lines.length === 0) {
      setError("Please add at least one product to transfer");
      return;
    }
    for (const l of lines) {
      if (!l.productId) {
        setError("All rows must have a selected product");
        return;
      }
      if (l.quantity <= 0) {
        setError("All quantities must be greater than zero");
        return;
      }
    }

    const payload = {
      sourceBranchId,
      destinationBranchId,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        remarks: l.remarks?.trim() || null,
      })),
    };

    const success = await createTransfer(payload);
    if (!success) {
      setError("Failed to create transfer request");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">Create Stock Transfer</h3>
              <p className="text-[11px] text-[#71675E]">
                Initiate inventory movement request between branches
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCreateModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#DC2626] font-medium shrink-0">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Branch Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC]">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320] flex items-center gap-1">
                <Building2 className="h-3 w-3 text-[#71675E]" />
                <span>Source Branch (Sender) *</span>
              </label>
              <select
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320] flex items-center gap-1">
                <Building2 className="h-3 w-3 text-[#6B2837]" />
                <span>Destination Branch (Receiver) *</span>
              </label>
              <select
                value={destinationBranchId}
                onChange={(e) => setDestinationBranchId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Transfer Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#292320]">Transfer Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#6B2837] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const availableStock = getSourceStock(line.productId);

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center gap-2.5"
                  >
                    {/* Product */}
                    <div className="flex-1 min-w-[180px]">
                      <select
                        value={line.productId}
                        onChange={(e) => handleUpdateLine(idx, "productId", e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) =>
                          handleUpdateLine(idx, "quantity", Number(e.target.value))
                        }
                        className="w-full h-8 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none text-right"
                      />
                    </div>

                    {/* Stock available badge */}
                    <div className="text-[10px] text-[#71675E] bg-[#F7F3EC] px-2 py-1 rounded border border-[#D8CEC1] shrink-0 font-mono tabular-nums">
                      Avail: {availableStock}
                    </div>

                    {/* Delete Line */}
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 rounded text-[#71675E] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Transfer Notes / Instructions</label>
            <input
              type="text"
              placeholder="e.g. Urgent stock replenishment for weekend rush..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Creating..." : "Submit Transfer Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

