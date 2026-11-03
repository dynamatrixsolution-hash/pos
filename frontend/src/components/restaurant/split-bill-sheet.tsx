"use client";

import React, { useState, useMemo } from "react";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import { X, Plus, Minus } from "lucide-react";

export interface BillOrderLine {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
}

interface SplitBillSheetProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  tableNumber: string;
  totalAmount: string | number;
  orderLines: BillOrderLine[];
  onConfirmPayment: (splits: { guestName: string; amount: string; method: string }[]) => void;
}

export function SplitBillSheet({
  isOpen,
  onClose,
  orderNumber,
  tableNumber,
  totalAmount,
  orderLines,
  onConfirmPayment,
}: SplitBillSheetProps) {
  const [splitMode, setSplitMode] = useState<"EQUAL" | "ITEMIZED">("EQUAL");
  const [guestCount, setGuestCount] = useState(2);
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({});

  const totalCents = toCents(totalAmount);

  const equalSplits = useMemo(() => {
    const n = Math.max(1, guestCount);
    const baseShareCents = Math.floor(totalCents / n);
    const remainderCents = totalCents % n;

    return Array.from({ length: n }, (_, i) => {
      const cents = baseShareCents + (i < remainderCents ? 1 : 0);
      return {
        guestIndex: i,
        guestName: `Guest ${i + 1}`,
        amountCents: cents,
        amountStr: fromCents(cents),
      };
    });
  }, [totalCents, guestCount]);

  const itemizedSplits = useMemo(() => {
    const n = Math.max(1, guestCount);
    const splits = Array.from({ length: n }, (_, i) => ({
      guestIndex: i,
      guestName: `Guest ${i + 1}`,
      amountCents: 0,
      lines: [] as BillOrderLine[],
    }));

    for (const line of orderLines) {
      const assignedGuest = itemAssignments[line.id] ?? 0;
      if (assignedGuest < n) {
        splits[assignedGuest].amountCents += toCents(line.total);
        splits[assignedGuest].lines.push(line);
      }
    }

    return splits.map((s) => ({
      ...s,
      amountStr: fromCents(s.amountCents),
    }));
  }, [orderLines, guestCount, itemAssignments]);

  if (!isOpen) return null;

  const handlePay = () => {
    const splits = (splitMode === "EQUAL" ? equalSplits : itemizedSplits).map((s) => ({
      guestName: s.guestName,
      amount: s.amountStr,
      method: "CASH",
    }));
    onConfirmPayment(splits);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-3">
      <div className="w-full max-w-md rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col max-h-[85vh] shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] px-3.5 py-2 bg-[#EEE7DD]/30 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-[#292320]">
              Split Bill — Table {tableNumber || "-"}
            </h3>
            <p className="text-[10px] text-[#71675E] font-mono tabular-nums leading-none mt-0.5">
              Order #{orderNumber} • Total: {formatNPR(totalAmount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector & Guest Stepper */}
        <div className="p-2.5 border-b border-[#D8CEC1] flex items-center justify-between gap-2 shrink-0">
          <div className="inline-flex rounded-md border border-[#D8CEC1] p-0.5 bg-[#EEE7DD]">
            <button
              type="button"
              onClick={() => setSplitMode("EQUAL")}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                splitMode === "EQUAL"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Equal Split
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("ITEMIZED")}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                splitMode === "ITEMIZED"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Itemized Split
            </button>
          </div>

          {/* Guest Count Stepper */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">Covers:</span>
            <div className="flex items-center rounded-md border border-[#D8CEC1] bg-[#FFFCF7]">
              <button
                type="button"
                onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                className="p-1 text-[#292320] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-bold font-mono tabular-nums text-[#292320]">
                {guestCount}
              </span>
              <button
                type="button"
                onClick={() => setGuestCount((g) => Math.min(12, g + 1))}
                className="p-1 text-[#292320] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {splitMode === "EQUAL" ? (
            <div className="space-y-1.5">
              {equalSplits.map((share) => (
                <div
                  key={share.guestIndex}
                  className="flex items-center justify-between p-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC]/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded bg-[#6B2837]/10 text-[#6B2837] text-[10px] font-bold flex items-center justify-center font-mono">
                      {share.guestIndex + 1}
                    </span>
                    <span className="text-xs font-medium text-[#292320]">{share.guestName}</span>
                  </div>
                  <span className="text-xs font-bold font-mono tabular-nums text-[#292320]">
                    {formatNPR(share.amountStr)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-[#71675E]">
                Assign dishes to the responsible guest:
              </p>
              <div className="space-y-1">
                {orderLines.map((line) => {
                  const assigned = itemAssignments[line.id] ?? 0;
                  return (
                    <div
                      key={line.id}
                      className="p-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#292320] truncate">{line.itemName}</p>
                        <p className="text-[#71675E] text-[10px] font-mono tabular-nums">
                          {line.quantity}x @ {formatNPR(line.unitPrice)} = {formatNPR(line.total)}
                        </p>
                      </div>

                      <select
                        value={assigned}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setItemAssignments((prev) => ({ ...prev, [line.id]: val }));
                        }}
                        className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] px-2 py-1 text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                      >
                        {Array.from({ length: guestCount }, (_, i) => (
                          <option key={i} value={i}>
                            Guest {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Summary per guest */}
              <div className="pt-2 border-t border-[#D8CEC1] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E] block">
                  Shares Breakdown
                </span>
                {itemizedSplits.map((share) => (
                  <div
                    key={share.guestIndex}
                    className="flex justify-between text-xs py-1 px-2 rounded-md bg-[#EEE7DD]/50"
                  >
                    <span className="text-[#71675E]">
                      {share.guestName} ({share.lines.length} items):
                    </span>
                    <span className="font-bold font-mono tabular-nums text-[#292320]">
                      {formatNPR(share.amountStr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#D8CEC1] p-2.5 bg-[#EEE7DD]/40 flex items-center justify-between gap-2 shrink-0">
          <div className="text-xs">
            <span className="text-[10px] text-[#71675E] uppercase block leading-none">Total</span>
            <span className="font-bold text-[#292320] font-mono tabular-nums text-xs">
              {formatNPR(totalAmount)}
            </span>
          </div>
          <button
            type="button"
            onClick={handlePay}
            className="px-3.5 py-1.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Confirm Split Settlement
          </button>
        </div>
      </div>
    </div>
  );
}
