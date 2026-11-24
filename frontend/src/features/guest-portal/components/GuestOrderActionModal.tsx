"use client";

import React, { useState } from "react";
import { X, Ban, ShoppingBag, Truck, MapPin, Loader2, AlertCircle } from "lucide-react";

export type GuestOrderModalMode = "CANCEL" | "PACK_TAKEAWAY" | "REQUEST_DELIVERY";

interface OrderLineLite {
  id: string;
  itemName: string;
  quantity: number;
  fulfillmentStatus: string;
}

interface GuestOrderActionModalProps {
  mode: GuestOrderModalMode;
  orderNumber: string;
  settlementStatus: string;
  lines: OrderLineLite[];
  cancellationPolicyText?: string;
  refundPolicyText?: string;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmitCancel: (reason: string) => void;
  onSubmitPackTakeaway: (itemIds: string[], notes: string) => void;
  onSubmitDelivery: (payload: {
    itemIds: string[];
    customerName: string;
    phone: string;
    deliveryAddress: string;
    lat?: number | null;
    lng?: number | null;
    notes: string;
  }) => void;
}

export function GuestOrderActionModal({
  mode,
  orderNumber,
  settlementStatus,
  lines,
  cancellationPolicyText,
  refundPolicyText,
  submitting,
  error,
  onClose,
  onSubmitCancel,
  onSubmitPackTakeaway,
  onSubmitDelivery,
}: GuestOrderActionModalProps) {
  const [reason, setReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const isPaid = settlementStatus === "PAID" || settlementStatus === "PARTIAL";
  const activeLines = lines.filter((l) => l.fulfillmentStatus !== "CANCELLED");

  const toggleLine = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCaptureGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "CANCEL") {
      onSubmitCancel(reason.trim());
    } else if (mode === "PACK_TAKEAWAY") {
      onSubmitPackTakeaway(selectedIds, notes.trim());
    } else {
      onSubmitDelivery({
        itemIds: selectedIds,
        customerName: customerName.trim(),
        phone: phone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        notes: notes.trim(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#292320]/45 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-lg sm:rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3.5 border-b border-[#EEE7DD] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "CANCEL" && <Ban className="w-4 h-4 text-[#6B2837]" />}
            {mode === "PACK_TAKEAWAY" && <ShoppingBag className="w-4 h-4 text-[#6B2837]" />}
            {mode === "REQUEST_DELIVERY" && <Truck className="w-4 h-4 text-[#6B2837]" />}
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {mode === "CANCEL"
                  ? isPaid
                    ? "Request Refund"
                    : "Cancel Order"
                  : mode === "PACK_TAKEAWAY"
                  ? "Pack Items for Takeaway"
                  : "Deliver Remaining Food Elsewhere"}
              </h3>
              <p className="text-[11px] text-[#71675E] tabular-nums">Order #{orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto text-xs">
          {error && (
            <div className="p-2.5 rounded-md border border-[#E5B8B8] bg-[#FDF2F2] text-[#8A1F2D] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === "CANCEL" && (
            <>
              <div className="p-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[11px] text-[#71675E] leading-relaxed">
                <span className="font-semibold text-[#292320] block mb-0.5">
                  {isPaid ? "Refund Policy" : "Cancellation Policy"}
                </span>
                {isPaid ? refundPolicyText : cancellationPolicyText}
              </div>
              <div>
                <label className="block font-semibold text-[#292320] mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isPaid
                      ? "Explain the issue for our cashier/manager..."
                      : "e.g. Ordered by mistake, changed my mind..."
                  }
                  className="w-full px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>
            </>
          )}

          {(mode === "PACK_TAKEAWAY" || mode === "REQUEST_DELIVERY") && (
            <>
              <div>
                <label className="block font-semibold text-[#292320] mb-1">
                  Select Items (leave unchecked for all remaining items)
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-[#EEE7DD] rounded-md p-2 bg-[#F7F3EC]">
                  {activeLines.map((line) => (
                    <label
                      key={line.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#FFFCF7] border border-[#EEE7DD] cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-[#292320]">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(line.id)}
                          onChange={() => toggleLine(line.id)}
                          className="accent-[#6B2837]"
                        />
                        <span className="font-medium">
                          {line.quantity}x {line.itemName}
                        </span>
                      </span>
                      <span className="text-[10px] font-semibold text-[#71675E] uppercase">
                        {line.fulfillmentStatus}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {mode === "REQUEST_DELIVERY" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block font-semibold text-[#292320] mb-1">
                      Recipient Name *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full name"
                      className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#292320] mb-1">
                      Recipient Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      minLength={7}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#292320]">
                        Delivery Address / Location *
                      </label>
                      <button
                        type="button"
                        onClick={handleCaptureGps}
                        disabled={locating}
                        className="text-[11px] font-semibold text-[#6B2837] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {locating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        <span>{coords ? "GPS Attached" : "Attach GPS Pin"}</span>
                      </button>
                    </div>
                    <textarea
                      required
                      minLength={5}
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Street, Tole, House/Flat No., Landmark"
                      className="w-full px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#292320] mb-1">
                  Packaging / Delivery Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Separate containers, call on arrival"
                  className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>
            </>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#EEE7DD]">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {mode === "CANCEL"
                  ? isPaid
                    ? "Submit Refund Request"
                    : "Confirm Cancellation"
                  : mode === "PACK_TAKEAWAY"
                  ? "Send Packing Request"
                  : "Send Delivery Request"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
