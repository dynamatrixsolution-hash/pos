"use client";

import React, { useState, useEffect } from "react";
import { QrCode, X, Copy, Check, Printer } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { hotelRepository } from "../../repositories/hotel.repository";
import { DeterministicQrMatrixSvg } from "@/components/qr-matrix-svg";

export const RoomQrModal: React.FC = () => {
  const show = useHotelUiStore((s) => s.showQrModal);
  const setShow = useHotelUiStore((s) => s.setShowQrModal);
  const selectedRoomForAction = useHotelUiStore((s) => s.selectedRoomForAction);

  const [qrData, setQrData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (show && selectedRoomForAction) {
      setLoading(true);
      hotelRepository
        .getQrLocation(selectedRoomForAction.id, `Room ${selectedRoomForAction.roomNumber}`)
        .then((res) => setQrData(res))
        .catch(() => setQrData(null))
        .finally(() => setLoading(false));
    }
  }, [show, selectedRoomForAction]);

  if (!show || !selectedRoomForAction) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const guestUrl = qrData?.publicCode
    ? `${origin}/guest/qr/${qrData.publicCode}`
    : `${origin}/guest/room/${selectedRoomForAction.roomNumber}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl text-center">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">
              In-Room Dining QR Plaque
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Code Canvas Card */}
        <div className="p-4 rounded-xl border border-[#D8CEC1] bg-white space-y-3 shadow-inner">
          <div className="text-xs font-bold text-[#71675E] uppercase tracking-wider">
            Room {selectedRoomForAction.roomNumber}
          </div>
          <div className="flex justify-center p-2">
            {loading ? (
              <div className="h-44 w-44 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
              </div>
            ) : (
              <DeterministicQrMatrixSvg
                value={guestUrl}
                size={180}
                className="mx-auto"
              />
            )}
          </div>
          <p className="text-[11px] text-[#71675E]">
            Guests can scan this QR in room to view menu, place room service orders, and request housekeeping.
          </p>
        </div>

        {/* URL Pill & Copy */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] text-xs">
          <span className="font-mono text-[10px] text-[#71675E] truncate">{guestUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1 rounded border border-[#D8CEC1] bg-white text-xs font-semibold text-[#292320] flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copied ? <Check className="h-3 w-3 text-[#16A34A]" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320] flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Plaque</span>
          </button>

          <button
            type="button"
            onClick={() => setShow(false)}
            className="px-4 py-1.5 rounded-lg bg-[#6B2837] text-white text-xs font-bold hover:bg-[#59222e] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

