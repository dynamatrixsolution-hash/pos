"use client";

import React from "react";
import {
  Search,
  BedDouble,
  UserCheck,
  LogOut,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { useHotelStaysStore } from "../../state/hotel-stays.store";
import { useHotelUiStore } from "../../state/hotel-ui.store";

export const StaysHeader: React.FC = () => {
  const statusFilter = useHotelStaysStore((s) => s.statusFilter);
  const setStatusFilter = useHotelStaysStore((s) => s.setStatusFilter);
  const search = useHotelStaysStore((s) => s.search);
  const setSearch = useHotelStaysStore((s) => s.setSearch);
  const stays = useHotelStaysStore((s) => s.stays);

  const setShowFastCheckInModal = useHotelUiStore((s) => s.setShowFastCheckInModal);

  const inHouseCount = stays.filter((s) => s.status === "ACTIVE" || s.status === "EXTENDED").length;
  const checkedOutCount = stays.filter((s) => s.status === "CHECKED_OUT").length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">
            Guest Stays &amp; In-House Front Desk
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Monitor active hotel guests, room assignments, stay extensions, and checkout settlement
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFastCheckInModal(true)}
          className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ Fast Check-In</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter("IN_HOUSE")}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === "IN_HOUSE"
                ? "bg-[#6B2837] text-white shadow-2xs"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>In-House Guests</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                statusFilter === "IN_HOUSE" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
              }`}
            >
              {inHouseCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-[#6B2837] text-white shadow-2xs"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>All Stays</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
              }`}
            >
              {stays.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("CHECKED_OUT")}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === "CHECKED_OUT"
                ? "bg-[#6B2837] text-white shadow-2xs"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Checked Out</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                statusFilter === "CHECKED_OUT" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
              }`}
            >
              {checkedOutCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search guest name, room #, stay ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>
      </div>
    </div>
  );
};
