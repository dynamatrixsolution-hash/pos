"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  ShieldCheck,
  ChevronRight,
  X,
  MessageSquare,
  Lock,
} from "lucide-react";

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

  // Selected ticket / Resolution drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newStatus, setNewStatus] = useState("IN_PROGRESS");
  const [assignedAdmin, setAssignedAdmin] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadTickets();
    }
  }, [status, session, router, statusFilter, priorityFilter, categoryFilter]);

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
      }
    } catch (err) {
      console.error("Failed to load support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const openTicketDrawer = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
    setAssignedAdmin(ticket.assignedTo || "superadmin@restroinn.com");
    setResolutionText(ticket.resolution || "");
    setAuditReason("");
    setActionError("");
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!auditReason.trim() || auditReason.trim().length < 5) {
      setActionError("A valid administrative audit reason (min 5 characters) is required");
      return;
    }

    setUpdating(true);
    setActionError("");
    try {
      const res = await fetch("/api/v1/super-admin/support", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTicket.id,
          status: newStatus,
          assignedTo: assignedAdmin.trim() || null,
          resolution: resolutionText.trim() || null,
          reason: auditReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ticket");

      setSelectedTicket(null);
      loadTickets();
    } catch (err: any) {
      setActionError(err.message || "Failed to update ticket");
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#D8CEC1]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#71675E]">Platform Administration</span>
            <span className="text-[#D8CEC1]">•</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#6B2837]">Helpdesk</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#292320] mt-1">Platform Support Tickets</h1>
          <p className="text-sm text-[#71675E] mt-0.5">
            Manage operational escalations, KDS latency reports, and module activation requests from client properties.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTickets}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#71675E]" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="text-xs font-medium text-[#71675E]">Total Requests</div>
          <div className="text-2xl font-bold text-[#292320] mt-1 tabular-nums">{metrics.total}</div>
          <div className="text-xs text-[#71675E] mt-0.5">Lifetime helpdesk tickets</div>
        </div>

        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="text-xs font-medium text-[#71675E]">Awaiting Action (Open)</div>
          <div className="text-2xl font-bold text-[#6B2837] mt-1 tabular-nums">{metrics.open}</div>
          <div className="text-xs text-[#71675E] mt-0.5">Requires support triage</div>
        </div>

        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="text-xs font-medium text-[#71675E]">In Progress</div>
          <div className="text-2xl font-bold text-[#854D0E] mt-1 tabular-nums">{metrics.inProgress}</div>
          <div className="text-xs text-[#71675E] mt-0.5">Actively under investigation</div>
        </div>

        <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
          <div className="text-xs font-medium text-[#71675E]">Urgent / Critical</div>
          <div className="text-2xl font-bold text-[#9C3232] mt-1 tabular-nums">{metrics.urgent}</div>
          <div className="text-xs text-[#71675E] mt-0.5">High priority service tickets</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71675E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket #, property, subject..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E]">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-[#71675E] ml-2">
            <span>Priority:</span>
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
          >
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-[#71675E] ml-2">
            <span>Category:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
          >
            <option value="ALL">All categories</option>
            <option value="TECHNICAL">Technical / Hardware</option>
            <option value="MODULE_ACCESS">Module Access</option>
            <option value="BILLING">Billing & Fiscal</option>
            <option value="GENERAL">General Support</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="p-12 text-center border border-[#D8CEC1] rounded-lg bg-[#FFFCF7]">
          <div className="inline-block w-6 h-6 border-2 border-[#6B2837] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-[#71675E] mt-3">Loading support queue...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center border border-[#D8CEC1] rounded-lg bg-[#FFFCF7]">
          <LifeBuoy className="w-8 h-8 text-[#71675E] mx-auto stroke-1" />
          <h3 className="text-sm font-semibold text-[#292320] mt-3">No support tickets found</h3>
          <p className="text-xs text-[#71675E] max-w-sm mx-auto mt-1">
            All client requests are resolved or no tickets match the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isUrgent = ticket.priority === "URGENT" || ticket.priority === "HIGH";
            const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

            return (
              <div
                key={ticket.id}
                onClick={() => openTicketDrawer(ticket)}
                className="p-5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:border-[#6B2837] transition-all cursor-pointer flex flex-col md:flex-row items-start justify-between gap-4"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#6B2837] bg-[#F7F3EC] px-2 py-0.5 rounded border border-[#D8CEC1]">
                      {ticket.ticketNumber}
                    </span>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
                        isUrgent
                          ? "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                          : "bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1]"
                      }`}
                    >
                      {ticket.priority} PRIORITY
                    </span>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        isResolved
                          ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                          : ticket.status === "IN_PROGRESS"
                          ? "bg-[#FEF08A]/30 text-[#854D0E] border border-[#FEF08A]"
                          : "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
                      }`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>

                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] font-medium">
                      {ticket.category.replace("_", " ")}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#292320]">{ticket.subject}</h3>
                    <p className="text-xs text-[#71675E] leading-relaxed mt-1 line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>

                  {ticket.resolution && (
                    <div className="p-2.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-xs text-[#03543F]">
                      <span className="font-bold">Resolution: </span>
                      {ticket.resolution}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#71675E] pt-1">
                    <span className="flex items-center gap-1 font-semibold text-[#292320]">
                      <Building2 className="w-3 h-3 text-[#6B2837]" />
                      {ticket.business?.name || "Unknown Business"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Submitted {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                    {ticket.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Assigned: {ticket.assignedTo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[#D8CEC1]">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B2837] hover:underline">
                    View & Resolve
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Details & Resolution Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] p-6 shadow-xl space-y-5 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CEC1]">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-[#6B2837]" />
                <h2 className="text-base font-bold text-[#292320]">
                  Ticket #{selectedTicket.ticketNumber} Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 text-xs text-[#9C3232] bg-[#FDE8E8] border border-[#F8B4B4] rounded-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Ticket Info Box */}
            <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#292320] text-sm">{selectedTicket.subject}</span>
                <span className="font-mono text-[11px] text-[#71675E]">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-[#292320] leading-relaxed whitespace-pre-line">{selectedTicket.description}</p>
              <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-[#71675E] border-t border-[#D8CEC1]">
                <span>Property: <strong className="text-[#292320]">{selectedTicket.business?.name}</strong></span>
                <span>Type: {selectedTicket.business?.packageType}</span>
                <span>Category: {selectedTicket.category}</span>
                <span>Priority: {selectedTicket.priority}</span>
              </div>
            </div>

            {/* Resolution Form */}
            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#292320] mb-1">Ticket Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="OPEN">OPEN (Unassigned)</option>
                    <option value="IN_PROGRESS">IN PROGRESS (Triage)</option>
                    <option value="RESOLVED">RESOLVED (Solution Provided)</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292320] mb-1">Assigned Support Staff</label>
                  <input
                    type="text"
                    value={assignedAdmin}
                    onChange={(e) => setAssignedAdmin(e.target.value)}
                    placeholder="e.g. superadmin@restroinn.com"
                    className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292320] mb-1">
                  Resolution Notes / Client Reply
                </label>
                <textarea
                  rows={3}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Explain troubleshooting steps taken, settings updated, or answer provided to client..."
                  className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              {/* Mandatory Audit Reason */}
              <div className="pt-2 border-t border-[#D8CEC1]">
                <label className="block text-xs font-semibold text-[#6B2837] mb-1">
                  Mandatory Administrative Audit Reason *
                </label>
                <input
                  type="text"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. Verified KDS heartbeat audio; issue solved by disabling tablet sleep mode"
                  className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save Ticket Updates"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
