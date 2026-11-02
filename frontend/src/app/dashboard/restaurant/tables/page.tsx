"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { X } from "lucide-react";

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

export default function RestaurantTablesPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [openSessionModal, setOpenSessionModal] = useState<{ table: Table } | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [moveModal, setMoveModal] = useState<{ sourceTable: Table } | null>(null);
  const [mergeModal, setMergeModal] = useState<{ sourceTable: Table } | null>(null);
  const [targetTableId, setTargetTableId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadFloors = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/restaurant/floors");
      if (!res.ok) throw new Error("Failed to load floors");
      const data = await res.json();
      if (data.floors && data.floors.length > 0) {
        setFloors(data.floors);
        setSelectedFloorId((prev) => prev || data.floors[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloors();
  }, []);

  const activeFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const allTables = useMemo(() => floors.flatMap((f) => f.tables || []), [floors]);

  const stats = useMemo(() => {
    const total = allTables.length;
    const available = allTables.filter((t) => t.status === "AVAILABLE").length;
    const occupied = allTables.filter((t) => t.status === "OCCUPIED").length;
    const billedOrReserved = allTables.filter(
      (t) => t.status === "BILLED" || t.status === "RESERVED"
    ).length;
    const totalSeats = allTables.reduce((sum, t) => sum + (t.capacity || 0), 0);
    return { total, available, occupied, billedOrReserved, totalSeats };
  }, [allTables]);

  const availableTargetTables = allTables.filter(
    (t) => t.status === "AVAILABLE" && (!moveModal || t.id !== moveModal.sourceTable.id)
  );
  const occupiedTargetTables = allTables.filter(
    (t) => t.status === "OCCUPIED" && (!mergeModal || t.id !== mergeModal.sourceTable.id)
  );

  const getStatusStyle = (status: Table["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return {
          badgeBg: "bg-[#EAF3EE]",
          badgeText: "text-[#28634B]",
          badgeBorder: "border-[#C3DED0]",
          dot: "bg-[#28634B]",
          label: "Vacant",
        };
      case "OCCUPIED":
        return {
          badgeBg: "bg-[#FDF5E7]",
          badgeText: "text-[#946000]",
          badgeBorder: "border-[#EDD7AD]",
          dot: "bg-[#946000]",
          label: "Occupied",
        };
      case "BILLED":
        return {
          badgeBg: "bg-[#EDF4F9]",
          badgeText: "text-[#315F85]",
          badgeBorder: "border-[#B8D2E6]",
          dot: "bg-[#315F85]",
          label: "Billed",
        };
      case "RESERVED":
        return {
          badgeBg: "bg-[#EDF4F9]",
          badgeText: "text-[#315F85]",
          badgeBorder: "border-[#B8D2E6]",
          dot: "bg-[#315F85]",
          label: "Reserved",
        };
    }
  };

  const handleOpenSession = async () => {
    if (!openSessionModal) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/restaurant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: openSessionModal.table.id,
          guestCount,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to open session");
      }
      const tableNum = openSessionModal.table.tableNumber;
      setOpenSessionModal(null);
      await loadFloors();
      showToast(`Table ${tableNum} seated (${guestCount} covers)`);
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveSession = async () => {
    if (!moveModal || !targetTableId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/restaurant/tables/${moveModal.sourceTable.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTableId,
          reason: "Staff table transfer",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to move table");
      }
      setMoveModal(null);
      setTargetTableId("");
      await loadFloors();
      showToast("Table session transferred");
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMergeSession = async () => {
    if (!mergeModal || !targetTableId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/restaurant/tables/${mergeModal.sourceTable.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTableId,
          reason: "Party combined tables",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to merge tables");
      }
      setMergeModal(null);
      setTargetTableId("");
      await loadFloors();
      showToast("Tables merged");
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto text-[#292320]">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2.5 rounded-lg bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0] text-xs font-semibold">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D8CEC1] pb-3.5">
        <div>
          <h1 className="text-lg font-bold text-[#292320]">Floor Plan & Table Sessions</h1>
          <p className="text-xs text-[#71675E]">
            Manage dining table occupancy, transfers, merges, and active POS sessions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/hotel/qr-portal"
            className="px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            QR Plaques
          </Link>
          <Link
            href="/dashboard/restaurant/kds"
            className="px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            Kitchen KDS
          </Link>
          <Link
            href="/dashboard/restaurant/pos"
            className="px-3.5 py-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-semibold text-[#FFFCF7] transition-colors"
          >
            Touch POS
          </Link>
        </div>
      </div>

      {/* Compact Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
            Total Tables
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular-nums text-[#292320]">{stats.total}</span>
            <span className="text-xs text-[#71675E] tabular-nums">{stats.totalSeats} seats</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
            Vacant
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular-nums text-[#28634B]">{stats.available}</span>
            <span className="text-xs text-[#28634B]">Ready</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
            Occupied
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular-nums text-[#946000]">{stats.occupied}</span>
            <span className="text-xs text-[#946000]">Active</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
            Billed / Reserved
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular-nums text-[#315F85]">
              {stats.billedOrReserved}
            </span>
            <span className="text-xs text-[#315F85]">Pending</span>
          </div>
        </div>
      </div>

      {/* Floor Tabs */}
      {floors.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[#D8CEC1] pb-2">
          {floors.map((floor) => {
            const isSelected = floor.id === selectedFloorId;
            const occupiedCount = (floor.tables || []).filter(
              (t) => t.status === "OCCUPIED"
            ).length;

            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => setSelectedFloorId(floor.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 border ${
                  isSelected
                    ? "bg-[#6B2837] border-[#6B2837] text-[#FFFCF7]"
                    : "bg-[#FFFCF7] border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                <span>{floor.name}</span>
                <span className="text-[10px] tabular-nums opacity-80">
                  ({occupiedCount}/{floor.tables.length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3"
            >
              <div className="h-4 w-1/3 rounded bg-[#EEE7DD] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[#EEE7DD] animate-pulse" />
              <div className="h-8 w-full rounded bg-[#EEE7DD] animate-pulse" />
            </div>
          ))}
        </div>
      ) : activeFloor && activeFloor.tables.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {activeFloor.tables.map((table) => {
            const st = getStatusStyle(table.status);

            return (
              <div
                key={table.id}
                className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#292320] tabular-nums">
                      Table {table.tableNumber}
                    </h3>
                    <p className="text-xs text-[#71675E] tabular-nums">
                      {table.capacity} Covers • {activeFloor.name}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${st.badgeBg} ${st.badgeText} ${st.badgeBorder}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#D8CEC1]/70 flex items-center gap-2">
                  {table.status === "AVAILABLE" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setGuestCount(Math.min(2, table.capacity));
                          setOpenSessionModal({ table });
                        }}
                        className="flex-1 py-2 px-3 rounded-md bg-[#28634B] hover:bg-[#28634B]/90 text-[#FFFCF7] text-xs font-semibold transition-colors"
                      >
                        Seat Party
                      </button>
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        className="py-2 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
                      >
                        Order
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        className="flex-1 py-2 px-3 text-center rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold transition-colors"
                      >
                        Open POS
                      </Link>
                      <button
                        type="button"
                        onClick={() => setMoveModal({ sourceTable: table })}
                        className="py-2 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-medium text-[#292320] transition-colors"
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergeModal({ sourceTable: table })}
                        className="py-2 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-medium text-[#292320] transition-colors"
                      >
                        Merge
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 text-center text-xs text-[#71675E]">
          No dining tables configured for this floor.
        </div>
      )}

      {/* Seat Party Modal */}
      {openSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4">
          <div className="w-full max-w-sm rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">
                  Seat Table {openSessionModal.table.tableNumber}
                </h3>
                <p className="text-xs text-[#71675E] tabular-nums">
                  Capacity: {openSessionModal.table.capacity} Covers
                </p>
              </div>
              <button
                onClick={() => setOpenSessionModal(null)}
                className="text-[#71675E] hover:text-[#292320]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#292320] block">Covers</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGuestCount(num)}
                    className={`py-1.5 rounded-md text-xs font-semibold tabular-nums border transition-colors ${
                      guestCount === num
                        ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                        : "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setOpenSessionModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-[#71675E] hover:text-[#292320]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleOpenSession}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#28634B] hover:bg-[#28634B]/90 text-[#FFFCF7]"
              >
                {actionLoading ? "Opening..." : `Seat ${guestCount} Covers`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Table Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4">
          <div className="w-full max-w-sm rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
              <h3 className="text-sm font-bold text-[#292320]">
                Move Table {moveModal.sourceTable.tableNumber}
              </h3>
              <button
                onClick={() => setMoveModal(null)}
                className="text-[#71675E] hover:text-[#292320]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#292320] block">
                Destination Table
              </label>
              {availableTargetTables.length === 0 ? (
                <p className="text-xs text-[#B33432]">No vacant tables available.</p>
              ) : (
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-2 text-[#292320] focus:border-[#6B2837] focus:outline-none"
                >
                  <option value="">Select destination table</option>
                  {availableTargetTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.tableNumber} ({t.capacity} covers)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setMoveModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-[#71675E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetTableId || actionLoading}
                onClick={handleMoveSession}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] disabled:opacity-50"
              >
                {actionLoading ? "Moving..." : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Table Modal */}
      {mergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4">
          <div className="w-full max-w-sm rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
              <h3 className="text-sm font-bold text-[#292320]">
                Merge Table {mergeModal.sourceTable.tableNumber}
              </h3>
              <button
                onClick={() => setMergeModal(null)}
                className="text-[#71675E] hover:text-[#292320]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#292320] block">
                Target Occupied Table
              </label>
              {occupiedTargetTables.length === 0 ? (
                <p className="text-xs text-[#B33432]">No other occupied tables found.</p>
              ) : (
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-2 text-[#292320] focus:border-[#6B2837] focus:outline-none"
                >
                  <option value="">Select target table</option>
                  {occupiedTargetTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.tableNumber} ({t.capacity} covers)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setMergeModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-[#71675E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetTableId || actionLoading}
                onClick={handleMergeSession}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] disabled:opacity-50"
              >
                {actionLoading ? "Merging..." : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
