"use client";

import React, { useState } from "react";
import {
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Store,
  ShoppingBag,
  Truck,
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
    <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] divide-y divide-[#D8CEC1] select-none">
      {/* Row 1: Title, Active/Served Tabs & Controls */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 pr-3 border-r border-[#D8CEC1]">
            <div className="p-1.5 rounded-md bg-[#6B2837] text-[#FFFCF7]">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#292320] leading-tight">Kitchen Display</h1>
              <span className="text-[11px] text-[#71675E]">Live Orders</span>
            </div>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVE")}
              className={`h-7 px-3 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 tabular-nums ${
                activeTab === "ACTIVE"
                  ? "bg-[#FFFCF7] text-[#6B2837] border border-[#D8CEC1]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Active Orders ({activeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("SERVED")}
              className={`h-7 px-3 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 tabular-nums ${
                activeTab === "SERVED"
                  ? "bg-[#FFFCF7] text-[#6B2837] border border-[#D8CEC1]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#28634B]" />
              <span>Served ({servedCount})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`h-8 px-2.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              soundEnabled
                ? "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
                : "border-[#E9B6B7] bg-[#FAEAEC] text-[#B33432]"
            }`}
            title={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-[#28634B]" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Full" : "Expand"}</span>
          </button>

          <button
            type="button"
            onClick={() => loadKitchenData()}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
            title="Refresh kitchen orders"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Row 2: Filters */}
      <div className="px-3.5 py-2 bg-[#F7F3EC]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label htmlFor="kds-station-filter" className="text-[11px] font-semibold text-[#71675E]">
              Station:
            </label>
            <select
              id="kds-station-filter"
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Stations ({stations.length})</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="kds-floor-filter" className="text-[11px] font-semibold text-[#71675E]">
              Floor:
            </label>
            <select
              id="kds-floor-filter"
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Floors ({floors.length})</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="inline-flex items-center p-0.5 rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] text-[11px]">
          {[
            { id: "ALL", label: "All" },
            { id: "DINE_IN", label: "Dine-In", icon: Store },
            { id: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
            { id: "DELIVERY", label: "Delivery", icon: Truck },
          ].map((ot) => (
            <button
              key={ot.id}
              type="button"
              onClick={() => setSelectedOrderType(ot.id)}
              className={`h-6 px-2.5 rounded-md font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer ${
                selectedOrderType === ot.id
                  ? "bg-[#FFFCF7] text-[#6B2837] border border-[#D8CEC1]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              {ot.icon && <ot.icon className="h-3 w-3" />}
              <span>{ot.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
