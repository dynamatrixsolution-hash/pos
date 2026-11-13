"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  UtensilsCrossed,
  Search,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  BookOpen,
} from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";
import { MenuItemDetail } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MenuItemsView: React.FC = () => {
  const items = useRestaurantMenuStore((s) => s.items);
  const sections = useRestaurantMenuStore((s) => s.sections);
  const isLoading = useRestaurantMenuStore((s) => s.isLoading);
  const openEditItemModal = useRestaurantMenuStore((s) => s.openEditItemModal);
  const deleteItem = useRestaurantMenuStore((s) => s.deleteItem);
  const toggleAvailability = useRestaurantMenuStore((s) => s.toggleAvailability);
  const openRecipeModal = useRestaurantMenuStore((s) => s.openRecipeModal);

  const [search, setSearch] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("ALL");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedSectionId !== "ALL" && item.sectionId !== selectedSectionId) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (item.name || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [items, selectedSectionId, search]);

  const handleDelete = async (item: MenuItemDetail) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}" from the menu?`)) {
      await deleteItem(item.id);
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[#EEE7DD]/60 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Section Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        <div className="relative flex-1 sm:w-72">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search menu dishes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#71675E]">Section:</span>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Sections ({items.length})</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dishes Table */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#71675E] space-y-2">
            <UtensilsCrossed className="h-8 w-8 text-[#71675E]/40 mx-auto" />
            <p className="font-bold text-[#292320]">No menu dishes found</p>
            <p>Try clearing your search query or add a new menu dish.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Dish Details</th>
                  <th className="py-3 px-3">Section</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-center">Prep Time</th>
                  <th className="py-3 px-3 text-center">Availability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F7F3EC]/40 transition-colors group text-[#292320]"
                  >
                    {/* Dish Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] overflow-hidden shrink-0 relative flex items-center justify-center">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <UtensilsCrossed className="h-4 w-4 text-[#6B2837]" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#292320] group-hover:text-[#6B2837] transition-colors">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-[#71675E] truncate max-w-xs">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Section */}
                    <td className="py-3 px-3 text-[11px] text-[#71675E]">
                      {item.section?.name || "Uncategorized"}
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-xs text-[#6B2837] tabular-nums">
                      {formatNPR(item.basePrice)}
                      {Number(item.taxRate) > 0 && (
                        <span className="block text-[9px] font-sans text-[#71675E] font-normal">
                          +{item.taxRate}% VAT
                        </span>
                      )}
                    </td>

                    {/* Prep Time */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#71675E] bg-[#F7F3EC] px-2 py-0.5 rounded border border-[#D8CEC1]">
                        <Clock className="h-3 w-3" />
                        <span>{item.prepTimeMinutes || 15}m</span>
                      </span>
                    </td>

                    {/* Availability Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(item.id, !item.isAvailable)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          item.isAvailable
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {item.isAvailable ? (
                          <>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Available</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-2.5 w-2.5" />
                            <span>Sold Out</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          title="Edit Menu Item"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          title="Delete Menu Item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

