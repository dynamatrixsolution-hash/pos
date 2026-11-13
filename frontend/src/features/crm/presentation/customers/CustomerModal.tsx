"use client";

import React, { useState, useEffect } from "react";
import { X, Users, Save, Trash2, AlertTriangle } from "lucide-react";
import { useCustomersStore } from "../../state/customers.store";

export const CustomerModal: React.FC = () => {
  const isModalOpen = useCustomersStore((s) => s.isModalOpen);
  const closeModal = useCustomersStore((s) => s.closeModal);
  const editingCustomer = useCustomersStore((s) => s.editingCustomer);
  const saveCustomer = useCustomersStore((s) => s.saveCustomer);
  const isSaving = useCustomersStore((s) => s.isSaving);

  const deletingCustomerId = useCustomersStore((s) => s.deletingCustomerId);
  const setDeletingCustomerId = useCustomersStore((s) => s.setDeletingCustomerId);
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [panVat, setPanVat] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name || "");
      setPhone(editingCustomer.phone || "");
      setEmail(editingCustomer.email || "");
      setPanVat(editingCustomer.panVat || "");
      setAddress(editingCustomer.address || "");
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setPanVat("");
      setAddress("");
    }
    setError(null);
  }, [editingCustomer, isModalOpen]);

  // 1. Delete Confirmation
  if (deletingCustomerId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-[#DC2626] shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#292320]">Delete Customer Profile?</h4>
              <p className="text-xs text-[#71675E] mt-1 leading-relaxed">
                This will remove the customer profile from your address book. Existing completed sales invoices will retain customer snapshot data.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingCustomerId(null)}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => deleteCustomer(deletingCustomerId)}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isSaving ? "Deleting..." : "Yes, Delete"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Create / Edit Modal
  if (!isModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      panVat: panVat.trim() || null,
      address: address.trim() || null,
    };

    const ok = await saveCustomer(payload);
    if (!ok) {
      setError("Failed to save customer");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingCustomer ? "Edit Customer Profile" : "New Customer"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Add details for customer ledger, invoices, and loyalty
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
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
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Shrestha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Mobile Number</label>
              <input
                type="text"
                placeholder="e.g. 9841234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">PAN / VAT (Optional)</label>
              <input
                type="text"
                placeholder="9-digit PAN/VAT"
                value={panVat}
                onChange={(e) => setPanVat(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Email Address</label>
            <input
              type="email"
              placeholder="e.g. ramesh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Physical Address</label>
            <input
              type="text"
              placeholder="e.g. Kathmandu, Ward-3, Nepal"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeModal}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : editingCustomer ? "Save Changes" : "Create Customer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

