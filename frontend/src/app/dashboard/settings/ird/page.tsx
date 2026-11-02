"use client";

import { Notify } from "@/lib/notify";

import React, { useEffect, useState } from "react";

interface CbmsMetrics {
  total: number;
  synced: number;
  pending: number;
  failed: number;
  retrying: number;
  lastSuccessfulSync: string | null;
  lastFailedSync: string | null;
  lastFailureError: string | null;
}

interface QueueItem {
  id: string;
  action: string;
  syncStatus: string;
  attemptCount: number;
  lastAttempt: string;
  errorMessage: string | null;
  sale?: { invoiceNumber: string };
  creditNote?: { noteNumber: string };
  debitNote?: { noteNumber: string };
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function IrdCompliancePage() {
  const [metrics, setMetrics] = useState<CbmsMetrics | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "cbms" | "fiscal">("overview");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New Fiscal Year form state
  const [fyName, setFyName] = useState("");
  const [fyStart, setFyStart] = useState("");
  const [fyEnd, setFyEnd] = useState("");
  const [fyActive, setFyActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resMetrics, resQueue, resFys] = await Promise.all([
        fetch("/api/v1/compliance/cbms").then((r) => r.json()),
        fetch("/api/v1/reports/compliance?reportType=CBMS_STATUS").then((r) => r.json()),
        fetch("/api/v1/settings/fiscal-year").then((r) => r.json()),
      ]);

      if (resMetrics?.metrics) setMetrics(resMetrics.metrics);
      if (Array.isArray(resQueue)) setQueue(resQueue);
      if (Array.isArray(resFys)) setFiscalYears(resFys);
    } catch (e) {
      console.error("Failed to load compliance data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (queueId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/compliance/cbms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId }),
      });
      const data = await res.json();
      if (data.error) {
        Notify.failure("Failed to sync: " + data.error);
      } else {
        Notify.success("Synced successfully!");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fyName || !fyStart || !fyEnd) {
      Notify.warning("Please fill all fiscal year fields");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/settings/fiscal-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fyName,
          startDate: new Date(fyStart).toISOString(),
          endDate: new Date(fyEnd).toISOString(),
          isActive: fyActive,
        }),
      });
      const data = await res.json();
      if (data.error) {
        Notify.failure("Error creating fiscal year: " + data.error);
      } else {
        Notify.success("Fiscal Year created successfully!");
        setFyName("");
        setFyStart("");
        setFyEnd("");
        setFyActive(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Block with Premium Sleek Gradient */}
        <div className="relative p-6 rounded-lg bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 shadow-sm overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="px-3 py-1 bg-blue-900/50 backdrop-blur border border-blue-400/30 text-blue-300 rounded-full text-xs font-semibold uppercase tracking-wider">
              Compliance Center
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Nepal IRD Compliance Dashboard</h1>
            <p className="text-indigo-200 text-sm max-w-2xl">
              Monitor Central Billing Monitoring System (CBMS) sync logs, manage fiscal years, and verify system-wide electronic billing alignments for the Inland Revenue Department (IRD).
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-2 border-b border-slate-800 p-1 bg-slate-950/40 rounded-md max-w-md">
          {(["overview", "cbms", "fiscal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading IRD Compliance configuration...</div>
        ) : (
          <div className="space-y-6">
            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* System Diagnostics Checkbox list */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-6 rounded-lg space-y-6">
                  <h2 className="text-xl font-bold border-b border-slate-800 pb-3">IRD System Diagnostics Check</h2>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <span className="p-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">✔</span>
                      <div>
                        <h4 className="font-semibold text-slate-200">Server-Side Finalization Engine</h4>
                        <p className="text-xs text-slate-400">Subtotals, VAT (13%), and discount aggregates are strictly calculated, validated and committed server-side.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="p-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">✔</span>
                      <div>
                        <h4 className="font-semibold text-slate-200">Fiscal Year Sequential Counting</h4>
                        <p className="text-xs text-slate-400">Database locks prevent collision and maintain consecutive billing sequences across concurrent POS registers.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="p-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">✔</span>
                      <div>
                        <h4 className="font-semibold text-slate-200">Immutable Transaction Store</h4>
                        <p className="text-xs text-slate-400">Direct invoice edits or deletes are physically blocked. Void transactions are managed via corrections or Credit Notes.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="p-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">✔</span>
                      <div>
                        <h4 className="font-semibold text-slate-200">Print & Reprint Logs Auditing</h4>
                        <p className="text-xs text-slate-400">Print queues enforce copy labels ("प्रतिलिपि / Copy of Original") and compile reprint counts.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="p-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">✔</span>
                      <div>
                        <h4 className="font-semibold text-slate-200">Multi-Tenant Partition Guard</h4>
                        <p className="text-xs text-slate-400">Tenant session verification guarantees isolation across configs, books, audits, and CBMS tables.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CBMS Live Stats Widget */}
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-lg space-y-6">
                  <h3 className="text-lg font-bold border-b border-slate-800 pb-3">CBMS Synchronization</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-md text-center space-y-1">
                      <span className="text-xs text-slate-400">TOTAL INVOICES</span>
                      <p className="text-2xl font-black text-slate-200">{metrics?.total || 0}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-md text-center space-y-1">
                      <span className="text-xs text-slate-400 text-green-400 font-semibold">SYNCED</span>
                      <p className="text-2xl font-black text-green-450">{metrics?.synced || 0}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-md text-center space-y-1">
                      <span className="text-xs text-slate-400 text-yellow-400 font-semibold">PENDING</span>
                      <p className="text-2xl font-black text-yellow-450">{metrics?.pending || 0}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-md text-center space-y-1">
                      <span className="text-xs text-slate-400 text-red-400 font-semibold">FAILED</span>
                      <p className="text-2xl font-black text-red-450">{metrics?.failed || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400 border-t border-slate-900 pt-4">
                    <div className="flex justify-between">
                      <span>Last Success:</span>
                      <span className="text-slate-200">{metrics?.lastSuccessfulSync ? new Date(metrics.lastSuccessfulSync).toLocaleString() : "Never"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Failure:</span>
                      <span className="text-slate-200">{metrics?.lastFailedSync ? new Date(metrics.lastFailedSync).toLocaleString() : "Never"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CBMS QUEUE TABLE */}
            {activeTab === "cbms" && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h3 className="text-lg font-bold">CBMS Synchronization Queue Log</h3>
                  <button onClick={fetchData} className="px-4 py-1.5 bg-slate-850 hover:bg-slate-800 text-xs font-semibold rounded-lg transition-all duration-300">
                    Refresh List
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-xs">
                        <th className="p-4">Reference No.</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Attempts</th>
                        <th className="p-4">Last Sync Date</th>
                        <th className="p-4">Sync Diagnostics</th>
                        <th className="p-4 text-center">Fulfillment Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">No CBMS synchronization records queued.</td>
                        </tr>
                      ) : (
                        queue.map((item) => (
                          <tr key={item.id} className="border-b border-slate-900 hover:bg-slate-900/30">
                            <td className="p-4 font-mono text-xs text-slate-250">
                              {item.sale?.invoiceNumber || item.creditNote?.noteNumber || item.debitNote?.noteNumber || "Ref N/A"}
                            </td>
                            <td className="p-4 text-xs font-semibold tracking-wider">{item.action}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                item.syncStatus === "SYNCED" ? "bg-green-500/10 text-green-400" :
                                item.syncStatus === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                                item.syncStatus === "FAILED" ? "bg-red-500/10 text-red-400" :
                                "bg-indigo-500/10 text-indigo-400"
                              }`}>
                                {item.syncStatus}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs">{item.attemptCount}</td>
                            <td className="p-4 text-xs text-slate-450">{item.lastAttempt ? new Date(item.lastAttempt).toLocaleString() : "Pending"}</td>
                            <td className="p-4 text-xs text-red-400 truncate max-w-xs">{item.errorMessage || "N/A"}</td>
                            <td className="p-4 text-center">
                              {item.syncStatus !== "SYNCED" && (
                                <button
                                  disabled={submitting}
                                  onClick={() => handleRetry(item.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded shadow transition-all duration-300"
                                >
                                  Retry Sync
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: FISCAL YEAR MANAGER */}
            {activeTab === "fiscal" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form to Create New Fiscal Year */}
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-lg space-y-4">
                  <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Setup Fiscal Year</h3>
                  <form onSubmit={handleCreateFiscalYear} className="space-y-4 text-sm">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">Fiscal Year Name (e.g. 2080/81)</label>
                      <input
                        type="text"
                        required
                        value={fyName}
                        onChange={(e) => setFyName(e.target.value)}
                        placeholder="e.g. 2080/81"
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">Start Date</label>
                      <input
                        type="date"
                        required
                        value={fyStart}
                        onChange={(e) => setFyStart(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">End Date</label>
                      <input
                        type="date"
                        required
                        value={fyEnd}
                        onChange={(e) => setFyEnd(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="fyActive"
                        checked={fyActive}
                        onChange={(e) => setFyActive(e.target.checked)}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-900"
                      />
                      <label htmlFor="fyActive" className="text-xs font-semibold text-slate-200">
                        Mark as Active Fiscal Year
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-lg font-bold text-white shadow-sm transition-all duration-300"
                    >
                      {submitting ? "Saving..." : "Create & Initialize"}
                    </button>
                  </form>
                </div>

                {/* Fiscal Years List */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="p-6 border-b border-slate-800 bg-slate-950">
                    <h3 className="text-lg font-bold">Configured Fiscal Years</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-xs">
                          <th className="p-4">FY Name</th>
                          <th className="p-4">Start Date</th>
                          <th className="p-4">End Date</th>
                          <th className="p-4 text-center">Active Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fiscalYears.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400">No fiscal years initialized. Set one up to initiate billing sequences.</td>
                          </tr>
                        ) : (
                          fiscalYears.map((fy) => (
                            <tr key={fy.id} className="border-b border-slate-900 hover:bg-slate-900/30">
                              <td className="p-4 font-bold text-slate-200">{fy.name}</td>
                              <td className="p-4 font-mono text-xs">{new Date(fy.startDate).toLocaleDateString()}</td>
                              <td className="p-4 font-mono text-xs">{new Date(fy.endDate).toLocaleDateString()}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  fy.isActive ? "bg-green-500/10 text-green-400" : "bg-slate-800 text-slate-400"
                                }`}>
                                  {fy.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
