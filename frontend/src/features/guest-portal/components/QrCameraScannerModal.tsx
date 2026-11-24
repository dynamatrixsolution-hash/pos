"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, QrCode, AlertCircle } from "lucide-react";

interface QrCameraScannerModalProps {
  onClose: () => void;
  onDetected: (code: string) => void;
}

function extractQrPublicCode(raw: string): string {
  const cleaned = (raw || "").trim();
  const match = cleaned.match(/\/guest\/qr\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : cleaned;
}

export function QrCameraScannerModal({ onClose, onDetected }: QrCameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [detectorSupported, setDetectorSupported] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let active = true;

    async function startCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not available in this browser. Enter the table code below.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          setDetectorSupported(false);
          return;
        }

        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const scanFrame = async () => {
          if (!active) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0 && codes[0].rawValue) {
                const extracted = extractQrPublicCode(codes[0].rawValue);
                if (extracted) {
                  active = false;
                  stream?.getTracks().forEach((t) => t.stop());
                  onDetected(extracted);
                  return;
                }
              }
            } catch {
              // continue scanning
            }
          }
          rafId = requestAnimationFrame(scanFrame);
        };
        rafId = requestAnimationFrame(scanFrame);
      } catch {
        setCameraError("Camera permission denied or unavailable. You can enter the table QR code below.");
      }
    }

    startCamera();
    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractQrPublicCode(manualCode);
    if (!code) return;
    onDetected(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#292320]/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-lg sm:rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#EEE7DD] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#6B2837]" />
            <h3 className="text-sm font-bold text-[#292320]">Scan Table / Room QR</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {cameraError ? (
            <div className="p-3 rounded-md border border-[#E5C9A8] bg-[#FFF8ED] text-xs text-[#7A4E0B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          ) : (
            <div className="relative w-full aspect-square max-h-72 rounded-lg overflow-hidden bg-[#292320] border border-[#D8CEC1]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 rounded-lg border-2 border-[#FFFCF7]/90" />
              </div>
              {!detectorSupported && (
                <div className="absolute bottom-2 inset-x-2 p-2 rounded-md bg-[#292320]/85 text-[#FFFCF7] text-[11px] text-center">
                  Use your phone&apos;s camera app to scan the QR, or type the code below.
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-[#71675E]">
              Or enter Table / Room QR code manually
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <QrCode className="w-3.5 h-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. restro-t02"
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold cursor-pointer"
              >
                Open
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
