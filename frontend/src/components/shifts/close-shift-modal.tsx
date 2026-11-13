"use client";

import React, { useState, useEffect } from "react";
import { DenominationCalculator } from "./denomination-calculator";
import {
  DenominationRow,
  formatNPR,
  calculateCashDifference,
  formatShiftDateTime,
  formatShiftDuration,
} from "@/lib/denomination";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/components/toast";

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any;
  onShiftClosed: (closedShift: any, reconciliation: any) => void;
}

export function CloseShiftModal({
  isOpen,
  onClose,
  shift,
  onShiftClosed,
}: CloseShiftModalProps) {
  const [actualCash, setActualCash] = useState<number>(0);
  const [closingDenominations, setClosingDenominations] = useState<DenominationRow[]>([]);
  const [varianceReason, setVarianceReason] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [declarationConfirmed, setDeclarationConfirmed] = useState<boolean>(false);
  const [hasCounted, setHasCounted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActualCash(0);
      setClosingDenominations([]);
      setVarianceReason("");
      setClosingNotes("");
      setDeclarationConfirmed(false);
      setHasCounted(false);
    }
  }, [isOpen, shift?.id]);

  if (!isOpen || !shift) return null;

  const metrics = shift.liveMetrics || {
    openingBalance: Number(shift.openingBalance || 0),
    cashSales: Number(shift.cashSales || 0),
    qrSales: Number(shift.qrSales || 0),
    cardSales: Number(shift.cardSales || 0),
    bankSales: Number(shift.bankSales || 0),
    creditSales: Number(shift.creditSales || 0),
    nonCashSales: Number(shift.nonCashSales || 0),
    totalSales: Number(shift.totalSales || 0),
    cashRefunds: Number(shift.cashRefunds || 0),
    cashIn: Number(shift.cashIn || 0),
    cashOut: Number(shift.cashOut || 0),
    expectedCash: Number(shift.expectedCash || shift.openingBalance || 0),
  };

  const expectedCash = Number(metrics.expectedCash || 0);
  const variance = calculateCashDifference(actualCash, expectedCash);

  const handleDenominationChange = (total: number, rows: DenominationRow[]) => {
    setActualCash(total);
    setClosingDenominations(rows);
    setHasCounted(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasCounted || !closingDenominations || closingDenominations.length === 0) {
      toast.error("Please update the closing denomination count before closing this shift.");
      return;
    }

    if (variance.status !== "BALANCED" && varianceReason.trim().length < 3) {
      toast.error(
        `Please enter a variance reason explaining the ${variance.status.toLowerCase()} of ${formatNPR(
          Math.abs(variance.difference)
        )}.`
      );
      return;
    }

    if (!declarationConfirmed) {
      toast.error("Please confirm the closing cash declaration before submitting.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/shifts/${shift.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingDenominations,
          varianceReason: varianceReason.trim() || undefined,
          closingNotes: closingNotes.trim() || undefined,
          declarationConfirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to close shift");
      }

      toast.success(data.message || "Shift closed and reconciled successfully.");
      onShiftClosed(data.shift, data.reconciliation);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to close shift.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] w-full max-w-3xl rounded-lg overflow-hidden flex flex-col max-h-[92vh]">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#D8CEC1] flex items-center justify-between bg-[#F7F3EC]">
            <div>
              <h2 className="text-base font-bold text-[#292320]">
                Close Shift & Mandatory Cash Reconciliation ({shift.shiftNumber})
              </h2>
              <p className="text-xs text-[#71675E]">
                Register: <strong className="text-[#292320]">{shift.register?.name}</strong> ({shift.register?.code || "REG"}) • Cashier:{" "}
                <strong className="text-[#292320]">{shift.cashier?.name}</strong> • Opened:{" "}
                <strong className="font-mono text-[#292320] tabular-nums">{formatShiftDateTime(shift.startTime).full}</strong>{" "}
                <span className="font-mono text-[#6B2837] font-semibold tabular-nums">
                  ({formatShiftDuration(shift.startTime)} open)
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-md hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Expected Cash Formula Breakdown */}
            <div className="p-4 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] space-y-3">
              <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                  Drawer Cash Calculation Summary
                </span>
                <span className="text-[11px] text-[#71675E] font-mono tabular-nums">
                  Non-Cash Sales (Excluded from Drawer): {formatNPR(metrics.nonCashSales)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#71675E] uppercase block">Opening</span>
                  <span className="font-mono font-bold text-[#292320] tabular-nums">
                    {formatNPR(metrics.openingBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#71675E] uppercase block">+ Cash Sales</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    +{formatNPR(metrics.cashSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#71675E] uppercase block">+ Cash In</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    +{formatNPR(metrics.cashIn)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#71675E] uppercase block">- Cash Refunds</span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    -{formatNPR(metrics.cashRefunds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#71675E] uppercase block">- Cash Out</span>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    -{formatNPR(metrics.cashOut)}
                  </span>
                </div>
                <div className="bg-[#FFFCF7] p-2 rounded border border-[#D8CEC1]">
                  <span className="text-[10px] font-bold text-[#6B2837] uppercase block">= Expected Cash</span>
                  <span className="font-mono font-bold text-sm text-[#6B2837] tabular-nums">
                    {formatNPR(expectedCash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Mandatory Closing Denomination Count */}
            <DenominationCalculator
              embedded
              onChange={handleDenominationChange}
              title="Closing Cash Denomination Count (Mandatory)"
              description="Count all physical notes and coins in the drawer. Actual cash is calculated automatically."
            />

            {!hasCounted && (
              <div className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs font-medium">
                Please update the closing denomination quantities above to record your counted drawer cash before closing.
              </div>
            )}

            {/* Live Reconciliation Comparison Card */}
            <div
              className={`p-4 rounded-md border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                variance.status === "BALANCED"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : variance.status === "SHORTAGE"
                    ? "bg-rose-50 border-rose-300 text-rose-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {variance.status === "BALANCED" ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-700" />
                ) : (
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    Reconciliation Status: {variance.status}
                  </div>
                  <div className="text-xs mt-0.5">
                    Expected: <strong className="font-mono tabular-nums">{formatNPR(expectedCash)}</strong> • Actual Counted: <strong className="font-mono tabular-nums">{formatNPR(actualCash)}</strong>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider">
                  Cash Variance (Actual - Expected)
                </div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {variance.difference > 0 ? "+" : ""}
                  {formatNPR(variance.difference)}
                </div>
              </div>
            </div>

            {/* Variance Reason (Mandatory if Variance != 0) */}
            {variance.status !== "BALANCED" && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#292320]">
                  Variance Reason (Mandatory for {variance.status}) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  placeholder="Explain the cause of this cash shortage or excess..."
                  className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  required
                />
              </div>
            )}

            {/* Optional Closing Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#292320]">
                Closing Handover Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Optional handover remarks for the next shift or manager..."
                className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837] resize-none"
              />
            </div>

            {/* Mandatory Cashier Declaration Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] cursor-pointer">
              <input
                type="checkbox"
                checked={declarationConfirmed}
                onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
              />
              <span className="text-xs text-[#292320] leading-relaxed">
                <strong>Cashier Closing Declaration:</strong> I confirm that I have physically counted all notes and coins in the register drawer, and the denomination breakdown submitted above is accurate. I understand that once closed, this shift is locked and cannot be reopened.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                !hasCounted ||
                !declarationConfirmed ||
                (variance.status !== "BALANCED" && varianceReason.trim().length < 3)
              }
              className="px-5 py-2 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {isLoading ? "Closing & Reconciling..." : "Confirm & Close Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
