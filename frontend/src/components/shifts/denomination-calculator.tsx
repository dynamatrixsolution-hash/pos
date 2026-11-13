"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  NEPALI_DENOMINATIONS,
  NepaliDenomination,
  DenominationRow,
  formatNPR,
  calculateDenominationTotal,
} from "@/lib/denomination";
import { RotateCcw, Check } from "lucide-react";

interface DenominationCalculatorProps {
  initialCounts?: Record<number, number> | DenominationRow[];
  onApply?: (total: number, rows: DenominationRow[]) => void;
  onChange?: (total: number, rows: DenominationRow[]) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  embedded?: boolean;
}

export function DenominationCalculator({
  initialCounts,
  onApply,
  onChange,
  onCancel,
  title = "Cash Denomination Count",
  description = "Enter the physical note and coin quantities in the register drawer.",
  embedded = false,
}: DenominationCalculatorProps) {
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    for (const d of NEPALI_DENOMINATIONS) {
      map[d] = 0;
    }
    if (initialCounts) {
      if (Array.isArray(initialCounts)) {
        for (const item of initialCounts) {
          const noteKey = Number((item as any).note ?? (item as any).denominationValue);
          const qty = Number((item as any).count ?? (item as any).quantity ?? 0);
          if (!isNaN(noteKey)) map[noteKey] = qty;
        }
      } else {
        Object.assign(map, initialCounts);
      }
    }
    return map;
  });

  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<DenominationRow[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const isFirstMount = useRef(true);

  useEffect(() => {
    const res = calculateDenominationTotal(counts);
    setTotal(res.total);
    setRows(res.rows);
    const notesCount = Object.values(counts).reduce((acc, c) => acc + (Number(c) || 0), 0);
    setTotalNotes(notesCount);
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (onChange) {
      onChange(res.total, res.rows);
    }
  }, [counts]);

  const handleCountChange = (note: NepaliDenomination, valStr: string) => {
    const val = Math.max(0, parseInt(valStr || "0", 10));
    setCounts((prev) => ({
      ...prev,
      [note]: isNaN(val) ? 0 : val,
    }));
  };

  const handleIncrement = (note: NepaliDenomination, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [note]: Math.max(0, (prev[note] || 0) + delta),
    }));
  };

  const handleReset = () => {
    const empty: Record<number, number> = {};
    for (const d of NEPALI_DENOMINATIONS) {
      empty[d] = 0;
    }
    setCounts(empty);
  };

  return (
    <div className="bg-[#FFFCF7] text-[#292320] flex flex-col border border-[#D8CEC1] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#D8CEC1] flex items-center justify-between gap-3 bg-[#F7F3EC]">
        <div>
          <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider">{title}</h3>
          {description && <p className="text-[11px] text-[#71675E] mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-semibold text-[#71675E] hover:text-[#292320] flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-[#EEE7DD] border border-[#D8CEC1] transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* Denominations Table */}
      <div className="p-3 space-y-1.5 max-h-[320px] overflow-y-auto">
        <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider text-[#71675E] px-2 pb-1.5 border-b border-[#D8CEC1]">
          <div className="col-span-4">Denomination</div>
          <div className="col-span-5 text-center">Quantity</div>
          <div className="col-span-3 text-right">Subtotal</div>
        </div>

        {NEPALI_DENOMINATIONS.map((note) => {
          const count = counts[note] || 0;
          const subtotal = note * count;
          const isNote = note >= 5;

          return (
            <div
              key={note}
              className={`grid grid-cols-12 items-center px-2.5 py-1.5 rounded-md border transition-colors ${
                count > 0
                  ? "bg-[#F7F3EC] border-[#6B2837]/40"
                  : "bg-[#FFFCF7] border-[#D8CEC1]/70"
              }`}
            >
              {/* Note Label */}
              <div className="col-span-4 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold font-mono tabular-nums border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]">
                  NPR {note.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#71675E] uppercase hidden sm:inline">
                  {isNote ? "Note" : "Coin"}
                </span>
              </div>

              {/* Quantity Input + Steppers */}
              <div className="col-span-5 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleIncrement(note, -1)}
                  disabled={count === 0}
                  className="h-7 w-7 flex items-center justify-center rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] text-xs font-bold hover:bg-[#EEE7DD] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  -
                </button>

                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label={`Quantity for NPR ${note}`}
                  value={count === 0 ? "" : count}
                  onChange={(e) => handleCountChange(note, e.target.value)}
                  placeholder="0"
                  className="w-16 h-7 text-center bg-[#FFFCF7] border border-[#D8CEC1] rounded font-mono text-xs font-bold text-[#292320] focus:outline-none focus:border-[#6B2837] tabular-nums"
                />

                <button
                  type="button"
                  onClick={() => handleIncrement(note, 1)}
                  className="h-7 w-7 flex items-center justify-center rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] text-xs font-bold hover:bg-[#EEE7DD]"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleIncrement(note, 5)}
                  className="hidden sm:flex h-7 px-1.5 items-center justify-center rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] text-[10px] font-bold hover:bg-[#EEE7DD]"
                >
                  +5
                </button>
              </div>

              {/* Subtotal */}
              <div className="col-span-3 text-right">
                <span
                  className={`font-mono text-xs font-bold tabular-nums ${
                    subtotal > 0 ? "text-[#292320]" : "text-[#71675E]/60"
                  }`}
                >
                  {formatNPR(subtotal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Total */}
      <div className="px-4 py-3 border-t border-[#D8CEC1] bg-[#F7F3EC] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#71675E] tracking-wider">
              Notes / Coins
            </div>
            <div className="font-mono text-xs font-bold text-[#292320] tabular-nums">
              {totalNotes} pcs
            </div>
          </div>
          <div className="h-7 w-px bg-[#D8CEC1]" />
          <div>
            <div className="text-[10px] uppercase font-bold text-[#71675E] tracking-wider">
              Calculated Cash Total
            </div>
            <div className="font-mono text-lg font-bold text-[#6B2837] tracking-tight tabular-nums">
              {formatNPR(total)}
            </div>
          </div>
        </div>

        {!embedded && onApply && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => onApply(total, rows)}
              className="px-4 py-1.5 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 flex items-center justify-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Count ({formatNPR(total)})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
