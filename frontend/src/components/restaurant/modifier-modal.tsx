"use client";

import React, { useState, useMemo } from "react";
import { formatMoney, toCents, fromCents } from "@/lib/currency";

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

  // Flatten modifier groups (must be called before any conditional return to satisfy Rules of Hooks)
  const groups: ModifierGroupItem[] = useMemo(() => {
    if (!item) return [];
    return (item.modifierGroups || []).map((mg) => mg.modifierGroup);
  }, [item]);

  // Calculate pricing deltas
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

  // Handle option toggle
  const toggleOption = (group: ModifierGroupItem, option: ModifierOptionItem) => {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.includes(option.id);

      if (group.maxSelections === 1) {
        // Single select (radio behavior)
        return {
          ...prev,
          [group.id]: isSelected ? (group.minSelections === 0 ? [] : [option.id]) : [option.id],
        };
      } else {
        // Multi select (checkbox behavior)
        if (isSelected) {
          return { ...prev, [group.id]: current.filter((id) => id !== option.id) };
        } else {
          if (current.length >= group.maxSelections) return prev; // Limit reached
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-sandstone bg-porcelain shadow-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sandstone px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-espresso">{item.name}</h3>
            <p className="text-xs text-warmgray">Base Price: {formatMoney(item.basePrice)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-warmgray hover:bg-warmstone hover:text-espresso transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modifier Groups */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-warmgray italic">No modifier options for this item.</p>
          ) : (
            groups.map((group) => {
              const selectedIds = selectedOptions[group.id] || [];
              const isSatisfied = selectedIds.length >= group.minSelections;

              return (
                <div key={group.id} className="rounded-lg border border-sandstone/80 bg-warmivory/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-espresso">
                      {group.displayName || group.name}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        isSatisfied
                          ? "bg-forest-bg text-forest border-forest-border"
                          : "bg-ochre-bg text-ochre border-ochre-border"
                      }`}
                    >
                      {group.minSelections > 0
                        ? `Required (${group.minSelections}${group.maxSelections > 1 ? `-${group.maxSelections}` : ""})`
                        : `Optional (up to ${group.maxSelections})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {group.options.map((option) => {
                      const isSelected = selectedIds.includes(option.id);
                      const deltaCents = toCents(option.priceDelta);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(group, option)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-all ${
                            isSelected
                              ? "border-burgundy bg-burgundy/5 text-burgundy font-medium shadow-xs"
                              : "border-sandstone bg-porcelain text-espresso hover:border-sandstone/80 hover:bg-warmstone/40"
                          }`}
                        >
                          <span className="truncate pr-1">{option.name}</span>
                          <span className="text-[11px] whitespace-nowrap text-warmgray">
                            {deltaCents === 0 ? "Free" : `+${formatMoney(option.priceDelta)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Special Kitchen Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-espresso">Special Kitchen Instructions</label>
            <input
              type="text"
              placeholder="e.g. Less spicy, dressing on side"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-sandstone bg-porcelain px-3 py-2 text-espresso placeholder:text-warmgray/60 focus:border-burgundy focus:outline-none"
            />
          </div>
        </div>

        {/* Footer with Quantity & Total Button */}
        <div className="border-t border-sandstone bg-warmstone/30 px-4 py-3 flex items-center justify-between gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center rounded-lg border border-sandstone bg-porcelain">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-1.5 text-sm font-semibold text-espresso hover:bg-warmstone transition-colors"
            >
              -
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-espresso tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="px-3 py-1.5 text-sm font-semibold text-espresso hover:bg-warmstone transition-colors"
            >
              +
            </button>
          </div>

          {/* Add to Round Button */}
          <button
            type="button"
            disabled={!isValid}
            onClick={handleConfirm}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold text-porcelain transition-all flex items-center justify-between shadow-xs ${
              isValid
                ? "bg-burgundy hover:bg-burgundy-hover cursor-pointer"
                : "bg-sandstone text-warmgray cursor-not-allowed"
            }`}
          >
            <span>Add to Order Round</span>
            <span className="tabular-nums font-bold">{formatMoney(totalStr)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

