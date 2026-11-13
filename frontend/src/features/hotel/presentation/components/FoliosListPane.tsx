"use client";

import React from "react";
import { Search, Receipt, User, CheckCircle2, Clock } from "lucide-react";
import { useHotelFoliosStore } from "../../state/hotel-folios.store";
import { HotelFolio } from "../../models/hotel.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const FoliosListPane: React.FC = () => {
  const folios = useHotelFoliosStore((s) => s.folios);
  const selectedFolio = useHotelFoliosStore((s) => s.selectedFolio);
  const selectFolio = useHotelFoliosStore((s) => s.selectFolio);
  const statusFilter = useHotelFoliosStore((s) => s.statusFilter);
  const setStatusFilter = useHotelFoliosStore((s) => s.setStatusFilter);
  const search = useHotelFoliosStore((s) => s.search);
  const setSearch = useHotelFoliosStore((s) => s.setSearch);
  const isLoading = useHotelFoliosStore((s) => s.isLoading);

  const filteredFolios = React.useMemo(() => {
    return folios.filter((f) => {
      if (statusFilter === "OPEN" && f.status !== "OPEN") return false;
      if (statusFilter === "SETTLED" && f.status !== "SETTLED" && f.status !== "CLOSED") return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const guest = (f.guestName || "").toLowerCase();
        const num = (f.folioNumber || "").toLowerCase();
        const room = (f.roomNumber || "").toLowerCase();
        if (!guest.includes(q) && !num.includes(q) && !room.includes(q)) return false;
      }
      return true;
    });
  }, [folios, statusFilter, search]);

  return (
    <div className="w-full lg:w-80 xl:w-96 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs flex flex-col h-[750px] shrink-0 overflow-hidden">
      {/* Top Filter Header */}
      <div className="p-3 border-b border-[#D8CEC1] space-y-2.5 bg-[#FFFCF7]">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs text-[#292320] flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-[#6B2837]" />
            <span>Guest Billing Folios</span>
          </h3>
          <span className="text-[10px] font-bold text-[#71675E] bg-[#F7F3EC] px-2 py-0.5 rounded-full tabular-nums border border-[#D8CEC1]">
            {filteredFolios.length} folios
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search folio, room, guest..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="h-7 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-xs">
          {(["ALL", "OPEN", "SETTLED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`flex-1 h-full rounded-md font-bold text-[11px] transition-all capitalize cursor-pointer ${
                statusFilter === st
                  ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              {st === "ALL" ? "All" : st.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Folio Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-transparent">
        {isLoading && folios.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#71675E] space-y-2">
            <div className="inline-block animate-spin h-5 w-5 border-2 border-[#6B2837] border-t-transparent rounded-full" />
            <p>Loading folios...</p>
          </div>
        ) : filteredFolios.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#71675E]">
            No folios match your search.
          </div>
        ) : (
          filteredFolios.map((f) => {
            const isSelected = selectedFolio?.id === f.id;
            const isSettled = f.status === "SETTLED" || f.status === "CLOSED";
            return (
              <div
                key={f.id}
                onClick={() => selectFolio(f.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#6B2837] bg-[#F8EEF0]/60 shadow-2xs"
                    : "border-[#D8CEC1] bg-[#FFFCF7] hover:border-[#6B2837]/60 hover:bg-[#F7F3EC]/50"
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#292320]">
                      {f.roomNumber ? `Room ${f.roomNumber}` : "Non-Resident"}
                    </span>
                    <span className="text-[10px] font-mono text-[#71675E]">
                      #{f.folioNumber}
                    </span>
                  </div>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      isSettled
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {f.status}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#71675E] flex items-center gap-1">
                  <User className="h-3 w-3 text-[#71675E]" />
                  <span className="truncate">{f.guestName}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-[#D8CEC1]/50 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#71675E] text-[10px] font-sans">Balance Due:</span>
                  <span
                    className={`font-bold tabular-nums ${
                      f.balance > 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                    }`}
                  >
                    {formatNPR(f.balance)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

