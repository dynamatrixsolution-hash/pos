"use client";

import React from "react";
import { Users, Phone, Mail, MapPin, Edit2, Trash2, Award } from "lucide-react";
import { useCustomersStore } from "../../state/customers.store";
import { CustomerRecord } from "../../models/crm.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const CustomerTable: React.FC = () => {
  const customers = useCustomersStore((s) => s.customers);
  const isLoading = useCustomersStore((s) => s.isLoading);
  const setEditingCustomer = useCustomersStore((s) => s.setEditingCustomer);
  const setDeletingCustomerId = useCustomersStore((s) => s.setDeletingCustomerId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <Users className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Customers Found</h3>
          <p className="text-xs text-[#71675E]">
            Add regular customers or guest records to enable quick POS lookup and credit tracking.
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
              <th className="px-3.5 py-3">Customer Name</th>
              <th className="px-3.5 py-3">Contact</th>
              <th className="px-3.5 py-3">PAN / VAT</th>
              <th className="px-3.5 py-3">Address</th>
              <th className="px-3.5 py-3 text-right">Loyalty Points</th>
              <th className="px-3.5 py-3 text-right">Outstanding Due</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                {/* Name */}
                <td className="px-3.5 py-3">
                  <div className="font-bold text-[#292320]">{c.name}</div>
                </td>

                {/* Contact */}
                <td className="px-3.5 py-3">
                  {c.phone && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#292320]">
                      <Phone className="h-3 w-3 text-[#71675E]" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#71675E] mt-0.5">
                      <Mail className="h-2.5 w-2.5" />
                      <span>{c.email}</span>
                    </div>
                  )}
                </td>

                {/* PAN / VAT */}
                <td className="px-3.5 py-3 font-mono text-[11px] text-[#71675E]">
                  {c.panVat || "—"}
                </td>

                {/* Address */}
                <td className="px-3.5 py-3 text-[11px] text-[#71675E] max-w-[200px] truncate">
                  {c.address ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>

                {/* Loyalty */}
                <td className="px-3.5 py-3 text-right font-mono font-bold text-[#6B2837] tabular-nums">
                  <div className="flex items-center justify-end gap-1">
                    <Award className="h-3 w-3 text-[#D97706]" />
                    <span>{c.loyaltyPoints || 0} pts</span>
                  </div>
                </td>

                {/* Outstanding */}
                <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums">
                  <span
                    className={
                      Number(c.outstandingBalance) > 0 ? "text-[#DC2626]" : "text-[#71675E]"
                    }
                  >
                    {formatNPR(c.outstandingBalance)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3.5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCustomer(c)}
                      className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                      title="Edit Customer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingCustomerId(c.id)}
                      className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] transition-colors cursor-pointer"
                      title="Delete Customer"
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

