"use client";

import React from "react";
import {
  ShoppingCart,
  Building2,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { usePurchasesStore } from "../../state/purchases.store";
import { PurchaseBill } from "../../models/financials.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PurchaseTable: React.FC = () => {
  const purchases = usePurchasesStore((s) => s.purchases);
  const isLoading = usePurchasesStore((s) => s.isLoading);
  const setSelectedPurchaseForView = usePurchasesStore((s) => s.setSelectedPurchaseForView);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <ShoppingCart className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Purchases Found</h3>
          <p className="text-xs text-[#71675E]">
            Record a vendor invoice to populate purchase inventory and vendor payables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            <tr>
              <th className="px-3.5 py-3">Invoice #</th>
              <th className="px-3.5 py-3">Supplier</th>
              <th className="px-3.5 py-3">Branch</th>
              <th className="px-3.5 py-3 text-center">Items</th>
              <th className="px-3.5 py-3 text-right">Total (NPR)</th>
              <th className="px-3.5 py-3 text-right">Paid (NPR)</th>
              <th className="px-3.5 py-3">Payment Status</th>
              <th className="px-3.5 py-3">Date</th>
              <th className="px-3.5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {purchases.map((p) => {
              const isPaid = p.paymentStatus === "PAID";
              const isPartial = p.paymentStatus === "PARTIAL";

              return (
                <tr key={p.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  {/* Invoice # */}
                  <td className="px-3.5 py-3">
                    <span className="font-mono font-bold text-[#6B2837]">
                      {p.invoiceNumber || p.billNumber || `#PUR-${p.id.slice(0, 8)}`}
                    </span>
                  </td>

                  {/* Supplier */}
                  <td className="px-3.5 py-3">
                    <div className="font-bold text-[#292320]">{p.supplier?.name}</div>
                    {p.supplier?.panVat && (
                      <div className="text-[10px] text-[#71675E]">PAN/VAT: {p.supplier.panVat}</div>
                    )}
                  </td>

                  {/* Branch */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                      <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
                      <span>{p.branch?.name || "Main Branch"}</span>
                    </div>
                  </td>

                  {/* Items Count */}
                  <td className="px-3.5 py-3 text-center font-bold text-[#292320] tabular-nums">
                    {p.items?.length || 0}
                  </td>

                  {/* Total */}
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-[#292320] tabular-nums">
                    {formatNPR(p.total)}
                  </td>

                  {/* Paid */}
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-[#16A34A] tabular-nums">
                    {formatNPR(p.paidAmount)}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3.5 py-3">
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Paid</span>
                      </span>
                    ) : isPartial ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        <Clock className="h-3 w-3" />
                        <span>Partial</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                        <AlertCircle className="h-3 w-3" />
                        <span>Unpaid</span>
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{p.createdAt ? p.createdAt.split("T")[0] : "Recent"}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-3.5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPurchaseForView(p)}
                      className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                      title="View Bill Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
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

