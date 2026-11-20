"use client";

import React, { useState, useEffect } from "react";
import { X, Truck, Save, Trash2, AlertTriangle } from "lucide-react";
import { useSuppliersStore } from "../../state/suppliers.store";

export const SupplierModal: React.FC = () => {
  const isModalOpen = useSuppliersStore((s) => s.isModalOpen);
  const closeModal = useSuppliersStore((s) => s.closeModal);
  const editingSupplier = useSuppliersStore((s) => s.editingSupplier);
  const saveSupplier = useSuppliersStore((s) => s.saveSupplier);
  const isSaving = useSuppliersStore((s) => s.isSaving);

  const deletingSupplierId = useSuppliersStore((s) => s.deletingSupplierId);
  const setDeletingSupplierId = useSuppliersStore((s) => s.setDeletingSupplierId);
  const deleteSupplier = useSuppliersStore((s) => s.deleteSupplier);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [panVat, setPanVat] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSupplier) {
      setName(editingSupplier.name || "");
      setContactPerson(editingSupplier.contactPerson || "");
      setPhone(editingSupplier.phone || "");
      setEmail(editingSupplier.email || "");
      setPanVat(editingSupplier.panVat || "");
      setAddress(editingSupplier.address || "");
    } else {
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setPanVat("");
      setAddress("");
    }
    setError(null);
  }, [editingSupplier, isModalOpen]);

  // 1. Delete Confirmation
  if (deletingSupplierId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-[#FFFCF7] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-[#DC2626] shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#292320]">Delete Supplier Profile?</h4>
              <p className="text-xs text-[#71675E] mt-1 leading-relaxed">
                This will delete the supplier entry from your directory. Past purchase invoices already posted will keep historical records.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingSupplierId(null)}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => deleteSupplier(deletingSupplierId)}
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
      setError("Supplier business name is required");
      return;
    }

    const payload = {
      name: name.trim(),
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      panVat: panVat.trim() || null,
      address: address.trim() || null,
    };

    const ok = await saveSupplier(payload);
    if (!ok) {
      setError("Failed to save supplier profile");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingSupplier ? "Edit Supplier Profile" : "New Supplier / Vendor"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Add vendor details for purchase bills and payments
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
            <label className="text-[11px] font-bold text-[#292320]">Business Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Himalayan Food Distributors Pvt. Ltd."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Contact Person</label>
            <input
              type="text"
              placeholder="e.g. Pradeep Gautam (Sales Manager)"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Phone / Mobile</label>
              <input
                type="text"
                placeholder="e.g. 01-4428192"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">PAN / VAT Number</label>
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
              placeholder="e.g. sales@himalayanfood.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Office / Depot Address</label>
            <input
              type="text"
              placeholder="e.g. Kalimati Trade Center, Kathmandu"
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
              <span>{isSaving ? "Saving..." : editingSupplier ? "Save Changes" : "Create Supplier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

