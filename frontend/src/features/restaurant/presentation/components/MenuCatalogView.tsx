"use client";

import React, { useMemo } from "react";
import { Search, UtensilsCrossed, Plus, Sparkles } from "lucide-react";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { usePosUiStore } from "../../state/pos-ui.store";
import { MenuItemWithModifiers } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MenuCatalogView = React.memo(function MenuCatalogView() {
  const catalog = usePosCatalogStore((s) => s.catalog);
  const categories = usePosCatalogStore((s) => s.categories);
  const selectedParentCategory = usePosCatalogStore((s) => s.selectedParentCategory);
  const selectedSubcategoryId = usePosCatalogStore((s) => s.selectedSubcategoryId);
  const menuSearchQuery = usePosCatalogStore((s) => s.menuSearchQuery);

  const setSelectedParentCategory = usePosCatalogStore((s) => s.setSelectedParentCategory);
  const setSelectedSubcategoryId = usePosCatalogStore((s) => s.setSelectedSubcategoryId);
  const setMenuSearchQuery = usePosCatalogStore((s) => s.setMenuSearchQuery);

  const addToDraft = usePosCartStore((s) => s.addToDraft);
  const setActiveCustomizingItem = usePosCartStore((s) => s.setActiveCustomizingItem);
  const setShowModifierModal = usePosUiStore((s) => s.setShowModifierModal);

  // Available subcategories for selected category
  const activeSubcategories = useMemo(() => {
    if (selectedParentCategory === "ALL") return [];
    const cat = categories.find((c) => c.name === selectedParentCategory || c.id === selectedParentCategory);
    return cat?.subcategories || [];
  }, [categories, selectedParentCategory]);

  // Filtered dishes
  const filteredItems = useMemo(() => {
    return catalog.filter((item) => {
      if (selectedParentCategory !== "ALL" && item.categoryName !== selectedParentCategory) {
        return false;
      }
      if (selectedSubcategoryId !== "ALL" && item.subcategoryId !== selectedSubcategoryId) {
        return false;
      }
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase().trim();
        const n = item.name.toLowerCase();
        const c = (item.code || "").toLowerCase();
        if (!n.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, selectedParentCategory, selectedSubcategoryId, menuSearchQuery]);

  const handleAddItem = (item: MenuItemWithModifiers) => {
    if (item.hasModifiers && item.modifierGroups && item.modifierGroups.length > 0) {
      setActiveCustomizingItem(item);
      setShowModifierModal(true);
    } else {
      addToDraft(item, 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F7F3EC]/50 overflow-hidden">
      {/* Category Strip */}
      <div className="px-4 py-2 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setSelectedParentCategory("ALL")}
          className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedParentCategory === "ALL"
              ? "bg-[#6B2837] text-white shadow-2xs"
              : "border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" />
          <span>All Items</span>
        </button>

        {categories.map((cat: any) => (
          <button
            key={cat.id || cat.name}
            type="button"
            onClick={() => setSelectedParentCategory(cat.name)}
            className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedParentCategory === cat.name
                ? "bg-[#6B2837] text-white shadow-2xs"
                : "border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Subcategory Pills (if present) */}
      {activeSubcategories.length > 0 && (
        <div className="px-5 py-2 border-b border-[#D8CEC1]/60 bg-[#FFFCF7]/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setSelectedSubcategoryId("ALL")}
            className={`h-7 px-2.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedSubcategoryId === "ALL"
                ? "bg-[#292320] text-white shadow-2xs"
                : "border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD]"
            }`}
          >
            All ({filteredItems.length})
          </button>
          {activeSubcategories.map((sub: any) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubcategoryId(sub.id)}
              className={`h-7 px-2.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedSubcategoryId === sub.id
                  ? "bg-[#292320] text-white shadow-2xs"
                  : "border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD]"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Dishes Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FFFCF7]">
            <UtensilsCrossed className="h-10 w-10 text-[#71675E]/40 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#292320]">No dishes found</h4>
            <p className="text-xs text-[#71675E] mt-1">
              Try adjusting your category or search query above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 pb-8">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-3 flex flex-col justify-between space-y-2 hover:border-[#6B2837]/50 transition-all shadow-2xs"
              >
                {/* Dish Image */}
                <div className="h-28 rounded-lg bg-[#EEE7DD] overflow-hidden flex items-center justify-center relative">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="h-8 w-8 text-[#71675E]/30" />
                  )}
                </div>

                {/* Dish Info */}
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[#292320] truncate" title={item.name}>
                    {item.name}
                  </h4>
                  {item.categoryName && (
                    <p className="text-[10px] text-[#71675E] truncate">{item.categoryName}</p>
                  )}
                </div>

                {/* Price & Add Button */}
                <div className="flex items-center justify-between pt-1 border-t border-[#D8CEC1]/50">
                  <span className="text-xs font-black font-mono text-[#292320] tabular-nums">
                    {formatNPR(item.basePrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddItem(item)}
                    className="h-7 px-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="h-3 w-3 stroke-[2.5]" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

