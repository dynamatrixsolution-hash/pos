"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X, RefreshCw } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  continuous?: boolean;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode",
  continuous = false,
}: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "barcode-scanner-viewport";

  // 1. Initialize Html5Qrcode and list cameras once on open
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    const html5QrCode = new Html5Qrcode(scannerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    scannerRef.current = html5QrCode;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera initially
          const back = devices.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(back ? back.id : devices[0].id);
        } else {
          setSelectedCameraId("facingMode:environment");
        }
      })
      .catch((err) => {
        console.warn("Failed to list cameras, falling back to facingMode environment:", err);
        setSelectedCameraId("facingMode:environment");
      });

    return () => {
      // Safe synchronous stop check on unmount
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch((e) => console.warn("Cleanup stop ignored:", e));
      }
    };
  }, [isOpen]);

  // 2. Coordinated camera start/stop hook to prevent race conditions on camera switching
  useEffect(() => {
    if (!isOpen || !selectedCameraId || !scannerRef.current) return;

    let isComponentMounted = true;
    const html5QrCode = scannerRef.current;

    const playBeep = () => {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        const audioCtx = new AudioCtxClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(950, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.07);
      } catch (e) {
        console.warn("Audio Context beep block:", e);
      }
    };

    let lastScannedText = "";
    let lastScanTime = 0;

    const startCamera = async () => {
      setLoading(true);
      setError(null);

      // If already scanning, stop the scanner first and wait for the DOM to settle
      if (html5QrCode.isScanning) {
        try {
          await html5QrCode.stop();
        } catch (e) {
          console.warn("Ignored error stopping camera during switch:", e);
        }
        // Small delay to allow browser media track release and DOM elements cleanup
        await new Promise((resolve) => setTimeout(resolve, 180));
      }

      if (!isComponentMounted) return;

      const cameraInput = selectedCameraId.startsWith("facingMode:")
        ? { facingMode: selectedCameraId.split(":")[1] }
        : selectedCameraId;

      try {
        await html5QrCode.start(
          cameraInput,
          {
            fps: 15,
            qrbox: (width, height) => {
              const boxWidth = Math.max(Math.min(width * 0.85, 260), 200);
              const boxHeight = Math.max(Math.min(height * 0.65, 180), 130);
              return { width: boxWidth, height: boxHeight };
            },
            videoConstraints: typeof cameraInput === "object" ? {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            } : undefined,
          },
          (decodedText) => {
            const now = Date.now();
            if (continuous && decodedText === lastScannedText && now - lastScanTime < 2200) {
              return;
            }

            playBeep();
            lastScannedText = decodedText;
            lastScanTime = now;
            onScan(decodedText);

            if (!continuous) {
              html5QrCode.stop().then(() => {
                if (isComponentMounted) onClose();
              }).catch(() => {
                if (isComponentMounted) onClose();
              });
            }
          },
          () => {
            // Ignore normal frame-parse failures
          }
        );

        if (isComponentMounted) {
          setLoading(false);
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Error starting camera device:", err);
        if (isComponentMounted) {
          setError("Failed to start camera. Please ensure permissions are granted.");
          setLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      isComponentMounted = false;
    };
  }, [isOpen, selectedCameraId, continuous, onClose, onScan]);

  const cycleCamera = () => {
    if (cameras.length <= 1 || !selectedCameraId) return;
    const currentIdx = cameras.findIndex((c) => c.id === selectedCameraId);
    if (currentIdx === -1) return;
    const nextIdx = (currentIdx + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIdx].id);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center gap-4 text-white shadow-2xl overflow-hidden">
        {/* Animated slide down scanning indicators */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[#2563EB] opacity-40 animate-pulse shadow-[0_0_15px_#2563EB]" />

        <div className="flex justify-between items-center w-full pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="h-4.5 w-4.5 text-[#2563EB]" />
            <h3 className="text-xs font-bold tracking-wide">{title}</h3>
          </div>
          <div className="flex items-center">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={cycleCamera}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer mr-1.5"
                title="Switch Camera Lens"
              >
                <RefreshCw className="h-4.5 w-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (scannerRef.current && scannerRef.current.isScanning) {
                  scannerRef.current.stop().then(onClose).catch(onClose);
                } else {
                  onClose();
                }
              }}
              className="p-1.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Viewport container */}
        <div className="relative w-full aspect-square max-w-[260px] bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 text-slate-450 gap-2 p-4 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-[#2563EB]" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Accessing Selected Camera...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-xs text-rose-400 gap-2">
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <div id={scannerId} className="w-full h-full object-cover [&>video]:object-cover" />

          {/* Aim Overlay Layout */}
          {!loading && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] h-[65%] border-2 border-dashed border-[#2563EB] rounded-lg relative flex items-center justify-center">
                {/* Horizontal scan line bar animation */}
                <div className="absolute left-0 w-full h-[2px] bg-red-500 shadow-[0_0_10px_#ef4444] animate-bounce" style={{ animationDuration: "2.5s" }} />
              </div>
            </div>
          )}
        </div>

        <div className="text-center space-y-1 select-none">
          <p className="text-[11px] text-slate-300 font-semibold px-2">
            {continuous
              ? "Position barcodes inside the frame to add items continuously."
              : "Position the barcode inside the scanning window."}
          </p>
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">
            Supports EAN-13, EAN-8, UPC-A, Code-128
          </p>
        </div>

        {continuous && (
          <button
            type="button"
            onClick={() => {
              if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(onClose).catch(onClose);
              } else {
                onClose();
              }
            }}
            className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-black tracking-wide uppercase mt-1.5 shadow-lg shadow-[#2563EB]/25 transition-all cursor-pointer"
          >
            Finish Scanning
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
