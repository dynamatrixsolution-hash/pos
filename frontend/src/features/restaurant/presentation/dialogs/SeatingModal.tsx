"use client";

import React, { useState } from "react";
import { Users, X } from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { restaurantPosRepository } from "../../repositories/restaurant-pos.repository";
import { toast } from "@/components/toast";

export const SeatingModal = React.memo(function SeatingModal() {
  const show = usePosUiStore((s) => s.showSeatingModal);
  const setShow = usePosUiStore((s) => s.setShowSeatingModal);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);
  const setIsTicketDrawerOpen = usePosUiStore((s) => s.setIsTicketDrawerOpen);

  const tables = usePosCatalogStore((s) => s.tables);
  const updateTableStatusLocally = usePosCatalogStore((s) => s.updateTableStatusLocally);
  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);
  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);

  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState("");
  const [isSeating, setIsSeating] = useState(false);

  if (!show || !selectedTableId) return null;

  const targetTable = tables.find((t) => t.id === selectedTableId);
  if (!targetTable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSeating(true);
    try {
      const data = await restaurantPosRepository.seatGuests(targetTable.id, guestCount, notes);
      updateTableStatusLocally(targetTable.id, "OCCUPIED", data.session?.id || null);
      setSelectedTable(targetTable.id, data.session?.id || "");
      setShow(false);
      setNotes("");
      syncUrlView("MENU_POS", targetTable.id);
      setIsTicketDrawerOpen(true);
      fetchActiveOrders();
      loadInitialCatalog();
      toast.success(`Table ${targetTable.tableNumber} seated`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to seat guests");
    } finally {
      setIsSeating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#F8EEF0] text-[#6B2837]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Seat Guests — Table {targetTable.tableNumber}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {targetTable.floor?.name || "Floor"} • Capacity {targetTable.capacity} covers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1.5">
              Guest Count (Covers)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGuestCount(num)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    guestCount === num
                      ? "border-[#6B2837] bg-[#6B2837] text-white shadow-2xs"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] hover:bg-[#EEE7DD]"
                  }`}
                >
                  {num} {num === 1 ? "Guest" : "Guests"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">
              Table Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. VIP guest, birthday celebration, high chair needed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShow(false)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSeating}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-white cursor-pointer shadow-xs"
            >
              {isSeating ? "Seating..." : "Seat & Start Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

