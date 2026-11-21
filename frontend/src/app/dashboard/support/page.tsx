"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LifeBuoy,
  MessageSquare,
  Plus,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "@/components/toast";

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  resolution?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  user?: { name: string; role: string } | null;
}

interface DirectMessage {
  id: string;
  content: string;
  isMine: boolean;
  isRead: boolean;
  createdAt: string;
}

export default function TenantSupportPage() {
  const [activeTab, setActiveTab] = useState<"tickets" | "messages">("tickets");

  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Direct Messages state
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [adminName, setAdminName] = useState("RestroInn Platform Support");
  const [isBlocked, setIsBlocked] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch("/api/v1/support/tickets", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
    } catch {
      toast.error("Failed to load support tickets.");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const res = await fetch("/api/v1/support/messages", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        if (data.admin?.name) setAdminName(data.admin.name);
        setIsBlocked(Boolean(data.isBlocked));
      }
    } catch {
      if (!silent) toast.error("Failed to load direct messages.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    loadMessages();
  }, [loadTickets, loadMessages]);

  useEffect(() => {
    if (activeTab !== "messages") return;
    const timer = setInterval(() => loadMessages(true), 15000);
    return () => clearInterval(timer);
  }, [activeTab, loadMessages]);

  useEffect(() => {
    if (activeTab === "messages") {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3 || description.trim().length < 10) {
      toast.warning("Please enter a clear subject and issue description.");
      return;
    }

    setSubmittingTicket(true);
    try {
      const res = await fetch("/api/v1/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          description: description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit ticket.");

      toast.success(data.message || "Support ticket submitted.");
      setTicketModalOpen(false);
      setSubject("");
      setDescription("");
      setCategory("TECHNICAL");
      setPriority("MEDIUM");
      await loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit ticket.");
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sendingMsg || isBlocked) return;

    setSendingMsg(true);
    try {
      const res = await fetch("/api/v1/support/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send message.");

      setReplyText("");
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        await loadMessages(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setSendingMsg(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "RESOLVED" || s === "CLOSED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-[#C3DED0] bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-semibold text-[#28634B]">
          <CheckCircle2 className="h-3 w-3" /> {s}
        </span>
      );
    }
    if (s === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-[#B8D2E6] bg-[#EDF4F9] px-2 py-0.5 text-[10px] font-semibold text-[#315F85]">
          <Clock className="h-3 w-3" /> IN PROGRESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] px-2 py-0.5 text-[10px] font-semibold text-[#946000]">
        <AlertTriangle className="h-3 w-3" /> {s}
      </span>
    );
  };

  return (
    <div className="space-y-5 text-[#292320]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Support &amp; Messages</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Report system issues, track ticket resolutions, and message RestroInn Platform Support directly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (activeTab === "tickets" ? loadTickets() : loadMessages())}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] px-3 text-xs font-semibold text-[#292320] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingTickets || loadingMessages ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setTicketModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] px-3.5 text-xs font-semibold text-[#FFFCF7] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Report Issue
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("tickets")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-colors cursor-pointer ${
            activeTab === "tickets" ? "bg-[#FFFCF7] text-[#292320]" : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          Support Tickets ({tickets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("messages")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-colors cursor-pointer ${
            activeTab === "messages" ? "bg-[#FFFCF7] text-[#292320]" : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Direct Messages ({messages.length})
        </button>
      </div>

      {/* TAB 1: SUPPORT TICKETS */}
      {activeTab === "tickets" && (
        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
          {loadingTickets ? (
            <div className="p-5 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-md bg-[#EEE7DD] animate-pulse" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <p className="text-sm font-bold text-[#292320]">No support tickets yet</p>
              <p className="text-xs text-[#71675E]">
                Facing an issue with POS, printers, billing, or hotel rooms? Click &ldquo;Report Issue&rdquo; to notify RestroInn Support.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D8CEC1]/70">
              {tickets.map((t) => (
                <div key={t.id} className="p-4 space-y-2 hover:bg-[#F7F3EC]/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#6B2837]">{t.ticketNumber}</span>
                      <span className="text-sm font-bold text-[#292320]">{t.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-[#D8CEC1] bg-[#EEE7DD] px-2 py-0.5 text-[10px] font-semibold text-[#71675E]">
                        {t.category}
                      </span>
                      {renderStatusBadge(t.status)}
                    </div>
                  </div>

                  <p className="text-xs text-[#71675E]">{t.description}</p>

                  {t.resolution && (
                    <div className="rounded-md border border-[#C3DED0] bg-[#EAF3EE] p-3 text-xs text-[#28634B]">
                      <span className="font-bold">Platform Support Reply: </span>
                      {t.resolution}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#71675E] tabular-nums">
                    <span>Priority: <strong className="text-[#292320]">{t.priority}</strong></span>
                    {t.user?.name && <span>Reported by: {t.user.name}</span>}
                    <span>Submitted: {new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIRECT MESSAGES */}
      {activeTab === "messages" && (
        <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col h-[520px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#D8CEC1] bg-[#EEE7DD]/60 px-4 py-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">{adminName}</h2>
              <p className="text-[11px] text-[#71675E]">Direct messages from RestroInn Super Admin appear here.</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F3EC]/50">
            {loadingMessages ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 w-2/3 rounded-lg bg-[#EEE7DD] animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[#71675E] space-y-1">
                <p className="font-semibold text-[#292320]">No messages yet</p>
                <p>Send a message below to start a direct conversation with Platform Support.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-lg px-3.5 py-2.5 text-xs space-y-1 border ${
                      m.isMine
                        ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                        : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <div className={`text-[10px] tabular-nums ${m.isMine ? "text-[#FFFCF7]/75 text-right" : "text-[#71675E]"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-[#D8CEC1] bg-[#FFFCF7] p-3 flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              disabled={isBlocked || sendingMsg}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isBlocked
                  ? "Direct chat is restricted for this account. Use Support Tickets instead."
                  : "Write a message to RestroInn Platform Support..."
              }
              className="flex-1 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs text-[#292320] focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isBlocked || sendingMsg || !replyText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] px-4 py-2 text-xs font-semibold text-[#FFFCF7] cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          </form>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#292320]">Report an Issue</h2>
                <p className="text-[11px] text-[#71675E]">Our platform team will review and respond promptly.</p>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                className="p-1 rounded-md text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-[#292320]">Subject *</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Thermal printer not printing KOT"
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[#71675E]">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-2.5 py-2 text-xs focus:border-[#6B2837] focus:outline-none"
                  >
                    <option value="TECHNICAL">Technical / Bug</option>
                    <option value="BILLING">Billing &amp; Plan</option>
                    <option value="HARDWARE">Printer / Hardware</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-[#71675E]">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-2.5 py-2 text-xs focus:border-[#6B2837] focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#292320]">Issue Description *</label>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, which screen you were on, and any error message..."
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#D8CEC1] pt-3">
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-4 py-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingTicket ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
