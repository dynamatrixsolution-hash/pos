"use client";

import React from "react";
import { X, Building2, Phone, Mail, MapPin, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useSuperAdminBusinessesStore } from "../../state/super-admin-businesses.store";

export const BusinessInspectionDrawer: React.FC = () => {
  const b = useSuperAdminBusinessesStore((s) => s.selectedBusinessForInspection);
  const setSelectedBusiness = useSuperAdminBusinessesStore((s) => s.setSelectedBusinessForInspection);

  if (!b) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">{b.name}</h3>
              <p className="text-[11px] text-[#71675E]">Tenant ID: {b.id}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedBusiness(null)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-center">
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Branches</span>
            <div className="font-mono font-bold text-[#292320] text-sm mt-0.5">
              {b.branchesCount ?? 1}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Staff Accounts</span>
            <div className="font-mono font-bold text-[#6B2837] text-sm mt-0.5">
              {b.usersCount ?? 1}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-[#71675E] uppercase font-bold">Status</span>
            <div className="font-bold text-[#16A34A] text-sm mt-0.5">{b.status}</div>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-2 text-xs divide-y divide-[#D8CEC1]/60">
          <div className="pt-2 first:pt-0 flex justify-between">
            <span className="text-[#71675E]">Plan Tier:</span>
            <span className="font-bold text-[#292320]">{b.planName || b.plan || "ENTERPRISE"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-[#71675E]">PAN / VAT:</span>
            <span className="font-mono text-[#292320]">{b.panVat || "Not Registered"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-[#71675E]">Contact Phone:</span>
            <span className="font-mono text-[#292320]">{b.phone || "N/A"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-[#71675E]">Billing Email:</span>
            <span className="text-[#292320]">{b.email || "N/A"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-[#71675E]">Address:</span>
            <span className="text-[#292320]">{b.address || "N/A"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-[#71675E]">Joined Date:</span>
            <span className="text-[#292320]">{b.createdAt?.split("T")[0]}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => setSelectedBusiness(null)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

