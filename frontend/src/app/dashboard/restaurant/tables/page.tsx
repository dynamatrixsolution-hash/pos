"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/currency";

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
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [openSessionModal, setOpenSessionModal] = useState<{ table: Table } | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [moveModal, setMoveModal] = useState<{ sourceTable: Table } | null>(null);
  const [targetTableId, setTargetTableId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch floors & tables
  const loadFloors = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/restaurant/floors");
      if (!res.ok) throw new Error("Failed to load floors");
      const data = await res.json();
      if (data.floors && data.floors.length > 0) {
        setFloors(data.floors);
        if (!selectedFloorId) setSelectedFloorId(data.floors[0].id);
      } else {
        // Fallback default floors for fresh preview
        const defaultFloors: Floor[] = [
          {
            id: "floor-ground",
            name: "Main Dining Room",
            tables: [
              { id: "t-1", tableNumber: "T-01", floorId: "floor-ground", capacity: 4, status: "AVAILABLE" },
              { id: "t-2", tableNumber: "T-02", floorId: "floor-ground", capacity: 2, status: "OCCUPIED" },
              { id: "t-3", tableNumber: "T-03", floorId: "floor-ground", capacity: 6, status: "BILLED" },
              { id: "t-4", tableNumber: "T-04", floorId: "floor-ground", capacity: 4, status: "AVAILABLE" },
              { id: "t-5", tableNumber: "T-05", floorId: "floor-ground", capacity: 8, status: "RESERVED" },
            ],
          },
          {
            id: "floor-terrace",
            name: "Rooftop Terrace",
            tables: [
              { id: "t-6", tableNumber: "R-01", floorId: "floor-terrace", capacity: 4, status: "AVAILABLE" },
              { id: "t-7", tableNumber: "R-02", floorId: "floor-terrace", capacity: 4, status: "AVAILABLE" },
            ],
          },
        ];
        setFloors(defaultFloors);
        setSelectedFloorId(defaultFloors[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloors();
  }, []);

  const activeFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const allTables = floors.flatMap((f) => f.tables);
  const availableTargetTables = allTables.filter(
    (t) => t.status === "AVAILABLE" && (!moveModal || t.id !== moveModal.sourceTable.id)
  );

  // Status badge style helper
  const getStatusBadge = (status: Table["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return {
          bg: "bg-[#EAF3EE]",
          text: "text-[#28634B]",
          border: "border-[#C3DED0]",
          label: "Available",
        };
      case "OCCUPIED":
        return {
          bg: "bg-[#FDF5E7]",
          text: "text-[#946000]",
          border: "border-[#EDD7AD]",
          label: "Occupied",
        };
      case "BILLED":
        return {
          bg: "bg-[#EDF4F9]",
          text: "text-[#315F85]",
          border: "border-[#B8D2E6]",
          label: "Billed",
        };
      case "RESERVED":
        return {
          bg: "bg-[#EDF4F9]",
          text: "text-[#315F85]",
          border: "border-[#B8D2E6]",
          label: "Reserved",
        };
    }
  };

  // Open Session Action
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
      setOpenSessionModal(null);
      await loadFloors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Move Session Action
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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sandstone pb-4">
        <div>
          <h1 className="text-xl font-bold text-espresso tracking-tight">Floor & Dining Tables</h1>
          <p className="text-xs text-warmgray mt-0.5">
            Real-time table occupancy, active sessions, and table transfer management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/restaurant/pos"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-burgundy hover:bg-burgundy-hover text-porcelain transition-all shadow-xs"
          >
            Go to Staff POS
          </Link>
        </div>
      </div>

      {/* Floor Tab Selector */}
      {floors.length > 0 && (
        <div className="flex items-center gap-2 border-b border-sandstone pb-2 overflow-x-auto">
          {floors.map((floor) => {
            const isSelected = floor.id === selectedFloorId;
            const occupiedCount = floor.tables.filter((t) => t.status === "OCCUPIED").length;

            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => setSelectedFloorId(floor.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isSelected
                    ? "bg-porcelain border-burgundy text-burgundy shadow-xs font-semibold"
                    : "bg-warmstone/40 border-sandstone text-espresso hover:bg-warmstone"
                }`}
              >
                <span>{floor.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold ${
                    occupiedCount > 0 ? "bg-ochre-bg text-ochre" : "bg-warmstone text-warmgray"
                  }`}
                >
                  {floor.tables.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-warmgray">Loading floor layout...</div>
      ) : activeFloor && activeFloor.tables.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeFloor.tables.map((table) => {
            const badge = getStatusBadge(table.status);

            return (
              <div
                key={table.id}
                className="rounded-xl border border-sandstone bg-porcelain p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-sandstone/80 transition-all"
              >
                {/* Table Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-espresso">{table.tableNumber}</h3>
                    <p className="text-xs text-warmgray">{table.capacity} Guests Capacity</p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Table Body Quick Info */}
                <div className="bg-warmivory/40 rounded-lg p-2.5 border border-sandstone/60 text-xs text-espresso">
                  {table.status === "AVAILABLE" ? (
                    <span className="text-warmgray italic">Ready for guest seating</span>
                  ) : table.status === "OCCUPIED" ? (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ochre">Dining Active</span>
                      <span className="text-[11px] text-warmgray">Session Open</span>
                    </div>
                  ) : (
                    <span className="text-warmgray">Bill requested / pending</span>
                  )}
                </div>

                {/* Table Action Buttons */}
                <div className="pt-2 border-t border-sandstone flex items-center gap-2">
                  {table.status === "AVAILABLE" ? (
                    <button
                      type="button"
                      onClick={() => setOpenSessionModal({ table })}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-forest/10 hover:bg-forest/20 text-forest border border-forest/30 transition-colors"
                    >
                      Seat Party
                    </button>
                  ) : (
                    <>
                      <Link
                        href={`/dashboard/restaurant/pos?tableId=${table.id}`}
                        className="flex-1 py-1.5 text-center text-xs font-semibold rounded-lg bg-burgundy hover:bg-burgundy-hover text-porcelain transition-colors"
                      >
                        Orders
                      </Link>
                      <button
                        type="button"
                        onClick={() => setMoveModal({ sourceTable: table })}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-sandstone text-espresso hover:bg-warmstone transition-colors"
                        title="Move to another table"
                      >
                        Move
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-warmgray">No dining tables found for this floor.</div>
      )}

      {/* Seat Party Modal */}
      {openSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-sandstone bg-porcelain p-4 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-sandstone pb-2">
              <h3 className="text-sm font-bold text-espresso">
                Seat Table {openSessionModal.table.tableNumber}
              </h3>
              <button
                onClick={() => setOpenSessionModal(null)}
                className="text-warmgray hover:text-espresso"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-espresso">Number of Guests</label>
              <div className="flex items-center rounded-lg border border-sandstone bg-porcelain">
                <button
                  type="button"
                  onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                  className="px-3 py-1.5 text-sm font-bold hover:bg-warmstone"
                >
                  -
                </button>
                <input
                  type="number"
                  value={guestCount}
                  onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center text-xs font-bold tabular-nums text-espresso focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setGuestCount((g) => g + 1)}
                  className="px-3 py-1.5 text-sm font-bold hover:bg-warmstone"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sandstone">
              <button
                type="button"
                onClick={() => setOpenSessionModal(null)}
                className="px-3 py-1.5 text-xs text-warmgray hover:text-espresso"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleOpenSession}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-burgundy hover:bg-burgundy-hover text-porcelain"
              >
                {actionLoading ? "Seating..." : "Confirm Seating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Table Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-sandstone bg-porcelain p-4 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-sandstone pb-2">
              <h3 className="text-sm font-bold text-espresso">
                Move Table {moveModal.sourceTable.tableNumber}
              </h3>
              <button onClick={() => setMoveModal(null)} className="text-warmgray hover:text-espresso">
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-espresso">Select Destination Table</label>
              {availableTargetTables.length === 0 ? (
                <p className="text-xs text-red italic">No available tables to transfer to.</p>
              ) : (
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-porcelain p-2 text-espresso focus:border-burgundy focus:outline-none"
                >
                  <option value="">-- Choose destination table --</option>
                  {availableTargetTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.capacity} pax)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sandstone">
              <button
                type="button"
                onClick={() => setMoveModal(null)}
                className="px-3 py-1.5 text-xs text-warmgray hover:text-espresso"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetTableId || actionLoading}
                onClick={handleMoveSession}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-burgundy hover:bg-burgundy-hover text-porcelain disabled:opacity-50"
              >
                {actionLoading ? "Moving..." : "Transfer Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

