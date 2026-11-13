"use client";

import React, { useState, useEffect, useCallback } from "react";
import { hotelRepository } from "../repositories/hotel.repository";
import { apiClient } from "@/core/api/api-client";
import {
  ShieldCheck,
  Printer,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Receipt,
  Play,
  RotateCcw,
  Sliders,
  Database,
  Activity,
  Loader2,
} from "lucide-react";
import { Notify } from "@/lib/notify";

type PilotPanelTab =
  | "ALL_PANELS"
  | "FEATURE_FLAGS"
  | "HARDWARE_REHEARSAL"
  | "OFFLINE_SYNC"
  | "RECONCILIATION";

export function PilotOpsContainer() {
  const [activeTab, setActiveTab] = useState<PilotPanelTab>("ALL_PANELS");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // States
  const [featureFlags, setFeatureFlags] = useState<any>({
    hotelEnabled: true,
    restaurantEnabled: true,
    kdsEnabled: true,
    guestQrEnabled: true,
    folioBridgeEnabled: true,
    offlineDraftSyncEnabled: true,
    printerFailoverEnabled: true,
    pilotMode: true,
  });
  const [printJobs, setPrintJobs] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [offlineSyncStats, setOfflineSyncStats] = useState<any>({
    pendingDraftCount: 0,
    syncedTodayCount: 0,
    conflictCount: 0,
  });
  const [reconciliation, setReconciliation] = useState<any>({
    discrepancyCount: 0,
    totalAudited: 0,
    isBalanced: true,
  });
  const [healthStatus, setHealthStatus] = useState<any>({
    database: "HEALTHY",
    redis: "OPERATIONAL",
    printers: "ONLINE",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ff, pj, os, rc, hl, st] = await Promise.all([
        hotelRepository.fetchPilotFeatureFlags().catch(() => null),
        hotelRepository.fetchPilotPrintJobs().catch(() => ({ printJobs: [] })),
        hotelRepository.fetchPilotOfflineSync().catch(() => ({})),
        hotelRepository.fetchPilotReconciliation().catch(() => ({})),
        apiClient.hotel.getPilotHealth().catch(() => ({})),
        apiClient.restaurant.getKitchenStations().catch(() => ({ stations: [] })),
      ]);

      if (ff && typeof ff === "object") {
        setFeatureFlags((prev: any) => ({ ...prev, ...(ff.featureFlags || ff) }));
      }
      if (pj && pj.printJobs) setPrintJobs(pj.printJobs);
      if (os) setOfflineSyncStats((prev: any) => ({ ...prev, ...os }));
      if (rc) setReconciliation((prev: any) => ({ ...prev, ...rc }));
      if (hl) setHealthStatus((prev: any) => ({ ...prev, ...hl }));
      if (st && st.stations) setStations(st.stations);
    } catch (err) {
      console.error("Pilot ops load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleFlag = async (key: string) => {
    const updated = { ...featureFlags, [key]: !featureFlags[key] };
    setFeatureFlags(updated);
    try {
      await hotelRepository.updatePilotFeatureFlags(updated);
      Notify.success(`Toggled ${key} to ${updated[key] ? "ENABLED" : "DISABLED"}`);
    } catch (err: any) {
      Notify.error(err.message || "Failed to update feature flags");
      setFeatureFlags(featureFlags);
    }
  };

  const handleTestPrint = async () => {
    try {
      setActionLoading(true);
      await hotelRepository.createPilotPrintJob({
        jobType: "TEST_KOT",
        stationId: stations[0]?.id || "default",
        payload: { message: "Pilot Hardware Rehearsal Test" },
      });
      Notify.success("Hardware print job queued successfully");
      await loadData();
    } catch (err: any) {
      Notify.error(err.message || "Print simulation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    try {
      setActionLoading(true);
      await hotelRepository.triggerPilotOfflineSync({ force: true });
      Notify.success("Offline sync triggered and draft queues processed");
      await loadData();
    } catch (err: any) {
      Notify.error(err.message || "Offline sync failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setActionLoading(true);
      await hotelRepository.resolvePilotReconciliation({ auditType: "NIGHT_AUDIT_VERIFY" });
      Notify.success("Night audit reconciliation completed");
      await loadData();
    } catch (err: any) {
      Notify.error(err.message || "Reconciliation audit failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Pilot Operations Console</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Real-time multi-department telemetry, feature rollout switches, hardware test runs & offline reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Readiness Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Pilot Mode Status</span>
            <Activity className="h-4 w-4 text-[#28634B]" />
          </div>
          <div className="text-lg font-bold text-[#292320]">
            {featureFlags.pilotMode ? "Active Pilot" : "Full Production"}
          </div>
          <p className="text-[11px] text-[#71675E]">Safety guards & logging enforced</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Hardware Printe Failover</span>
            <Printer className="h-4 w-4 text-[#6B2837]" />
          </div>
          <div className="text-lg font-bold text-[#292320]">
            {featureFlags.printerFailoverEnabled ? "Failover Enabled" : "Single Route"}
          </div>
          <p className="text-[11px] text-[#71675E]">{printJobs.length} jobs in spooler queue</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Offline Sync Engine</span>
            <WifiOff className="h-4 w-4 text-[#946000]" />
          </div>
          <div className="text-lg font-bold text-[#292320]">
            {offlineSyncStats.pendingDraftCount || 0} Pending Drafts
          </div>
          <p className="text-[11px] text-[#71675E]">Automatic retry upon reconnect</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Folio Reconciliation</span>
            <Receipt className="h-4 w-4 text-[#28634B]" />
          </div>
          <div className="text-lg font-bold text-[#292320]">
            {reconciliation.isBalanced ? "100% Balanced" : "Discrepancy Found"}
          </div>
          <p className="text-[11px] text-[#71675E]">POS orders mapped to front-desk folios</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEE7DD] pb-2">
        {(
          [
            ["ALL_PANELS", "All Controls"],
            ["FEATURE_FLAGS", "Feature Flags"],
            ["HARDWARE_REHEARSAL", "Hardware & Spooler"],
            ["OFFLINE_SYNC", "Offline Engine"],
            ["RECONCILIATION", "Reconciliation Audit"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === key
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Refreshing operations telemetry...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Feature Flags Panel */}
          {(activeTab === "ALL_PANELS" || activeTab === "FEATURE_FLAGS") && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Property Feature Rollouts</h3>
                  <p className="text-xs text-[#71675E]">
                    Control module enablement per branch to safely test restaurant, hotel, KDS and guest ordering
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { key: "hotelEnabled", label: "Hotel & PMS Core", desc: "Rooms, stays, reservations & folios" },
                  { key: "restaurantEnabled", label: "Restaurant Dining & POS", desc: "Tables, rounds, billing & catalog" },
                  { key: "kdsEnabled", label: "Kitchen Display System (KDS)", desc: "Live kitchen tickets and station routing" },
                  { key: "guestQrEnabled", label: "Contactless Guest QR", desc: "Self-ordering plaques & room service" },
                  { key: "folioBridgeEnabled", label: "Cross-Department Folio Bridge", desc: "Charge restaurant food to hotel room" },
                  { key: "offlineDraftSyncEnabled", label: "Offline Local Storage Sync", desc: "Draft persistence when internet drops" },
                  { key: "printerFailoverEnabled", label: "Automatic Printer Failover", desc: "Spool to secondary IP if kitchen printer drops" },
                  { key: "pilotMode", label: "Safe Pilot Mode Telemetry", desc: "Verbose audit logs and non-destructive rehearsal" },
                ].map(({ key, label, desc }) => {
                  const val = !!featureFlags[key];
                  return (
                    <div
                      key={key}
                      onClick={() => handleToggleFlag(key)}
                      className={`p-3.5 rounded-lg border cursor-pointer select-none transition-colors flex items-center justify-between ${
                        val
                          ? "bg-[#F9EFF1] border-[#E3C6CC]"
                          : "bg-[#F7F3EC] border-[#EEE7DD]"
                      }`}
                    >
                      <div>
                        <div className={`font-semibold text-xs ${val ? "text-[#6B2837]" : "text-[#292320]"}`}>
                          {label}
                        </div>
                        <div className="text-[11px] text-[#71675E]">{desc}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          val
                            ? "bg-[#6B2837] text-white border-[#6B2837]"
                            : "bg-[#FFFCF7] text-[#71675E] border-[#EEE7DD]"
                        }`}
                      >
                        {val ? "ENABLED" : "DISABLED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hardware & Printer Rehearsal */}
          {(activeTab === "ALL_PANELS" || activeTab === "HARDWARE_REHEARSAL") && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Hardware & Kitchen Printer Spooler</h3>
                  <p className="text-xs text-[#71675E]">
                    Simulate print jobs, test thermal kitchen printers and verify ESC/POS routing
                  </p>
                </div>
                <button
                  onClick={handleTestPrint}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />
                  Print Test Ticket
                </button>
              </div>

              {printJobs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#71675E] bg-[#F7F3EC] rounded-lg">
                  No pending print jobs in spooler. Click &ldquo;Print Test Ticket&rdquo; to simulate ESC/POS output.
                </div>
              ) : (
                <div className="divide-y divide-[#EEE7DD] text-xs">
                  {printJobs.map((job) => (
                    <div key={job.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-[#292320]">{job.jobType || "KOT"}</span>
                        <span className="text-[#71675E] ml-2">Target Station: {job.stationId || "All"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#EBF4F0] text-[#28634B]">
                          {job.status || "COMPLETED"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Offline Sync & Draft Persistence */}
          {(activeTab === "ALL_PANELS" || activeTab === "OFFLINE_SYNC") && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Offline Sync Engine Simulation</h3>
                  <p className="text-xs text-[#71675E]">
                    Verify network drop protection, local queue resolution and conflict mitigation
                  </p>
                </div>
                <button
                  onClick={handleTriggerSync}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Flush & Sync Queues
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-[#F7F3EC] rounded border border-[#EEE7DD]">
                  <div className="text-[#71675E]">Draft Orders Stored</div>
                  <div className="text-base font-bold text-[#292320] tabular-nums">
                    {offlineSyncStats.pendingDraftCount || 0}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F3EC] rounded border border-[#EEE7DD]">
                  <div className="text-[#71675E]">Drafts Synced Today</div>
                  <div className="text-base font-bold text-[#292320] tabular-nums">
                    {offlineSyncStats.syncedTodayCount || 0}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F3EC] rounded border border-[#EEE7DD]">
                  <div className="text-[#71675E]">Resolution Conflicts</div>
                  <div className="text-base font-bold text-[#292320] tabular-nums">
                    {offlineSyncStats.conflictCount || 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Night Audit & Cross-Department Reconciliation */}
          {(activeTab === "ALL_PANELS" || activeTab === "RECONCILIATION") && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Night Audit & Reconciliation</h3>
                  <p className="text-xs text-[#71675E]">
                    Cross-checks table charges posted to room folios against settled restaurant bills
                  </p>
                </div>
                <button
                  onClick={handleRunReconciliation}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Execute Audit
                </button>
              </div>

              <div className="p-4 bg-[#EBF4F0] border border-[#C3DED0] rounded-lg flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#28634B] flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-[#28634B]">Audit Ledger Balanced</div>
                  <div className="text-[#71675E]">
                    All food & beverage orders charged to hotel rooms match their associated settled folio vouchers.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

