"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { ExportService, ExportOptions, ExportFormat } from "@/lib/export-service";

interface ExportDropdownProps {
  getExportOptions: () => ExportOptions | Promise<ExportOptions>;
  buttonText?: string;
  className?: string;
  align?: "left" | "right";
  variant?: "primary" | "secondary" | "outline";
}

/**
 * Enterprise Export Dropdown Menu
 * Multi-format exporter matching pixel-perfect specs: CSV, Excel (.xlsx), PDF, and Word (.doc).
 */
export default function ExportDropdown({
  getExportOptions,
  buttonText = "Export",
  className = "",
  align = "right",
  variant = "primary",
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = async (format: ExportFormat) => {
    setLoadingFormat(format);
    try {
      const options = await getExportOptions();
      await ExportService.export(format, options);
      setIsOpen(false);
    } catch (err) {
      console.error(`Export to ${format} failed:`, err);
      alert(`Failed to generate ${format.toUpperCase()} export. Please check console for details.`);
    } finally {
      setLoadingFormat(null);
    }
  };

  const buttonVariantClass =
    variant === "primary"
      ? "bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] border-transparent"
      : variant === "outline"
      ? "bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] border-[#D8CEC1]"
      : "bg-[#F7F3EC] text-[#292320] hover:bg-[#EEE7DD] border-[#D8CEC1]";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={loadingFormat !== null}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md border shadow-xs transition-all cursor-pointer disabled:opacity-60 ${buttonVariantClass}`}
      >
        {loadingFormat ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>{buttonText}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-52 rounded-xl bg-[#FFFCF7] border border-[#D8CEC1] p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Option 1: CSV */}
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={loadingFormat !== null}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[#292320] hover:bg-[#F7F3EC] rounded-lg transition-colors cursor-pointer group text-left"
          >
            {/* Grey sheet icon */}
            <div className="w-5 h-5 rounded flex items-center justify-center text-[#71675E] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="14" y2="17" />
              </svg>
            </div>
            <span className="flex-1">Export to CSV</span>
            {loadingFormat === "csv" && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#71675E]" />}
          </button>

          {/* Option 2: Excel */}
          <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={loadingFormat !== null}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[#292320] hover:bg-[#DEF7EC]/50 rounded-lg transition-colors cursor-pointer group text-left"
          >
            {/* Green Excel icon */}
            <div className="w-5 h-5 rounded flex items-center justify-center text-[#057A55] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="16" y2="16" />
                <line x1="12" y1="12" x2="12" y2="20" />
              </svg>
            </div>
            <span className="flex-1">Export to Excel</span>
            {loadingFormat === "excel" && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#057A55]" />}
          </button>

          {/* Option 3: PDF */}
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={loadingFormat !== null}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[#292320] hover:bg-[#FDE8E8]/50 rounded-lg transition-colors cursor-pointer group text-left"
          >
            {/* Red PDF icon */}
            <div className="w-5 h-5 rounded flex items-center justify-center text-[#E02424] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15h6" />
                <path d="M9 11h6" />
              </svg>
            </div>
            <span className="flex-1">Export to PDF</span>
            {loadingFormat === "pdf" && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E02424]" />}
          </button>

          {/* Option 4: Word (.doc) */}
          <button
            type="button"
            onClick={() => handleExport("doc")}
            disabled={loadingFormat !== null}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[#292320] hover:bg-[#EBF5FF]/50 rounded-lg transition-colors cursor-pointer group text-left"
          >
            {/* Blue Word doc icon */}
            <div className="w-5 h-5 rounded flex items-center justify-center text-[#1C64F2] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13l2 4 2-4 2 4 2-4" />
              </svg>
            </div>
            <span className="flex-1">Export to Word (.doc)</span>
            {loadingFormat === "doc" && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1C64F2]" />}
          </button>
        </div>
      )}
    </div>
  );
}

