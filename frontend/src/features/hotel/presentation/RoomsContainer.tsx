"use client";

import React, { useEffect } from "react";
import { useHotelUiStore } from "../state/hotel-ui.store";
import { useHotelRoomsStore } from "../state/hotel-rooms.store";

// Components
import { RoomsHeader } from "./components/RoomsHeader";
import { FloorRoomsView } from "./components/FloorRoomsView";
import { RoomRackView } from "./components/RoomRackView";
import { TapeChartTimeline } from "./components/TapeChartTimeline";
import { RoomTypesManager } from "./components/RoomTypesManager";
import { FloorsManager } from "./components/FloorsManager";

// Dialogs
import { FastCheckInModal } from "./dialogs/FastCheckInModal";
import { RoomModal } from "./dialogs/RoomModal";
import { RoomTypeModal } from "./dialogs/RoomTypeModal";
import { FloorModal } from "./dialogs/FloorModal";
import { HousekeepingModal } from "./dialogs/HousekeepingModal";
import { RoomQrModal } from "./dialogs/RoomQrModal";

export const RoomsContainer: React.FC = () => {
  const viewMode = useHotelUiStore((s) => s.viewMode);
  const loadInitialData = useHotelRoomsStore((s) => s.loadInitialData);
  const refreshRooms = useHotelRoomsStore((s) => s.refreshRooms);

  useEffect(() => {
    loadInitialData();

    // 10-second silent background poll for room status updates
    const interval = setInterval(() => {
      refreshRooms();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadInitialData, refreshRooms]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F7F3EC] text-[#292320]">
      {/* 1. Header with Stats & Actions */}
      <RoomsHeader />

      {/* 2. Main Content View */}
      <main className="relative flex-1 overflow-hidden flex flex-col">
        {viewMode === "FLOOR_VIEW" && <FloorRoomsView />}
        {viewMode === "ROOM_RACK" && <RoomRackView />}
        {viewMode === "TAPE_CHART" && <TapeChartTimeline />}
        {viewMode === "ROOM_TYPES" && <RoomTypesManager />}
        {viewMode === "FLOORS" && <FloorsManager />}
      </main>

      {/* 3. Dialogs */}
      <FastCheckInModal />
      <RoomModal />
      <RoomTypeModal />
      <FloorModal />
      <HousekeepingModal />
      <RoomQrModal />
    </div>
  );
};

