"use client";

import React, { useEffect } from "react";
import { useRestaurantMenuStore } from "../state/restaurant-menu.store";

// Components
import { MenuManagerHeader } from "./components/MenuManagerHeader";
import { MenuItemsView } from "./components/MenuItemsView";
import { MenuCategoriesView } from "./components/MenuCategoriesView";
import { MenuModifiersView } from "./components/MenuModifiersView";

// Dialogs
import { MenuItemModal } from "./dialogs/MenuItemModal";
import { MenuSectionModal } from "./dialogs/MenuSectionModal";
import { ModifierGroupModal } from "./dialogs/ModifierGroupModal";

export const MenuManagerContainer: React.FC = () => {
  const activeTab = useRestaurantMenuStore((s) => s.activeTab);
  const loadMenuData = useRestaurantMenuStore((s) => s.loadMenuData);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-4 text-[#292320]">
      {/* 1. Top Header with Navigation Tabs */}
      <MenuManagerHeader />

      {/* 2. Tab Views */}
      <main className="transition-all">
        {activeTab === "ITEMS" && <MenuItemsView />}
        {activeTab === "CATEGORIES" && <MenuCategoriesView />}
        {activeTab === "ADDONS" && <MenuModifiersView />}
      </main>

      {/* 3. Feature Modals */}
      <MenuItemModal />
      <MenuSectionModal />
      <ModifierGroupModal />
    </div>
  );
};

