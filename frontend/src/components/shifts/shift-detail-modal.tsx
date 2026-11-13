"use client";

import React, { useState, useEffect } from "react";
import { formatNPR, formatShiftDateTime, formatShiftDuration } from "@/lib/denomination";
import { X, Printer, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { toast } from "@/components/toast";

interface ShiftDetailModalProps {
  isOpen: boolean;
  shiftId: string | null;
  onClose: () => void;
  onPrint?: (shift: any) => void;
  userRole?: string;
  onUpdated?: () => void;
}

export function ShiftDetailModal({
  isOpen,
  shiftId,
  onClose,
  onPrint,
  userRole = "CASHIER",
  onUpdated,
}: ShiftDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adjType, setAdjType] = useState<"CORRECTION" | "SHORTAGE" | "EXCESS">("CORRECTION");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjReason, setAdjReason] = useState<string>("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  const isManager = ["OWNER", "ADMIN", "SUPER_ADMIN", "MANAGER"].includes(
    String(userRole || "").toUpperCase()
  );

  const loadShiftDetails = async () => {
    if (!shiftId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/shifts/${shiftId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        toast.error(json.error || "Failed to load shift details");
      }
    } catch (_err) {
      toast.error("Failed to load shift details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shiftId) {
      loadShiftDetails();
    }
  }, [isOpen, shiftId]);

  if (!isOpen || !shiftId) return null;

  const shift = data?.shift;
  const metrics = data?.metrics;

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjAmount);
    if (isNaN(num) || num === 0) {
      toast.error("Enter a non-zero adjustment amount.");
      return;
    }
    if (adjReason.trim().length < 3) {
      toast.error("Enter a documented reason for this adjustment.");
      return;
    }

    setIsSubmittingAdj(true);
    try {
      const res = await fetch(`/api/v1/shifts/${shiftId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentType: adjType,
          amount: num,
          reason: adjReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record adjustment");
      toast.success("Post-close shift adjustment recorded.");
      setAdjAmount("");
      setAdjReason("");
      loadShiftDetails();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const openingDenoms =
    shift?.openingDenominationsList?.length > 0
      ? shift.openingDenominationsList
      : Array.isArray(shift?.openingDenominations)
        ? shift.openingDenominations
        : [];

  const closingDenoms =
    shift?.closingDenominationsList?.length > 0
      ? shift.closingDenominationsList
      : Array.isArray(shift?.closingDenominations)
        ? shift.closingDenominations
        : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] w-full max-w-4xl rounded-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D8CEC1] flex items-center justify-between bg-[#F7F3EC]">
          <div>
            <h2 className="text-base font-bold text-[#292320]">
              Shift Audit & Reconciliation Details {shift ? `(${shift.shiftNumber})` : ""}
            </h2>
            {shift && (
              <p className="text-xs text-[#71675E]">
                Register: <strong className="text-[#292320]">{shift.register?.name}</strong> ({shift.register?.code}) • Cashier:{" "}
                <strong className="text-[#292320]">{shift.cashier?.name}</strong> • Status:{" "}
                <strong className="uppercase text-[#6B2837]">{shift.status}</strong>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {shift && onPrint && (
              <button
                type="button"
                onClick={() => onPrint(shift)}
                className="px-3 py-1.5 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Report
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-md hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading || !shift ? (
            <div className="space-y-4">
              <div className="h-24 w-full rounded-md animate-pulse bg-[#EEE7DD]" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-48 rounded-md animate-pulse bg-[#EEE7DD]" />
                <div className="h-48 rounded-md animate-pulse bg-[#EEE7DD]" />
              </div>
            </div>
          ) : (
            <>
              {/* Shift Timing & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-md bg-[#FFFCF7] border border-[#D8CEC1] text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">
                    Opened Date & Time
                  </span>
                  <span className="font-mono font-bold text-[#292320] tabular-nums">
                    {formatShiftDateTime(shift.startTime).full}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">
                    Closed Date & Time
                  </span>
                  <span className="font-mono font-bold text-[#292320] tabular-nums">
                    {shift.endTime ? formatShiftDateTime(shift.endTime).full : "Still Open"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#6B2837] block">
                    {shift.endTime ? "Closed After (Duration)" : "Open Duration"}
                  </span>
                  <span className="font-mono font-bold text-[#6B2837] tabular-nums">
                    {formatShiftDuration(shift.startTime, shift.endTime)}
                  </span>
                </div>
              </div>

              {/* Financial Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Opening Balance</span>
                  <span className="font-mono text-sm font-bold text-[#292320] tabular-nums">
                    {formatNPR(metrics?.openingBalance ?? shift.openingBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Cash Sales</span>
                  <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                    +{formatNPR(metrics?.cashSales ?? shift.cashSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Non-Cash Sales (QR/Card/Credit)</span>
                  <span className="font-mono text-sm font-bold text-[#292320] tabular-nums">
                    {formatNPR(metrics?.nonCashSales ?? shift.nonCashSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Total Gross Sales</span>
                  <span className="font-mono text-sm font-bold text-[#292320] tabular-nums">
                    {formatNPR(metrics?.totalSales ?? shift.totalSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Cash In / Out</span>
                  <span className="font-mono text-xs font-bold text-[#292320] tabular-nums">
                    +{formatNPR(metrics?.cashIn ?? shift.cashIn)} / -{formatNPR(metrics?.cashOut ?? shift.cashOut)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#71675E] block">Cash Refunds</span>
                  <span className="font-mono text-sm font-bold text-rose-700 tabular-nums">
                    -{formatNPR(metrics?.cashRefunds ?? shift.cashRefunds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#6B2837] block">Expected Drawer Cash</span>
                  <span className="font-mono text-sm font-bold text-[#6B2837] tabular-nums">
                    {formatNPR(metrics?.expectedCash ?? shift.expectedCash)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#292320] block">Actual Counted / Variance</span>
                  <span className="font-mono text-xs font-bold text-[#292320] tabular-nums">
                    {shift.actualCash !== null && shift.actualCash !== undefined
                      ? `${formatNPR(shift.actualCash)} (${Number(shift.cashDifference || 0) >= 0 ? "+" : ""}${formatNPR(shift.cashDifference || 0)})`
                      : "Shift Open"}
                  </span>
                </div>
              </div>

              {/* Payment Method Breakdown */}
              <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                  Sales Breakdown by Payment Channel
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                    <span className="text-[10px] text-[#71675E] uppercase font-bold block">Cash</span>
                    <span className="font-mono font-bold tabular-nums">{formatNPR(metrics?.cashSales || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                    <span className="text-[10px] text-[#71675E] uppercase font-bold block">QR / Wallet</span>
                    <span className="font-mono font-bold tabular-nums">{formatNPR(metrics?.qrSales || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                    <span className="text-[10px] text-[#71675E] uppercase font-bold block">Card</span>
                    <span className="font-mono font-bold tabular-nums">{formatNPR(metrics?.cardSales || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                    <span className="text-[10px] text-[#71675E] uppercase font-bold block">Bank Transfer</span>
                    <span className="font-mono font-bold tabular-nums">{formatNPR(metrics?.bankSales || 0)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                    <span className="text-[10px] text-[#71675E] uppercase font-bold block">Credit / Room Charge</span>
                    <span className="font-mono font-bold tabular-nums">{formatNPR(metrics?.creditSales || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Variance Reason & Declaration */}
              {(shift.varianceReason || shift.closingNotes || shift.declarationConfirmed) && (
                <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] space-y-1.5 text-xs">
                  {shift.varianceReason && (
                    <div>
                      <span className="font-bold text-[#292320]">Variance Explanation: </span>
                      <span className="text-[#71675E]">{shift.varianceReason}</span>
                    </div>
                  )}
                  {shift.closingNotes && (
                    <div>
                      <span className="font-bold text-[#292320]">Closing Notes: </span>
                      <span className="text-[#71675E]">{shift.closingNotes}</span>
                    </div>
                  )}
                  {shift.declarationConfirmed && (
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Cashier closing declaration confirmed</span>
                    </div>
                  )}
                </div>
              )}

              {/* Opening vs Closing Denominations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                  <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Opening Denominations
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#6B2837] tabular-nums">
                      {formatNPR(shift.openingBalance)}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {openingDenoms.filter((d: any) => (d.quantity ?? d.count ?? 0) > 0).length === 0 ? (
                      <p className="text-[#71675E] py-2">No opening denomination rows recorded.</p>
                    ) : (
                      openingDenoms
                        .filter((d: any) => (d.quantity ?? d.count ?? 0) > 0)
                        .map((d: any, idx: number) => {
                          const val = Number(d.denominationValue ?? d.note);
                          const qty = Number(d.quantity ?? d.count);
                          const sub = Number(d.subtotal ?? d.amount ?? val * qty);
                          return (
                            <div key={idx} className="flex justify-between font-mono tabular-nums py-0.5">
                              <span>
                                NPR {val.toLocaleString()} × {qty}
                              </span>
                              <span className="font-bold">{formatNPR(sub)}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                  <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Closing Denominations
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#6B2837] tabular-nums">
                      {shift.actualCash !== null && shift.actualCash !== undefined
                        ? formatNPR(shift.actualCash)
                        : "Not Closed"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {closingDenoms.filter((d: any) => (d.quantity ?? d.count ?? 0) > 0).length === 0 ? (
                      <p className="text-[#71675E] py-2">No closing denomination rows recorded.</p>
                    ) : (
                      closingDenoms
                        .filter((d: any) => (d.quantity ?? d.count ?? 0) > 0)
                        .map((d: any, idx: number) => {
                          const val = Number(d.denominationValue ?? d.note);
                          const qty = Number(d.quantity ?? d.count);
                          const sub = Number(d.subtotal ?? d.amount ?? val * qty);
                          return (
                            <div key={idx} className="flex justify-between font-mono tabular-nums py-0.5">
                              <span>
                                NPR {val.toLocaleString()} × {qty}
                              </span>
                              <span className="font-bold">{formatNPR(sub)}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Shift Transactions & Status */}
              <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                    Shift Transactions & Status ({shift.sales?.length || 0})
                  </h3>
                  <span className="text-[11px] text-[#71675E]">Linked Invoices & Payment Status</span>
                </div>
                {!shift.sales || shift.sales.length === 0 ? (
                  <p className="text-xs text-[#71675E] py-3 text-center">
                    No transactions recorded during this shift.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F3EC] text-[10px] font-bold uppercase text-[#71675E] border-b border-[#D8CEC1]">
                        <tr>
                          <th className="py-2 px-2.5">Invoice</th>
                          <th className="py-2 px-2.5">Customer</th>
                          <th className="py-2 px-2.5">Date & Time</th>
                          <th className="py-2 px-2.5 text-center">Order Status</th>
                          <th className="py-2 px-2.5 text-center">Payment Status</th>
                          <th className="py-2 px-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CEC1]/50">
                        {shift.sales.map((sale: any) => {
                          const payStatus = String(sale.paymentStatus || "PAID").toUpperCase();
                          const orderStatus = String(sale.status || "COMPLETED").toUpperCase();
                          const payBadgeClass =
                            payStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : payStatus === "PARTIAL" || payStatus === "PENDING"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : "bg-rose-50 text-rose-800 border-rose-300";
                          const orderBadgeClass =
                            orderStatus === "COMPLETED"
                              ? "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1]"
                              : orderStatus === "PENDING"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : "bg-rose-50 text-rose-800 border-rose-300";
                          return (
                            <tr key={sale.id} className="hover:bg-[#F7F3EC]">
                              <td className="py-2 px-2.5 font-mono font-bold text-[#292320] tabular-nums">
                                {sale.invoiceNumber}
                              </td>
                              <td className="py-2 px-2.5 text-[#71675E]">
                                {sale.customer?.name || "Walk-in"}
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] text-[#71675E] tabular-nums">
                                {formatShiftDateTime(sale.createdAt).full}
                              </td>
                              <td className="py-2 px-2.5 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${orderBadgeClass}`}
                                >
                                  {orderStatus}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${payBadgeClass}`}
                                >
                                  {payStatus}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-[#292320] tabular-nums">
                                {formatNPR(sale.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Post-Close Manager Adjustments (Specification §3.5 & §6.2.8) */}
              {isManager && shift.status !== "OPEN" && (
                <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#6B2837]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Authorized Post-Close Reconciliation Adjustment
                    </h3>
                  </div>

                  {shift.shiftAdjustments && shift.shiftAdjustments.length > 0 && (
                    <div className="space-y-1.5">
                      {shift.shiftAdjustments.map((adj: any) => (
                        <div
                          key={adj.id}
                          className="p-2 rounded bg-[#FFFCF7] border border-[#D8CEC1] flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#292320]">{adj.adjustmentType}: </span>
                            <span className="text-[#71675E]">{adj.reason}</span>
                            <span className="text-[10px] text-[#71675E] block">
                              Approved by {adj.approvedBy?.name || adj.createdBy?.name} on{" "}
                              {new Date(adj.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <span className="font-mono font-bold tabular-nums text-[#6B2837]">
                            {Number(adj.amount) > 0 ? "+" : ""}
                            {formatNPR(adj.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleCreateAdjustment} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs font-medium"
                    >
                      <option value="CORRECTION">Count Correction</option>
                      <option value="SHORTAGE">Shortage Classification</option>
                      <option value="EXCESS">Excess Classification</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount (e.g. 500 or -500)"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      className="px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs font-mono tabular-nums"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Audit reason..."
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      className="px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingAdj}
                      className="px-3 py-1.5 rounded bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 disabled:opacity-40"
                    >
                      {isSubmittingAdj ? "Saving..." : "Record Adjustment"}
                    </button>
                  </form>
                </div>
              )}

              {/* Immutable Audit Trail */}
              {shift.shiftAuditLogs && shift.shiftAuditLogs.length > 0 && (
                <div className="p-4 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-[#D8CEC1] pb-2">
                    <Clock className="h-3.5 w-3.5 text-[#71675E]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Shift Audit Trail ({shift.shiftAuditLogs.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {shift.shiftAuditLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-[#D8CEC1]/40 last:border-0"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#6B2837]">{log.action}</span>
                          <span className="text-[#71675E] ml-2">by {log.user?.name || "System"}</span>
                        </div>
                        <span className="font-mono text-[#71675E] tabular-nums">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

