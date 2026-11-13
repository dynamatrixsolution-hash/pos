"use client";

import React, { useEffect } from "react";
import { useRestaurantTablesStore } from "../state/restaurant-tables.store";

// Components
import { TablesManagerHeader } from "./components/TablesManagerHeader";
import { TablesManagerGrid } from "./components/TablesManagerGrid";

// Dialogs
import { RestaurantFloorModal } from "./dialogs/RestaurantFloorModal";
import { SpaceUnitModal } from "./dialogs/SpaceUnitModal";
import { SpaceQrModal } from "./dialogs/SpaceQrModal";

export const TableDesignerContainer: React.FC = () => {
  const loadTablesData = useRestaurantTablesStore((s) => s.loadTablesData);

  useEffect(() => {
    loadTablesData();
  }, [loadTablesData]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-4 text-[#292320]">
      {/* 1. Top Header with Floor & Area Filters */}
      <TablesManagerHeader />

      {/* 2. Interactive Dining Spaces Grid */}
      <main className="transition-all">
        <TablesManagerGrid />
      </main>

      {/* 3. Feature Modals */}
      <RestaurantFloorModal />
      <SpaceUnitModal />
      <SpaceQrModal />
    </div>
  );
};

