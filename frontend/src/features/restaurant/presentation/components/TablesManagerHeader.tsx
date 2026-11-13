"use client";

import React from "react";
import {
  Store,
  Plus,
  Layers,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useRestaurantTablesStore } from "../../state/restaurant-tables.store";
import { SpaceCategory } from "../../models/pos.types";

export const TablesManagerHeader: React.FC = () => {
  const floors = useRestaurantTablesStore((s) => s.floors);
  const selectedFloorId = useRestaurantTablesStore((s) => s.selectedFloorId);
  const setSelectedFloorId = useRestaurantTablesStore((s) => s.setSelectedFloorId);
  const selectedCategory = useRestaurantTablesStore((s) => s.selectedCategory);
  const setSelectedCategory = useRestaurantTablesStore((s) => s.setSelectedCategory);
  const search = useRestaurantTablesStore((s) => s.search);
  const setSearch = useRestaurantTablesStore((s) => s.setSearch);
  const tables = useRestaurantTablesStore((s) => s.tables);

  const openCreateFloorModal = useRestaurantTablesStore((s) => s.openCreateFloorModal);
  const openCreateTableModal = useRestaurantTablesStore((s) => s.openCreateTableModal);

  const categories: Array<{ id: SpaceCategory; label: string }> = [
    { id: "ALL", label: "All Spaces" },
    { id: "TABLE", label: "Dining Tables" },
    { id: "CABIN", label: "Private Cabins" },
    { id: "VIP_ROOM", label: "VIP Rooms" },
    { id: "HALL", label: "Banquet Halls" },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">
            Tables, Cabins &amp; Floor Spaces
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Design restaurant floors, private cabins, VIP dining suites, and QR ordering plaques
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateFloorModal}
            className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Layers className="h-3.5 w-3.5 text-[#6B2837]" />
            <span>+ Add Floor / Area</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateTableModal()}
            className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Table / Cabin</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const count =
              cat.id === "ALL"
                ? tables.length
                : tables.filter((t) => (t.metadata?.category || "TABLE") === cat.id).length;
            const active = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  active
                    ? "bg-[#6B2837] text-white shadow-2xs"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Floor Dropdown & Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table # or area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

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
      </div>
    </div>
  );
};

