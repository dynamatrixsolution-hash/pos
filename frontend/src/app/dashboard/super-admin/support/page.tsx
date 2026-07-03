"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Ticket,
  AlertTriangle,
  Plus,
  CheckCircle,
  Send,
  MessageSquare,
  Building,
  User,
  Clock,
  Volume2,
} from "lucide-react";

interface TicketItem {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  replies: string[];
}

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  target: string;
  createdAt: string;
  active: boolean;
}

export default function SupportCenterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"tickets" | "announcements">("tickets");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Ticket Response states
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [replyText, setReplyText] = useState("");

  // Broadcast Notice Announcement Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annTarget, setAnnTarget] = useState("ALL_MERCHANTS");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadSupportData();
    }
  }, [status, session, router]);

  const loadSupportData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/support");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error("Load support center logs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch("/api/v1/super-admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REPLY_TICKET",
          payload: { ticketId: selectedTicket.id, replyText },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit response");
      }

      setActionSuccess("Response logged and ticket resolved");
      setReplyText("");
      setSelectedTicket(null);
      loadSupportData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch("/api/v1/super-admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ANNOUNCEMENT",
          payload: { title: annTitle, message: annMessage, target: annTarget },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to broadcast announcement");
      }

      setActionSuccess("Global announcement published successfully");
      setAnnTitle("");
      setAnnMessage("");
      setIsFormOpen(false);
      loadSupportData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Syncing support dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HelpCircle className="h-5.5 w-5.5 text-blue-600" /> Platform Support Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage incoming business help tickets, reply to complaints, and broadcast system notices.
          </p>
        </div>
      </div>

      {/* 2. Messages */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-bold border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 text-red-650 text-xs rounded-xl font-bold border border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* 3. Tab selection */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "tickets" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Support Tickets ({tickets.filter((t) => t.status === "OPEN").length} Open)
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "announcements" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Announcements Broadcaster
        </button>
      </div>

      {/* Tab Contents: TICKETS BOARD */}
      {activeTab === "tickets" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets list */}
          <div className="lg:col-span-2 space-y-4">
            {tickets.length === 0 ? (
              <div className="bg-white border border-slate-200/80 p-8 text-center text-xs text-slate-450 rounded-2xl">No support tickets registered.</div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`bg-white border p-5 rounded-2xl cursor-pointer hover:shadow-xs transition-shadow ${
                    selectedTicket?.id === t.id
                      ? "border-blue-500 shadow-sm"
                      : t.status === "RESOLVED"
                      ? "border-slate-150 opacity-70"
                      : "border-slate-200/80"
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        t.priority === "HIGH"
                          ? "bg-red-50 text-red-500"
                          : t.priority === "MEDIUM"
                          ? "bg-amber-50 text-amber-500"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        {t.priority} PRIORITY
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 mt-2">{t.title}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                      t.status === "RESOLVED"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-red-50 text-red-500 border-red-100 animate-pulse"
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{t.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-slate-350" /> {t.businessName}
                    </span>
                    <span className="flex items-center gap-1 border-l border-slate-200 pl-3">
                      <User className="w-3.5 h-3.5 text-slate-350" /> {t.ownerName}
                    </span>
                    <span className="flex items-center gap-1 border-l border-slate-200 pl-3">
                      <Clock className="w-3.5 h-3.5 text-slate-350" /> {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Response Panel */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 h-fit">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-1.5">
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" /> Resolution Desk
            </h3>

            {selectedTicket ? (
              <div className="space-y-4">
                <div className="space-y-1.5 text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Inquiring Merchant:</span>
                  <div className="font-bold text-slate-700">{selectedTicket.businessName}</div>
                  <div className="text-slate-450">{selectedTicket.email}</div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-xs space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Issue Description:</span>
                  <p className="text-slate-600 leading-relaxed font-semibold">{selectedTicket.description}</p>
                </div>

                {selectedTicket.replies.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Past Responses:</span>
                    {selectedTicket.replies.map((reply, idx) => (
                      <div key={idx} className="bg-blue-50/40 border border-blue-100 p-3 rounded-xl text-xs text-blue-800">
                        {reply}
                      </div>
                    ))}
                  </div>
                )}

                {selectedTicket.status === "OPEN" && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-450 uppercase font-bold">Write response & resolve ticket</label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      placeholder="Enter resolving response logs..."
                      className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-semibold"
                    />
                    <button
                      onClick={handleSendReply}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Response
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-450 italic">
                Select an open support ticket on the left panel to review logs or reply.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Contents: ANNOUNCEMENTS BULLETIN */}
      {activeTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Announcements list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl flex justify-between items-center">
              <span className="text-xs text-slate-450 font-medium">Broadcast notices shown on merchant client consoles.</span>
              <button
                onClick={() => setIsFormOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Create Broadcast
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="bg-white border border-slate-200/80 p-8 text-center text-xs text-slate-450 rounded-2xl">No bulletins broadcasted.</div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-650 text-[8px] font-black uppercase tracking-wider">
                      Target: {ann.target}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{new Date(ann.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Volume2 className="h-4.5 w-4.5 text-blue-650 shrink-0" /> {ann.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">{ann.message}</p>
                </div>
              ))
            )}
          </div>

          {/* New Broadcast Notice Form */}
          {isFormOpen && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 h-fit">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
                Publish Broadcaster bulletin
              </h3>
              <form onSubmit={handleAddAnnouncement} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase font-bold">Notice Title</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Platform Upgrades Schedule"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase font-bold">Target Industry Audience</label>
                  <select
                    value={annTarget}
                    onChange={(e) => setAnnTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL_MERCHANTS">All Merchants & Partners</option>
                    <option value="PHARMACY_SECTOR">Pharmacy sector only</option>
                    <option value="RETAIL_SECTOR">Retail shops only</option>
                    <option value="RESTAURANT_SECTOR">Restaurants only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase font-bold">Notice Message</label>
                  <textarea
                    value={annMessage}
                    onChange={(e) => setAnnMessage(e.target.value)}
                    rows={4}
                    placeholder="Write announcement body..."
                    className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-md cursor-pointer uppercase tracking-wider"
                  >
                    Broadcast Bulletin
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
