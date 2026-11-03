"use client";

import React, { useState, useMemo } from "react";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import { X, Plus, Minus } from "lucide-react";

export interface ModifierOptionItem {
  id: string;
  name: string;
  priceDelta: string | number;
  isAvailable?: boolean;
}

export interface ModifierGroupItem {
  id: string;
  name: string;
  displayName?: string | null;
  minSelections: number;
  maxSelections: number;
  options: ModifierOptionItem[];
}

export interface MenuItemWithModifiers {
  id: string;
  name: string;
  description?: string | null;
  basePrice: string | number;
  modifierGroups?: {
    modifierGroup: ModifierGroupItem;
  }[];
}

export interface SelectedModifier {
  modifierGroupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: string | number;
}

interface ModifierModalProps {
  item: MenuItemWithModifiers | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    item: MenuItemWithModifiers;
    quantity: number;
    selectedModifiers: SelectedModifier[];
    notes: string;
    unitPrice: string;
    totalPrice: string;
  }) => void;
}

export function ModifierModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: ModifierModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");

  const groups: ModifierGroupItem[] = useMemo(() => {
    if (!item) return [];
    return (item.modifierGroups || []).map((mg) => mg.modifierGroup);
  }, [item]);

  const { unitPriceStr, totalStr, isValid } = useMemo(() => {
    if (!item) {
      return { unitPriceStr: "0.00", totalStr: "0.00", isValid: false };
    }
    let baseCents = toCents(item.basePrice);
    let deltaCents = 0;
    let valid = true;

    for (const group of groups) {
      const selected = selectedOptions[group.id] || [];
      if (selected.length < group.minSelections) {
        valid = false;
      }
      for (const optId of selected) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          deltaCents += toCents(opt.priceDelta);
        }
      }
    }

    const unitCents = baseCents + deltaCents;
    const totalCents = unitCents * quantity;

    return {
      unitPriceStr: fromCents(unitCents),
      totalStr: fromCents(totalCents),
      isValid: valid,
    };
  }, [item, groups, selectedOptions, quantity]);

  if (!isOpen || !item) return null;

  const toggleOption = (group: ModifierGroupItem, option: ModifierOptionItem) => {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.includes(option.id);

      if (group.maxSelections === 1) {
        return {
          ...prev,
          [group.id]: isSelected ? (group.minSelections === 0 ? [] : [option.id]) : [option.id],
        };
      } else {
        if (isSelected) {
          return { ...prev, [group.id]: current.filter((id) => id !== option.id) };
        } else {
          if (current.length >= group.maxSelections) return prev;
          return { ...prev, [group.id]: [...current, option.id] };
        }
      }
    });
  };

  const handleConfirm = () => {
    if (!isValid) return;

    const selectedModifiers: SelectedModifier[] = [];
    for (const group of groups) {
      const selected = selectedOptions[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          selectedModifiers.push({
            modifierGroupId: group.id,
            groupName: group.displayName || group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }

    onConfirm({
      item,
      quantity,
      selectedModifiers,
      notes,
      unitPrice: unitPriceStr,
      totalPrice: totalStr,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-3">
      <div className="w-full max-w-md rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col max-h-[85vh] shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] px-3.5 py-2 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-[#292320] leading-tight">{item.name}</h3>
            <p className="text-[10px] text-[#71675E] font-mono tabular-nums leading-none mt-0.5">
              Base Price: {formatNPR(item.basePrice)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modifier Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {groups.length === 0 ? (
            <p className="text-xs text-[#71675E] text-center py-4">No modifier options configured.</p>
          ) : (
            groups.map((group) => {
              const selectedIds = selectedOptions[group.id] || [];
              const isSatisfied = selectedIds.length >= group.minSelections;

              return (
                <div key={group.id} className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC]/50 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#292320]">
                      {group.displayName || group.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                        isSatisfied
                          ? "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]"
                          : "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                      }`}
                    >
                      {group.minSelections > 0
                        ? `Required (${group.minSelections}${group.maxSelections > 1 ? `-${group.maxSelections}` : ""})`
                        : `Optional (up to ${group.maxSelections})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {group.options.map((option) => {
                      const isSelected = selectedIds.includes(option.id);
                      const deltaCents = toCents(option.priceDelta);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(group, option)}
                          className={`flex items-center justify-between p-2 rounded-md border text-xs text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "border-[#6B2837] bg-[#6B2837]/10 text-[#6B2837] font-semibold"
                              : "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD]"
                          }`}
                        >
                          <span className="truncate pr-1 text-[11px]">{option.name}</span>
                          <span className="text-[10px] whitespace-nowrap font-mono tabular-nums text-[#71675E]">
                            {deltaCents === 0 ? "Free" : `+${formatNPR(option.priceDelta)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Kitchen Notes */}
          <div className="space-y-1 pt-1">
            <label className="text-[10px] font-bold text-[#292320] uppercase tracking-wider block">
              Kitchen Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Less spicy, dressing on side"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2.5 py-1 text-[#292320] placeholder:text-[#71675E] focus:border-[#6B2837] focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#D8CEC1] bg-[#EEE7DD]/40 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          {/* Quantity Controls */}
          <div className="flex items-center rounded-md border border-[#D8CEC1] bg-[#FFFCF7]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="p-1 text-[#292320] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-2.5 text-xs font-bold font-mono tabular-nums text-[#292320]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="p-1 text-[#292320] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add to Round Button */}
          <button
            type="button"
            disabled={!isValid}
            onClick={handleConfirm}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold text-white transition-colors flex items-center justify-between ${
              isValid
                ? "bg-[#6B2837] hover:bg-[#541E2A] cursor-pointer"
                : "bg-[#D8CEC1] text-[#71675E] cursor-not-allowed"
            }`}
          >
            <span>Add to Order Round</span>
            <span className="font-mono tabular-nums font-bold">{formatNPR(totalStr)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
