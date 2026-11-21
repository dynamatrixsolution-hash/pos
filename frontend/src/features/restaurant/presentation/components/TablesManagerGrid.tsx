"use client";

import React, { useMemo } from "react";
import {
  Store,
  Castle,
  Users,
  QrCode,
  Edit2,
  Trash2,
  Layers,
} from "lucide-react";
import { useRestaurantTablesStore } from "../../state/restaurant-tables.store";
import { SpaceTable, SpaceCategory } from "../../models/pos.types";

export const TablesManagerGrid: React.FC = () => {
  const tables = useRestaurantTablesStore((s) => s.tables);
  const floors = useRestaurantTablesStore((s) => s.floors);
  const selectedFloorId = useRestaurantTablesStore((s) => s.selectedFloorId);
  const selectedCategory = useRestaurantTablesStore((s) => s.selectedCategory);
  const search = useRestaurantTablesStore((s) => s.search);
  const isLoading = useRestaurantTablesStore((s) => s.isLoading);

  const openEditTableModal = useRestaurantTablesStore((s) => s.openEditTableModal);
  const deleteTable = useRestaurantTablesStore((s) => s.deleteTable);
  const openQrModal = useRestaurantTablesStore((s) => s.openQrModal);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (selectedFloorId !== "ALL" && t.floorId !== selectedFloorId) return false;
      const cat = t.metadata?.category || "TABLE";
      if (selectedCategory !== "ALL" && cat !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const num = (t.tableNumber || "").toLowerCase();
        const floor = (t.floor?.name || "").toLowerCase();
        if (!num.includes(q) && !floor.includes(q)) return false;
      }
      return true;
    });
  }, [tables, selectedFloorId, selectedCategory, search]);

  const handleDelete = async (table: SpaceTable) => {
    if (window.confirm(`Are you sure you want to delete Table ${table.tableNumber}?`)) {
      await deleteTable(table.id);
    }
  };

  if (isLoading && tables.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-[#EEE7DD]/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredTables.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
        <Store className="h-8 w-8 text-[#71675E]/40 mx-auto" />
        <p className="font-bold text-xs text-[#292320]">No dining spaces found</p>
        <p className="text-xs text-[#71675E]">
          Try switching your floor or area filter, or add a new table/cabin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
      {filteredTables.map((t) => {
        const cat = (t.metadata?.category || "TABLE") as SpaceCategory;
        const isCabin = cat === "CABIN";
        const isVip = cat === "VIP_ROOM";
        const isHall = cat === "HALL";

        return (
          <div
            key={t.id}
            className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-3 flex flex-col justify-between space-y-3 shadow-2xs hover:border-[#6B2837]/60 transition-all group"
          >
            {/* Top row: Table number & category badge */}
            <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]/50">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`p-1.5 rounded-lg border shrink-0 ${
                    isVip
                      ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                      : isCabin
                      ? "bg-[#EFF6FF] text-[#1E40AF] border-[#DBEAFE]"
                      : isHall
                      ? "bg-[#EDF5ED] text-[#2D6A4F] border-[#C8DFCD]"
                      : "bg-[#F8EEF0] text-[#6B2837] border-[#E9CDD3]"
                  }`}
                >
                  {isVip ? (
                    <Castle className="h-4 w-4" />
                  ) : isCabin ? (
                    <Store className="h-4 w-4" />
                  ) : isHall ? (
                    <Layers className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-black text-[#292320] truncate group-hover:text-[#6B2837] transition-colors">
                    {t.tableNumber}
                  </h4>
                  <p className="text-[10px] text-[#71675E] truncate">
                    {t.floor?.name || "Main Floor"}
                  </p>
                </div>
              </div>

              <span className="font-mono text-xs font-bold tabular-nums text-[#292320]">
                {t.capacity}p
              </span>
            </div>

            {/* Space Specs */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#71675E]">
                <span>Type:</span>
                <span className="font-semibold text-[#292320]">
                  {isVip
                    ? "VIP Suite"
                    : isCabin
                    ? "Private Cabin"
                    : isHall
                    ? "Banquet Hall" 
                    : "Dining Table"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-[#D8CEC1]/60 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => openQrModal(t)}
                className="flex-1 py-1 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#6B2837] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="View / Print Dine-In QR Plaque"
              >
                <QrCode className="h-3 w-3" />
                <span>QR</span>
              </button>

              <button
                type="button"
                onClick={() => openEditTableModal(t)}
                className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Edit space specs"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(t)}
                className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Delete space"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

