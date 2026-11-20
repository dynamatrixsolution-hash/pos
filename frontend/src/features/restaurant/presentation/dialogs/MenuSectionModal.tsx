"use client";

import React, { useState, useEffect } from "react";
import { X, FolderTree, Save } from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";

export const MenuSectionModal: React.FC = () => {
  const isSectionModalOpen = useRestaurantMenuStore((s) => s.isSectionModalOpen);
  const closeSectionModal = useRestaurantMenuStore((s) => s.closeSectionModal);
  const editingSection = useRestaurantMenuStore((s) => s.editingSection);
  const isSaving = useRestaurantMenuStore((s) => s.isSaving);
  const saveSection = useRestaurantMenuStore((s) => s.saveSection);

  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSection) {
      setName(editingSection.name || "");
      setDisplayOrder(editingSection.displayOrder?.toString() || "0");
      setDescription(editingSection.description || "");
    } else {
      setName("");
      setDisplayOrder("0");
      setDescription("");
    }
    setError(null);
  }, [editingSection, isSectionModalOpen]);

  if (!isSectionModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category section name is required.");
      return;
    }

    setError(null);
    const ok = await saveSection({
      name: name.trim(),
      displayOrder: parseInt(displayOrder) || 0,
    });

    if (!ok) {
      setError("Failed to save category section.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <FolderTree className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingSection ? `Edit ${editingSection.name}` : "Create Category Section"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Group menu items into catalog navigation tabs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSectionModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Category Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Signature Mains, Artisanal Bakery, Hot Beverages"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Display Sorting Order</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Description</label>
            <textarea
              rows={2}
              placeholder="Optional description for guest digital menu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeSectionModal}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : editingSection ? "Update Category" : "Create Category"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

