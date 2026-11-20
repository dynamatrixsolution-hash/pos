"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import { BomIngredient, KITCHEN_UNITS } from "../../models/product.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const RecipeBomModal: React.FC = () => {
  const isBomModalOpen = useProductsUiStore((s) => s.isBomModalOpen);
  const closeBomModal = useProductsUiStore((s) => s.closeBomModal);
  const activeBomProduct = useProductsUiStore((s) => s.activeBomProduct);

  const products = useProductsStore((s) => s.products);
  const bomIngredients = useProductsStore((s) => s.bomIngredients);
  const isLoadingBom = useProductsStore((s) => s.isLoadingBom);
  const isSavingBom = useProductsStore((s) => s.isSavingBom);
  const loadBom = useProductsStore((s) => s.loadBom);
  const saveBom = useProductsStore((s) => s.saveBom);

  // Local editable draft of BOM ingredients
  const [localIngredients, setLocalIngredients] = useState<BomIngredient[]>([]);

  // Add new ingredient row
  const [selectedRawId, setSelectedRawId] = useState("");
  const [newQty, setNewQty] = useState("0.1");
  const [newUnit, setNewUnit] = useState("kg");
  const [newWastage, setNewWastage] = useState("0");

  useEffect(() => {
    if (activeBomProduct && isBomModalOpen) {
      loadBom(activeBomProduct.id);
    }
  }, [activeBomProduct, isBomModalOpen, loadBom]);

  useEffect(() => {
    setLocalIngredients(bomIngredients);
  }, [bomIngredients]);

  // Filter raw stock items suitable for ingredients
  const rawStockProducts = useMemo(() => {
    return products.filter((p) => p.id !== activeBomProduct?.id);
  }, [products, activeBomProduct]);

  if (!isBomModalOpen || !activeBomProduct) return null;

  // Compute total dish food cost based on raw ingredient costs + wastage
  const totalFoodCost = localIngredients.reduce((sum, ing) => {
    const cost = ing.quantity * ing.costPrice * (1 + ing.wastagePercent / 100);
    return sum + cost;
  }, 0);

  const sellingPrice = activeBomProduct.sellingPrice || 0;
  const grossProfit = sellingPrice - totalFoodCost;
  const foodCostPercentage = sellingPrice > 0 ? (totalFoodCost / sellingPrice) * 100 : 0;
  const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  const handleAddIngredient = () => {
    if (!selectedRawId) return;
    const raw = rawStockProducts.find((p) => p.id === selectedRawId);
    if (!raw) return;

    const existingIndex = localIngredients.findIndex((ing) => ing.productId === selectedRawId);
    const qty = parseFloat(newQty) || 0.1;
    const wastage = parseFloat(newWastage) || 0;

    if (existingIndex >= 0) {
      const updated = [...localIngredients];
      updated[existingIndex].quantity += qty;
      setLocalIngredients(updated);
    } else {
      setLocalIngredients([
        ...localIngredients,
        {
          productId: raw.id,
          productName: raw.name,
          quantity: qty,
          unit: newUnit,
          costPrice: raw.costPrice,
          wastagePercent: wastage,
        },
      ]);
    }

    setSelectedRawId("");
    setNewQty("0.1");
  };

  const handleRemoveIngredient = (productId: string) => {
    setLocalIngredients((prev) => prev.filter((ing) => ing.productId !== productId));
  };

  const handleSave = async () => {
    await saveBom(activeBomProduct.id, localIngredients);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-2xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Recipe Bill of Materials (BOM) — {activeBomProduct.name}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Link raw kitchen ingredients to calculate real dish food cost and track inventory depletion
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeBomModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Financial Metrics Strip */}
        <div className="px-5 py-3 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div>
            <span className="text-[10px] text-[#71675E] uppercase tracking-wider block font-bold">Selling Price</span>
            <span className="font-mono text-sm font-black text-[#292320] tabular-nums">
              {formatNPR(sellingPrice)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#71675E] uppercase tracking-wider block font-bold">Recipe Food Cost</span>
            <span className="font-mono text-sm font-black text-[#6B2837] tabular-nums">
              {formatNPR(totalFoodCost)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#71675E] uppercase tracking-wider block font-bold">Food Cost %</span>
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                foodCostPercentage > 35 ? "text-[#DC2626]" : "text-[#16A34A]"
              }`}
            >
              {foodCostPercentage.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[#71675E] uppercase tracking-wider block font-bold">Gross Margin</span>
            <span
              className={`font-mono text-sm font-black tabular-nums ${
                grossMargin >= 65 ? "text-[#16A34A]" : grossMargin >= 45 ? "text-[#B45309]" : "text-[#DC2626]"
              }`}
            >
              {grossMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add Ingredient Bar */}
          <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
            <span className="text-xs font-bold text-[#292320] block">Add Raw Stock Ingredient</span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <select
                  value={selectedRawId}
                  onChange={(e) => {
                    setSelectedRawId(e.target.value);
                    const matched = rawStockProducts.find((p) => p.id === e.target.value);
                    if (matched?.unit?.name) setNewUnit(matched.unit.name);
                  }}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  <option value="">Select Raw Ingredient...</option>
                  {rawStockProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatNPR(p.costPrice)}/{p.unit?.name || "unit"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  placeholder="Qty"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  {KITCHEN_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="Wastage %"
                  value={newWastage}
                  onChange={(e) => setNewWastage(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
                  title="Estimated kitchen prep wastage percentage"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  disabled={!selectedRawId}
                  className="w-full h-8 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
            {isLoadingBom ? (
              <div className="p-8 text-center text-xs text-[#71675E] space-y-2">
                <div className="inline-block animate-spin h-5 w-5 border-2 border-[#6B2837] border-t-transparent rounded-full" />
                <p>Loading dish recipe ingredients...</p>
              </div>
            ) : localIngredients.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#71675E] space-y-1">
                <AlertCircle className="h-6 w-6 text-[#71675E]/40 mx-auto mb-1" />
                <p className="font-bold text-[#292320]">No recipe ingredients linked</p>
                <p>Add raw stock items above to automatically compute this dish&apos;s food cost.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/70 text-[#71675E] font-bold text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-2 text-right">Quantity</th>
                    <th className="py-2.5 px-2 text-right">Unit Cost</th>
                    <th className="py-2.5 px-2 text-right">Wastage</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CEC1]/50">
                  {localIngredients.map((ing) => {
                    const lineCost = ing.quantity * ing.costPrice * (1 + ing.wastagePercent / 100);
                    return (
                      <tr key={ing.productId} className="hover:bg-[#F7F3EC]/40">
                        <td className="py-2 px-3 font-semibold text-[#292320]">{ing.productName}</td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#71675E]">
                          {ing.quantity} {ing.unit}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#71675E]">
                          {formatNPR(ing.costPrice)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#71675E]">
                          {ing.wastagePercent > 0 ? `+${ing.wastagePercent}%` : "0%"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-[#6B2837]">
                          {formatNPR(lineCost)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(ing.productId)}
                            className="p-1 rounded text-[#71675E] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D8CEC1] flex items-center justify-between gap-2 shrink-0 bg-[#FFFCF7]">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E]">
            <Calculator className="h-4 w-4 text-[#6B2837]" />
            <span>Recipe ingredients auto-deplete raw stock when orders are sent to kitchen.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeBomModal}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSavingBom}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSavingBom ? "Saving Recipe..." : "Save Recipe BOM"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

