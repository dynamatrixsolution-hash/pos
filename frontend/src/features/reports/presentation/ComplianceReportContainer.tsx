"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  ShieldCheck,
  Download,
  RefreshCw,
  FileCheck,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function ComplianceReportContainer() {
  const [fiscalYear, setFiscalYear] = useState("2081/82");
  const [period, setPeriod] = useState("ALL");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompliance = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams: Record<string, string> = { fiscalYear };
      if (period !== "ALL") queryParams.period = period;
      const res = await reportsRepository.fetchComplianceReport(queryParams);
      setRecords(res?.items || res?.records || []);
    } catch (err: any) {
      console.error("Failed to load IRD compliance report:", err);
      Notify.error(err.message || "Failed to load compliance audit");
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, period]);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  const handleExportAnnex = (annexType: string) => {
    if (records.length === 0) {
      Notify.warning("No compliance records found for export");
      return;
    }
    const rows = records.map((r) => ({
      Invoice_No: r.invoiceNumber || r.billNumber,
      Date: r.date || r.createdAt,
      Customer_PAN: r.customerPan || "N/A",
      Taxable_Amount: parseMoney(r.taxableAmount || 0),
      VAT_13Pct: parseMoney(r.vatAmount || 0),
      Total_Amount: parseMoney(r.totalAmount || 0),
      IRD_Sync: r.irdSyncStatus || "SYNCED",
    }));
    exportToExcel(rows, `IRD_${annexType}_${fiscalYear.replace("/", "-")}`);
  };

  const totalTaxable = records.reduce((acc, r) => acc + parseMoney(r.taxableAmount || 0), 0);
  const totalVat = records.reduce((acc, r) => acc + parseMoney(r.vatAmount || 0), 0);
  const grandTotal = records.reduce((acc, r) => acc + parseMoney(r.totalAmount || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">IRD Compliance & Tax Audit</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Government of Nepal Inland Revenue Department compliance registers, Annex 5 sales book & Annex 13 purchase book
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          >
            <option value="2081/82">FY 2081/82</option>
            <option value="2080/81">FY 2080/81</option>
            <option value="2079/80">FY 2079/80</option>
          </select>

          <button
            onClick={() => loadCompliance()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => handleExportAnnex("Annex_5_Sales")}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Annex 5 (Sales Book)
          </button>

          <button
            onClick={() => handleExportAnnex("Annex_13_Purchases")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Annex 13 (Purchase Book)
          </button>
        </div>
      </div>

      {/* Audit KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">Total Taxable Turnover</div>
          <div className="text-xl font-bold text-[#292320] tabular-nums">
            {formatNPR(totalTaxable)}
          </div>
          <p className="text-[11px] text-[#71675E]">Net base amount subject to 13% VAT</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">13% Value Added Tax (VAT)</div>
          <div className="text-xl font-bold text-[#6B2837] tabular-nums">
            {formatNPR(totalVat)}
          </div>
          <p className="text-[11px] text-[#71675E]">Collected VAT payable to IRD</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">Total Gross Invoiced</div>
          <div className="text-xl font-bold text-[#28634B] tabular-nums">
            {formatNPR(grandTotal)}
          </div>
          <p className="text-[11px] text-[#71675E]">{records.length} compliance entries recorded</p>
        </div>
      </div>

      {/* Compliance Register Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Verifying IRD tax registers and digital signatures...
        </div>
      ) : records.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <ShieldCheck className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No compliance entries</h3>
          <p className="text-xs text-[#71675E] mt-1">Invoices issued with VAT will populate here.</p>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Bill / Invoice #</th>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Buyer PAN</th>
                <th className="py-2.5 px-3 font-semibold text-right">Taxable (NPR)</th>
                <th className="py-2.5 px-3 font-semibold text-right">VAT 13% (NPR)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total (NPR)</th>
                <th className="py-2.5 px-3 font-semibold">IRD Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-[#292320]">
                    {r.invoiceNumber || r.billNumber}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-[#71675E]">
                    {new Date(r.date || r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#71675E]">{r.customerPan || "—"}</td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-medium text-[#292320]">
                    {formatNPR(parseMoney(r.taxableAmount || 0))}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-medium text-[#6B2837]">
                    {formatNPR(parseMoney(r.vatAmount || 0))}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-bold text-[#28634B]">
                    {formatNPR(parseMoney(r.totalAmount || 0))}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EBF4F0] text-[#28634B] border border-[#C3DED0]">
                      {r.irdSyncStatus || "SYNCED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
