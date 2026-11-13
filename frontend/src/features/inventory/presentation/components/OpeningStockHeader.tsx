"use client";

import React from "react";
import { Plus, Search, Filter, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import { useInventoryOpeningStore } from "../../state/inventory-opening.store";

interface OpeningStockHeaderProps {
  onExportExcel?: () => void;
  onExportPdf?: () => void;
}

export const OpeningStockHeader: React.FC<OpeningStockHeaderProps> = ({
  onExportExcel,
  onExportPdf,
}) => {
  const search = useInventoryOpeningStore((s) => s.search);
  const setSearch = useInventoryOpeningStore((s) => s.setSearch);
  const selectedBranch = useInventoryOpeningStore((s) => s.selectedBranch);
  const setSelectedBranch = useInventoryOpeningStore((s) => s.setSelectedBranch);
  const selectedStatus = useInventoryOpeningStore((s) => s.selectedStatus);
  const setSelectedStatus = useInventoryOpeningStore((s) => s.setSelectedStatus);
  const branches = useInventoryOpeningStore((s) => s.branches);
  const loadEntries = useInventoryOpeningStore((s) => s.loadEntries);
  const isLoading = useInventoryOpeningStore((s) => s.isLoading);
  const openCreateModal = useInventoryOpeningStore((s) => s.openCreateModal);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Opening Stock Master</h1>
          <p className="text-xs text-[#71675E]">
            Initialize, verify, and approve initial stock ledger records across all physical branches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#2D6A4F]" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-[#B45309]" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Opening Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product, SKU, barcode, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadEntries()}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-[#71675E]">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filters & Refresh */}
        <div className="flex items-center gap-2">
          <div className="h-8 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-xs">
            {["ALL", "APPROVED", "PENDING", "REJECTED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`h-full px-2.5 rounded-md font-bold transition-all capitalize cursor-pointer ${
                  selectedStatus === st
                    ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {st === "ALL" ? "All" : st.toLowerCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadEntries()}
            disabled={isLoading}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer"
            title="Refresh entries"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

