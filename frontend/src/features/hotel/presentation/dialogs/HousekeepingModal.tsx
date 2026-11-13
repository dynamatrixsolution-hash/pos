"use client";

import React, { useState, useEffect } from "react";
import { Wrench, X, CheckCircle2 } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { RoomStatus } from "../../models/hotel.types";

export const HousekeepingModal: React.FC = () => {
  const show = useHotelUiStore((s) => s.showHousekeepingModal);
  const setShow = useHotelUiStore((s) => s.setShowHousekeepingModal);
  const selectedRoomForAction = useHotelUiStore((s) => s.selectedRoomForAction);

  const quickUpdateRoomStatus = useHotelRoomsStore((s) => s.quickUpdateRoomStatus);
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus>("VACANT_CLEAN");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRoomForAction) {
      setSelectedStatus(selectedRoomForAction.status);
    }
  }, [selectedRoomForAction, show]);

  if (!show || !selectedRoomForAction) return null;

  const statuses: { id: RoomStatus; label: string; desc: string; color: string }[] = [
    {
      id: "VACANT_CLEAN",
      label: "Vacant Clean",
      desc: "Ready for guest check-in",
      color: "border-[#C8DFCD] bg-[#EDF5ED] text-[#2D6A4F]",
    },
    {
      id: "VACANT_DIRTY",
      label: "Vacant Dirty",
      desc: "Needs housekeeping turn-around",
      color: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
    },
    {
      id: "OCCUPIED_CLEAN",
      label: "Occupied Clean",
      desc: "Guest in-house, room serviced",
      color: "border-[#E9CDD3] bg-[#F8EEF0] text-[#6B2837]",
    },
    {
      id: "OCCUPIED_DIRTY",
      label: "Occupied Dirty",
      desc: "Guest in-house, needs daily cleaning",
      color: "border-[#E9CDD3] bg-[#F8EEF0] text-[#6B2837]",
    },
    {
      id: "MAINTENANCE",
      label: "Under Maintenance",
      desc: "Repairs or inspection in progress",
      color: "border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E]",
    },
    {
      id: "OUT_OF_SERVICE",
      label: "Out of Service",
      desc: "Blocked from inventory",
      color: "border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E]",
    },
  ];

  const handleApply = async () => {
    setLoading(true);
    await quickUpdateRoomStatus(selectedRoomForAction.id, selectedStatus);
    setLoading(false);
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              Housekeeping Status — Room {selectedRoomForAction.roomNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {statuses.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStatus(st.id)}
              className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                selectedStatus === st.id ? `${st.color} font-bold ring-2 ring-[#6B2837]` : "border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#292320]"
              }`}
            >
              <div>
                <div className="text-xs font-bold">{st.label}</div>
                <div className="text-[10px] text-[#71675E]">{st.desc}</div>
              </div>
              {selectedStatus === st.id && <CheckCircle2 className="h-4 w-4 text-[#6B2837]" />}
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShow(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white cursor-pointer shadow-xs transition-colors"
          >
            {loading ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

