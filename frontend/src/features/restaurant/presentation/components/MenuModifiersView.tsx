"use client";

import React from "react";
import { Sliders, Edit2, Trash2 } from "lucide-react";
import { useRestaurantMenuStore } from "../../state/restaurant-menu.store";
import { ModifierGroup } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MenuModifiersView: React.FC = () => {
  const modifierGroups = useRestaurantMenuStore((s) => s.modifierGroups);
  const openEditModifierModal = useRestaurantMenuStore((s) => s.openEditModifierModal);
  const deleteModifierGroup = useRestaurantMenuStore((s) => s.deleteModifierGroup);

  const handleDelete = async (group: ModifierGroup) => {
    if (window.confirm(`Delete modifier group "${group.name}"?`)) {
      await deleteModifierGroup(group.id);
    }
  };

  return (
    <div className="space-y-4">
      {modifierGroups.length === 0 ? (
        <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-12 text-center text-xs text-[#71675E] space-y-2">
          <Sliders className="h-8 w-8 text-[#71675E]/40 mx-auto" />
          <p className="font-bold text-[#292320]">No modifier addon groups configured</p>
          <p>Add options like Spice Level, Meat Choice, Side Dishes, and Extra Toppings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modifierGroups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-xs text-[#292320]">{group.name}</h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModifierModal(group)}
                      className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(group)}
                      className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#71675E]">
                  Selections: {group.minSelections} min — {group.maxSelections} max
                  {group.isRequired ? " (Required)" : " (Optional)"}
                </p>

                {/* Options List */}
                <div className="pt-2 border-t border-[#D8CEC1]/50 space-y-1">
                  {group.options?.map((opt, i) => (
                    <div
                      key={opt.id || i}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <span className="text-[#292320]">{opt.name}</span>
                      <span className="font-mono text-[11px] text-[#6B2837] font-semibold tabular-nums">
                        {Number(opt.priceDelta) > 0 ? `+${formatNPR(opt.priceDelta)}` : "Free"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

