"use client";

import React, { useState } from "react";
import {
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  Building2,
  Store,
  Clock,
  CheckCircle2,
  Layers,
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
    const orderRounds = new Set(
      tickets.map((t) => `${t.order?.id || t.order?.orderNumber || t.id}_R${t.round?.roundNumber || 1}`)
    );
    return orderRounds.size;
  }, [tickets, selectedStationId]);

  const servedCount = React.useMemo(() => {
    if (selectedStationId !== "ALL") {
      return servedTickets.filter((t) => t.stationId === selectedStationId).length;
    }
    const orderRounds = new Set(
      servedTickets.map((t) => `${t.order?.id || t.order?.orderNumber || t.id}_R${t.round?.roundNumber || 1}`)
    );
    return orderRounds.size;
  }, [servedTickets, selectedStationId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="space-y-2.5 select-none">
      {/* 1. Main Kitchen Control Bar */}
      <div className="bg-[#FFFCF7] p-3 rounded-xl border border-[#D8CEC1] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Main Queue Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-[#D8CEC1]">
            <div className="p-1.5 rounded-lg bg-[#6B2837] text-white">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-black text-[#292320] leading-none">
                Kitchen Display
              </h1>
              <span className="text-[10px] text-[#71675E] font-medium">Station Queue</span>
            </div>
          </div>

          {/* Queue Mode Tabs */}
          <div className="h-8 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVE")}
              className={`h-full px-3 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ACTIVE"
                  ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Active Queue ({activeCount})</span>
              {activeCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("SERVED")}
              className={`h-full px-3 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "SERVED"
                  ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
              <span>Served ({servedCount})</span>
            </button>
          </div>
        </div>

        {/* Right: Station Hardware & Display Actions */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`h-8 px-2.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              soundEnabled
                ? "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
                : "border-red-200 bg-red-50 text-[#DC2626]"
            }`}
            title={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#2D6A4F]" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="text-[11px] hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Toggle Fullscreen Mode"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="text-[11px] hidden sm:inline">{isFullscreen ? "Exit Full" : "Expand"}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => loadKitchenData()}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
            title="Refresh kitchen orders immediately"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="text-[11px] hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Filter Strip */}
      <div className="px-3 py-2 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs text-xs">
        {/* Left: Station & Floor Dropdowns */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Station Selector */}
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="text-[11px] font-bold text-[#71675E]">Station:</span>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Stations ({stations.length})</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="text-[11px] font-bold text-[#71675E]">Floor:</span>
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
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

        {/* Right: Order Type Segmented Control */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-[#71675E] hidden sm:inline">Type:</span>
          <div className="h-7 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-[11px]">
            {[
              { id: "ALL", label: "All Types" },
              { id: "DINE_IN", label: "Dine-In", icon: Store },
              { id: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
              { id: "DELIVERY", label: "Delivery", icon: Truck },
            ].map((ot) => (
              <button
                key={ot.id}
                type="button"
                onClick={() => setSelectedOrderType(ot.id)}
                className={`h-full px-2.5 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  selectedOrderType === ot.id
                    ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
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
    </div>
  );
};


