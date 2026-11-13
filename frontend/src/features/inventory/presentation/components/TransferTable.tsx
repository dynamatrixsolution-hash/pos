"use client";

import React, { useMemo } from "react";
import {
  ArrowRightLeft,
  Eye,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Building2,
  Calendar,
  Layers,
} from "lucide-react";
import { useInventoryTransfersStore } from "../../state/inventory-transfers.store";
import { StockTransfer, TransferStatus } from "../../models/inventory.types";

function getStatusBadge(status: TransferStatus) {
  switch (status) {
    case "PENDING":
      return {
        label: "Pending Approval",
        className: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
        icon: ArrowRightLeft,
      };
    case "APPROVED":
      return {
        label: "Approved",
        className: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
        icon: CheckCircle2,
      };
    case "IN_TRANSIT":
      return {
        label: "Dispatched / In Transit",
        className: "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]",
        icon: Truck,
      };
    case "RECEIVED":
      return {
        label: "Received",
        className: "bg-[#EDF5ED] text-[#2D6A4F] border-[#C8DFCD]",
        icon: PackageCheck,
      };
    case "REJECTED":
    case "CANCELLED":
      return {
        label: status === "REJECTED" ? "Rejected" : "Cancelled",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: XCircle,
      };
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-800 border-gray-200",
        icon: ArrowRightLeft,
      };
  }
}

export const TransferTable: React.FC = () => {
  const transfers = useInventoryTransfersStore((s) => s.transfers);
  const isLoading = useInventoryTransfersStore((s) => s.isLoading);
  const search = useInventoryTransfersStore((s) => s.search);
  const setSelectedTransferForView = useInventoryTransfersStore((s) => s.setSelectedTransferForView);
  const setSelectedTransferForAction = useInventoryTransfersStore(
    (s) => s.setSelectedTransferForAction
  );

  const filteredTransfers = useMemo(() => {
    if (!search.trim()) return transfers;
    const q = search.toLowerCase().trim();
    return transfers.filter(
      (t) =>
        t.transferNumber?.toLowerCase().includes(q) ||
        t.sourceBranch?.name?.toLowerCase().includes(q) ||
        t.destinationBranch?.name?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q)
    );
  }, [transfers, search]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        ))}
      </div>
    );
  }

  if (filteredTransfers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <ArrowRightLeft className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">No Stock Transfers Found</h3>
          <p className="text-xs text-[#71675E]">
            {transfers.length === 0
              ? "No stock transfer movements have been initiated yet."
              : `No transfers match "${search}".`}
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
              <th className="px-3.5 py-3">Transfer #</th>
              <th className="px-3.5 py-3">From (Source)</th>
              <th className="px-3.5 py-3">To (Destination)</th>
              <th className="px-3.5 py-3 text-center">Items</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3">Date</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {filteredTransfers.map((t) => {
              const statusMeta = getStatusBadge(t.status);
              const StatusIcon = statusMeta.icon;
              const totalQty = (t.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);

              return (
                <tr key={t.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  {/* Transfer # */}
                  <td className="px-3.5 py-3">
                    <span className="font-mono font-bold text-[#6B2837]">
                      {t.transferNumber || `TRF-${t.id.slice(0, 8)}`}
                    </span>
                    {t.notes && (
                      <p className="text-[10px] text-[#71675E] truncate max-w-[200px] mt-0.5">
                        {t.notes}
                      </p>
                    )}
                  </td>

                  {/* Source Branch */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                      <Building2 className="h-3.5 w-3.5 text-[#71675E]" />
                      <span>{t.sourceBranch?.name || "Main Hub"}</span>
                    </div>
                  </td>

                  {/* Destination Branch */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-[#292320]">
                      <Building2 className="h-3.5 w-3.5 text-[#6B2837]" />
                      <span>{t.destinationBranch?.name || "Target Branch"}</span>
                    </div>
                  </td>

                  {/* Items Count */}
                  <td className="px-3.5 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] tabular-nums">
                      {t.items?.length || 0} items ({totalQty} qty)
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusMeta.label}</span>
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-3.5 py-3 text-[11px] text-[#71675E]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{t.createdAt ? t.createdAt.split("T")[0] : "Recent"}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTransferForView(t)}
                        className="p-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer"
                        title="View transfer details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {t.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => setSelectedTransferForAction({ transfer: t, action: "APPROVE" })}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#C8DFCD] bg-[#EDF5ED] hover:bg-[#D9EBDC] text-[#2D6A4F] transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      {t.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => setSelectedTransferForAction({ transfer: t, action: "DISPATCH" })}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1E40AF] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Truck className="h-3 w-3" />
                          <span>Dispatch</span>
                        </button>
                      )}

                      {t.status === "IN_TRANSIT" && (
                        <button
                          type="button"
                          onClick={() => setSelectedTransferForAction({ transfer: t, action: "RECEIVE" })}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <PackageCheck className="h-3 w-3" />
                          <span>Receive</span>
                        </button>
                      )}
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

