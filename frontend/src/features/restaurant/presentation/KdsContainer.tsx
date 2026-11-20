"use client";

import React, { useEffect } from "react";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";
import { useRestaurantKdsStore } from "../state/restaurant-kds.store";
import { KdsHeader } from "./components/KdsHeader";
import { KdsTicketGrid } from "./components/KdsTicketGrid";
import { KdsCancelModal } from "./dialogs/KdsCancelModal";

export const KdsContainer: React.FC = () => {
  const loadKitchenData = useRestaurantKdsStore((s) => s.loadKitchenData);

  useEffect(() => {
    loadKitchenData(true);
  }, [loadKitchenData]);

  // 3-second visibility-aware poll for tickets only (avoids re-fetching static stations/floors)
  useVisibilityPolling(() => loadKitchenData(false), 3000);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <KdsHeader />
      <KdsTicketGrid />
      <KdsCancelModal />
    </div>
  );
};

