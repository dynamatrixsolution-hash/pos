"use client";

import React, { useEffect } from "react";
import { useHotelStaysStore } from "../state/hotel-stays.store";

// Components
import { StaysHeader } from "./components/StaysHeader";
import { StaysTable } from "./components/StaysTable";

// Dialogs
import { TransferRoomModal } from "./dialogs/TransferRoomModal";
import { ExtendStayModal } from "./dialogs/ExtendStayModal";
import { CheckOutModal } from "./dialogs/CheckOutModal";
import { FastCheckInModal } from "./dialogs/FastCheckInModal";

export const StaysContainer: React.FC = () => {
  const loadStays = useHotelStaysStore((s) => s.loadStays);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-5 text-[#292320]">
      {/* 1. Header with Filters & Actions */}
      <StaysHeader />

      {/* 2. Stays Data Table */}
      <main className="transition-all">
        <StaysTable />
      </main>

      {/* 3. Dialogs */}
      <TransferRoomModal />
      <ExtendStayModal />
      <CheckOutModal />
      <FastCheckInModal />
    </div>
  );
};

