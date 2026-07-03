"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Terminal,
  Activity,
  Cpu,
  Database,
  Cloud,
  RefreshCw,
  Clock,
  Radio,
} from "lucide-react";

interface HealthData {
  serverHealth: {
    status: string;
    uptime: string;
    cpu: string;
    ram: string;
    disk: string;
  };
  databaseStatus: {
    engine: string;
    status: string;
    poolSize: number;
    activeConnections: number;
    latencyMs: string;
  };
  storageUsage: {
    provider: string;
    usedBytes: string;
    totalFiles: number;
    bandwidthMonthly: string;
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

  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadTelemetry();
    }
  }, [status, session, router]);

  const loadTelemetry = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/super-admin/monitoring");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Load system monitoring error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Gathering system diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Terminal className="h-5.5 w-5.5 text-blue-600" /> Platform Telemetry Monitor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor API latencies, CPU/RAM/Disk capacities, database active connection pools, and cloud storage files.
          </p>
        </div>
        <button
          onClick={loadTelemetry}
          disabled={refreshing}
          className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh Diagnostics
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Server health */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Cpu className="h-4.5 w-4.5 text-blue-500" /> Server Node Health
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Node Status:</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded border border-emerald-100">
                  {health.serverHealth.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">System Uptime:</span>
                <span className="font-bold text-slate-700">{health.serverHealth.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">CPU Usage Index:</span>
                <span className="font-bold text-slate-750">{health.serverHealth.cpu}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Memory Allocation (RAM):</span>
                <span className="font-bold text-slate-755">{health.serverHealth.ram}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Disk Space Capacity:</span>
                <span className="font-bold text-slate-755">{health.serverHealth.disk}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Database status */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Database className="h-4.5 w-4.5 text-emerald-500" /> PostgreSQL Database Engine
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Database Engine:</span>
                <span className="font-bold text-slate-700">{health.databaseStatus.engine}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection Status:</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded border border-emerald-100">
                  {health.databaseStatus.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active DB Connections:</span>
                <span className="font-bold text-slate-750">
                  {health.databaseStatus.activeConnections} / {health.databaseStatus.poolSize} Pool Size
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">DB Response Latency:</span>
                <span className="font-bold text-emerald-600">{health.databaseStatus.latencyMs}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cloud Storage */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Cloud className="h-4.5 w-4.5 text-sky-500" /> S3 Cloud Storage Vault
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Storage Provider:</span>
                <span className="font-bold text-slate-700">{health.storageUsage.provider}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">S3 Utilized Bytes:</span>
                <span className="font-bold text-slate-750">{health.storageUsage.usedBytes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Billed Files:</span>
                <span className="font-bold text-slate-700">{health.storageUsage.totalFiles} files</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Monthly S3 Bandwidth:</span>
                <span className="font-bold text-slate-750">{health.storageUsage.bandwidthMonthly}</span>
              </div>
            </div>
          </div>

          {/* Card 4: API performance */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Radio className="h-4.5 w-4.5 text-purple-500 animate-pulse" /> Platform HTTP API Gateway
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total API Calls (24h):</span>
                <span className="font-bold text-slate-700">{health.apiUsage.totalRequests24h.toLocaleString()} requests</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">API Call Success Rate:</span>
                <span className="font-bold text-emerald-600">{health.apiUsage.successRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Avg response Latency:</span>
                <span className="font-bold text-slate-750">{health.apiUsage.avgResponseTimeMs}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">API Error Rate Index:</span>
                <span className="font-bold text-red-500">{health.apiUsage.errorRate}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
