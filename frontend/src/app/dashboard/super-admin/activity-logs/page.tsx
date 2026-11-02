"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Shield,
  FileText,
  Building,
} from "lucide-react";
import { Notify } from "@/lib/notify";

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

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/activity-logs");
      if (!res.ok) throw new Error("Failed to load platform activity logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      Notify.error(err.message || "Failed to load activity logs");
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

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.reason.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.businessName.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "ALL" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-6 sm:p-8 text-[#292320]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B2837] bg-[#6B2837]/10 px-2.5 py-0.5 rounded">
                Platform Security
              </span>
              <span className="text-xs text-[#71675E]">• Audit Log Trail</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#292320] mt-1">Platform Administrative Audit Trail</h1>
            <p className="text-xs text-[#71675E]">
              Immutable record of sensitive platform actions, mandatory reasons, and before/after state diffs.
            </p>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3.5 py-1.5 border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Trail
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-4 rounded-lg shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
            <input
              type="text"
              placeholder="Search by reason, action, business, or actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full text-xs p-2 border border-[#D8CEC1] rounded-md bg-[#F7F3EC] focus:bg-[#FFFCF7] focus:outline-none focus:border-[#6B2837]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-[#71675E]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs p-2 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
            >
              <option value="ALL">All Administrative Actions</option>
              <option value="BUSINESS_SUSPENDED">Business Suspended</option>
              <option value="BUSINESS_ACTIVATED">Business Activated</option>
              <option value="SUBSCRIPTION_UPDATED">Subscription Updated</option>
              <option value="PASSWORD_RESET_DISPATCHED">Password Reset Dispatched</option>
              <option value="SESSIONS_REVOKED">Sessions Revoked</option>
              <option value="SAAS_PAYMENT_RECORDED">SaaS Payment Recorded</option>
              <option value="RECOVERY_REHEARSAL_TESTED">Recovery Rehearsal Tested</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-[#EEE7DD] animate-pulse rounded-md" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#71675E]">
              No audit logs found matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase tracking-wider text-[10px] pb-2">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target Tenant</th>
                    <th className="py-2.5 px-3">Mandatory Reason</th>
                    <th className="py-2.5 px-3">State Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7DD]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-3 px-3 tabular-nums text-[#71675E] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#292320]">{log.userName}</div>
                        <div className="text-[10px] text-[#71675E] font-mono">{log.role}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] bg-[#EEE7DD] text-[#71675E] px-2 py-0.5 rounded font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {log.businessId ? (
                          <Link
                            href={`/dashboard/super-admin/businesses/${log.businessId}`}
                            className="font-medium text-[#292320] hover:text-[#6B2837] hover:underline"
                          >
                            {log.businessName}
                          </Link>
                        ) : (
                          <span className="text-[#71675E]">{log.businessName}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#292320] max-w-sm font-medium">{log.reason}</td>
                      <td className="py-3 px-3">
                        {log.beforeState || log.afterState ? (
                          <details className="cursor-pointer">
                            <summary className="text-[10px] font-bold text-[#6B2837] hover:underline">
                              Inspect Diff
                            </summary>
                            <pre className="p-2 bg-[#F7F3EC] rounded mt-1 overflow-x-auto max-w-xs text-[9px] font-mono border border-[#D8CEC1]">
                              {JSON.stringify({ before: log.beforeState, after: log.afterState }, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[#71675E] text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
