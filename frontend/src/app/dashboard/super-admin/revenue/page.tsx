"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "@/components/toast";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface BusinessMeta {
  id: string;
  name: string;
  slug: string;
  currency?: string;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  businessId: string;
  amount: number | string;
  currency: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  business?: BusinessMeta;
  payments?: any[];
}

interface PaymentRecord {
  id: string;
  businessName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  recordedBy: string;
  date: string;
  status: string;
}

export default function RevenuePaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"invoices" | "transactions">("invoices");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalCollected: 0,
    totalOutstanding: 0,
    overdueAmount: 0,
    currency: "NPR",
    totalInvoicesCount: 0,
    totalPaymentsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OVERDUE" | "PENDING" | "PAID">("ALL");

  // Settlement Modal State
  const [settlingInvoice, setSettlingInvoice] = useState<InvoiceRecord | null>(null);
  const [settlementMethod, setSettlementMethod] = useState("BANK_TRANSFER");
  const [settlementRef, setSettlementRef] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Statement / Print Modal State
  const [selectedStatement, setSelectedStatement] = useState<InvoiceRecord | null>(null);

  const loadRevenueData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/super-admin/revenue");
      if (!res.ok) {
        throw new Error("Failed to load revenue and billing data");
      }
      const data = await res.json();
      setInvoices(data.invoices || []);
      setPayments(data.transactionLogs || data.payments || []);
      if (data.revenueMetrics) {
        setMetrics(data.revenueMetrics);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load revenue data");
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
      loadRevenueData();
    }
  }, [status, session, router, loadRevenueData]);

  // Execute Record Settlement
  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingInvoice) return;

    try {
      setIsSubmittingSettlement(true);
      const res = await fetch("/api/v1/super-admin/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: settlingInvoice.id,
          amount: Number(settlingInvoice.amount),
          paymentMethod: settlementMethod,
          reference: settlementRef || `SETTLE-${Date.now().toString().slice(-6)}`,
          notes: settlementNotes || "Settled by Super Admin",
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to record settlement");
      }

      toast.success(resJson.message || "Invoice settled successfully.");
      setSettlingInvoice(null);
      setSettlementRef("");
      setSettlementNotes("");
      loadRevenueData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record settlement");
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return `NPR ${num.toLocaleString()}`;
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchSearch =
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.business?.name || "").toLowerCase().includes(q) ||
        (inv.business?.slug || "").toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (statusFilter === "ALL") return true;
      return inv.status === statusFilter;
    });
  }, [invoices, search, statusFilter]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      return (
        p.businessName.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  const overdueInvoicesCount = useMemo(() => {
    return invoices.filter((i) => i.status === "OVERDUE").length;
  }, [invoices]);

  const pendingInvoicesCount = useMemo(() => {
    return invoices.filter((i) => i.status === "PENDING").length;
  }, [invoices]);

  const paidInvoicesCount = useMemo(() => {
    return invoices.filter((i) => i.status === "PAID").length;
  }, [invoices]);

  // Enterprise Export Configuration
  const getExportOptions = (): ExportOptions => {
    if (activeTab === "invoices") {
      return {
        title: "Platform Subscription Invoices Ledger",
        subtitle: `Generated on ${new Date().toLocaleDateString()} • RestroInn Hospitality OS`,
        filename: `subscription-invoices-${new Date().toISOString().slice(0, 10)}`,
        data: filteredInvoices.map((inv) => ({
          "Invoice #": inv.invoiceNumber,
          Property: inv.business?.name || "N/A",
          Slug: inv.business?.slug || "N/A",
          Amount: Number(inv.amount),
          Currency: inv.currency,
          Status: inv.status,
          "Due Date": formatDate(inv.dueDate),
          "Created Date": formatDate(inv.createdAt),
        })),
        columns: [
          { header: "Invoice #", key: "Invoice #" },
          { header: "Property", key: "Property" },
          { header: "Slug", key: "Slug" },
          { header: "Amount", key: "Amount" },
          { header: "Currency", key: "Currency" },
          { header: "Status", key: "Status" },
          { header: "Due Date", key: "Due Date" },
          { header: "Created Date", key: "Created Date" },
        ],
      };
    }

    return {
      title: "Subscription Payments & Settlements Ledger",
      subtitle: `Generated on ${new Date().toLocaleDateString()} • RestroInn Hospitality OS`,
      filename: `subscription-payments-${new Date().toISOString().slice(0, 10)}`,
      data: filteredPayments.map((p) => ({
        "Tx ID": p.id,
        Property: p.businessName,
        "Invoice #": p.invoiceNumber,
        Method: p.method,
        Reference: p.reference,
        Amount: p.amount,
        Currency: p.currency,
        "Settled By": p.recordedBy,
        "Settled Date": formatDate(p.date),
      })),
      columns: [
        { header: "Tx ID", key: "Tx ID" },
        { header: "Property", key: "Property" },
        { header: "Invoice #", key: "Invoice #" },
        { header: "Method", key: "Method" },
        { header: "Reference", key: "Reference" },
        { header: "Amount", key: "Amount" },
        { header: "Currency", key: "Currency" },
        { header: "Settled By", key: "Settled By" },
        { header: "Settled Date", key: "Settled Date" },
      ],
    };
  };

  return (
    <div
      className="min-h-full bg-[#F7F3EC] text-[#292320]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[1400px] mx-auto space-y-2">
        {/* 1. Header Block: Breadcrumb & Title grouped tightly */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E] font-normal leading-none">
            <Link href="/dashboard/super-admin" className="hover:text-[#292320]">
              Platform
            </Link>
            <span>/</span>
            <span className="text-[#292320]">Billing &amp; Payments</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <h1 className="text-xl font-bold tracking-tight text-[#292320] leading-tight">
              Billing &amp; Payments Ledger
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={loadRevenueData}
                disabled={loading}
                className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <ExportDropdown
                getExportOptions={getExportOptions}
                buttonText="Export Ledger"
                className="!text-xs !py-1 !px-3"
              />
            </div>
          </div>
        </div>

        {/* 2. Top Metric Bar (4-Column Connected Strip with compact <= 7px padding) */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#D8CEC1]">
          {/* Collected Revenue */}
          <div className="px-3.5 py-1.5">
            <div className="text-xs text-[#71675E] leading-none">Collected revenue</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {formatCurrency(metrics.totalCollected)}
              </span>
              <span className="text-[11px] font-medium text-[#057A55] leading-none">
                {payments.length} settled
              </span>
            </div>
          </div>

          {/* Overdue Subscriptions */}
          <div
            onClick={() => setStatusFilter("OVERDUE")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Overdue subscriptions</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#9C3232] tabular-nums leading-none">
                {formatCurrency(metrics.overdueAmount)}
              </span>
              {overdueInvoicesCount > 0 && (
                <span className="text-xs font-medium text-[#9C3232] leading-none">
                  {overdueInvoicesCount} Action
                </span>
              )}
            </div>
          </div>

          {/* Pending Billing */}
          <div
            onClick={() => setStatusFilter("PENDING")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Pending billing</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {formatCurrency(metrics.totalOutstanding)}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">
                {pendingInvoicesCount} invoices
              </span>
            </div>
          </div>

          {/* Total Invoices Issued */}
          <div
            onClick={() => setStatusFilter("ALL")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Total statements</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {invoices.length}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">All time</span>
            </div>
          </div>
        </div>

        {/* 3. Filter & Tab Controls */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Left: View Tabs */}
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                activeTab === "invoices"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Invoices &amp; Statements ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                activeTab === "transactions"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Settled Transactions ({payments.length})
            </button>
          </div>

          {/* Right: Search & Status Pills */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === "invoices" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                    statusFilter === "ALL"
                      ? "bg-[#292320] text-white font-semibold"
                      : "bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
                  }`}
                >
                  All ({invoices.length})
                </button>
                <button
                  onClick={() => setStatusFilter("OVERDUE")}
                  className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                    statusFilter === "OVERDUE"
                      ? "bg-[#9C3232] text-white font-semibold"
                      : "bg-[#F7F3EC] border border-[#D8CEC1] text-[#9C3232] hover:bg-[#FDE8E8]"
                  }`}
                >
                  Overdue ({overdueInvoicesCount})
                </button>
                <button
                  onClick={() => setStatusFilter("PENDING")}
                  className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                    statusFilter === "PENDING"
                      ? "bg-[#854D0E] text-white font-semibold"
                      : "bg-[#F7F3EC] border border-[#D8CEC1] text-[#854D0E] hover:bg-[#FEF08A]/30"
                  }`}
                >
                  Pending ({pendingInvoicesCount})
                </button>
                <button
                  onClick={() => setStatusFilter("PAID")}
                  className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                    statusFilter === "PAID"
                      ? "bg-[#057A55] text-white font-semibold"
                      : "bg-[#F7F3EC] border border-[#D8CEC1] text-[#057A55] hover:bg-[#DEF7EC]"
                  }`}
                >
                  Paid ({paidInvoicesCount})
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Search property or invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837] w-full sm:w-56"
            />
          </div>
        </div>

        {/* 4. Tab 1: Invoices & Statements Table (compact <= 7px padding) */}
        {activeTab === "invoices" && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#D8CEC1]">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-bold text-[#292320]">
                  Subscription Invoices
                </span>
                <span className="text-xs text-[#71675E]">
                  ({filteredInvoices.length} records)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[#71675E] border-b border-[#D8CEC1]">
                    <th className="py-1.5 px-3 font-normal">Invoice #</th>
                    <th className="py-1.5 px-3 font-normal">Business / Property</th>
                    <th className="py-1.5 px-3 font-normal">Billing Period</th>
                    <th className="py-1.5 px-3 font-normal">Amount</th>
                    <th className="py-1.5 px-3 font-normal">Due Date</th>
                    <th className="py-1.5 px-3 font-normal">Status</th>
                    <th className="py-1.5 px-3 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CEC1]">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-[#71675E]">
                        No invoices match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#F7F3EC]/30 transition-colors">
                        <td className="py-1.5 px-3 font-mono font-medium text-[#292320]">
                          #{inv.invoiceNumber}
                        </td>
                        <td className="py-1.5 px-3">
                          <Link
                            href={`/dashboard/super-admin/businesses/${inv.businessId}`}
                            className="font-medium text-[#292320] hover:text-[#6B2837] transition-colors"
                          >
                            {inv.business?.name || "Unknown Tenant"}
                          </Link>
                          {inv.business?.slug && (
                            <span className="text-xs font-mono text-[#71675E] ml-1.5">
                              /{inv.business.slug}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[#71675E] tabular-nums">
                          {formatDate(inv.billingPeriodStart)} - {formatDate(inv.billingPeriodEnd)}
                        </td>
                        <td
                          className={`py-1.5 px-3 font-semibold tabular-nums ${
                            inv.status === "OVERDUE" ? "text-[#9C3232]" : "text-[#292320]"
                          }`}
                        >
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-1.5 px-3 text-[#71675E] tabular-nums">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inv.status === "PAID"
                                  ? "bg-[#057A55]"
                                  : inv.status === "OVERDUE"
                                  ? "bg-[#9C3232]"
                                  : "bg-[#D97706]"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                inv.status === "PAID"
                                  ? "text-[#057A55]"
                                  : inv.status === "OVERDUE"
                                  ? "text-[#9C3232]"
                                  : "text-[#D97706]"
                              }`}
                            >
                              {inv.status === "PAID"
                                ? "Paid"
                                : inv.status === "OVERDUE"
                                ? "Overdue"
                                : "Pending"}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {inv.status !== "PAID" && (
                              <button
                                onClick={() => setSettlingInvoice(inv)}
                                className="px-2.5 py-0.5 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-medium rounded transition-colors cursor-pointer leading-normal"
                              >
                                Record Settlement
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedStatement(inv)}
                              className="px-2 py-0.5 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer leading-normal"
                            >
                              Statement
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Tab 2: Settled Transactions Table (compact <= 7px padding) */}
        {activeTab === "transactions" && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#D8CEC1]">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-bold text-[#292320]">
                  Payment Transactions Ledger
                </span>
                <span className="text-xs text-[#71675E]">
                  ({filteredPayments.length} transactions)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[#71675E] border-b border-[#D8CEC1]">
                    <th className="py-1.5 px-3 font-normal">Transaction ID</th>
                    <th className="py-1.5 px-3 font-normal">Property / Tenant</th>
                    <th className="py-1.5 px-3 font-normal">Invoice #</th>
                    <th className="py-1.5 px-3 font-normal">Method</th>
                    <th className="py-1.5 px-3 font-normal">Reference</th>
                    <th className="py-1.5 px-3 font-normal">Recorded By</th>
                    <th className="py-1.5 px-3 font-normal">Amount</th>
                    <th className="py-1.5 px-3 font-normal text-right">Settled Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CEC1]">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-xs text-[#71675E]">
                        No payment transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F7F3EC]/30 transition-colors">
                        <td className="py-1.5 px-3 font-mono text-[11px] text-[#71675E]">
                          {p.id.slice(0, 8)}...
                        </td>
                        <td className="py-1.5 px-3 font-medium text-[#292320]">
                          {p.businessName}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-[#71675E]">
                          #{p.invoiceNumber}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="px-1.5 py-0.2 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[10px] font-semibold text-[#71675E]">
                            {p.method}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-[#71675E]">
                          {p.reference}
                        </td>
                        <td className="py-1.5 px-3 text-[#71675E]">{p.recordedBy}</td>
                        <td className="py-1.5 px-3 font-semibold text-[#057A55] tabular-nums">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-1.5 px-3 text-right text-[#71675E] tabular-nums">
                          {formatDate(p.date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Settlement Modal */}
        {settlingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] w-full max-w-md p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">
                    Record Settlement
                  </h3>
                  <p className="text-xs text-[#71675E]">
                    Invoice #{settlingInvoice.invoiceNumber} • {settlingInvoice.business?.name}
                  </p>
                </div>
                <button
                  onClick={() => setSettlingInvoice(null)}
                  className="p-1 text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteSettlement} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#71675E] mb-1">Settlement Amount (NPR)</label>
                  <input
                    type="text"
                    disabled
                    value={formatCurrency(settlingInvoice.amount)}
                    className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded font-bold text-[#292320]"
                  />
                </div>

                <div>
                  <label className="block text-[#71675E] mb-1">Settlement Method</label>
                  <select
                    value={settlementMethod}
                    onChange={(e) => setSettlementMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (Direct Deposit)</option>
                    <option value="KHALTI">Khalti Merchant Settlement</option>
                    <option value="ESEWA">eSewa Merchant Settlement</option>
                    <option value="CASH">Cash / Direct Office Settlement</option>
                    <option value="CONNECT_IPS">ConnectIPS / NCHL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#71675E] mb-1">Reference / UTR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-2026-98124 or Deposit Slip #"
                    value={settlementRef}
                    onChange={(e) => setSettlementRef(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block text-[#71675E] mb-1">Administrative Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Annual renewal payment verified via bank voucher"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                  <button
                    type="button"
                    onClick={() => setSettlingInvoice(null)}
                    className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSettlement}
                    className="px-4 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingSettlement ? "Recording..." : "Confirm Settlement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Statement / Print Modal */}
        {selectedStatement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] w-full max-w-lg p-5 space-y-4 my-8">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#292320]">
                    Statement: #{selectedStatement.invoiceNumber}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStatement(null)}
                  className="p-1 text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Printable Body */}
              <div className="border border-[#D8CEC1] bg-[#F7F3EC] p-4 rounded text-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-[#292320]">RestroInn Systems</h4>
                    <p className="text-[#71675E]">Hospitality OS Platform Services</p>
                    <p className="text-[#71675E]">billing@restroinn.com</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#6B2837]">INVOICE STATEMENT</span>
                    <p className="font-mono text-[#292320]">#{selectedStatement.invoiceNumber}</p>
                    <p className="text-[#71675E]">{formatDate(selectedStatement.createdAt)}</p>
                  </div>
                </div>

                <div className="border-t border-[#D8CEC1] pt-2">
                  <span className="text-[10px] uppercase font-semibold text-[#71675E]">
                    Billed Tenant
                  </span>
                  <div className="font-bold text-sm text-[#292320]">
                    {selectedStatement.business?.name}
                  </div>
                  <div className="text-[#71675E] font-mono text-[11px]">
                    Workspace: /{selectedStatement.business?.slug}
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-[#71675E]">
                      <th className="py-1 font-normal">Description</th>
                      <th className="py-1 text-right font-normal">Period</th>
                      <th className="py-1 text-right font-normal">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#D8CEC1]">
                      <td className="py-2">
                        <div className="font-medium text-[#292320]">
                          SaaS Hospitality Subscription License
                        </div>
                        <div className="text-[11px] text-[#71675E]">
                          Multi-tenant cloud platform access
                        </div>
                      </td>
                      <td className="py-2 text-right text-[#71675E] tabular-nums">
                        {formatDate(selectedStatement.billingPeriodStart)} -{" "}
                        {formatDate(selectedStatement.billingPeriodEnd)}
                      </td>
                      <td className="py-2 text-right font-bold text-[#292320] tabular-nums">
                        {formatCurrency(selectedStatement.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between items-center border-t border-[#D8CEC1] pt-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[#71675E]">
                      Status
                    </span>
                    <div className="font-bold text-xs text-[#292320]">
                      {selectedStatement.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-[#71675E]">
                      Total Due
                    </span>
                    <div className="text-base font-bold text-[#6B2837] tabular-nums">
                      {formatCurrency(selectedStatement.amount)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#71675E]" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => setSelectedStatement(null)}
                  className="px-4 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
