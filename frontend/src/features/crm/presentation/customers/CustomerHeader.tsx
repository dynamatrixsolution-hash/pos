"use client";

import React from "react";
import { Plus, Search, RefreshCw, Users } from "lucide-react";
import { useCustomersStore } from "../../state/customers.store";

export const CustomerHeader: React.FC = () => {
  const search = useCustomersStore((s) => s.search);
  const setSearch = useCustomersStore((s) => s.setSearch);
  const loadCustomers = useCustomersStore((s) => s.loadCustomers);
  const isLoading = useCustomersStore((s) => s.isLoading);
  const openCreateModal = useCustomersStore((s) => s.openCreateModal);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#6B2837] text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              Customer Relationship Management (CRM)
            </h1>
            <p className="text-xs text-[#71675E]">
              Maintain customer profiles, phone contacts, PAN/VAT records, and loyalty accounts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone, email, or PAN/VAT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>

        <button
          type="button"
          onClick={() => loadCustomers()}
          disabled={isLoading}
          className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Refresh customers"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};

