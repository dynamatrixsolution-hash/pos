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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    const nextErrors: Record<string, string> = {};

    if (mode === "CANCEL") {
      if (reason.trim().length < 3) {
        nextErrors.reason = "Enter at least 3 characters explaining why you want to cancel.";
      }
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      onSubmitCancel(reason.trim());
    } else if (mode === "PACK_TAKEAWAY") {
      onSubmitPackTakeaway(selectedIds, notes.trim());
    } else {
      if (customerName.trim().length < 2) {
        nextErrors.customerName = "Enter the recipient's full name (at least 2 characters).";
      }
      if (phone.replace(/\D/g, "").length < 7) {
        nextErrors.phone = "Enter a valid mobile number (e.g. 98XXXXXXXX) so the rider can call.";
      }
      if (deliveryAddress.trim().length < 5) {
        nextErrors.deliveryAddress = "Enter street, tole, and a nearby landmark so we can locate you.";
      }
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(24, 20, 18, 0.52)" }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-[16px] sm:rounded-[16px] max-h-[90dvh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--guest-surface-raised)",
          border: "1px solid var(--guest-border)",
          boxShadow: "var(--guest-shadow-soft)",
        }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid var(--guest-border)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {mode === "CANCEL" && (
              <Ban className="w-5 h-5 shrink-0" style={{ color: "var(--guest-accent)" }} />
            )}
            {mode === "PACK_TAKEAWAY" && (
              <ShoppingBag className="w-5 h-5 shrink-0" style={{ color: "var(--guest-accent)" }} />
            )}
            {mode === "REQUEST_DELIVERY" && (
              <Truck className="w-5 h-5 shrink-0" style={{ color: "var(--guest-accent)" }} />
            )}
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug truncate">
                {mode === "CANCEL"
                  ? isPaid
                    ? "Request Refund"
                    : "Cancel Order"
                  : mode === "PACK_TAKEAWAY"
                  ? "Pack Items for Takeaway"
                  : "Deliver Food Elsewhere"}
              </h3>
              <p
                className="text-sm font-normal tabular-nums"
                style={{ color: "var(--guest-muted)" }}
              >
                Order #{orderNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 rounded-[8px] inline-flex items-center justify-center cursor-pointer shrink-0"
            style={{
              backgroundColor: "var(--guest-surface-subtle)",
              border: "1px solid var(--guest-border)",
              color: "var(--guest-fg)",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-4 overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-[8px] text-sm flex items-start gap-2"
              style={{
                backgroundColor: "var(--guest-danger-bg)",
                color: "var(--guest-danger)",
                border: "1px solid var(--guest-danger-border)",
              }}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === "CANCEL" && (
            <>
              <div
                className="p-3 rounded-[8px] text-sm leading-relaxed max-w-[65ch]"
                style={{
                  backgroundColor: "var(--guest-surface-subtle)",
                  border: "1px solid var(--guest-border)",
                  color: "var(--guest-muted)",
                }}
              >
                <span className="font-semibold block mb-1" style={{ color: "var(--guest-fg)" }}>
                  {isPaid ? "Refund Policy" : "Cancellation Policy"}
                </span>
                {isPaid ? refundPolicyText : cancellationPolicyText}
              </div>

              <div className="space-y-1">
                <label htmlFor="guest-cancel-reason" className="block text-sm font-semibold">
                  Reason for {isPaid ? "refund" : "cancellation"} *
                </label>
                <textarea
                  id="guest-cancel-reason"
                  rows={3}
                  value={reason}
                  aria-invalid={Boolean(fieldErrors.reason)}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (fieldErrors.reason) setFieldErrors((p) => ({ ...p, reason: "" }));
                  }}
                  placeholder={
                    isPaid
                      ? "Explain the issue so our manager can review..."
                      : "e.g. Ordered by mistake or changed my mind"
                  }
                  className="guest-input"
                />
                {fieldErrors.reason && (
                  <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                    {fieldErrors.reason}
                  </p>
                )}
              </div>
            </>
          )}

          {(mode === "PACK_TAKEAWAY" || mode === "REQUEST_DELIVERY") && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-semibold">
                  Select items (leave unchecked for all remaining)
                </label>
                <div
                  className="max-h-40 overflow-y-auto space-y-2 rounded-[8px] p-2"
                  style={{
                    backgroundColor: "var(--guest-surface-subtle)",
                    border: "1px solid var(--guest-border)",
                  }}
                >
                  {activeLines.map((line) => (
                    <label
                      key={line.id}
                      className="min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] cursor-pointer"
                      style={{
                        backgroundColor: "var(--guest-surface)",
                        border: "1px solid var(--guest-border)",
                      }}
                    >
                      <span className="flex items-center gap-2 text-base">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(line.id)}
                          onChange={() => toggleLine(line.id)}
                          className="w-4 h-4 accent-[#6B2837]"
                        />
                        <span>
                          {line.quantity}× {line.itemName}
                        </span>
                      </span>
                      <span
                        className="text-xs font-semibold uppercase"
                        style={{ color: "var(--guest-muted)" }}
                      >
                        {line.fulfillmentStatus}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {mode === "REQUEST_DELIVERY" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="del-recipient-name" className="block text-sm font-semibold">
                      Recipient Name *
                    </label>
                    <input
                      id="del-recipient-name"
                      type="text"
                      value={customerName}
                      aria-invalid={Boolean(fieldErrors.customerName)}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (fieldErrors.customerName)
                          setFieldErrors((p) => ({ ...p, customerName: "" }));
                      }}
                      placeholder="Full name"
                      className="guest-input"
                    />
                    {fieldErrors.customerName && (
                      <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                        {fieldErrors.customerName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="del-recipient-phone" className="block text-sm font-semibold">
                      Recipient Mobile Number *
                    </label>
                    <input
                      id="del-recipient-phone"
                      type="tel"
                      value={phone}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: "" }));
                      }}
                      placeholder="98XXXXXXXX"
                      className="guest-input tabular-nums"
                    />
                    {fieldErrors.phone && (
                      <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="del-recipient-addr" className="text-sm font-semibold">
                        Delivery Address *
                      </label>
                      <button
                        type="button"
                        onClick={handleCaptureGps}
                        disabled={locating}
                        className="min-h-[36px] px-2 text-sm font-semibold inline-flex items-center gap-1 cursor-pointer"
                        style={{ color: "var(--guest-accent)" }}
                      >
                        {locating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                        <span>{coords ? "GPS Attached" : "Attach GPS"}</span>
                      </button>
                    </div>
                    <textarea
                      id="del-recipient-addr"
                      rows={2}
                      value={deliveryAddress}
                      aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                      onChange={(e) => {
                        setDeliveryAddress(e.target.value);
                        if (fieldErrors.deliveryAddress)
                          setFieldErrors((p) => ({ ...p, deliveryAddress: "" }));
                      }}
                      placeholder="Street, Tole, House/Flat No., Nearby Landmark"
                      className="guest-input"
                    />
                    {fieldErrors.deliveryAddress && (
                      <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                        {fieldErrors.deliveryAddress}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="fulfill-notes" className="block text-sm font-semibold">
                  Packaging or Delivery Note (Optional)
                </label>
                <input
                  id="fulfill-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Separate boxes, call on arrival"
                  className="guest-input"
                />
              </div>
            </>
          )}

          <div
            className="pt-4 flex items-center justify-end gap-3"
            style={{ borderTop: "1px solid var(--guest-border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="guest-btn-secondary px-4 cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="guest-btn-primary px-5 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
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
