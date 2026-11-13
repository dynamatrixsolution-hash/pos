"use client";

import React, { useState, useEffect } from "react";
import { formatNPR } from "@/lib/denomination";
import { X, ArrowDownRight, ArrowUpRight, AlertCircle } from "lucide-react";
import { toast } from "@/components/toast";

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any;
  defaultType?: "CASH_IN" | "CASH_OUT";
  onMovementRecorded: (movement: any) => void;
}

const COMMON_REASONS = {
  CASH_IN: [
    "Additional float from manager",
    "Cash transferred from another register",
    "Owner cash deposit",
    "Change float replenishment",
  ],
  CASH_OUT: [
    "Safe drop / handover to manager",
    "Office / store petty expense",
    "Small kitchen / utility purchase",
    "Supplier cash advance",
  ],
};

export function CashMovementModal({
  isOpen,
  onClose,
  shift,
  defaultType = "CASH_IN",
  onMovementRecorded,
}: CashMovementModalProps) {
  const [type, setType] = useState<"CASH_IN" | "CASH_OUT">(defaultType);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [referenceId, setReferenceId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setAmount(0);
      setReason("");
      setDescription("");
      setReferenceId("");
    }
  }, [isOpen, defaultType]);

  if (!isOpen || !shift) return null;

  const availableExpectedCash = Number(
    shift.liveMetrics?.expectedCash ?? shift.expectedCash ?? shift.openingBalance ?? 0
  );
  const exceedsExpectedCash = type === "CASH_OUT" && amount > availableExpectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    if (exceedsExpectedCash) {
      toast.error(
        `Cash out amount (${formatNPR(amount)}) cannot exceed available expected cash (${formatNPR(
          availableExpectedCash
        )}).`
      );
      return;
    }

    if (!reason.trim()) {
      toast.error("Please select or enter a reason for this cash movement.");
      return;
    }

    setIsLoading(true);
    try {
      const endpoint =
        type === "CASH_IN"
          ? `/api/v1/shifts/${shift.id}/cash-in`
          : `/api/v1/shifts/${shift.id}/cash-out`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: Number(amount),
          reason: reason.trim(),
          description: description.trim() || undefined,
          referenceId: referenceId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record cash movement");
      }

      toast.success(data.message || "Cash movement recorded successfully.");
      onMovementRecorded(data.movement);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record cash movement.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] w-full max-w-lg rounded-lg overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#D8CEC1] flex items-center justify-between bg-[#F7F3EC]">
            <div>
              <h2 className="text-base font-bold text-[#292320]">
                Record Cash Movement ({shift.shiftNumber})
              </h2>
              <p className="text-xs text-[#71675E]">
                Register: <strong className="text-[#292320]">{shift.register?.name}</strong> • Available Expected Cash:{" "}
                <strong className="font-mono text-[#6B2837] tabular-nums">{formatNPR(availableExpectedCash)}</strong>
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

          <div className="p-6 space-y-4">
            {/* Type Switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md gap-1">
              <button
                type="button"
                onClick={() => setType("CASH_IN")}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "CASH_IN"
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                <ArrowDownRight className="h-4 w-4" />
                Cash In (+ Add to Drawer)
              </button>
              <button
                type="button"
                onClick={() => setType("CASH_OUT")}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "CASH_OUT"
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Cash Out (- Remove from Drawer)
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#292320]">
                Amount (NPR) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount === 0 ? "" : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-base font-mono font-bold text-[#292320] focus:outline-none focus:border-[#6B2837] tabular-nums"
                required
              />
              {exceedsExpectedCash && (
                <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-300 rounded-md p-2 flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-700" />
                  <span>
                    Cash Out cannot exceed available expected cash in drawer ({formatNPR(availableExpectedCash)}).
                  </span>
                </div>
              )}
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider block">
                Standard Reason Categories
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS[type].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded border transition-colors ${
                      reason === preset
                        ? "border-[#6B2837] bg-[#6B2837]/10 text-[#6B2837] font-bold"
                        : "border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320]"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#292320]">
                Reason / Category <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for cash movement..."
                className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                required
              />
            </div>

            {/* Reference & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#292320]">
                  Voucher / Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="e.g. VCH-104"
                  className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#292320]">
                  Additional Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
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
              disabled={isLoading || amount <= 0 || !reason.trim() || exceedsExpectedCash}
              className="px-5 py-2 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isLoading ? "Saving..." : `Record ${type === "CASH_IN" ? "Cash In" : "Cash Out"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
