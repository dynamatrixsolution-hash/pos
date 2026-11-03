"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LifeBuoy,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Building2,
  User,
  X,
  Send,
  MessageSquare,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "@/components/toast";

interface ConversationMessage {
  id: string;
  senderName: string;
  role: "CLIENT" | "SUPER_ADMIN" | string;
  message: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  businessId: string;
  business: {
    id: string;
    name: string;
    slug: string;
    packageType: string;
    email?: string;
    phone?: string;
  };
  userId?: string | null;
  user?: { id: string; name: string; email: string } | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  assignedTo?: string | null;
  resolution?: string | null;
  conversation?: ConversationMessage[];
  resolvedAt?: string | null;
  createdAt: string;
}

export default function SupportTicketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Selected ticket / Conversation Drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newStatus, setNewStatus] = useState("IN_PROGRESS");
  const [assignedAdmin, setAssignedAdmin] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadTickets();
    }
  }, [status, session, router, statusFilter, priorityFilter, categoryFilter]);

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicket?.conversation]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (priorityFilter !== "ALL") q.set("priority", priorityFilter);
      if (categoryFilter !== "ALL") q.set("category", categoryFilter);

      const res = await fetch(`/api/v1/super-admin/support?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        toast.error("Failed to load support tickets");
      }
    } catch (err: any) {
      console.error("Failed to load support tickets:", err);
      toast.error(err.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  const openTicketDrawer = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
    setAssignedAdmin(ticket.assignedTo || "superadmin@restroinn.com");
    setReplyMessage("");
    setAuditReason("");
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!replyMessage.trim()) {
      toast.error("Please enter a reply message.");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch("/api/v1/super-admin/support", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTicket.id,
          status: newStatus,
          assignedTo: assignedAdmin.trim() || undefined,
          replyMessage: replyMessage.trim(),
          reason: auditReason.trim() || `Replied to ticket #${selectedTicket.ticketNumber}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      toast.success("Reply dispatched to ticket conversation.");
      setReplyMessage("");
      if (data.ticket) {
        setSelectedTicket(data.ticket);
      }
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (targetStatus: string) => {
    if (!selectedTicket) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/v1/super-admin/support", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTicket.id,
          status: targetStatus,
          assignedTo: assignedAdmin.trim() || undefined,
          reason: `Status updated to ${targetStatus}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(`Ticket status updated to ${targetStatus}`);
      setNewStatus(targetStatus);
      if (data.ticket) {
        setSelectedTicket(data.ticket);
      }
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.ticketNumber.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.business?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* 1. Header with Breadcrumb & Actions */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Support tickets
          </div>
          <h1 className="text-base font-bold text-[#292320] tracking-tight">
            Support tickets
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={loadTickets}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh queue"
          >
            <RotateCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Total requests</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{metrics.total}</span>
            <span className="text-[10px] text-[#71675E]">Lifetime</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Awaiting action</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#6B2837] tabular-nums font-mono">{metrics.open}</span>
            <span className="text-[10px] text-[#6B2837]">Requires triage</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">In progress</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#854D0E] tabular-nums font-mono">{metrics.inProgress}</span>
            <span className="text-[10px] text-[#854D0E]">Under investigation</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Urgent / Critical</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#9C3232] tabular-nums font-mono">{metrics.urgent}</span>
            <span className="text-[10px] text-[#9C3232]">High priority</span>
          </div>
        </div>
      </div>

      {/* 3. Main Ticket Directory Card */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
        {/* Unified Category Tabs & Filter Toolbar */}
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#FFFCF7]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            {[
              { id: "ALL", label: "All requests", count: metrics.total },
              { id: "OPEN", label: "Open", count: metrics.open },
              { id: "IN_PROGRESS", label: "In progress", count: metrics.inProgress },
              { id: "RESOLVED", label: "Resolved", count: metrics.resolved },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-[#6B2837] text-white"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-80 tabular-nums font-mono">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Search & Filter Dropdowns */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71675E]" />
              <input
                type="text"
                placeholder="Search ticket #, property, issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-7 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
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

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="TECHNICAL">Technical</option>
              <option value="MODULE_ACCESS">Module Access</option>
              <option value="BILLING">Billing</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
        </div>

        {/* High-density Tickets Table */}
        {loading ? (
          <div className="py-12 text-center text-[#71675E]">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
            <div className="text-xs">Loading support tickets...</div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-12 text-center text-[#71675E]">
            <LifeBuoy className="w-6 h-6 mx-auto mb-1 text-[#71675E]/60 stroke-1" />
            <p className="text-xs font-semibold text-[#292320]">No support tickets found</p>
            <p className="text-[11px] text-[#71675E] mt-0.5">
              {searchQuery.trim()
                ? "No tickets match your search criteria."
                : "All client requests are resolved."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Ticket #</th>
                  <th className="py-1.5 px-3">Subject & issue</th>
                  <th className="py-1.5 px-3">Property</th>
                  <th className="py-1.5 px-3">Category</th>
                  <th className="py-1.5 px-3">Priority</th>
                  <th className="py-1.5 px-3">Status</th>
                  <th className="py-1.5 px-3">Submitted</th>
                  <th className="py-1.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {filteredTickets.map((t) => {
                  const isUrgent = t.priority === "URGENT" || t.priority === "HIGH";
                  const isResolved = t.status === "RESOLVED" || t.status === "CLOSED";

                  return (
                    <tr
                      key={t.id}
                      onClick={() => openTicketDrawer(t)}
                      className="hover:bg-[#F7F3EC]/50 transition-colors cursor-pointer"
                    >
                      <td className="py-1.5 px-3 font-mono font-medium text-[#6B2837] whitespace-nowrap">
                        {t.ticketNumber}
                      </td>

                      <td className="py-1.5 px-3 max-w-sm">
                        <div className="font-semibold text-xs text-[#292320] truncate">
                          {t.subject}
                        </div>
                        <div className="text-[11px] text-[#71675E] line-clamp-1">
                          {t.description}
                        </div>
                      </td>

                      <td className="py-1.5 px-3 text-[#292320] font-medium whitespace-nowrap">
                        {t.business?.name || "Unknown"}
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]">
                          {t.category.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-wide uppercase ${
                            isUrgent
                              ? "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                              : "bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1]"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            isResolved
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : t.status === "IN_PROGRESS"
                              ? "bg-[#FEF08A]/40 text-[#854D0E] border border-[#FEF08A]"
                              : "bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono text-[11px] whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString("en-US", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>

                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTicketDrawer(t);
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                        >
                          <span>Conversation</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
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

      {/* 4. Ticket Conversation & Resolution Slide-Over Drawer (Right Side) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedTicket(null)}
          />

          {/* Right-side sliding panel taking big space of screen */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] md:w-[720px] lg:w-[860px] xl:w-[940px] max-w-[95vw] bg-[#FFFCF7] border-l border-[#D8CEC1] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 text-[#292320]">
            {/* Drawer Header */}
            <div className="py-2.5 px-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs font-bold text-[#6B2837] bg-[#F7F3EC] px-2 py-0.5 rounded border border-[#D8CEC1] shrink-0">
                  {selectedTicket.ticketNumber}
                </span>
                <h2 className="text-sm font-bold text-[#292320] truncate">
                  {selectedTicket.subject}
                </h2>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {/* Status Switcher */}
                <div className="inline-flex items-center border border-[#D8CEC1] rounded bg-[#F7F3EC] p-0.5">
                  {["OPEN", "IN_PROGRESS", "RESOLVED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        selectedTicket.status === st
                          ? "bg-[#6B2837] text-white shadow-2xs"
                          : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-[#71675E] hover:text-[#292320] p-1.5 rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                  title="Close conversation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Property & Ticket Meta Strip */}
            <div className="py-2 px-4 bg-[#F7F3EC] border-b border-[#D8CEC1] flex flex-wrap items-center justify-between text-xs text-[#71675E] shrink-0 gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 font-semibold text-[#292320]">
                  <Building2 className="w-3.5 h-3.5 text-[#6B2837]" />
                  <span>{selectedTicket.business?.name}</span>
                </span>
                {selectedTicket.business?.email && (
                  <span className="font-mono text-[11px]">({selectedTicket.business.email})</span>
                )}
                <span className="text-[#D8CEC1]">•</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]">
                  {selectedTicket.category.replace("_", " ")}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1]">
                  {selectedTicket.priority} PRIORITY
                </span>
              </div>
              <span className="font-mono text-[11px]">
                Opened {new Date(selectedTicket.createdAt).toLocaleDateString()} {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Conversation Messages Timeline (Scrollable) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-3.5 bg-[#F7F3EC]/30">
              {/* If no conversation array, show initial description */}
              {(!selectedTicket.conversation || selectedTicket.conversation.length === 0) ? (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-[#292320] text-[#FFFCF7] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {selectedTicket.business?.name?.slice(0, 2).toUpperCase() || "CL"}
                  </div>
                  <div className="flex-1 max-w-[85%] bg-[#FFFCF7] border border-[#D8CEC1] p-3 rounded-lg rounded-tl-none text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#292320]">
                        {selectedTicket.user?.name || selectedTicket.business?.name} (Client)
                      </span>
                      <span className="text-[10px] text-[#71675E] font-mono">
                        {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[#292320] leading-relaxed whitespace-pre-line">
                      {selectedTicket.description}
                    </p>
                  </div>
                </div>
              ) : (
                selectedTicket.conversation.map((msg, idx) => {
                  const isAdmin = msg.role === "SUPER_ADMIN";

                  if (isAdmin) {
                    return (
                      <div key={msg.id || idx} className="flex flex-col items-end">
                        <div className="max-w-[85%] md:max-w-[75%] bg-[#6B2837] text-white p-3 rounded-lg rounded-tr-none text-xs leading-relaxed shadow-2xs">
                          <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 mb-1 font-mono">
                            <span className="font-bold">{msg.senderName || "Platform Support"}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="whitespace-pre-line leading-relaxed">{msg.message}</p>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={msg.id || idx} className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#EEE7DD] border border-[#D8CEC1] text-[#292320] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {msg.senderName?.slice(0, 2).toUpperCase() || "CL"}
                        </div>
                        <div className="flex-1 max-w-[85%] md:max-w-[75%] bg-[#FFFCF7] border border-[#D8CEC1] p-3 rounded-lg rounded-tl-none text-xs space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between text-[10px] text-[#71675E] font-mono">
                            <span className="font-semibold text-[#292320]">{msg.senderName} (Client)</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-[#292320] leading-relaxed whitespace-pre-line">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    );
                  }
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply & Resolution Composer Footer */}
            <div className="p-3.5 md:p-4 border-t border-[#D8CEC1] bg-[#FFFCF7] shrink-0 space-y-2.5">
              <form onSubmit={handleSendReply} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#71675E]">
                  <span className="font-semibold text-[#292320]">Reply to client</span>
                  <div className="flex items-center gap-2">
                    <span>Update status on send:</span>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="px-2 py-0.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded font-semibold text-[#292320] focus:outline-none cursor-pointer"
                    >
                      <option value="OPEN">Keep Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Mark Resolved</option>
                      <option value="CLOSED">Mark Closed</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <textarea
                    rows={3}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type official reply or resolution instructions for this property..."
                    className="flex-1 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md p-2.5 text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all resize-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={updating || !replyMessage.trim()}
                    className="px-4 py-2.5 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer shadow-xs h-[72px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send reply</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
