"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatNPR, formatShiftDateTime, formatShiftDuration } from "@/lib/denomination";
import { OpenShiftModal } from "@/components/shifts/open-shift-modal";
import { CloseShiftModal } from "@/components/shifts/close-shift-modal";
import { CashMovementModal } from "@/components/shifts/cash-movement-modal";
import { ShiftSummaryPrint } from "@/components/shifts/shift-summary-print";
import { ShiftDetailModal } from "@/components/shifts/shift-detail-modal";
import {
  Clock,
  Play,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  RotateCcw,
  Store,
  Search,
  Eye,
  Layers,
  TrendingUp,
  Power,
  Trash2,
  Coins,
  Banknote,
  Wallet,
} from "lucide-react";
import { toast } from "@/components/toast";

const CARD = "bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-none";

export default function ShiftsPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Cashier";
  const userRole = (session?.user as any)?.role || "CASHIER";
  const isManagerOrOwner = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"].includes(
    String(userRole).toUpperCase()
  );

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY" | "REGISTERS" | "OVERVIEW">("ACTIVE");

  // Current active shift state
  const [currentShiftData, setCurrentShiftData] = useState<any>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);

  // Shift History & Filter state (Spec §5.5)
  const [shifts, setShifts] = useState<any[]>([]);
  const [historySummary, setHistorySummary] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<string>("");
  const [historyVarianceStatus, setHistoryVarianceStatus] = useState<string>("");
  const [historyRegisterId, setHistoryRegisterId] = useState<string>("");
  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");
  const [historySearch, setHistorySearch] = useState<string>("");

  // Registers state (Spec §5.7)
  const [registers, setRegisters] = useState<any[]>([]);
  const [isLoadingRegisters, setIsLoadingRegisters] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [newRegisterCode, setNewRegisterCode] = useState("");
  const [newRegisterDescription, setNewRegisterDescription] = useState("");
  const [isCreatingRegister, setIsCreatingRegister] = useState(false);

  // Modals state
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [selectedShiftForPrint, setSelectedShiftForPrint] = useState<any>(null);
  const [selectedShiftIdForDetail, setSelectedShiftIdForDetail] = useState<string | null>(null);

  const loadCurrentShift = async () => {
    setIsLoadingCurrent(true);
    try {
      const res = await fetch("/api/v1/shifts/current");
      const data = await res.json();
      if (res.ok) {
        setCurrentShiftData(data.hasActiveShift ? data.shift : null);
      }
    } catch (err) {
      console.error("Failed to load active shift:", err);
    } finally {
      setIsLoadingCurrent(false);
    }
  };

  const loadRegisters = async () => {
    setIsLoadingRegisters(true);
    try {
      const res = await fetch("/api/v1/registers");
      const data = await res.json();
      if (res.ok && data.registers) {
        setRegisters(data.registers);
      }
    } catch (err) {
      console.error("Failed to load registers:", err);
    } finally {
      setIsLoadingRegisters(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyStatus) params.set("status", historyStatus);
      if (historyVarianceStatus) params.set("varianceStatus", historyVarianceStatus);
      if (historyRegisterId) params.set("registerId", historyRegisterId);
      if (historyStartDate) params.set("startDate", historyStartDate);
      if (historyEndDate) params.set("endDate", historyEndDate);
      if (historySearch) params.set("search", historySearch);

      const res = await fetch(`/api/v1/shifts?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setShifts(data.shifts || []);
        setHistorySummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to load shift history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadCurrentShift();
    loadRegisters();
  }, []);

  useEffect(() => {
    if (activeTab === "HISTORY" || activeTab === "OVERVIEW") {
      loadHistory();
    }
    if (activeTab === "REGISTERS" || activeTab === "OVERVIEW") {
      loadRegisters();
    }
  }, [
    activeTab,
    historyStatus,
    historyVarianceStatus,
    historyRegisterId,
    historyStartDate,
    historyEndDate,
    historySearch,
  ]);

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegisterName.trim()) return;

    setIsCreatingRegister(true);
    try {
      const res = await fetch("/api/v1/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRegisterName.trim(),
          code: newRegisterCode.trim() || undefined,
          description: newRegisterDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create register");

      toast.success(data.message || "Register created");
      setNewRegisterName("");
      setNewRegisterCode("");
      setNewRegisterDescription("");
      loadRegisters();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingRegister(false);
    }
  };

  const handleToggleRegisterStatus = async (register: any) => {
    try {
      const res = await fetch(`/api/v1/registers/${register.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !register.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update register status");
      toast.success(data.message || "Register status updated");
      loadRegisters();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteRegister = async (register: any) => {
    try {
      const res = await fetch(`/api/v1/registers/${register.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete register");
      toast.success(data.message || "Register deleted");
      loadRegisters();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleVoidMovement = async (movementId: string) => {
    try {
      const res = await fetch(`/api/v1/cash-movements/${movementId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided by manager from shift dashboard" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to void movement");
      toast.success("Cash movement voided");
      loadCurrentShift();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const metrics = currentShiftData?.liveMetrics || {
    openingBalance: Number(currentShiftData?.openingBalance || 0),
    cashSales: Number(currentShiftData?.cashSales || 0),
    qrSales: Number(currentShiftData?.qrSales || 0),
    cardSales: Number(currentShiftData?.cardSales || 0),
    bankSales: Number(currentShiftData?.bankSales || 0),
    creditSales: Number(currentShiftData?.creditSales || 0),
    nonCashSales: Number(currentShiftData?.nonCashSales || 0),
    totalSales: Number(currentShiftData?.totalSales || 0),
    cashRefunds: Number(currentShiftData?.cashRefunds || 0),
    cashIn: Number(currentShiftData?.cashIn || 0),
    cashOut: Number(currentShiftData?.cashOut || 0),
    expectedCash: Number(currentShiftData?.expectedCash || currentShiftData?.openingBalance || 0),
    totalTransactions: 0,
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 pb-8 text-[#292320]">
      {/* Header Bar (Matches Dashboard Pattern) */}
      <header className="flex flex-col gap-3 border-b border-[#D8CEC1] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292320]">
            Cash Registers & Shifts
          </h1>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {/* Apple Segmented Tab Control */}
          <div
            className="inline-flex p-1 bg-[#EEE7DD] rounded-lg border border-[#D8CEC1] text-xs font-semibold"
            role="tablist"
            aria-label="Shift Sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ACTIVE"}
              onClick={() => setActiveTab("ACTIVE")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "ACTIVE"
                  ? "bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Active Shift
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "HISTORY"}
              onClick={() => setActiveTab("HISTORY")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "HISTORY"
                  ? "bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              History
            </button>

            {isManagerOrOwner && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "OVERVIEW"}
                onClick={() => setActiveTab("OVERVIEW")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "OVERVIEW"
                    ? "bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Monitor
              </button>
            )}

            {isManagerOrOwner && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "REGISTERS"}
                onClick={() => setActiveTab("REGISTERS")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "REGISTERS"
                    ? "bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                Registers
              </button>
            )}
          </div>

          {!isLoadingCurrent &&
            (currentShiftData ? (
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(true)}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#6B2837] px-3.5 text-xs font-semibold text-[#FFFCF7] hover:bg-[#541E2A] cursor-pointer"
              >
                Close Shift
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(true)}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#6B2837] px-3.5 text-xs font-semibold text-[#FFFCF7] hover:bg-[#541E2A] cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                Open Shift
              </button>
            ))}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE SHIFT DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === "ACTIVE" && (
        <div className="space-y-4">
          {isLoadingCurrent ? (
            <div className="space-y-3">
              <div className="h-16 w-full rounded-lg animate-pulse bg-[#EEE7DD]" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="h-[118px] rounded-lg animate-pulse bg-[#EEE7DD]" />
                <div className="h-[118px] rounded-lg animate-pulse bg-[#EEE7DD]" />
                <div className="h-[118px] rounded-lg animate-pulse bg-[#EEE7DD]" />
                <div className="h-[118px] rounded-lg animate-pulse bg-[#EEE7DD]" />
              </div>
            </div>
          ) : !currentShiftData ? (
            <div className={`${CARD} p-10 text-center space-y-3`}>
              <div className="h-10 w-10 mx-auto rounded-md bg-[#FDF2F4] border border-[#F8D2D9] text-[#6B2837] flex items-center justify-center">
                <Store className="h-5 w-5" />
              </div>
              <div className="max-w-sm mx-auto space-y-1">
                <h3 className="text-sm font-bold text-[#292320]">No Active Shift</h3>
                <p className="text-xs text-[#71675E]">
                  Open a register shift with your starting cash count to begin billing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#6B2837] px-4 text-xs font-semibold text-[#FFFCF7] hover:bg-[#541E2A] cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                Open Shift
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Shift Info & Actions Bar */}
              <div className={`${CARD} p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#292320] tabular-nums">
                      {currentShiftData.shiftNumber}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8] uppercase">
                      OPEN
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F4] text-[#6B2837] border border-[#F8D2D9] tabular-nums">
                      {formatShiftDuration(currentShiftData.startTime)}
                    </span>
                  </div>
                  <p className="text-xs text-[#71675E] tabular-nums truncate">
                    <span className="font-semibold text-[#292320]">
                      {currentShiftData.register?.name}
                    </span>{" "}
                    ({currentShiftData.register?.code || "REG-01"}) · {currentShiftData.cashier?.name} · Opened{" "}
                    <span className="font-medium text-[#292320]">
                      {formatShiftDateTime(currentShiftData.startTime).full}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCashMovementType("CASH_IN");
                      setIsCashMovementModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EAF5EE] hover:border-[#16A34A] text-xs font-semibold text-[#16A34A] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    Cash In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCashMovementType("CASH_OUT");
                      setIsCashMovementModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#FDF2F2] hover:border-[#DC2626] text-xs font-semibold text-[#DC2626] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Cash Out
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedShiftIdForDetail(currentShiftData.id)}
                    className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#71675E]" />
                    Details
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedShiftForPrint(currentShiftData)}
                    className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-[#71675E]" />
                    Print
                  </button>
                </div>
              </div>

              {/* 4 Key Metric Cards (Matches Dashboard KPI Pattern) */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Shift metrics">
                <div className={`${CARD} p-4 flex flex-col justify-between min-h-[118px]`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-9 w-9 rounded-md bg-[#FDF2F4] border border-[#F8D2D9] text-[#6B2837] flex items-center justify-center shrink-0">
                      <Coins className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F4] text-[#6B2837] border border-[#F8D2D9] tabular-nums">
                      Drawer
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                      Expected Cash
                    </div>
                    <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#6B2837] truncate">
                      {formatNPR(metrics.expectedCash)}
                    </div>
                  </div>
                </div>

                <div className={`${CARD} p-4 flex flex-col justify-between min-h-[118px]`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-9 w-9 rounded-md bg-[#EAF5EE] border border-[#D1EAD8] text-[#16A34A] flex items-center justify-center shrink-0">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8] tabular-nums">
                      Retained
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                      Cash Sales
                    </div>
                    <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
                      {formatNPR(metrics.cashSales)}
                    </div>
                  </div>
                </div>

                <div className={`${CARD} p-4 flex flex-col justify-between min-h-[118px]`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-9 w-9 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE] tabular-nums">
                      QR / Card
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                      Non-Cash Sales
                    </div>
                    <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
                      {formatNPR(metrics.nonCashSales)}
                    </div>
                  </div>
                </div>

                <div className={`${CARD} p-4 flex flex-col justify-between min-h-[118px]`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-9 w-9 rounded-md bg-[#FEF8EE] border border-[#FDE8CC] text-[#D97706] flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF8EE] text-[#D97706] border border-[#FDE8CC] tabular-nums">
                      {currentShiftData.recentSales?.length || 0} bills
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                      Total Sales
                    </div>
                    <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
                      {formatNPR(metrics.totalSales)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Drawer Reconciliation Breakdown Strip */}
              <div className={`${CARD} grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8CEC1]`}>
                <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#71675E] font-medium">Opening Float</span>
                  <span className="font-bold text-[#292320] tabular-nums">{formatNPR(metrics.openingBalance)}</span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#71675E] font-medium">Cash In</span>
                  <span className={`font-bold tabular-nums ${metrics.cashIn > 0 ? "text-[#16A34A]" : "text-[#71675E]"}`}>
                    {metrics.cashIn > 0 ? "+" : ""}{formatNPR(metrics.cashIn)}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#71675E] font-medium">Cash Out</span>
                  <span className={`font-bold tabular-nums ${metrics.cashOut > 0 ? "text-[#DC2626]" : "text-[#71675E]"}`}>
                    {metrics.cashOut > 0 ? "-" : ""}{formatNPR(metrics.cashOut)}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#71675E] font-medium">Cash Refunds</span>
                  <span className={`font-bold tabular-nums ${metrics.cashRefunds > 0 ? "text-[#DC2626]" : "text-[#71675E]"}`}>
                    {metrics.cashRefunds > 0 ? "-" : ""}{formatNPR(metrics.cashRefunds)}
                  </span>
                </div>
              </div>

              {/* Movements & Sales Split View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* Cash Movements */}
                <div className={`${CARD} overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-[#D8CEC1] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#292320]">
                      Cash Movements ({currentShiftData.cashMovements?.length || 0})
                    </h3>
                  </div>

                  {!currentShiftData.cashMovements || currentShiftData.cashMovements.length === 0 ? (
                    <p className="text-xs text-[#71675E] text-center py-6">
                      No cash in or out movements recorded.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D8CEC1]/60">
                      {currentShiftData.cashMovements.map((m: any) => {
                        const isVoided = m.status === "VOIDED";
                        return (
                          <div
                            key={m.id}
                            className={`px-4 py-2.5 flex items-center justify-between text-xs ${
                              isVoided ? "opacity-50 line-through" : "hover:bg-[#F7F3EC]/60"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`p-1.5 rounded-md border shrink-0 ${
                                  m.type === "CASH_IN"
                                    ? "bg-[#EAF5EE] text-[#16A34A] border-[#D1EAD8]"
                                    : "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]"
                                }`}
                              >
                                {m.type === "CASH_IN" ? (
                                  <ArrowDownRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-[#292320] truncate">
                                  {m.reason}
                                  {m.referenceId && (
                                    <span className="font-mono text-[10px] text-[#71675E] ml-1.5">
                                      [{m.referenceId}]
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#71675E] tabular-nums">
                                  {m.user?.name} · {formatShiftDateTime(m.createdAt).time}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-bold tabular-nums ${
                                  m.type === "CASH_IN" ? "text-[#16A34A]" : "text-[#DC2626]"
                                }`}
                              >
                                {m.type === "CASH_IN" ? "+" : "-"}
                                {formatNPR(m.amount)}
                              </span>
                              {isManagerOrOwner && !isVoided && (
                                <button
                                  type="button"
                                  onClick={() => handleVoidMovement(m.id)}
                                  className="text-[10px] font-semibold text-[#DC2626] hover:underline px-1.5 py-0.5 rounded border border-[#FBD5D5] bg-[#FDF2F2]"
                                >
                                  Void
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Shift Sales */}
                <div className={`${CARD} overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-[#D8CEC1] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#292320]">
                      Shift Sales ({currentShiftData.recentSales?.length || 0})
                    </h3>
                  </div>

                  {!currentShiftData.recentSales || currentShiftData.recentSales.length === 0 ? (
                    <p className="text-xs text-[#71675E] text-center py-6">
                      No sales recorded in this shift.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D8CEC1]/60">
                      {currentShiftData.recentSales.map((s: any) => {
                        const payStatus = String(s.paymentStatus || "PAID").toUpperCase();
                        const orderStatus = String(s.status || "COMPLETED").toUpperCase();
                        const payBadgeClass =
                          payStatus === "PAID"
                            ? "bg-[#EAF5EE] text-[#16A34A] border-[#D1EAD8]"
                            : payStatus === "PARTIAL" || payStatus === "PENDING"
                              ? "bg-[#FEF8EE] text-[#D97706] border-[#FDE8CC]"
                              : "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]";
                        const isVoidOrCancelled =
                          orderStatus === "VOIDED" || orderStatus === "CANCELLED" || orderStatus === "REFUNDED";
                        return (
                          <div
                            key={s.id}
                            className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-[#F7F3EC]/60"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-[#292320] tabular-nums">
                                  {s.invoiceNumber}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                                    isVoidOrCancelled
                                      ? "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]"
                                      : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1]"
                                  }`}
                                >
                                  {orderStatus}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#71675E] mt-0.5 tabular-nums truncate">
                                {s.customer?.name || "Walk-in"} · {formatShiftDateTime(s.createdAt).time}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${payBadgeClass}`}
                              >
                                {payStatus}
                              </span>
                              <span className="font-bold text-[#292320] tabular-nums">
                                {formatNPR(s.total)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* ========================================================================= */}
        {/* TAB 2: SHIFT HISTORY & RECONCILIATION AUDIT (Specification §5.5) */}
        {/* ========================================================================= */}
        {activeTab === "HISTORY" && (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="p-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
              <div className="lg:col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#71675E]">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#71675E]" />
                  <input
                    type="text"
                    placeholder="Shift #, register, cashier..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#71675E]">Register</label>
                <select
                  value={historyRegisterId}
                  onChange={(e) => setHistoryRegisterId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium text-[#292320]"
                >
                  <option value="">All Registers</option>
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#71675E]">Shift Status</label>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium text-[#292320]"
                >
                  <option value="">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#71675E]">Variance Filter</label>
                <select
                  value={historyVarianceStatus}
                  onChange={(e) => setHistoryVarianceStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium text-[#292320]"
                >
                  <option value="">All Variances</option>
                  <option value="BALANCED">Balanced (0)</option>
                  <option value="SHORTAGE">Shortage (&lt; 0)</option>
                  <option value="EXCESS">Excess (&gt; 0)</option>
                  <option value="NON_ZERO">Any Variance (!= 0)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-mono text-[#292320]"
                  title="Start Date"
                />
                <button
                  onClick={() => {
                    setHistoryStatus("");
                    setHistoryVarianceStatus("");
                    setHistoryRegisterId("");
                    setHistoryStartDate("");
                    setHistoryEndDate("");
                    setHistorySearch("");
                  }}
                  className="p-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#71675E]"
                  title="Reset filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* History Table */}
            <div className="rounded-md border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F3EC] text-[10px] font-semibold uppercase tracking-wider text-[#71675E] border-b border-[#D8CEC1]">
                    <tr>
                      <th className="py-2 px-3">Shift ID</th>
                      <th className="py-2 px-3">Register</th>
                      <th className="py-2 px-3">Cashier</th>
                      <th className="py-2 px-3">Opened</th>
                      <th className="py-2 px-3">Closed</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3 text-right">Opening</th>
                      <th className="py-2 px-3 text-right">Expected</th>
                      <th className="py-2 px-3 text-right">Actual</th>
                      <th className="py-2 px-3 text-center">Variance</th>
                      <th className="py-2 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/60 font-medium">
                    {isLoadingHistory ? (
                      <tr>
                        <td colSpan={11} className="p-4">
                          <div className="space-y-2">
                            <div className="h-8 w-full rounded animate-pulse bg-[#EEE7DD]" />
                            <div className="h-8 w-full rounded animate-pulse bg-[#EEE7DD]" />
                            <div className="h-8 w-full rounded animate-pulse bg-[#EEE7DD]" />
                          </div>
                        </td>
                      </tr>
                    ) : shifts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-[#71675E]">
                          No shift records found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((s) => {
                        const diff = Number(s.cashDifference || 0);
                        const isClosed = s.status !== "OPEN";
                        const openedDT = formatShiftDateTime(s.startTime);
                        const closedDT = s.endTime ? formatShiftDateTime(s.endTime) : null;
                        const durationStr = formatShiftDuration(s.startTime, s.endTime);

                        return (
                          <tr key={s.id} className="hover:bg-[#F7F3EC] transition-colors">
                            <td className="py-3 px-3.5 font-mono font-bold text-[#292320] tabular-nums">
                              {s.shiftNumber}
                            </td>
                            <td className="py-3 px-3.5 text-[#292320]">
                              <div className="font-semibold">{s.register?.name}</div>
                              <div className="text-[10px] text-[#71675E] font-mono">
                                {s.branch?.name || "Main"} • {s.register?.code}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-[#292320]">
                              {s.cashier?.name}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-[11px] text-[#292320] tabular-nums">
                              <div>{openedDT.date}</div>
                              <div className="text-[10px] text-[#71675E]">{openedDT.time}</div>
                            </td>
                            <td className="py-3 px-3.5 font-mono text-[11px] text-[#292320] tabular-nums">
                              {closedDT ? (
                                <>
                                  <div>{closedDT.date}</div>
                                  <div className="text-[10px] text-[#71675E]">{closedDT.time}</div>
                                </>
                              ) : (
                                <span className="text-emerald-800 font-bold uppercase text-[10px]">
                                  OPEN
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-[11px] tabular-nums">
                              {isClosed ? (
                                <span className="font-semibold text-[#292320]">{durationStr}</span>
                              ) : (
                                <span className="text-emerald-800 font-semibold">{durationStr} (Active)</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right tabular-nums">
                              {formatNPR(s.openingBalance)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-bold text-[#292320] tabular-nums">
                              {formatNPR(s.expectedCash)}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-right font-bold text-[#292320] tabular-nums">
                              {s.actualCash !== null && s.actualCash !== undefined
                                ? formatNPR(s.actualCash)
                                : "-"}
                            </td>
                            <td className="py-3 px-3.5 text-center font-mono tabular-nums">
                              {!isClosed ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EEE7DD] text-[#71675E]">
                                  OPEN
                                </span>
                              ) : Math.abs(diff) < 0.01 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  Balanced
                                </span>
                              ) : diff < 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                                  {formatNPR(diff)} (Shortage)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  +{formatNPR(diff)} (Excess)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedShiftIdForDetail(s.id)}
                                  className="p-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320]"
                                  title="Inspect Shift Audit Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedShiftForPrint(s)}
                                  className="p-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320]"
                                  title="Print Reconciliation Receipt"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: BRANCH REGISTER MONITOR (Manager Overview) */}
        {/* ========================================================================= */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#71675E] tracking-wider block">
                  Total Gross Sales Handled
                </span>
                <div className="font-mono text-2xl font-bold text-[#292320] tabular-nums">
                  {formatNPR(historySummary?.totalSales || 0)}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                  Total Physical Cash Sales
                </span>
                <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                  {formatNPR(historySummary?.totalCashSales || 0)}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#71675E] tracking-wider block">
                  Total Non-Cash Sales
                </span>
                <div className="font-mono text-2xl font-bold text-[#292320] tabular-nums">
                  {formatNPR(historySummary?.totalNonCashSales || 0)}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#71675E] tracking-wider block">
                  Net Cash Variance Across Shifts
                </span>
                <div
                  className={`font-mono text-2xl font-bold tabular-nums ${
                    (historySummary?.netDifference || 0) < 0
                      ? "text-rose-700"
                      : (historySummary?.netDifference || 0) > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  {(historySummary?.netDifference || 0) > 0 ? "+" : ""}
                  {formatNPR(historySummary?.netDifference || 0)}
                </div>
              </div>
            </div>

            {/* Live Register Counter Status */}
            <div className="p-5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-4">
              <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider">
                Live Branch Cash Registers ({registers.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registers.map((r) => {
                  const activeShift = r.shifts?.[0];
                  const isOpen = r.status === "OPEN" && activeShift;

                  return (
                    <div
                      key={r.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        isOpen
                          ? "bg-[#F7F3EC] border-[#6B2837]"
                          : "bg-[#FFFCF7] border-[#D8CEC1]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-[#292320]">{r.name}</div>
                          <div className="text-[11px] text-[#71675E] font-mono">
                            {r.code} • {r.branch?.name || "Main Branch"}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            !r.isActive
                              ? "bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]"
                              : isOpen
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1]"
                          }`}
                        >
                          {!r.isActive ? "INACTIVE" : isOpen ? "SHIFT OPEN" : "CLOSED"}
                        </span>
                      </div>

                      {isOpen ? (
                        <div className="mt-3 pt-3 border-t border-[#D8CEC1] text-xs space-y-1 tabular-nums">
                          <div className="flex justify-between">
                            <span className="text-[#71675E]">Cashier:</span>
                            <span className="font-bold text-[#292320]">{activeShift.cashier?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71675E]">Shift No:</span>
                            <span className="font-mono text-[#292320] font-medium">
                              {activeShift.shiftNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71675E]">Opened:</span>
                            <span className="font-mono text-[#292320]">
                              {formatShiftDateTime(activeShift.startTime).full} ({formatShiftDuration(activeShift.startTime)})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71675E]">Opening Balance:</span>
                            <span className="font-mono font-bold text-[#292320]">
                              {formatNPR(activeShift.openingBalance)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71675E]">Expected Cash:</span>
                            <span className="font-mono font-bold text-[#6B2837]">
                              {formatNPR(activeShift.expectedCash)}
                            </span>
                          </div>
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setSelectedShiftIdForDetail(activeShift.id)}
                              className="w-full py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320]"
                            >
                              Inspect Active Shift
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 pt-3 border-t border-[#D8CEC1] text-[11px] text-[#71675E]">
                          {r.isActive
                            ? "No active shift open. Ready for cashier check-in."
                            : "Register is deactivated and cannot open new shifts."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REGISTER MANAGEMENT (Specification §2.1 & §5.7) */}
        {/* ========================================================================= */}
        {activeTab === "REGISTERS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Register Form */}
            <div className="p-5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-4">
              <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider">
                Create Cash Register
              </h3>
              <form onSubmit={handleCreateRegister} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#292320]">
                    Register Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pharmacy Counter"
                    value={newRegisterName}
                    onChange={(e) => setNewRegisterName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#292320]">
                    Register Code (Unique per Branch)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REG-02"
                    value={newRegisterCode}
                    onChange={(e) => setNewRegisterCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-mono text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#292320]">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ground floor billing counter"
                    value={newRegisterDescription}
                    onChange={(e) => setNewRegisterDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingRegister || !newRegisterName.trim()}
                  className="w-full py-2.5 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:opacity-95 disabled:opacity-40"
                >
                  {isCreatingRegister ? "Creating Register..." : "Create Register"}
                </button>
              </form>
            </div>

            {/* Existing Registers Table (Spec §5.7) */}
            <div className="lg:col-span-2 p-5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-4">
              <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider">
                Branch Cash Registers ({registers.length})
              </h3>

              {isLoadingRegisters ? (
                <div className="space-y-2">
                  <div className="h-12 w-full rounded animate-pulse bg-[#EEE7DD]" />
                  <div className="h-12 w-full rounded animate-pulse bg-[#EEE7DD]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F3EC] text-[10px] font-bold uppercase tracking-wider text-[#71675E] border-b border-[#D8CEC1]">
                      <tr>
                        <th className="py-2.5 px-3">Register Name</th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Branch</th>
                        <th className="py-2.5 px-3">Current Status</th>
                        <th className="py-2.5 px-3">Active Cashier</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8CEC1]/60">
                      {registers.map((r) => {
                        const activeShift = r.shifts?.[0];
                        return (
                          <tr key={r.id} className="hover:bg-[#F7F3EC]">
                            <td className="py-3 px-3 font-bold text-[#292320]">
                              {r.name}
                              {r.description && (
                                <span className="block text-[10px] font-normal text-[#71675E]">
                                  {r.description}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[#292320]">{r.code}</td>
                            <td className="py-3 px-3 text-[#71675E]">{r.branch?.name || "Main"}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  !r.isActive
                                    ? "bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]"
                                    : r.status === "OPEN"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1]"
                                }`}
                              >
                                {!r.isActive ? "INACTIVE" : r.status === "OPEN" ? "SHIFT OPEN" : "ACTIVE (IDLE)"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[#292320]">
                              {activeShift?.cashier?.name || "-"}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {activeShift && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedShiftIdForDetail(activeShift.id)}
                                    className="px-2 py-1 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320]"
                                  >
                                    View Shift
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={r.status === "OPEN"}
                                  onClick={() => handleToggleRegisterStatus(r)}
                                  className="px-2 py-1 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] disabled:opacity-40 text-[11px] font-semibold text-[#292320] flex items-center gap-1"
                                  title={r.isActive ? "Deactivate Register" : "Activate Register"}
                                >
                                  <Power className="h-3 w-3" />
                                  {r.isActive ? "Deactivate" : "Activate"}
                                </button>
                                {!r.hasTransactionHistory && r.status !== "OPEN" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRegister(r)}
                                    className="p-1 rounded border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                                    title="Delete unused register"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
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
        )}

        {/* ========================================================================= */}
        {/* MODALS */}
        {/* ========================================================================= */}
        <OpenShiftModal
          isOpen={isOpenShiftModalOpen}
          onClose={() => setIsOpenShiftModalOpen(false)}
          onShiftOpened={(shift) => {
            setCurrentShiftData(shift);
            loadCurrentShift();
            loadRegisters();
          }}
          cashierName={userName}
        />

        <CloseShiftModal
          isOpen={isCloseShiftModalOpen}
          onClose={() => setIsCloseShiftModalOpen(false)}
          shift={currentShiftData}
          onShiftClosed={(closedShift) => {
            setSelectedShiftForPrint(closedShift);
            setCurrentShiftData(null);
            loadCurrentShift();
            loadHistory();
            loadRegisters();
          }}
        />

        <CashMovementModal
          isOpen={isCashMovementModalOpen}
          onClose={() => setIsCashMovementModalOpen(false)}
          shift={currentShiftData}
          defaultType={cashMovementType}
          onMovementRecorded={() => {
            loadCurrentShift();
          }}
        />

        <ShiftSummaryPrint
          isOpen={Boolean(selectedShiftForPrint)}
          onClose={() => setSelectedShiftForPrint(null)}
          shift={selectedShiftForPrint}
          businessName="Prayassh POS & ERP"
          branchName={selectedShiftForPrint?.branch?.name || "Main Branch"}
        />

        <ShiftDetailModal
          isOpen={Boolean(selectedShiftIdForDetail)}
          shiftId={selectedShiftIdForDetail}
          onClose={() => setSelectedShiftIdForDetail(null)}
          onPrint={(s) => setSelectedShiftForPrint(s)}
          userRole={userRole}
          onUpdated={() => {
            loadHistory();
            loadCurrentShift();
          }}
        />
    </main>
  );
}
