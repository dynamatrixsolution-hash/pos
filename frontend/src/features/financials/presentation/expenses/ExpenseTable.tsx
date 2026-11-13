"use client";

import React from "react";
import { TrendingDown, TrendingUp, Building2, Calendar, Tag } from "lucide-react";
import { useExpensesStore } from "../../state/expenses.store";
import { ExpenseRecord } from "../../models/financials.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const ExpenseTable: React.FC = () => {
  const records = useExpensesStore((s) => s.records);
  const activeTab = useExpensesStore((s) => s.activeTab);
  const isLoading = useExpensesStore((s) => s.isLoading);

  const isExpense = activeTab === "EXPENSE";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        {isExpense ? (
          <TrendingDown className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        ) : (
          <TrendingUp className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        )}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">
            No {isExpense ? "Expense" : "Income"} Records Found
          </h3>
          <p className="text-xs text-[#71675E]">
            {isExpense
              ? "Record business operating expenses to monitor overheads."
              : "Record non-POS income entries."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            <tr>
              <th className="px-3.5 py-3">Category</th>
              <th className="px-3.5 py-3">Branch</th>
              <th className="px-3.5 py-3 text-right">Amount (NPR)</th>
              <th className="px-3.5 py-3">Reference</th>
              <th className="px-3.5 py-3">Description / Note</th>
              <th className="px-3.5 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                {/* Category */}
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-1.5 font-bold text-[#292320]">
                    <Tag className="h-3.5 w-3.5 text-[#6B2837]" />
                    <span>{r.category?.name || "General Expense"}</span>
                  </div>
                </td>

                {/* Branch */}
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                    <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
                    <span>{r.branch?.name || "Main Branch"}</span>
                  </div>
                </td>

                {/* Amount */}
                <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-sm">
                  <span className={isExpense ? "text-[#DC2626]" : "text-[#16A34A]"}>
                    {formatNPR(r.amount)}
                  </span>
                </td>

                {/* Reference */}
                <td className="px-3.5 py-3 font-mono text-[11px] text-[#71675E]">
                  {r.reference || "N/A"}
                </td>

                {/* Description */}
                <td className="px-3.5 py-3 text-[11px] text-[#292320] max-w-[260px] truncate">
                  {r.description || "—"}
                </td>

                {/* Date */}
                <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{r.createdAt ? r.createdAt.split("T")[0] : "Recent"}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

