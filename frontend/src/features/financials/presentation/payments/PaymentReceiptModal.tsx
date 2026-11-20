"use client";

import React, { useRef } from "react";
import { X, Printer, Receipt, CheckCircle2 } from "lucide-react";
import { usePaymentsStore } from "../../state/payments.store";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PaymentReceiptModal: React.FC = () => {
  const p = usePaymentsStore((s) => s.selectedPaymentForReceipt);
  const setSelectedPayment = usePaymentsStore((s) => s.setSelectedPaymentForReceipt);
  const paymentType = usePaymentsStore((s) => s.paymentType);
  const isReceived = paymentType === "RECEIVED";

  const printRef = useRef<HTMLDivElement>(null);

  if (!p) return null;

  const handlePrint = () => {
    window.print();
  };

  const party = isReceived ? p.customer : p.supplier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-xs font-bold text-[#292320]">Payment Voucher</h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPayment(null)}
            className="h-7 w-7 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Area */}
        <div ref={printRef} className="p-6 bg-white space-y-4 text-xs">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-[#D8CEC1]">
            <h2 className="text-base font-black text-[#292320]">RESTROINN HOSPITALITY</h2>
            <p className="text-[10px] text-[#71675E]">{p.branch?.name || "Main Flagship Branch"}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] text-[#6B2837] border border-[#D8CEC1]">
              {isReceived ? "MONEY RECEIPT VOUCHER" : "PAYMENT DISBURSEMENT VOUCHER"}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#71675E]">Receipt #:</span>
              <span className="font-mono font-bold text-[#292320]">
                {p.receiptNumber || p.paymentNumber || `#PAY-${p.id.slice(0, 8)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71675E]">Date:</span>
              <span className="text-[#292320]">{p.createdAt?.split("T")[0]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71675E]">{isReceived ? "Received From:" : "Paid To:"}</span>
              <span className="font-bold text-[#292320]">{party?.name || "Direct Party"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71675E]">Payment Method:</span>
              <span className="font-bold text-[#292320]">{p.method?.replace("_", " ")}</span>
            </div>
            {p.reference && (
              <div className="flex justify-between">
                <span className="text-[#71675E]">Ref / TXN ID:</span>
                <span className="font-mono text-[#292320]">{p.reference}</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between text-xs">
            <span className="font-bold text-[#292320]">Amount Settled:</span>
            <span className="text-base font-black font-mono text-[#6B2837] tabular-nums">
              {formatNPR(p.amount)}
            </span>
          </div>

          {p.remarks && (
            <div className="text-[10px] text-[#71675E] italic">
              Note: {p.remarks}
            </div>
          )}

          <div className="pt-4 border-t border-dashed border-[#D8CEC1] text-center text-[10px] text-[#71675E]">
            Verified Electronic Receipt Record
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setSelectedPayment(null)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};

