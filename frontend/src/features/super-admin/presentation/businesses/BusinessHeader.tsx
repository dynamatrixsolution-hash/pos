"use client";

import React from "react";
import { Plus, Search, RefreshCw, Building2, ShieldCheck } from "lucide-react";
import { useSuperAdminBusinessesStore } from "../../state/super-admin-businesses.store";

export const BusinessHeader: React.FC = () => {
  const search = useSuperAdminBusinessesStore((s) => s.search);
  const setSearch = useSuperAdminBusinessesStore((s) => s.setSearch);
  const statusFilter = useSuperAdminBusinessesStore((s) => s.statusFilter);
  const setStatusFilter = useSuperAdminBusinessesStore((s) => s.setStatusFilter);
  const planFilter = useSuperAdminBusinessesStore((s) => s.planFilter);
  const setPlanFilter = useSuperAdminBusinessesStore((s) => s.setPlanFilter);
  const loadBusinesses = useSuperAdminBusinessesStore((s) => s.loadBusinesses);
  const isLoading = useSuperAdminBusinessesStore((s) => s.isLoading);
  const openCreateModal = useSuperAdminBusinessesStore((s) => s.openCreateModal);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#6B2837] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              Tenant Business Organizations
            </h1>
            <p className="text-xs text-[#71675E]">
              Multi-tenant root controls: onboard client companies, manage subscriptions, license keys, and isolation
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-9 px-3.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Provision New Tenant</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search business name, phone, email, PAN/VAT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadBusinesses()}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-[#71675E]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRIAL">Trial</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadBusinesses()}
          disabled={isLoading}
          className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Refresh tenants"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};

