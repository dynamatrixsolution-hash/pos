"use client";

import React, { useState, useEffect } from "react";
import { useHotelQrPortalStore } from "../state/hotel-qr-portal.store";
import {
  QrCode,
  BellRing,
  Plus,
  RefreshCw,
  X,
  Loader2,
  ExternalLink,
  Copy,
  RotateCcw,
  CheckCircle2,
  Clock,
  BedDouble,
  UtensilsCrossed,
} from "lucide-react";
import { DeterministicQrMatrixSvg } from "@/components/qr-matrix-svg";
import { Notify } from "@/lib/notify";

const CATEGORIES = ["ALL", "RESTAURANT", "HOUSEKEEPING", "FRONT_DESK", "CONCIERGE"] as const;
const STATUSES = ["ALL", "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"] as const;

export function QrPortalContainer() {
  const {
    consoleTab,
    serviceCategory,
    serviceStatus,
    serviceRequests,
    qrLocations,
    rooms,
    tables,
    loading,
    actionLoadingId,
    setConsoleTab,
    setServiceCategory,
    setServiceStatus,
    loadAll,
    updateRequestStatus,
    createQrLocation,
    rotateQrLocation,
  } = useHotelQrPortalStore();

  // New QR Location Modal
  const [showNewQrModal, setShowNewQrModal] = useState(false);
  const [locType, setLocType] = useState<"ROOM" | "TABLE">("ROOM");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label) return;
    const payload = {
      locationType: locType,
      roomId: locType === "ROOM" ? targetId || undefined : undefined,
      tableId: locType === "TABLE" ? targetId || undefined : undefined,
      label,
    };
    const success = await createQrLocation(payload);
    if (success) {
      setShowNewQrModal(false);
      setLabel("");
      setTargetId("");
    }
  };

  const copyGuestUrl = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/guest/qr/${code}`;
    navigator.clipboard.writeText(url);
    Notify.success("Guest URL copied to clipboard");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]";
      case "ACKNOWLEDGED":
      case "IN_PROGRESS":
        return "bg-[#FDF6E9] text-[#946000] border-[#EDD7AD]";
      case "COMPLETED":
        return "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]";
      default:
        return "bg-[#F7F3EC] text-[#71675E] border-[#EEE7DD]";
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">QR Portal & Guest Services</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Contactless room & table digital dining, requests queue & cryptographic plaques
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewQrModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Generate Plaque
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEE7DD] pb-2">
        <button
          onClick={() => setConsoleTab("SERVICE_QUEUE")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            consoleTab === "SERVICE_QUEUE"
              ? "bg-[#6B2837] text-white"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <BellRing className="h-3.5 w-3.5" />
          Live Request Queue ({serviceRequests.length})
        </button>
        <button
          onClick={() => setConsoleTab("QR_PLAQUES")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            consoleTab === "QR_PLAQUES"
              ? "bg-[#6B2837] text-white"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          Active QR Plaques ({qrLocations.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading QR portal records...
        </div>
      ) : consoleTab === "SERVICE_QUEUE" ? (
        <div className="space-y-4">
          {/* Sub Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFCF7] p-3 border border-[#EEE7DD] rounded-lg">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-[#71675E] mr-2">Category:</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setServiceCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    serviceCategory === cat
                      ? "bg-[#6B2837] text-white"
                      : "text-[#71675E] hover:bg-[#F7F3EC]"
                  }`}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-[#71675E] mr-2">Status:</span>
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => setServiceStatus(st)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    serviceStatus === st
                      ? "bg-[#292320] text-white"
                      : "text-[#71675E] hover:bg-[#F7F3EC]"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {serviceRequests.length === 0 ? (
            <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
              <BellRing className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-[#292320]">No active requests</h3>
              <p className="text-xs text-[#71675E] mt-1">Guest QR inquiries will populate here in real-time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-4 space-y-3 shadow-sm hover:border-[#6B2837]/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-xs text-[#292320]">{req.requestType}</div>
                      <div className="text-[11px] text-[#71675E]">
                        Req #{req.requestNumber} • {req.category}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </div>

                  {req.notes && (
                    <div className="bg-[#F7F3EC] p-2.5 rounded text-xs text-[#292320] border border-[#EEE7DD]">
                      &ldquo;{req.notes}&rdquo;
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#71675E] pt-2 border-t border-[#EEE7DD]">
                    <span>{new Date(req.requestedAt).toLocaleTimeString()}</span>
                    <div className="flex items-center gap-1.5">
                      {req.status === "OPEN" && (
                        <button
                          onClick={() => updateRequestStatus(req.id, "ACKNOWLEDGED")}
                          disabled={actionLoadingId === req.id}
                          className="px-2 py-1 text-[11px] font-semibold text-[#946000] bg-[#FDF6E9] hover:bg-[#FCEBD0] border border-[#EDD7AD] rounded"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(req.status === "OPEN" || req.status === "ACKNOWLEDGED") && (
                        <button
                          onClick={() => updateRequestStatus(req.id, "COMPLETED")}
                          disabled={actionLoadingId === req.id}
                          className="px-2 py-1 text-[11px] font-semibold text-[#28634B] bg-[#EBF4F0] hover:bg-[#DAEFE4] border border-[#C3DED0] rounded"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* QR Plaques Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrLocations.map((loc) => {
            const guestUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/guest/qr/${loc.publicCode}`;
            return (
              <div
                key={loc.id}
                className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-4 space-y-3 flex flex-col items-center text-center shadow-sm"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-semibold text-[#71675E] uppercase tracking-wider">
                    {loc.locationType}
                  </span>
                  <span className="text-[10px] text-[#71675E]">v{loc.rotationCount || 1}</span>
                </div>

                <div className="p-3 bg-white border border-[#EEE7DD] rounded-lg shadow-sm">
                  <DeterministicQrMatrixSvg value={guestUrl} size={130} />
                </div>

                <div>
                  <h4 className="font-bold text-xs text-[#292320]">{loc.label}</h4>
                  <p className="text-[11px] font-mono text-[#71675E]">{loc.publicCode}</p>
                </div>

                <div className="flex items-center gap-1.5 w-full pt-2 border-t border-[#EEE7DD]">
                  <button
                    onClick={() => copyGuestUrl(loc.publicCode)}
                    className="flex-1 py-1.5 px-2 text-[11px] font-medium text-[#292320] bg-[#F7F3EC] hover:bg-[#EEE7DD] rounded border border-[#EEE7DD] flex items-center justify-center gap-1"
                    title="Copy URL"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                  <button
                    onClick={() => rotateQrLocation(loc.id)}
                    disabled={actionLoadingId === loc.id}
                    className="p-1.5 text-[#71675E] hover:text-[#6B2837] hover:bg-[#F7F3EC] rounded border border-[#EEE7DD]"
                    title="Rotate Key"
                  >
                    <RotateCcw className={`h-3 w-3 ${actionLoadingId === loc.id ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New QR Plaque Modal */}
      {showNewQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">Generate Digital Plaque</h3>
              <button onClick={() => setShowNewQrModal(false)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQr} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocType("ROOM");
                    setTargetId("");
                  }}
                  className={`p-2.5 rounded border text-center flex flex-col items-center gap-1 font-semibold ${
                    locType === "ROOM"
                      ? "bg-[#6B2837] text-white border-[#6B2837]"
                      : "bg-[#F7F3EC] text-[#292320] border-[#EEE7DD]"
                  }`}
                >
                  <BedDouble className="h-4 w-4" />
                  Hotel Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocType("TABLE");
                    setTargetId("");
                  }}
                  className={`p-2.5 rounded border text-center flex flex-col items-center gap-1 font-semibold ${
                    locType === "TABLE"
                      ? "bg-[#6B2837] text-white border-[#6B2837]"
                      : "bg-[#F7F3EC] text-[#292320] border-[#EEE7DD]"
                  }`}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Restaurant Table
                </button>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">
                  Select {locType === "ROOM" ? "Room" : "Table"} (Optional Link)
                </label>
                {locType === "ROOM" ? (
                  <select
                    value={targetId}
                    onChange={(e) => {
                      setTargetId(e.target.value);
                      const rm = rooms.find((r) => r.id === e.target.value);
                      if (rm) setLabel(`Room ${rm.roomNumber}`);
                    }}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="">No Direct Room Link</option>
                    {rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        Room {rm.roomNumber} ({rm.roomType?.name || "Room"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={targetId}
                    onChange={(e) => {
                      setTargetId(e.target.value);
                      const tbl = tables.find((t) => t.id === e.target.value);
                      if (tbl) setLabel(`Table ${tbl.tableNumber}`);
                    }}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="">No Direct Table Link</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.tableNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Plaque Label *</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Presidential Suite 401 or Rooftop Table 12"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setShowNewQrModal(false)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === "new-qr"}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {actionLoadingId === "new-qr" ? "Creating..." : "Generate Plaque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
