"use client";

import React, { useState } from "react";
import { GitMerge, X } from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { restaurantPosRepository } from "../../repositories/restaurant-pos.repository";

export const MergeModal = React.memo(function MergeModal() {
  const show = usePosUiStore((s) => s.showMergeModal);
  const setShow = usePosUiStore((s) => s.setShowMergeModal);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);

  const tables = usePosCatalogStore((s) => s.tables);
  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);
  const fetchTableOrders = usePosTicketsStore((s) => s.fetchTableOrders);

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  if (!show || !selectedTableId) return null;

  const currentTable = tables.find((t) => t.id === selectedTableId);
  const otherOccupiedTables = tables.filter(
    (t) => t.id !== selectedTableId && (t.status === "OCCUPIED" || t.status === "BILLED")
  );

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0) return;

    setIsMerging(true);
    try {
      await restaurantPosRepository.mergeTables(selectedSourceIds, selectedTableId, reason);
      setShow(false);
      setSelectedSourceIds([]);
      setReason("");
      await loadInitialCatalog();
      await fetchTableOrders(selectedTableId);
    } catch {
      // Handled
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EDF5ED] text-[#2D6A4F]">
              <GitMerge className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Merge Tables into Table {currentTable?.tableNumber}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Combine bills &amp; guest orders from other busy tables
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
              Select Tables to Merge In
            </label>
            {otherOccupiedTables.length === 0 ? (
              <p className="text-xs text-[#71675E] py-4 text-center bg-[#F7F3EC] rounded-lg border border-dashed border-[#D8CEC1]">
                No other occupied tables available to merge.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {otherOccupiedTables.map((t) => {
                  const isChecked = selectedSourceIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? "border-[#2D6A4F] bg-[#EDF5ED]"
                          : "border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSource(t.id)}
                          className="rounded text-[#2D6A4F]"
                        />
                        <span className="font-bold text-[#292320]">Table {t.tableNumber}</span>
                        <span className="text-[11px] text-[#71675E]">
                          ({t.floor?.name || "Floor"} • {t.capacity} covers)
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">
              Merge Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Combined party of 8 guests"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
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
              disabled={isMerging || selectedSourceIds.length === 0}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#2D6A4F] hover:bg-[#1E4D38] disabled:opacity-50 text-white cursor-pointer shadow-xs"
            >
              {isMerging ? "Merging..." : `Merge Selected (${selectedSourceIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

