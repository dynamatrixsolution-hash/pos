"use client";

import React, { useState, useMemo } from "react";
import { formatMoney, toCents, fromCents } from "@/lib/currency";

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
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({}); // lineId -> guestIndex (0-indexed)

  const totalCents = toCents(totalAmount);

  // Equal Split Calculations with remainder distribution
  const equalSplits = useMemo(() => {
    const n = Math.max(1, guestCount);
    const baseShareCents = Math.floor(totalCents / n);
    const remainderCents = totalCents % n;

    return Array.from({ length: n }, (_, i) => {
      // Add 1 cent to the first 'remainderCents' guests so the sum is exact
      const cents = baseShareCents + (i < remainderCents ? 1 : 0);
      return {
        guestIndex: i,
        guestName: `Guest ${i + 1}`,
        amountCents: cents,
        amountStr: fromCents(cents),
      };
    });
  }, [totalCents, guestCount]);

  // Itemized Split Calculations
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-sandstone bg-porcelain shadow-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sandstone px-4 py-3 bg-warmstone/20">
          <div>
            <h3 className="text-sm font-semibold text-espresso">
              Split Bill — Table {tableNumber}
            </h3>
            <p className="text-xs text-warmgray">Order #{orderNumber} • Total: {formatMoney(totalAmount)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-warmgray hover:bg-warmstone hover:text-espresso transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-4 border-b border-sandstone flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-sandstone p-0.5 bg-warmstone/40">
            <button
              type="button"
              onClick={() => setSplitMode("EQUAL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                splitMode === "EQUAL"
                  ? "bg-porcelain text-burgundy shadow-xs"
                  : "text-warmgray hover:text-espresso"
              }`}
            >
              Equal Split
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("ITEMIZED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                splitMode === "ITEMIZED"
                  ? "bg-porcelain text-burgundy shadow-xs"
                  : "text-warmgray hover:text-espresso"
              }`}
            >
              Itemized Split
            </button>
          </div>

          {/* Number of Guests Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-warmgray font-medium">Guests:</span>
            <div className="flex items-center rounded-lg border border-sandstone bg-porcelain">
              <button
                type="button"
                onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                className="px-2.5 py-1 text-xs font-semibold hover:bg-warmstone"
              >
                -
              </button>
              <span className="px-2.5 py-0.5 text-xs font-bold tabular-nums text-espresso">{guestCount}</span>
              <button
                type="button"
                onClick={() => setGuestCount((g) => Math.min(12, g + 1))}
                className="px-2.5 py-1 text-xs font-semibold hover:bg-warmstone"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {splitMode === "EQUAL" ? (
            <div className="space-y-2">
              {equalSplits.map((share) => (
                <div
                  key={share.guestIndex}
                  className="flex items-center justify-between p-3 rounded-lg border border-sandstone bg-warmivory/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-burgundy/10 text-burgundy text-xs font-bold flex items-center justify-center">
                      {share.guestIndex + 1}
                    </span>
                    <span className="text-xs font-medium text-espresso">{share.guestName}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-espresso">
                    {formatMoney(share.amountStr)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-warmgray">Assign each ordered dish to the guest who is paying for it:</p>
              <div className="space-y-2">
                {orderLines.map((line) => {
                  const assigned = itemAssignments[line.id] ?? 0;
                  return (
                    <div
                      key={line.id}
                      className="p-3 rounded-lg border border-sandstone bg-porcelain flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-espresso truncate">{line.itemName}</p>
                        <p className="text-warmgray text-[11px]">
                          {line.quantity}x @ {formatMoney(line.unitPrice)} = {formatMoney(line.total)}
                        </p>
                      </div>

                      <select
                        value={assigned}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setItemAssignments((prev) => ({ ...prev, [line.id]: val }));
                        }}
                        className="rounded-lg border border-sandstone bg-warmstone/20 px-2 py-1 text-xs font-medium text-espresso focus:outline-none focus:border-burgundy"
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
              <div className="pt-2 border-t border-sandstone space-y-1.5">
                <span className="text-xs font-semibold text-espresso">Shares Breakdown:</span>
                {itemizedSplits.map((share) => (
                  <div key={share.guestIndex} className="flex justify-between text-xs py-1 px-2 rounded bg-warmstone/20">
                    <span className="text-warmgray">{share.guestName} ({share.lines.length} items):</span>
                    <span className="font-bold tabular-nums text-espresso">{formatMoney(share.amountStr)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sandstone p-4 bg-warmstone/20 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-warmgray">Total: </span>
            <span className="font-bold text-espresso tabular-nums">{formatMoney(totalAmount)}</span>
          </div>
          <button
            type="button"
            onClick={handlePay}
            className="px-5 py-2 rounded-lg bg-burgundy hover:bg-burgundy-hover text-porcelain text-xs font-semibold transition-colors shadow-xs"
          >
            Process Split Settlement
          </button>
        </div>
      </div>
    </div>
  );
}

