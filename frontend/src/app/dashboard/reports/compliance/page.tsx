"use client";

import React, { useEffect, useState } from "react";

interface FiscalYear {
  id: string;
  name: string;
  isActive: boolean;
}

export default function ComplianceReportsPage() {
  const [reportType, setReportType] = useState("MASTER_SALES");
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedFy, setSelectedFy] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch fiscal years on load
    fetch("/api/v1/settings/fiscal-year")
      .then((r) => r.json())
      .then((res) => {
        if (Array.isArray(res)) {
          setFiscalYears(res);
          const active = res.find((fy) => fy.isActive);
          if (active) setSelectedFy(active.id);
        }
      });
  }, []);

  const handleFetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        reportType,
        startDate,
        endDate,
        ...(selectedFy && { fiscalYearId: selectedFy }),
      });
      const res = await fetch(`/api/v1/reports/compliance?${params.toString()}`);
      const reportData = await res.json();
      if (Array.isArray(reportData)) {
        setData(reportData);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: "excel" | "xml" | "pdf" | "print") => {
    if (data.length === 0) {
      alert("No data available to export");
      return;
    }

    if (format === "print") {
      window.print();
      return;
    }

    const params = new URLSearchParams({
      reportType,
      startDate,
      endDate,
      format,
      ...(selectedFy && { fiscalYearId: selectedFy }),
    });

    const link = document.createElement("a");
    link.setAttribute("href", `/api/v1/reports/compliance?${params.toString()}`);
    link.setAttribute("download", `IRD_${reportType}_${startDate}_to_${endDate}.${format === 'excel' ? 'xls' : format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Block */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-700 to-indigo-800 shadow-xl overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="px-3 py-1 bg-emerald-900/50 backdrop-blur border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-semibold uppercase tracking-wider">
              IRD Verification Books
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Compliance Reports Center</h1>
            <p className="text-emerald-200 text-sm max-w-2xl">
              Inspect and export electronic VAT ledger books, sales registers, reprint counters, cancelled transactions, and notes conforming to Nepal IRD Audit standards.
            </p>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Select Compliance Book</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value);
                setData([]);
              }}
              className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
            >
              <option value="MASTER_SALES">Master Sales Report (Annex-5)</option>
              <option value="SALES_BOOK">Sales Book Ledger (Annex-6)</option>
              <option value="CANCELLED">Voided / Cancelled Invoices</option>
              <option value="REPRINTS">Invoice Reprints Log</option>
              <option value="CREDIT_NOTES">Credit Notes Log</option>
              <option value="DEBIT_NOTES">Debit Notes Log</option>
              <option value="CBMS_STATUS">CBMS Sync Logs</option>
              <option value="AUDIT_TRAIL">Audit Trail Log</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Fiscal Year</label>
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
            >
              <option value="">All Fiscal Years</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name} {fy.isActive && "(Active)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
            />
          </div>

          <div className="md:col-span-4 flex justify-between items-center pt-2 border-t border-slate-900">
            <button
              onClick={handleFetchReport}
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 flex items-center space-x-2"
            >
              {loading ? "Compiling..." : "Generate Compliance Book"}
            </button>

            {data.length > 0 && (
              <div className="flex space-x-2 font-semibold">
                <button
                  onClick={() => handleExport("excel")}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-slate-200 rounded-lg transition-all duration-300"
                >
                  Export Excel
                </button>
                <button
                  onClick={() => handleExport("xml")}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-slate-200 rounded-lg transition-all duration-300"
                >
                  Export XML
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-slate-200 rounded-lg transition-all duration-300"
                >
                  Export PDF
                </button>
                <button
                  onClick={() => handleExport("print")}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-slate-200 rounded-lg transition-all duration-300"
                >
                  Print Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Report Viewer Table Card */}
        {data.length > 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-xs">
                    {Object.keys(data[0]).map((key) => (
                      <th key={key} className="p-4 whitespace-nowrap">
                        {key.replace(/([A-Z])/g, " $1").toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30">
                      {Object.keys(data[0]).map((key) => {
                        const val = row[key];
                        return (
                          <td key={key} className="p-4 whitespace-nowrap text-xs max-w-xs truncate">
                            {typeof val === "boolean" ? (
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                val ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {val ? "YES" : "NO"}
                              </span>
                            ) : (
                              "" + (val ?? "N/A")
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="py-20 text-center text-slate-500 bg-slate-950 border border-slate-900 rounded-2xl">
              No report generated yet. Choose dates and click "Generate Compliance Book" to inspect logs.
            </div>
          )
        )}
      </div>
    </div>
  );
}
