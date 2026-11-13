"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import {
  ShieldAlert,
  Download,
  RefreshCw,
  Search,
  Loader2,
  Lock,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function OtherReportContainer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsRepository.fetchAuditLogs({ limit: 100, search: search || undefined });
      setLogs(res.logs || res || []);
    } catch (err: any) {
      console.error("Failed to load audit logs:", err);
      Notify.error(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = () => {
    if (logs.length === 0) {
      Notify.warning("No audit logs to export");
      return;
    }
    const rows = logs.map((l) => ({
      Timestamp: new Date(l.createdAt || l.timestamp).toLocaleString(),
      User: l.user?.name || l.userName || "System",
      Action: l.action || l.eventType,
      Entity: l.entityType || l.module || "Security",
      Details: typeof l.details === "object" ? JSON.stringify(l.details) : l.details || "—",
      IP_Address: l.ipAddress || "—",
    }));
    exportToExcel(rows, "Security_Audit_Logs");
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Security & Activity Audit Logs</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Tamper-evident trail of user actions, administrative overrides, voids & authentication events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter audit logs by action or user..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Reading security audit ledger...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Lock className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No activity logs found</h3>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">User</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Module</th>
                <th className="py-2.5 px-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  <td className="py-2.5 px-3 tabular-nums text-[#71675E]">
                    {new Date(l.createdAt || l.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#292320]">
                    {l.user?.name || l.userName || "System"}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[11px] font-semibold text-[#6B2837]">
                      {l.action || l.eventType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#71675E]">{l.entityType || l.module || "Core"}</td>
                  <td className="py-2.5 px-3 text-[#71675E] max-w-md truncate">
                    {typeof l.details === "object" ? JSON.stringify(l.details) : l.details || "—"}
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
