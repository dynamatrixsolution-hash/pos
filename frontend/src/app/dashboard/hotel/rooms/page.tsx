"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  BedDouble,
  Calendar,
  Plus,
  KeyRound,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Wrench,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  X,
} from "lucide-react";

interface RoomType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  baseRate: number | string;
  maxOccupancy: number;
  amenities?: string[];
}

interface Allocation {
  id: string;
  roomId: string;
  allocationType: "RESERVATION" | "STAY" | "MAINTENANCE";
  startDate: string;
  endDate: string;
  isBlocking: boolean;
  reservation?: {
    id: string;
    reservationNumber: string;
    guestName: string;
    status: string;
  } | null;
  stay?: {
    id: string;
    stayNumber: string;
    guestName: string;
    status: string;
  } | null;
  maintenanceTicket?: {
    id: string;
    title: string;
    priority: string;
    status: string;
  } | null;
}

interface ActiveStay {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone?: string | null;
  checkInTime: string;
  expectedCheckOut: string;
  ratePerNight: number | string;
  totalCharges: number | string;
  paidAmount: number | string;
}

interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floorId?: string | null;
  capacity: number;
  status:
    | "VACANT_CLEAN"
    | "VACANT_DIRTY"
    | "OCCUPIED_CLEAN"
    | "OCCUPIED_DIRTY"
    | "MAINTENANCE"
    | "OUT_OF_SERVICE";
  notes?: string | null;
  roomType: RoomType;
  allocations?: Allocation[];
  activeStay?: ActiveStay | null;
}

interface TapeChartStats {
  total: number;
  vacantClean: number;
  vacantDirty: number;
  occupied: number;
  maintenance: number;
}

export default function HotelRoomsTapeChartPage() {
  const [viewMode, setViewMode] = useState<"TAPE_CHART" | "ROOM_RACK">("TAPE_CHART");
  const [horizonDays, setHorizonDays] = useState<7 | 14>(14);
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [stats, setStats] = useState<TapeChartStats>({
    total: 0,
    vacantClean: 0,
    vacantDirty: 0,
    occupied: 0,
    maintenance: 0,
  });
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showFastCheckInModal, setShowFastCheckInModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Room Type Form
  const [rtName, setRtName] = useState("");
  const [rtCode, setRtCode] = useState("");
  const [rtBaseRate, setRtBaseRate] = useState("4500");
  const [rtMaxOccupancy, setRtMaxOccupancy] = useState("2");
  const [rtDescription, setRtDescription] = useState("");

  // Add Room Form
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomTypeId, setNewRoomTypeId] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("2");
  const [newRoomNotes, setNewRoomNotes] = useState("");

  // Fast Check-In Form
  const [ciGuestName, setCiGuestName] = useState("");
  const [ciGuestPhone, setCiGuestPhone] = useState("");
  const [ciGuestEmail, setCiGuestEmail] = useState("");
  const [ciIdType, setCiIdType] = useState("CITIZENSHIP");
  const [ciIdNumber, setCiIdNumber] = useState("");
  const [ciRoomId, setCiRoomId] = useState("");
  const [ciExpectedCheckOut, setCiExpectedCheckOut] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [ciNightlyRate, setCiNightlyRate] = useState("4500");
  const [ciAdvancePaid, setCiAdvancePaid] = useState("0");
  const [ciNotes, setCiNotes] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const startObj = new Date(`${startDate}T00:00:00.000Z`);
      const endObj = new Date(startObj.getTime() + horizonDays * 24 * 60 * 60 * 1000);
      const endStr = endObj.toISOString().slice(0, 10);

      const rtParam =
        selectedRoomTypeFilter !== "ALL"
          ? `&roomTypeId=${encodeURIComponent(selectedRoomTypeFilter)}`
          : "";

      const [rtRes, tcRes] = await Promise.all([
        fetch("/api/v1/hotel/room-types"),
        fetch(
          `/api/v1/hotel/tape-chart?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endStr)}${rtParam}`
        ),
      ]);

      if (rtRes.ok) {
        const rtData = await rtRes.json();
        const loadedTypes: RoomType[] = rtData.roomTypes || [];
        setRoomTypes(loadedTypes);
        if (loadedTypes.length > 0 && !newRoomTypeId) {
          setNewRoomTypeId(loadedTypes[0].id);
        }
      }

      if (!tcRes.ok) {
        const errData = await tcRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load hotel tape chart");
      }

      const tcData = await tcRes.json();
      setRooms(tcData.rooms || []);
      setDates(tcData.dates || []);
      if (tcData.stats) {
        setStats(tcData.stats);
      }
    } catch (err: any) { Notify.failure(err.message || "Error loading hotel rooms"); } finally {
      setLoading(false);
    }
  }, [startDate, horizonDays, selectedRoomTypeFilter, newRoomTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const vacantCleanRooms = rooms.filter((r) => r.status === "VACANT_CLEAN");

  const openFastCheckInForRoom = (room?: Room) => {
    const targetRoom = room || vacantCleanRooms[0];
    if (targetRoom) {
      setCiRoomId(targetRoom.id);
      setCiNightlyRate(String(parseMoney(targetRoom.roomType?.baseRate ?? 4500)));
    } else {
      setCiRoomId("");
    }
    setShowFastCheckInModal(true);
  };

  const handleRoomSelectionInCheckIn = (roomId: string) => {
    setCiRoomId(roomId);
    const found = rooms.find((r) => r.id === roomId);
    if (found?.roomType?.baseRate !== undefined) {
      setCiNightlyRate(String(parseMoney(found.roomType.baseRate)));
    }
  };

  const handleCreateRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/room-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rtName,
          code: rtCode.toUpperCase(),
          baseRate: Number(rtBaseRate) || 0,
          maxOccupancy: Number(rtMaxOccupancy) || 2,
          description: rtDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room type");

      setShowRoomTypeModal(false);
      setRtName("");
      setRtCode("");
      setRtDescription("");
      if (data.roomType?.id) setNewRoomTypeId(data.roomType.id);
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTypeId) {
      Notify.warning("Please create or select a Room Type first.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomNumber: newRoomNumber,
          roomTypeId: newRoomTypeId,
          capacity: Number(newRoomCapacity) || 2,
          notes: newRoomNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add room");

      setShowAddRoomModal(false);
      setNewRoomNumber("");
      setNewRoomNotes("");
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFastCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciRoomId) {
      Notify.warning("Please select a Vacant Clean room to check in.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/stays/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: ciRoomId,
          guestName: ciGuestName,
          guestPhone: ciGuestPhone || undefined,
          guestEmail: ciGuestEmail || undefined,
          guestIdType: ciIdType,
          guestIdNumber: ciIdNumber || undefined,
          expectedCheckOut: new Date(`${ciExpectedCheckOut}T12:00:00.000Z`).toISOString(),
          ratePerNight: Number(ciNightlyRate) || 0,
          paidAmount: Number(ciAdvancePaid) || 0,
          notes: ciNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fast check-in failed");

      setShowFastCheckInModal(false);
      setCiGuestName("");
      setCiGuestPhone("");
      setCiGuestEmail("");
      setCiIdNumber("");
      setCiAdvancePaid("0");
      setCiNotes("");
      await loadData();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getRoomStatusStyle = (status: Room["status"]) => {
    switch (status) {
      case "VACANT_CLEAN":
        return {
          label: "Vacant Clean",
          bg: "bg-[#EBF4F0]",
          text: "text-[#28634B]",
          border: "border-[#C3DED0]",
          dot: "bg-[#28634B]",
        };
      case "OCCUPIED_CLEAN":
      case "OCCUPIED_DIRTY":
        return {
          label: status === "OCCUPIED_DIRTY" ? "Occupied (Dirty)" : "Occupied",
          bg: "bg-[#F9EFF1]",
          text: "text-[#6B2837]",
          border: "border-[#E3C6CC]",
          dot: "bg-[#6B2837]",
        };
      case "VACANT_DIRTY":
        return {
          label: "Vacant Dirty",
          bg: "bg-[#FDF6E9]",
          text: "text-[#946000]",
          border: "border-[#EDD7AD]",
          dot: "bg-[#946000]",
        };
      case "MAINTENANCE":
      case "OUT_OF_SERVICE":
      default:
        return {
          label: status === "OUT_OF_SERVICE" ? "Out of Service" : "Maintenance",
          bg: "bg-[#FCEEEE]",
          text: "text-[#B33432]",
          border: "border-[#E9B6B7]",
          dot: "bg-[#B33432]",
        };
    }
  };

  const shiftDates = (offsetDays: number) => {
    const cur = new Date(`${startDate}T00:00:00.000Z`);
    cur.setUTCDate(cur.getUTCDate() + offsetDays);
    setStartDate(cur.toISOString().slice(0, 10));
  };

  // Helper to check if a date column falls within an allocation's [startDate, endDate)
  const getAllocationForCell = (room: Room, dateStr: string): Allocation | null => {
    if (!room.allocations || room.allocations.length === 0) return null;
    const cellStart = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const cellEnd = cellStart + 24 * 60 * 60 * 1000;

    return (
      room.allocations.find((alloc) => {
        const aStart = new Date(alloc.startDate).getTime();
        const aEnd = new Date(alloc.endDate).getTime();
        return aStart < cellEnd && aEnd > cellStart;
      }) || null
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-sandstone pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-espresso tracking-tight">
              Room Rack & Tape Chart
            </h1>
          </div>
          <p className="text-xs text-warmgray mt-0.5">
            Live room inventory, multi-day availability matrix, and instant walk-in check-in
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoomTypeModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Room Type</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddRoomModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Room</span>
          </button>

          <button
            type="button"
            onClick={() => openFastCheckInForRoom()}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Fast Check-In</span>
          </button>
        </div>
      </div>

      {/* Top Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-md border border-sandstone bg-porcelain p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-warmgray">
            Total Rooms
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-espresso tabular-nums">{stats.total}</span>
            <span className="text-[11px] text-warmgray">{roomTypes.length} Types</span>
          </div>
        </div>

        <div className="rounded-md border border-[#C3DED0] bg-[#EBF4F0] p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#28634B]">
            Vacant Clean
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#28634B] tabular-nums">
              {stats.vacantClean}
            </span>
            <span className="text-[11px] font-medium text-[#28634B]">Ready</span>
          </div>
        </div>

        <div className="rounded-md border border-[#E3C6CC] bg-[#F9EFF1] p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B2837]">
            Occupied
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#6B2837] tabular-nums">
              {stats.occupied}
            </span>
            <span className="text-[11px] font-medium text-[#6B2837]">In-House</span>
          </div>
        </div>

        <div className="rounded-md border border-[#EDD7AD] bg-[#FDF6E9] p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#946000]">
            Vacant Dirty
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#946000] tabular-nums">
              {stats.vacantDirty}
            </span>
            <Link
              href="/dashboard/hotel/housekeeping"
              className="text-[11px] font-semibold text-[#946000] underline"
            >
              Clean
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-[#E9B6B7] bg-[#FCEEEE] p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#B33432]">
            Maintenance
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#B33432] tabular-nums">
              {stats.maintenance}
            </span>
            <span className="text-[11px] font-medium text-[#B33432]">Blocked</span>
          </div>
        </div>
      </div>

      {/* Filter & View Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-porcelain p-3 rounded-md border border-sandstone">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-sandstone bg-ivory p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("TAPE_CHART")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "TAPE_CHART"
                  ? "bg-[#6B2837] text-[#FFFCF7] shadow-xs"
                  : "text-espresso hover:bg-stone"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Tape Chart Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ROOM_RACK")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "ROOM_RACK"
                  ? "bg-[#6B2837] text-[#FFFCF7] shadow-xs"
                  : "text-espresso hover:bg-stone"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Room Rack Grid</span>
            </button>
          </div>

          {/* Room Type Filter */}
          <select
            value={selectedRoomTypeFilter}
            onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-sandstone bg-porcelain px-3 py-1.5 text-espresso font-medium focus:outline-none focus:border-[#6B2837]"
          >
            <option value="ALL">All Room Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} ({rt.code}) - {formatNPR(rt.baseRate)}
              </option>
            ))}
          </select>
        </div>

        {/* Date Navigation for Tape Chart */}
        <div className="flex items-center gap-2">
          {viewMode === "TAPE_CHART" && (
            <>
              <div className="inline-flex rounded-lg border border-sandstone bg-ivory p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setHorizonDays(7)}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    horizonDays === 7 ? "bg-porcelain text-[#6B2837] shadow-xs" : "text-warmgray"
                  }`}
                >
                  7D
                </button>
                <button
                  type="button"
                  onClick={() => setHorizonDays(14)}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    horizonDays === 14 ? "bg-porcelain text-[#6B2837] shadow-xs" : "text-warmgray"
                  }`}
                >
                  14D
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftDates(-7)}
                  className="p-1.5 rounded-lg border border-sandstone hover:bg-stone text-espresso cursor-pointer"
                  title="Previous 7 days"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => e.target.value && setStartDate(e.target.value)}
                  className="text-xs rounded-lg border border-sandstone bg-porcelain px-2.5 py-1 text-espresso font-medium"
                />
                <button
                  type="button"
                  onClick={() => shiftDates(7)}
                  className="p-1.5 rounded-lg border border-sandstone hover:bg-stone text-espresso cursor-pointer"
                  title="Next 7 days"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded-lg border border-sandstone hover:bg-stone text-espresso cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-[#E9B6B7] bg-[#FCEEEE] p-3 text-xs font-medium text-[#B33432]">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-md border border-sandstone bg-porcelain p-12 text-center text-xs text-warmgray">
          Loading hotel inventory and tape chart...
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-md border border-sandstone bg-porcelain p-12 text-center space-y-3">
          <BedDouble className="h-8 w-8 text-warmgray mx-auto" />
          <div className="text-sm font-bold text-espresso">No Hotel Rooms Configured Yet</div>
          <p className="text-xs text-warmgray max-w-md mx-auto">
            Start by creating a Room Type (e.g., Deluxe Double, Executive Suite) and adding physical
            rooms to view the interactive Tape Chart and Room Rack.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowRoomTypeModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-sandstone bg-ivory hover:bg-stone text-espresso cursor-pointer"
            >
              + Create Room Type
            </button>
            <button
              type="button"
              onClick={() => setShowAddRoomModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6B2837] text-[#FFFCF7] cursor-pointer"
            >
              + Add First Room
            </button>
          </div>
        </div>
      ) : viewMode === "TAPE_CHART" ? (
        /* Tape Chart Matrix (Rooms x Dates) */
        <div className="rounded-md border border-sandstone bg-porcelain shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-sandstone bg-ivory/70">
                  <th className="sticky left-0 z-10 bg-ivory px-4 py-3 text-xs font-bold text-espresso border-r border-sandstone min-w-[200px]">
                    Room / Type
                  </th>
                  {dates.map((d) => {
                    const dt = new Date(`${d}T00:00:00Z`);
                    const dayName = dt.toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    });
                    const monthDay = dt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    });
                    return (
                      <th
                        key={d}
                        className="px-2 py-2.5 text-center border-r border-sandstone/60 min-w-[92px]"
                      >
                        <div className="text-[10px] font-bold uppercase text-warmgray">
                          {dayName}
                        </div>
                        <div className="text-xs font-extrabold text-espresso">{monthDay}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-sandstone/60">
                {rooms.map((room) => {
                  const style = getRoomStatusStyle(room.status);
                  return (
                    <tr key={room.id} className="hover:bg-ivory/40 transition-colors">
                      {/* Sticky Left Room Column */}
                      <td className="sticky left-0 z-10 bg-porcelain px-4 py-3 border-r border-sandstone">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-espresso">
                              Rm {room.roomNumber}
                            </div>
                            <div className="text-[11px] text-warmgray font-medium">
                              {room.roomType?.name || "Standard"} •{" "}
                              {formatNPR(room.roomType?.baseRate ?? 0)}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}
                          >
                            {style.label}
                          </span>
                        </div>
                      </td>

                      {/* Daily Cells */}
                      {dates.map((dateStr) => {
                        const alloc = getAllocationForCell(room, dateStr);
                        if (alloc) {
                          if (alloc.allocationType === "STAY") {
                            return (
                              <td
                                key={dateStr}
                                className="p-1.5 border-r border-sandstone/50 align-middle"
                              >
                                <Link
                                  href="/dashboard/hotel/stays"
                                  className="block rounded-lg bg-[#F9EFF1] border border-[#E3C6CC] px-2 py-1.5 text-[11px] text-[#6B2837] hover:opacity-90 transition-opacity"
                                  title={`Stay: ${alloc.stay?.guestName || "In-House Guest"}`}
                                >
                                  <div className="font-bold truncate">
                                    {alloc.stay?.guestName || "Occupied"}
                                  </div>
                                  <div className="text-[9px] uppercase font-semibold opacity-80">
                                    In-House
                                  </div>
                                </Link>
                              </td>
                            );
                          }
                          if (alloc.allocationType === "RESERVATION") {
                            return (
                              <td
                                key={dateStr}
                                className="p-1.5 border-r border-sandstone/50 align-middle"
                              >
                                <Link
                                  href="/dashboard/hotel/reservations"
                                  className="block rounded-lg bg-[#FDF6E9] border border-[#EDD7AD] px-2 py-1.5 text-[11px] text-[#946000] hover:opacity-90 transition-opacity"
                                  title={`Reservation: ${alloc.reservation?.guestName || "Reserved"}`}
                                >
                                  <div className="font-bold truncate">
                                    {alloc.reservation?.guestName || "Reserved"}
                                  </div>
                                  <div className="text-[9px] uppercase font-semibold opacity-80">
                                    Confirmed
                                  </div>
                                </Link>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={dateStr}
                              className="p-1.5 border-r border-sandstone/50 align-middle"
                            >
                              <Link
                                href="/dashboard/hotel/housekeeping"
                                className="block rounded-lg bg-[#FCEEEE] border border-[#E9B6B7] px-2 py-1.5 text-[11px] text-[#B33432]"
                              >
                                <div className="font-bold truncate">
                                  {alloc.maintenanceTicket?.title || "Maintenance"}
                                </div>
                                <div className="text-[9px] uppercase font-semibold opacity-80">
                                  Blocked
                                </div>
                              </Link>
                            </td>
                          );
                        }

                        // No allocation on this date
                        const isReady = room.status === "VACANT_CLEAN";
                        return (
                          <td
                            key={dateStr}
                            onClick={() => isReady && openFastCheckInForRoom(room)}
                            className={`p-1.5 border-r border-sandstone/50 text-center align-middle ${
                              isReady ? "cursor-pointer hover:bg-[#EBF4F0]/60" : ""
                            }`}
                          >
                            <div className="h-9 rounded-lg border border-dashed border-sandstone/70 flex items-center justify-center text-[10px] font-medium text-warmgray">
                              {isReady ? "Available" : style.label}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Room Rack Visual Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map((room) => {
            const style = getRoomStatusStyle(room.status);
            return (
              <div
                key={room.id}
                className="rounded-md border border-sandstone bg-porcelain p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-[#6B2837]/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                      <h3 className="text-base font-black text-espresso">
                        Room {room.roomNumber}
                      </h3>
                    </div>
                    <p className="text-xs text-warmgray font-medium mt-0.5">
                      {room.roomType?.name || "Standard"} • Max {room.capacity} Guests
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}
                  >
                    {style.label}
                  </span>
                </div>

                {/* Middle Status / Guest Card */}
                <div className="rounded-lg bg-ivory/60 border border-sandstone/70 p-2.5 text-xs">
                  {room.activeStay ? (
                    <div className="space-y-1">
                      <div className="font-bold text-[#6B2837] flex items-center justify-between">
                        <span>{room.activeStay.guestName}</span>
                        <span className="text-[10px] font-semibold">
                          {room.activeStay.stayNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-warmgray">
                        Out: {new Date(room.activeStay.expectedCheckOut).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-warmgray">
                      <span>Base Nightly Rate</span>
                      <span className="font-bold text-espresso">
                        {formatNPR(room.roomType?.baseRate ?? 0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-sandstone flex items-center gap-2">
                  {room.status === "VACANT_CLEAN" ? (
                    <button
                      type="button"
                      onClick={() => openFastCheckInForRoom(room)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Check In</span>
                    </button>
                  ) : room.status === "OCCUPIED_CLEAN" || room.status === "OCCUPIED_DIRTY" ? (
                    <Link
                      href="/dashboard/hotel/stays"
                      className="flex-1 py-1.5 text-center text-xs font-bold rounded-lg bg-[#F9EFF1] text-[#6B2837] border border-[#E3C6CC] hover:opacity-90 transition-opacity"
                    >
                      Manage Stay
                    </Link>
                  ) : room.status === "VACANT_DIRTY" ? (
                    <Link
                      href="/dashboard/hotel/housekeeping"
                      className="flex-1 py-1.5 text-center text-xs font-bold rounded-md bg-[#FDF6E9] text-[#946000] border border-[#EDD7AD] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      <span>Housekeeping</span>
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/hotel/housekeeping"
                      className="flex-1 py-1.5 text-center text-xs font-bold rounded-lg bg-[#FCEEEE] text-[#B33432] border border-[#E9B6B7] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Maintenance</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* + Room Type Modal */}
      {showRoomTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">Create New Room Type</h3>
              <button
                type="button"
                onClick={() => setShowRoomTypeModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomType} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Room Type Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Deluxe King"
                    value={rtName}
                    onChange={(e) => setRtName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Short Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DLX-K"
                    value={rtCode}
                    onChange={(e) => setRtCode(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso uppercase focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Base Nightly Rate (NPR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={rtBaseRate}
                    onChange={(e) => setRtBaseRate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Max Occupancy *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={rtMaxOccupancy}
                    onChange={(e) => setRtMaxOccupancy(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Mountain view, balcony, breakfast included..."
                  value={rtDescription}
                  onChange={(e) => setRtDescription(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowRoomTypeModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Save Room Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* + Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">Add Physical Room</h3>
              <button
                type="button"
                onClick={() => setShowAddRoomModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="101"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Room Type *
                </label>
                <select
                  required
                  value={newRoomTypeId}
                  onChange={(e) => setNewRoomTypeId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Select Room Type --</option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} ({rt.code}) - {formatNPR(rt.baseRate)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Floor 1, quiet wing..."
                  value={newRoomNotes}
                  onChange={(e) => setNewRoomNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoading ? "Adding..." : "Add Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fast Check-In Modal */}
      {showFastCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#6B2837]" />
                <h3 className="text-sm font-bold text-espresso">Fast Walk-In Check-In</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFastCheckInModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFastCheckIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Select Vacant Clean Room *
                </label>
                <select
                  required
                  value={ciRoomId}
                  onChange={(e) => handleRoomSelectionInCheckIn(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso font-medium focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Choose Available Room --</option>
                  {vacantCleanRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} — {r.roomType?.name} ({formatNPR(r.roomType?.baseRate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Guest Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Aarav Sharma"
                    value={ciGuestName}
                    onChange={(e) => setCiGuestName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+977 9800000000"
                    value={ciGuestPhone}
                    onChange={(e) => setCiGuestPhone(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={ciGuestEmail}
                    onChange={(e) => setCiGuestEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">ID Type</label>
                  <select
                    value={ciIdType}
                    onChange={(e) => setCiIdType(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="PASSPORT">PASSPORT</option>
                    <option value="CITIZENSHIP">CITIZENSHIP</option>
                    <option value="DRIVING_LICENSE">DRIVING_LICENSE</option>
                    <option value="NATIONAL_ID">NATIONAL_ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    ID Number
                  </label>
                  <input
                    type="text"
                    placeholder="ID / Passport #"
                    value={ciIdNumber}
                    onChange={(e) => setCiIdNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Expected Check-Out *
                  </label>
                  <input
                    type="date"
                    required
                    value={ciExpectedCheckOut}
                    onChange={(e) => setCiExpectedCheckOut(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Nightly Rate (NPR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={ciNightlyRate}
                    onChange={(e) => setCiNightlyRate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Advance Paid (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ciAdvancePaid}
                    onChange={(e) => setCiAdvancePaid(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Airport pickup, extra pillows, corporate billing..."
                  value={ciNotes}
                  onChange={(e) => setCiNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowFastCheckInModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !ciRoomId}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Checking In..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
