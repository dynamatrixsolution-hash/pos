"use client";

import React, { useState, useEffect } from "react";
import { Layers, X } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";

export const FloorModal: React.FC = () => {
  const show = useHotelUiStore((s) => s.showAddFloorModal);
  const setShow = useHotelUiStore((s) => s.setShowAddFloorModal);
  const editingFloor = useHotelUiStore((s) => s.editingFloor);
  const setEditingFloor = useHotelUiStore((s) => s.setEditingFloor);

  const floors = useHotelRoomsStore((s) => s.floors);
  const createFloor = useHotelRoomsStore((s) => s.createFloor);
  const updateFloor = useHotelRoomsStore((s) => s.updateFloor);
  const actionLoading = useHotelRoomsStore((s) => s.actionLoading);

  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");

  useEffect(() => {
    if (editingFloor) {
      setName(editingFloor.name);
      setDisplayOrder(String(editingFloor.displayOrder || 1));
    } else {
      setName("");
      setDisplayOrder(String(floors.length + 1));
    }
  }, [editingFloor, show, floors.length]);

  if (!show && !editingFloor) return null;

  const handleClose = () => {
    setShow(false);
    setEditingFloor(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingFloor) {
      await updateFloor(editingFloor.id, {
        name: name.trim(),
        displayOrder: Number(displayOrder) || editingFloor.displayOrder,
      });
    } else {
      await createFloor({
        name: name.trim(),
        displayOrder: Number(displayOrder) || floors.length + 1,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              {editingFloor ? `Edit Floor — ${editingFloor.name}` : "Add Building Floor"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Floor Name *</label>
            <input
              type="text"
              placeholder="e.g. Ground Floor, 2nd Floor, Penthouse"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Sequence / Display Order</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white cursor-pointer shadow-xs transition-colors"
            >
              {actionLoading ? "Saving..." : editingFloor ? "Update Floor" : "Create Floor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

