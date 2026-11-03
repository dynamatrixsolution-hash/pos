"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { formatNPR } from "@/lib/currency";
import { Notify } from "@/lib/notify";
import {
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Truck,
  Building,
  RefreshCw,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  UtensilsCrossed,
  Package,
  BookOpen,
  X,
  CreditCard,
  Banknote,
} from "lucide-react";

type ActiveTab = "OVERVIEW" | "PURCHASES" | "PAYABLES" | "RECEIVABLES";

export default function RestaurantFinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [paySupplierModal, setPaySupplierModal] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("BANK_TRANSFER");
  const [payNotes, setPayNotes] = useState<string>("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // New Purchase Modal state
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchasePaymentStatus, setPurchasePaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [purchasePaidAmount, setPurchasePaidAmount] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseItemsList, setPurchaseItemsList] = useState<
    { productId: string; quantity: number; price: number }[]
  >([]);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/restaurant/reports/reconciliation");
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        setAvailableSuppliers(data.suppliers || []);
      } else {
        const err = await res.json().catch(() => ({}));
        Notify.failure(err.error || "Failed to load restaurant report");
      }
    } catch (e: any) {
      Notify.failure(e.message || "Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductsForPurchase = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/inventory/current-stock");
      if (res.ok) {
        const data = await res.json();
        setAvailableProducts(data.data || data.products || []);
      }
    } catch (e) {
      console.warn("Failed to fetch raw products:", e);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    fetchProductsForPurchase();
  }, [fetchReport, fetchProductsForPurchase]);

  // Handle Pay Supplier
  const handlePaySupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierModal) return;
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Notify.failure("Please enter a valid positive payment amount");
      return;
    }

    try {
      setIsSubmittingPay(true);
      const res = await fetch("/api/v1/restaurant/reports/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAY_SUPPLIER",
          supplierId: paySupplierModal.id,
          amount: amountNum,
          paymentMethod: payMethod,
          notes: payNotes || `Payment to ${paySupplierModal.name}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record payment");
      }

      const resData = await res.json();
      Notify.success(resData.message || "Payment recorded successfully!");
      setPaySupplierModal(null);
      setPayAmount("");
      setPayNotes("");
      await fetchReport();
    } catch (err: any) {
      Notify.failure(err.message || "Payment processing failed");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Handle Settle Delivery COD
  const handleSettleDeliveryCod = async (orderId: string, orderNumber: string) => {
    try {
      const res = await fetch("/api/v1/restaurant/reports/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SETTLE_DELIVERY_COD",
          orderId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to settle delivery COD");
      }

      Notify.success(`Delivery #${orderNumber} marked as Remitted & Paid!`);
      await fetchReport();
    } catch (err: any) {
      Notify.failure(err.message || "Failed to remit delivery COD");
    }
  };

  // Handle Create Purchase Submit
  const handleCreatePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      Notify.failure("Please select a vendor/supplier");
      return;
    }
    if (purchaseItemsList.length === 0) {
      Notify.failure("Please add at least one raw ingredient item to this purchase order");
      return;
    }

    const subtotal = purchaseItemsList.reduce((acc, i) => acc + i.quantity * i.price, 0);
    const paid = purchasePaymentStatus === "PAID" ? subtotal : parseFloat(purchasePaidAmount) || 0;

    try {
      setIsSubmittingPurchase(true);
      const res = await fetch("/api/v1/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          invoiceNumber: invoiceNumber || undefined,
          items: purchaseItemsList.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
          subtotal,
          total: subtotal,
          paidAmount: paid,
          paymentStatus: paid >= subtotal ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          notes: purchaseNotes || "Restaurant daily raw procurement",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to log purchase order");
      }

      Notify.success("Daily raw ingredient purchase logged & inventory updated!");
      setShowNewPurchaseModal(false);
      setPurchaseItemsList([]);
      setInvoiceNumber("");
      setPurchaseNotes("");
      setPurchasePaidAmount("");
      await fetchReport();
    } catch (err: any) {
      Notify.failure(err.message || "Failed to submit purchase order");
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const summary = reportData?.summary || {
    totalFoodSales: 0,
    totalOrdersCount: 0,
    totalCogs: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    totalAccountsPayable: 0,
    totalAccountsReceivable: 0,
    deliveryReceivable: 0,
    roomFolioReceivable: 0,
  };

  const filteredPurchases = useMemo(() => {
    const list = reportData?.purchases || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p: any) =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        p.supplierName.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    const list = reportData?.suppliers || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s: any) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName && s.contactName.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }, [reportData, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#F7F3EC] text-[#292320]">
      {/* Top Header Bar */}
      <header className="px-6 py-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#6B2837]/10 flex items-center justify-center text-[#6B2837]">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#292320]">Daily Inventory &amp; Financials</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5EE] text-[#237A4B] border border-[#CDE7D5]">
                Authoritative Ledger
              </span>
            </div>
            <p className="text-xs text-[#71675E]">
              Daily raw ingredient procurement, food COGS, accounts payable &amp; accounts receivable
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/restaurant/pos"
            className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-[#71675E]" />
            <span>Open POS</span>
          </Link>
          <Link
            href="/dashboard/restaurant/menu"
            className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#71675E]" />
            <span>Menu &amp; BOM</span>
          </Link>
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="h-8 w-8 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#292320] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewPurchaseModal(true);
              if (availableSuppliers.length > 0 && !selectedSupplierId) {
                setSelectedSupplierId(availableSuppliers[0].id);
              }
            }}
            className="h-8 px-3 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Daily Purchase</span>
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-5 pb-0 shrink-0">
        {/* Card 1: Settled Food Sales */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Food Sales</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#237A4B]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#292320]">
            {formatNPR(summary.totalFoodSales)}
          </div>
          <span className="text-[10px] text-[#71675E]">{summary.totalOrdersCount} settled orders</span>
        </div>

        {/* Card 2: Food COGS */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Raw Ingredient COGS</span>
            <Layers className="h-3.5 w-3.5 text-[#D97706]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#292320]">
            {formatNPR(summary.totalCogs)}
          </div>
          <span className="text-[10px] text-[#71675E]">Consumed in kitchen</span>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Gross Margin</span>
            <TrendingUp className="h-3.5 w-3.5 text-[#237A4B]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#237A4B]">
            {summary.grossMarginPercent}%
          </div>
          <span className="text-[10px] text-[#71675E] font-mono tabular-nums">
            +{formatNPR(summary.grossProfit)} profit
          </span>
        </div>

        {/* Card 4: Accounts Payable */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Who We Owe (AP)</span>
            <ArrowDownLeft className="h-3.5 w-3.5 text-[#DC2626]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#DC2626]">
            {formatNPR(summary.totalAccountsPayable)}
          </div>
          <span className="text-[10px] text-[#71675E]">Due to raw suppliers</span>
        </div>

        {/* Card 5: Accounts Receivable */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Who Owes Us (AR)</span>
            <DollarSign className="h-3.5 w-3.5 text-[#2563EB]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#2563EB]">
            {formatNPR(summary.totalAccountsReceivable)}
          </div>
          <span className="text-[10px] text-[#71675E]">COD &amp; Room Folios</span>
        </div>

        {/* Card 6: Delivery COD */}
        <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#71675E]">Pending Delivery COD</span>
            <Truck className="h-3.5 w-3.5 text-[#D97706]" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-[#D97706]">
            {formatNPR(summary.deliveryReceivable)}
          </div>
          <span className="text-[10px] text-[#71675E]">Cash with delivery riders</span>
        </div>
      </div>

      {/* Segmented Navigation & Search Filter */}
      <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="inline-flex rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] p-1 gap-1">
          {(
            [
              { id: "OVERVIEW", label: "Daily Overview & COGS" },
              { id: "PURCHASES", label: "Supplier Purchases (Procurement)" },
              { id: "PAYABLES", label: "Accounts Payable (Who We Owe)" },
              { id: "RECEIVABLES", label: "Accounts Receivable (Who Owes Us)" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#FFFCF7] text-[#292320] shadow-xs"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71675E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor, order, invoice..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
          />
        </div>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-3 py-12 text-center text-xs text-[#71675E]">
            <div className="h-6 w-48 mx-auto rounded bg-[#EEE7DD] animate-pulse" />
            <p>Reconciling live restaurant inventory, COGS &amp; balances...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DAILY OVERVIEW & COGS BREAKDOWN */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                        Daily Dish Recipe Consumption &amp; Gross Margin (COGS)
                      </h2>
                      <p className="text-[11px] text-[#71675E]">
                        Raw inventory ingredients deducted per plate prepared vs food revenue recognized
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#71675E]">
                      {reportData?.cogsBreakdown?.length || 0} active menu dishes tracked
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F3EC] text-[#71675E] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Menu Dish Name</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Plates Prepared</th>
                          <th className="px-4 py-2.5">Raw Ingredients Depleted</th>
                          <th className="px-4 py-2.5 text-right">Food Cost (COGS)</th>
                          <th className="px-4 py-2.5 text-right">Sales Revenue</th>
                          <th className="px-4 py-2.5 text-right">Gross Profit</th>
                          <th className="px-4 py-2.5 text-right">Food Cost %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CEC1]">
                        {(!reportData?.cogsBreakdown || reportData.cogsBreakdown.length === 0) ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-[#71675E]">
                              No dishes prepared or consumed in this reporting period yet.
                            </td>
                          </tr>
                        ) : (
                          reportData.cogsBreakdown.map((dish: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[#F7F3EC]/50 transition-colors">
                              <td className="px-4 py-3 font-bold text-[#292320]">{dish.name}</td>
                              <td className="px-4 py-3 text-[#71675E]">{dish.category}</td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums">
                                {dish.quantityCooked} plates
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5 text-[11px] text-[#71675E]">
                                  {dish.ingredientsUsed.map((ing: any, iIdx: number) => (
                                    <div key={iIdx}>
                                      • {ing.name}:{" "}
                                      <span className="font-mono tabular-nums font-semibold text-[#292320]">
                                        {ing.quantity.toFixed(3)} {ing.unit}
                                      </span>{" "}
                                      ({formatNPR(ing.cost)})
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#D97706]">
                                {formatNPR(dish.ingredientCost)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#292320]">
                                {formatNPR(dish.salesRevenue)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#237A4B]">
                                +{formatNPR(dish.grossMargin)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                    dish.foodCostPercent > 45
                                      ? "bg-[#FEF2F2] text-[#DC2626]"
                                      : "bg-[#EAF5EE] text-[#237A4B]"
                                  }`}
                                >
                                  {dish.foodCostPercent}%
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

            {/* TAB 2: SUPPLIER PURCHASES (DAILY PROCUREMENT) */}
            {activeTab === "PURCHASES" && (
              <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Supplier Daily Purchases &amp; Invoices
                    </h2>
                    <p className="text-[11px] text-[#71675E]">
                      Raw meat, vegetables, dairy and beverages purchased from vendors
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewPurchaseModal(true);
                      if (availableSuppliers.length > 0 && !selectedSupplierId) {
                        setSelectedSupplierId(availableSuppliers[0].id);
                      }
                    }}
                    className="h-7 px-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Log Daily Purchase</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F3EC] text-[#71675E] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Date &amp; PO#</th>
                        <th className="px-4 py-2.5">Invoice #</th>
                        <th className="px-4 py-2.5">Supplier Name</th>
                        <th className="px-4 py-2.5">Items Purchased</th>
                        <th className="px-4 py-2.5 text-right">Total Bill</th>
                        <th className="px-4 py-2.5 text-right">Paid</th>
                        <th className="px-4 py-2.5 text-right">Balance Due</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8CEC1]">
                      {filteredPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-[#71675E]">
                            No supplier purchases found matching selection.
                          </td>
                        </tr>
                      ) : (
                        filteredPurchases.map((p: any) => (
                          <tr key={p.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-bold text-[#292320] block">{p.purchaseNumber}</span>
                              <span className="text-[10px] text-[#71675E]">
                                {new Date(p.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-[#292320]">
                              {p.invoiceNumber || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-[#292320] block">{p.supplierName}</span>
                              <span className="text-[10px] text-[#71675E]">{p.supplierPhone || "No phone"}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5 text-[11px] text-[#71675E]">
                                {p.items.map((pi: any, idx: number) => (
                                  <div key={idx}>
                                    • {pi.productName} ({pi.quantity} × {formatNPR(pi.price)}) ={" "}
                                    <span className="font-mono font-semibold text-[#292320]">
                                      {formatNPR(pi.total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#292320]">
                              {formatNPR(p.total)}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#237A4B]">
                              {formatNPR(p.paidAmount)}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#DC2626]">
                              {formatNPR(p.dueAmount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  p.paymentStatus === "PAID"
                                    ? "bg-[#EAF5EE] text-[#237A4B]"
                                    : p.paymentStatus === "PARTIAL"
                                    ? "bg-[#FFFBEB] text-[#D97706]"
                                    : "bg-[#FEF2F2] text-[#DC2626]"
                                }`}
                              >
                                {p.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: ACCOUNTS PAYABLE (WHO WE OWE) */}
            {activeTab === "PAYABLES" && (
              <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                      Accounts Payable (Who We Owe Money To)
                    </h2>
                    <p className="text-[11px] text-[#71675E]">
                      Current outstanding debt owed to meat, agro, dairy and beverage suppliers
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#71675E] block">Total AP Liability</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-[#DC2626]">
                      {formatNPR(summary.totalAccountsPayable)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F3EC] text-[#71675E] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Supplier / Vendor</th>
                        <th className="px-4 py-2.5">Contact Person</th>
                        <th className="px-4 py-2.5">Phone &amp; Location</th>
                        <th className="px-4 py-2.5">Last Transaction</th>
                        <th className="px-4 py-2.5 text-right">Outstanding Debt Owed</th>
                        <th className="px-4 py-2.5 text-center">Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8CEC1]">
                      {filteredSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-[#71675E]">
                            No suppliers found.
                          </td>
                        </tr>
                      ) : (
                        filteredSuppliers.map((s: any) => (
                          <tr key={s.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-bold text-[#292320] block">{s.name}</span>
                              <span className="text-[10px] text-[#71675E]">{s.email || "No email"}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-[#292320]">
                              {s.contactName || "Direct Sales"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-[#292320] block">{s.phone || "—"}</span>
                              <span className="text-[10px] text-[#71675E] truncate max-w-xs block">
                                {s.address || "Kathmandu"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#71675E] font-mono text-[11px]">
                              {s.lastPurchaseDate
                                ? new Date(s.lastPurchaseDate).toLocaleDateString()
                                : "No record"}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold tabular-nums text-right">
                              <span
                                className={s.balance > 0 ? "text-[#DC2626] font-bold text-sm" : "text-[#237A4B]"}
                              >
                                {formatNPR(s.balance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {s.balance > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaySupplierModal(s);
                                    setPayAmount(s.balance.toString());
                                  }}
                                  className="h-7 px-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1"
                                >
                                  <DollarSign className="h-3 w-3" />
                                  <span>Pay Supplier</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#237A4B] bg-[#EAF5EE] px-2 py-0.5 rounded">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>All Settled</span>
                                </span>
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

            {/* TAB 4: ACCOUNTS RECEIVABLE (WHO OWES US) */}
            {activeTab === "RECEIVABLES" && (
              <div className="space-y-5">
                {/* Section A: Delivery COD In-Transit */}
                <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-[#D97706]" />
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                          Delivery Orders — Pending Cash on Delivery (COD)
                        </h2>
                        <p className="text-[11px] text-[#71675E]">
                          Unremitted payments currently with delivery riders or out for delivery
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#D97706]">
                      Total COD: {formatNPR(summary.deliveryReceivable)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F3EC] text-[#71675E] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Order #</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Phone &amp; Address</th>
                          <th className="px-4 py-2.5">Assigned Rider</th>
                          <th className="px-4 py-2.5 text-right">Cash Due</th>
                          <th className="px-4 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CEC1]">
                        {(!reportData?.receivables?.deliveryCod ||
                          reportData.receivables.deliveryCod.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-[#71675E]">
                              No outstanding delivery COD collections pending.
                            </td>
                          </tr>
                        ) : (
                          reportData.receivables.deliveryCod.map((del: any) => (
                            <tr key={del.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-bold text-[#292320] block">{del.orderNumber}</span>
                                <span className="text-[10px] text-[#71675E]">
                                  {new Date(del.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#292320]">
                                {del.customerName}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-[#292320] block">{del.phone}</span>
                                <span className="text-[10px] text-[#71675E]">{del.address}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 font-semibold text-[#292320]">
                                  <Truck className="h-3 w-3 text-[#71675E]" />
                                  {del.riderName}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#D97706] text-sm">
                                {formatNPR(del.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSettleDeliveryCod(del.id, del.orderNumber)}
                                  className="h-7 px-2.5 rounded-md bg-[#237A4B] hover:bg-[#1E663F] text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Remit COD Cash</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section B: Hotel Room Folio Charges */}
                <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-[#2563EB]" />
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
                          Hotel Room Folios — Restaurant Charges Pending Checkout
                        </h2>
                        <p className="text-[11px] text-[#71675E]">
                          Dining and room service meals posted to guest room folios
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#2563EB]">
                      Total Folios: {formatNPR(summary.roomFolioReceivable)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F3EC] text-[#71675E] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Room #</th>
                          <th className="px-4 py-2.5">Guest Name</th>
                          <th className="px-4 py-2.5">Stay / Folio Number</th>
                          <th className="px-4 py-2.5 text-center">Meals Charged</th>
                          <th className="px-4 py-2.5 text-right">Restaurant Charges</th>
                          <th className="px-4 py-2.5 text-right">Total Folio Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8CEC1]">
                        {(!reportData?.receivables?.roomFolios ||
                          reportData.receivables.roomFolios.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-[#71675E]">
                              No active room folios currently carry restaurant dining charges.
                            </td>
                          </tr>
                        ) : (
                          reportData.receivables.roomFolios.map((rf: any) => (
                            <tr key={rf.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                              <td className="px-4 py-3 font-bold font-mono text-sm text-[#292320]">
                                Room {rf.roomNumber}
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#292320]">{rf.guestName}</td>
                              <td className="px-4 py-3 font-mono text-[#71675E]">{rf.stayNumber}</td>
                              <td className="px-4 py-3 text-center font-mono tabular-nums">
                                {rf.transactionsCount} bills
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#2563EB]">
                                {formatNPR(rf.restaurantCharges)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold tabular-nums text-right text-[#292320]">
                                {formatNPR(rf.totalFolioBalance)}
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
          </>
        )}
      </div>

      {/* Pay Supplier Modal */}
      {paySupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Record Supplier Payment</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Vendor: <span className="font-semibold text-[#292320]">{paySupplierModal.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaySupplierModal(null)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-3">
              <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-1">
                <span className="text-[11px] text-[#71675E] block">Current Total Balance Due:</span>
                <span className="text-base font-bold font-mono tabular-nums text-[#DC2626]">
                  {formatNPR(paySupplierModal.balance)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#292320]">Amount to Pay (NPR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono font-bold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#292320]">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / Cheque</option>
                  <option value="CASH">Cash Payment</option>
                  <option value="FONE_PAY">FonePay / QR</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#292320]">Payment Notes / Reference</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Cheque #, transfer slip ref..."
                  className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setPaySupplierModal(null)}
                  className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="h-8 px-4 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPay ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Daily Purchase Modal */}
      {showNewPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#6B2837]" />
                <h3 className="text-sm font-bold text-[#292320]">Log Daily Raw Material Purchase</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPurchaseModal(false)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#292320]">Supplier / Vendor *</label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      required
                      className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    >
                      <option value="">Select vendor...</option>
                      {availableSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Balance: {formatNPR(s.balance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#292320]">Supplier Invoice #</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. HFM-9921"
                      className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                </div>

                {/* Items selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#292320]">Raw Ingredients Delivered *</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableProducts.length > 0) {
                          setPurchaseItemsList((prev) => [
                            ...prev,
                            {
                              productId: availableProducts[0].id,
                              quantity: 5,
                              price: Number(availableProducts[0].costPrice || 100),
                            },
                          ]);
                        }
                      }}
                      className="h-6 px-2 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Ingredient Line</span>
                    </button>
                  </div>

                  {purchaseItemsList.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-[#D8CEC1] text-center text-xs text-[#71675E]">
                      Click &quot;Add Ingredient Line&quot; to add meat, flour, vegetables or dairy.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {purchaseItemsList.map((item, idx) => {
                        const lineTotal = item.quantity * item.price;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center gap-2"
                          >
                            <select
                              value={item.productId}
                              onChange={(e) => {
                                const prod = availableProducts.find((p) => p.id === e.target.value);
                                const updated = [...purchaseItemsList];
                                updated[idx].productId = e.target.value;
                                if (prod) updated[idx].price = Number(prod.costPrice || 100);
                                setPurchaseItemsList(updated);
                              }}
                              className="flex-1 h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320]"
                            >
                              {availableProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>

                            <div className="w-24">
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...purchaseItemsList];
                                  updated[idx].quantity = parseFloat(e.target.value) || 0;
                                  setPurchaseItemsList(updated);
                                }}
                                placeholder="Qty"
                                className="w-full h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320]"
                              />
                            </div>

                            <div className="w-28">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={item.price}
                                onChange={(e) => {
                                  const updated = [...purchaseItemsList];
                                  updated[idx].price = parseFloat(e.target.value) || 0;
                                  setPurchaseItemsList(updated);
                                }}
                                placeholder="Rate"
                                className="w-full h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320]"
                              />
                            </div>

                            <div className="w-24 text-right font-mono font-bold text-xs tabular-nums text-[#292320]">
                              {formatNPR(lineTotal)}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setPurchaseItemsList((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="h-7 w-7 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-red-50 flex items-center justify-center text-[#71675E] hover:text-[#DC2626] cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Totals & Payment Status */}
                <div className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#292320]">Purchase Subtotal</span>
                    <span className="text-base font-bold font-mono tabular-nums text-[#292320]">
                      {formatNPR(
                        purchaseItemsList.reduce((acc, i) => acc + i.quantity * i.price, 0)
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#D8CEC1]">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#292320]">Payment Status</label>
                      <select
                        value={purchasePaymentStatus}
                        onChange={(e) => setPurchasePaymentStatus(e.target.value as any)}
                        className="w-full h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-medium text-[#292320]"
                      >
                        <option value="UNPAID">Credit / Due (Increases AP Owed)</option>
                        <option value="PAID">Paid in Full (Cash / Bank)</option>
                      </select>
                    </div>

                    {purchasePaymentStatus === "UNPAID" && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#292320]">Partial Payment Made (if any)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={purchasePaidAmount}
                          onChange={(e) => setPurchasePaidAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono tabular-nums text-[#292320]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292320]">Procurement Notes</label>
                  <input
                    type="text"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="Batch info, delivery remarks..."
                    className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between shrink-0">
                <span className="text-[11px] text-[#71675E]">
                  Saving automatically increments ingredient stock and updates AP balance
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewPurchaseModal(false)}
                    className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPurchase || purchaseItemsList.length === 0}
                    className="h-8 px-4 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPurchase ? "Saving..." : "Save Purchase Order"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

