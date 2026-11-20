"use client";

import React, { useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { restaurantPosRepository } from "../../repositories/restaurant-pos.repository";
import { toast } from "@/components/toast";

export const TransferModal = React.memo(function TransferModal() {
  const show = usePosUiStore((s) => s.showTransferModal);
  const setShow = usePosUiStore((s) => s.setShowTransferModal);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);

  const tables = usePosCatalogStore((s) => s.tables);
  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);
  const fetchTableOrders = usePosTicketsStore((s) => s.fetchTableOrders);

  const [targetTableId, setTargetTableId] = useState("");
  const [reason, setReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  if (!show || !selectedTableId) return null;

  const currentTable = tables.find((t) => t.id === selectedTableId);
  const availableTables = tables.filter((t) => t.id !== selectedTableId && t.status === "AVAILABLE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTableId) return;

    setIsTransferring(true);
    try {
      await restaurantPosRepository.transferTable(selectedTableId, targetTableId, reason);
      const newId = targetTableId;
      setShow(false);
      setTargetTableId("");
      setReason("");
      setSelectedTable(newId);
      syncUrlView("MENU_POS", newId);
      await loadInitialCatalog();
      await fetchTableOrders(newId);
      toast.success("Table transferred successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to transfer table");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-[#B45309]">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Transfer Table {currentTable?.tableNumber}
              </h3>
              <p className="text-[11px] text-[#71675E]">Move active guest session to another table</p>
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
              Select Destination Space
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            >
              <option value="">-- Choose available table --</option>
              {availableTables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.tableNumber} ({t.floor?.name || "Floor"} • {t.capacity} covers)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">
              Transfer Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Customer requested outdoor seating"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShow(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isTransferring || !targetTableId}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#B45309] hover:bg-[#92400E] disabled:opacity-50 text-white cursor-pointer shadow-xs"
            >
              {isTransferring ? "Transferring..." : "Confirm Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

