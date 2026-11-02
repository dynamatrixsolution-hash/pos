"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Building2,
  CreditCard,
  LifeBuoy,
  History,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

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
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
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
            format: (val) => new Date(val).toLocaleString(),
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Right Corner Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#D8CEC1]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#71675E]">Platform Administration</span>
            <span className="text-[#D8CEC1]">•</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#6B2837]">Reports & Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#292320] mt-1">Platform Reports Center</h1>
          <p className="text-sm text-[#71675E] mt-0.5">
            Operational summaries, subscription billing metrics, and verified multi-format data exports.
          </p>
        </div>

        {/* Right Side Corner Actions: Period Filters + Export Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Day / Week / Month / Year Segmented Control */}
          <div className="inline-flex items-center p-1 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold">
            {[
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
              { id: "year", label: "Year" },
              { id: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as TimePeriod)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  period === p.id
                    ? "bg-[#6B2837] text-[#FFFCF7] shadow-xs"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadReport}
            className="p-2 text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC] transition-colors cursor-pointer"
            title="Refresh statistics"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Right-Side Corner Export Dropdown (CSV, Excel, PDF, Word) */}
          <ExportDropdown
            getExportOptions={getDynamicExportOptions}
            buttonText="Export Report"
            variant="primary"
          />
        </div>
      </div>

      {/* KPI Cards (Recalculated according to period) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue Collected */}
        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="flex items-center justify-between text-xs font-medium text-[#71675E]">
            <span>Collected Revenue</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#DEF7EC] text-[#03543F] font-semibold">
              {reportData?.metrics.periodLabel || "Period"}
            </span>
          </div>
          <div className="text-2xl font-bold text-[#6B2837] mt-1 tabular-nums">
            NPR {(reportData?.metrics.revenue.collectedNpr ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#71675E] mt-0.5">
            {reportData?.metrics.revenue.paidCount ?? 0} invoices settled
          </div>
        </div>

        {/* Card 2: Receivables / Outstanding */}
        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="flex items-center justify-between text-xs font-medium text-[#71675E]">
            <span>Pending Receivables</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF08A]/40 text-[#854D0E] font-semibold">
              Outstanding
            </span>
          </div>
          <div className="text-2xl font-bold text-[#9C3232] mt-1 tabular-nums">
            NPR {(reportData?.metrics.revenue.pendingNpr ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#71675E] mt-0.5">
            {reportData?.metrics.revenue.pendingCount ?? 0} invoices awaiting payment
          </div>
        </div>

        {/* Card 3: Businesses Growth */}
        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="flex items-center justify-between text-xs font-medium text-[#71675E]">
            <span>Business Properties</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F7F3EC] text-[#71675E] font-semibold">
              Active Portfolio
            </span>
          </div>
          <div className="text-2xl font-bold text-[#292320] mt-1 tabular-nums">
            {reportData?.metrics.businesses.totalAllTime ?? 0}
          </div>
          <div className="text-xs text-[#71675E] mt-0.5">
            {reportData?.metrics.businesses.restaurant ?? 0} Dining • {reportData?.metrics.businesses.hotel ?? 0} Lodging • {reportData?.metrics.businesses.hybrid ?? 0} Hybrid
          </div>
        </div>

        {/* Card 4: Support & Operations */}
        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="flex items-center justify-between text-xs font-medium text-[#71675E]">
            <span>Support Requests</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F7F3EC] text-[#71675E] font-semibold">
              In Period
            </span>
          </div>
          <div className="text-2xl font-bold text-[#292320] mt-1 tabular-nums">
            {reportData?.metrics.support.ticketsInPeriod ?? 0}
          </div>
          <div className="text-xs text-[#71675E] mt-0.5">
            {reportData?.metrics.support.resolvedInPeriod ?? 0} resolved • {reportData?.metrics.support.openInPeriod ?? 0} active
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold">
        <button
          onClick={() => {
            setActiveCategory("revenue");
            setSearchQuery("");
          }}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeCategory === "revenue"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Subscription Billing & Invoices ({reportData?.invoices.length ?? 0})
        </button>

        <button
          onClick={() => {
            setActiveCategory("businesses");
            setSearchQuery("");
          }}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeCategory === "businesses"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Client Properties Directory ({reportData?.businesses.length ?? 0})
        </button>

        <button
          onClick={() => {
            setActiveCategory("support");
            setSearchQuery("");
          }}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeCategory === "support"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          Support Helpdesk Log ({reportData?.tickets.length ?? 0})
        </button>

        <button
          onClick={() => {
            setActiveCategory("audit");
            setSearchQuery("");
          }}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeCategory === "audit"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Administrative Audit Trail ({reportData?.auditLogs.length ?? 0})
        </button>
      </div>

      {/* Search and Table Container */}
      <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-[#D8CEC1] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF7F2]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71675E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter current view..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-[#71675E]">
              Showing {activeCategory === "revenue" ? filteredInvoices.length : activeCategory === "businesses" ? filteredBusinesses.length : activeCategory === "support" ? filteredTickets.length : filteredAudit.length} entries for <strong>{reportData?.metrics.periodLabel}</strong>
            </span>
          </div>
        </div>

        {/* Tab 1: Revenue Table */}
        {activeCategory === "revenue" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Client Business</th>
                  <th className="py-2.5 px-4">Plan & Package</th>
                  <th className="py-2.5 px-4">Amount (NPR)</th>
                  <th className="py-2.5 px-4">Payment Status</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#71675E]">
                      Loading revenue report...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#71675E]">
                      No invoices recorded for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-[#292320]">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">{inv.businessName}</td>
                      <td className="py-2.5 px-4 text-[#71675E]">
                        <span className="font-semibold text-[#292320]">{inv.plan}</span> • {inv.packageType}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[#292320]">
                        NPR {inv.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            inv.status === "PAID"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : inv.status === "OVERDUE"
                              ? "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                              : "bg-[#FEF08A]/30 text-[#854D0E] border border-[#FEF08A]"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#71675E]">{inv.paymentMethod.replace("_", " ")}</td>
                      <td className="py-2.5 px-4 text-[#71675E] tabular-nums">
                        {new Date(inv.dueDate).toLocaleDateString()}
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
                  <th className="py-2.5 px-4">Business Name</th>
                  <th className="py-2.5 px-4">Workspace Slug</th>
                  <th className="py-2.5 px-4">Package Type</th>
                  <th className="py-2.5 px-4">Account Status</th>
                  <th className="py-2.5 px-4">Owner Contact</th>
                  <th className="py-2.5 px-4">Plan</th>
                  <th className="py-2.5 px-4">Branches</th>
                  <th className="py-2.5 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      Loading business properties directory...
                    </td>
                  </tr>
                ) : filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#71675E]">
                      No businesses found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">{b.name}</td>
                      <td className="py-2.5 px-4 font-mono text-[#71675E]">{b.slug}.restroinn.com</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E]">
                          {b.packageType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            b.status === "ACTIVE"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#71675E]">
                        <span className="font-medium text-[#292320] block">{b.ownerName}</span>
                        <span className="text-[11px]">{b.ownerEmail}</span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">{b.plan}</td>
                      <td className="py-2.5 px-4 tabular-nums text-[#71675E]">{b.branchCount}</td>
                      <td className="py-2.5 px-4 text-[#71675E] tabular-nums">
                        {new Date(b.createdAt).toLocaleDateString()}
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
                  <th className="py-2.5 px-4">Ticket #</th>
                  <th className="py-2.5 px-4">Property</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#71675E]">
                      Loading support requests...
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#71675E]">
                      No support tickets logged in this period.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-[#6B2837]">{t.ticketNumber}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">{t.businessName}</td>
                      <td className="py-2.5 px-4 text-[#292320]">{t.subject}</td>
                      <td className="py-2.5 px-4 text-[#71675E]">{t.category.replace("_", " ")}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">{t.priority}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            t.status === "RESOLVED" || t.status === "CLOSED"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : t.status === "IN_PROGRESS"
                              ? "bg-[#FEF08A]/30 text-[#854D0E] border border-[#FEF08A]"
                              : "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#71675E] tabular-nums">
                        {new Date(t.createdAt).toLocaleDateString()}
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
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Admin Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Target Scope</th>
                  <th className="py-2.5 px-4">Context Property</th>
                  <th className="py-2.5 px-4">Mandatory Audit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#71675E]">
                      Loading immutable audit trail...
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
                      <td className="py-2.5 px-4 font-mono text-[#71675E] whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#292320]">
                        {l.actor} <span className="text-[10px] text-[#71675E]">({l.role})</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#6B2837] font-semibold">{l.action}</td>
                      <td className="py-2.5 px-4 text-[#71675E]">{l.targetType}</td>
                      <td className="py-2.5 px-4 font-medium text-[#292320]">{l.businessName}</td>
                      <td className="py-2.5 px-4 text-[#292320] leading-relaxed max-w-sm">{l.reason}</td>
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
