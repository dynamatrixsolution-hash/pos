// Updated ShiftSummaryPrint for minimalist UI adhering to anti-slop rules
"use client";

import React from "react";
import { formatNPR, formatShiftDateTime, formatShiftDuration } from "@/lib/denomination";
import { Printer, X, Eye } from "lucide-react";

interface ShiftSummaryPrintProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any;
  businessName?: string;
  branchName?: string;
}

export function ShiftSummaryPrint({
  isOpen,
  onClose,
  shift,
  businessName = "Prayassh POS & ERP",
  branchName = "Main Branch",
}: ShiftSummaryPrintProps) {
  if (!isOpen || !shift) return null;

  const handlePrint = () => {
    window.print();
  };

  const openingDenoms = Array.isArray(shift.openingDenominations)
    ? shift.openingDenominations.filter((d: any) => (d.count ?? d.quantity ?? 0) > 0)
    : [];
  const closingDenoms = Array.isArray(shift.closingDenominations)
    ? shift.closingDenominations.filter((d: any) => (d.count ?? d.quantity ?? 0) > 0)
    : [];

  const varianceNum = Number(shift.cashDifference || 0);
  const varianceColor = varianceNum > 0 ? "text-emerald-700" : varianceNum < 0 ? "text-red-600" : "text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] w-full max-w-md rounded-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#F7F3EC] border-b border-[#D8CEC1] text-xs font-medium">
          <span className="uppercase tracking-wider">Shift Reconciliation</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold"
            >
              <Printer className="h-3 w-3" />
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[#EEE7DD] text-[#71675E]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto text-[#292320] font-mono text-[11px] leading-relaxed">
          <div className="text-center space-y-1 pb-3 border-b border-[#D8CEC1]">
            <h1 className="text-sm font-bold uppercase tracking-tight">{businessName}</h1>
            <p className="text-[10px] text-[#71675E]">{shift.branch?.name || branchName}</p>
            <p className="text-xs font-bold uppercase pt-1">SHIFT RECONCILIATION REPORT</p>
          </div>

          {/* Core Details */}
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span>Shift No:</span>
              <span className="font-bold">{shift.shiftNumber}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span>Register:</span>
              <span className="font-bold">{shift.register?.name || "Main Counter"} ({shift.register?.code || "REG-01"})</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span>Cashier:</span>
              <span className="font-bold">{shift.cashier?.name}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span>Opened:</span>
              <span className="tabular-nums">{formatShiftDateTime(shift.startTime).full}</span>
            </div>
            {shift.endTime && (
              <div className="flex justify-between text-xs font-medium">
                <span>Closed:</span>
                <span className="tabular-nums">{formatShiftDateTime(shift.endTime).full}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-medium">
              <span>Duration:</span>
              <span className="font-bold tabular-nums">
                {formatShiftDuration(shift.startTime, shift.endTime)}
                {!shift.endTime ? " (Active)" : ""}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span>Status:</span>
              <span className="uppercase font-bold">{shift.status}</span>
            </div>
          </div>

          {/* Cash Flow */}
          <div className="mt-4 border-t border-[#D8CEC1] pt-2 space-y-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>Opening Balance:</span>
              <span>{formatNPR(shift.openingBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Cash Sales:</span>
              <span>{formatNPR(shift.cashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Cash Refunds:</span>
              <span>{formatNPR(shift.cashRefunds)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Cash In:</span>
              <span>{formatNPR(shift.cashIn)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Cash Out:</span>
              <span>{formatNPR(shift.cashOut)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2">
              <span>EXPECTED CASH:</span>
              <span>{formatNPR(shift.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>ACTUAL COUNTED:</span>
              <span>{formatNPR(shift.actualCash ?? shift.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm mt-2 border-t border-[#D8CEC1] pt-1">
              <span>VARIANCE:</span>
              <span className={varianceColor}>
                {varianceNum > 0 ? "+" : ""}{formatNPR(varianceNum)}
              </span>
            </div>
            <div className="text-center font-bold text-[10px] tracking-wider mt-1">
              RESULT: {Math.abs(varianceNum) < 0.01 ? "BALANCED" : varianceNum < 0 ? "CASH SHORTAGE" : "CASH EXCESS"}
            </div>
          </div>

          {/* Denominations (optional) */}
          {openingDenoms.length > 0 && (
            <div className="mt-3 border-t border-[#D8CEC1] pt-2 text-xs">
              <div className="font-bold uppercase mb-1">Opening Denoms</div>
              {openingDenoms.map((d: any, idx: number) => {
                const note = Number(d.note ?? d.denominationValue);
                const count = Number(d.count ?? d.quantity);
                const amount = Number(d.amount ?? d.subtotal ?? note * count);
                return (
                  <div key={idx} className="flex justify-between">
                    <span>NPR {note.toLocaleString()} × {count}</span>
                    <span>{formatNPR(amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {closingDenoms.length > 0 && (
            <div className="mt-3 border-t border-[#D8CEC1] pt-2 text-xs">
              <div className="font-bold uppercase mb-1">Closing Denoms</div>
              {closingDenoms.map((d: any, idx: number) => {
                const note = Number(d.note ?? d.denominationValue);
                const count = Number(d.count ?? d.quantity);
                const amount = Number(d.amount ?? d.subtotal ?? note * count);
                return (
                  <div key={idx} className="flex justify-between">
                    <span>NPR {note.toLocaleString()} × {count}</span>
                    <span>{formatNPR(amount)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {(shift.varianceReason || shift.closingNotes) && (
            <div className="mt-3 border-t border-[#D8CEC1] pt-2 text-xs space-y-1">
              {shift.varianceReason && (
                <div>
                  <span className="font-bold">Variance Reason: </span>{shift.varianceReason}
                </div>
              )}
              {shift.closingNotes && (
                <div>
                  <span className="font-bold">Closing Notes: </span>{shift.closingNotes}
                </div>
              )}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 text-center text-xs mt-6 pt-4 border-t border-[#D8CEC1]">
            <div className="border-t border-[#71675E] pt-1">Cashier Signature</div>
            <div className="border-t border-[#71675E] pt-1">Manager Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
