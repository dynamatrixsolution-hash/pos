"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  formatNPR,
  toCents,
  fromCents,
  parseMoney,
  addMoney,
  subMoney,
} from "@/lib/currency";
import {
  Receipt,
  Lock,
  Unlock,
  Plus,
  UtensilsCrossed,
  BedDouble,
  CreditCard,
  Printer,
  ArrowRightLeft,
  RotateCcw,
  Moon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Split,
  X,
  FileText,
  Sparkles,
} from "lucide-react";

type FolioWindowName = "PRIMARY" | "COMPANY" | "PERSONAL" | "INCIDENTALS" | string;
type FolioStatus = "OPEN" | "SETTLING" | "CLOSED" | string;
type ChargeCategoryFilter = "ALL" | "ROOM" | "DINING" | "MINIBAR" | "LAUNDRY" | "SPA" | "OTHER";
type PaymentMethodType = "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "DEPOSIT";

interface StaySummary {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  roomId: string;
  checkInTime: string;
  expectedCheckOut: string;
  status: string;
  ratePerNight: number | string;
  totalCharges: number | string;
  paidAmount: number | string;
  room?: {
    id: string;
    roomNumber: string;
    roomType?: {
      name: string;
      code: string;
      baseRate: number | string;
    };
  };
}

interface FolioEntry {
  id: string;
  folioId?: string;
  entryNumber?: string;
  entryType?: "CHARGE" | "CREDIT_ADJUSTMENT" | "PAYMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | string;
  category?: string;
  chargeCategory?: string;
  description: string;
  amount: number | string;
  taxAmount?: number | string;
  totalAmount?: number | string;
  direction?: "DEBIT" | "CREDIT" | string;
  accountingClass?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  restaurantOrderId?: string | null;
  isVoided?: boolean;
  voidedAt?: string | null;
  reversedByEntryId?: string | null;
  createdAt?: string;
  postedAt?: string;
  notes?: string | null;
}

interface FolioPayment {
  id: string;
  paymentMethod: PaymentMethodType | string;
  amount: number | string;
  reference?: string | null;
  createdAt?: string;
}

interface GuestFolio {
  id: string;
  folioNumber?: string;
  stayId: string;
  windowName: FolioWindowName;
  status: FolioStatus;
  totalCharges?: number | string;
  totalCredits?: number | string;
  totalPayments?: number | string;
  totalPaid?: number | string;
  balanceDue?: number | string;
  netBalance?: number | string;
  notes?: string | null;
  entries?: FolioEntry[];
  payments?: FolioPayment[];
  settlements?: FolioPayment[];
  createdAt?: string;
  updatedAt?: string;
}

interface ReconciliationMetrics {
  roomRevenue?: number | string;
  diningReceivableTransferred?: number | string;
  diningTransferred?: number | string;
  incidentalRevenue?: number | string;
  creditsAndAdjustments?: number | string;
  totalCredits?: number | string;
  paymentsApplied?: number | string;
  totalPayments?: number | string;
  netBalance?: number | string;
  netFolioBalance?: number | string;
  balanceDue?: number | string;
}

interface RestaurantOrderItem {
  id: string;
  orderNumber: string;
  status: string;
  settlementStatus: string;
  totalAmount: number | string;
  subtotal?: number | string;
  taxAmount?: number | string;
  createdAt?: string;
  table?: {
    tableNumber: string;
  };
}

interface TenderLine {
  id: string;
  paymentMethod: PaymentMethodType;
  amount: string;
  reference: string;
}

const PRESET_WINDOWS: FolioWindowName[] = ["PRIMARY", "COMPANY", "PERSONAL", "INCIDENTALS"];
const CATEGORY_FILTERS: ChargeCategoryFilter[] = [
  "ALL",
  "ROOM",
  "DINING",
  "MINIBAR",
  "LAUNDRY",
  "SPA",
  "OTHER",
];

export default function GuestFoliosBillingPage() {
  const [stays, setStays] = useState<StaySummary[]>([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [folios, setFolios] = useState<GuestFolio[]>([]);
  const [activeFolioId, setActiveFolioId] = useState<string>("");
  const [reconciliation, setReconciliation] = useState<ReconciliationMetrics | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ChargeCategoryFilter>("ALL");

  const [loadingStays, setLoadingStays] = useState<boolean>(true);
  const [loadingFolios, setLoadingFolios] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Night Audit Modal state
  const [isNightAuditOpen, setIsNightAuditOpen] = useState<boolean>(false);
  const [auditDate, setAuditDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [taxRatePercent, setTaxRatePercent] = useState<string>("13");

  // Split Folio Window Modal state
  const [isNewWindowOpen, setIsNewWindowOpen] = useState<boolean>(false);
  const [newWindowName, setNewWindowName] = useState<string>("COMPANY");
  const [newWindowNotes, setNewWindowNotes] = useState<string>("");

  // Post Charge Modal state
  const [isPostChargeOpen, setIsPostChargeOpen] = useState<boolean>(false);
  const [chargeMode, setChargeMode] = useState<"ROOM_NIGHT" | "INCIDENTAL">("INCIDENTAL");
  const [roomChargeDate, setRoomChargeDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [roomBaseRate, setRoomBaseRate] = useState<string>("");
  const [incidentalCategory, setIncidentalCategory] = useState<string>("MINIBAR");
  const [incidentalDescription, setIncidentalDescription] = useState<string>("");
  const [incidentalAmount, setIncidentalAmount] = useState<string>("");
  const [incidentalTaxAmount, setIncidentalTaxAmount] = useState<string>("0");

  // Charge Restaurant Order to Room Modal state
  const [isChargeOrderOpen, setIsChargeOrderOpen] = useState<boolean>(false);
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  // Reverse / Credit Adjust Entry Modal state
  const [reverseTargetEntry, setReverseTargetEntry] = useState<FolioEntry | null>(null);
  const [reverseAmount, setReverseAmount] = useState<string>("");
  const [reverseReason, setReverseReason] = useState<string>("Guest billing adjustment / rebate");

  // Move Entry to Window state
  const [transferringEntryId, setTransferringEntryId] = useState<string | null>(null);

  // Multi-Tender Settlement Modal state
  const [isSettleOpen, setIsSettleOpen] = useState<boolean>(false);
  const [tenders, setTenders] = useState<TenderLine[]>([
    { id: "t-1", paymentMethod: "CASH", amount: "0.00", reference: "" },
  ]);

  // Tax Invoice Print / Preview Modal state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);
  const [invoiceFormat, setInvoiceFormat] = useState<"A4" | "THERMAL_80MM">("A4");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Load stays
  const loadStays = useCallback(async () => {
    try {
      setLoadingStays(true);
      setError(null);
      const res = await fetch("/api/v1/hotel/stays");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load active stays");
      }
      const data = await res.json();
      const loadedStays: StaySummary[] = data.stays || [];
      setStays(loadedStays);

      if (loadedStays.length > 0 && !selectedStayId) {
        const activeInHouse =
          loadedStays.find(
            (s) => s.status === "ACTIVE" || s.status === "EXTENDED" || s.status === "TRANSFERRED"
          ) || loadedStays[0];
        setSelectedStayId(activeInHouse.id);
      }
    } catch (err: any) {
      setError(err.message || "Unable to fetch hotel stays");
    } finally {
      setLoadingStays(false);
    }
  }, [selectedStayId]);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  // Load folios for selectedStayId
  const loadFoliosForStay = useCallback(
    async (stayId: string, preferredFolioId?: string) => {
      if (!stayId) return;
      try {
        setLoadingFolios(true);
        setError(null);
        const res = await fetch(`/api/v1/hotel/folios?stayId=${encodeURIComponent(stayId)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load guest folios");
        }
        const data = await res.json();
        const list: GuestFolio[] = data.folios || (data.folio ? [data.folio] : []);
        setFolios(list);
        setReconciliation(data.reconciliation || null);

        if (preferredFolioId && list.some((f) => f.id === preferredFolioId)) {
          setActiveFolioId(preferredFolioId);
        } else if (list.length > 0) {
          const currentStillExists = list.find((f) => f.id === activeFolioId);
          if (currentStillExists) {
            setActiveFolioId(currentStillExists.id);
          } else {
            const primary = list.find((f) => f.windowName === "PRIMARY") || list[0];
            setActiveFolioId(primary.id);
          }
        } else {
          setActiveFolioId("");
        }
      } catch (err: any) {
        setError(err.message || "Error loading guest folios");
      } finally {
        setLoadingFolios(false);
      }
    },
    [activeFolioId]
  );

  useEffect(() => {
    if (selectedStayId) {
      loadFoliosForStay(selectedStayId);
    }
  }, [selectedStayId, loadFoliosForStay]);

  // Refresh detailed active folio if needed
  const refreshActiveFolioDetail = useCallback(
    async (folioId: string) => {
      if (!folioId) return;
      try {
        const res = await fetch(`/api/v1/hotel/folios/${encodeURIComponent(folioId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.folio) {
          setFolios((prev) =>
            prev.map((f) => (f.id === data.folio.id ? { ...f, ...data.folio } : f))
          );
        }
        if (data.reconciliation) {
          setReconciliation(data.reconciliation);
        }
      } catch {
        // Ignore background detail refresh error
      }
    },
    []
  );

  const selectedStay = useMemo(
    () => stays.find((s) => s.id === selectedStayId) || null,
    [stays, selectedStayId]
  );

  const activeFolio = useMemo(
    () => folios.find((f) => f.id === activeFolioId) || folios[0] || null,
    [folios, activeFolioId]
  );

  // Normalize entry properties
  const getEntryCategory = (entry: FolioEntry): string => {
    const raw = (entry.category || entry.chargeCategory || entry.entryType || "OTHER").toUpperCase();
    if (raw.includes("ROOM")) return "ROOM";
    if (raw.includes("DINING") || raw.includes("RESTAURANT") || entry.restaurantOrderId) {
      return "DINING";
    }
    if (raw.includes("MINIBAR")) return "MINIBAR";
    if (raw.includes("LAUNDRY")) return "LAUNDRY";
    if (raw.includes("SPA")) return "SPA";
    if (raw.includes("CREDIT") || raw.includes("REVERSE") || raw.includes("ADJUST")) {
      return "ADJUSTMENT";
    }
    if (raw.includes("PAYMENT") || raw.includes("SETTLE")) return "PAYMENT";
    return raw;
  };

  const getEntryGrossCents = (entry: FolioEntry): number => {
    if (entry.totalAmount !== undefined && entry.totalAmount !== null) {
      return Math.abs(toCents(entry.totalAmount));
    }
    const base = Math.abs(toCents(entry.amount));
    const tax = Math.abs(toCents(entry.taxAmount || 0));
    return base + tax;
  };

  const isCreditEntry = (entry: FolioEntry): boolean => {
    if (entry.direction === "CREDIT") return true;
    const type = (entry.entryType || "").toUpperCase();
    if (
      type === "CREDIT_ADJUSTMENT" ||
      type === "PAYMENT" ||
      type === "REVERSAL" ||
      type === "TRANSFER_OUT"
    ) {
      return true;
    }
    return toCents(entry.amount) < 0;
  };

  // Compute Accounting & Revenue Invariant KPIs (uses backend reconciliation if present, else exact integer cents computation across folios)
  const kpiMetrics = useMemo(() => {
    let roomRevCents = 0;
    let diningTransferCents = 0;
    let incidentalRevCents = 0;
    let creditsCents = 0;
    let paymentsCents = 0;

    const allEntries = folios.flatMap((f) => f.entries || []);
    for (const entry of allEntries) {
      if (entry.isVoided) continue;
      const cat = getEntryCategory(entry);
      const cents = getEntryGrossCents(entry);
      const isCredit = isCreditEntry(entry);

      if (isCredit) {
        if (cat === "PAYMENT" || (entry.entryType || "").toUpperCase() === "PAYMENT") {
          paymentsCents += cents;
        } else {
          creditsCents += cents;
        }
      } else {
        if (cat === "ROOM") {
          roomRevCents += cents;
        } else if (cat === "DINING") {
          diningTransferCents += cents;
        } else {
          incidentalRevCents += cents;
        }
      }
    }

    // Also include explicit folio payments if not already represented as PAYMENT entries
    const paymentEntryCount = allEntries.filter(
      (e) => (e.entryType || "").toUpperCase() === "PAYMENT"
    ).length;
    if (paymentEntryCount === 0) {
      for (const f of folios) {
        const pList = f.payments || f.settlements || [];
        if (pList.length > 0) {
          for (const p of pList) {
            paymentsCents += Math.abs(toCents(p.amount));
          }
        } else if (f.totalPayments !== undefined || f.totalPaid !== undefined) {
          paymentsCents += Math.abs(toCents(f.totalPayments ?? f.totalPaid ?? 0));
        }
      }
    }

    const computedNetCents =
      roomRevCents + diningTransferCents + incidentalRevCents - creditsCents - paymentsCents;

    return {
      roomRevenue:
        reconciliation?.roomRevenue !== undefined
          ? fromCents(toCents(reconciliation.roomRevenue))
          : fromCents(roomRevCents),
      diningTransferred:
        reconciliation?.diningReceivableTransferred !== undefined
          ? fromCents(toCents(reconciliation.diningReceivableTransferred))
          : reconciliation?.diningTransferred !== undefined
          ? fromCents(toCents(reconciliation.diningTransferred))
          : fromCents(diningTransferCents),
      incidentalRevenue:
        reconciliation?.incidentalRevenue !== undefined
          ? fromCents(toCents(reconciliation.incidentalRevenue))
          : fromCents(incidentalRevCents),
      creditsAndAdjustments:
        reconciliation?.creditsAndAdjustments !== undefined
          ? fromCents(toCents(reconciliation.creditsAndAdjustments))
          : reconciliation?.totalCredits !== undefined
          ? fromCents(toCents(reconciliation.totalCredits))
          : fromCents(creditsCents),
      paymentsApplied:
        reconciliation?.paymentsApplied !== undefined
          ? fromCents(toCents(reconciliation.paymentsApplied))
          : reconciliation?.totalPayments !== undefined
          ? fromCents(toCents(reconciliation.totalPayments))
          : fromCents(paymentsCents),
      netBalance:
        reconciliation?.netBalance !== undefined
          ? fromCents(toCents(reconciliation.netBalance))
          : reconciliation?.netFolioBalance !== undefined
          ? fromCents(toCents(reconciliation.netFolioBalance))
          : reconciliation?.balanceDue !== undefined
          ? fromCents(toCents(reconciliation.balanceDue))
          : fromCents(computedNetCents),
    };
  }, [folios, reconciliation]);

  // Active Folio specific totals
  const activeFolioTotals = useMemo(() => {
    if (!activeFolio) {
      return { charges: "0.00", credits: "0.00", payments: "0.00", balance: "0.00" };
    }
    let chargesCents = 0;
    let creditsCents = 0;
    let paymentsCents = 0;

    for (const e of activeFolio.entries || []) {
      if (e.isVoided) continue;
      const cents = getEntryGrossCents(e);
      if (isCreditEntry(e)) {
        if ((e.entryType || "").toUpperCase() === "PAYMENT" || getEntryCategory(e) === "PAYMENT") {
          paymentsCents += cents;
        } else {
          creditsCents += cents;
        }
      } else {
        chargesCents += cents;
      }
    }

    if (paymentsCents === 0) {
      const pList = activeFolio.payments || activeFolio.settlements || [];
      if (pList.length > 0) {
        paymentsCents = pList.reduce((acc, p) => acc + Math.abs(toCents(p.amount)), 0);
      } else if (activeFolio.totalPayments !== undefined || activeFolio.totalPaid !== undefined) {
        paymentsCents = toCents(activeFolio.totalPayments ?? activeFolio.totalPaid ?? 0);
      }
    }

    const finalCharges =
      activeFolio.totalCharges !== undefined
        ? toCents(activeFolio.totalCharges)
        : chargesCents;
    const finalCredits =
      activeFolio.totalCredits !== undefined
        ? toCents(activeFolio.totalCredits)
        : creditsCents;
    const finalBalance =
      activeFolio.balanceDue !== undefined
        ? toCents(activeFolio.balanceDue)
        : activeFolio.netBalance !== undefined
        ? toCents(activeFolio.netBalance)
        : finalCharges - finalCredits - paymentsCents;

    return {
      charges: fromCents(finalCharges),
      credits: fromCents(finalCredits),
      payments: fromCents(paymentsCents),
      balance: fromCents(finalBalance),
    };
  }, [activeFolio]);

  // Filtered entries for the active folio ledger table
  const filteredEntries = useMemo(() => {
    const entries = activeFolio?.entries || [];
    if (categoryFilter === "ALL") return entries;
    return entries.filter((entry) => {
      const cat = getEntryCategory(entry);
      if (categoryFilter === "OTHER") {
        return !["ROOM", "DINING", "MINIBAR", "LAUNDRY", "SPA"].includes(cat);
      }
      return cat === categoryFilter;
    });
  }, [activeFolio, categoryFilter]);

  // Handlers
  const handleSelectOrCreatePresetWindow = async (windowName: FolioWindowName) => {
    const existing = folios.find((f) => f.windowName.toUpperCase() === windowName.toUpperCase());
    if (existing) {
      setActiveFolioId(existing.id);
      refreshActiveFolioDetail(existing.id);
      return;
    }
    if (!selectedStayId) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/folios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stayId: selectedStayId,
          windowName,
          notes: `${windowName} split-folio billing window`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to create ${windowName} folio window`);
      const newId = data.folio?.id;
      await loadFoliosForStay(selectedStayId, newId);
      showToast(`Created ${windowName} folio window`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCustomWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStayId || !newWindowName) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/folios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stayId: selectedStayId,
          windowName: newWindowName.trim().toUpperCase(),
          notes: newWindowNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create split folio window");
      setIsNewWindowOpen(false);
      setNewWindowNotes("");
      await loadFoliosForStay(selectedStayId, data.folio?.id);
      showToast(`Opened ${newWindowName.toUpperCase()} folio window`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLockFolio = async () => {
    if (!activeFolio) return;
    const nextAction = activeFolio.status === "SETTLING" ? "UNLOCK" : "LOCK";
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${nextAction.toLowerCase()} folio`);
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      showToast(
        nextAction === "LOCK"
          ? `Folio window ${activeFolio.windowName} locked for checkout (SETTLING)`
          : `Folio window ${activeFolio.windowName} unlocked (OPEN)`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunNightAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch("/api/v1/hotel/night-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditDate,
          taxRatePercent: Number(taxRatePercent) || 13,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Night Audit failed");
      setIsNightAuditOpen(false);
      await loadStays();
      if (selectedStayId) {
        await loadFoliosForStay(selectedStayId, activeFolio?.id);
      }
      const postedCount =
        data.postedCount ?? data.result?.postedCount ?? data.chargesPosted ?? "all eligible";
      showToast(`Night Audit completed for ${auditDate} (${postedCount} room night charges posted)`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openPostChargeModal = (defaultMode: "ROOM_NIGHT" | "INCIDENTAL") => {
    setChargeMode(defaultMode);
    if (selectedStay) {
      setRoomBaseRate(String(parseMoney(selectedStay.ratePerNight)));
    }
    setIncidentalCategory("MINIBAR");
    setIncidentalDescription("");
    setIncidentalAmount("");
    setIncidentalTaxAmount("0");
    setIsPostChargeOpen(true);
  };

  const handlePostChargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio || !selectedStayId) return;
    try {
      setActionLoading(true);
      setError(null);
      const payload =
        chargeMode === "ROOM_NIGHT"
          ? {
              type: "ROOM_NIGHT",
              stayId: selectedStayId,
              chargeDate: roomChargeDate,
              baseRate: Number(roomBaseRate) || Number(selectedStay?.ratePerNight) || 0,
            }
          : {
              stayId: selectedStayId,
              category: incidentalCategory,
              description:
                incidentalDescription.trim() || `${incidentalCategory} guest charge`,
              amount: Number(incidentalAmount) || 0,
              taxAmount: Number(incidentalTaxAmount) || 0,
            };

      const res = await fetch(
        `/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}/charges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post charge to folio");

      setIsPostChargeOpen(false);
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      await loadStays();
      showToast(
        chargeMode === "ROOM_NIGHT"
          ? `Posted room night charge (${roomChargeDate}) to ${activeFolio.windowName}`
          : `Posted ${incidentalCategory} charge to ${activeFolio.windowName}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openChargeRestaurantOrderModal = async () => {
    setIsChargeOrderOpen(true);
    try {
      setLoadingOrders(true);
      const res = await fetch("/api/v1/restaurant/orders");
      if (res.ok) {
        const data = await res.json();
        const orders: RestaurantOrderItem[] = data.orders || [];
        setRestaurantOrders(orders);
        const eligible = orders.find((o) => o.settlementStatus !== "PAID") || orders[0];
        if (eligible) setSelectedOrderId(eligible.id);
      }
    } catch {
      // ignore error
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleChargeOrderToRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio || !selectedStayId || !selectedOrderId) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(
        `/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}/charge-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: selectedOrderId,
            stayId: selectedStayId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer restaurant order to folio");
      setIsChargeOrderOpen(false);
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      await loadStays();
      showToast("Restaurant order transferred to guest folio as Dining Receivable (Zero Duplicate Revenue)");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferEntryWindow = async (entryId: string, targetFolioId: string) => {
    if (!activeFolio || !targetFolioId || targetFolioId === activeFolio.id) return;
    try {
      setTransferringEntryId(entryId);
      setError(null);
      const res = await fetch(
        `/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}/entries/${encodeURIComponent(
          entryId
        )}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetFolioId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move folio entry to target window");
      const targetWindow = folios.find((f) => f.id === targetFolioId)?.windowName || "target window";
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      showToast(`Transferred ledger line to ${targetWindow} window`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTransferringEntryId(null);
    }
  };

  const openReverseModal = (entry: FolioEntry) => {
    setReverseTargetEntry(entry);
    const gross = fromCents(getEntryGrossCents(entry));
    setReverseAmount(gross);
    setReverseReason("Guest billing rebate / charge reversal");
  };

  const handleReverseEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio || !reverseTargetEntry) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(
        `/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}/entries/${encodeURIComponent(
          reverseTargetEntry.id
        )}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adjustmentAmount: Number(reverseAmount) || 0,
            reason: reverseReason.trim() || "Folio credit adjustment",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reverse / adjust folio entry");
      setReverseTargetEntry(null);
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      await loadStays();
      showToast("Posted append-only credit adjustment to folio ledger");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openSettleModal = () => {
    const bal = Math.max(0, parseMoney(activeFolioTotals.balance));
    setTenders([
      {
        id: `t-${Date.now()}`,
        paymentMethod: "CASH",
        amount: bal.toFixed(2),
        reference: "",
      },
    ]);
    setIsSettleOpen(true);
  };

  const addTenderLine = () => {
    const allocatedCents = tenders.reduce((acc, t) => acc + toCents(t.amount), 0);
    const targetCents = Math.max(0, toCents(activeFolioTotals.balance));
    const remainingCents = Math.max(0, targetCents - allocatedCents);
    setTenders((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}-${prev.length}`,
        paymentMethod: "CARD",
        amount: fromCents(remainingCents),
        reference: "",
      },
    ]);
  };

  const updateTenderLine = (
    id: string,
    field: keyof Omit<TenderLine, "id">,
    value: string
  ) => {
    setTenders((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const removeTenderLine = (id: string) => {
    if (tenders.length <= 1) return;
    setTenders((prev) => prev.filter((line) => line.id !== id));
  };

  const totalTenderAllocatedCents = useMemo(
    () => tenders.reduce((acc, t) => acc + Math.max(0, toCents(t.amount)), 0),
    [tenders]
  );

  const settleTargetCents = useMemo(
    () => Math.max(0, toCents(activeFolioTotals.balance)),
    [activeFolioTotals.balance]
  );

  const settleRemainingCents = settleTargetCents - totalTenderAllocatedCents;

  const handleSettleFolioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolio) return;
    try {
      setActionLoading(true);
      setError(null);
      const validTenders = tenders
        .filter((t) => toCents(t.amount) > 0)
        .map((t) => ({
          paymentMethod: t.paymentMethod,
          amount: Number(parseMoney(t.amount)),
          reference: t.reference.trim() || undefined,
        }));

      if (validTenders.length === 0) {
        throw new Error("Please enter at least one valid payment tender amount");
      }

      const res = await fetch(
        `/api/v1/hotel/folios/${encodeURIComponent(activeFolio.id)}/settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenders: validTenders }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Folio settlement failed");

      setIsSettleOpen(false);
      await loadFoliosForStay(selectedStayId, activeFolio.id);
      await loadStays();
      showToast(`Settled ${activeFolio.windowName} folio (${formatNPR(fromCents(totalTenderAllocatedCents))})`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto bg-[#F7F3EC] min-h-screen text-[#1F1A17]">
      {/* Top Toolbar & Active Stay Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#D8CEC1] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-[#FFFCF7]">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1F1A17] tracking-tight">
                Guest Folios, Split-Billing & Hotel Tax Invoice
              </h1>
              <p className="text-xs text-[#6E6259] mt-0.5">
                Append-only room ledger, restaurant receivable transfers, multi-window folio routing & multi-tender settlement
              </p>
            </div>
          </div>
        </div>

        {/* Active Stay Selector + Night Audit */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg px-3 py-1.5 shadow-xs">
            <BedDouble className="h-4 w-4 text-[#6B2837]" />
            <label htmlFor="active-stay-select" className="text-[11px] font-bold uppercase text-[#6E6259]">
              Stay:
            </label>
            <select
              id="active-stay-select"
              value={selectedStayId}
              onChange={(e) => setSelectedStayId(e.target.value)}
              disabled={loadingStays || stays.length === 0}
              className="text-xs font-bold text-[#1F1A17] bg-transparent focus:outline-none pr-2 cursor-pointer"
            >
              {stays.length === 0 ? (
                <option value="">No stays available</option>
              ) : (
                stays.map((st) => (
                  <option key={st.id} value={st.id}>
                    Room {st.room?.roomNumber || "N/A"} — {st.guestName} ({st.stayNumber}) [{st.status}]
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              loadStays();
              if (selectedStayId) loadFoliosForStay(selectedStayId, activeFolio?.id);
            }}
            className="p-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EFE8DC] text-[#1F1A17] cursor-pointer transition-colors"
            title="Refresh Folio Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loadingFolios ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsNightAuditOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#946000] hover:bg-[#7A4F00] text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Run Daily Night Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInvoiceOpen(true)}
            disabled={!activeFolio}
            className="px-3.5 py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Tax Invoice / Print</span>
          </button>
        </div>
      </div>

      {/* Toast Notification & Error Banner */}
      {toastMessage && (
        <div className="rounded-xl border border-[#C3DED0] bg-[#EBF4F0] px-4 py-3 text-xs font-bold text-[#28634B] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#28634B] hover:opacity-75 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#E9B6B7] bg-[#FCEEEE] px-4 py-3 text-xs font-bold text-[#B33432] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#B33432] hover:opacity-75 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Accounting & Revenue Invariant Banner / KPI Strip */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D8CEC1]/60 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#28634B]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F1A17]">
              Stay Accounting & Revenue Invariant Strip
            </span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF4F0] text-[#28634B] border border-[#C3DED0]">
            Zero Duplicate F&B Revenue Invariant Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] p-3">
            <span className="text-[10px] font-bold uppercase text-[#6E6259] block">
              Room Revenue
            </span>
            <span className="text-sm font-black text-[#1F1A17] mt-1 block">
              {formatNPR(kpiMetrics.roomRevenue)}
            </span>
            <span className="text-[10px] text-[#28634B] font-semibold">
              Hotel Accommodation GL
            </span>
          </div>

          <div className="rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] p-3">
            <span className="text-[10px] font-bold uppercase text-[#946000] block">
              Dining Receivable Transferred
            </span>
            <span className="text-sm font-black text-[#946000] mt-1 block">
              {formatNPR(kpiMetrics.diningTransferred)}
            </span>
            <span className="text-[10px] text-[#6E6259] font-semibold">
              No Duplicate Revenue
            </span>
          </div>

          <div className="rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] p-3">
            <span className="text-[10px] font-bold uppercase text-[#6E6259] block">
              Incidental Revenue
            </span>
            <span className="text-sm font-black text-[#1F1A17] mt-1 block">
              {formatNPR(kpiMetrics.incidentalRevenue)}
            </span>
            <span className="text-[10px] text-[#6E6259] font-semibold">
              Minibar / Laundry / Spa
            </span>
          </div>

          <div className="rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] p-3">
            <span className="text-[10px] font-bold uppercase text-[#B33432] block">
              Credits & Adjustments
            </span>
            <span className="text-sm font-black text-[#B33432] mt-1 block">
              -{formatNPR(kpiMetrics.creditsAndAdjustments)}
            </span>
            <span className="text-[10px] text-[#6E6259] font-semibold">
              Append-Only Reversals
            </span>
          </div>

          <div className="rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] p-3">
            <span className="text-[10px] font-bold uppercase text-[#28634B] block">
              Payments Applied
            </span>
            <span className="text-sm font-black text-[#28634B] mt-1 block">
              {formatNPR(kpiMetrics.paymentsApplied)}
            </span>
            <span className="text-[10px] text-[#6E6259] font-semibold">
              Multi-Tender Settled
            </span>
          </div>

          <div className="rounded-lg bg-[#F9EFF1] border border-[#E3C6CC] p-3">
            <span className="text-[10px] font-bold uppercase text-[#6B2837] block">
              Net Folio Balance
            </span>
            <span className="text-base font-black text-[#6B2837] mt-1 block">
              {formatNPR(kpiMetrics.netBalance)}
            </span>
            <span className="text-[10px] text-[#6B2837] font-semibold">
              Total Stay Receivable
            </span>
          </div>
        </div>
      </div>

      {/* Split-Folio Window Tabs & Active Folio Controls */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#D8CEC1] pb-3">
          {/* Split-Folio Window Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_WINDOWS.map((winName) => {
              const matchingFolio = folios.find(
                (f) => f.windowName.toUpperCase() === winName.toUpperCase()
              );
              const isSelected =
                activeFolio?.windowName.toUpperCase() === winName.toUpperCase();

              return (
                <button
                  key={winName}
                  type="button"
                  onClick={() => handleSelectOrCreatePresetWindow(winName)}
                  disabled={!selectedStayId || actionLoading}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837] shadow-xs"
                      : matchingFolio
                      ? "bg-[#F7F3EC] text-[#1F1A17] border-[#D8CEC1] hover:bg-[#EFE8DC]"
                      : "bg-[#FFFCF7] text-[#6E6259] border-dashed border-[#D8CEC1] hover:border-[#6B2837] hover:text-[#6B2837]"
                  }`}
                >
                  <span>{winName}</span>
                  {matchingFolio ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                        isSelected
                          ? "bg-[#FFFCF7]/20 text-[#FFFCF7]"
                          : matchingFolio.status === "CLOSED"
                          ? "bg-[#EBF4F0] text-[#28634B]"
                          : matchingFolio.status === "SETTLING"
                          ? "bg-[#FDF3E3] text-[#946000]"
                          : "bg-[#F9EFF1] text-[#6B2837]"
                      }`}
                    >
                      {matchingFolio.status}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-65">+ Open</span>
                  )}
                </button>
              );
            })}

            {/* Render any non-preset custom windows */}
            {folios
              .filter(
                (f) =>
                  !PRESET_WINDOWS.includes(f.windowName.toUpperCase())
              )
              .map((customFolio) => {
                const isSelected = activeFolio?.id === customFolio.id;
                return (
                  <button
                    key={customFolio.id}
                    type="button"
                    onClick={() => setActiveFolioId(customFolio.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837] shadow-xs"
                        : "bg-[#F7F3EC] text-[#1F1A17] border-[#D8CEC1] hover:bg-[#EFE8DC]"
                    }`}
                  >
                    <span>{customFolio.windowName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                      {customFolio.status}
                    </span>
                  </button>
                );
              })}

            <button
              type="button"
              onClick={() => setIsNewWindowOpen(true)}
              disabled={!selectedStayId}
              className="px-3 py-2 rounded-lg text-xs font-bold border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EFE8DC] text-[#6B2837] flex items-center gap-1.5 cursor-pointer"
            >
              <Split className="h-3.5 w-3.5" />
              <span>+ Split Folio Window</span>
            </button>
          </div>

          {/* Active Folio Status Badge & Lock/Unlock Toggle */}
          {activeFolio && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  activeFolio.status === "CLOSED"
                    ? "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                    : activeFolio.status === "SETTLING"
                    ? "bg-[#FDF3E3] text-[#946000] border-[#EED2A3]"
                    : "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]"
                }`}
              >
                {activeFolio.status === "SETTLING" && <Lock className="h-3 w-3" />}
                <span>
                  Window: {activeFolio.windowName} ({activeFolio.status})
                </span>
              </span>

              {activeFolio.status !== "CLOSED" && (
                <button
                  type="button"
                  onClick={handleToggleLockFolio}
                  disabled={actionLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    activeFolio.status === "SETTLING"
                      ? "bg-[#FFFCF7] text-[#946000] border-[#946000] hover:bg-[#FDF3E3]"
                      : "bg-[#FDF3E3] text-[#946000] border-[#EED2A3] hover:bg-[#F7E5C8]"
                  }`}
                >
                  {activeFolio.status === "SETTLING" ? (
                    <>
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Unlock Folio</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Lock for Checkout (SETTLING)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Folio Window Action Bar */}
        {activeFolio ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-[#6E6259] font-medium">Folio #: </span>
                <span className="font-bold text-[#1F1A17]">
                  {activeFolio.folioNumber || activeFolio.id.slice(0, 10).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#6E6259] font-medium">Window Charges: </span>
                <span className="font-bold text-[#1F1A17]">
                  {formatNPR(activeFolioTotals.charges)}
                </span>
              </div>
              <div>
                <span className="text-[#6E6259] font-medium">Window Credits: </span>
                <span className="font-bold text-[#B33432]">
                  -{formatNPR(activeFolioTotals.credits)}
                </span>
              </div>
              <div>
                <span className="text-[#6E6259] font-medium">Window Paid: </span>
                <span className="font-bold text-[#28634B]">
                  {formatNPR(activeFolioTotals.payments)}
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-[#F7F3EC] border border-[#D8CEC1]">
                <span className="text-[#6E6259] font-semibold">Window Balance Due: </span>
                <span className="font-black text-[#6B2837]">
                  {formatNPR(activeFolioTotals.balance)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openChargeRestaurantOrderModal}
                disabled={activeFolio.status !== "OPEN"}
                className="px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EFE8DC] disabled:opacity-50 text-[#1F1A17] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <UtensilsCrossed className="h-3.5 w-3.5 text-[#946000]" />
                <span>Charge Restaurant Order to Room</span>
              </button>

              <button
                type="button"
                onClick={() => openPostChargeModal("INCIDENTAL")}
                disabled={activeFolio.status !== "OPEN"}
                className="px-3 py-2 rounded-lg border border-[#6B2837] bg-[#F9EFF1] hover:bg-[#F1DDE1] disabled:opacity-50 text-[#6B2837] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Post Charge / Room Night</span>
              </button>

              <button
                type="button"
                onClick={openSettleModal}
                disabled={activeFolio.status === "CLOSED"}
                className="px-4 py-2 rounded-lg bg-[#28634B] hover:bg-[#1E4B38] disabled:opacity-50 text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Settle Folio (Multi-Tender)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#6E6259]">
            {selectedStayId
              ? "No folio window found for this stay yet. Click a window tab above (e.g., PRIMARY) to open one."
              : "Select an in-house stay from the top toolbar to manage guest folios."}
          </div>
        )}
      </div>

      {/* Chronological Itemized Folio Ledger Table */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#D8CEC1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1F1A17]">
              Chronological Itemized Folio Ledger ({activeFolio?.windowName || "No Window"})
            </h2>
            <p className="text-[11px] text-[#6E6259]">
              Immutable append-only postings. Use Credit Adjust to rebate or Move to Window for split-folio routing.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                    : "bg-[#F7F3EC] text-[#1F1A17] border-[#D8CEC1] hover:bg-[#EFE8DC]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[10px] font-bold uppercase tracking-wider text-[#6E6259]">
                <th className="py-3 px-4">Entry #</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Accounting Tag</th>
                <th className="py-3 px-4 text-right">Debit / Credit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CEC1]/60 text-xs">
              {loadingFolios ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6E6259]">
                    Loading chronological folio postings...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#6E6259]">
                    No folio ledger entries match the selected filter ({categoryFilter}).
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => {
                  const cat = getEntryCategory(entry);
                  const isCredit = isCreditEntry(entry);
                  const grossStr = fromCents(getEntryGrossCents(entry));
                  const taxCents = Math.abs(toCents(entry.taxAmount || 0));
                  const otherWindows = folios.filter((f) => f.id !== activeFolio?.id);

                  const accountingLabel =
                    cat === "DINING"
                      ? "Dining Receivable Transfer"
                      : isCredit
                      ? cat === "PAYMENT"
                        ? "Settlement Payment"
                        : "Credit / Reversal Adjustment"
                      : "Room / Service Revenue";

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-[#F7F3EC]/60 transition-colors ${
                        entry.isVoided ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-[#6E6259]">
                        {entry.entryNumber || `#${String(idx + 1).padStart(3, "0")}`}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[#6E6259] whitespace-nowrap">
                        {entry.createdAt || entry.postedAt
                          ? new Date(entry.createdAt || entry.postedAt || "").toLocaleString()
                          : "Just now"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            cat === "DINING"
                              ? "bg-[#FDF3E3] text-[#946000] border-[#EED2A3]"
                              : cat === "ROOM"
                              ? "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]"
                              : isCredit
                              ? "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                              : "bg-[#F7F3EC] text-[#1F1A17] border-[#D8CEC1]"
                          }`}
                        >
                          {cat}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1F1A17]">{entry.description}</div>
                        {taxCents > 0 && (
                          <div className="text-[10px] text-[#6E6259]">
                            Includes Tax: {formatNPR(fromCents(taxCents))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            cat === "DINING"
                              ? "bg-[#FDF3E3] text-[#946000] border-[#EED2A3]"
                              : isCredit
                              ? "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]"
                              : "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                          }`}
                        >
                          {accountingLabel}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black whitespace-nowrap ${
                          isCredit ? "text-[#28634B]" : "text-[#1F1A17]"
                        }`}
                      >
                        {isCredit ? `-${formatNPR(grossStr)}` : formatNPR(grossStr)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isCredit && !entry.isVoided && activeFolio?.status === "OPEN" ? (
                          <div className="inline-flex items-center gap-1.5">
                            {/* Move to Window Selector */}
                            {otherWindows.length > 0 && (
                              <div className="inline-flex items-center bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-2 py-1">
                                <ArrowRightLeft className="h-3 w-3 text-[#6B2837] mr-1" />
                                <select
                                  aria-label="Move entry to another folio window"
                                  value=""
                                  disabled={transferringEntryId === entry.id}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleTransferEntryWindow(entry.id, e.target.value);
                                    }
                                  }}
                                  className="text-[11px] font-bold text-[#1F1A17] bg-transparent focus:outline-none cursor-pointer"
                                >
                                  <option value="">Move to Window...</option>
                                  {otherWindows
                                    .filter((w) => w.status === "OPEN")
                                    .map((w) => (
                                      <option key={w.id} value={w.id}>
                                        → {w.windowName}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}

                            {/* Void / Credit Adjust Button */}
                            <button
                              type="button"
                              onClick={() => openReverseModal(entry)}
                              className="px-2.5 py-1 rounded-md border border-[#E9B6B7] bg-[#FCEEEE] hover:bg-[#F7DCDC] text-[#B33432] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Void / Adjust</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#6E6259]">
                            {isCredit ? "Immutable Credit" : "Locked"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: RUN DAILY NIGHT AUDIT                                     */}
      {/* ================================================================= */}
      {isNightAuditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-[#946000]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Run Daily Hotel Night Audit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNightAuditOpen(false)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRunNightAudit} className="space-y-4">
              <p className="text-xs text-[#6E6259]">
                Idempotently posts daily room-night accommodation charges and applicable VAT to all eligible in-house guest stays for the selected audit date.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Audit Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  required
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={taxRatePercent}
                  onChange={(e) => setTaxRatePercent(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNightAuditOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#946000] hover:bg-[#7A4F00] text-[#FFFCF7] text-xs font-bold cursor-pointer"
                >
                  {actionLoading ? "Running Night Audit..." : "Execute Night Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: + SPLIT FOLIO WINDOW                                      */}
      {/* ================================================================= */}
      {isNewWindowOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <Split className="h-5 w-5 text-[#6B2837]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Open Split-Folio Window
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewWindowOpen(false)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomWindow} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Window Classification
                </label>
                <select
                  value={newWindowName}
                  onChange={(e) => setNewWindowName(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                >
                  <option value="PRIMARY">PRIMARY (Main Guest Account)</option>
                  <option value="COMPANY">COMPANY (Corporate / Sponsor Account)</option>
                  <option value="PERSONAL">PERSONAL (Guest Personal Expenses)</option>
                  <option value="INCIDENTALS">INCIDENTALS (Minibar, Laundry, Spa)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Billing Instructions / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g., Route room nights to Company, dining & minibar to Personal"
                  value={newWindowNotes}
                  onChange={(e) => setNewWindowNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1A17]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewWindowOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold cursor-pointer"
                >
                  {actionLoading ? "Creating..." : "Create Folio Window"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: CHARGE RESTAURANT ORDER TO ROOM                           */}
      {/* ================================================================= */}
      {isChargeOrderOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-[#946000]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Charge Restaurant Order to Room ({activeFolio?.windowName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChargeOrderOpen(false)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-[#FDF3E3] border border-[#EED2A3] p-3 text-xs text-[#946000]">
              <strong>Accounting Invariant:</strong> F&B revenue remains recognized on the originating Restaurant Order. Posting to the guest folio transfers the receivable balance without duplicating revenue.
            </div>

            <form onSubmit={handleChargeOrderToRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Select Restaurant Order
                </label>
                {loadingOrders ? (
                  <div className="text-xs text-[#6E6259] py-4 text-center">
                    Loading recent restaurant orders...
                  </div>
                ) : restaurantOrders.length === 0 ? (
                  <div className="text-xs text-[#6E6259] py-4 text-center border border-dashed border-[#D8CEC1] rounded-lg">
                    No open restaurant orders found.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2.5 text-xs font-bold text-[#1F1A17]"
                  >
                    <option value="">-- Choose an order --</option>
                    {restaurantOrders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderNumber} — Table {ord.table?.tableNumber || "Walk-In"} —{" "}
                        {formatNPR(ord.totalAmount)} [{ord.settlementStatus || ord.status}]
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChargeOrderOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedOrderId}
                  className="px-4 py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-[#FFFCF7] text-xs font-bold cursor-pointer"
                >
                  {actionLoading ? "Posting to Room..." : "Post Order to Room Folio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: POST CHARGE (ROOM NIGHT OR INCIDENTAL)                    */}
      {/* ================================================================= */}
      {isPostChargeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#6B2837]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Post Charge to {activeFolio?.windowName} Folio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPostChargeOpen(false)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setChargeMode("INCIDENTAL")}
                className={`py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                  chargeMode === "INCIDENTAL"
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "text-[#1F1A17]"
                }`}
              >
                Incidental / Service
              </button>
              <button
                type="button"
                onClick={() => setChargeMode("ROOM_NIGHT")}
                className={`py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                  chargeMode === "ROOM_NIGHT"
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "text-[#1F1A17]"
                }`}
              >
                Room Night Charge
              </button>
            </div>

            <form onSubmit={handlePostChargeSubmit} className="space-y-3.5">
              {chargeMode === "ROOM_NIGHT" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                      Charge Date
                    </label>
                    <input
                      type="date"
                      required
                      value={roomChargeDate}
                      onChange={(e) => setRoomChargeDate(e.target.value)}
                      className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                      Base Room Rate (NPR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={roomBaseRate}
                      onChange={(e) => setRoomBaseRate(e.target.value)}
                      className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                      Category
                    </label>
                    <select
                      value={incidentalCategory}
                      onChange={(e) => setIncidentalCategory(e.target.value)}
                      className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                    >
                      <option value="MINIBAR">MINIBAR</option>
                      <option value="LAUNDRY">LAUNDRY</option>
                      <option value="SPA">SPA</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Express Laundry Service (3 garments)"
                      value={incidentalDescription}
                      onChange={(e) => setIncidentalDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1A17]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                        Base Amount (NPR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={incidentalAmount}
                        onChange={(e) => setIncidentalAmount(e.target.value)}
                        className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                        Tax Amount (NPR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={incidentalTaxAmount}
                        onChange={(e) => setIncidentalTaxAmount(e.target.value)}
                        className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPostChargeOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold cursor-pointer"
                >
                  {actionLoading ? "Posting..." : "Post Charge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: VOID / CREDIT ADJUSTMENT MODAL                            */}
      {/* ================================================================= */}
      {reverseTargetEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-[#B33432]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Append-Only Void / Credit Adjustment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReverseTargetEntry(null)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-[#FCEEEE] border border-[#E9B6B7] p-3 text-xs text-[#B33432]">
              Original Entry: <strong>{reverseTargetEntry.description}</strong> (
              {formatNPR(fromCents(getEntryGrossCents(reverseTargetEntry)))})
            </div>

            <form onSubmit={handleReverseEntrySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Credit Adjustment Amount (NPR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseMoney(fromCents(getEntryGrossCents(reverseTargetEntry)))}
                  required
                  value={reverseAmount}
                  onChange={(e) => setReverseAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-bold text-[#1F1A17]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Audit Reason
                </label>
                <input
                  type="text"
                  required
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1A17]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReverseTargetEntry(null)}
                  className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#B33432] hover:bg-[#8E2725] text-[#FFFCF7] text-xs font-bold cursor-pointer"
                >
                  {actionLoading ? "Posting Credit..." : "Post Credit Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 6: MULTI-TENDER SPLIT SETTLEMENT MODAL                       */}
      {/* ================================================================= */}
      {isSettleOpen && activeFolio && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-xl w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#28634B]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Multi-Tender Folio Settlement ({activeFolio.windowName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleOpen(false)}
                className="text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Real-time Balance Summary */}
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#F7F3EC] border border-[#D8CEC1] p-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#6E6259] block">
                  Folio Balance Due
                </span>
                <span className="text-sm font-black text-[#1F1A17]">
                  {formatNPR(activeFolioTotals.balance)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#28634B] block">
                  Tenders Allocated
                </span>
                <span className="text-sm font-black text-[#28634B]">
                  {formatNPR(fromCents(totalTenderAllocatedCents))}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#6B2837] block">
                  Remaining Balance
                </span>
                <span
                  className={`text-sm font-black ${
                    settleRemainingCents === 0 ? "text-[#28634B]" : "text-[#B33432]"
                  }`}
                >
                  {formatNPR(fromCents(settleRemainingCents))}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettleFolioSubmit} className="space-y-3">
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {tenders.map((line, index) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-12 gap-2 items-center bg-[#F7F3EC] border border-[#D8CEC1] rounded-lg p-2.5"
                  >
                    <div className="col-span-4">
                      <label className="text-[10px] font-bold text-[#6E6259] block">
                        Method #{index + 1}
                      </label>
                      <select
                        value={line.paymentMethod}
                        onChange={(e) =>
                          updateTenderLine(
                            line.id,
                            "paymentMethod",
                            e.target.value as PaymentMethodType
                          )
                        }
                        className="w-full text-xs font-bold text-[#1F1A17] bg-[#FFFCF7] border border-[#D8CEC1] rounded px-2 py-1.5"
                      >
                        <option value="CASH">CASH</option>
                        <option value="CARD">CARD</option>
                        <option value="QR">QR (Fonepay / eSewa)</option>
                        <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                        <option value="DEPOSIT">DEPOSIT</option>
                      </select>
                    </div>

                    <div className="col-span-4">
                      <label className="text-[10px] font-bold text-[#6E6259] block">
                        Amount (NPR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={line.amount}
                        onChange={(e) => updateTenderLine(line.id, "amount", e.target.value)}
                        className="w-full text-xs font-bold text-[#1F1A17] bg-[#FFFCF7] border border-[#D8CEC1] rounded px-2 py-1.5"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] font-bold text-[#6E6259] block">
                        Ref / Auth #
                      </label>
                      <input
                        type="text"
                        placeholder="Slip / RRN"
                        value={line.reference}
                        onChange={(e) => updateTenderLine(line.id, "reference", e.target.value)}
                        className="w-full text-xs text-[#1F1A17] bg-[#FFFCF7] border border-[#D8CEC1] rounded px-2 py-1.5"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end pt-4">
                      {tenders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTenderLine(line.id)}
                          className="text-[#B33432] hover:opacity-75 cursor-pointer"
                          title="Remove tender line"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={addTenderLine}
                  className="px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EFE8DC] text-xs font-bold text-[#6B2837] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Split Tender Line</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    className="px-4 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-bold text-[#1F1A17] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || totalTenderAllocatedCents <= 0}
                    className="px-4 py-2 rounded-lg bg-[#28634B] hover:bg-[#1E4B38] disabled:opacity-50 text-[#FFFCF7] text-xs font-bold cursor-pointer"
                  >
                    {actionLoading ? "Settling..." : "Complete Settlement"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 7: 80MM ESC/POS & A4 HOTEL FOLIO TAX INVOICE PREVIEW/PRINT   */}
      {/* ================================================================= */}
      {isInvoiceOpen && activeFolio && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            {/* Controls Header (Hidden during print) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CEC1] pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#6B2837]" />
                <h3 className="text-base font-bold text-[#1F1A17]">
                  Hotel Folio Tax Invoice & Receipt Preview
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-[#F7F3EC] p-1 border border-[#D8CEC1]">
                  <button
                    type="button"
                    onClick={() => setInvoiceFormat("A4")}
                    className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                      invoiceFormat === "A4"
                        ? "bg-[#6B2837] text-[#FFFCF7]"
                        : "text-[#1F1A17]"
                    }`}
                  >
                    A4 Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceFormat("THERMAL_80MM")}
                    className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                      invoiceFormat === "THERMAL_80MM"
                        ? "bg-[#6B2837] text-[#FFFCF7]"
                        : "text-[#1F1A17]"
                    }`}
                  >
                    80mm ESC/POS Thermal
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-[#28634B] hover:bg-[#1E4B38] text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInvoiceOpen(false)}
                  className="p-2 rounded-lg border border-[#D8CEC1] text-[#6E6259] hover:text-[#1F1A17] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div
              className={`mx-auto bg-white text-black border border-[#D8CEC1] rounded-xl p-6 shadow-xs ${
                invoiceFormat === "THERMAL_80MM" ? "max-w-[320px] font-mono text-[11px]" : "w-full text-xs"
              }`}
            >
              {/* Hotel Brand Header */}
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                <h2 className="text-base font-black tracking-tight uppercase">
                  RestroInn Hospitality & Suites
                </h2>
                <p className="text-[11px] text-gray-600">
                  Lakeside / Durbar Marg • PAN/VAT: 609841235
                </p>
                <p className="text-[11px] font-bold uppercase mt-1">
                  TAX INVOICE — {activeFolio.windowName} FOLIO
                </p>
              </div>

              {/* Guest & Stay Metadata */}
              <div className="grid grid-cols-2 gap-2 border-b border-dashed border-gray-400 pb-3 mb-3 text-[11px]">
                <div>
                  <div>
                    <span className="font-bold">Guest:</span> {selectedStay?.guestName || "Guest"}
                  </div>
                  <div>
                    <span className="font-bold">Room:</span>{" "}
                    {selectedStay?.room?.roomNumber || "N/A"} (
                    {selectedStay?.room?.roomType?.name || "Standard"})
                  </div>
                  <div>
                    <span className="font-bold">Stay #:</span> {selectedStay?.stayNumber || "N/A"}
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    <span className="font-bold">Folio #:</span>{" "}
                    {activeFolio.folioNumber || activeFolio.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold">Check-In:</span>{" "}
                    {selectedStay?.checkInTime
                      ? new Date(selectedStay.checkInTime).toLocaleDateString()
                      : "-"}
                  </div>
                  <div>
                    <span className="font-bold">Check-Out:</span>{" "}
                    {selectedStay?.expectedCheckOut
                      ? new Date(selectedStay.expectedCheckOut).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
              </div>

              {/* Itemized Charges Table */}
              <table className="w-full text-left border-collapse mb-3">
                <thead>
                  <tr className="border-b border-gray-400 text-[10px] uppercase font-bold">
                    <th className="py-1">Item / Description</th>
                    <th className="py-1">Cat</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(activeFolio.entries || []).map((entry) => {
                    const isCred = isCreditEntry(entry);
                    const amt = fromCents(getEntryGrossCents(entry));
                    return (
                      <tr key={entry.id}>
                        <td className="py-1.5 pr-2">
                          <div className="font-semibold">{entry.description}</div>
                        </td>
                        <td className="py-1.5 pr-2 text-[10px]">{getEntryCategory(entry)}</td>
                        <td className="py-1.5 text-right font-bold">
                          {isCred ? `-${formatNPR(amt)}` : formatNPR(amt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals & Tax Summary */}
              <div className="border-t border-dashed border-gray-400 pt-3 space-y-1 text-right">
                <div className="flex justify-between">
                  <span className="font-semibold">Total Window Charges (Incl. VAT):</span>
                  <span className="font-bold">{formatNPR(activeFolioTotals.charges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Credits & Adjustments:</span>
                  <span className="font-bold">-{formatNPR(activeFolioTotals.credits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Settlements / Payments Applied:</span>
                  <span className="font-bold">{formatNPR(activeFolioTotals.payments)}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-gray-400 pt-1.5 mt-1.5">
                  <span>Net Balance Due:</span>
                  <span>{formatNPR(activeFolioTotals.balance)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-500 mt-5 pt-3 border-t border-dashed border-gray-300">
                Thank you for staying with RestroInn Hospitality • Computer Generated Tax Invoice
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
