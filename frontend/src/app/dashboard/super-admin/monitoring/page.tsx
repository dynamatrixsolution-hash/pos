"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Play,
  CheckCircle2,
  FileText,
  Server,
  Layers,
} from "lucide-react";
import { Notify } from "@/lib/notify";

interface BackupItem {
  id: string;
  fileName: string;
  type: string;
  sizeMb: string;
  status: string;
  verifiedRestore: boolean;
  restoreTestResult: string;
  restoreTestedAt: string | null;
  restoreNotes: string | null;
  durationSec: number;
  createdAt: string;
}

interface MonitoringData {
  serverHealth: {
    status: string;
    uptime: string;
    cpu: string;
    ram: string;
    disk: string;
  };
  backupStatus: {
    latestBackup: any;
    backupAgeHours: number;
    isFresh: boolean;
    verifiedRestorePass: boolean;
    history: BackupItem[];
  };
  backgroundJobs: {
    failedOutboxCount: number;
    pendingOutboxCount: number;
    failedCbmsCount: number;
    status: string;
  };
  apiUsage: {
    totalRequests24h: number;
    successRate: string;
    avgResponseTimeMs: string;
    errorRate: string;
  };
}

export default function SystemMonitoringPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingRecovery, setTestingRecovery] = useState(false);

  const loadTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/super-admin/monitoring");
      if (!res.ok) throw new Error("Failed to gather platform telemetry");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      Notify.error(err.message || "Failed to load telemetry");
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
      loadTelemetry();
    }
  }, [status, session, router, loadTelemetry]);

  const handleRunRecoveryTest = async () => {
    setTestingRecovery(true);
    try {
      const res = await fetch("/api/v1/super-admin/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Manual super admin recovery rehearsal verification",
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Recovery test execution failed");

      Notify.success(resData.message || "Recovery rehearsal passed!");
      loadTelemetry();
    } catch (err: any) {
      Notify.error(err.message || "Failed to execute recovery rehearsal");
    } finally {
      setTestingRecovery(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] p-6 sm:p-8 space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-[#EEE7DD] animate-pulse rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-[#EEE7DD] animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-[#EEE7DD] animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-6 sm:p-8 text-[#292320]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B2837] bg-[#6B2837]/10 px-2.5 py-0.5 rounded">
                Platform Operations
              </span>
              <span className="text-xs text-[#71675E]">• Health & Disaster Recovery</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#292320] mt-1">Platform Health & Recovery Monitor</h1>
            <p className="text-xs text-[#71675E]">
              Track background event jobs, backup freshness timestamps, and automated recovery rehearsal verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTelemetry}
              className="px-3 py-1.5 border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Telemetry
            </button>
            <button
              onClick={handleRunRecoveryTest}
              disabled={testingRecovery}
              className="px-3.5 py-1.5 bg-[#6B2837] hover:bg-[#6B2837]/90 text-[#FFFCF7] rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {testingRecovery ? "Rehearsing Recovery..." : "Run Recovery Rehearsal"}
            </button>
          </div>
        </div>

        {/* 3 Core Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Recovery Rehearsal Status */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-5 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                Recovery Rehearsal Integrity
              </span>
              <ShieldCheck className="h-4 w-4 text-[#15803D]" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded ${
                  data?.backupStatus.verifiedRestorePass
                    ? "bg-[#15803D]/10 text-[#15803D] border border-[#15803D]/20"
                    : "bg-[#B91C1C]/10 text-[#B91C1C] border border-[#B91C1C]/20"
                }`}
              >
                {data?.backupStatus.verifiedRestorePass ? "PASS (Verified)" : "ACTION REQUIRED"}
              </span>
              <span className="text-xs text-[#71675E] tabular-nums">
                {data?.backupStatus.backupAgeHours}h backup age
              </span>
            </div>
            <p className="text-[11px] text-[#71675E] pt-1">
              A successful backup alone does not prove recovery works. Automated restore tests simulate full database reconstruction.
            </p>
          </div>

          {/* 2. Background Queue & Sync Failures */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-5 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                Background Events & Sync
              </span>
              <Layers className="h-4 w-4 text-[#71675E]" />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div>
                <span className="text-[10px] text-[#71675E] uppercase font-bold">Failed Outbox</span>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    data?.backgroundJobs.failedOutboxCount === 0 ? "text-[#15803D]" : "text-[#B91C1C]"
                  }`}
                >
                  {data?.backgroundJobs.failedOutboxCount}
                </div>
              </div>
              <div className="border-l border-[#EEE7DD] pl-3">
                <span className="text-[10px] text-[#71675E] uppercase font-bold">Pending Outbox</span>
                <div className="text-lg font-bold tabular-nums text-[#292320]">
                  {data?.backgroundJobs.pendingOutboxCount}
                </div>
              </div>
              <div className="border-l border-[#EEE7DD] pl-3">
                <span className="text-[10px] text-[#71675E] uppercase font-bold">Failed CBMS</span>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    data?.backgroundJobs.failedCbmsCount === 0 ? "text-[#15803D]" : "text-[#B91C1C]"
                  }`}
                >
                  {data?.backgroundJobs.failedCbmsCount}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#71675E] pt-1">Monitors tenant event queues and government tax sync pipelines.</p>
          </div>

          {/* 3. Server Node Health */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-5 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                Server Node & Latency
              </span>
              <Server className="h-4 w-4 text-[#71675E]" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-[#71675E] text-[10px]">CPU Utilization</span>
                <div className="font-bold tabular-nums text-[#292320]">{data?.serverHealth.cpu}</div>
              </div>
              <div>
                <span className="text-[#71675E] text-[10px]">Memory Allocation</span>
                <div className="font-bold tabular-nums text-[#292320]">{data?.serverHealth.ram}</div>
              </div>
              <div>
                <span className="text-[#71675E] text-[10px]">API Success Rate</span>
                <div className="font-bold tabular-nums text-[#15803D]">{data?.apiUsage.successRate}</div>
              </div>
              <div>
                <span className="text-[#71675E] text-[10px]">Avg Latency</span>
                <div className="font-bold tabular-nums text-[#292320]">{data?.apiUsage.avgResponseTimeMs}</div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: BACKUP FRESHNESS & RECOVERY REHEARSAL LOGS */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Platform Database Dumps & Recovery Rehearsal History
              </h3>
              <p className="text-xs text-[#71675E]">
                Each backup record documents archive size, encryption status, and automated test recovery outcomes.
              </p>
            </div>
          </div>

          {!data?.backupStatus.history || data.backupStatus.history.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#71675E]">No backup records available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase tracking-wider text-[10px] pb-2">
                    <th className="py-2.5 px-3">Backup Archive</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Size</th>
                    <th className="py-2.5 px-3 text-center">Dump Status</th>
                    <th className="py-2.5 px-3 text-center">Verified Restore Test</th>
                    <th className="py-2.5 px-3">Recovery Verification Notes</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7DD]">
                  {data.backupStatus.history.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#292320]">{b.fileName}</td>
                      <td className="py-3 px-3 text-[#71675E] uppercase text-[10px] font-bold">{b.type}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#292320]">{b.sizeMb} MB</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#15803D]/10 text-[#15803D]">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            b.restoreTestResult === "PASS"
                              ? "bg-[#15803D]/10 text-[#15803D]"
                              : "bg-[#B45309]/10 text-[#B45309]"
                          }`}
                        >
                          {b.restoreTestResult || "UNTESTED"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#71675E] text-[11px] max-w-sm">
                        {b.restoreNotes || "Awaiting scheduled rehearsal run"}
                      </td>
                      <td className="py-3 px-3 tabular-nums text-[#71675E] whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
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
