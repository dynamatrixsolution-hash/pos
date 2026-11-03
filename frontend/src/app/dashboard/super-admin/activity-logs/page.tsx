"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Building2,
  X,
  ArrowUpRight,
  Shield,
  FileCode,
  Clock,
  User,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";

interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
  user: string;
  userName: string;
  role: string;
  businessName: string;
  businessId: string | null;
  ipAddress: string;
}

export default function ActivityLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"all" | "tenant" | "security" | "settings">("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/activity-logs");
      if (!res.ok) throw new Error("Failed to load platform activity logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadLogs();
    }
  }, [status, session, router, loadLogs]);

  // Derived metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const tenantMutations = logs.filter((l) => l.businessId !== null).length;
    const securityEvents = logs.filter(
      (l) =>
        l.action.includes("PASSWORD") ||
        l.action.includes("SESSION") ||
        l.action.includes("AUTH") ||
        l.action.includes("LOGIN")
    ).length;
    const settingsEvents = logs.filter(
      (l) =>
        l.action.includes("CONFIG") ||
        l.action.includes("SETTING") ||
        l.action.includes("MODULE")
    ).length;

    return { total, tenantMutations, securityEvents, settingsEvents };
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Tab filter
      if (activeTab === "tenant" && !log.businessId) return false;
      if (
        activeTab === "security" &&
        !log.action.includes("PASSWORD") &&
        !log.action.includes("SESSION") &&
        !log.action.includes("AUTH") &&
        !log.action.includes("LOGIN")
      ) {
        return false;
      }
      if (
        activeTab === "settings" &&
        !log.action.includes("CONFIG") &&
        !log.action.includes("SETTING") &&
        !log.action.includes("MODULE")
      ) {
        return false;
      }

      // Action dropdown filter
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;

      // Text search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        log.reason.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.businessName.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q)
      );
    });
  }, [logs, activeTab, actionFilter, search]);

  // Export dataset definition
  const getExportOptions = (): ExportOptions => ({
    filename: `platform-audit-logs-${new Date().toISOString().split("T")[0]}`,
    title: "Platform Administrative Audit Trail",
    subtitle: "Immutable Super Admin Action Log with Mandatory Justifications",
    dateRange: activeTab === "all" ? "All Platform Records" : `Segment: ${activeTab}`,
    columns: [
      { header: "Timestamp", key: "createdAt", width: 20 },
      { header: "Admin Actor", key: "actor", width: 22 },
      { header: "Role", key: "role", width: 14 },
      { header: "Action", key: "action", width: 26 },
      { header: "Target Scope", key: "targetType", width: 14 },
      { header: "Business Tenant", key: "businessName", width: 24 },
      { header: "Mandatory Audit Reason", key: "reason", width: 36 },
      { header: "IP Address", key: "ipAddress", width: 16 },
    ],
    data: filteredLogs.map((l) => ({
      createdAt: new Date(l.createdAt).toLocaleString(),
      actor: `${l.userName} (${l.user})`,
      role: l.role,
      action: l.action,
      targetType: l.targetType,
      businessName: l.businessName,
      reason: l.reason,
      ipAddress: l.ipAddress,
    })),
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* 1. Header with Breadcrumb & Right Actions */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Audit log
          </div>
          <h1 className="text-base font-bold text-[#292320] tracking-tight">
            Audit log
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export dataset"
            variant="outline"
          />
        </div>
      </div>

      {/* 2. Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Total actions</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{metrics.total}</span>
            <span className="text-[10px] text-[#71675E]">All records</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Tenant mutations</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#6B2837] tabular-nums font-mono">{metrics.tenantMutations}</span>
            <span className="text-[10px] text-[#71675E]">Business events</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Security & access</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-emerald-800 tabular-nums font-mono">{metrics.securityEvents}</span>
            <span className="text-[10px] text-emerald-700">Credentials/Auth</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Config & policies</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#854D0E] tabular-nums font-mono">{metrics.settingsEvents}</span>
            <span className="text-[10px] text-[#854D0E]">Platform settings</span>
          </div>
        </div>
      </div>

      {/* 3. Main Audit Trail Card */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
        {/* Unified Category Tabs & Filter Toolbar */}
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#FFFCF7]">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            {[
              { id: "all", label: "All records", count: metrics.total },
              { id: "tenant", label: "Tenant events", count: metrics.tenantMutations },
              { id: "security", label: "Security & auth", count: metrics.securityEvents },
              { id: "settings", label: "Settings", count: metrics.settingsEvents },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#6B2837] text-white"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-80 tabular-nums font-mono">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Search & Action Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71675E]" />
              <input
                type="text"
                placeholder="Search reason, action, tenant, actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Action Dropdown Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] max-w-[170px] truncate cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="BUSINESS_PROVISIONED">Business Provisioned</option>
              <option value="BUSINESS_SUSPENDED">Business Suspended</option>
              <option value="BUSINESS_ACTIVATED">Business Activated</option>
              <option value="SUBSCRIPTION_UPDATED">Subscription Updated</option>
              <option value="SAAS_PAYMENT_RECORDED">Payment Recorded</option>
              <option value="PLATFORM_NOTICE_CREATED">Notice Broadcasted</option>
              <option value="SUPPORT_TICKET_UPDATED">Ticket Updated</option>
              <option value="SYSTEM_SETTING_UPDATED">Setting Updated</option>
              <option value="PASSWORD_RESET_DISPATCHED">Password Reset</option>
            </select>
          </div>
        </div>

        {/* High-density Audit Log Table */}
        {loading ? (
          <div className="py-12 text-center text-[#71675E]">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
            <div className="text-xs">Loading administrative audit trail...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-[#71675E]">
            <Shield className="w-6 h-6 mx-auto mb-1 text-[#71675E]/60 stroke-1" />
            <p className="text-xs font-semibold text-[#292320]">No audit records found</p>
            <p className="text-[11px] text-[#71675E] mt-0.5">
              {search.trim()
                ? "No audit records matched your search query."
                : "No logs recorded under this category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Timestamp</th>
                  <th className="py-1.5 px-3">Admin actor</th>
                  <th className="py-1.5 px-3">Action</th>
                  <th className="py-1.5 px-3">Target tenant</th>
                  <th className="py-1.5 px-3">Mandatory reason</th>
                  <th className="py-1.5 px-3 text-right">State diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {filteredLogs.map((log) => {
                  const hasDiff = log.beforeState || log.afterState;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => hasDiff && setSelectedLog(log)}
                      className={`hover:bg-[#F7F3EC]/50 transition-colors ${
                        hasDiff ? "cursor-pointer" : ""
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono whitespace-nowrap text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      {/* Actor */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-xs text-[#292320] leading-tight">{log.userName}</div>
                        <div className="text-[10px] text-[#71675E] font-mono leading-tight">{log.role}</div>
                      </td>

                      {/* Action */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] bg-[#EEE7DD] text-[#6B2837] border border-[#D8CEC1] px-1.5 py-0.2 rounded font-semibold">
                          {log.action}
                        </span>
                      </td>

                      {/* Target Tenant */}
                      <td className="py-1.5 px-3 whitespace-nowrap font-medium text-xs">
                        {log.businessId ? (
                          <Link
                            href={`/dashboard/super-admin/businesses/${log.businessId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#292320] hover:text-[#6B2837] hover:underline flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3 text-[#71675E]" />
                            <span>{log.businessName}</span>
                          </Link>
                        ) : (
                          <span className="text-[#71675E]">{log.businessName}</span>
                        )}
                      </td>

                      {/* Mandatory Reason */}
                      <td className="py-1.5 px-3 text-[#292320] leading-relaxed max-w-md font-medium text-xs">
                        {log.reason}
                      </td>

                      {/* State Diff Action */}
                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                          >
                            <span>Inspect diff</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="text-[#71675E] font-mono text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Right-Side Slide-Over Drawer for Audit Inspection & State Diff */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedLog(null)}
          />

          {/* Right-side sliding panel taking big space of screen */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] md:w-[720px] lg:w-[840px] max-w-[95vw] bg-[#FFFCF7] border-l border-[#D8CEC1] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 text-[#292320]">
            {/* Drawer Header */}
            <div className="py-2.5 px-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-bold text-[#6B2837] bg-[#F7F3EC] px-2 py-0.5 rounded border border-[#D8CEC1] shrink-0">
                  {selectedLog.action}
                </span>
                <h2 className="text-sm font-bold text-[#292320] truncate">
                  Audit Record Details
                </h2>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#71675E] hover:text-[#292320] p-1.5 rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Meta Strip */}
            <div className="py-2 px-4 bg-[#F7F3EC] border-b border-[#D8CEC1] text-xs text-[#71675E] shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span>Actor: <strong className="text-[#292320]">{selectedLog.userName}</strong> ({selectedLog.role})</span>
                <span className="text-[#D8CEC1]">•</span>
                <span>Tenant: <strong className="text-[#292320]">{selectedLog.businessName}</strong></span>
                <span className="text-[#D8CEC1]">•</span>
                <span className="font-mono text-[11px]">IP: {selectedLog.ipAddress}</span>
              </div>
              <span className="font-mono text-[11px] tabular-nums">
                {new Date(selectedLog.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#F7F3EC]/30">
              {/* Mandatory Reason Box */}
              <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 space-y-1 shadow-2xs">
                <span className="text-[10px] font-bold text-[#6B2837] uppercase tracking-wider block">
                  Mandatory Administrative Justification
                </span>
                <p className="text-xs text-[#292320] font-medium leading-relaxed">
                  {selectedLog.reason}
                </p>
                <div className="text-[10px] text-[#71675E] pt-1 border-t border-[#D8CEC1] flex items-center justify-between font-mono">
                  <span>Target Type: {selectedLog.targetType}</span>
                  <span>Target ID: {selectedLog.targetId || "N/A"}</span>
                </div>
              </div>

              {/* State Diff Comparison Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-[#6B2837]" />
                    <span>State Transition Diff</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#71675E]">
                    Before vs. After Mutation
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Before State */}
                  <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
                    <div className="py-1 px-3 bg-[#EEE7DD] border-b border-[#D8CEC1] text-[10px] font-bold text-[#71675E] uppercase tracking-wider">
                      Before Mutation State
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-[#292320] overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap">
                      {selectedLog.beforeState
                        ? JSON.stringify(selectedLog.beforeState, null, 2)
                        : "null (No prior state recorded)"}
                    </pre>
                  </div>

                  {/* After State */}
                  <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
                    <div className="py-1 px-3 bg-[#DEF7EC] border-b border-[#BCF0DA] text-[10px] font-bold text-[#03543F] uppercase tracking-wider">
                      After Mutation State
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-[#03543F] overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap bg-[#DEF7EC]/20">
                      {selectedLog.afterState
                        ? JSON.stringify(selectedLog.afterState, null, 2)
                        : "null (No mutation data)"}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="py-2.5 px-4 border-t border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#71675E] font-mono">
                Log UUID: {selectedLog.id}
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-2xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
