"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  QrCode,
  Printer,
  Copy,
  Check,
  Search,
  ExternalLink,
  Store,
} from "lucide-react";
import { DeterministicQrMatrixSvg } from "@/components/qr-matrix-svg";
import { useRestaurantTablesStore } from "../state/restaurant-tables.store";
import { SpaceTable } from "../models/pos.types";

export const RestaurantQrContainer: React.FC = () => {
  const tables = useRestaurantTablesStore((s) => s.tables);
  const floors = useRestaurantTablesStore((s) => s.floors);
  const loadTablesData = useRestaurantTablesStore((s) => s.loadTablesData);
  const isLoading = useRestaurantTablesStore((s) => s.isLoading);

  const [selectedFloorId, setSelectedFloorId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadTablesData();
  }, [loadTablesData]);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (selectedFloorId !== "ALL" && t.floorId !== selectedFloorId) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const num = (t.tableNumber || "").toLowerCase();
        const floor = (t.floor?.name || "").toLowerCase();
        if (!num.includes(q) && !floor.includes(q)) return false;
      }
      return true;
    });
  }, [tables, selectedFloorId, search]);

  const handleCopyLink = (tableId: string) => {
    const url = `${origin}/guest/menu?tableId=${tableId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(tableId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-4 text-[#292320]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">
            Dine-In Table QR Generator &amp; Plaques
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Generate and print contactless ordering QR plaques for tables, private cabins, and banquet suites
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrintAll}
          className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print All Badges</span>
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#71675E]">Floor:</span>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Floors ({tables.length})</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search table #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>
      </div>

      {/* QR Plaques Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-8">
        {filteredTables.map((t) => {
          const url = `${origin}/guest/menu?tableId=${t.id}`;
          const isCopied = copiedId === t.id;

          return (
            <div
              key={t.id}
              className="p-5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs flex flex-col items-center justify-between space-y-3.5 text-center transition-all group"
            >
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#6B2837]">
                  Scan to Order
                </span>
                <h3 className="text-base font-black text-[#292320]">
                  Table {t.tableNumber}
                </h3>
                <p className="text-[11px] text-[#71675E]">
                  {t.floor?.name || "Main Dining Area"} • {t.capacity} covers
                </p>
              </div>

              {/* QR Code */}
              <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
                <DeterministicQrMatrixSvg
                  value={url}
                  size={150}
                  foreground="#292320"
                />
              </div>

              {/* URL & Action buttons */}
              <div className="w-full space-y-2 pt-2 border-t border-[#D8CEC1]/60">
                <p className="text-[10px] text-[#71675E] font-mono truncate px-1">
                  {url}
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(t.id)}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3 w-3 text-[#16A34A]" />
                        <span className="text-[#16A34A]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-[#71675E]" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>

                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors shadow-2xs"
                    title="Open live guest view"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
