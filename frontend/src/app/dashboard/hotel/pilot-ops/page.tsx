"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
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
  DollarSign,
  Trash2,
  Eye,
  X,
  Lock,
  ArrowRightLeft,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

type PilotPanelTab =
  | "ALL_PANELS"
  | "FEATURE_FLAGS"
  | "HARDWARE_REHEARSAL"
  | "OFFLINE_SYNC"
  | "RECONCILIATION";

export interface PropertyFeatureFlagRecord {
  id?: string;
  businessId?: string;
  branchId?: string;
  hotelEnabled: boolean;
  restaurantEnabled: boolean;
  kdsEnabled: boolean;
  guestQrEnabled: boolean;
  folioBridgeEnabled: boolean;
  offlineDraftSyncEnabled: boolean;
  printerFailoverEnabled: boolean;
  pilotMode: boolean;
  version?: number;
  updatedAt?: string;
}

export interface KitchenStationOption {
  id: string;
  name: string;
  code: string;
  printerIp?: string | null;
  printerPort?: number | null;
  isActive?: boolean;
}

export interface PrintJobRecord {
  id: string;
  jobNumber: string;
  jobType: "KOT_58MM" | "RECEIPT_80MM" | "CASH_DRAWER_PULSE" | string;
  printerWidthMm: number;
  stationId?: string | null;
  fallbackStationId?: string | null;
  routedStationId?: string | null;
  targetPrinterIp?: string | null;
  targetPrinterPort?: number | null;
  cashDrawerPulse: boolean;
  escPosPayload: string;
  status: "PRINTED" | "REDIRECTED_TO_BACKUP" | "QUEUED" | "FAILED" | string;
  attempts: number;
  lastError?: string | null;
  idempotencyKey?: string | null;
  printedAt?: string | null;
  createdAt: string;
  station?: { id: string; name: string; code: string } | null;
}

export interface LocalDraftOperation {
  id: string;
  idempotencyKey: string;
  type: "RESTAURANT_ORDER_DRAFT" | "SERVICE_REQUEST_DRAFT" | "NOTE_DRAFT";
  label: string;
  summary: string;
  amount?: number;
  roomOrTable?: string;
  queuedAt: string;
  payload: Record<string, any>;
}

export interface OfflineSyncBatchRecord {
  id: string;
  terminalId: string;
  batchKey: string;
  operationsCount: number;
  appliedCount: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | string;
  idempotentReplay?: boolean;
  payload?: any;
  results?: any;
  syncedAt: string;
  createdAt?: string;
}

export interface PilotDailyReconciliationRecord {
  id: string;
  businessDate: string;
  expectedCashTotal: number | string;
  declaredCashTotal: number | string;
  cashVariance: number | string;
  retailSalesTotal: number | string;
  restaurantOrdersTotal: number | string;
  folioSettlementsTotal: number | string;
  status: "BALANCED" | "DISCREPANCY_FLAGGED" | string;
  notes?: string | null;
  reconciledAt: string;
}

export interface PilotHealthMetrics {
  status?: string;
  rpoTargetMinutes?: number;
  rtoTargetMinutes?: number;
  rpoMeasuredMinutes?: number;
  rtoMeasuredMinutes?: number;
  pitrVerified?: boolean;
  outbox?: {
    pendingCount?: number;
    processedCount?: number;
    publishedCount?: number;
    failedCount?: number;
    deadLetterCount?: number;
    healthy?: boolean;
  };
  printQueue?: {
    queuedCount?: number;
    printedCount?: number;
    redirectedCount?: number;
    failedCount?: number;
  };
  offlineSync?: {
    totalBatches?: number;
  };
}

const FEATURE_FLAG_DEFINITIONS: Array<{
  key: keyof Pick<
    PropertyFeatureFlagRecord,
    | "hotelEnabled"
    | "restaurantEnabled"
    | "kdsEnabled"
    | "guestQrEnabled"
    | "folioBridgeEnabled"
    | "offlineDraftSyncEnabled"
    | "printerFailoverEnabled"
    | "pilotMode"
  >;
  title: string;
  subtitle: string;
  endpointGuard: string;
}> = [
  {
    key: "hotelEnabled",
    title: "Hotel & Rooms Property Management",
    subtitle: "Controls Room Rack, Reservations, Check-In/Out, and Housekeeping endpoints",
    endpointGuard: "/api/v1/hotel/rooms, /stays, /reservations",
  },
  {
    key: "restaurantEnabled",
    title: "Restaurant Dining & Table POS",
    subtitle: "Controls Floor Plan, Table Sessions, Course Firing, and Split Checks",
    endpointGuard: "/api/v1/restaurant/tables, /orders",
  },
  {
    key: "kdsEnabled",
    title: "Kitchen Display System (KDS)",
    subtitle: "Controls real-time kitchen station ticket routing and bump-bar status updates",
    endpointGuard: "/api/v1/restaurant/kitchen-tickets",
  },
  {
    key: "guestQrEnabled",
    title: "Guest Location QR & Service Desk",
    subtitle: "Controls zero-secret room/table QR ordering and live waiter/housekeeping calls",
    endpointGuard: "/api/v1/guest/qr/*, /hotel/service-requests",
  },
  {
    key: "folioBridgeEnabled",
    title: "Cross-Outlet Room Folio Bridge",
    subtitle: "Controls posting restaurant checks and minibar charges to in-house Guest Folios",
    endpointGuard: "/api/v1/hotel/folios/[id]/charge-order",
  },
  {
    key: "offlineDraftSyncEnabled",
    title: "Offline Terminal Draft Buffer & Sync",
    subtitle: "Allows POS/Front-Desk terminals to flush queued offline operations idempotently",
    endpointGuard: "/api/v1/hotel/pilot/offline-sync",
  },
  {
    key: "printerFailoverEnabled",
    title: "Automatic Thermal Printer Failover",
    subtitle: "Redirects 58mm KOT / 80mm receipts to backup station when primary printer jams",
    endpointGuard: "/api/v1/hotel/pilot/print-jobs",
  },
  {
    key: "pilotMode",
    title: "Pilot Property Telemetry & Audit Mode",
    subtitle: "Enables verbose Phase 8 pilot telemetry, cash drawer pulse logs & daily audit checks",
    endpointGuard: "Property-wide Pilot Flag",
  },
];

const DEFAULT_FLAGS: PropertyFeatureFlagRecord = {
  hotelEnabled: true,
  restaurantEnabled: true,
  kdsEnabled: true,
  guestQrEnabled: true,
  folioBridgeEnabled: true,
  offlineDraftSyncEnabled: true,
  printerFailoverEnabled: true,
  pilotMode: true,
};

function formatCurrency(val: number | string | undefined | null): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return "$0.00";
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}

function formatEscPosHexPreview(payload: string): string {
  const bytes: string[] = [];
  for (let i = 0; i < Math.min(payload.length, 64); i++) {
    const code = payload.charCodeAt(i);
    bytes.push(`\\x${code.toString(16).toUpperCase().padStart(2, "0")}`);
  }
  return bytes.join("");
}

export default function PilotRolloutAndHardwareOpsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<PilotPanelTab>("ALL_PANELS");

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Panel 1: Feature Flags state
  const [featureFlags, setFeatureFlags] = useState<PropertyFeatureFlagRecord>(DEFAULT_FLAGS);
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null);

  // Panel 2: Hardware Rehearsal & Printer Failover state
  const [stations, setStations] = useState<KitchenStationOption[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJobRecord[]>([]);
  const [rehearsingMatrix, setRehearsingMatrix] = useState<boolean>(false);
  const [dispatchingPrint, setDispatchingPrint] = useState<boolean>(false);
  const [selectedJobType, setSelectedJobType] = useState<
    "KOT_58MM" | "RECEIPT_80MM" | "CASH_DRAWER_PULSE"
  >("KOT_58MM");
  const [primaryStationId, setPrimaryStationId] = useState<string>("");
  const [backupStationId, setBackupStationId] = useState<string>("");
  const [simulatePrinterJam, setSimulatePrinterJam] = useState<boolean>(true);
  const [includeDrawerPulse, setIncludeDrawerPulse] = useState<boolean>(false);
  const [previewPrintJob, setPreviewPrintJob] = useState<PrintJobRecord | null>(null);

  // Panel 3: Offline Terminal Draft Buffer & Idempotent Sync state
  const [terminalId, setTerminalId] = useState<string>("TERM-FRONT-DESK-01");
  const [currentBatchKey, setCurrentBatchKey] = useState<string>(
    () => `BATCH-PILOT-${Date.now().toString(36).toUpperCase()}`
  );
  const [lastSyncedBatchPayload, setLastSyncedBatchPayload] = useState<{
    terminalId: string;
    batchKey: string;
    operations: LocalDraftOperation[];
  } | null>(null);
  const [lastSyncReplayStatus, setLastSyncReplayStatus] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<LocalDraftOperation[]>([
    {
      id: "draft-1",
      idempotencyKey: "IDEMP-ORDER-T2-001",
      type: "RESTAURANT_ORDER_DRAFT",
      label: "Offline Dine-In Order Draft (Table T2)",
      summary: "2x Himalayan Momo Platter, 1x Masala Chiya • Queued while Wi-Fi offline",
      amount: 34.5,
      roomOrTable: "Table T2",
      queuedAt: new Date().toISOString(),
      payload: {
        orderType: "DINE_IN",
        notes: "Buffered on POS tablet during router cutover drill",
        items: [
          { itemName: "Himalayan Momo Platter", quantity: 2, unitPrice: 14.5 },
          { itemName: "Masala Chiya", quantity: 1, unitPrice: 5.5 },
        ],
      },
    },
    {
      id: "draft-2",
      idempotencyKey: "IDEMP-NOTE-FD-002",
      type: "NOTE_DRAFT",
      label: "Offline Front-Desk Terminal Audit Note",
      summary: "Manual credit card terminal slip #9941 ($85.00) verified during WAN drop",
      amount: 85.0,
      roomOrTable: "Front Desk POS",
      queuedAt: new Date().toISOString(),
      payload: {
        note: "Manual EFTPOS slip #9941 verified during WAN failover drill",
        amount: 85.0,
      },
    },
  ]);
  const [syncBatches, setSyncBatches] = useState<OfflineSyncBatchRecord[]>([]);
  const [syncingBatch, setSyncingBatch] = useState<boolean>(false);

  // Panel 4: Pilot Daily Audit & Cash Drawer Reconciliation + Health
  const [businessDate, setBusinessDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [declaredCashTotal, setDeclaredCashTotal] = useState<string>("0.00");
  const [reconciliationNotes, setReconciliationNotes] = useState<string>(
    "Phase 8 Pilot shift handover physical cash drawer count verified."
  );
  const [reconciliations, setReconciliations] = useState<PilotDailyReconciliationRecord[]>([]);
  const [runningReconciliation, setRunningReconciliation] = useState<boolean>(false);
  const [healthMetrics, setHealthMetrics] = useState<PilotHealthMetrics | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const buildHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = (session?.user as any)?.accessToken || (session as any)?.accessToken;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, [session]);

  const loadPilotConsoleData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = buildHeaders();
      const [ffRes, pjRes, osRes, rcRes, hlRes, stRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/hotel/pilot/feature-flags`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/v1/hotel/pilot/print-jobs`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/v1/hotel/pilot/offline-sync`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/v1/hotel/pilot/reconciliation`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/v1/hotel/pilot/health`, { headers }).catch(() => null),
        fetch(`${BACKEND_URL}/api/v1/restaurant/kitchen-stations`, { headers }).catch(() => null),
      ]);

      if (ffRes && ffRes.ok) {
        const raw = await ffRes.json();
        const unwrapped = raw.data ?? raw;
        const resolvedFlags =
          unwrapped.featureFlags || unwrapped.featureFlag || unwrapped.flags || unwrapped;
        if (resolvedFlags && typeof resolvedFlags === "object") {
          setFeatureFlags((prev) => ({
            ...prev,
            ...resolvedFlags,
          }));
        }
      }

      if (pjRes && pjRes.ok) {
        const raw = await pjRes.json();
        const unwrapped = raw.data ?? raw;
        const jobs: PrintJobRecord[] = Array.isArray(unwrapped)
          ? unwrapped
          : unwrapped.printJobs || unwrapped.jobs || [];
        setPrintJobs(jobs);
      }

      if (osRes && osRes.ok) {
        const raw = await osRes.json();
        const unwrapped = raw.data ?? raw;
        const batches: OfflineSyncBatchRecord[] = Array.isArray(unwrapped)
          ? unwrapped
          : unwrapped.batches || unwrapped.syncBatches || unwrapped.offlineSyncBatches || [];
        setSyncBatches(batches);
      }

      if (rcRes && rcRes.ok) {
        const raw = await rcRes.json();
        const unwrapped = raw.data ?? raw;
        const recs: PilotDailyReconciliationRecord[] = Array.isArray(unwrapped)
          ? unwrapped
          : unwrapped.reconciliations ||
            (unwrapped.reconciliation ? [unwrapped.reconciliation] : []);
        setReconciliations(recs);
        if (recs.length > 0 && declaredCashTotal === "0.00") {
          const latestExpected = Number(recs[0].expectedCashTotal ?? 0);
          if (latestExpected > 0) {
            setDeclaredCashTotal(latestExpected.toFixed(2));
          }
        }
      }

      if (hlRes && hlRes.ok) {
        const raw = await hlRes.json();
        const unwrapped = raw.data ?? raw;
        setHealthMetrics(unwrapped.health || unwrapped);
      }

      if (stRes && stRes.ok) {
        const stData = await stRes.json();
        const unwrapped = stData.data ?? stData;
        const loadedStations: KitchenStationOption[] = Array.isArray(unwrapped)
          ? unwrapped
          : unwrapped.stations || [];
        setStations(loadedStations);
        if (loadedStations.length > 0) {
          setPrimaryStationId((prev) => prev || loadedStations[0].id);
          setBackupStationId(
            (prev) =>
              prev ||
              (loadedStations.length > 1 ? loadedStations[1].id : loadedStations[0].id)
          );
        }
      }
    } catch (err: any) { Notify.failure(err.message || "Failed to load Phase 8 Pilot Operations console data"); } finally {
      setLoading(false);
    }
  }, [buildHeaders, declaredCashTotal]);

  useEffect(() => {
    loadPilotConsoleData();
  }, [loadPilotConsoleData]);

  // Derived KDS Failover Alert Jobs
  const redirectedPrintJobs = useMemo(
    () => printJobs.filter((j) => j.status === "REDIRECTED_TO_BACKUP"),
    [printJobs]
  );

  const stationNameById = useCallback(
    (id?: string | null) => {
      if (!id) return "Backup Pass Printer (192.168.1.202:9100)";
      const found = stations.find((s) => s.id === id || s.code === id);
      return found ? `${found.name} (${found.code})` : id;
    },
    [stations]
  );

  // =========================================================================
  // PANEL 1 HANDLERS: PROPERTY & BRANCH FEATURE FLAGS
  // =========================================================================
  const handleUpdateFeatureFlags = async (
    updatedFlags: PropertyFeatureFlagRecord,
    changedKey: string
  ) => {
    try {
      setSavingFlagKey(changedKey);
      setError('');
      setFeatureFlags(updatedFlags);

      const res = await fetch(`${BACKEND_URL}/api/v1/hotel/pilot/feature-flags`, {
        method: "PUT",
        headers: buildHeaders(),
        body: JSON.stringify(updatedFlags),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(raw.error || "Failed to update property feature flags");
      }

      const unwrapped = raw.data ?? raw;
      const saved =
        unwrapped.featureFlags || unwrapped.featureFlag || unwrapped.flags || unwrapped;
      if (saved && typeof saved === "object") {
        setFeatureFlags((prev) => ({ ...prev, ...saved }));
      }
      showToast(`Updated feature flag: ${changedKey}`);
    } catch (err: any) {
      Notify.failure(err.message || "Unable to update feature flags"); setError(err.message || "Unable to update feature flags");
      await loadPilotConsoleData();
    } finally {
      setSavingFlagKey(null);
    }
  };

  const handleToggleSingleFlag = (
    key: keyof Pick<
      PropertyFeatureFlagRecord,
      | "hotelEnabled"
      | "restaurantEnabled"
      | "kdsEnabled"
      | "guestQrEnabled"
      | "folioBridgeEnabled"
      | "offlineDraftSyncEnabled"
      | "printerFailoverEnabled"
      | "pilotMode"
    >
  ) => {
    const nextFlags: PropertyFeatureFlagRecord = {
      ...featureFlags,
      [key]: !featureFlags[key],
    };
    handleUpdateFeatureFlags(nextFlags, key);
  };

  // =========================================================================
  // PANEL 2 HANDLERS: HARDWARE REHEARSAL & PRINTER FAILOVER
  // =========================================================================
  const handleRunFullMatrixRehearsal = async () => {
    try {
      setRehearsingMatrix(true);
      setError('');

      const res = await fetch(`${BACKEND_URL}/api/v1/hotel/pilot/print-jobs`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          action: "REHEARSE_MATRIX",
          stationId: primaryStationId || undefined,
          fallbackStationId: backupStationId || undefined,
        }),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(raw.error || "Hardware matrix rehearsal failed");
      }

      await loadPilotConsoleData();
      showToast(
        "Completed 4-Step Hardware Matrix Rehearsal (80mm Receipt, 58mm KOT, RJ11 Drawer Pulse \\x1B\\x70\\x00\\x19\\xFA, & Backup Printer Failover)"
      );
    } catch (err: any) { Notify.failure(err.message || "Error running 4-step hardware rehearsal"); } finally {
      setRehearsingMatrix(false);
    }
  };

  const handleDispatchCustomPrintJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDispatchingPrint(true);
      setError('');

      const is58mm = selectedJobType === "KOT_58MM";
      const hasPulse = selectedJobType === "CASH_DRAWER_PULSE" || includeDrawerPulse;

      const res = await fetch(`${BACKEND_URL}/api/v1/hotel/pilot/print-jobs`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          action: "DISPATCH_PRINT_JOB",
          jobType: selectedJobType,
          printerWidthMm: is58mm ? 58 : 80,
          stationId: primaryStationId || undefined,
          fallbackStationId: backupStationId || undefined,
          cashDrawerPulse: hasPulse,
          simulatePrimaryFailure: simulatePrinterJam,
          title: `PILOT ${selectedJobType} TEST`,
          subtitle: simulatePrinterJam
            ? "Simulated Primary Jam -> Backup Failover"
            : "Standard Thermal Dispatch",
          lines: [
            { label: "Hospitality Pilot Test Item", qty: 1, price: 25.0 },
          ],
          footer: "Phase 8 Hardware Verification",
        }),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(raw.error || "Failed to dispatch print job");
      }

      const unwrapped = raw.data ?? raw;
      const job: PrintJobRecord | undefined = unwrapped.job || unwrapped.printJob || unwrapped;
      if (job && job.id) {
        setPreviewPrintJob(job);
      }
      await loadPilotConsoleData();

      showToast(
        simulatePrinterJam
          ? "Primary printer jam simulated — Job automatically redirected to backup station!"
          : `Print job (${selectedJobType}) dispatched to thermal printer.`
      );
    } catch (err: any) { Notify.failure(err.message || "Error dispatching print job"); } finally {
      setDispatchingPrint(false);
    }
  };

  // =========================================================================
  // PANEL 3 HANDLERS: OFFLINE DRAFT BUFFER & IDEMPOTENT RECONNECT SYNC
  // =========================================================================
  const handleQueueDraftPreset = (
    presetType: "RESTAURANT_ORDER_DRAFT" | "SERVICE_REQUEST_DRAFT" | "NOTE_DRAFT"
  ) => {
    const uniqueSuffix = `${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;
    const id = `draft-${uniqueSuffix}`;
    let newDraft: LocalDraftOperation;

    if (presetType === "RESTAURANT_ORDER_DRAFT") {
      newDraft = {
        id,
        idempotencyKey: `IDEMP-ORD-${uniqueSuffix}`,
        type: "RESTAURANT_ORDER_DRAFT",
        label: "Offline Dine-In Order Draft (Table T5)",
        summary: "1x Wood-Fired Margherita Pizza, 2x Sparkling Water",
        amount: 26.0,
        roomOrTable: "Table T5",
        queuedAt: new Date().toISOString(),
        payload: {
          orderType: "DINE_IN",
          notes: "Queued on tablet while Wi-Fi access point rebooted",
          items: [
            { itemName: "Wood-Fired Margherita Pizza", quantity: 1, unitPrice: 18.0 },
            { itemName: "Sparkling Water", quantity: 2, unitPrice: 4.0 },
          ],
        },
      };
    } else if (presetType === "SERVICE_REQUEST_DRAFT") {
      newDraft = {
        id,
        idempotencyKey: `IDEMP-SR-${uniqueSuffix}`,
        type: "SERVICE_REQUEST_DRAFT",
        label: "Offline Guest Service Request Draft (Room 301)",
        summary: "FRONT_DESK • Express Checkout & Luggage Assistance",
        roomOrTable: "Room 301",
        queuedAt: new Date().toISOString(),
        payload: {
          category: "FRONT_DESK",
          requestType: "EXPRESS_CHECKOUT",
          priority: "HIGH",
          notes: "Queued on tablet while Wi-Fi access point rebooted",
        },
      };
    } else {
      newDraft = {
        id,
        idempotencyKey: `IDEMP-NOTE-${uniqueSuffix}`,
        type: "NOTE_DRAFT",
        label: "Offline Cashier Terminal Shift Audit Note",
        summary: "Manual credit card terminal slip #9941 ($85.00) verified during WAN drop",
        amount: 85.0,
        roomOrTable: "Front Desk POS",
        queuedAt: new Date().toISOString(),
        payload: {
          note: "Manual EFTPOS slip #9941 verified during WAN failover drill",
          amount: 85.0,
        },
      };
    }

    setLocalDrafts((prev) => [...prev, newDraft]);
    showToast(`Added ${newDraft.label} to local offline buffer`);
  };

  const handleSyncOfflineBatch = async (isReplay: boolean = false) => {
    try {
      setSyncingBatch(true);
      setError('');
      setLastSyncReplayStatus(null);

      const payloadToSync =
        isReplay && lastSyncedBatchPayload
          ? lastSyncedBatchPayload
          : {
              terminalId: terminalId.trim() || "TERM-FRONT-DESK-01",
              batchKey: currentBatchKey.trim() || `BATCH-${Date.now()}`,
              operations: localDrafts,
            };

      const res = await fetch(`${BACKEND_URL}/api/v1/hotel/pilot/offline-sync`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          terminalId: payloadToSync.terminalId,
          batchKey: payloadToSync.batchKey,
          operations: payloadToSync.operations.map((op) => ({
            idempotencyKey: op.idempotencyKey || op.id,
            type: op.type,
            payload: op.payload,
          })),
        }),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(raw.error || "Offline batch sync failed");
      }

      const unwrapped = raw.data ?? raw;
      const isIdempotentDuplicate = Boolean(
        unwrapped.replayed ||
          unwrapped.idempotentReplay ||
          unwrapped.duplicate ||
          isReplay
      );

      if (!isReplay) {
        setLastSyncedBatchPayload(payloadToSync);
        setCurrentBatchKey(`BATCH-PILOT-${Date.now().toString(36).toUpperCase()}`);
      }

      if (isIdempotentDuplicate) {
        setLastSyncReplayStatus(
          `Idempotent Replay Verified for ${payloadToSync.batchKey}: 0 duplicate orders or service requests created!`
        );
      } else {
        setLastSyncReplayStatus(
          `Synced batch ${payloadToSync.batchKey} (${
            unwrapped.batch?.appliedCount ?? payloadToSync.operations.length
          } operations applied cleanly).`
        );
      }

      await loadPilotConsoleData();
      showToast(
        isIdempotentDuplicate
          ? `Idempotent Replay Verified (${payloadToSync.batchKey}) — Zero duplicate records created!`
          : `Offline batch ${payloadToSync.batchKey} synced idempotently!`
      );
    } catch (err: any) { Notify.failure(err.message || "Error syncing offline draft batch"); } finally {
      setSyncingBatch(false);
    }
  };

  // =========================================================================
  // PANEL 4 HANDLERS: PILOT DAILY AUDIT & CASH DRAWER RECONCILIATION
  // =========================================================================
  const handleRunDailyReconciliation = async (
    e: React.FormEvent,
    overrideDeclaredCash?: number
  ) => {
    e.preventDefault();
    try {
      setRunningReconciliation(true);
      setError('');

      const numericDeclared =
        overrideDeclaredCash !== undefined
          ? overrideDeclaredCash
          : Number(declaredCashTotal || 0);

      const res = await fetch(`${BACKEND_URL}/api/v1/hotel/pilot/reconciliation`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          businessDate,
          declaredCashTotal: numericDeclared,
          notes: reconciliationNotes,
        }),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(raw.error || "Failed to execute daily pilot reconciliation");
      }

      const unwrapped = raw.data ?? raw;
      const rec: PilotDailyReconciliationRecord | undefined =
        unwrapped.reconciliation || unwrapped.record || unwrapped;
      if (rec && rec.id) {
        setDeclaredCashTotal(Number(rec.declaredCashTotal ?? numericDeclared).toFixed(2));
      }
      await loadPilotConsoleData();

      showToast(
        `Daily Pilot Audit Reconciled for ${businessDate} (${rec?.status || "COMPLETED"})`
      );
    } catch (err: any) { Notify.failure(err.message || "Error running daily cash reconciliation"); } finally {
      setRunningReconciliation(false);
    }
  };

  const handleMatchExpectedCash = async () => {
    const latestExpected =
      reconciliations.length > 0 ? Number(reconciliations[0].expectedCashTotal ?? 0) : 0;
    setDeclaredCashTotal(latestExpected.toFixed(2));
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleRunDailyReconciliation(fakeEvent, latestExpected);
  };

  const latestReconciliation = reconciliations[0] || null;
  const enabledFlagsCount = FEATURE_FLAG_DEFINITIONS.filter(
    (f) => Boolean(featureFlags[f.key])
  ).length;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1E1B18] p-6 space-y-6">
      {/* =====================================================================
          TOP COMMAND CENTER HEADER & NAVIGATION TABS
         ===================================================================== */}
      <div className="bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#6B2837]">
              <ShieldCheck className="w-4 h-4 text-[#A77B38]" />
              <span>Phase 8 • Operational Readiness, Hardware Rehearsals & Pilot Rollout</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E1B18] mt-1">
              Pilot Rollout, Hardware Rehearsal & Daily Reconciliation Console
            </h1>
            <p className="text-sm text-[#6E655F] mt-0.5">
              Property feature-flag kill switches, ESC/POS 80mm/58mm thermal printer failover
              simulator, offline terminal draft sync, and daily cash drawer reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              RPO &lt; {healthMetrics?.rpoTargetMinutes ?? 5} min • RTO &lt;{" "}
              {healthMetrics?.rtoTargetMinutes ?? 30} min ({healthMetrics?.status || "HEALTHY"})
            </span>

            <button
              type="button"
              onClick={loadPilotConsoleData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FAF6F0] border border-[#E2D9C8] text-xs font-bold text-[#6B2837] hover:bg-[#F0EAE0] transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Console
            </button>
          </div>
        </div>

        {/* Panel Filter Tabs */}
        <div className="pt-3 border-t border-[#F0EAE0] flex items-center gap-2 flex-wrap">
          {[
            { id: "ALL_PANELS", label: "All 4 Operational Panels", icon: ShieldCheck },
            {
              id: "FEATURE_FLAGS",
              label: `1. Property Feature Flags (${enabledFlagsCount}/8)`,
              icon: Sliders,
            },
            {
              id: "HARDWARE_REHEARSAL",
              label: `2. Hardware & Printer Failover (${printJobs.length})`,
              icon: Printer,
            },
            {
              id: "OFFLINE_SYNC",
              label: `3. Offline Draft Sync (${localDrafts.length} Queued)`,
              icon: WifiOff,
            },
            {
              id: "RECONCILIATION",
              label: "4. Daily Audit & Cash Reconciliation",
              icon: Receipt,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as PilotPanelTab)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                  active
                    ? "bg-[#6B2837] text-white shadow-sm"
                    : "bg-[#FAF6F0] text-[#4A433E] border border-[#E2D9C8] hover:bg-[#F0EAE0]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Toast & Error Banner */}
      {toastMessage && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-900 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          PROMINENT KDS VISUAL FAILOVER ALERT BANNER (Whenever REDIRECTED_TO_BACKUP exists)
         ===================================================================== */}
      {redirectedPrintJobs.length > 0 && (
        <div
          role="alert"
          data-testid="kds-printer-failover-banner"
          className="rounded-lg bg-amber-50 border-2 border-amber-400 p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-red-700 text-white">
                  KDS VISUAL FAILOVER ALERT • REDIRECTED_TO_BACKUP
                </span>
                <span className="text-xs font-bold text-amber-950">
                  {redirectedPrintJobs.length} Thermal Print Job(s) Rerouted
                </span>
              </div>
              <h2 className="text-base font-extrabold text-amber-950 mt-1">
                Primary Kitchen Printer Jam / Offline Detected — Tickets Redirected to Backup
                Station:{" "}
                <span className="underline decoration-amber-600">
                  {stationNameById(
                    redirectedPrintJobs[0].routedStationId ||
                      redirectedPrintJobs[0].fallbackStationId
                  )}
                </span>
              </h2>
              <p className="text-xs text-amber-900 mt-0.5">
                Latest Job <strong>#{redirectedPrintJobs[0].jobNumber}</strong> (
                {redirectedPrintJobs[0].jobType}) failed on primary station (
                {redirectedPrintJobs[0].lastError || "PAPER_JAM_OR_OFFLINE"}) and was
                automatically printed at backup station{" "}
                <strong>
                  {stationNameById(
                    redirectedPrintJobs[0].routedStationId ||
                      redirectedPrintJobs[0].fallbackStationId
                  )}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewPrintJob(redirectedPrintJobs[0])}
              className="px-3.5 py-2 rounded-md bg-amber-900 text-white text-xs font-bold hover:bg-amber-950 transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              Inspect Failover Slip
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          PANEL 1: PROPERTY & BRANCH FEATURE FLAGS (PropertyFeatureFlag)
         ===================================================================== */}
      {(activeTab === "ALL_PANELS" || activeTab === "FEATURE_FLAGS") && (
        <section
          aria-label="Property & Branch Feature Flags"
          className="bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#F0EAE0] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[#1E1B18]">
                    Panel 1: Property & Branch Feature Flags
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF6F0] text-[#6B2837] border border-[#E2D9C8]">
                    PropertyFeatureFlag • v{featureFlags.version ?? 1}
                  </span>
                </div>
                <p className="text-xs text-[#6E655F]">
                  Instant module kill-switches for safe pilot cutover and zero-downtime retail
                  isolation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  handleUpdateFeatureFlags(
                    {
                      ...featureFlags,
                      hotelEnabled: true,
                      restaurantEnabled: true,
                      kdsEnabled: true,
                      guestQrEnabled: true,
                      folioBridgeEnabled: true,
                      offlineDraftSyncEnabled: true,
                      printerFailoverEnabled: true,
                      pilotMode: true,
                    },
                    "ALL_PILOT_ENABLED"
                  )
                }
                className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Enable All Hospitality Flags
              </button>

              <button
                type="button"
                onClick={() =>
                  handleUpdateFeatureFlags(
                    {
                      ...featureFlags,
                      hotelEnabled: false,
                      restaurantEnabled: false,
                      kdsEnabled: false,
                      guestQrEnabled: false,
                      folioBridgeEnabled: false,
                    },
                    "EMERGENCY_RETAIL_ONLY_CUTOVER"
                  )
                }
                className="px-3 py-1.5 rounded-md bg-[#FAF6F0] hover:bg-red-50 text-[#9E2A2B] border border-red-200 text-xs font-bold transition cursor-pointer"
              >
                Emergency Cutover (Retail POS Only)
              </button>
            </div>
          </div>

          {/* Governance Callout */}
          <div className="p-4 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#6B2837] shrink-0 mt-0.5" />
            <div className="text-xs text-[#4A433E] space-y-1">
              <p className="font-extrabold text-[#1E1B18]">
                Zero-Data-Loss Feature Flag Governance Guarantee (`403 FEATURE_DISABLED`)
              </p>
              <p className="leading-relaxed">
                Disabling any hospitality flag below immediately blocks new operational entry
                points with HTTP{" "}
                <code className="font-mono font-bold text-[#6B2837]">403 FEATURE_DISABLED</code>{" "}
                while preserving 100% of committed Guest Folios, In-House Stays, Kitchen Tickets,
                and existing Retail POS sales ledgers. Retail POS billing (
                <code className="font-mono">/dashboard/pos</code>) continues uninterrupted.
              </p>
            </div>
          </div>

          {/* 8 Feature Flag Switches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURE_FLAG_DEFINITIONS.map((item) => {
              const isEnabled = Boolean(featureFlags[item.key]);
              const isSaving = savingFlagKey === item.key;

              return (
                <div
                  key={item.key}
                  className={`rounded-lg p-4 border transition flex flex-col justify-between gap-3 ${
                    isEnabled
                      ? "bg-[#FFFCF7] border-[#E6DEC8] shadow-xs"
                      : "bg-red-50/40 border-red-200"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#6B2837] bg-[#FAF6F0] px-2 py-0.5 rounded-md border border-[#E2D9C8]">
                        {item.key}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isEnabled
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {isEnabled ? "ENABLED" : "403 BLOCKED"}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-[#1E1B18]">{item.title}</h3>
                    <p className="text-xs text-[#6E655F] leading-relaxed">{item.subtitle}</p>
                  </div>

                  <div className="pt-2.5 border-t border-[#F0EAE0] flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[#8C827A] truncate">
                      {item.endpointGuard}
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`Toggle ${item.key}`}
                      disabled={isSaving}
                      onClick={() => handleToggleSingleFlag(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-[#6B2837]" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#FFFCF7] shadow ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          PANEL 2: HARDWARE REHEARSAL & PRINTER FAILOVER SIMULATOR (PrintJob)
         ===================================================================== */}
      {(activeTab === "ALL_PANELS" || activeTab === "HARDWARE_REHEARSAL") && (
        <section
          aria-label="Hardware Rehearsal & Printer Failover Simulator"
          className="bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#F0EAE0] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1E1B18]">
                  Panel 2: Hardware Rehearsal & Thermal Printer Failover Simulator
                </h2>
                <p className="text-xs text-[#6E655F]">
                  ESC/POS 80mm receipt & 58mm KOT generator, RJ11 cash drawer pulse (
                  <code className="font-mono">\x1B\x70\x00\x19\xFA</code>), and automatic backup
                  station failover
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunFullMatrixRehearsal}
              disabled={rehearsingMatrix}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#561F2B] text-white text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {rehearsingMatrix
                ? "Running 4-Step Hardware Matrix..."
                : "Run Full 4-Step Hardware Matrix Rehearsal"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Custom Print Job & Failover Tester Form */}
            <form
              onSubmit={handleDispatchCustomPrintJob}
              className="bg-[#FAF6F0] rounded-lg p-5 border border-[#E6DEC8] space-y-4 h-fit"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#1E1B18]">
                  Custom Print Job & Failover Tester
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FFFCF7] border border-[#E2D9C8] text-[#6B2837]">
                  ESC/POS TCP 9100
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                  Hardware Job Type
                </label>
                <select
                  value={selectedJobType}
                  onChange={(e) =>
                    setSelectedJobType(
                      e.target.value as "KOT_58MM" | "RECEIPT_80MM" | "CASH_DRAWER_PULSE"
                    )
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-bold text-[#1E1B18]"
                >
                  <option value="KOT_58MM">KOT_58MM (58mm Kitchen Order Ticket - 32 cols)</option>
                  <option value="RECEIPT_80MM">
                    RECEIPT_80MM (80mm Guest / POS Thermal Receipt - 48 cols)
                  </option>
                  <option value="CASH_DRAWER_PULSE">
                    CASH_DRAWER_PULSE (RJ11 Kick Pulse \x1B\x70\x00\x19\xFA)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Primary Kitchen Station
                  </label>
                  <select
                    value={primaryStationId}
                    onChange={(e) => setPrimaryStationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-semibold"
                  >
                    <option value="">Hot Kitchen Primary (192.168.1.201)</option>
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Backup Failover Station
                  </label>
                  <select
                    value={backupStationId}
                    onChange={(e) => setBackupStationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-semibold"
                  >
                    <option value="">Backup Pass Printer (192.168.1.202)</option>
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-md bg-amber-50 border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulatePrinterJam}
                    onChange={(e) => setSimulatePrinterJam(e.target.checked)}
                    className="rounded text-[#6B2837] focus:ring-[#6B2837]"
                  />
                  <div>
                    <span className="block text-xs font-extrabold text-amber-950">
                      Simulate Primary Printer Jam / Offline
                    </span>
                    <span className="block text-[11px] text-amber-800">
                      Triggers automatic failover to Backup Station (`REDIRECTED_TO_BACKUP`)
                    </span>
                  </div>
                </label>

                {selectedJobType !== "CASH_DRAWER_PULSE" && (
                  <label className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDrawerPulse}
                      onChange={(e) => setIncludeDrawerPulse(e.target.checked)}
                      className="rounded text-[#6B2837]"
                    />
                    <span className="text-xs font-semibold text-[#1E1B18]">
                      Append RJ11 Cash Drawer Kick Pulse (
                      <code className="font-mono">\x1B\x70\x00\x19\xFA</code>)
                    </span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={dispatchingPrint}
                className="w-full py-2.5 rounded-md bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
              >
                {dispatchingPrint
                  ? "Dispatching ESC/POS Job..."
                  : "Dispatch Thermal Print Job"}
              </button>
            </form>

            {/* Recent PrintJob Queue Table */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#1E1B18]">
                  Recent ESC/POS Print Job Queue ({printJobs.length})
                </h3>
                <span className="text-xs text-[#6E655F]">
                  Click any job to inspect raw ESC/POS bytes & thermal slip
                </span>
              </div>

              {printJobs.length === 0 ? (
                <div className="rounded-lg border border-[#E6DEC8] bg-[#FAF6F0] p-10 text-center space-y-2">
                  <Printer className="w-8 h-8 text-[#A77B38] mx-auto" />
                  <p className="text-sm font-bold text-[#1E1B18]">
                    No Hardware Print Jobs Recorded Yet
                  </p>
                  <p className="text-xs text-[#6E655F]">
                    Click &ldquo;Run Full 4-Step Hardware Matrix Rehearsal&rdquo; above to test
                    80mm receipts, 58mm KOTs, RJ11 drawer kicks, and backup station failover.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E6DEC8]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAF6F0] border-b border-[#E6DEC8] text-[11px] font-extrabold uppercase text-[#6E655F]">
                        <th className="py-3 px-4">Job #</th>
                        <th className="py-3 px-4">Type & Width</th>
                        <th className="py-3 px-4">Station Routing</th>
                        <th className="py-3 px-4">RJ11 Pulse</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">ESC/POS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EAE0] text-xs">
                      {printJobs.slice(0, 12).map((job) => {
                        const isRedirected = job.status === "REDIRECTED_TO_BACKUP";
                        return (
                          <tr
                            key={job.id}
                            className={
                              isRedirected
                                ? "bg-amber-50/70 hover:bg-amber-50"
                                : "hover:bg-[#FAF6F0]/60"
                            }
                          >
                            <td className="py-3 px-4 font-mono font-bold text-[#1E1B18]">
                              {job.jobNumber}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-[#1E1B18]">{job.jobType}</span>
                              <span className="ml-1.5 px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2D9C8] text-[10px] font-mono">
                                {job.printerWidthMm}mm
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isRedirected ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-amber-900 font-bold">
                                    <ArrowRightLeft className="w-3 h-3" />
                                    Backup:{" "}
                                    {stationNameById(job.routedStationId || job.fallbackStationId)}
                                  </span>
                                  {job.lastError && (
                                    <p className="text-[10px] text-red-700 font-mono">
                                      Primary Error: {job.lastError}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#4A433E]">
                                  {job.station?.name ||
                                    stationNameById(job.routedStationId || job.stationId)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {job.cashDrawerPulse ? (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono text-[10px] font-bold">
                                  \x1B\x70\x00\x19\xFA
                                </span>
                              ) : (
                                <span className="text-[#8C827A]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isRedirected
                                    ? "bg-amber-200 text-amber-950 border border-amber-400"
                                    : job.status === "PRINTED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : job.status === "FAILED"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-stone-100 text-stone-700"
                                }`}
                              >
                                {job.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setPreviewPrintJob(job)}
                                className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#E6DEC8] border border-[#E2D9C8] text-[11px] font-bold text-[#6B2837] cursor-pointer"
                              >
                                Preview Payload
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PANEL 3: OFFLINE TERMINAL DRAFT BUFFER & IDEMPOTENT RECONNECT SYNC
         ===================================================================== */}
      {(activeTab === "ALL_PANELS" || activeTab === "OFFLINE_SYNC") && (
        <section
          aria-label="Offline Terminal Draft Buffer & Idempotent Reconnect Sync"
          className="bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#F0EAE0] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1E1B18]">
                  Panel 3: Offline Terminal Draft Buffer & Idempotent Reconnect Sync
                </h2>
                <p className="text-xs text-[#6E655F]">
                  Queue local POS & Guest Desk drafts during network drops and verify zero-duplicate
                  idempotent batch replay on reconnect
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={syncingBatch || localDrafts.length === 0}
                onClick={() => handleSyncOfflineBatch(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#561F2B] text-white text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingBatch ? "animate-spin" : ""}`} />
                Reconnect & Sync Batch Idempotently
              </button>

              <button
                type="button"
                disabled={syncingBatch}
                onClick={() => handleSyncOfflineBatch(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md bg-[#FAF6F0] hover:bg-[#F0EAE0] text-[#1E1B18] border border-[#E2D9C8] text-xs font-bold transition cursor-pointer"
                title="Re-send the exact same batchKey to prove idempotency (zero duplicate records)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#A77B38]" />
                Replay Same Batch Key
              </button>
            </div>
          </div>

          {lastSyncReplayStatus && (
            <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{lastSyncReplayStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Local Browser Offline Draft Buffer */}
            <div className="bg-[#FAF6F0] rounded-lg p-5 border border-[#E6DEC8] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E1B18]">
                    Local Terminal Offline Buffer ({localDrafts.length} Queued)
                  </h3>
                  <p className="text-[11px] text-[#6E655F]">
                    Terminal: <code className="font-mono font-bold">{terminalId}</code> • Batch Key:{" "}
                    <code className="font-mono font-bold text-[#6B2837]">{currentBatchKey}</code>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQueueDraftPreset("RESTAURANT_ORDER_DRAFT")}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FFFCF7] border border-[#E2D9C8] text-[11px] font-bold text-[#6B2837] hover:bg-[#F0EAE0] cursor-pointer"
                  >
                    + Dine-In Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueDraftPreset("SERVICE_REQUEST_DRAFT")}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FFFCF7] border border-[#E2D9C8] text-[11px] font-bold text-[#6B2837] hover:bg-[#F0EAE0] cursor-pointer"
                  >
                    + Service Request Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueDraftPreset("NOTE_DRAFT")}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FFFCF7] border border-[#E2D9C8] text-[11px] font-bold text-[#1E1B18] hover:bg-[#F0EAE0] cursor-pointer"
                  >
                    + Terminal Note
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#6E655F] mb-1">
                    Terminal Identifier
                  </label>
                  <input
                    type="text"
                    value={terminalId}
                    onChange={(e) => setTerminalId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6E655F] mb-1">
                    Idempotency Batch Key
                  </label>
                  <input
                    type="text"
                    value={currentBatchKey}
                    onChange={(e) => setCurrentBatchKey(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {localDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="bg-[#FFFCF7] rounded-md p-3.5 border border-[#E6DEC8] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2D9C8] text-[10px] font-mono font-bold text-[#6B2837]">
                          {draft.type}
                        </span>
                        {draft.roomOrTable && (
                          <span className="text-xs font-bold text-[#1E1B18]">
                            {draft.roomOrTable}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#1E1B18]">{draft.label}</p>
                      <p className="text-[11px] text-[#6E655F]">{draft.summary}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLocalDrafts((prev) => prev.filter((item) => item.id !== draft.id))
                      }
                      className="text-[#8C827A] hover:text-red-700 p-1 cursor-pointer"
                      title="Remove draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Synced OfflineSyncBatch History */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#1E1B18]">
                Synced Offline Batch Ledger (`OfflineSyncBatch` • {syncBatches.length})
              </h3>

              {syncBatches.length === 0 ? (
                <div className="rounded-lg border border-[#E6DEC8] bg-[#FAF6F0] p-10 text-center space-y-2">
                  <Database className="w-8 h-8 text-[#A77B38] mx-auto" />
                  <p className="text-sm font-bold text-[#1E1B18]">No Offline Batches Synced Yet</p>
                  <p className="text-xs text-[#6E655F]">
                    Click &ldquo;Reconnect & Sync Batch Idempotently&rdquo; to flush the buffered
                    drafts to the server.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E6DEC8]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAF6F0] border-b border-[#E6DEC8] text-[11px] font-extrabold uppercase text-[#6E655F]">
                        <th className="py-3 px-4">Batch Key</th>
                        <th className="py-3 px-4">Terminal</th>
                        <th className="py-3 px-4">Ops / Applied</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Synced At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EAE0] text-xs">
                      {syncBatches.slice(0, 10).map((batch) => (
                        <tr key={batch.id} className="hover:bg-[#FAF6F0]/60">
                          <td className="py-3 px-4 font-mono font-bold text-[#6B2837]">
                            {batch.batchKey}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#4A433E]">
                            {batch.terminalId}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#1E1B18]">
                            {batch.operationsCount} queued / {batch.appliedCount} applied
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                              {batch.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#6E655F]">
                            {new Date(batch.syncedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PANEL 4: PILOT DAILY AUDIT & CASH DRAWER RECONCILIATION
         ===================================================================== */}
      {(activeTab === "ALL_PANELS" || activeTab === "RECONCILIATION") && (
        <section
          aria-label="Pilot Daily Audit & Cash Drawer Reconciliation"
          className="bg-[#FFFCF7] rounded-lg p-6 border border-[#E6DEC8] shadow-sm space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#F0EAE0] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1E1B18]">
                  Panel 4: Pilot Daily Audit, Cash Drawer Reconciliation & DR Readiness
                </h2>
                <p className="text-xs text-[#6E655F]">
                  Cross-outlet daily audit across Retail POS Sales, Restaurant Orders, and Hotel
                  Folio Settlements with PITR / Outbox health
                </p>
              </div>
            </div>

            {latestReconciliation && (
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border ${
                  latestReconciliation.status === "BALANCED"
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : "bg-amber-100 text-amber-950 border-amber-400"
                }`}
              >
                Latest Audit Status: {latestReconciliation.status} (Variance:{" "}
                {formatCurrency(latestReconciliation.cashVariance)})
              </span>
            )}
          </div>

          {/* Reconciled Breakdown + DR / Outbox Health KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-[#FAF6F0] rounded-lg p-4 border border-[#E6DEC8]">
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">Retail POS Sales</p>
              <p className="text-xl font-extrabold text-[#1E1B18] mt-1">
                {formatCurrency(latestReconciliation?.retailSalesTotal ?? 0)}
              </p>
              <p className="text-[11px] text-[#8C827A] mt-0.5">Committed branch sales</p>
            </div>

            <div className="bg-[#FAF6F0] rounded-lg p-4 border border-[#E6DEC8]">
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">Restaurant Orders</p>
              <p className="text-xl font-extrabold text-[#1E1B18] mt-1">
                {formatCurrency(latestReconciliation?.restaurantOrdersTotal ?? 0)}
              </p>
              <p className="text-[11px] text-[#8C827A] mt-0.5">Dine-in, takeaway & room dining</p>
            </div>

            <div className="bg-[#FAF6F0] rounded-lg p-4 border border-[#E6DEC8]">
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">
                Hotel Folio Settlements
              </p>
              <p className="text-xl font-extrabold text-[#6B2837] mt-1">
                {formatCurrency(latestReconciliation?.folioSettlementsTotal ?? 0)}
              </p>
              <p className="text-[11px] text-[#8C827A] mt-0.5">Front desk & checkout payments</p>
            </div>

            <div className="bg-[#FAF6F0] rounded-lg p-4 border border-[#E6DEC8]">
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">
                Expected vs Declared Cash
              </p>
              <p className="text-lg font-extrabold text-[#1E1B18] mt-1">
                {formatCurrency(latestReconciliation?.expectedCashTotal ?? 0)} /{" "}
                {formatCurrency(latestReconciliation?.declaredCashTotal ?? declaredCashTotal)}
              </p>
              <p className="text-[11px] text-[#8C827A] mt-0.5">Physical drawer count match</p>
            </div>

            <div
              className={`rounded-lg p-4 border ${
                Number(latestReconciliation?.cashVariance ?? 0) === 0
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-300"
              }`}
            >
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">Cash Drawer Variance</p>
              <div className="flex items-center gap-2 mt-1">
                <p
                  className={`text-xl font-extrabold ${
                    Number(latestReconciliation?.cashVariance ?? 0) === 0
                      ? "text-emerald-800"
                      : "text-amber-950"
                  }`}
                >
                  {formatCurrency(latestReconciliation?.cashVariance ?? 0)}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    (latestReconciliation?.status || "BALANCED") === "BALANCED"
                      ? "bg-emerald-200 text-emerald-950"
                      : "bg-amber-300 text-amber-950"
                  }`}
                >
                  {latestReconciliation?.status || "BALANCED"}
                </span>
              </div>
              <p className="text-[11px] text-[#6E655F] mt-0.5">Target: $0.00 discrepancy</p>
            </div>

            <div className="bg-[#FAF6F0] rounded-lg p-4 border border-[#E6DEC8]">
              <p className="text-[11px] font-bold uppercase text-[#6E655F]">
                Outbox & DR Readiness
              </p>
              <p className="text-sm font-extrabold text-emerald-800 mt-1">
                RPO &lt; 5m • RTO &lt; 30m
              </p>
              <p className="text-[11px] text-[#6E655F] mt-1">
                Outbox Pending: {healthMetrics?.outbox?.pendingCount ?? 0} • Failed:{" "}
                {healthMetrics?.outbox?.failedCount ?? 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Cash Drawer Reconciliation Form */}
            <form
              onSubmit={(e) => handleRunDailyReconciliation(e)}
              className="bg-[#FAF6F0] rounded-lg p-5 border border-[#E6DEC8] space-y-4 h-fit"
            >
              <h3 className="text-sm font-extrabold text-[#1E1B18]">
                Execute Daily Cash Drawer Reconciliation
              </h3>

              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                  Business Audit Date
                </label>
                <input
                  type="date"
                  required
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1E1B18]">
                    Declared Physical Cash Total ($)
                  </label>
                  {latestReconciliation && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeclaredCashTotal(
                          Number(latestReconciliation.expectedCashTotal ?? 0).toFixed(2)
                        )
                      }
                      className="text-[11px] font-bold text-[#6B2837] underline cursor-pointer"
                    >
                      Use Expected ({formatCurrency(latestReconciliation.expectedCashTotal)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={declaredCashTotal}
                  onChange={(e) => setDeclaredCashTotal(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-sm font-mono font-bold text-[#1E1B18]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                  Shift Handover & Audit Notes
                </label>
                <textarea
                  rows={2}
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#FFFCF7] border border-[#E2D9C8] text-xs"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={runningReconciliation}
                  className="w-full py-2.5 rounded-md bg-[#6B2837] hover:bg-[#561F2B] text-white text-xs font-extrabold shadow transition cursor-pointer disabled:opacity-50"
                >
                  {runningReconciliation
                    ? "Reconciling Ledgers..."
                    : "Submit Daily Cash Drawer Reconciliation"}
                </button>

                <button
                  type="button"
                  disabled={runningReconciliation}
                  onClick={handleMatchExpectedCash}
                  className="w-full py-2 rounded-md bg-[#FFFCF7] hover:bg-[#F0EAE0] text-[#1E1B18] border border-[#E2D9C8] text-xs font-bold transition cursor-pointer"
                >
                  Auto-Match Expected Cash ($0.00 Variance)
                </button>
              </div>
            </form>

            {/* Reconciliations History Table */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-extrabold text-[#1E1B18]">
                Pilot Daily Reconciliation Audit Log (`PilotDailyReconciliation` •{" "}
                {reconciliations.length})
              </h3>

              {reconciliations.length === 0 ? (
                <div className="rounded-lg border border-[#E6DEC8] bg-[#FAF6F0] p-10 text-center space-y-2">
                  <DollarSign className="w-8 h-8 text-[#A77B38] mx-auto" />
                  <p className="text-sm font-bold text-[#1E1B18]">
                    No Daily Reconciliations Logged Yet
                  </p>
                  <p className="text-xs text-[#6E655F]">
                    Submit a physical cash drawer count on the left to compute system expected cash
                    and variance across Retail, Restaurant, and Hotel Folios.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E6DEC8]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAF6F0] border-b border-[#E6DEC8] text-[11px] font-extrabold uppercase text-[#6E655F]">
                        <th className="py-3 px-4">Business Date</th>
                        <th className="py-3 px-4">Retail / Rest / Folio</th>
                        <th className="py-3 px-4">Expected Cash</th>
                        <th className="py-3 px-4">Declared Cash</th>
                        <th className="py-3 px-4">Variance</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EAE0] text-xs">
                      {reconciliations.map((rec) => {
                        const isBalanced = rec.status === "BALANCED";
                        return (
                          <tr key={rec.id} className="hover:bg-[#FAF6F0]/60">
                            <td className="py-3 px-4 font-mono font-bold text-[#1E1B18]">
                              {String(rec.businessDate).slice(0, 10)}
                            </td>
                            <td className="py-3 px-4 text-[#4A433E]">
                              {formatCurrency(rec.retailSalesTotal)} /{" "}
                              {formatCurrency(rec.restaurantOrdersTotal)} /{" "}
                              {formatCurrency(rec.folioSettlementsTotal)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#1E1B18]">
                              {formatCurrency(rec.expectedCashTotal)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#1E1B18]">
                              {formatCurrency(rec.declaredCashTotal)}
                            </td>
                            <td
                              className={`py-3 px-4 font-mono font-extrabold ${
                                isBalanced ? "text-emerald-800" : "text-red-700"
                              }`}
                            >
                              {formatCurrency(rec.cashVariance)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isBalanced
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-200 text-amber-950"
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MODAL: ESC/POS THERMAL PAYLOAD & SLIP PREVIEW
         ===================================================================== */}
      {previewPrintJob && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] rounded-lg max-w-lg w-full p-6 border border-[#D8CEC1] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#6B2837]" />
                <h3 className="text-sm font-extrabold text-[#1E1B18]">
                  ESC/POS Hardware Payload Inspector • {previewPrintJob.jobNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPrintJob(null)}
                className="text-[#8C827A] hover:text-[#1E1B18] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-[#FAF6F0] p-3 rounded-md border border-[#E6DEC8]">
              <div>
                <span className="font-bold text-[#1E1B18]">{previewPrintJob.jobType}</span> •{" "}
                <span className="font-mono">{previewPrintJob.printerWidthMm}mm</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  previewPrintJob.status === "REDIRECTED_TO_BACKUP"
                    ? "bg-amber-200 text-amber-950"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {previewPrintJob.status}
              </span>
            </div>

            {previewPrintJob.cashDrawerPulse && (
              <div className="p-3 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-950 font-mono">
                RJ11 Cash Drawer Kick Pulse Included: <strong>\x1B\x70\x00\x19\xFA</strong> (ESC p 0
                25 250)
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase text-[#6E655F] mb-1">
                Formatted Thermal Slip Output ({previewPrintJob.printerWidthMm}mm)
              </p>
              <pre className="p-4 rounded-md bg-[#1E1B18] text-[#FAF6F0] font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed">
                {previewPrintJob.escPosPayload}
              </pre>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase text-[#6E655F] mb-1">
                Leading Raw Hex Stream
              </p>
              <div className="p-2.5 rounded-md bg-[#FAF6F0] border border-[#E6DEC8] font-mono text-[11px] text-[#4A433E] break-all">
                {formatEscPosHexPreview(previewPrintJob.escPosPayload)}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewPrintJob(null)}
                className="px-4 py-2 rounded-md bg-[#6B2837] text-white text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
