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
  Clock,
  RotateCcw,
  X,
  AlertCircle,
} from "lucide-react";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosUiStore } from "../../state/pos-ui.store";
import { SpaceTable, SpaceCategory } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatElapsed(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (Number.isNaN(mins)) return null;
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getSpaceCategory(tableNumber: string, metaCat?: string): "TABLE" | "CABIN" | "VIP_ROOM" | "HALL" {
  if (metaCat === "CABIN" || metaCat === "VIP_ROOM" || metaCat === "HALL" || metaCat === "TABLE") {
    return metaCat;
  }
  const lower = (tableNumber || "").toLowerCase();
  if (lower.startsWith("c-") || lower.startsWith("cab") || lower.includes("cabin")) return "CABIN";
  if (lower.startsWith("vip") || lower.startsWith("v-") || lower.includes("suite") || lower.includes("royal")) {
    return "VIP_ROOM";
  }
  if (lower.startsWith("h-") || lower.startsWith("hall") || lower.includes("banquet") || lower.includes("party")) {
    return "HALL";
  }
  return "TABLE";
}

const SPACE_META = {
  TABLE: { label: "Dining Table", icon: UtensilsCrossed },
  CABIN: { label: "Cabin", icon: DoorOpen },
  VIP_ROOM: { label: "VIP Room", icon: Crown },
  HALL: { label: "Banquet Hall", icon: Building },
} as const;

export const FloorLayoutView = React.memo(function FloorLayoutView() {
  const floors = usePosCatalogStore((s) => s.floors);
  const tables = usePosCatalogStore((s) => s.tables);
  const isLoading = usePosCatalogStore((s) => s.isLoading);
  const error = usePosCatalogStore((s) => s.error);
  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);

  const selectedFloorId = usePosCatalogStore((s) => s.selectedFloorId);
  const selectedSpaceType = usePosCatalogStore((s) => s.selectedSpaceType);
  const selectedStatusFilter = usePosCatalogStore((s) => s.selectedStatusFilter);
  const spaceSearchQuery = usePosCatalogStore((s) => s.spaceSearchQuery);

  const setSelectedFloorId = usePosCatalogStore((s) => s.setSelectedFloorId);
  const setSelectedSpaceType = usePosCatalogStore((s) => s.setSelectedSpaceType);
  const setSelectedStatusFilter = usePosCatalogStore((s) => s.setSelectedStatusFilter);
  const setSpaceSearchQuery = usePosCatalogStore((s) => s.setSpaceSearchQuery);
  const resetSpaceFilters = usePosCatalogStore((s) => s.resetSpaceFilters);

  const activeAllOrders = usePosTicketsStore((s) => s.activeAllOrders);
  const openTableInspection = usePosTicketsStore((s) => s.openTableInspection);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);

  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const setShowSeatingModal = usePosUiStore((s) => s.setShowSeatingModal);
  const setShowTransferModal = usePosUiStore((s) => s.setShowTransferModal);
  const setShowMergeModal = usePosUiStore((s) => s.setShowMergeModal);
  const setShowSettlementModal = usePosUiStore((s) => s.setShowSettlementModal);

  // Map active orders by tableId for O(1) lookup on each table card
  const activeOrderByTableId = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of activeAllOrders) {
      if (!o.tableId || o.settlementStatus === "PAID" || o.fulfillmentStatus === "CANCELLED") continue;
      if (o.tableSession && o.tableSession.status !== "ACTIVE" && o.tableSession.status !== "BILLED") continue;
      if (!map.has(o.tableId)) map.set(o.tableId, o);
    }
    return map;
  }, [activeAllOrders]);

  // Floor-filtered subset for accurate dropdown counts
  const floorTables = useMemo(
    () => (selectedFloorId === "ALL" ? tables : tables.filter((t) => t.floorId === selectedFloorId)),
    [tables, selectedFloorId]
  );

  const spaceTypeCounts = useMemo(() => {
    const counts = { ALL: floorTables.length, TABLE: 0, CABIN: 0, VIP_ROOM: 0, HALL: 0 };
    for (const t of floorTables) {
      counts[getSpaceCategory(t.tableNumber, t.metadata?.category)]++;
    }
    return counts;
  }, [floorTables]);

  const statusCounts = useMemo(() => {
    const counts = { ALL: floorTables.length, AVAILABLE: 0, OCCUPIED: 0, BILLED: 0, RESERVED: 0 };
    for (const t of floorTables) {
      if (t.status in counts) counts[t.status as keyof typeof counts]++;
    }
    return counts;
  }, [floorTables]);

  const filteredSpaces = useMemo(() => {
    const q = spaceSearchQuery.toLowerCase().trim();
    return floorTables.filter((t) => {
      if (selectedSpaceType !== "ALL") {
        if (getSpaceCategory(t.tableNumber, t.metadata?.category) !== selectedSpaceType) return false;
      }
      if (selectedStatusFilter !== "ALL" && t.status !== selectedStatusFilter) return false;
      if (q) {
        const num = (t.tableNumber || "").toLowerCase();
        const floor = (t.floor?.name || "").toLowerCase();
        if (!num.includes(q) && !floor.includes(q)) return false;
      }
      return true;
    });
  }, [floorTables, selectedSpaceType, selectedStatusFilter, spaceSearchQuery]);

  const hasActiveFilters =
    selectedFloorId !== "ALL" ||
    selectedSpaceType !== "ALL" ||
    selectedStatusFilter !== "ALL" ||
    spaceSearchQuery.trim().length > 0;

  const handleOpenSeating = (t: SpaceTable) => {
    setSelectedTable(t.id);
    setShowSeatingModal(true);
  };

  const handleDirectPay = (t: SpaceTable, activeOrder?: any) => {
    selectOccupiedSpace(t, activeOrder ? { activeOrder } : undefined);
    setShowSettlementModal(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F7F3EC] overflow-hidden">
      {/* Operational Filter & Search Bar (wraps cleanly at all breakpoints) */}
      <div className="px-3 sm:px-5 py-2.5 border-b border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* 1-Tap Floor Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedFloorId("ALL")}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
              selectedFloorId === "ALL"
                ? "bg-[#6B2837] text-[#FFFCF7]"
                : "border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] hover:bg-[#EEE7DD]"
            }`}
          >
            All Floors ({tables.length})
          </button>
          {floors.map((f) => {
            const count = tables.filter((t) => t.floorId === f.id).length;
            const active = selectedFloorId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFloorId(f.id)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                  active
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                {f.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + Space & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-40 sm:w-48">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="pos-table-search"
              type="text"
              placeholder="Search table..."
              value={spaceSearchQuery}
              onChange={(e) => setSpaceSearchQuery(e.target.value)}
              aria-label="Search table number or floor"
              className="h-8 w-full pl-8 pr-7 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none placeholder:text-[#71675E]"
            />
            {spaceSearchQuery && (
              <button
                type="button"
                onClick={() => setSpaceSearchQuery("")}
                aria-label="Clear table search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="pos-space-filter" className="sr-only">
              Space Type
            </label>
            <select
              id="pos-space-filter"
              value={selectedSpaceType}
              onChange={(e) => setSelectedSpaceType(e.target.value as SpaceCategory)}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Spaces ({spaceTypeCounts.ALL})</option>
              <option value="TABLE">Dining Tables ({spaceTypeCounts.TABLE})</option>
              <option value="CABIN">Cabins ({spaceTypeCounts.CABIN})</option>
              <option value="VIP_ROOM">VIP Rooms ({spaceTypeCounts.VIP_ROOM})</option>
              <option value="HALL">Banquet Halls ({spaceTypeCounts.HALL})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="pos-status-filter" className="sr-only">
              Table Status
            </label>
            <select
              id="pos-status-filter"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses ({statusCounts.ALL})</option>
              <option value="AVAILABLE">Available ({statusCounts.AVAILABLE})</option>
              <option value="OCCUPIED">Occupied ({statusCounts.OCCUPIED})</option>
              <option value="BILLED">Billed ({statusCounts.BILLED})</option>
              <option value="RESERVED">Reserved ({statusCounts.RESERVED})</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetSpaceFilters}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#71675E] hover:text-[#292320] inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {isLoading && tables.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-16 rounded bg-[#EEE7DD] animate-pulse" />
                  <div className="h-5 w-16 rounded bg-[#EEE7DD] animate-pulse" />
                </div>
                <div className="h-3 w-28 rounded bg-[#EEE7DD] animate-pulse" />
                <div className="h-8 w-full rounded bg-[#EEE7DD] animate-pulse" />
              </div>
            ))}
          </div>
        ) : error && tables.length === 0 ? (
          <div className="p-10 text-center rounded-lg border border-[#E9B6B7] bg-[#FFFCF7] max-w-md mx-auto space-y-3">
            <AlertCircle className="h-8 w-8 text-[#B33432] mx-auto" />
            <h4 className="text-sm font-bold text-[#292320]">Failed to load tables</h4>
            <p className="text-xs text-[#71675E]">{error}</p>
            <button
              type="button"
              onClick={() => loadInitialCatalog()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-2.5">
            <Store className="h-9 w-9 text-[#71675E]/40 mx-auto" />
            <h4 className="text-sm font-bold text-[#292320]">No dining spaces found</h4>
            <p className="text-xs text-[#71675E]">
              Try adjusting the floor, space, status, or search filter above.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetSpaceFilters}
                className="mt-1 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-8">
            {filteredSpaces.map((t) => {
              const cat = getSpaceCategory(t.tableNumber, t.metadata?.category);
              const SpaceIcon = SPACE_META[cat].icon;
              const isAvailable = t.status === "AVAILABLE";
              const isOccupied = t.status === "OCCUPIED";
              const isReserved = t.status === "RESERVED";
              const isBilled = t.status === "BILLED";

              const activeOrder =
                activeOrderByTableId.get(t.id) || t.tableSessions?.[0]?.restaurantOrders?.[0] || null;
              const activeSession = activeOrder?.tableSession || t.tableSessions?.[0] || null;
              const guestCount = Number(activeSession?.guestCount || 0);
              const elapsed = formatElapsed(activeSession?.openedAt || activeOrder?.createdAt);
              const runningTotal = Number(activeOrder?.totalAmount || 0);

              let activeItemCount = 0;
              let hasReadyItem = false;
              if (Array.isArray(activeOrder?.rounds)) {
                for (const r of activeOrder.rounds) {
                  for (const l of r.lines || []) {
                    if (l.acceptanceStatus === "REJECTED" || l.fulfillmentStatus === "CANCELLED") continue;
                    activeItemCount += Number(l.quantity) || 1;
                    if (l.fulfillmentStatus === "READY") hasReadyItem = true;
                  }
                }
              }

              const statusBadgeClass = isAvailable
                ? "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]"
                : isOccupied
                ? "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]"
                : isBilled
                ? "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]"
                : "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]";

              const statusDotClass = isAvailable
                ? "bg-[#28634B]"
                : isOccupied
                ? "bg-[#B33432]"
                : isBilled
                ? "bg-[#315F85]"
                : "bg-[#946000]";

              const statusLabel = isAvailable
                ? "Available"
                : isOccupied
                ? "Occupied"
                : isBilled
                ? "Billed"
                : "Reserved";

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (isAvailable || isReserved) {
                      handleOpenSeating(t);
                    } else {
                      openTableInspection(t);
                    }
                  }}
                  className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:border-[#6B2837]/60 p-3 flex flex-col justify-between gap-2.5 transition-colors cursor-pointer"
                >
                  {/* Top Row: Space Identity & Semantic Status Pill */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#D8CEC1]/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#6B2837] shrink-0">
                          <SpaceIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#292320] truncate tabular-nums">
                            {t.tableNumber}
                          </h4>
                          <p className="text-[11px] text-[#71675E] truncate tabular-nums">
                            {t.floor?.name || "Floor"} &bull;{" "}
                            {guestCount > 0 ? `${guestCount}/${t.capacity} guests` : `${t.capacity} covers`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${statusBadgeClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                        <span>{statusLabel}</span>
                      </span>
                    </div>

                    {/* Live Telemetry Row for Occupied / Billed Tables */}
                    {(isOccupied || isBilled) && (
                      <div className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md bg-[#F7F3EC] border border-[#D8CEC1]/60">
                        <div className="flex items-center gap-2 min-w-0 text-[11px] text-[#71675E] tabular-nums">
                          {elapsed && (
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" />
                              {elapsed}
                            </span>
                          )}
                          {activeItemCount > 0 ? (
                            <span className="truncate font-medium text-[#292320]">
                              {activeItemCount} {activeItemCount === 1 ? "item" : "items"}
                            </span>
                          ) : (
                            <span className="truncate">No order yet</span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-[#6B2837] tabular-nums shrink-0">
                          {formatNPR(runningTotal)}
                        </span>
                      </div>
                    )}

                    {hasReadyItem && (
                      <div className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0] text-center">
                        Dish Ready at Kitchen Pass
                      </div>
                    )}
                  </div>

                  {/* Action Row */}
                  <div>
                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSeating(t);
                        }}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Open / Seat</span>
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
                          aria-label={`Transfer ${t.tableNumber}`}
                          title={`Transfer ${t.tableNumber}`}
                          className="h-9 w-9 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#946000] flex items-center justify-center transition-colors cursor-pointer shrink-0"
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
                          aria-label={`Merge tables into ${t.tableNumber}`}
                          title={`Merge tables into ${t.tableNumber}`}
                          className="h-9 w-9 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#28634B] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectOccupiedSpace(t, activeOrder ? { activeOrder } : undefined);
                          }}
                          className="flex-1 h-9 px-2 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Order</span>
                        </button>
                        {runningTotal > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectPay(t, activeOrder);
                            }}
                            aria-label={`Pay bill for ${t.tableNumber}`}
                            title={`Pay bill for ${t.tableNumber}`}
                            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] text-[#FFFCF7] flex items-center justify-center gap-1 cursor-pointer transition-colors shrink-0"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay</span>
                          </button>
                        )}
                      </div>
                    ) : isBilled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectPay(t, activeOrder);
                        }}
                        className="w-full h-9 text-xs font-semibold rounded-lg bg-[#315F85] hover:bg-[#264B6A] text-[#FFFCF7] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
                        className="w-full h-9 text-xs font-semibold rounded-lg bg-[#FDF5E7] hover:bg-[#F7E9CE] text-[#946000] border border-[#EDD7AD] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
