"use client";

import React from "react";
import { Plus, Search, RefreshCw, TrendingDown, TrendingUp, Building2 } from "lucide-react";
import { useExpensesStore } from "../../state/expenses.store";

export const ExpenseHeader: React.FC = () => {
  const activeTab = useExpensesStore((s) => s.activeTab);
  const setActiveTab = useExpensesStore((s) => s.setActiveTab);
  const search = useExpensesStore((s) => s.search);
  const setSearch = useExpensesStore((s) => s.setSearch);
  const categoryFilter = useExpensesStore((s) => s.categoryFilter);
  const setCategoryFilter = useExpensesStore((s) => s.setCategoryFilter);
  const branchFilter = useExpensesStore((s) => s.branchFilter);
  const setBranchFilter = useExpensesStore((s) => s.setBranchFilter);
  const categories = useExpensesStore((s) => s.categories);
  const branches = useExpensesStore((s) => s.branches);
  const loadRecords = useExpensesStore((s) => s.loadRecords);
  const isLoading = useExpensesStore((s) => s.isLoading);
  const openCreateModal = useExpensesStore((s) => s.openCreateModal);

  const isExpense = activeTab === "EXPENSE";

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-xl text-white ${
              isExpense ? "bg-[#DC2626]" : "bg-[#16A34A]"
            }`}
          >
            {isExpense ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              Operating Expenses &amp; Miscellaneous Income
            </h1>
            <p className="text-xs text-[#71675E]">
              Track operational costs, utility bills, maintenance, petty cash, and other income
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className={`h-9 px-3.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto ${
            isExpense ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#16A34A] hover:bg-[#15803D]"
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>{isExpense ? "+ Record New Expense" : "+ Record Other Income"}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, description, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadRecords()}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-[#71675E]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-[#71675E]">Branch:</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
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

        <button
          type="button"
          onClick={() => loadRecords()}
          disabled={isLoading}
          className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Refresh entries"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};

