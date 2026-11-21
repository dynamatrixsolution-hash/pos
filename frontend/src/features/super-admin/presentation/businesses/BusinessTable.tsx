"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Edit2,
  Power,
  Users,
} from "lucide-react";
import { useSuperAdminBusinessesStore } from "../../state/super-admin-businesses.store";
import { TenantBusiness, TenantStatus } from "../../models/super-admin.types";

export const BusinessTable: React.FC = () => {
  const businesses = useSuperAdminBusinessesStore((s) => s.businesses);
  const isLoading = useSuperAdminBusinessesStore((s) => s.isLoading);
  const setEditingBusiness = useSuperAdminBusinessesStore((s) => s.setEditingBusiness);
  const setSelectedBusinessForInspection = useSuperAdminBusinessesStore(
    (s) => s.setSelectedBusinessForInspection
  );
  const updateStatus = useSuperAdminBusinessesStore((s) => s.updateStatus);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <Building2 className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Tenant Businesses Found</h3>
          <p className="text-xs text-[#71675E]">
            Provision a new tenant organization or adjust your search filters.
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
              <th className="px-3.5 py-3">Tenant Business</th>
              <th className="px-3.5 py-3">Contact</th>
              <th className="px-3.5 py-3">PAN / VAT</th>
              <th className="px-3.5 py-3">Plan</th>
              <th className="px-3.5 py-3 text-center">Branches &amp; Staff</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3">Onboarded</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {businesses.map((b) => {
              const isActive = b.status === "ACTIVE";
              const isTrial = b.status === "TRIAL";
              const isSuspended = b.status === "SUSPENDED";

              return (
                <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  {/* Name */}
                  <td className="px-3.5 py-3">
                    <Link
                      href={`/dashboard/super-admin/businesses/${b.id}`}
                      className="font-bold text-[#292320] hover:text-[#6B2837] hover:underline text-sm"
                    >
                      {b.name}
                    </Link>
                    {b.slug && (
                      <div className="text-[10px] font-mono text-[#71675E]">/{b.slug}</div>
                    )}
                  </td>

                  {/* Contact */}
                  <td className="px-3.5 py-3">
                    {b.phone && (
                      <div className="flex items-center gap-1 font-mono text-[11px] text-[#292320]">
                        <Phone className="h-3 w-3 text-[#71675E]" />
                        <span>{b.phone}</span>
                      </div>
                    )}
                    {b.email && (
                      <div className="flex items-center gap-1 text-[10px] text-[#71675E] mt-0.5">
                        <Mail className="h-2.5 w-2.5" />
                        <span>{b.email}</span>
                      </div>
                    )}
                  </td>

                  {/* PAN / VAT */}
                  <td className="px-3.5 py-3 font-mono text-[11px] text-[#71675E]">
                    {b.panVat || "—"}
                  </td>

                  {/* Plan */}
                  <td className="px-3.5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#6B2837]">
                      {b.planName || b.subscription?.plan || b.plan || "STANDARD"}
                    </span>
                  </td>

                  {/* Branches & Users */}
                  <td className="px-3.5 py-3 text-center text-[11px] text-[#292320] tabular-nums font-semibold">
                    {b.branchesCount ?? 1} branches • {b.usersCount ?? 1} staff
                  </td>

                  {/* Status */}
                  <td className="px-3.5 py-3">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Active</span>
                      </span>
                    ) : isTrial ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                        <Clock className="h-3 w-3" />
                        <span>Trial</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{b.status}</span>
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                    {b.createdAt ? b.createdAt.split("T")[0] : "Recent"}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedBusinessForInspection(b)}
                        className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                        title="Inspect Tenant"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingBusiness(b)}
                        className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                        title="Edit Tenant"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => updateStatus(b.id, isActive ? "SUSPENDED" : "ACTIVE")}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isActive
                            ? "border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626]"
                            : "border-[#C8DFCD] bg-[#EDF5ED] hover:bg-[#D9EBDC] text-[#2D6A4F]"
                        }`}
                        title={isActive ? "Suspend Tenant" : "Reactivate Tenant"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

