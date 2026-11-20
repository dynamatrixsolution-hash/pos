"use client";

import React, { useState, useEffect } from "react";
import { BedDouble, X } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { parseMoney } from "@/lib/currency";

export const RoomTypeModal: React.FC = () => {
  const show = useHotelUiStore((s) => s.showRoomTypeModal);
  const setShow = useHotelUiStore((s) => s.setShowRoomTypeModal);
  const editingRoomType = useHotelUiStore((s) => s.editingRoomType);
  const setEditingRoomType = useHotelUiStore((s) => s.setEditingRoomType);

  const createRoomType = useHotelRoomsStore((s) => s.createRoomType);
  const updateRoomType = useHotelRoomsStore((s) => s.updateRoomType);
  const actionLoading = useHotelRoomsStore((s) => s.actionLoading);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [baseRate, setBaseRate] = useState("4500");
  const [maxOccupancy, setMaxOccupancy] = useState("2");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (editingRoomType) {
      setName(editingRoomType.name);
      setCode(editingRoomType.code);
      setBaseRate(String(parseMoney(editingRoomType.baseRate)));
      setMaxOccupancy(String(editingRoomType.maxOccupancy));
      setDescription(editingRoomType.description || "");
    } else {
      setName("");
      setCode("");
      setBaseRate("4500");
      setMaxOccupancy("2");
      setDescription("");
    }
  }, [editingRoomType, show]);

  if (!show && !editingRoomType) return null;

  const handleClose = () => {
    setShow(false);
    setEditingRoomType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    if (editingRoomType) {
      await updateRoomType(editingRoomType.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        baseRate: Number(baseRate) || 0,
        maxOccupancy: Number(maxOccupancy) || 2,
        description: description.trim() || undefined,
      });
    } else {
      await createRoomType({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        baseRate: Number(baseRate) || 0,
        maxOccupancy: Number(maxOccupancy) || 2,
        description: description.trim() || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              {editingRoomType ? `Edit Room Type — ${editingRoomType.name}` : "Add Room Type"}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#292320] mb-1">Type Name *</label>
              <input
                type="text"
                placeholder="e.g. Deluxe Suite"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Code *</label>
              <input
                type="text"
                placeholder="DLX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] uppercase font-bold focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Base Rate (Rs.) *</label>
              <input
                type="number"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Max Guests</label>
              <input
                type="number"
                min="1"
                max="20"
                value={maxOccupancy}
                onChange={(e) => setMaxOccupancy(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Mountain view, Jacuzzi, Work desk"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
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
              {actionLoading ? "Saving..." : editingRoomType ? "Update Type" : "Create Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

