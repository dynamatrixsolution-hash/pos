"use client";

import React from "react";
import { Plus, Search, RefreshCw, CreditCard, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { usePaymentsStore } from "../../state/payments.store";

export const PaymentHeader: React.FC = () => {
  const paymentType = usePaymentsStore((s) => s.paymentType);
  const search = usePaymentsStore((s) => s.search);
  const setSearch = usePaymentsStore((s) => s.setSearch);
  const methodFilter = usePaymentsStore((s) => s.methodFilter);
  const setMethodFilter = usePaymentsStore((s) => s.setMethodFilter);
  const branchFilter = usePaymentsStore((s) => s.branchFilter);
  const setBranchFilter = usePaymentsStore((s) => s.setBranchFilter);
  const branches = usePaymentsStore((s) => s.branches);
  const loadPayments = usePaymentsStore((s) => s.loadPayments);
  const isLoading = usePaymentsStore((s) => s.isLoading);
  const openRecordModal = usePaymentsStore((s) => s.openRecordModal);

  const isReceived = paymentType === "RECEIVED";

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-xl text-white ${
              isReceived ? "bg-[#16A34A]" : "bg-[#6B2837]"
            }`}
          >
            {isReceived ? (
              <ArrowDownLeft className="h-5 w-5" />
            ) : (
              <ArrowUpRight className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              {isReceived ? "Payments Received" : "Payments Sent / Outflow"}
            </h1>
            <p className="text-xs text-[#71675E]">
              {isReceived
                ? "Customer settlements, advance bookings, QR remittances, and bill payments"
                : "Supplier settlements, vendor payouts, and outgoing payments"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openRecordModal}
          className={`h-9 px-3.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto ${
            isReceived ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#6B2837] hover:bg-[#541E2A]"
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>{isReceived ? "+ Record Inward Payment" : "+ Record Outward Payment"}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${isReceived ? "customer, receipt" : "supplier, bill"} #, reference...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadPayments()}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
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

        {/* Method Filters & Refresh */}
        <div className="flex items-center gap-2">
          <div className="h-8 p-0.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center text-xs overflow-x-auto no-scrollbar">
            {["ALL", "CASH", "FONE_PAY", "CARD", "ESEWA", "KHALTI"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`h-full px-2.5 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                  methodFilter === m
                    ? "bg-[#FFFCF7] text-[#6B2837] shadow-2xs"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {m === "ALL" ? "All Methods" : m.replace("_", " ")}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadPayments()}
            disabled={isLoading}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Refresh payments"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

