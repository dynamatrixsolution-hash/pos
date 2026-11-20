"use client";

import React, { useRef } from "react";
import { X, QrCode, Printer, Download, Store } from "lucide-react";
import { DeterministicQrMatrixSvg } from "@/components/qr-matrix-svg";
import { useRestaurantTablesStore } from "../../state/restaurant-tables.store";

export const SpaceQrModal: React.FC = () => {
  const qrTable = useRestaurantTablesStore((s) => s.qrTable);
  const closeQrModal = useRestaurantTablesStore((s) => s.closeQrModal);

  const printRef = useRef<HTMLDivElement>(null);

  if (!qrTable) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const guestOrderUrl = `${origin}/guest/menu?tableId=${qrTable.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#6B2837] text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Table {qrTable.tableNumber} QR Plaque
              </h3>
              <p className="text-[10px] text-[#71675E]">
                Self-service digital ordering QR for guests
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeQrModal}
            className="h-7 w-7 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div ref={printRef} className="p-6 flex flex-col items-center justify-center space-y-4 bg-white text-center">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B2837]">
              Scan to View Menu &amp; Order
            </span>
            <h2 className="text-xl font-black text-[#292320]">
              Table {qrTable.tableNumber}
            </h2>
            <p className="text-xs text-[#71675E]">
              {qrTable.floor?.name || "Dining Area"} • {qrTable.capacity} covers
            </p>
          </div>

          <div className="p-4 rounded-xl border-2 border-[#D8CEC1] bg-[#FFFCF7] shadow-xs">
            <DeterministicQrMatrixSvg
              value={guestOrderUrl}
              size={180}
              foreground="#292320"
            />
          </div>

          <p className="text-[10px] text-[#71675E] font-mono break-all px-2">
            {guestOrderUrl}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={closeQrModal}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Plaque</span>
          </button>
        </div>
      </div>
    </div>
  );
};
