"use client";

import React from "react";
import { FolderTree, Edit2, Trash2, Plus } from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";
import { MenuSection } from "../../models/pos.types";

export const MenuCategoriesView: React.FC = () => {
  const sections = useRestaurantMenuStore((s) => s.sections);
  const items = useRestaurantMenuStore((s) => s.items);
  const openCreateSectionModal = useRestaurantMenuStore((s) => s.openCreateSectionModal);
  const openEditSectionModal = useRestaurantMenuStore((s) => s.openEditSectionModal);
  const deleteSection = useRestaurantMenuStore((s) => s.deleteSection);

  const handleDelete = async (section: MenuSection) => {
    if (window.confirm(`Delete section "${section.name}"? Dishes in this section will become uncategorized.`)) {
      await deleteSection(section.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-hidden">
        {sections.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#71675E] space-y-2">
            <FolderTree className="h-8 w-8 text-[#71675E]/40 mx-auto" />
            <p className="font-bold text-[#292320]">No menu categories configured</p>
            <p>Create categories like Appetizers, Signature Mains, Bar, and Desserts.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-center">Display Order</th>
                <th className="py-3 px-3 text-center">Dishes Count</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CEC1]/60">
              {sections.map((sec) => {
                const count = items.filter((i) => i.sectionId === sec.id).length;
                return (
                  <tr key={sec.id} className="hover:bg-[#F7F3EC]/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-xs text-[#292320]">
                      {sec.name}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[#71675E]">
                      {sec.description || "—"}
                    </td>
                    <td className="py-3 px-3 text-center font-mono tabular-nums text-[#71675E]">
                      {sec.displayOrder || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono text-xs font-bold text-[#6B2837] bg-[#F8EEF0] px-2 py-0.5 rounded border border-[#E9CDD3]">
                        {count} dishes
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditSectionModal(sec)}
                          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sec)}
                          className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

