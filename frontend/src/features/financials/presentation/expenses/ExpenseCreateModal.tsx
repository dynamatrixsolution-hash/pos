"use client";

import React, { useState, useEffect } from "react";
import { X, TrendingDown, TrendingUp, Save, Building2, Tag } from "lucide-react";
import { useExpensesStore } from "../../state/expenses.store";

export const ExpenseCreateModal: React.FC = () => {
  const isCreateModalOpen = useExpensesStore((s) => s.isCreateModalOpen);
  const closeCreateModal = useExpensesStore((s) => s.closeCreateModal);
  const activeTab = useExpensesStore((s) => s.activeTab);
  const categories = useExpensesStore((s) => s.categories);
  const branches = useExpensesStore((s) => s.branches);
  const createRecord = useExpensesStore((s) => s.createRecord);
  const isSaving = useExpensesStore((s) => s.isSaving);

  const isExpense = activeTab === "EXPENSE";

  const [categoryId, setCategoryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0) setCategoryId(categories[0].id);
    if (branches.length > 0) setBranchId(branches[0].id);
    setAmount("");
    setReference("");
    setDescription("");
    setError(null);
  }, [isCreateModalOpen, categories, branches]);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    if (!categoryId) {
      setError("Please select a category");
      return;
    }
    if (!branchId) {
      setError("Please select a branch");
      return;
    }

    const payload = {
      categoryId,
      branchId,
      amount: val,
      reference: reference.trim() || null,
      description: description.trim() || null,
    };

    const ok = await createRecord(payload);
    if (!ok) {
      setError("Failed to record transaction");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg text-white ${
                isExpense ? "bg-[#DC2626]" : "bg-[#16A34A]"
              }`}
            >
              {isExpense ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {isExpense ? "Record Operating Expense" : "Record Other Income"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Post journal entry to account ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCreateModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#DC2626] font-medium shrink-0">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Branch *</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Amount (NPR) *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono font-bold tabular-nums text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Bill / Voucher Ref</label>
            <input
              type="text"
              placeholder="e.g. NEA-BILL-2026 or PETTY-44"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Description / Details</label>
            <input
              type="text"
              placeholder="e.g. Electricity bill for November or Kitchen repair..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ${
                isExpense
                  ? "bg-[#DC2626] hover:bg-[#B91C1C]"
                  : "bg-[#16A34A] hover:bg-[#15803D]"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Record"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

