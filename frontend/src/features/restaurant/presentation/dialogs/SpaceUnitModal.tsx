"use client";

import React, { useState, useEffect } from "react";
import { X, Store, Save } from "lucide-react";
import { useRestaurantTablesStore } from "../../state/restaurant-tables.store";
import { SpaceCategory } from "../../models/pos.types";

export const SpaceUnitModal: React.FC = () => {
  const isTableModalOpen = useRestaurantTablesStore((s) => s.isTableModalOpen);
  const closeTableModal = useRestaurantTablesStore((s) => s.closeTableModal);
  const editingTable = useRestaurantTablesStore((s) => s.editingTable);
  const floors = useRestaurantTablesStore((s) => s.floors);
  const isSaving = useRestaurantTablesStore((s) => s.isSaving);
  const saveTable = useRestaurantTablesStore((s) => s.saveTable);

  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [floorId, setFloorId] = useState("");
  const [category, setCategory] = useState<SpaceCategory>("TABLE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTable) {
      setTableNumber(editingTable.tableNumber || "");
      setCapacity(editingTable.capacity?.toString() || "4");
      setFloorId(editingTable.floorId || floors[0]?.id || "");
      setCategory((editingTable.metadata?.category as SpaceCategory) || "TABLE");
    } else {
      setTableNumber("");
      setCapacity("4");
      setFloorId(floors[0]?.id || "");
      setCategory("TABLE");
    }
    setError(null);
  }, [editingTable, floors, isTableModalOpen]);

  if (!isTableModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      setError("Table / Space identifier is required.");
      return;
    }
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) {
      setError("Please specify a capacity of at least 1 person.");
      return;
    }

    setError(null);
    const ok = await saveTable({
      tableNumber: tableNumber.trim(),
      capacity: cap,
      floorId: floorId || undefined,
      metadata: {
        category,
      },
    });

    if (!ok) {
      setError("Failed to save space. Table identifier might already be in use.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingTable ? `Edit Space ${editingTable.tableNumber}` : "Create Table / Cabin Space"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Configure seating capacity and area placement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeTableModal}
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
              Space Identifier / Number <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. T-01, Cabin-A, VIP-1, Banquet-Hall"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-bold focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Space Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SpaceCategory)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="TABLE">Dining Table</option>
                <option value="CABIN">Private Cabin</option>
                <option value="VIP_ROOM">VIP Dining Suite</option>
                <option value="HALL">Banquet Hall</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">
                Covers / Capacity <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Floor / Dining Area</label>
            <select
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="">Unassigned Floor</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeTableModal}
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
              <span>{isSaving ? "Saving..." : editingTable ? "Update Space" : "Create Space"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

