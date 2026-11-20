"use client";

import React, { useState, useEffect } from "react";
import { X, ShoppingCart, Plus, Trash2, Save, Building2 } from "lucide-react";
import { usePurchasesStore } from "../../state/purchases.store";
import { PaymentMethod } from "../../models/financials.types";

interface PurchaseItemDraft {
  productId: string;
  quantity: number;
  price: number;
  batchNumber?: string;
  expiryDate?: string;
}

export const PurchaseCreateModal: React.FC = () => {
  const isCreateModalOpen = usePurchasesStore((s) => s.isCreateModalOpen);
  const closeCreateModal = usePurchasesStore((s) => s.closeCreateModal);
  const suppliers = usePurchasesStore((s) => s.suppliers);
  const branches = usePurchasesStore((s) => s.branches);
  const products = usePurchasesStore((s) => s.products);
  const createPurchase = usePurchasesStore((s) => s.createPurchase);
  const isSaving = usePurchasesStore((s) => s.isSaving);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suppliers.length > 0) setSupplierId(suppliers[0].id);
    if (branches.length > 0) setBranchId(branches[0].id);
    setInvoiceNumber("");
    setDiscount("0");
    setTax("0");
    setPaidAmount("0");
    setPaymentMethod("CASH");
    setNotes("");
    if (products.length > 0) {
      setLines([
        {
          productId: products[0].id,
          quantity: 1,
          price: Number(products[0].costPrice) || 0,
        },
      ]);
    } else {
      setLines([]);
    }
    setError(null);
  }, [isCreateModalOpen, suppliers, branches, products]);

  if (!isCreateModalOpen) return null;

  const handleAddLine = () => {
    if (products.length > 0) {
      setLines((prev) => [
        ...prev,
        {
          productId: products[0].id,
          quantity: 1,
          price: Number(products[0].costPrice) || 0,
        },
      ]);
    }
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, field: keyof PurchaseItemDraft, val: any) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: val };
        if (field === "productId") {
          const p = products.find((prod) => prod.id === val);
          if (p?.costPrice) updated.price = Number(p.costPrice);
        }
        return updated;
      })
    );
  };

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.price || 0), 0);
  const discNum = Number(discount) || 0;
  const taxNum = Number(tax) || 0;
  const total = Math.max(0, subtotal - discNum + taxNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError("Please select a vendor supplier");
      return;
    }
    if (lines.length === 0) {
      setError("Please add at least one line item");
      return;
    }

    const payload = {
      supplierId,
      branchId: branchId || null,
      invoiceNumber: invoiceNumber.trim() || null,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        price: Number(l.price),
        batchNumber: l.batchNumber?.trim() || null,
        expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : null,
      })),
      subtotal,
      discount: discNum,
      tax: taxNum,
      total,
      paidAmount: Number(paidAmount) || 0,
      paymentMethod,
      paymentStatus: Number(paidAmount) >= total ? "PAID" : Number(paidAmount) > 0 ? "PARTIAL" : "UNPAID",
      notes: notes.trim() || null,
    };

    const ok = await createPurchase(payload);
    if (!ok) {
      setError("Failed to record purchase invoice");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-2xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">New Purchase Invoice</h3>
              <p className="text-[11px] text-[#71675E]">
                Record vendor bill, update stock batches, and post accounts payable
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Supplier, Branch & Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Receiving Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
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
              <label className="text-[11px] font-bold text-[#292320]">Vendor Bill / Inv #</label>
              <input
                type="text"
                placeholder="e.g. INV-8821"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#292320]">Purchased Products</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#6B2837] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center gap-2"
                >
                  <div className="flex-1 min-w-[160px]">
                    <select
                      value={l.productId}
                      onChange={(e) => handleUpdateLine(idx, "productId", e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) =>
                        handleUpdateLine(idx, "quantity", Number(e.target.value))
                      }
                      className="w-full h-8 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none text-right"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Cost Rate"
                      value={l.price}
                      onChange={(e) =>
                        handleUpdateLine(idx, "price", Number(e.target.value))
                      }
                      className="w-full h-8 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none text-right"
                    />
                  </div>

                  <div className="w-28 text-right font-mono font-bold text-[#6B2837] tabular-nums text-xs">
                    Rs. {(l.quantity * l.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>

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
              ))}
            </div>
          </div>

          {/* Pricing Totals & Payment */}
          <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#71675E]">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-[#292320]">
                  Rs. {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[#71675E]">Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 h-7 px-2 text-right rounded border border-[#D8CEC1] bg-[#FFFCF7] font-mono text-xs text-[#292320]"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[#71675E]">VAT / Tax (13%):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className="w-24 h-7 px-2 text-right rounded border border-[#D8CEC1] bg-[#FFFCF7] font-mono text-xs text-[#292320]"
                />
              </div>

              <div className="flex justify-between border-t border-[#D8CEC1] pt-2 font-black text-sm text-[#6B2837]">
                <span>Net Total:</span>
                <span className="font-mono">
                  Rs. {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#292320]">Immediate Paid Amount (NPR)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono font-bold tabular-nums text-[#16A34A] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#292320]">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Bank Transfer / Card</option>
                  <option value="FONE_PAY">FonePay QR</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Notes / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Payment due in 15 days"
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
              <span>{isSaving ? "Recording..." : "Save Purchase Invoice"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

