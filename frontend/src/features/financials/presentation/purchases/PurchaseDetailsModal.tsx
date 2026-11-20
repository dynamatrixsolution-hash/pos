"use client";

import React from "react";
import { X, ShoppingCart, Building2, Calendar, FileText } from "lucide-react";
import { usePurchasesStore } from "../../state/purchases.store";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PurchaseDetailsModal: React.FC = () => {
  const p = usePurchasesStore((s) => s.selectedPurchaseForView);
  const setSelectedPurchase = usePurchasesStore((s) => s.setSelectedPurchaseForView);

  if (!p) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Purchase Bill #{p.invoiceNumber || p.billNumber || p.id.slice(0, 8)}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Supplier: {p.supplier?.name} {p.supplier?.panVat ? `• PAN: ${p.supplier.panVat}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPurchase(null)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-center">
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Total Bill</span>
            <div className="font-mono font-bold text-[#292320] mt-0.5">{formatNPR(p.total)}</div>
          </div>
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Paid</span>
            <div className="font-mono font-bold text-[#16A34A] mt-0.5">{formatNPR(p.paidAmount)}</div>
          </div>
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Balance Due</span>
            <div className="font-mono font-bold text-[#DC2626] mt-0.5">
              {formatNPR(Math.max(0, p.total - p.paidAmount))}
            </div>
          </div>
        </div>

        {/* Line Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <span className="text-xs font-bold text-[#292320]">Purchased Products List</span>
          <div className="space-y-1.5 divide-y divide-[#D8CEC1]/60">
            {p.items?.map((item, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-[#292320]">
                    {item.product?.name || `Product #${item.productId.slice(0, 8)}`}
                  </div>
                  {item.batchNumber && (
                    <div className="text-[10px] text-[#71675E]">Batch: {item.batchNumber}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#292320] tabular-nums">
                    {item.quantity} x {formatNPR(item.price)}
                  </div>
                  <div className="font-mono font-bold text-[#6B2837] text-[11px] tabular-nums">
                    {formatNPR(item.quantity * item.price)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => setSelectedPurchase(null)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

