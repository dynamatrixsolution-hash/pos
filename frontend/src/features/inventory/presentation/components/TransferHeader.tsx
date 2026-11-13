"use client";

import React from "react";
import { Plus, Search, RefreshCw, ArrowRightLeft, Building2 } from "lucide-react";
import { useInventoryTransfersStore } from "../../state/inventory-transfers.store";

export const TransferHeader: React.FC = () => {
  const search = useInventoryTransfersStore((s) => s.search);
  const setSearch = useInventoryTransfersStore((s) => s.setSearch);
  const selectedStatus = useInventoryTransfersStore((s) => s.selectedStatus);
  const setSelectedStatus = useInventoryTransfersStore((s) => s.setSelectedStatus);
  const loadTransfers = useInventoryTransfersStore((s) => s.loadTransfers);
  const isLoading = useInventoryTransfersStore((s) => s.isLoading);
  const openCreateModal = useInventoryTransfersStore((s) => s.openCreateModal);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">
            Inter-Branch Stock Transfers
          </h1>
          <p className="text-xs text-[#71675E]">
            Request, dispatch, and track inventory movements across physical warehouse locations.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>+ New Stock Transfer</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transfer #, branch, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>

        {/* Status Filters & Refresh */}
        <div className="flex items-center gap-2">
          <div className="h-8 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-xs overflow-x-auto no-scrollbar">
            {["ALL", "PENDING", "APPROVED", "IN_TRANSIT", "RECEIVED", "CANCELLED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`h-full px-2.5 rounded-md font-bold transition-all capitalize cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {st === "ALL" ? "All" : st.replace("_", " ").toLowerCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadTransfers()}
            disabled={isLoading}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Refresh transfers"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

