"use client";

import React, { useState } from "react";
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { useRestaurantKdsStore } from "../../state/restaurant-kds.store";

export const KdsHeader: React.FC = () => {
  const tickets = useRestaurantKdsStore((s) => s.tickets);
  const servedTickets = useRestaurantKdsStore((s) => s.servedTickets);
  const stations = useRestaurantKdsStore((s) => s.stations);
  const floors = useRestaurantKdsStore((s) => s.floors);

  const selectedStationId = useRestaurantKdsStore((s) => s.selectedStationId);
  const setSelectedStationId = useRestaurantKdsStore((s) => s.setSelectedStationId);
  const selectedFloorId = useRestaurantKdsStore((s) => s.selectedFloorId);
  const setSelectedFloorId = useRestaurantKdsStore((s) => s.setSelectedFloorId);
  const selectedOrderType = useRestaurantKdsStore((s) => s.selectedOrderType);
  const setSelectedOrderType = useRestaurantKdsStore((s) => s.setSelectedOrderType);

  const soundEnabled = useRestaurantKdsStore((s) => s.soundEnabled);
  const setSoundEnabled = useRestaurantKdsStore((s) => s.setSoundEnabled);
  const activeTab = useRestaurantKdsStore((s) => s.activeTab);
  const setActiveTab = useRestaurantKdsStore((s) => s.setActiveTab);
  const loadKitchenData = useRestaurantKdsStore((s) => s.loadKitchenData);
  const isLoading = useRestaurantKdsStore((s) => s.isLoading);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeCount = React.useMemo(() => {
    if (selectedStationId !== "ALL") {
      return tickets.filter((t) => t.stationId === selectedStationId).length;
    }
    return new Set(
      tickets.map((t) => `${t.order?.id || t.order?.orderNumber || t.id}_R${t.round?.roundNumber || 1}`)
    ).size;
  }, [tickets, selectedStationId]);

  const servedCount = React.useMemo(() => {
    if (selectedStationId !== "ALL") {
      return servedTickets.filter((t) => t.stationId === selectedStationId).length;
    }
    return new Set(
      servedTickets.map(
        (t) => `${t.order?.id || t.order?.orderNumber || t.id}_R${t.round?.roundNumber || 1}`
      )
    ).size;
  }, [servedTickets, selectedStationId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  return (
    <div className="rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 select-none text-xs">
      {/* Left: Active / Served Switcher + Compact Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center p-0.5 rounded-md border border-[#D8CEC1] bg-[#EEE7DD]">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`h-6 px-2.5 rounded text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
              activeTab === "ACTIVE"
                ? "bg-[#6B2837] text-[#FFFCF7]"
                : "text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SERVED")}
            className={`h-6 px-2.5 rounded text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
              activeTab === "SERVED"
                ? "bg-[#6B2837] text-[#FFFCF7]"
                : "text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Served ({servedCount})
          </button>
        </div>

        <select
          id="kds-station-filter"
          aria-label="Filter by station"
          value={selectedStationId}
          onChange={(e) => setSelectedStationId(e.target.value)}
          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Stations ({stations.length})</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          id="kds-floor-filter"
          aria-label="Filter by floor"
          value={selectedFloorId}
          onChange={(e) => setSelectedFloorId(e.target.value)}
          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Floors ({floors.length})</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center p-0.5 rounded-md border border-[#D8CEC1] bg-[#EEE7DD] text-[11px]">
          {[
            { id: "ALL", label: "All" },
            { id: "DINE_IN", label: "Dine-In" },
            { id: "TAKEAWAY", label: "Takeaway" },
            { id: "DELIVERY", label: "Delivery" },
          ].map((ot) => (
            <button
              key={ot.id}
              type="button"
              onClick={() => setSelectedOrderType(ot.id)}
              className={`h-6 px-2 rounded font-semibold transition-colors cursor-pointer ${
                selectedOrderType === ot.id
                  ? "bg-[#FFFCF7] text-[#292320]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              {ot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Compact Utility Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          title={soundEnabled ? "Sound On" : "Muted"}
          className={`h-7 px-2 rounded-md border transition-colors inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
            soundEnabled
              ? "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
              : "border-[#E9B6B7] bg-[#FAEAEC] text-[#B33432]"
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-[#28634B]" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{soundEnabled ? "Sound" : "Muted"}</span>
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] flex items-center justify-center transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => loadKitchenData()}
          aria-label="Refresh kitchen orders"
          title="Sync"
          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};
