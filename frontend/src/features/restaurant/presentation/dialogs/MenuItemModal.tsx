"use client";

import React, { useState, useEffect } from "react";
import { X, UtensilsCrossed, Save } from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";

export const MenuItemModal: React.FC = () => {
  const isItemModalOpen = useRestaurantMenuStore((s) => s.isItemModalOpen);
  const closeItemModal = useRestaurantMenuStore((s) => s.closeItemModal);
  const editingItem = useRestaurantMenuStore((s) => s.editingItem);
  const sections = useRestaurantMenuStore((s) => s.sections);
  const isSaving = useRestaurantMenuStore((s) => s.isSaving);
  const saveItem = useRestaurantMenuStore((s) => s.saveItem);

  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [taxRate, setTaxRate] = useState("13");
  const [prepTimeMinutes, setPrepTimeMinutes] = useState("15");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || "");
      setSectionId(editingItem.sectionId || sections[0]?.id || "");
      setBasePrice(editingItem.basePrice?.toString() || "");
      setTaxRate(editingItem.taxRate?.toString() || "13");
      setPrepTimeMinutes(editingItem.prepTimeMinutes?.toString() || "15");
      setDescription(editingItem.description || "");
      setImageUrl(editingItem.imageUrl || "");
      setIsAvailable(Boolean(editingItem.isAvailable));
    } else {
      setName("");
      setSectionId(sections[0]?.id || "");
      setBasePrice("");
      setTaxRate("13");
      setPrepTimeMinutes("15");
      setDescription("");
      setImageUrl("");
      setIsAvailable(true);
    }
    setError(null);
  }, [editingItem, sections, isItemModalOpen]);

  if (!isItemModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Dish name is required.");
      return;
    }
    const price = parseFloat(basePrice);
    if (isNaN(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    setError(null);
    const ok = await saveItem({
      name: name.trim(),
      sectionId: sectionId || undefined,
      basePrice: price,
      taxRate: parseFloat(taxRate) || 0,
      prepTimeMinutes: parseInt(prepTimeMinutes) || 15,
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      isAvailable,
    });

    if (!ok) {
      setError("Failed to save menu item. Please check your inputs.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingItem ? `Edit ${editingItem.name}` : "Create New Menu Dish"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Configure restaurant dish pricing, prep time, and category section
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeItemModal}
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
              Dish Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Royal Thakali Mutton Thali"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Menu Category Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">
                Selling Price (Rs.) <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Kitchen Prep Time (Minutes)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={prepTimeMinutes}
                onChange={(e) => setPrepTimeMinutes(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Tax Rate (% VAT)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Image URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Description</label>
            <textarea
              rows={2}
              placeholder="Ingredients, taste profile, allergens..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1]/50 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#292320]">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
              />
              <span>Available for ordering in POS</span>
            </label>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeItemModal}
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
              <span>{isSaving ? "Saving..." : editingItem ? "Update Dish" : "Create Dish"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

