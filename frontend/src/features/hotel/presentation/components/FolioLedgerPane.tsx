"use client";

import React from "react";
import {
  Receipt,
  Plus,
  CreditCard,
  Printer,
  RotateCcw,
  User,
  BedDouble,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useHotelFoliosStore } from "../../state/hotel-folios.store";
import { FolioEntry } from "../../models/hotel.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const FolioLedgerPane: React.FC = () => {
  const selectedFolio = useHotelFoliosStore((s) => s.selectedFolio);
  const isLoadingDetails = useHotelFoliosStore((s) => s.isLoadingDetails);
  const setIsPostChargeModalOpen = useHotelFoliosStore((s) => s.setIsPostChargeModalOpen);
  const setIsSettleModalOpen = useHotelFoliosStore((s) => s.setIsSettleModalOpen);
  const reverseEntry = useHotelFoliosStore((s) => s.reverseEntry);

  if (!selectedFolio) {
    return (
      <div className="flex-1 rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center p-12 text-center text-xs text-[#71675E] space-y-2">
        <div>
          <Receipt className="h-10 w-10 text-[#71675E]/40 mx-auto mb-2" />
          <p className="font-bold text-[#292320]">No folio selected</p>
          <p>Select a guest billing folio from the list on the left to inspect ledger transactions.</p>
        </div>
      </div>
    );
  }

  const entries = selectedFolio.entries || [];
  const isSettled = selectedFolio.status === "SETTLED" || selectedFolio.status === "CLOSED";

  const handlePrint = () => {
    window.print();
  };

  const handleReverse = async (entry: FolioEntry) => {
    const reason = window.prompt(`Enter reason for reversing "${entry.description}":`, "Billing correction");
    if (reason) {
      await reverseEntry(entry.id, reason);
    }
  };

  return (
    <div className="flex-1 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs flex flex-col h-[750px] overflow-hidden">
      {/* Top Banner: Guest & Folio Identifiers */}
      <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#6B2837] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            {selectedFolio.roomNumber || "FOL"}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#292320]">{selectedFolio.guestName}</h2>
              <span className="font-mono text-xs text-[#71675E]">
                #{selectedFolio.folioNumber}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isSettled
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}
              >
                {selectedFolio.status}
              </span>
            </div>

            <p className="text-[11px] text-[#71675E] mt-0.5">
              {selectedFolio.roomNumber ? `Room ${selectedFolio.roomNumber}` : "Non-Resident Walk-in"}
              {selectedFolio.guestPhone && ` • ${selectedFolio.guestPhone}`}
              {selectedFolio.stay?.stayNumber && ` • Stay #${selectedFolio.stay.stayNumber}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Print Folio Invoice"
          >
            <Printer className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="hidden sm:inline">Print Folio</span>
          </button>

          {!isSettled && (
            <button
              type="button"
              onClick={() => setIsPostChargeModalOpen(true)}
              className="h-8 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#6B2837] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 text-[#6B2837]" />
              <span>Post Charge</span>
            </button>
          )}

          {!isSettled && (
            <button
              type="button"
              onClick={() => setIsSettleModalOpen(true)}
              className="h-8 px-3.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Settle Folio</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary Ribbon */}
      <div className="px-5 py-3 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 grid grid-cols-3 gap-4 shrink-0">
        <div>
          <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
            Total Debits (Charges)
          </span>
          <span className="font-mono text-sm font-bold text-[#292320] tabular-nums">
            {formatNPR(selectedFolio.totalDebits)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
            Total Credits (Payments)
          </span>
          <span className="font-mono text-sm font-bold text-[#16A34A] tabular-nums">
            {formatNPR(selectedFolio.totalCredits)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
            Net Balance Due
          </span>
          <span
            className={`font-mono text-base font-black tabular-nums ${
              selectedFolio.balance > 0 ? "text-[#DC2626]" : "text-[#16A34A]"
            }`}
          >
            {formatNPR(selectedFolio.balance)}
          </span>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingDetails ? (
          <div className="p-12 text-center text-xs text-[#71675E] space-y-2">
            <div className="inline-block animate-spin h-5 w-5 border-2 border-[#6B2837] border-t-transparent rounded-full" />
            <p>Loading folio transactions...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#71675E] space-y-1">
            <AlertCircle className="h-6 w-6 text-[#71675E]/40 mx-auto mb-1" />
            <p className="font-bold text-[#292320]">No ledger transactions recorded</p>
            <p>Post room nights or incidental charges using the button above.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/70 text-[#71675E] font-bold text-[10px] uppercase tracking-wider sticky top-0">
                <th className="py-2.5 px-4">Date &amp; Time</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-2">Category</th>
                <th className="py-2.5 px-3 text-right">Debit (Charges)</th>
                <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CEC1]/50 bg-[#FFFCF7]">
              {entries.map((entry) => {
                const isCredit = entry.entryType === "CREDIT";
                const isReversed = Boolean(entry.isReversed);

                return (
                  <tr
                    key={entry.id}
                    className={`hover:bg-[#F7F3EC]/40 transition-colors ${
                      isReversed ? "opacity-40 line-through" : ""
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#71675E] whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-xs text-[#292320]">
                        {entry.description}
                      </div>
                      {entry.reverseReason && (
                        <div className="text-[10px] text-[#DC2626]">
                          Reversed: {entry.reverseReason}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]">
                        {entry.category}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#292320] font-semibold">
                      {!isCredit ? formatNPR(entry.amount) : "—"}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#16A34A] font-semibold">
                      {isCredit ? formatNPR(entry.amount) : "—"}
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      {!isReversed && !isSettled && (
                        <button
                          type="button"
                          onClick={() => handleReverse(entry)}
                          className="p-1 rounded text-[#71675E] hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                          title="Reverse / Void Charge"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

