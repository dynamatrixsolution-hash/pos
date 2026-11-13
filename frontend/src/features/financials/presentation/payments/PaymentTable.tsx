"use client";

import React from "react";
import {
  CreditCard,
  Building2,
  Calendar,
  RotateCcw,
  Receipt,
  User,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { usePaymentsStore } from "../../state/payments.store";
import { PaymentRecord } from "../../models/financials.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PaymentTable: React.FC = () => {
  const payments = usePaymentsStore((s) => s.payments);
  const paymentType = usePaymentsStore((s) => s.paymentType);
  const isLoading = usePaymentsStore((s) => s.isLoading);
  const setReversingPayment = usePaymentsStore((s) => s.setReversingPayment);
  const setSelectedPaymentForReceipt = usePaymentsStore((s) => s.setSelectedPaymentForReceipt);

  const isReceived = paymentType === "RECEIVED";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <CreditCard className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">
            No {isReceived ? "Inward" : "Outward"} Payments Found
          </h3>
          <p className="text-xs text-[#71675E]">
            {isReceived
              ? "No customer settlements or receipts match your current filters."
              : "No vendor payments or supplier payouts match your current filters."}
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
              <th className="px-3.5 py-3">Receipt / ID</th>
              <th className="px-3.5 py-3">{isReceived ? "Customer" : "Supplier"}</th>
              <th className="px-3.5 py-3">Branch</th>
              <th className="px-3.5 py-3">Method</th>
              <th className="px-3.5 py-3 text-right">Amount</th>
              <th className="px-3.5 py-3">Reference / Remarks</th>
              <th className="px-3.5 py-3">Date</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {payments.map((p) => {
              const party = isReceived ? p.customer : p.supplier;
              const isReversed = p.status === "REVERSED";

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-[#F7F3EC]/50 transition-colors ${
                    isReversed ? "opacity-60 bg-red-50/20" : ""
                  }`}
                >
                  {/* Receipt # */}
                  <td className="px-3.5 py-3">
                    <span className="font-mono font-bold text-[#6B2837]">
                      {p.receiptNumber || p.paymentNumber || `#PAY-${p.id.slice(0, 8)}`}
                    </span>
                    {isReversed && (
                      <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                        Reversed
                      </span>
                    )}
                  </td>

                  {/* Customer / Supplier */}
                  <td className="px-3.5 py-3">
                    {party ? (
                      <div>
                        <div className="font-bold text-[#292320]">{party.name}</div>
                        {party.phone && (
                          <div className="text-[10px] text-[#71675E]">{party.phone}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#71675E] italic">Walk-in / Direct</span>
                    )}
                  </td>

                  {/* Branch */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                      <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
                      <span>{p.branch?.name || "Main Branch"}</span>
                    </div>
                  </td>

                  {/* Method */}
                  <td className="px-3.5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320]">
                      {p.method?.replace("_", " ") || "CASH"}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-3.5 py-3 text-right">
                    <span
                      className={`font-mono font-bold tabular-nums text-sm ${
                        isReceived ? "text-[#16A34A]" : "text-[#6B2837]"
                      }`}
                    >
                      {formatNPR(p.amount)}
                    </span>
                  </td>

                  {/* Reference & Remarks */}
                  <td className="px-3.5 py-3">
                    {p.reference && (
                      <div className="font-mono text-[10px] text-[#292320]">
                        Ref: {p.reference}
                      </div>
                    )}
                    {p.remarks && (
                      <div className="text-[10px] text-[#71675E] truncate max-w-[180px]">
                        {p.remarks}
                      </div>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{p.createdAt ? p.createdAt.split("T")[0] : "Recent"}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentForReceipt(p)}
                        className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                        title="Print / View Receipt"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </button>

                      {!isReversed && (
                        <button
                          type="button"
                          onClick={() => setReversingPayment(p)}
                          className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] transition-colors cursor-pointer"
                          title="Reverse Payment"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
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

