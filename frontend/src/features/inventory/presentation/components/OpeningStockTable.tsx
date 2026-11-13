"use client";

import React from "react";
import {
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Building2,
  Calendar,
} from "lucide-react";
import { useInventoryOpeningStore } from "../../state/inventory-opening.store";
import { OpeningStockEntry } from "../../models/inventory.types";

function formatNPR(val: number | string | undefined): string {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const OpeningStockTable: React.FC = () => {
  const entries = useInventoryOpeningStore((s) => s.entries);
  const isLoading = useInventoryOpeningStore((s) => s.isLoading);
  const setEditingEntry = useInventoryOpeningStore((s) => s.setEditingEntry);
  const setDeletingEntryId = useInventoryOpeningStore((s) => s.setDeletingEntryId);
  const setActionConfirmEntry = useInventoryOpeningStore((s) => s.setActionConfirmEntry);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <Layers className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Opening Stock Entries Found</h3>
          <p className="text-xs text-[#71675E]">
            Add opening balance records for physical inventory or adjust current filter criteria.
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
              <th className="px-3.5 py-3">Product / SKU</th>
              <th className="px-3.5 py-3">Branch</th>
              <th className="px-3.5 py-3 text-right">Quantity</th>
              <th className="px-3.5 py-3 text-right">Purchase Rate</th>
              <th className="px-3.5 py-3 text-right">Selling Price</th>
              <th className="px-3.5 py-3 text-right">Total Valuation</th>
              <th className="px-3.5 py-3">Batch &amp; Expiry</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {entries.map((entry) => {
              const isApproved = entry.approvalStatus === "APPROVED";
              const isPending = entry.approvalStatus === "PENDING";
              const isRejected = entry.approvalStatus === "REJECTED";

              return (
                <tr key={entry.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  {/* Product */}
                  <td className="px-3.5 py-3">
                    <div className="font-bold text-[#292320]">{entry.product.name}</div>
                    <div className="text-[10px] text-[#71675E] flex items-center gap-2 mt-0.5">
                      {entry.product.sku && <span>SKU: {entry.product.sku}</span>}
                      {entry.product.barcode && <span>• Barcode: {entry.product.barcode}</span>}
                      {entry.product.category?.name && <span>• {entry.product.category.name}</span>}
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                      <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
                      <span>{entry.branch?.name || "Main Branch"}</span>
                    </div>
                    {entry.rackNumber && (
                      <div className="text-[10px] text-[#71675E] flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span>Rack: {entry.rackNumber}</span>
                      </div>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="px-3.5 py-3 text-right font-bold text-[#292320] tabular-nums">
                    {entry.quantity} {entry.unitType || "pcs"}
                  </td>

                  {/* Purchase Rate */}
                  <td className="px-3.5 py-3 text-right font-mono text-[#71675E] tabular-nums">
                    {formatNPR(entry.purchaseRate)}
                  </td>

                  {/* Selling Price */}
                  <td className="px-3.5 py-3 text-right font-mono text-[#292320] tabular-nums">
                    {formatNPR(entry.sellingPrice)}
                  </td>

                  {/* Total Valuation */}
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-[#6B2837] tabular-nums">
                    {formatNPR(entry.totalValue || entry.quantity * entry.purchaseRate)}
                  </td>

                  {/* Batch & Expiry */}
                  <td className="px-3.5 py-3">
                    {entry.batchNumber ? (
                      <div className="font-mono text-[11px] font-semibold text-[#292320]">
                        Batch: {entry.batchNumber}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#71675E] italic">Standard batch</span>
                    )}
                    {entry.expiryDate && (
                      <div className="text-[10px] text-[#71675E] flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        <span>Exp: {entry.expiryDate.split("T")[0]}</span>
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3.5 py-3">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Approved</span>
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                        <XCircle className="h-3 w-3" />
                        <span>Rejected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        <Clock className="h-3 w-3" />
                        <span>Pending</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActionConfirmEntry({ entry, action: "APPROVE" })}
                            className="p-1.5 rounded-lg border border-[#C8DFCD] bg-[#EDF5ED] hover:bg-[#D9EBDC] text-[#2D6A4F] transition-colors cursor-pointer"
                            title="Approve entry into live ledger"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionConfirmEntry({ entry, action: "REJECT" })}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] transition-colors cursor-pointer"
                            title="Reject entry"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                          title="Edit opening balance"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingEntryId(entry.id)}
                        className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 text-[#71675E] hover:text-[#DC2626] transition-colors cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

