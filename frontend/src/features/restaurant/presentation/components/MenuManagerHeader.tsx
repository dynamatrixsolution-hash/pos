"use client";

import React from "react";
import {
  UtensilsCrossed,
  FolderTree,
  Sliders,
  BookOpen,
  Plus,
} from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";

export const MenuManagerHeader: React.FC = () => {
  const activeTab = useRestaurantMenuStore((s) => s.activeTab);
  const setActiveTab = useRestaurantMenuStore((s) => s.setActiveTab);
  const items = useRestaurantMenuStore((s) => s.items);
  const sections = useRestaurantMenuStore((s) => s.sections);
  const modifierGroups = useRestaurantMenuStore((s) => s.modifierGroups);

  const openCreateItemModal = useRestaurantMenuStore((s) => s.openCreateItemModal);
  const openCreateSectionModal = useRestaurantMenuStore((s) => s.openCreateSectionModal);
  const openCreateModifierModal = useRestaurantMenuStore((s) => s.openCreateModifierModal);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">
            Restaurant Menu &amp; Recipe Master
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Configure menu dishes, sections, customer addons, cooking stations, and recipe food costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "ITEMS" && (
            <button
              type="button"
              onClick={openCreateItemModal}
              className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ New Menu Dish</span>
            </button>
          )}

          {activeTab === "CATEGORIES" && (
            <button
              type="button"
              onClick={openCreateSectionModal}
              className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ New Category</span>
            </button>
          )}

          {activeTab === "ADDONS" && (
            <button
              type="button"
              onClick={openCreateModifierModal}
              className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ New Modifier Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("ITEMS")}
          className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "ITEMS"
              ? "bg-[#6B2837] text-white shadow-2xs"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" />
          <span>Menu Dishes</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
              activeTab === "ITEMS" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
            }`}
          >
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CATEGORIES")}
          className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "CATEGORIES"
              ? "bg-[#6B2837] text-white shadow-2xs"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" />
          <span>Categories &amp; Sections</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
              activeTab === "CATEGORIES" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
            }`}
          >
            {sections.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ADDONS")}
          className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "ADDONS"
              ? "bg-[#6B2837] text-white shadow-2xs"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Modifiers &amp; Addons</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
              activeTab === "ADDONS" ? "bg-white/20 text-white" : "bg-[#EEE7DD] text-[#71675E]"
            }`}
          >
            {modifierGroups.length}
          </span>
        </button>
      </div>
    </div>
  );
};

