"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Plus } from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { SelectedModifier } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const DishModifierModal = React.memo(function DishModifierModal() {
  const show = usePosUiStore((s) => s.showModifierModal);
  const setShow = usePosUiStore((s) => s.setShowModifierModal);

  const activeItem = usePosCartStore((s) => s.activeCustomizingItem);
  const addToDraft = usePosCartStore((s) => s.addToDraft);

  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [dishNotes, setDishNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (activeItem) {
      // Pre-select defaults
      const defaults: SelectedModifier[] = [];
      (activeItem.modifierGroups || []).forEach((group) => {
        group.options.forEach((opt) => {
          if (opt.isDefault) {
            defaults.push({
              modifierGroupId: group.id,
              groupName: group.name,
              optionId: opt.id,
              optionName: opt.name,
              priceDelta: opt.priceDelta,
            });
          }
        });
      });
      setSelectedModifiers(defaults);
      setDishNotes("");
      setQuantity(1);
    }
  }, [activeItem]);

  if (!show || !activeItem) return null;

  const basePrice = Number(activeItem.basePrice) || 0;
  const modTotal = selectedModifiers.reduce((acc, m) => acc + (Number(m.priceDelta) || 0), 0);
  const unitPrice = basePrice + modTotal;
  const totalPrice = unitPrice * quantity;

  const handleToggleOption = (
    groupId: string,
    groupName: string,
    optId: string,
    optName: string,
    priceDelta: number,
    maxSelections: number
  ) => {
    setSelectedModifiers((prev) => {
      const isSelected = prev.some((m) => m.optionId === optId);
      if (isSelected) {
        return prev.filter((m) => m.optionId !== optId);
      }

      // If single-choice maxSelections === 1, replace previous selection in this group
      if (maxSelections === 1) {
        const otherGroups = prev.filter((m) => m.modifierGroupId !== groupId);
        return [
          ...otherGroups,
          {
            modifierGroupId: groupId,
            groupName,
            optionId: optId,
            optionName: optName,
            priceDelta,
          },
        ];
      }

      return [
        ...prev,
        {
          modifierGroupId: groupId,
          groupName,
          optionId: optId,
          optionName: optName,
          priceDelta,
        },
      ];
    });
  };

  const handleConfirm = () => {
    addToDraft(activeItem, quantity, selectedModifiers, dishNotes);
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#292320]">{activeItem.name}</h3>
            <p className="text-[11px] text-[#71675E]">
              Base Price: <span className="font-mono font-bold text-[#6B2837]">{formatNPR(basePrice)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {(activeItem.modifierGroups || []).map((group) => (
            <div key={group.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#292320]">{group.name}</span>
                <span className="text-[10px] text-[#71675E]">
                  {group.isRequired ? "Required" : "Optional"} • Max {group.maxSelections}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {group.options.map((opt) => {
                  const isChecked = selectedModifiers.some((m) => m.optionId === opt.id);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        handleToggleOption(
                          group.id,
                          group.name,
                          opt.id,
                          opt.name,
                          opt.priceDelta,
                          group.maxSelections
                        )
                      }
                      className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? "border-[#6B2837] bg-[#F8EEF0] text-[#6B2837] font-bold shadow-2xs"
                          : "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? "bg-[#6B2837] border-[#6B2837] text-white"
                              : "border-[#D8CEC1] bg-[#FFFCF7]"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{opt.name}</span>
                      </div>

                      {opt.priceDelta > 0 && (
                        <span className="text-[10px] font-mono text-[#71675E] ml-1 shrink-0">
                          +{formatNPR(opt.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Dish Instruction */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Kitchen Instruction</label>
            <input
              type="text"
              placeholder="e.g. Less oil, spicy, no coriander..."
              value={dishNotes}
              onChange={(e) => setDishNotes(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320]"
            />
          </div>
        </div>

        {/* Footer & Add Button */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] font-bold text-xs cursor-pointer"
            >
              -
            </button>
            <span className="w-8 text-center font-bold font-mono text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] font-bold text-xs cursor-pointer"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-9 px-4 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold flex items-center justify-between cursor-pointer shadow-xs transition-colors"
          >
            <span>Add to Order</span>
            <span className="font-mono tabular-nums">{formatNPR(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

