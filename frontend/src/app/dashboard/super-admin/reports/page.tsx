"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RotateCw,
  Search,
  X,
  CreditCard,
  Building2,
  LifeBuoy,
  History,
  ArrowUpRight,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";

type TimePeriod = "day" | "week" | "month" | "year" | "all";
type ReportCategory = "revenue" | "businesses" | "support" | "audit";

export default function PlatformReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [period, setPeriod] = useState<TimePeriod>("month");
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("revenue");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Data
  const [reportData, setReportData] = useState<{
    metrics: {
      period: string;
      periodLabel: string;
      revenue: {
        collectedNpr: number;
        pendingNpr: number;
        totalInvoicedNpr: number;
        paidCount: number;
        pendingCount: number;
      };
      businesses: {
        newInPeriod: number;
        totalAllTime: number;
        restaurant: number;
        hotel: number;
        hybrid: number;
      };
      support: {
        ticketsInPeriod: number;
        resolvedInPeriod: number;
        openInPeriod: number;
      };
      auditCount: number;
    };
    invoices: any[];
    businesses: any[];
    tickets: any[];
    auditLogs: any[];
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadReport();
    }
  }, [status, session, router, period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/reports?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      } else {
        toast.error("Failed to load reports data");
      }
    } catch (err: any) {
      console.error("Failed to load reports:", err);
      toast.error(err.message || "Network error loading reports");
    } finally {
      setLoading(false);
    }
  };

  // Prepare Export Options dynamically based on current tab and period
  const getDynamicExportOptions = (): ExportOptions => {
    const periodName =
      period === "day"
        ? "Today"
        : period === "week"
        ? "Last 7 Days"
        : period === "month"
        ? "Last 30 Days"
        : period === "year"
        ? "Last 365 Days"
        : "All Time";

    const dateStamp = new Date().toISOString().slice(0, 10);

    if (activeCategory === "revenue") {
      return {
        filename: `restroinn-revenue-report-${period}-${dateStamp}`,
        title: "Platform Subscription Invoices & Revenue Report",
        subtitle: `RestroInn SaaS Revenue Collection Summary`,
        dateRange: periodName,
        columns: [
          { header: "Invoice #", key: "invoiceNumber", width: 16 },
          { header: "Client Business", key: "businessName", width: 24 },
          { header: "Plan Tier", key: "plan", width: 14 },
          { header: "Package Type", key: "packageType", width: 14 },
          {
            header: "Amount (NPR)",
            key: "amount",
            width: 16,
            format: (val) => Number(val).toLocaleString(),
          },
          { header: "Payment Status", key: "status", width: 14 },
          {
            header: "Due Date",
            key: "dueDate",
            width: 14,
            format: (val) => (val ? new Date(val).toLocaleDateString() : ""),
          },
          {
            header: "Paid Date",
            key: "paidAt",
            width: 14,
            format: (val) => (val ? new Date(val).toLocaleDateString() : "Pending"),
          },
          { header: "Payment Method", key: "paymentMethod", width: 16 },
          { header: "Transaction Ref", key: "reference", width: 20 },
        ],
        data: reportData?.invoices || [],
      };
    }

    if (activeCategory === "businesses") {
      return {
        filename: `restroinn-businesses-directory-${period}-${dateStamp}`,
        title: "Client Businesses Directory Report",
        subtitle: `Registered Properties & Hospitality Workspaces`,
        dateRange: periodName,
        columns: [
          { header: "Business Name", key: "name", width: 24 },
          { header: "Subdomain Slug", key: "slug", width: 18 },
          { header: "Package Type", key: "packageType", width: 14 },
          { header: "Account Status", key: "status", width: 14 },
          { header: "Owner Name", key: "ownerName", width: 20 },
          { header: "Owner Email", key: "ownerEmail", width: 24 },
          { header: "Owner Phone", key: "ownerPhone", width: 16 },
          { header: "Assigned Plan", key: "plan", width: 14 },
          { header: "Branches", key: "branchCount", width: 10 },
          {
            header: "Registered Date",
            key: "createdAt",
            width: 16,
            format: (val) => new Date(val).toLocaleDateString(),
          },
        ],
        data: reportData?.businesses || [],
      };
    }

    if (activeCategory === "support") {
      return {
        filename: `restroinn-support-tickets-${period}-${dateStamp}`,
        title: "Platform Support & Operations Report",
        subtitle: `Hospitality Helpdesk Tickets Log`,
        dateRange: periodName,
        columns: [
          { header: "Ticket #", key: "ticketNumber", width: 16 },
          { header: "Client Business", key: "businessName", width: 22 },
          { header: "Subject", key: "subject", width: 30 },
          { header: "Category", key: "category", width: 16 },
          { header: "Priority", key: "priority", width: 12 },
          { header: "Status", key: "status", width: 14 },
          {
            header: "Created Date",
            key: "createdAt",
            width: 16,
            format: (val) => new Date(val).toLocaleDateString(),
          },
        ],
        data: reportData?.tickets || [],
      };
    }

    // Default: Audit Logs
    return {
      filename: `restroinn-audit-trail-${period}-${dateStamp}`,
      title: "Platform Administrative Audit Trail",
      subtitle: `Immutable Super Admin Action Log`,
      dateRange: periodName,
      columns: [
        { header: "Admin Actor", key: "actor", width: 20 },
        { header: "Role", key: "role", width: 14 },
        { header: "Action Taken", key: "action", width: 24 },
        { header: "Target Scope", key: "targetType", width: 14 },
        { header: "Business Context", key: "businessName", width: 20 },
        { header: "Mandatory Audit Reason", key: "reason", width: 34 },
        {
          header: "Timestamp",
          key: "createdAt",
          width: 20,
          format: (val) => new Date(val).toLocaleString(),
        },
      ],
      data: reportData?.auditLogs || [],
    };
  };

  // Filtered lists for table search
  const filteredInvoices = useMemo(() => {
    if (!reportData?.invoices) return [];
    if (!searchQuery.trim()) return reportData.invoices;
    const q = searchQuery.toLowerCase();
    return reportData.invoices.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.businessName.toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const filteredBusinesses = useMemo(() => {
    if (!reportData?.businesses) return [];
    if (!searchQuery.trim()) return reportData.businesses;
    const q = searchQuery.toLowerCase();
    return reportData.businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const filteredTickets = useMemo(() => {
    if (!reportData?.tickets) return [];
    if (!searchQuery.trim()) return reportData.tickets;
    const q = searchQuery.toLowerCase();
    return reportData.tickets.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.businessName.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const filteredAudit = useMemo(() => {
    if (!reportData?.auditLogs) return [];
    if (!searchQuery.trim()) return reportData.auditLogs;
    const q = searchQuery.toLowerCase();
    return reportData.auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* Top Header & Breadcrumb - Zero redundant sentences */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Reports & exports
          </div>
          <h1 className="text-base font-bold text-[#292320] tracking-tight">
            Reports & exports
          </h1>
        </div>

        {/* Right Corner Controls: Segmented Period Filter + Refresh + Export */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center border border-[#D8CEC1] rounded-md bg-[#FFFCF7] p-0.5 text-xs font-semibold">
            {[
              { id: "day", label: "Today" },
              { id: "week", label: "7 Days" },
              { id: "month", label: "30 Days" },
              { id: "year", label: "1 Year" },
              { id: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as TimePeriod)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  period === p.id
                    ? "bg-[#6B2837] text-white"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh statistics"
          >
            <RotateCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <ExportDropdown
            getExportOptions={getDynamicExportOptions}
            buttonText="Export dataset"
            variant="primary"
          />
        </div>
      </div>

      {/* Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        {/* Cell 1: Collected Revenue */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Collected revenue</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#6B2837] tabular-nums font-mono">
              NPR {(reportData?.metrics.revenue.collectedNpr ?? 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-[#71675E] tabular-nums font-mono">
              ({reportData?.metrics.revenue.paidCount ?? 0} settled)
            </span>
          </div>
        </div>

        {/* Cell 2: Receivables / Outstanding */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Pending receivables</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#9C3232] tabular-nums font-mono">
              NPR {(reportData?.metrics.revenue.pendingNpr ?? 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-[#71675E] tabular-nums font-mono">
              ({reportData?.metrics.revenue.pendingCount ?? 0} due)
            </span>
          </div>
        </div>

        {/* Cell 3: Business Properties */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Registered properties</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">
              {reportData?.metrics.businesses.totalAllTime ?? 0}
            </span>
            <span className="text-[10px] text-[#71675E]">
              {reportData?.metrics.businesses.restaurant ?? 0} dine • {reportData?.metrics.businesses.hotel ?? 0} stay • {reportData?.metrics.businesses.hybrid ?? 0} both
            </span>
          </div>
        </div>

        {/* Cell 4: Support & Operations */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Support requests</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">
              {reportData?.metrics.support.ticketsInPeriod ?? 0}
            </span>
            <span className="text-[10px] text-[#71675E]">
              {reportData?.metrics.support.resolvedInPeriod ?? 0} resolved • {reportData?.metrics.support.openInPeriod ?? 0} active
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-2xs">
        {/* Unified Category Tabs & Filter Header */}
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#FFFCF7]">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveCategory("revenue");
                setSearchQuery("");
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === "revenue"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <CreditCard className="w-3 h-3" />
              <span>Invoices</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({reportData?.invoices.length ?? 0})</span>
            </button>

            <button
              onClick={() => {
                setActiveCategory("businesses");
                setSearchQuery("");
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === "businesses"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>Properties</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({reportData?.businesses.length ?? 0})</span>
            </button>

            <button
              onClick={() => {
                setActiveCategory("support");
                setSearchQuery("");
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === "support"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <LifeBuoy className="w-3 h-3" />
              <span>Support</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({reportData?.tickets.length ?? 0})</span>
            </button>

            <button
              onClick={() => {
                setActiveCategory("audit");
                setSearchQuery("");
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === "audit"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <History className="w-3 h-3" />
              <span>Audit log</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({reportData?.auditLogs.length ?? 0})</span>
            </button>
          </div>

          {/* Search Box with instant clear button */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71675E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter current view..."
              className="w-full text-xs pl-7 pr-7 py-1 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Revenue Table */}
        {activeCategory === "revenue" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Invoice #</th>
                  <th className="py-1.5 px-3">Client business</th>
                  <th className="py-1.5 px-3">Plan & package</th>
                  <th className="py-1.5 px-3">Amount (NPR)</th>
                  <th className="py-1.5 px-3">Payment status</th>
                  <th className="py-1.5 px-3">Payment method</th>
                  <th className="py-1.5 px-3">Due date</th>
                  <th className="py-1.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
                      <div>Loading revenue report...</div>
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      No invoices recorded for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-1.5 px-3 font-mono font-medium text-[#292320]">{inv.invoiceNumber}</td>
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">{inv.businessName}</td>
                      <td className="py-1.5 px-3 text-[#71675E]">
                        <span className="font-semibold text-[#292320]">{inv.plan}</span> • {inv.packageType}
                      </td>
                      <td className="py-1.5 px-3 font-mono tabular-nums text-[#292320] font-semibold">
                        NPR {inv.amount.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            inv.status === "PAID"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : inv.status === "OVERDUE"
                              ? "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                              : "bg-[#FEF08A]/40 text-[#854D0E] border border-[#FEF08A]"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-[#71675E]">{inv.paymentMethod.replace("_", " ")}</td>
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <Link
                          href="/dashboard/super-admin/revenue"
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Businesses Table */}
        {activeCategory === "businesses" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Business name</th>
                  <th className="py-1.5 px-3">Workspace slug</th>
                  <th className="py-1.5 px-3">Package type</th>
                  <th className="py-1.5 px-3">Account status</th>
                  <th className="py-1.5 px-3">Owner contact</th>
                  <th className="py-1.5 px-3">Plan</th>
                  <th className="py-1.5 px-3">Branches</th>
                  <th className="py-1.5 px-3">Joined date</th>
                  <th className="py-1.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#71675E]">
                      <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
                      <div>Loading business properties directory...</div>
                    </td>
                  </tr>
                ) : filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#71675E]">
                      No businesses found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">{b.name}</td>
                      <td className="py-1.5 px-3 font-mono text-[#71675E]">{b.slug}.restroinn.com</td>
                      <td className="py-1.5 px-3">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]">
                          {b.packageType}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            b.status === "ACTIVE"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-[#71675E]">
                        <span className="font-medium text-[#292320]">{b.ownerName}</span>
                        <span className="text-[10px] text-[#71675E] ml-1.5">({b.ownerEmail})</span>
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">{b.plan}</td>
                      <td className="py-1.5 px-3 tabular-nums font-mono text-[#71675E]">{b.branchCount}</td>
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <Link
                          href={`/dashboard/super-admin/businesses/${b.id}`}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors"
                        >
                          <span>Profile</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Support Tickets Table */}
        {activeCategory === "support" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Ticket #</th>
                  <th className="py-1.5 px-3">Property</th>
                  <th className="py-1.5 px-3">Subject</th>
                  <th className="py-1.5 px-3">Category</th>
                  <th className="py-1.5 px-3">Priority</th>
                  <th className="py-1.5 px-3">Status</th>
                  <th className="py-1.5 px-3">Submitted</th>
                  <th className="py-1.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
                      <div>Loading support requests...</div>
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      No support tickets logged in this period.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-1.5 px-3 font-mono font-medium text-[#6B2837]">{t.ticketNumber}</td>
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">{t.businessName}</td>
                      <td className="py-1.5 px-3 text-[#292320]">{t.subject}</td>
                      <td className="py-1.5 px-3 text-[#71675E]">{t.category.replace("_", " ")}</td>
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">{t.priority}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            t.status === "RESOLVED" || t.status === "CLOSED"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : t.status === "IN_PROGRESS"
                              ? "bg-[#FEF08A]/40 text-[#854D0E] border border-[#FEF08A]"
                              : "bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <Link
                          href="/dashboard/super-admin/support"
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors"
                        >
                          <span>Resolve</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Audit Logs Table */}
        {activeCategory === "audit" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Timestamp</th>
                  <th className="py-1.5 px-3">Admin actor</th>
                  <th className="py-1.5 px-3">Action</th>
                  <th className="py-1.5 px-3">Target scope</th>
                  <th className="py-1.5 px-3">Context property</th>
                  <th className="py-1.5 px-3">Mandatory audit reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#71675E]">
                      <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
                      <div>Loading immutable audit trail...</div>
                    </td>
                  </tr>
                ) : filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#71675E]">
                      No audit logs found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((l) => (
                    <tr key={l.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-[#71675E] whitespace-nowrap tabular-nums text-[11px]">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-[#292320]">
                        {l.actor} <span className="text-[10px] text-[#71675E]">({l.role})</span>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-[#6B2837] font-semibold">{l.action}</td>
                      <td className="py-1.5 px-3 text-[#71675E]">{l.targetType}</td>
                      <td className="py-1.5 px-3 font-medium text-[#292320]">{l.businessName}</td>
                      <td className="py-1.5 px-3 text-[#292320] leading-relaxed max-w-sm">{l.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
