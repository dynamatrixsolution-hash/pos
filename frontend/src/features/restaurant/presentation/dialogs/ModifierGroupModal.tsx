"use client";

import React, { useState, useEffect } from "react";
import { X, Sliders, Plus, Trash2, Save } from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";
import { ModifierOption } from "../../models/pos.types";

export const ModifierGroupModal: React.FC = () => {
  const isModifierModalOpen = useRestaurantMenuStore((s) => s.isModifierModalOpen);
  const closeModifierModal = useRestaurantMenuStore((s) => s.closeModifierModal);
  const editingModifierGroup = useRestaurantMenuStore((s) => s.editingModifierGroup);
  const isSaving = useRestaurantMenuStore((s) => s.isSaving);
  const saveModifierGroup = useRestaurantMenuStore((s) => s.saveModifierGroup);

  const [name, setName] = useState("");
  const [minSelections, setMinSelections] = useState("0");
  const [maxSelections, setMaxSelections] = useState("1");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingModifierGroup) {
      setName(editingModifierGroup.name || "");
      setMinSelections(editingModifierGroup.minSelections?.toString() || "0");
      setMaxSelections(editingModifierGroup.maxSelections?.toString() || "1");
      setIsRequired(Boolean(editingModifierGroup.isRequired));
      setOptions(
        (editingModifierGroup.options || []).map((opt) => ({
          id: opt.id,
          name: opt.name,
          priceDelta: Number(opt.priceDelta) || 0,
        }))
      );
    } else {
      setName("");
      setMinSelections("0");
      setMaxSelections("1");
      setIsRequired(false);
      setOptions([
        { id: `opt-${Date.now()}-1`, name: "Mild", priceDelta: 0 },
        { id: `opt-${Date.now()}-2`, name: "Medium Spicy", priceDelta: 0 },
        { id: `opt-${Date.now()}-3`, name: "Very Spicy", priceDelta: 0 },
      ]);
    }
    setError(null);
  }, [editingModifierGroup, isModifierModalOpen]);

  if (!isModifierModalOpen) return null;

  const handleAddOption = () => {
    setOptions((prev) => [...prev, { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", priceDelta: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateOption = (index: number, field: keyof ModifierOption, val: any) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: val } : opt))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Modifier group name is required.");
      return;
    }
    if (options.length === 0 || options.some((o) => !o.name.trim())) {
      setError("Please ensure every option has a name.");
      return;
    }

    setError(null);
    const ok = await saveModifierGroup({
      name: name.trim(),
      minSelections: parseInt(minSelections) || 0,
      maxSelections: parseInt(maxSelections) || 1,
      isRequired,
      options: options.map((opt) => ({
        name: opt.name.trim(),
        priceDelta: Number(opt.priceDelta) || 0,
      })),
    });

    if (!ok) {
      setError("Failed to save modifier group.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingModifierGroup ? `Edit ${editingModifierGroup.name}` : "Create Modifier Group"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Add customer custom choices and add-on options
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModifierModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Group Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Spice Level, Meat Selection, Extra Toppings"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Minimum Selections</label>
              <input
                type="number"
                min="0"
                value={minSelections}
                onChange={(e) => setMinSelections(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#71675E]">Maximum Selections</label>
              <input
                type="number"
                min="1"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#292320]">Choice Options</label>
              <button
                type="button"
                onClick={handleAddOption}
                className="text-[11px] font-bold text-[#6B2837] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>+ Add Option</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Option name (e.g. Extra Cheese)"
                    value={opt.name}
                    onChange={(e) => handleUpdateOption(i, "name", e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Extra Rs."
                    value={opt.priceDelta}
                    onChange={(e) => handleUpdateOption(i, "priceDelta", parseFloat(e.target.value) || 0)}
                    className="w-24 text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                  />
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="p-1 rounded text-[#71675E] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModifierModal}
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
              <span>{isSaving ? "Saving..." : editingModifierGroup ? "Update Group" : "Create Group"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
