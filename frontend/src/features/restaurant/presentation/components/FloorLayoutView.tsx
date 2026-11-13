"use client";

import React, { useMemo } from "react";
import {
  Store,
  Users,
  UtensilsCrossed,
  ArrowRightLeft,
  GitMerge,
  Crown,
  Building,
  DoorOpen,
  Search,
  CreditCard,
} from "lucide-react";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosUiStore } from "../../state/pos-ui.store";
import { SpaceTable, SpaceCategory } from "../../models/pos.types";

function getSpaceMeta(tableNumber: string, metaCat?: string) {
  if (metaCat && ["TABLE", "CABIN", "VIP_ROOM", "HALL"].includes(metaCat)) {
    switch (metaCat) {
      case "CABIN":
        return { label: "Cabin", icon: DoorOpen, badge: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]" };
      case "VIP_ROOM":
        return { label: "VIP Room", icon: Crown, badge: "bg-[#F8EEF0] text-[#7B2C3D] border-[#E9CDD3]" };
      case "HALL":
        return { label: "Banquet Hall", icon: Building, badge: "bg-[#EDF5ED] text-[#2D6A4F] border-[#C8DFCD]" };
      default:
        return { label: "Dining Table", icon: UtensilsCrossed, badge: "bg-[#F7F3EC] text-[#5A504A] border-[#DED7CE]" };
    }
  }

  const lower = (tableNumber || "").toLowerCase();
  if (lower.startsWith("c-") || lower.startsWith("cab") || lower.includes("cabin")) {
    return { label: "Cabin", icon: DoorOpen, badge: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]" };
  }
  if (lower.startsWith("vip") || lower.startsWith("v-") || lower.includes("suite") || lower.includes("royal")) {
    return { label: "VIP Room", icon: Crown, badge: "bg-[#F8EEF0] text-[#7B2C3D] border-[#E9CDD3]" };
  }
  if (lower.startsWith("h-") || lower.startsWith("hall") || lower.includes("banquet") || lower.includes("party")) {
    return { label: "Banquet Hall", icon: Building, badge: "bg-[#EDF5ED] text-[#2D6A4F] border-[#C8DFCD]" };
  }
  return { label: "Dining Table", icon: UtensilsCrossed, badge: "bg-[#F7F3EC] text-[#5A504A] border-[#DED7CE]" };
}

export const FloorLayoutView = React.memo(function FloorLayoutView() {
  const floors = usePosCatalogStore((s) => s.floors);
  const tables = usePosCatalogStore((s) => s.tables);
  const selectedFloorId = usePosCatalogStore((s) => s.selectedFloorId);
  const selectedSpaceType = usePosCatalogStore((s) => s.selectedSpaceType);
  const selectedStatusFilter = usePosCatalogStore((s) => s.selectedStatusFilter);
  const spaceSearchQuery = usePosCatalogStore((s) => s.spaceSearchQuery);

  const setSelectedFloorId = usePosCatalogStore((s) => s.setSelectedFloorId);
  const setSelectedSpaceType = usePosCatalogStore((s) => s.setSelectedSpaceType);
  const setSelectedStatusFilter = usePosCatalogStore((s) => s.setSelectedStatusFilter);
  const setSpaceSearchQuery = usePosCatalogStore((s) => s.setSpaceSearchQuery);

  const openTableInspection = usePosTicketsStore((s) => s.openTableInspection);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);

  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const setShowSeatingModal = usePosUiStore((s) => s.setShowSeatingModal);
  const setShowTransferModal = usePosUiStore((s) => s.setShowTransferModal);
  const setShowMergeModal = usePosUiStore((s) => s.setShowMergeModal);

  // Filter dining spaces
  const filteredSpaces = useMemo(() => {
    return tables.filter((t) => {
      if (selectedFloorId !== "ALL" && t.floorId !== selectedFloorId) return false;
      if (selectedSpaceType !== "ALL") {
        const meta = getSpaceMeta(t.tableNumber, t.metadata?.category);
        if (selectedSpaceType === "CABIN" && meta.label !== "Cabin") return false;
        if (selectedSpaceType === "VIP_ROOM" && meta.label !== "VIP Room") return false;
        if (selectedSpaceType === "HALL" && meta.label !== "Banquet Hall") return false;
        if (selectedSpaceType === "TABLE" && meta.label !== "Dining Table") return false;
      }
      if (selectedStatusFilter !== "ALL" && t.status !== selectedStatusFilter) return false;
      if (spaceSearchQuery.trim()) {
        const q = spaceSearchQuery.toLowerCase().trim();
        const num = (t.tableNumber || "").toLowerCase();
        const floor = (t.floor?.name || "").toLowerCase();
        if (!num.includes(q) && !floor.includes(q)) return false;
      }
      return true;
    });
  }, [tables, selectedFloorId, selectedSpaceType, selectedStatusFilter, spaceSearchQuery]);

  const handleOpenSeating = (t: SpaceTable) => {
    setSelectedTable(t.id);
    setShowSeatingModal(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F7F3EC]/50 overflow-hidden">
      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {filteredSpaces.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FFFCF7]">
            <Store className="h-10 w-10 text-[#71675E]/40 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#292320]">No dining spaces found</h4>
            <p className="text-xs text-[#71675E] mt-1">
              Try adjusting the floor, category, or status filter above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
            {filteredSpaces.map((t) => {
              const meta = getSpaceMeta(t.tableNumber, t.metadata?.category);
              const SpaceIcon = meta.icon;
              const isAvailable = t.status === "AVAILABLE";
              const isOccupied = t.status === "OCCUPIED";
              const isReserved = t.status === "RESERVED";
              const isBilled = t.status === "BILLED";

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (isOccupied || isBilled) openTableInspection(t);
                  }}
                  className={`rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition-all shadow-2xs ${
                    isAvailable
                      ? "border-2 border-[#16A34A] bg-[#FFFCF7] hover:bg-[#F0FDF4]/30"
                      : isOccupied
                      ? "border-2 border-[#DC2626] bg-[#FFFCF7] hover:bg-[#FEF2F2]/30 cursor-pointer"
                      : isReserved
                      ? "border-2 border-[#D97706] bg-[#FFFCF7]"
                      : "border-2 border-[#1E40AF] bg-[#FFFCF7] hover:bg-[#EFF6FF]/30 cursor-pointer"
                  }`}
                >
                  {/* Top Row: Space Number & Status Badge */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg border shrink-0 ${meta.badge}`}>
                        <SpaceIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-[#292320] tracking-tight whitespace-nowrap truncate">
                          {t.tableNumber}
                        </h4>
                        <p className="text-[11px] text-[#71675E] truncate">
                          {t.floor?.name || "Floor"} • {t.capacity} covers
                        </p>
                      </div>
                    </div>

                    {!isAvailable && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isOccupied
                            ? "bg-red-100 text-red-800"
                            : isReserved
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isOccupied
                              ? "bg-[#DC2626] animate-pulse"
                              : isReserved
                              ? "bg-[#D97706]"
                              : "bg-[#1E40AF]"
                          }`}
                        />
                        <span>{isOccupied ? "Occupied" : isReserved ? "Reserved" : "Billed"}</span>
                      </span>
                    )}
                  </div>

                  {/* Action Row */}
                  <div className="pt-1">
                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSeating(t);
                        }}
                        className="w-full py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Seat Guests</span>
                      </button>
                    ) : isOccupied ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTable(t.id);
                            setShowTransferModal(true);
                          }}
                          className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#B45309] flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title={`Transfer ${t.tableNumber} to another space`}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTable(t.id);
                            setShowMergeModal(true);
                          }}
                          className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#2D6A4F] flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title={`Merge other tables into ${t.tableNumber}`}
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectOccupiedSpace(t);
                          }}
                          className="flex-1 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <UtensilsCrossed className="h-3.5 w-3.5" />
                          <span>Take Order</span>
                        </button>
                      </div>
                    ) : isBilled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectOccupiedSpace(t);
                        }}
                        className="w-full py-2 text-xs font-bold rounded-md bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E40AF] border border-[#DBEAFE] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Settle Bill</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSeating(t);
                        }}
                        className="w-full py-2 text-xs font-bold rounded-md bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#FDE68A] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Seat Reserved</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

