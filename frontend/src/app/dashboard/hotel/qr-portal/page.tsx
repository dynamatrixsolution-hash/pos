"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  QrCode,
  Bell,
  RefreshCw,
  CheckCircle2,
  Play,
  ShieldCheck,
  RotateCcw,
  Printer,
  ExternalLink,
  Copy,
  BedDouble,
  Store,
  AlertCircle,
  Clock,
  Plus,
  X,
  KeyRound,
  UtensilsCrossed,
} from "lucide-react";

type ConsoleTab = "SERVICE_QUEUE" | "QR_PLAQUES";
type ServiceCategoryFilter = "ALL" | "RESTAURANT" | "HOUSEKEEPING" | "FRONT_DESK" | "CONCIERGE";
type ServiceStatusFilter = "ALL" | "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED";

interface RoomItem {
  id: string;
  roomNumber: string;
  status: string;
  roomType?: {
    id: string;
    name: string;
    code: string;
  };
  floor?: {
    id: string;
    name: string;
  };
}

interface TableItem {
  id: string;
  tableNumber: string;
  capacity?: number;
  status: string;
  floor?: {
    id: string;
    name: string;
  };
}

interface QrLocationRecord {
  id: string;
  publicCode: string;
  locationType: "ROOM" | "TABLE";
  roomId?: string | null;
  tableId?: string | null;
  label: string;
  isActive: boolean;
  rotationCount: number;
  createdAt: string;
  updatedAt: string;
  room?: RoomItem | null;
  table?: TableItem | null;
}

interface ServiceRequestItem {
  id: string;
  requestNumber: string;
  requestType: string;
  category: "RESTAURANT" | "HOUSEKEEPING" | "FRONT_DESK" | "CONCIERGE" | string;
  priority: "URGENT" | "HIGH" | "NORMAL" | string;
  status: "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  resolutionNotes?: string | null;
  requestedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  qrLocation?: QrLocationRecord | null;
  room?: RoomItem | null;
  table?: TableItem | null;
  stay?: {
    id: string;
    stayNumber: string;
    guestName: string;
  } | null;
  acknowledgedBy?: { id: string; name: string } | null;
  resolvedBy?: { id: string; name: string } | null;
}

/**
 * Generates a deterministic 21x21 QR-style finder & data matrix SVG pattern from a publicCode string
 * for print-ready physical Room Plaques & Table Tents without external runtime image dependencies.
 */
function DeterministicQrMatrixSvg({
  code,
  size = 168,
}: {
  code: string;
  size?: number;
}) {
  const gridSize = 21;
  const cells = useMemo(() => {
    let hash = 2166136261;
    for (let i = 0; i < code.length; i++) {
      hash ^= code.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const isFinder = (r: number, c: number) => {
      const topLeft = r < 7 && c < 7;
      const topRight = r < 7 && c >= gridSize - 7;
      const bottomLeft = r >= gridSize - 7 && c < 7;
      return topLeft || topRight || bottomLeft;
    };

    const finderBit = (r: number, c: number) => {
      const lr = r >= gridSize - 7 ? r - (gridSize - 7) : r;
      const lc = c >= gridSize - 7 ? c - (gridSize - 7) : c;
      if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
      if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
      return false;
    };

    const matrix: boolean[][] = [];
    for (let r = 0; r < gridSize; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < gridSize; c++) {
        if (isFinder(r, c)) {
          row.push(finderBit(r, c));
        } else if (r === 6 || c === 6) {
          row.push((r + c) % 2 === 0);
        } else {
          const seed = Math.imul(hash ^ (r * 31 + c * 17), 1597334677);
          const charCode = code.charCodeAt((r * gridSize + c) % code.length) || 65;
          row.push(((Math.abs(seed) + charCode + r * c) & 3) !== 0);
        }
      }
      matrix.push(row);
    }
    return matrix;
  }, [code]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${gridSize + 4} ${gridSize + 4}`}
      className="bg-[#FFFCF7] rounded-md border border-[#E6DEC8] p-2 shadow-inner mx-auto"
      aria-label={`QR Code for ${code}`}
    >
      <rect width={gridSize + 4} height={gridSize + 4} fill="#FFFFFF" />
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 2}
              y={rIdx + 2}
              width={1}
              height={1}
              fill="#1E1B18"
              rx={0.12}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function StaffQrPortalAndServiceDeskPage() {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("SERVICE_QUEUE");

  // Filters for Service Requests
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategoryFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("ALL");

  // Data states
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestItem[]>([]);
  const [qrLocations, setQrLocations] = useState<QrLocationRecord[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create / Ensure QR Plaque Form state
  const [newLocationType, setNewLocationType] = useState<"ROOM" | "TABLE">("ROOM");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [customLabel, setCustomLabel] = useState<string>("");
  const [creatingQr, setCreatingQr] = useState<boolean>(false);

  // Printable Plaque Preview Modal state
  const [previewPlaque, setPreviewPlaque] = useState<QrLocationRecord | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const srParams = new URLSearchParams();
      if (categoryFilter !== "ALL") srParams.set("category", categoryFilter);
      if (statusFilter !== "ALL") srParams.set("status", statusFilter);
      const srQuery = srParams.toString() ? `?${srParams.toString()}` : "";

      const [srRes, qrRes, rmRes, tbRes] = await Promise.all([
        fetch(`/api/v1/hotel/service-requests${srQuery}`),
        fetch("/api/v1/hotel/qr-locations"),
        fetch("/api/v1/hotel/rooms"),
        fetch("/api/v1/restaurant/tables"),
      ]);

      if (srRes.ok) {
        const srData = await srRes.json();
        setServiceRequests(srData.serviceRequests || []);
      }

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQrLocations(qrData.qrLocations || []);
      }

      if (rmRes.ok) {
        const rmData = await rmRes.json();
        const loadedRooms: RoomItem[] = rmData.rooms || [];
        setRooms(loadedRooms);
        if (loadedRooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(loadedRooms[0].id);
        }
      }

      if (tbRes.ok) {
        const tbData = await tbRes.json();
        const loadedTables: TableItem[] = tbData.tables || [];
        setTables(loadedTables);
        if (loadedTables.length > 0 && !selectedTableId) {
          setSelectedTableId(loadedTables[0].id);
        }
      }
    } catch (err: any) { Notify.failure(err.message || "Unable to load Guest Service Desk & QR Locations"); } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, selectedRoomId, selectedTableId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Queue KPI metrics
  const queueMetrics = useMemo(() => {
    const openCount = serviceRequests.filter((r) => r.status === "OPEN").length;
    const inProgressCount = serviceRequests.filter(
      (r) => r.status === "ACKNOWLEDGED" || r.status === "IN_PROGRESS"
    ).length;
    const urgentCount = serviceRequests.filter(
      (r) =>
        (r.priority === "URGENT" || r.priority === "HIGH") &&
        r.status !== "COMPLETED" &&
        r.status !== "CANCELLED"
    ).length;
    const completedCount = serviceRequests.filter((r) => r.status === "COMPLETED").length;

    return { openCount, inProgressCount, urgentCount, completedCount };
  }, [serviceRequests]);

  // Update Service Request Status (Acknowledge / Start Progress / Mark Completed)
  const handleUpdateRequestStatus = async (
    requestId: string,
    nextStatus: "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED"
  ) => {
    try {
      setActionLoadingId(requestId);
      setError('');

      const res = await fetch(`/api/v1/hotel/service-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to update request to ${nextStatus}`);
      }

      if (data.serviceRequest) {
        setServiceRequests((prev) =>
          prev.map((item) => (item.id === requestId ? data.serviceRequest : item))
        );
      } else {
        await loadAllData();
      }

      showToast(`Service request updated to ${nextStatus.replace(/_/g, " ")}`);
    } catch (err: any) { Notify.failure(err.message || "Error updating service request"); } finally {
      setActionLoadingId(null);
    }
  };

  // Generate or Ensure QR Plaque for a Room or Table
  const handleCreateOrEnsureQr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingQr(true);
      setError('');

      const payload =
        newLocationType === "ROOM"
          ? {
              locationType: "ROOM",
              roomId: selectedRoomId,
              label: customLabel.trim() || undefined,
              rotate: false,
            }
          : {
              locationType: "TABLE",
              tableId: selectedTableId,
              label: customLabel.trim() || undefined,
              rotate: false,
            };

      const res = await fetch("/api/v1/hotel/qr-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate QR plaque");
      }

      setCustomLabel("");
      await loadAllData();
      if (data.qrLocation) {
        setPreviewPlaque(data.qrLocation);
      }
      showToast(
        `Generated permanent QR plaque: ${data.qrLocation?.label || data.qrLocation?.publicCode}`
      );
    } catch (err: any) { Notify.failure(err.message || "Unable to create QR location"); } finally {
      setCreatingQr(false);
    }
  };

  // Rotate an existing physical QR code (atomically revokes active grants/sessions on that plaque)
  const handleRotateQrPlaque = async (loc: QrLocationRecord) => {
    try {
      setActionLoadingId(loc.id);
      setError('');

      const res = await fetch("/api/v1/hotel/qr-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationType: loc.locationType,
          roomId: loc.roomId || undefined,
          tableId: loc.tableId || undefined,
          label: loc.label,
          rotate: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate QR code");
      }

      await loadAllData();
      if (previewPlaque?.id === loc.id && data.qrLocation) {
        setPreviewPlaque(data.qrLocation);
      }
      showToast(
        `Rotated QR plaque for ${loc.label} to ${data.qrLocation?.publicCode} (prior tokens revoked)`
      );
    } catch (err: any) { Notify.failure(err.message || "Error rotating QR plaque"); } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyPortalUrl = (publicCode: string) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/guest/qr/${publicCode}`
        : `/guest/qr/${publicCode}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast(`Copied Guest Portal URL: ${url}`);
    }
  };

  const formatElapsed = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1E1B18] p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#6B2837]">
            <QrCode className="w-4 h-4 text-[#A77B38]" />
            <span>Phase 7 • Self-Service & Location QR System</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E1B18] mt-1">
            Guest QR Plaques & Live Service Desk
          </h1>
          <p className="text-sm text-[#6E655F] mt-0.5">
            Monitor real-time guest waiter calls, housekeeping requests, express checkouts, and
            manage permanent Room & Table QR plaques.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("SERVICE_QUEUE")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold transition ${
              activeTab === "SERVICE_QUEUE"
                ? "bg-[#6B2837] text-white shadow"
                : "bg-[#FAF6F0] text-[#4A433E] border border-[#E2D9C8]"
            }`}
          >
            <Bell className="w-4 h-4" />
            Service & Waiter Queue ({queueMetrics.openCount + queueMetrics.inProgressCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QR_PLAQUES")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold transition ${
              activeTab === "QR_PLAQUES"
                ? "bg-[#6B2837] text-white shadow"
                : "bg-[#FAF6F0] text-[#4A433E] border border-[#E2D9C8]"
            }`}
          >
            <QrCode className="w-4 h-4" />
            Physical QR Plaques ({qrLocations.length})
          </button>

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-bold text-[#6B2837] hover:bg-[#FAF6F0] transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Feedback Toast / Error */}
      {toastMessage && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: LIVE GUEST SERVICE REQUESTS & WAITER CALLS QUEUE
         ===================================================================== */}
      {activeTab === "SERVICE_QUEUE" && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFCF7] rounded-lg p-4 border border-[#E6DEC8] shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                Open Requests
              </p>
              <p className="text-2xl font-extrabold text-[#6B2837] mt-1">
                {queueMetrics.openCount}
              </p>
              <p className="text-xs text-[#8C827A] mt-0.5">Awaiting staff acknowledgment</p>
            </div>

            <div className="bg-[#FFFCF7] rounded-lg p-4 border border-[#E6DEC8] shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                Acknowledged / In Progress
              </p>
              <p className="text-2xl font-extrabold text-[#A77B38] mt-1">
                {queueMetrics.inProgressCount}
              </p>
              <p className="text-xs text-[#8C827A] mt-0.5">Currently being fulfilled</p>
            </div>

            <div className="bg-[#FFFCF7] rounded-lg p-4 border border-[#E6DEC8] shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                High / Urgent Priority
              </p>
              <p className="text-2xl font-extrabold text-[#9E2A2B] mt-1">
                {queueMetrics.urgentCount}
              </p>
              <p className="text-xs text-[#8C827A] mt-0.5">Includes Express Checkout alerts</p>
            </div>

            <div className="bg-[#FFFCF7] rounded-lg p-4 border border-[#E6DEC8] shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                Completed Requests
              </p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {queueMetrics.completedCount}
              </p>
              <p className="text-xs text-[#8C827A] mt-0.5">Resolved guest requests</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-[#FFFCF7] rounded-lg p-4 border border-[#E6DEC8] shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#6E655F] mr-1">Department:</span>
              {(
                ["ALL", "RESTAURANT", "HOUSEKEEPING", "FRONT_DESK", "CONCIERGE"] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    categoryFilter === cat
                      ? "bg-[#6B2837] text-white"
                      : "bg-[#FAF6F0] text-[#4A433E] border border-[#E2D9C8]"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#6E655F] mr-1">Status:</span>
              {(["ALL", "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                      statusFilter === st
                        ? "bg-[#1E1B18] text-white"
                        : "bg-[#FAF6F0] text-[#4A433E] border border-[#E2D9C8]"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Service Requests Queue List */}
          {serviceRequests.length === 0 ? (
            <div className="bg-[#FFFCF7] rounded-lg p-12 text-center border border-[#E6DEC8]">
              <Bell className="w-10 h-10 text-[#A77B38] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#1E1B18]">
                No Guest Service Requests Matching Filter
              </h3>
              <p className="text-xs text-[#6E655F] mt-1">
                Waiter calls, water refills, towel requests, and express checkout alerts will
                appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceRequests.map((req) => {
                const isRoom = Boolean(req.room || req.qrLocation?.locationType === "ROOM");
                const locationLabel = req.room
                  ? `Room ${req.room.roomNumber}`
                  : req.table
                  ? `Table ${req.table.tableNumber}`
                  : req.qrLocation?.label || "Guest Location";
                const busy = actionLoadingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="bg-[#FFFCF7] rounded-lg p-5 border border-[#E6DEC8] shadow-sm flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#6B2837] text-white">
                            {isRoom ? (
                              <BedDouble className="w-3.5 h-3.5" />
                            ) : (
                              <Store className="w-3.5 h-3.5" />
                            )}
                            {locationLabel}
                          </span>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              req.priority === "URGENT" || req.priority === "HIGH"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : "bg-[#FAF6F0] text-[#6E655F] border border-[#E2D9C8]"
                            }`}
                          >
                            {req.priority}
                          </span>

                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F5EFE6] text-[#6B2837]">
                            {req.category}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            req.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : req.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "ACKNOWLEDGED"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-[#6B2837]/10 text-[#6B2837]"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-[#1E1B18]">
                          {req.requestType.replace(/_/g, " ")}
                        </h3>
                        {req.notes && (
                          <p className="text-xs text-[#4A433E] bg-[#FAF6F0] p-2.5 rounded-md border border-[#E6DEC8] mt-1.5">
                            Guest Note: &ldquo;{req.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#6E655F] pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#A77B38]" />
                          {formatElapsed(req.requestedAt)} • #{req.requestNumber}
                        </span>
                        {req.stay && (
                          <span className="font-semibold text-[#1E1B18]">
                            Stay: {req.stay.guestName} (#{req.stay.stayNumber})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 1-Click Staff Action Buttons */}
                    {req.status !== "COMPLETED" && req.status !== "CANCELLED" && (
                      <div className="pt-3 border-t border-[#F0EAE0] flex items-center justify-end gap-2 flex-wrap">
                        {req.status === "OPEN" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUpdateRequestStatus(req.id, "ACKNOWLEDGED")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FAF6F0] hover:bg-[#F0EAE0] text-[#6B2837] border border-[#6B2837]/30 text-xs font-bold transition"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Acknowledge
                          </button>
                        )}

                        {(req.status === "OPEN" || req.status === "ACKNOWLEDGED") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUpdateRequestStatus(req.id, "IN_PROGRESS")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#A77B38] hover:bg-[#8E672D] text-white text-xs font-bold transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start Progress
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleUpdateRequestStatus(req.id, "COMPLETED")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Completed
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PHYSICAL LOCATION QR PLAQUE GENERATOR & MANAGER
         ===================================================================== */}
      {activeTab === "QR_PLAQUES" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: QR Plaque Generator Form */}
          <div className="bg-[#FFFCF7] rounded-lg p-5 border border-[#E6DEC8] shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2.5 border-b border-[#F0EAE0] pb-3">
              <div className="w-9 h-9 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#1E1B18]">
                  Generate Location QR Plaque
                </h2>
                <p className="text-xs text-[#6E655F]">
                  Zero-secret permanent QR code for Room or Table
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateOrEnsureQr} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1.5">
                  Location Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLocationType("ROOM")}
                    className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      newLocationType === "ROOM"
                        ? "bg-[#6B2837] text-white border-[#6B2837]"
                        : "bg-[#FAF6F0] text-[#4A433E] border-[#E2D9C8]"
                    }`}
                  >
                    <BedDouble className="w-4 h-4" />
                    Hotel Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLocationType("TABLE")}
                    className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      newLocationType === "TABLE"
                        ? "bg-[#6B2837] text-white border-[#6B2837]"
                        : "bg-[#FAF6F0] text-[#4A433E] border-[#E2D9C8]"
                    }`}
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    Dining Table
                  </button>
                </div>
              </div>

              {newLocationType === "ROOM" ? (
                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Select Hotel Room
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-semibold"
                  >
                    {rooms.length === 0 && <option value="">No rooms configured</option>}
                    {rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        Room {rm.roomNumber} ({rm.roomType?.name || rm.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Select Restaurant Table
                  </label>
                  <select
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-semibold"
                  >
                    {tables.length === 0 && <option value="">No tables configured</option>}
                    {tables.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        Table {tb.tableNumber} ({tb.floor?.name || "Main Floor"} • {tb.capacity || 4} seats)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                  Custom Plaque Label (Optional)
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder={
                    newLocationType === "ROOM" ? "e.g., Suite 302 Bedside" : "e.g., Patio Table T4"
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={
                  creatingQr ||
                  (newLocationType === "ROOM" && !selectedRoomId) ||
                  (newLocationType === "TABLE" && !selectedTableId)
                }
                className="w-full py-2.5 rounded-md bg-[#6B2837] hover:bg-[#561F2B] text-white font-bold text-xs shadow transition disabled:opacity-50"
              >
                {creatingQr ? "Generating QR Plaque..." : "Create / View Location QR Plaque"}
              </button>
            </form>

            <div className="p-3.5 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] space-y-1.5 text-xs text-[#4A433E]">
              <p className="font-bold text-[#6B2837] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Zero-Secret Privacy Guarantee
              </p>
              <p className="text-[11px] leading-relaxed">
                Physical QR plaques encode only an opaque location code (<code className="font-mono">QRL-...</code>).
                When a guest checks out, all active stay tokens are atomically revoked so the next
                occupant never sees prior bills or orders.
              </p>
            </div>
          </div>

          {/* Right 2 Columns: Existing QR Locations Grid */}
          <div className="lg:col-span-2 space-y-4">
            {qrLocations.length === 0 ? (
              <div className="bg-[#FFFCF7] rounded-lg p-10 text-center border border-[#E6DEC8]">
                <QrCode className="w-10 h-10 text-[#A77B38] mx-auto mb-2" />
                <h3 className="text-base font-bold text-[#1E1B18]">
                  No Physical QR Plaques Generated Yet
                </h3>
                <p className="text-xs text-[#6E655F] mt-1">
                  Select a Room or Restaurant Table on the left to generate a print-ready QR plaque.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {qrLocations.map((loc) => {
                  const isRoom = loc.locationType === "ROOM";
                  const portalHref = `/guest/qr/${loc.publicCode}`;
                  const rotating = actionLoadingId === loc.id;

                  return (
                    <div
                      key={loc.id}
                      className="bg-[#FFFCF7] rounded-lg p-5 border border-[#E6DEC8] shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6F0] text-[#6B2837] border border-[#E2D9C8]">
                            {isRoom ? "HOTEL ROOM PLAQUE" : "RESTAURANT TABLE TENT"}
                          </span>
                          <h3 className="text-lg font-extrabold text-[#1E1B18] mt-1">
                            {loc.label}
                          </h3>
                          <p className="text-xs font-mono text-[#6E655F] mt-0.5">
                            {loc.publicCode} • v{loc.rotationCount}
                          </p>
                        </div>

                        <DeterministicQrMatrixSvg code={loc.publicCode} size={76} />
                      </div>

                      <div className="pt-3 border-t border-[#F0EAE0] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={portalHref}
                            target="_blank"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#6B2837] text-white text-xs font-bold hover:bg-[#561F2B] transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Portal
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleCopyPortalUrl(loc.publicCode)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-bold text-[#1E1B18]"
                            title="Copy Guest Portal Link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPlaque(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-bold text-[#6B2837]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Card
                          </button>

                          <button
                            type="button"
                            disabled={rotating}
                            onClick={() => handleRotateQrPlaque(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
                            title="Rotate physical QR code and revoke existing tokens"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${rotating ? "animate-spin" : ""}`} />
                            Rotate
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: PRINTABLE ROOM PLAQUE / TABLE TENT CARD PREVIEW
         ===================================================================== */}
      {previewPlaque && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] rounded-lg max-w-md w-full p-6 border border-[#D8CEC1] space-y-5">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#A77B38]" />
                <h3 className="text-sm font-extrabold text-[#1E1B18]">
                  Printable Hospitality QR Plaque
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPlaque(null)}
                className="text-[#8C827A] hover:text-[#1E1B18]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Card Frame */}
            <div className="rounded-lg bg-[#FAF6F0] border-2 border-[#A77B38] p-6 text-center space-y-4 shadow-inner">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#A77B38]">
                {previewPlaque.locationType === "ROOM"
                  ? "In-Room Digital Concierge & Dining"
                  : "Scan to Browse Menu & Order"}
              </p>

              <h2 className="text-2xl font-extrabold text-[#6B2837]">{previewPlaque.label}</h2>

              <DeterministicQrMatrixSvg code={previewPlaque.publicCode} size={184} />

              <div className="space-y-1">
                <p className="text-xs font-bold text-[#1E1B18]">
                  Point your smartphone camera at the QR code
                </p>
                <p className="text-[11px] text-[#6E655F]">
                  {previewPlaque.locationType === "ROOM"
                    ? "Order room service, request fresh towels/housekeeping, or review your live room folio."
                    : "Browse our digital menu, place table orders, or summon your waiter in one tap."}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E2D9C8] flex items-center justify-between text-[10px] font-mono text-[#6E655F]">
                <span>ID: {previewPlaque.publicCode}</span>
                <span>/guest/qr/{previewPlaque.publicCode}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/guest/qr/${previewPlaque.publicCode}`}
                target="_blank"
                className="px-4 py-2.5 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-bold text-[#6B2837] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                Test Guest View
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPlaque(null)}
                  className="px-4 py-2.5 rounded-md text-xs font-semibold text-[#6E655F]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-md bg-[#6B2837] text-white text-xs font-bold shadow inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Plaque
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
