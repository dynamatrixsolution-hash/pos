"use client";

import React, { useState, useEffect } from "react";
import { X, CreditCard, Save, Building2, User, DollarSign } from "lucide-react";
import { usePaymentsStore } from "../../state/payments.store";
import { PaymentMethod } from "../../models/financials.types";

export const RecordPaymentModal: React.FC = () => {
  const isRecordModalOpen = usePaymentsStore((s) => s.isRecordModalOpen);
  const closeRecordModal = usePaymentsStore((s) => s.closeRecordModal);
  const paymentType = usePaymentsStore((s) => s.paymentType);
  const branches = usePaymentsStore((s) => s.branches);
  const customers = usePaymentsStore((s) => s.customers);
  const suppliers = usePaymentsStore((s) => s.suppliers);
  const submitPayment = usePaymentsStore((s) => s.submitPayment);
  const isSaving = usePaymentsStore((s) => s.isSaving);

  const isReceived = paymentType === "RECEIVED";

  const [partyId, setPartyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length > 0) setBranchId(branches[0].id);
    setPartyId("");
    setAmount("");
    setMethod("CASH");
    setReference("");
    setReceiptNumber("");
    setRemarks("");
    setError(null);
  }, [isRecordModalOpen, branches]);

  if (!isRecordModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      setError("Payment amount must be greater than zero");
      return;
    }
    if (!branchId) {
      setError("Please select a branch");
      return;
    }

    const payload: any = {
      type: paymentType,
      branchId,
      amount: val,
      method,
      reference: reference.trim() || null,
      receiptNumber: receiptNumber.trim() || null,
      remarks: remarks.trim() || null,
    };

    if (isReceived) {
      payload.customerId = partyId || null;
    } else {
      payload.supplierId = partyId || null;
    }

    const ok = await submitPayment(payload);
    if (!ok) {
      setError("Failed to record payment transaction");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg text-white ${
                isReceived ? "bg-[#16A34A]" : "bg-[#6B2837]"
              }`}
            >
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {isReceived ? "Record Payment Received" : "Record Payment Sent"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {isReceived
                  ? "Record inward cash, card, or QR remittance into financial ledger"
                  : "Record vendor disbursement or supplier bill settlement"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeRecordModal}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Party (Customer / Supplier) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              {isReceived ? "Customer (Optional / Walk-in)" : "Supplier / Vendor *"}
            </label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
            >
              <option value="">
                {isReceived ? "-- Walk-In Customer --" : "-- Select Supplier --"}
              </option>
              {isReceived
                ? customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))
                : suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
            </select>
          </div>

          {/* Branch & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Payment Method *</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="FONE_PAY">FonePay QR</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="ESEWA">eSewa</option>
                <option value="KHALTI">Khalti</option>
                <option value="NEPAL_PAY">NepalPay</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Transaction / Bank Ref</label>
              <input
                type="text"
                placeholder="e.g. TXN-1294829 or Cheque #"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Remarks / Notes</label>
            <input
              type="text"
              placeholder="e.g. Advance deposit for banquet booking..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeRecordModal}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 text-xs font-bold rounded-lg text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ${
                isReceived
                  ? "bg-[#16A34A] hover:bg-[#15803D]"
                  : "bg-[#6B2837] hover:bg-[#541E2A]"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Recording..." : "Save Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

