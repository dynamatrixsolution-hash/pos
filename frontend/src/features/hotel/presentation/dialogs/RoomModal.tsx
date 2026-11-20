"use client";

import React, { useState, useEffect } from "react";
import { BedDouble, X } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { RoomStatus } from "../../models/hotel.types";

export const RoomModal: React.FC = () => {
  const showAdd = useHotelUiStore((s) => s.showAddRoomModal);
  const setShowAdd = useHotelUiStore((s) => s.setShowAddRoomModal);
  const editingRoom = useHotelUiStore((s) => s.editingRoom);
  const setEditingRoom = useHotelUiStore((s) => s.setEditingRoom);

  const roomTypes = useHotelRoomsStore((s) => s.roomTypes);
  const floors = useHotelRoomsStore((s) => s.floors);
  const createRoom = useHotelRoomsStore((s) => s.createRoom);
  const updateRoom = useHotelRoomsStore((s) => s.updateRoom);
  const actionLoading = useHotelRoomsStore((s) => s.actionLoading);

  const isOpen = showAdd || editingRoom !== null;

  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [status, setStatus] = useState<RoomStatus>("VACANT_CLEAN");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingRoom) {
      setRoomNumber(editingRoom.roomNumber);
      setRoomTypeId(editingRoom.roomTypeId);
      setFloorId(editingRoom.floorId || "");
      setCapacity(String(editingRoom.capacity || 2));
      setStatus(editingRoom.status);
      setNotes(editingRoom.notes || "");
    } else {
      setRoomNumber("");
      setRoomTypeId(roomTypes[0]?.id || "");
      setFloorId(floors[0]?.id || "");
      setCapacity("2");
      setStatus("VACANT_CLEAN");
      setNotes("");
    }
  }, [editingRoom, showAdd, roomTypes, floors]);

  if (!isOpen) return null;

  const handleClose = () => {
    setShowAdd(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !roomTypeId) return;

    if (editingRoom) {
      await updateRoom(editingRoom.id, {
        roomNumber: roomNumber.trim(),
        roomTypeId,
        floorId: floorId || null,
        capacity: Number(capacity) || 2,
        status,
        notes: notes || null,
      });
    } else {
      await createRoom({
        roomNumber: roomNumber.trim(),
        roomTypeId,
        floorId: floorId || undefined,
        capacity: Number(capacity) || 2,
        notes: notes || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : "Add New Hotel Room"}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Room Number *</label>
            <input
              type="text"
              placeholder="e.g. 101, 202, Royal Suite"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Room Type *</label>
              <select
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Floor *</label>
              <select
                value={floorId}
                onChange={(e) => setFloorId(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="">Unassigned Floor</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Max Occupancy</label>
              <input
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            {editingRoom && (
              <div>
                <label className="block text-xs font-semibold text-[#292320] mb-1">Room Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RoomStatus)}
                  className="w-full text-xs px-2 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  <option value="VACANT_CLEAN">Vacant Clean</option>
                  <option value="VACANT_DIRTY">Vacant Dirty</option>
                  <option value="OCCUPIED_CLEAN">Occupied Clean</option>
                  <option value="OCCUPIED_DIRTY">Occupied Dirty</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Notes / Features</label>
            <input
              type="text"
              placeholder="e.g. Balcony view, king-sized bed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              {actionLoading ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

