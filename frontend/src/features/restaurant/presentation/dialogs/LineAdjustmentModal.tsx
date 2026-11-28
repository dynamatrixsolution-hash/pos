"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X, Minus, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosUiStore } from "../../state/pos-ui.store";

export const LineAdjustmentModal: React.FC = () => {
  const adjustingLine = usePosTicketsStore((s) => s.adjustingLine);
  const setAdjustingLine = usePosTicketsStore((s) => s.setAdjustingLine);
  const isUpdatingLine = usePosTicketsStore((s) => s.isUpdatingLine);
  const submitAdjustLine = usePosTicketsStore((s) => s.submitAdjustLine);
  const orderType = usePosUiStore((s) => s.orderType);

  const [mode, setMode] = useState<"CANCEL" | "ADJUST_QTY">("CANCEL");
  const [reason, setReason] = useState("Customer requested cancellation");
  const [newQuantity, setNewQuantity] = useState(1);

  useEffect(() => {
    if (adjustingLine) {
      setMode("CANCEL");
      setReason("Customer requested cancellation");
      setNewQuantity(Math.max(1, (adjustingLine.currentQty || 1) - 1));
    }
  }, [adjustingLine?.lineId, adjustingLine?.currentQty]);

  useEffect(() => {
    if (!adjustingLine) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUpdatingLine) setAdjustingLine(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjustingLine, isUpdatingLine, setAdjustingLine]);

  if (!adjustingLine) return null;

  const maxQty = adjustingLine.currentQty || 1;
  const isAlreadyTakeaway = /\b(TAKEAWAY|PARCEL)\b/i.test(adjustingLine.notes || "");
  const isPreparingInKitchen = adjustingLine.fulfillmentStatus === "PREPARING";
  const isReadyInKitchen = adjustingLine.fulfillmentStatus === "READY";

  const handleToggleServingNote = async () => {
    const cleaned = (adjustingLine.notes || "")
      .replace(/\[(DINE-IN|TAKEAWAY|DELIVERY|PARCEL)\]/gi, "")
      .trim();
    const tag = isAlreadyTakeaway ? "[DINE-IN]" : "[TAKEAWAY]";
    const updatedNotes = cleaned ? `${tag} ${cleaned}` : tag;
    await submitAdjustLine("UPDATE_NOTES", undefined, undefined, updatedNotes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "CANCEL") {
      await submitAdjustLine("CANCEL", reason);
    } else if (maxQty > 1) {
      await submitAdjustLine("ADJUST_QTY", reason, newQuantity);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-[#292320]/40 p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-adjustment-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUpdatingLine) setAdjustingLine(null);
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-start justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h4 id="line-adjustment-title" className="text-sm font-bold text-[#292320]">Adjust or Cancel Item</h4>
              <p className="text-[11px] text-[#71675E] font-medium truncate max-w-[200px] tabular-nums">
                {adjustingLine.itemName} ({adjustingLine.currentQty}x)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdjustingLine(null)}
            aria-label="Close modal"
            className="text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(isPreparingInKitchen || isReadyInKitchen) && (
          <div className="p-2.5 rounded-lg border border-[#EDD7AD] bg-[#FDF5E7] text-[#946000] text-[11px] leading-snug flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {isPreparingInKitchen ? "Currently Preparing in Kitchen" : "Already Marked Ready at Kitchen Pass"}
              </span>
              <span>
                {isPreparingInKitchen
                  ? "Confirming cancellation will immediately send an URGENT Stop Prep alert to kitchen staff."
                  : "Verify with kitchen before voiding so food waste is tracked accurately."}
              </span>
            </div>
          </div>
        )}

        {/* One-Click Pack / Plate Serving Switch for Dine-In Dishes */}
        {orderType === "DINE_IN" && (
          <div className="p-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#292320]">
                {isAlreadyTakeaway ? "Marked as Takeaway Parcel" : "Served on Table"}
              </div>
              <div className="text-[10px] text-[#71675E] truncate">
                {isAlreadyTakeaway ? "Switch back to Dine-In plate" : "Pack remaining dish to-go"}
              </div>
            </div>
            <button
              type="button"
              disabled={isUpdatingLine}
              onClick={handleToggleServingNote}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 transition-colors ${
                isAlreadyTakeaway
                  ? "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0] hover:bg-[#DCECE3]"
                  : "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD] hover:bg-[#F7E9CE]"
              }`}
            >
              {isAlreadyTakeaway ? (
                <>
                  <UtensilsCrossed className="h-3 w-3" />
                  <span>Switch to Dine-In</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="h-3 w-3" />
                  <span>Pack as Takeaway</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Action Type Selector */}
        <div className="flex rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode("CANCEL")}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              mode === "CANCEL"
                ? "bg-[#B33432] text-white"
                : "text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Cancel Item
          </button>
          <button
            type="button"
            disabled={maxQty <= 1}
            onClick={() => {
              setMode("ADJUST_QTY");
              setNewQuantity(Math.max(1, maxQty - 1));
            }}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === "ADJUST_QTY"
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320]"
            } ${maxQty > 1 ? "cursor-pointer" : ""}`}
          >
            Reduce Quantity
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "ADJUST_QTY" && (
            <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-[#292320]">
                <span>Adjusted Quantity:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewQuantity((q) => Math.max(1, q - 1))}
                    disabled={newQuantity <= 1}
                    className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-sm tabular-nums">
                    {newQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewQuantity((q) => Math.min(maxQty - 1, q + 1))}
                    disabled={newQuantity >= maxQty - 1}
                    className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#71675E] tabular-nums">
                Original: {maxQty}x &bull; Remaining: {newQuantity}x &bull; Cancelled: {maxQty - newQuantity}x
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Reason for {mode === "CANCEL" ? "Cancellation" : "Adjustment"}
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Guest changed mind, packed instead, out of stock..."
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdjustingLine(null)}
              disabled={isUpdatingLine}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isUpdatingLine}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors ${
                mode === "CANCEL"
                  ? "bg-[#B33432] hover:bg-[#992826]"
                  : "bg-[#6B2837] hover:bg-[#541E2A]"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {isUpdatingLine
                  ? "Updating..."
                  : mode === "CANCEL"
                  ? "Confirm Cancel Dish"
                  : "Update Quantity"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
