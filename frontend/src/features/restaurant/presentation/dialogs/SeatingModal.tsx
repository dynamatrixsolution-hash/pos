"use client";

import React, { useEffect, useState } from "react";
import { Users, X, Minus, Plus, AlertTriangle } from "lucide-react";
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
  const refreshTables = usePosCatalogStore((s) => s.refreshTables);
  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);

  // null means "Not specified / Skip guest count"
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSeating, setIsSeating] = useState(false);

  // Reset modal state whenever opened for a table
  useEffect(() => {
    if (show) {
      setGuestCount(null);
      setNotes("");
    }
  }, [show, selectedTableId]);

  // Close on Escape
  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSeating) setShow(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, isSeating, setShow]);

  if (!show || !selectedTableId) return null;

  const targetTable = tables.find((t) => t.id === selectedTableId);
  if (!targetTable) return null;

  const exceedsCapacity = guestCount !== null && guestCount > targetTable.capacity;

  const seatTable = async (openMenuAfter: boolean) => {
    setIsSeating(true);
    try {
      const countToSend = guestCount ?? 0;
      const data = await restaurantPosRepository.seatGuests(targetTable.id, countToSend, notes);
      updateTableStatusLocally(targetTable.id, "OCCUPIED", data.session?.id || null);
      setShow(false);
      setNotes("");
      if (openMenuAfter) {
        setSelectedTable(targetTable.id, data.session?.id || "");
        syncUrlView("MENU_POS", targetTable.id);
        setIsTicketDrawerOpen(true);
      } else {
        setSelectedTable("");
      }
      fetchActiveOrders();
      refreshTables();
      toast.success(
        countToSend > 0
          ? `Table ${targetTable.tableNumber} seated (${countToSend} ${countToSend === 1 ? "guest" : "guests"})`
          : `Table ${targetTable.tableNumber} opened`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to open table");
    } finally {
      setIsSeating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seating-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSeating) setShow(false);
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] text-[#6B2837]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 id="seating-modal-title" className="text-sm font-bold text-[#292320]">
                Open Table {targetTable.tableNumber}
              </h3>
              <p className="text-[11px] text-[#71675E] tabular-nums">
                {targetTable.floor?.name || "Floor"} &bull; Capacity {targetTable.capacity} covers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label="Close modal"
            className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            seatTable(true);
          }}
          className="space-y-3.5"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="seating-guest-count" className="text-xs font-semibold text-[#292320]">
                Guest Count <span className="text-[#71675E] font-normal">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setGuestCount(null)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                  guestCount === null
                    ? "border-[#6B2837] bg-[#6B2837] text-[#FFFCF7]"
                    : "border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Skip / Not Recorded
              </button>
            </div>

            {/* Quick Presets + Exact Stepper */}
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGuestCount(num)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer tabular-nums ${
                    guestCount === num
                      ? "border-[#6B2837] bg-[#6B2837] text-[#FFFCF7]"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] hover:bg-[#EEE7DD]"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC]">
              <span className="text-[11px] font-medium text-[#71675E]">Custom count:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Decrease guests"
                  onClick={() => setGuestCount((prev) => (prev && prev > 1 ? prev - 1 : null))}
                  disabled={guestCount === null}
                  className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  id="seating-guest-count"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="--"
                  value={guestCount ?? ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setGuestCount(Number.isFinite(val) && val > 0 ? Math.min(99, val) : null);
                  }}
                  className="w-12 h-7 text-center text-xs font-mono font-bold tabular-nums rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Increase guests"
                  onClick={() => setGuestCount((prev) => Math.min(99, (prev ?? 0) + 1))}
                  className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {exceedsCapacity && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] text-[11px] font-semibold text-[#946000]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Exceeds table capacity ({targetTable.capacity} covers). Consider merging tables.
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="seating-notes" className="block text-xs font-semibold text-[#292320] mb-1">
              Table Notes <span className="text-[#71675E] font-normal">(Optional)</span>
            </label>
            <input
              id="seating-notes"
              type="text"
              placeholder="e.g. Window seat, birthday, high chair"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSeating}
              onClick={() => seatTable(false)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] disabled:opacity-50 text-[#292320] cursor-pointer transition-colors"
            >
              Open Only
            </button>
            <button
              type="submit"
              disabled={isSeating}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-[#FFFCF7] cursor-pointer transition-colors"
            >
              {isSeating ? "Opening..." : "Open & Take Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
