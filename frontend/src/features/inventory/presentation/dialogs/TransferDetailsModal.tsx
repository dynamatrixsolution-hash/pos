"use client";

import React, { useState } from "react";
import {
  X,
  ArrowRightLeft,
  Building2,
  Calendar,
  Truck,
  CheckCircle2,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { useInventoryTransfersStore } from "../../state/inventory-transfers.store";

export const TransferDetailsModal: React.FC = () => {
  const selectedTransfer = useInventoryTransfersStore((s) => s.selectedTransferForView);
  const setSelectedTransfer = useInventoryTransfersStore((s) => s.setSelectedTransferForView);
  const executeTransferAction = useInventoryTransfersStore((s) => s.executeTransferAction);
  const isSaving = useInventoryTransfersStore((s) => s.isSaving);

  const [notes, setNotes] = useState("");

  if (!selectedTransfer) return null;

  const t = selectedTransfer;

  const handleAction = async (action: "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL") => {
    await executeTransferAction(t.id, action, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Transfer #{t.transferNumber || t.id.slice(0, 8)}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {t.sourceBranch?.name} → {t.destinationBranch?.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedTransfer(null)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Route Info Cards */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#71675E]">Source (From)</span>
            <div className="font-bold text-[#292320] mt-0.5">{t.sourceBranch?.name}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#71675E]">Destination (To)</span>
            <div className="font-bold text-[#6B2837] mt-0.5">{t.destinationBranch?.name}</div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <span className="text-xs font-bold text-[#292320]">Transfer Items List</span>
          <div className="space-y-1.5 divide-y divide-[#D8CEC1]/60">
            {t.items?.map((item) => (
              <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-[#292320]">{item.product?.name || "Product"}</div>
                  <div className="text-[10px] text-[#71675E]">
                    SKU: {item.product?.sku || "N/A"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#292320] tabular-nums">
                    {item.quantity} {item.product?.unit?.name || "units"}
                  </div>
                  {item.receivedQuantity != null && (
                    <div className="text-[10px] text-[#2D6A4F] font-bold">
                      Received: {item.receivedQuantity}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons based on status */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedTransfer(null)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {t.status === "PENDING" && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction("REJECT")}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("APPROVE")}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer shadow-xs"
                >
                  Approve Transfer
                </button>
              </>
            )}

            {t.status === "APPROVED" && (
              <button
                type="button"
                onClick={() => handleAction("DISPATCH")}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#1E40AF] hover:bg-[#1D4ED8] text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Mark Dispatched (In Transit)</span>
              </button>
            )}

            {t.status === "IN_TRANSIT" && (
              <button
                type="button"
                onClick={() => handleAction("RECEIVE")}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                <span>Confirm Delivery &amp; Receive Stock</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

