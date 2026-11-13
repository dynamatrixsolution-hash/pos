"use client";

import React, { useEffect } from "react";
import { useRestaurantKdsStore } from "../state/restaurant-kds.store";
import { KdsHeader } from "./components/KdsHeader";
import { KdsTicketGrid } from "./components/KdsTicketGrid";
import { KdsCancelModal } from "./dialogs/KdsCancelModal";

export const KdsContainer: React.FC = () => {
  const loadKitchenData = useRestaurantKdsStore((s) => s.loadKitchenData);

  useEffect(() => {
    loadKitchenData();
    // 3-second live kitchen poll
    const interval = setInterval(() => {
      loadKitchenData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadKitchenData]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <KdsHeader />
      <KdsTicketGrid />
      <KdsCancelModal />
    </div>
  );
};

