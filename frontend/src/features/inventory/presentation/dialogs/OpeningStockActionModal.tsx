"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Trash2, X } from "lucide-react";
import { useInventoryOpeningStore } from "../../state/inventory-opening.store";

export const OpeningStockActionModal: React.FC = () => {
  const deletingEntryId = useInventoryOpeningStore((s) => s.deletingEntryId);
  const setDeletingEntryId = useInventoryOpeningStore((s) => s.setDeletingEntryId);
  const deleteEntry = useInventoryOpeningStore((s) => s.deleteEntry);

  const actionConfirmEntry = useInventoryOpeningStore((s) => s.actionConfirmEntry);
  const setActionConfirmEntry = useInventoryOpeningStore((s) => s.setActionConfirmEntry);
  const updateApprovalStatus = useInventoryOpeningStore((s) => s.updateApprovalStatus);

  const isSaving = useInventoryOpeningStore((s) => s.isSaving);
  const [reason, setReason] = useState("");

  // 1. Delete Confirmation Modal
  if (deletingEntryId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-[#DC2626] shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#292320]">Delete Opening Stock Record?</h4>
              <p className="text-xs text-[#71675E] mt-1 leading-relaxed">
                This will delete this opening stock entry from the ledger. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingEntryId(null)}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => deleteEntry(deletingEntryId)}
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

  // 2. Approval or Rejection Modal
  if (actionConfirmEntry) {
    const isApprove = actionConfirmEntry.action === "APPROVE";
    const entry = actionConfirmEntry.entry;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
        <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isApprove ? "bg-[#EDF5ED] text-[#2D6A4F]" : "bg-red-100 text-[#DC2626]"
              }`}
            >
              {isApprove ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#292320]">
                {isApprove ? "Approve Opening Stock Entry" : "Reject Opening Stock Entry"}
              </h4>
              <p className="text-xs text-[#71675E] mt-1 leading-relaxed">
                {isApprove
                  ? `Confirm approval for ${entry.quantity} ${entry.unitType} of ${entry.product.name} at ${entry.branch.name}. This will credit live branch stock inventory.`
                  : `Reject opening stock entry for ${entry.product.name}. Stock will not be credited.`}
              </p>
            </div>
          </div>

          {!isApprove && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Rejection Reason</label>
              <input
                type="text"
                placeholder="Reason for rejection..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          )}

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setActionConfirmEntry(null)}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                updateApprovalStatus(entry.id, isApprove ? "APPROVED" : "REJECTED", reason)
              }
              disabled={isSaving}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                isApprove ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#DC2626] hover:bg-[#B91C1C]"
              }`}
            >
              {isApprove ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>
                {isSaving
                  ? "Updating..."
                  : isApprove
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

