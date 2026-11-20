"use client";

import React, { useState, useEffect } from "react";
import { useSettingsStore } from "../state/settings.store";
import { BranchRecord } from "../models/settings.types";
import {
  Building2,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Loader2,
  MapPin,
  Phone,
} from "lucide-react";

export function BranchesContainer() {
  const { branches, loading, saving, loadBranches, createBranch, updateBranch, deleteBranch } =
    useSettingsStore();

  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const openCreate = () => {
    setEditingBranch(null);
    setName("");
    setCode("");
    setAddress("");
    setPhone("");
    setEmail("");
    setIsMain(false);
    setIsActive(true);
    setShowModal(true);
  };

  const openEdit = (b: BranchRecord) => {
    setEditingBranch(b);
    setName(b.name);
    setCode(b.code || "");
    setAddress(b.address || "");
    setPhone(b.phone || "");
    setEmail(b.email || "");
    setIsMain(b.isMain);
    setIsActive(b.isActive);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const payload = {
      name,
      code: code || undefined,
      address: address || undefined,
      phone: phone || undefined,
      email: email || undefined,
      isMain,
      isActive,
    };
    let success = false;
    if (editingBranch) {
      success = await updateBranch(editingBranch.id, payload);
    } else {
      success = await createBranch(payload);
    }
    if (success) setShowModal(false);
  };

  const handleDelete = async (b: BranchRecord) => {
    if (b.isMain) {
      alert("The main headquarters branch cannot be deleted.");
      return;
    }
    if (confirm(`Are you sure you want to delete branch "${b.name}"?`)) {
      await deleteBranch(b.id);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Branches & Outlets</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage physical store locations, warehouses, sub-branches & headquarters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBranches()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Branch
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading branch outlets...
        </div>
      ) : branches.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Building2 className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No branches found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-4 space-y-3 shadow-sm hover:border-[#6B2837]/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#292320]">{b.name}</h3>
                    {b.isMain && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#6B2837] text-white">
                        MAIN
                      </span>
                    )}
                  </div>
                  {b.code && <div className="text-[11px] font-mono text-[#71675E]">Code: {b.code}</div>}
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    b.isActive
                      ? "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                      : "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]"
                  }`}
                >
                  {b.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              <div className="space-y-1 text-xs text-[#71675E]">
                {b.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{b.address}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-[#EEE7DD]">
                <button
                  onClick={() => openEdit(b)}
                  className="p-1.5 text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC] rounded transition-colors"
                  title="Edit Branch"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {!b.isMain && (
                  <button
                    onClick={() => handleDelete(b)}
                    className="p-1.5 text-[#B33432] hover:bg-[#FCEEEE] rounded transition-colors"
                    title="Delete Branch"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">
                {editingBranch ? "Edit Branch" : "Add New Branch"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Thamel Flagship Outlet"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Outlet Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. BR-01"
                  className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contact #"
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="branch@domain.com"
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#292320]">
                  <input
                    type="checkbox"
                    checked={isMain}
                    onChange={(e) => setIsMain(e.target.checked)}
                    className="h-4 w-4 rounded text-[#6B2837]"
                  />
                  Headquarters (Main)
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#292320]">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-[#6B2837]"
                  />
                  Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {saving ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

