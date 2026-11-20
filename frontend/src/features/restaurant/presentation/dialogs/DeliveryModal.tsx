"use client";

import React, { useState } from "react";
import { Truck, X } from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";

export const DeliveryModal: React.FC = () => {
  const showDeliveryModal = usePosUiStore((s) => s.showDeliveryModal);
  const setShowDeliveryModal = usePosUiStore((s) => s.setShowDeliveryModal);
  const deliveryModalMode = usePosUiStore((s) => s.deliveryModalMode);
  const setDeliveryModalMode = usePosUiStore((s) => s.setDeliveryModalMode);

  const setDeliveryCharge = usePosCartStore((s) => s.setDeliveryCharge);
  const setOrderNotes = usePosCartStore((s) => s.setOrderNotes);
  const orderNotes = usePosCartStore((s) => s.orderNotes);
  const convertActiveOrderType = usePosTicketsStore((s) => s.convertActiveOrderType);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [riderName, setRiderName] = useState("In-House Rider");
  const [deliveryFee, setDeliveryFee] = useState("100");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!showDeliveryModal) return null;

  const handleClose = () => {
    setDeliveryModalMode("NEW");
    setShowDeliveryModal(false);
  };

  const handleSave = async () => {
    const feeNum = parseFloat(deliveryFee) || 0;
    setDeliveryCharge(feeNum);

    if (deliveryModalMode === "CONVERT_ACTIVE") {
      setIsSaving(true);
      const ok = await convertActiveOrderType("DELIVERY", {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        riderName,
        deliveryFee: feeNum,
        notes: notes.trim(),
      });
      setIsSaving(false);
      if (ok) {
        setDeliveryModalMode("NEW");
        setShowDeliveryModal(false);
      }
      return;
    }

    const deliverySummary = `[DELIVERY to ${customerName || "Customer"} (${phone || "N/A"}) - ${address || "No address"} via ${riderName}${notes ? ` | ${notes}` : ""}]`;
    const cleanedNotes = orderNotes.replace(/\[DELIVERY[^\]]*\]\s*/gi, "").trim();
    const updatedNotes = cleanedNotes ? `${deliverySummary} ${cleanedNotes}` : deliverySummary;
    setOrderNotes(updatedNotes);
    setDeliveryModalMode("NEW");
    setShowDeliveryModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              {deliveryModalMode === "CONVERT_ACTIVE"
                ? "Convert Order to Delivery"
                : "Delivery Details"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Thapa"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 9841234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">
              Delivery Address / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. House 45, Lazimpat, near Embassy..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">
                Rider / Partner
              </label>
              <select
                value={riderName}
                onChange={(e) => setRiderName(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="In-House Rider">In-House Rider</option>
                <option value="Pathao Food">Pathao Food</option>
                <option value="Foodmandu">Foodmandu</option>
                <option value="Bhojdeals">Bhojdeals</option>
                <option value="Customer Pick-up">Customer Pick-up</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">
                Delivery Fee (Rs.)
              </label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292320] mb-1">Delivery Notes</label>
            <input
              type="text"
              placeholder="e.g. Call upon arrival, ring left bell..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus:border-[#6B2837] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            {isSaving
              ? "Converting..."
              : deliveryModalMode === "CONVERT_ACTIVE"
              ? "Convert to Delivery"
              : "Save Delivery Info"}
          </button>
        </div>
      </div>
    </div>
  );
};
