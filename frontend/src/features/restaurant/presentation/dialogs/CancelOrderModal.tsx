"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { usePosTicketsStore } from "../../state/pos-tickets.store";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const CancelOrderModal: React.FC = () => {
  const cancellingTable = usePosTicketsStore((s) => s.cancellingTable);
  const setCancellingTable = usePosTicketsStore((s) => s.setCancellingTable);
  const isCancellingTable = usePosTicketsStore((s) => s.isCancellingTable);
  const submitCancelTable = usePosTicketsStore((s) => s.submitCancelTable);

  const [cancelReason, setCancelReason] = useState("Customer requested cancellation");

  useEffect(() => {
    if (cancellingTable) {
      setCancelReason("Customer requested cancellation");
    }
  }, [cancellingTable]);

  if (!cancellingTable) return null;

  const isTable = Boolean(cancellingTable.tableId && cancellingTable.tableNumber);
  const heading = isTable
    ? `Cancel Table ${cancellingTable.tableNumber}?`
    : `Cancel ${cancellingTable.title || "Order"}?`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCancelTable(cancelReason);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#E9B6B7] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-[#292320]">{heading}</h4>
              <p className="text-xs text-[#B33432] font-semibold mt-0.5">
                All active items and kitchen tickets will be voided.
              </p>
              <p className="text-[11px] text-[#71675E] mt-1 leading-relaxed">
                {isTable
                  ? `Cancelling voids all kitchen tickets, closes the active session, and resets Table ${cancellingTable.tableNumber} to Available.`
                  : "Cancelling voids all kitchen tickets and removes this active order from the queue."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCancellingTable(null)}
            disabled={isCancellingTable}
            className="text-[#71675E] hover:text-[#292320] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-1 text-xs">
          <div className="flex justify-between text-[#71675E]">
            <span>Active Items:</span>
            <span className="font-bold text-[#292320] tabular-nums">{cancellingTable.itemCount}</span>
          </div>
          <div className="flex justify-between text-[#71675E]">
            <span>Outstanding Balance:</span>
            <span className="font-mono font-bold text-[#6B2837] tabular-nums">
              {formatNPR(cancellingTable.totalAmount)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Cancellation Reason</label>
            <input
              type="text"
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Guest left, entered by mistake..."
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancellingTable(null)}
              disabled={isCancellingTable}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer transition-colors"
            >
              Keep Order
            </button>

            <button
              type="submit"
              disabled={isCancellingTable}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#B33432] hover:bg-[#992826] disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {isCancellingTable
                  ? "Cancelling..."
                  : isTable
                  ? "Confirm Cancel Table"
                  : "Confirm Void Order"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
