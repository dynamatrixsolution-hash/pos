"use client";

import React, { useState } from "react";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useProductsUiStore } from "../../state/products-ui.store";
import { useProductsStore } from "../../state/products.store";
import { ParsedCsvProduct } from "../../models/product.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const BulkImportModal: React.FC = () => {
  const isImportModalOpen = useProductsUiStore((s) => s.isImportModalOpen);
  const setIsImportModalOpen = useProductsUiStore((s) => s.setIsImportModalOpen);

  const importProducts = useProductsStore((s) => s.importProducts);
  const isImporting = useProductsStore((s) => s.isImporting);

  const [parsedRows, setParsedRows] = useState<ParsedCsvProduct[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  if (!isImportModalOpen) return null;

  const handleDownloadTemplate = () => {
    const csvHeader = "Name,Barcode,SKU,CostPrice,SellingPrice,WholesalePrice,Category,Unit,AlertQuantity,InitialStock,IsVatItem,Description\n";
    const sampleRows = [
      "Royal Thakali Mutton Thali,890123456789,THAL-01,450.00,850.00,750.00,Signature Mains,portion,5,0,true,Authentic Nepali Thakali with fresh mutton and ghee\n",
      "Himalayan Jhol Momo,890123456790,MOMO-01,150.00,320.00,280.00,Appetizers,portion,10,0,false,Steamed dumplings in spiced sesame-tomato soup\n",
      "Basmati Rice 25kg,890123456791,RAW-RICE-25,2200.00,0.00,0.00,Kitchen Stock,kg,5,20,false,Raw grain for restaurant kitchen thalis\n",
    ].join("");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setParseError("The uploaded CSV has no data rows.");
          return;
        }

        const rows: ParsedCsvProduct[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cols.length >= 5 && cols[0]) {
            rows.push({
              name: cols[0],
              barcode: cols[1] || undefined,
              sku: cols[2] || undefined,
              costPrice: parseFloat(cols[3]) || 0,
              sellingPrice: parseFloat(cols[4]) || 0,
              wholesalePrice: parseFloat(cols[5]) || 0,
              categoryName: cols[6] || undefined,
              unitName: cols[7] || "pcs",
              alertQuantity: parseInt(cols[8]) || 5,
              initialStock: parseFloat(cols[9]) || 0,
              isVatItem: cols[10]?.toLowerCase() === "true" || cols[10] === "1",
              description: cols[11] || undefined,
            });
          }
        }

        if (rows.length === 0) {
          setParseError("Could not extract any valid product records from CSV.");
        } else {
          setParsedRows(rows);
        }
      } catch {
        setParseError("Failed to parse CSV file. Please ensure it is correctly formatted.");
      }
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    const res = await importProducts(parsedRows);
    if (res.success) {
      setImportResult(`Successfully imported ${res.count} products!`);
      setTimeout(() => {
        setIsImportModalOpen(false);
      }, 1200);
    } else {
      setParseError(res.error || "Batch import failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">Bulk Import Products</h3>
              <p className="text-[11px] text-[#71675E]">
                Upload CSV file with dishes, raw stock, and retail inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {parseError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {parseError}
            </div>
          )}

          {importResult && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-[#16A34A] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{importResult}</span>
            </div>
          )}

          {/* Download Template Banner */}
          <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC]/70 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#292320]">Need a CSV format sample?</h4>
              <p className="text-[11px] text-[#71675E] mt-0.5">
                Download the standardized CSV template with pre-filled headers and sample rows.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="h-8 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#6B2837] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          {/* File Upload Area */}
          <div className="border-2 border-dashed border-[#D8CEC1] hover:border-[#6B2837] rounded-xl p-6 text-center bg-[#FFFCF7] transition-colors relative cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="h-8 w-8 text-[#71675E]/50 mx-auto mb-2" />
            <p className="text-xs font-bold text-[#292320]">
              {fileName ? fileName : "Click to select or drag & drop .CSV file"}
            </p>
            <p className="text-[11px] text-[#71675E] mt-1">
              Supports .csv files with UTF-8 encoding
            </p>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#292320]">
                <span>Preview Ready Records ({parsedRows.length} items)</span>
              </div>
              <div className="rounded-xl border border-[#D8CEC1] overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F3EC] text-[#71675E] text-[10px] uppercase font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-2">Category</th>
                      <th className="py-2 px-2 text-right">Cost</th>
                      <th className="py-2 px-2 text-right">Selling</th>
                      <th className="py-2 px-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/50 bg-[#FFFCF7]">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-[#F7F3EC]/40">
                        <td className="py-1.5 px-3 font-semibold text-[#292320] truncate max-w-[150px]">
                          {r.name}
                        </td>
                        <td className="py-1.5 px-2 text-[#71675E]">{r.categoryName || "—"}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#71675E]">
                          {formatNPR(r.costPrice)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-[#6B2837]">
                          {formatNPR(r.sellingPrice)}
                        </td>
                        <td className="py-1.5 px-2 text-[#71675E]">{r.unitName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-[#71675E] text-right">
                  ...and {parsedRows.length - 10} more records
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0 bg-[#FFFCF7]">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(false)}
            disabled={isImporting}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0 || isImporting}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{isImporting ? "Importing..." : `Import ${parsedRows.length} Products`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

