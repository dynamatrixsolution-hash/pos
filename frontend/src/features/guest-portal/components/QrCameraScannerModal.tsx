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
  const [codeError, setCodeError] = useState<string | null>(null);
  const [detectorSupported, setDetectorSupported] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let active = true;

    async function startCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera access is unavailable in this browser. Type the table code printed under the QR below."
        );
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
        setCameraError(
          "Camera permission was denied. Allow camera access in browser settings or enter the table code below."
        );
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
    if (code.length < 3) {
      setCodeError("Enter the code shown under your table QR (for example: restro-t02).");
      return;
    }
    setCodeError(null);
    onDetected(code);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(24, 20, 18, 0.56)" }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-[16px] sm:rounded-[16px] overflow-hidden"
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
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 shrink-0" style={{ color: "var(--guest-accent)" }} />
            <h3 className="text-base font-semibold">Scan Table or Room QR</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="w-11 h-11 rounded-[8px] inline-flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor: "var(--guest-surface-subtle)",
              border: "1px solid var(--guest-border)",
              color: "var(--guest-fg)",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {cameraError ? (
            <div
              className="p-3 rounded-[8px] text-sm flex items-start gap-2 max-w-[65ch]"
              style={{
                backgroundColor: "var(--guest-warning-bg)",
                color: "var(--guest-warning)",
                border: "1px solid var(--guest-warning-border)",
              }}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          ) : (
            <div
              className="relative w-full aspect-square max-h-72 rounded-[8px] overflow-hidden bg-[#181412]"
              style={{ border: "1px solid var(--guest-border)" }}
            >
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 rounded-[12px] border-2 border-[#FFFCF7]/90" />
              </div>
              {!detectorSupported && (
                <div className="absolute bottom-2 inset-x-2 p-2 rounded-[8px] bg-[#181412]/85 text-[#FFFCF7] text-sm text-center">
                  Point your phone&apos;s camera app at the QR, or type the table code below.
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleManualSubmit} noValidate className="space-y-2">
            <label htmlFor="manual-qr-code" className="block text-sm font-semibold">
              Table or Room QR Code
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <QrCode
                  className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--guest-muted)" }}
                />
                <input
                  id="manual-qr-code"
                  type="text"
                  value={manualCode}
                  aria-invalid={Boolean(codeError)}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="e.g. restro-t02"
                  className="guest-input pl-10"
                />
              </div>
              <button type="submit" className="guest-btn-primary px-5 cursor-pointer shrink-0">
                Open
              </button>
            </div>
            {codeError && (
              <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                {codeError}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
