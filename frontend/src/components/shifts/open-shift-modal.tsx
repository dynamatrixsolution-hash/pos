"use client";

import React, { useState, useEffect } from "react";
import { DenominationCalculator } from "./denomination-calculator";
import { DenominationRow, formatNPR } from "@/lib/denomination";
import { X, Play, AlertCircle } from "lucide-react";
import { toast } from "@/components/toast";

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftOpened: (shift: any) => void;
  cashierName?: string;
  initialRegisterId?: string;
}

export function OpenShiftModal({
  isOpen,
  onClose,
  onShiftOpened,
  cashierName,
  initialRegisterId,
}: OpenShiftModalProps) {
  const [registers, setRegisters] = useState<any[]>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>(initialRegisterId || "");
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingNotes, setOpeningNotes] = useState<string>("");
  const [openingDenominations, setOpeningDenominations] = useState<DenominationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRegisters, setIsFetchingRegisters] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    async function loadRegisters() {
      setIsFetchingRegisters(true);
      try {
        const res = await fetch("/api/v1/shifts/registers");
        const data = await res.json();
        if (res.ok && data.registers) {
          setRegisters(data.registers);
          if (initialRegisterId) {
            setSelectedRegisterId(initialRegisterId);
          } else {
            const available = data.registers.find(
              (r: any) => r.status === "CLOSED" && r.isActive !== false
            );
            if (available) {
              setSelectedRegisterId(available.id);
            } else if (data.registers[0]) {
              setSelectedRegisterId(data.registers[0].id);
            }
          }
        }
      } catch (_err) {
        toast.error("Failed to load cash registers");
      } finally {
        setIsFetchingRegisters(false);
      }
    }
    loadRegisters();
  }, [isOpen, initialRegisterId]);

  if (!isOpen) return null;

  const handleDenominationChange = (total: number, rows: DenominationRow[]) => {
    setOpeningBalance(total);
    setOpeningDenominations(rows);
  };

  const selectedRegister = registers.find((r) => r.id === selectedRegisterId);
  const isRegisterOpen = selectedRegister?.status === "OPEN";
  const isRegisterInactive = selectedRegister?.isActive === false;
  const hasPositiveCount = openingBalance > 0 && openingDenominations.some((r) => r.count > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegisterId) {
      toast.error("Please select a cash register.");
      return;
    }

    if (isRegisterInactive) {
      toast.error("Cannot open a shift on an inactive register.");
      return;
    }

    if (!hasPositiveCount) {
      toast.error("Opening denomination count is mandatory. Please enter at least one note or coin quantity.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: selectedRegisterId,
          openingBalance: Number(openingBalance),
          openingNotes: openingNotes.trim() || undefined,
          openingDenominations,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open shift");
      }

      toast.success(data.message || "Shift opened successfully.");
      onShiftOpened(data.shift);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to open shift.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] w-full max-w-2xl rounded-lg overflow-hidden flex flex-col max-h-[92vh]">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#D8CEC1] flex items-center justify-between bg-[#F7F3EC]">
            <div>
              <h2 className="text-base font-bold text-[#292320]">Open Register Shift</h2>
              <p className="text-xs text-[#71675E]">
                Select a register and count physical starting cash denominations to open the drawer.
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
            {/* Top Context Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs">
              <div>
                <span className="text-[#71675E] block text-[10px] uppercase font-bold tracking-wider">
                  Branch
                </span>
                <span className="font-semibold text-[#292320]">
                  {selectedRegister?.branch?.name || "Current Branch"}
                </span>
              </div>
              <div>
                <span className="text-[#71675E] block text-[10px] uppercase font-bold tracking-wider">
                  Cashier
                </span>
                <span className="font-semibold text-[#292320]">
                  {cashierName || "Logged-in User"}
                </span>
              </div>
              <div>
                <span className="text-[#71675E] block text-[10px] uppercase font-bold tracking-wider">
                  Opening Date & Time
                </span>
                <span className="font-mono font-medium text-[#292320] tabular-nums">
                  {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Register Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#292320] flex items-center justify-between">
                <span>Cash Register / Counter</span>
                {selectedRegister && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      selectedRegister.isActive === false
                        ? "bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]"
                        : selectedRegister.status === "OPEN"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-emerald-50 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    {selectedRegister.isActive === false
                      ? "INACTIVE"
                      : selectedRegister.status === "OPEN"
                        ? "SHIFT ACTIVE"
                        : "AVAILABLE"}
                  </span>
                )}
              </label>

              {isFetchingRegisters ? (
                <div className="h-10 w-full rounded-md animate-pulse bg-[#EEE7DD]" />
              ) : (
                <select
                  value={selectedRegisterId}
                  onChange={(e) => setSelectedRegisterId(e.target.value)}
                  disabled={registers.length === 0}
                  className="w-full px-3.5 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  required
                >
                  {registers.map((r) => {
                    const activeShift = r.shifts?.[0];
                    const activeCashier = activeShift?.cashier?.name;
                    const statusLabel =
                      r.isActive === false
                        ? "Inactive"
                        : r.status === "OPEN"
                          ? `Occupied (Cashier: ${activeCashier || "Active"})`
                          : "Available";
                    return (
                      <option key={r.id} value={r.id} disabled={r.isActive === false}>
                        {r.name} ({r.code}) - {statusLabel}
                      </option>
                    );
                  })}
                </select>
              )}

              {isRegisterOpen && (
                <div className="text-[11px] text-amber-900 flex items-center gap-2 mt-1 bg-amber-50 p-2.5 rounded-md border border-amber-300">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-700" />
                  <span>
                    Register <strong>{selectedRegister?.name}</strong> already has an active shift operated by{" "}
                    <strong>{selectedRegister?.shifts?.[0]?.cashier?.name || "another cashier"}</strong>. Only one active shift is permitted per register.
                  </span>
                </div>
              )}
            </div>

            {/* Mandatory Embedded Denomination Table */}
            <DenominationCalculator
              embedded
              onChange={handleDenominationChange}
              title="Opening Cash Denomination (Mandatory)"
              description="Enter the physical note and coin quantities in the drawer. Opening balance is calculated automatically."
            />

            {/* Read-Only Calculated Opening Balance Banner */}
            <div className="p-3 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                  Opening Balance (System Calculated)
                </div>
                <div className="text-[11px] text-[#71675E]">
                  Derived strictly from denomination quantities above (cannot be manually overridden)
                </div>
              </div>
              <div className="font-mono text-lg font-bold text-[#6B2837] tabular-nums">
                {formatNPR(openingBalance)}
              </div>
            </div>

            {/* Opening Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#292320]">
                Opening Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="Optional remarks regarding starting float..."
                className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837] resize-none"
              />
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
              disabled={
                isLoading ||
                isRegisterOpen ||
                isRegisterInactive ||
                !selectedRegisterId ||
                !hasPositiveCount
              }
              className="px-5 py-2 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              {isLoading ? "Opening Shift..." : `Open Shift (${formatNPR(openingBalance)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
