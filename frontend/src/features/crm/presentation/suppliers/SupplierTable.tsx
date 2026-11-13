"use client";

import React from "react";
import { Truck, Phone, Mail, MapPin, Edit2, Trash2, User } from "lucide-react";
import { useSuppliersStore } from "../../state/suppliers.store";
import { SupplierRecord } from "../../models/crm.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const SupplierTable: React.FC = () => {
  const suppliers = useSuppliersStore((s) => s.suppliers);
  const isLoading = useSuppliersStore((s) => s.isLoading);
  const setEditingSupplier = useSuppliersStore((s) => s.setEditingSupplier);
  const setDeletingSupplierId = useSuppliersStore((s) => s.setDeletingSupplierId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <Truck className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Suppliers Found</h3>
          <p className="text-xs text-[#71675E]">
            Add vendor suppliers to create purchase bills, track incoming inventory, and manage payables.
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
              <th className="px-3.5 py-3">Supplier / Business</th>
              <th className="px-3.5 py-3">Contact Person</th>
              <th className="px-3.5 py-3">Phone &amp; Email</th>
              <th className="px-3.5 py-3">PAN / VAT</th>
              <th className="px-3.5 py-3">Address</th>
              <th className="px-3.5 py-3 text-right">Payable Balance</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                {/* Business Name */}
                <td className="px-3.5 py-3">
                  <div className="font-bold text-[#292320]">{s.name}</div>
                </td>

                {/* Contact Person */}
                <td className="px-3.5 py-3">
                  {s.contactPerson ? (
                    <div className="flex items-center gap-1 text-[#292320]">
                      <User className="h-3 w-3 text-[#71675E]" />
                      <span>{s.contactPerson}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#71675E] italic">—</span>
                  )}
                </td>

                {/* Contact Details */}
                <td className="px-3.5 py-3">
                  {s.phone && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#292320]">
                      <Phone className="h-3 w-3 text-[#71675E]" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#71675E] mt-0.5">
                      <Mail className="h-2.5 w-2.5" />
                      <span>{s.email}</span>
                    </div>
                  )}
                </td>

                {/* PAN / VAT */}
                <td className="px-3.5 py-3 font-mono text-[11px] text-[#71675E]">
                  {s.panVat || "—"}
                </td>

                {/* Address */}
                <td className="px-3.5 py-3 text-[11px] text-[#71675E] max-w-[200px] truncate">
                  {s.address ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>

                {/* Balance */}
                <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums">
                  <span
                    className={
                      Number(s.balance) > 0 ? "text-[#DC2626]" : "text-[#71675E]"
                    }
                  >
                    {formatNPR(s.balance)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3.5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingSupplier(s)}
                      className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingSupplierId(s.id)}
                      className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] transition-colors cursor-pointer"
                      title="Delete Supplier"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

