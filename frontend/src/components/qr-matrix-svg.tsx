"use client";

import React, { useMemo } from "react";
import QRCode from "qrcode";

export interface QrMatrixSvgProps {
  code?: string;
  value?: string;
  size?: number;
  className?: string;
  foreground?: string;
  background?: string;
  margin?: number;
}

/**
 * Generates an authentic, spec-compliant ISO/IEC 18004 QR Code SVG.
 * Ensures instant scanning by all smartphone cameras and physical scanners.
 */
export function DeterministicQrMatrixSvg({
  code,
  value,
  size = 180,
  className = "",
  foreground = "#1E1B18",
  background = "#FFFFFF",
  margin = 2,
}: QrMatrixSvgProps) {
  // Resolve effective string to encode
  const rawTarget = (value || code || "").trim();

  const qrData = useMemo(() => {
    let textToEncode = rawTarget;
    if (!textToEncode) {
      textToEncode = "https://restroinn.com";
    } else if (!textToEncode.startsWith("http://") && !textToEncode.startsWith("https://")) {
      // If a bare publicCode like "QRL-TB-..." was passed without host
      if (typeof window !== "undefined") {
        textToEncode = `${window.location.origin}/guest/qr/${textToEncode}`;
      } else {
        textToEncode = `https://restroinn.com/guest/qr/${textToEncode}`;
      }
    }

    try {
      // Generate standard ISO/IEC 18004 QR Code matrix with Level M error correction
      const qr = QRCode.create(textToEncode, {
        errorCorrectionLevel: "M",
      });
      const modSize = qr.modules.size;
      const totalSize = modSize + margin * 2;

      let pathData = "";
      for (let r = 0; r < modSize; r++) {
        for (let c = 0; c < modSize; c++) {
          if (qr.modules.get(r, c)) {
            pathData += `M${c + margin} ${r + margin}h1v1h-1z`;
          }
        }
      }

      return {
        totalSize,
        pathData,
        error: null,
      };
    } catch (err: any) {
      console.error("QR Code Generation Error:", err);
      return {
        totalSize: 37,
        pathData: "",
        error: err.message || "Failed to generate QR",
      };
    }
  }, [rawTarget, margin]);

  if (qrData.error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-[#F7F3EC] border border-[#D8CEC1] text-[10px] text-red-600 p-2 text-center rounded ${className}`}
      >
        QR Error
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${qrData.totalSize} ${qrData.totalSize}`}
      className={`rounded-md mx-auto select-none ${className}`}
      aria-label={`QR Code for ${rawTarget}`}
      shapeRendering="crispEdges"
      style={{ display: "block", backgroundColor: background }}
    >
      <rect width={qrData.totalSize} height={qrData.totalSize} fill={background} />
      <path d={qrData.pathData} fill={foreground} shapeRendering="crispEdges" />
    </svg>
  );
}
