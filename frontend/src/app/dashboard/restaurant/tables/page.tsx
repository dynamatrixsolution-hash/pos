"use client";

import { Notify } from "@/lib/notify";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Check,
  GitMerge,
  Layers3,
  Search,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  X,
  RefreshCw,
} from "lucide-react";

interface Table {
  id: string;
  tableNumber: string;
  floorId: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
  currentSessionId?: string | null;
}

interface Floor {
  id: string;
  name: string;
  tables: Table[];
}

type StatusFilter = "ALL" | Table["status"];

type TableStatusMeta = {
  label: string;
  dot: string;
  text: string;
  surface: string;
  border: string;
  accent: string;
};

const STATUS_META: Record<Table["status"], TableStatusMeta> = {
  AVAILABLE: {
    label: "Available",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
    surface: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "border-l-emerald-600",
  },
  OCCUPIED: {
    label: "Occupied",
    dot: "bg-[#7B2C3D]",
    text: "text-[#7B2C3D]",
    surface: "bg-[#F8EEF0]",
    border: "border-[#E9CDD3]",
    accent: "border-l-[#7B2C3D]",
  },
  RESERVED: {
    label: "Reserved",
    dot: "bg-amber-600",
    text: "text-amber-800",
    surface: "bg-amber-50",
    border: "border-amber-200",
    accent: "border-l-amber-600",
  },
  BILLED: {
    label: "Billed",
    dot: "bg-blue-600",
    text: "text-blue-700",
    surface: "bg-blue-50",
    border: "border-blue-200",
    accent: "border-l-blue-600",
  },
};

const SURFACE = "border border-[#E4DED5] bg-[#FFFEFC]";
const SECONDARY_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#DED7CE] bg-[#FFFEFC] px-2.5 text-xs font-semibold text-[#39332E] transition-colors hover:border-[#BDB3A8] hover:bg-[#F7F4EF] disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#7B2C3D] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#642231] disabled:cursor-not-allowed disabled:opacity-50";

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function RestaurantTablesPage() {
  const router = useRouter();

  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [openSessionModal, setOpenSessionModal] = useState<{ table: Table } | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [moveModal, setMoveModal] = useState<{ sourceTable: Table } | null>(null);
  const [mergeModal, setMergeModal] = useState<{ sourceTable: Table } | null>(null);
  const [targetTableId, setTargetTableId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadFloors = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setLoading(true);

      const response = await fetch("/api/v1/restaurant/floors");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getErrorMessage(payload, "Failed to load floor tables"));
      }

      const payload = await response.json();
      setFloors(Array.isArray(payload.floors) ? payload.floors : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load floor tables";
      console.error("Failed to load restaurant floors:", error);
      Notify.failure(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFloors();
  }, [loadFloors]);

  const allTables = useMemo(() => floors.flatMap((floor) => floor.tables || []), [floors]);

  const stats = useMemo(() => {
    const total = allTables.length;
    const available = allTables.filter((table) => table.status === "AVAILABLE").length;
    const occupied = allTables.filter((table) => table.status === "OCCUPIED").length;
    const reserved = allTables.filter((table) => table.status === "RESERVED").length;
    const billed = allTables.filter((table) => table.status === "BILLED").length;
    const totalSeats = allTables.reduce((sum, table) => sum + (Number(table.capacity) || 0), 0);
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { total, available, occupied, reserved, billed, totalSeats, occupancyRate };
  }, [allTables]);

  const displayedTables = useMemo(() => {
    const scopedTables =
      selectedFloorId === "ALL"
        ? allTables
        : floors.find((floor) => floor.id === selectedFloorId)?.tables || [];

    const filteredByStatus =
      statusFilter === "ALL"
        ? scopedTables
        : scopedTables.filter((table) => table.status === statusFilter);

    if (!searchQuery.trim()) return filteredByStatus;

    const query = searchQuery.trim().toLowerCase();
    return filteredByStatus.filter((table) => {
      const rawNumber = String(table.tableNumber).toLowerCase();
      return (
        rawNumber.includes(query) ||
        `t-${rawNumber}`.includes(query) ||
        `table ${rawNumber}`.includes(query)
      );
    });
  }, [allTables, floors, selectedFloorId, statusFilter, searchQuery]);

  const availableTargetTables = useMemo(() => {
    return allTables.filter(
      (table) =>
        table.status === "AVAILABLE" && (!moveModal || table.id !== moveModal.sourceTable.id)
    );
  }, [allTables, moveModal]);

  const occupiedTargetTables = useMemo(() => {
    return allTables.filter(
      (table) =>
        table.status === "OCCUPIED" && (!mergeModal || table.id !== mergeModal.sourceTable.id)
    );
  }, [allTables, mergeModal]);

  const getFloorName = (floorId: string) => {
    return floors.find((floor) => floor.id === floorId)?.name || "Floor plan";
  };

  const handleOpenSession = async (takeOrderImmediately = true) => {
    if (!openSessionModal) return;
    try {
      setActionLoading(true);
      const tableId = openSessionModal.table.id;
      const tableNumber = openSessionModal.table.tableNumber;

      const response = await fetch("/api/v1/restaurant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, guestCount }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getErrorMessage(payload, "Failed to seat table"));
      }

      setOpenSessionModal(null);
      await loadFloors();

      if (takeOrderImmediately) {
        Notify.success(`Table ${tableNumber} seated — opening POS order...`);
        router.push(`/dashboard/restaurant/pos?tableId=${tableId}`);
      } else {
        Notify.success(`Table ${tableNumber} seated with ${guestCount} covers`);
      }
    } catch (error) {
      Notify.failure(error instanceof Error ? error.message : "Failed to seat table");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveSession = async () => {
    if (!moveModal || !targetTableId) return;
    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/v1/restaurant/tables/${moveModal.sourceTable.id}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTableId, reason: "Staff table transfer" }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getErrorMessage(payload, "Failed to transfer table"));
      }

      setMoveModal(null);
      setTargetTableId("");
      await loadFloors();
      Notify.success("Table session transferred successfully");
    } catch (error) {
      Notify.failure(error instanceof Error ? error.message : "Failed to transfer table");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMergeSession = async () => {
    if (!mergeModal || !targetTableId) return;
    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/v1/restaurant/tables/${mergeModal.sourceTable.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTableId, reason: "Combined dining party" }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getErrorMessage(payload, "Failed to merge tables"));
      }

      setMergeModal(null);
      setTargetTableId("");
      await loadFloors();
      Notify.success("Tables merged successfully");
    } catch (error) {
      Notify.failure(error instanceof Error ? error.message : "Failed to merge tables");
    } finally {
      setActionLoading(false);
    }
  };

  const openMoveModal = (table: Table) => {
    setTargetTableId("");
    setMoveModal({ sourceTable: table });
  };

  const openMergeModal = (table: Table) => {
    setTargetTableId("");
    setMergeModal({ sourceTable: table });
  };

  const guestOptions = [1, 2, 3, 4, 5, 6, 8, 10].filter(
    (count) => count <= (openSessionModal?.table.capacity || 0)
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] min-w-0 space-y-3 px-3 py-2.5 text-[#292522] sm:px-4 sm:py-3">
      {/* Compact Page Header: Immediate Table Focus */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E4DED5] pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-[#26221F] sm:text-xl">
            Floor Plan &amp; Tables
          </h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E9CDD3] bg-[#F8EEF0] px-2.5 py-0.5 text-xs font-semibold text-[#7B2C3D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7B2C3D]" />
            <span className="tabular-nums font-mono">
              {stats.occupied}/{stats.total} Active
            </span>
            <span className="hidden text-[11px] text-[#7B2C3D]/80 sm:inline">
              ({stats.occupancyRate}% occupancy · {stats.totalSeats} seats)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadFloors(true)}
            disabled={isRefreshing || loading}
            title="Refresh floor state"
            className={SECONDARY_BUTTON}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link href="/dashboard/restaurant/kds" className={SECONDARY_BUTTON}>
            <UtensilsCrossed className="h-3.5 w-3.5 text-[#7B2C3D]" />
            <span>Kitchen Display</span>
          </Link>
          <Link href="/dashboard/restaurant/pos" className={PRIMARY_BUTTON}>
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Open POS</span>
          </Link>
        </div>
      </header>

      {/* Streamlined Controls Toolbar (Floors + Status Filters + Search in One Line) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        {/* Floor Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedFloorId("ALL")}
            aria-pressed={selectedFloorId === "ALL"}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors cursor-pointer ${
              selectedFloorId === "ALL"
                ? "border-[#7B2C3D] bg-[#7B2C3D] text-white"
                : "border-[#DED7CE] bg-[#FFFEFC] text-[#514A44] hover:bg-[#F4F0EA]"
            }`}
          >
            <span>All floors</span>
            <span
              className={`text-[10px] tabular-nums font-mono ${
                selectedFloorId === "ALL" ? "text-white/80" : "text-[#8A8178]"
              }`}
            >
              {allTables.length}
            </span>
          </button>

          {floors.map((floor) => {
            const isSelected = floor.id === selectedFloorId;
            const occupied = (floor.tables || []).filter((table) => table.status === "OCCUPIED").length;
            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => setSelectedFloorId(floor.id)}
                aria-pressed={isSelected}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#7B2C3D] bg-[#7B2C3D] text-white"
                    : "border-[#DED7CE] bg-[#FFFEFC] text-[#514A44] hover:bg-[#F4F0EA]"
                }`}
              >
                <span>{floor.name}</span>
                <span
                  className={`text-[10px] tabular-nums font-mono ${
                    isSelected ? "text-white/80" : "text-[#8A8178]"
                  }`}
                >
                  {occupied}/{floor.tables?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filters & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Quick Filter Bar */}
          <div className="flex items-center gap-1 bg-[#EAE4DC]/60 p-0.5 rounded-md border border-[#DED7CE]">
            {(
              [
                { value: "ALL", label: "All", count: stats.total, color: "text-[#514A44]" },
                { value: "AVAILABLE", label: "Available", count: stats.available, color: "text-emerald-700" },
                { value: "OCCUPIED", label: "Occupied", count: stats.occupied, color: "text-[#7B2C3D]" },
                { value: "RESERVED", label: "Reserved", count: stats.reserved, color: "text-amber-700" },
                { value: "BILLED", label: "Billed", count: stats.billed, color: "text-blue-700" },
              ] as const
            ).map((filter) => {
              const selected = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  aria-pressed={selected}
                  className={`inline-flex h-7 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                    selected
                      ? "bg-[#FFFEFC] text-[#292522] shadow-xs"
                      : `${filter.color} hover:bg-[#FFFEFC]/50`
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className="text-[10px] font-mono tabular-nums opacity-75">
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <label className="relative block w-full sm:w-[190px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#918980]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search table..."
              className="h-8 w-full rounded-md border border-[#DED7CE] bg-[#FFFEFC] pl-8 pr-7 text-xs text-[#292522] placeholder:text-[#918980] focus:border-[#7B2C3D] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear table search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#918980] hover:text-[#292522]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* Primary Table Grid: Takes Maximum Screen Real Estate */}
      {loading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={`${SURFACE} animate-pulse rounded-md p-3`}>
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-[#EEE9E2]" />
                <div className="h-5 w-16 rounded bg-[#EEE9E2]" />
              </div>
              <div className="mt-3 h-3 w-28 rounded bg-[#EEE9E2]" />
              <div className="mt-4 h-8 rounded bg-[#EEE9E2]" />
            </div>
          ))}
        </div>
      ) : displayedTables.length > 0 ? (
        <section
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          aria-label="Restaurant tables"
        >
          {displayedTables.map((table) => {
            const status = STATUS_META[table.status];
            const isAvailable = table.status === "AVAILABLE";
            const isOccupied = table.status === "OCCUPIED";
            const isBilled = table.status === "BILLED";

            return (
              <article
                key={table.id}
                className={`${SURFACE} flex min-h-[128px] flex-col justify-between rounded-md border-l-[3px] ${status.accent} p-3 transition-colors hover:border-t-[#C9BFB4] hover:border-r-[#C9BFB4] hover:border-b-[#C9BFB4] shadow-xs`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[15px] font-bold leading-tight tabular-nums text-[#292522]">
                          Table {table.tableNumber}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#81786F]">
                        {getFloorName(table.floorId)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-semibold border ${status.surface} ${status.text} ${status.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#EEE9E2] pt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#766E66]">
                      <Users className="h-3.5 w-3.5 text-[#918980]" />
                      <span className="font-medium tabular-nums">{table.capacity} covers</span>
                    </span>
                    <span className={`text-[10px] font-medium ${status.text}`}>
                      {isAvailable
                        ? "Ready for guests"
                        : isOccupied
                        ? "Seated · Order active"
                        : isBilled
                        ? "Awaiting checkout"
                        : "Reserved"}
                    </span>
                  </div>
                </div>

                {/* Table Actions: Seated tables show "Order" to jump to POS */}
                <div className="mt-3 flex items-center gap-1.5">
                  {isAvailable ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setGuestCount(Math.max(1, Math.min(2, table.capacity || 1)));
                          setOpenSessionModal({ table });
                        }}
                        className={`${PRIMARY_BUTTON} h-8 flex-1 cursor-pointer`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Seat guests
                      </button>
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        aria-label={`Open POS for table ${table.tableNumber}`}
                        title="Open POS directly"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DED7CE] bg-[#FFFEFC] text-[#5D554E] transition-colors hover:border-[#BDB3A8] hover:bg-[#F7F4EF] cursor-pointer"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : isOccupied ? (
                    <>
                      {/* After seating guests: Show "Take Order" which opens Restaurant POS for this table */}
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        className={`${PRIMARY_BUTTON} h-8 flex-1 cursor-pointer`}
                        title="Take dining order for this table in POS"
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        <span>Take Order</span>
                      </Link>
                      <button
                        type="button"
                        title="Transfer table"
                        aria-label={`Transfer table ${table.tableNumber}`}
                        onClick={() => openMoveModal(table)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DED7CE] bg-[#FFFEFC] text-[#5D554E] transition-colors hover:border-[#BDB3A8] hover:bg-[#F7F4EF] cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Merge table"
                        aria-label={`Merge table ${table.tableNumber}`}
                        onClick={() => openMergeModal(table)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DED7CE] bg-[#FFFEFC] text-[#5D554E] transition-colors hover:border-[#BDB3A8] hover:bg-[#F7F4EF] cursor-pointer"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-colors cursor-pointer ${
                          isBilled ? "bg-blue-700 hover:bg-blue-800" : "bg-amber-700 hover:bg-amber-800"
                        }`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {isBilled ? "Settle Bill" : "Take Order"}
                      </Link>
                      <button
                        type="button"
                        title="Transfer table"
                        aria-label={`Transfer table ${table.tableNumber}`}
                        onClick={() => openMoveModal(table)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DED7CE] bg-[#FFFEFC] text-[#5D554E] transition-colors hover:border-[#BDB3A8] hover:bg-[#F7F4EF] cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className={`${SURFACE} rounded-md px-4 py-12 text-center`}>
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F3EFE9] text-[#7B2C3D]">
            <Layers3 className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[#292522]">
            {allTables.length === 0 ? "No tables configured" : "No tables match these filters"}
          </h3>
          <p className="mt-1 text-xs text-[#81786F]">
            {allTables.length === 0
              ? "Add tables to a floor to start managing restaurant seating."
              : "Try another floor or status, or clear the table search."}
          </p>
          {(searchQuery || statusFilter !== "ALL" || selectedFloorId !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setSelectedFloorId("ALL");
              }}
              className="mt-3 text-xs font-semibold text-[#7B2C3D] hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Seat Guests Modal: Options to "Seat & Take Order" immediately or "Seat Only" */}
      {openSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211D1B]/45 backdrop-blur-[1px] p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-dialog-title"
            className="w-full max-w-[390px] rounded-lg border border-[#DED7CE] bg-[#FFFEFC] p-4 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[#EAE4DC] pb-3">
              <div>
                <h2 id="seat-dialog-title" className="text-sm font-bold text-[#292522]">
                  Seat Table {openSessionModal.table.tableNumber}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#81786F]">
                  Capacity: {openSessionModal.table.capacity} covers max
                </p>
              </div>
              <button
                type="button"
                aria-label="Close seating dialog"
                onClick={() => !actionLoading && setOpenSessionModal(null)}
                disabled={actionLoading}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#81786F] hover:bg-[#F2EEE8] hover:text-[#292522] disabled:opacity-40 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4">
              <div className="mb-2 text-xs font-semibold text-[#514A44]">Number of guests (covers)</div>
              {guestOptions.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {guestOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setGuestCount(count)}
                      aria-pressed={guestCount === count}
                      className={`h-9 rounded-md border text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        guestCount === count
                          ? "border-[#7B2C3D] bg-[#7B2C3D] text-white shadow-xs"
                          : "border-[#DED7CE] bg-white text-[#514A44] hover:bg-[#F5F1EC]"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-800">Set a valid table capacity before seating guests.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-[#EAE4DC] pt-3">
              <button
                type="button"
                onClick={() => setOpenSessionModal(null)}
                disabled={actionLoading}
                className="w-full sm:w-auto h-8 px-3 rounded-md text-xs font-semibold text-[#766E66] hover:text-[#292522] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleOpenSession(false)}
                disabled={actionLoading || guestOptions.length === 0}
                className="w-full sm:w-auto inline-flex h-8 items-center justify-center rounded-md border border-[#DED7CE] bg-[#FFFEFC] px-3 text-xs font-semibold text-[#514A44] transition-colors hover:bg-[#F5F1EC] disabled:opacity-50 cursor-pointer"
              >
                Seat Only
              </button>
              <button
                type="button"
                onClick={() => handleOpenSession(true)}
                disabled={actionLoading || guestOptions.length === 0}
                className="w-full sm:w-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#7B2C3D] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#642231] disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>{actionLoading ? "Seating..." : "Seat & Take Order"}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Transfer Table Dialog */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211D1B]/45 backdrop-blur-[1px] p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-dialog-title"
            className="w-full max-w-[400px] rounded-lg border border-[#DED7CE] bg-[#FFFEFC] p-4 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[#EAE4DC] pb-3">
              <div>
                <h2 id="move-dialog-title" className="text-sm font-bold text-[#292522]">
                  Transfer Table {moveModal.sourceTable.tableNumber}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#81786F]">
                  Relocate party to another vacant dining table
                </p>
              </div>
              <button
                type="button"
                aria-label="Close transfer dialog"
                onClick={() => !actionLoading && setMoveModal(null)}
                disabled={actionLoading}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#81786F] hover:bg-[#F2EEE8] hover:text-[#292522] disabled:opacity-40 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4">
              <label htmlFor="target-table-select" className="mb-2 block text-xs font-semibold text-[#514A44]">
                Destination vacant table
              </label>
              {availableTargetTables.length > 0 ? (
                <select
                  id="target-table-select"
                  value={targetTableId}
                  onChange={(event) => setTargetTableId(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#DED7CE] bg-[#FFFEFC] px-3 text-xs text-[#292522] outline-none focus:border-[#7B2C3D]"
                >
                  <option value="">Select target table</option>
                  {availableTargetTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Table {table.tableNumber} ({table.capacity} covers) · {getFloorName(table.floorId)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-800">No other available tables on any floor.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#EAE4DC] pt-3">
              <button
                type="button"
                onClick={() => setMoveModal(null)}
                disabled={actionLoading}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveSession}
                disabled={actionLoading || !targetTableId}
                className={PRIMARY_BUTTON}
              >
                <Check className="h-3.5 w-3.5" />
                {actionLoading ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Merge Table Dialog */}
      {mergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211D1B]/45 backdrop-blur-[1px] p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-dialog-title"
            className="w-full max-w-[400px] rounded-lg border border-[#DED7CE] bg-[#FFFEFC] p-4 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[#EAE4DC] pb-3">
              <div>
                <h2 id="merge-dialog-title" className="text-sm font-bold text-[#292522]">
                  Merge Table {mergeModal.sourceTable.tableNumber}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#81786F]">
                  Combine orders with another active dining table
                </p>
              </div>
              <button
                type="button"
                aria-label="Close merge dialog"
                onClick={() => !actionLoading && setMergeModal(null)}
                disabled={actionLoading}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#81786F] hover:bg-[#F2EEE8] hover:text-[#292522] disabled:opacity-40 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4">
              <label htmlFor="merge-table-select" className="mb-2 block text-xs font-semibold text-[#514A44]">
                Target active table
              </label>
              {occupiedTargetTables.length > 0 ? (
                <select
                  id="merge-table-select"
                  value={targetTableId}
                  onChange={(event) => setTargetTableId(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#DED7CE] bg-[#FFFEFC] px-3 text-xs text-[#292522] outline-none focus:border-[#7B2C3D]"
                >
                  <option value="">Select target table</option>
                  {occupiedTargetTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Table {table.tableNumber} ({table.capacity} covers) · {getFloorName(table.floorId)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-800">No other occupied tables available to merge with.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#EAE4DC] pt-3">
              <button
                type="button"
                onClick={() => setMergeModal(null)}
                disabled={actionLoading}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMergeSession}
                disabled={actionLoading || !targetTableId}
                className={PRIMARY_BUTTON}
              >
                <Check className="h-3.5 w-3.5" />
                {actionLoading ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
