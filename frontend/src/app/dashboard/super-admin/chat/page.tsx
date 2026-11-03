"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Building2,
  Send,
  Ban,
  CheckCheck,
  RotateCw,
  User,
  ShieldAlert,
} from "lucide-react";
import { toast } from "@/components/toast";

interface OwnerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessType: string;
  lastMessage: {
    content: string;
    createdAt: string;
    isMine: boolean;
    isRead: boolean;
  };
  unreadCount: number;
  isBlocked: boolean;
}

interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  isRead: boolean;
  senderName: string;
}

export default function SuperAdminChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [owners, setOwners] = useState<OwnerItem[]>([]);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [blocking, setBlocking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadConversations(undefined, true);
    }
  }, [status, session, router]);

  // Real-time polling every 4 seconds to fetch new messages automatically
  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(() => {
      if (activeOwnerId) {
        pollMessages(activeOwnerId);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [status, activeOwnerId]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isInitialLoad.current ? "auto" : "smooth" });
    if (messages.length > 0) {
      isInitialLoad.current = false;
    }
  }, [messages]);

  const pollMessages = async (ownerId: string) => {
    try {
      const res = await fetch(`/api/v1/super-admin/chat?ownerId=${ownerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch {
      // Background poll silently fails without disrupting user
    }
  };

  const loadConversations = async (targetOwnerId?: string, isInit = false) => {
    if (isInit) setLoading(true);
    try {
      const q = new URLSearchParams();
      const currentSelected = targetOwnerId || activeOwnerId;
      if (currentSelected) q.set("ownerId", currentSelected);
      if (searchQuery.trim()) q.set("search", searchQuery.trim());

      const res = await fetch(`/api/v1/super-admin/chat?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOwners(data.owners || []);

        const nextActiveId = targetOwnerId || data.activeOwnerId || (data.owners?.[0]?.id ?? null);
        setActiveOwnerId(nextActiveId);

        if (data.messages) {
          setMessages(data.messages);
        }
      } else {
        toast.error("Failed to load conversations");
      }
    } catch (err: any) {
      console.error("Failed to load direct messages:", err);
      toast.error(err.message || "Failed to load direct messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOwner = async (ownerId: string) => {
    setActiveOwnerId(ownerId);
    isInitialLoad.current = true;
    try {
      const res = await fetch(`/api/v1/super-admin/chat?ownerId=${ownerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        // Update unread count in local list
        setOwners((prev) =>
          prev.map((o) => (o.id === ownerId ? { ...o, unreadCount: 0 } : o))
        );
      }
    } catch (err) {
      console.error("Failed to load thread messages:", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeOwnerId || sending) return;

    const messageContent = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch("/api/v1/super-admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activeOwnerId,
          content: messageContent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          // Update last message in owner list
          setOwners((prev) =>
            prev.map((o) =>
              o.id === activeOwnerId
                ? {
                    ...o,
                    lastMessage: {
                      content: messageContent,
                      createdAt: new Date().toISOString(),
                      isMine: true,
                      isRead: false,
                    },
                  }
                : o
            )
          );
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to send message");
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message. Please check connection.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!activeOwner || blocking) return;
    setBlocking(true);
    try {
      const res = await fetch("/api/v1/super-admin/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: activeOwner.id,
          action: "TOGGLE_BLOCK",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOwners((prev) =>
          prev.map((o) =>
            o.id === activeOwner.id ? { ...o, isBlocked: data.isBlocked } : o
          )
        );
        toast.success(
          data.isBlocked
            ? `Messaging access suspended for ${activeOwner.name}`
            : `Messaging access restored for ${activeOwner.name}`
        );
      } else {
        toast.error("Failed to update status");
      }
    } catch (err: any) {
      console.error("Failed to toggle block status:", err);
      toast.error("Network error updating status");
    } finally {
      setBlocking(false);
    }
  };

  const activeOwner = owners.find((o) => o.id === activeOwnerId);

  // Format timestamp helper
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Avatar initials helper
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Filter owners by search query
  const filteredOwners = owners.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.businessName.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex flex-col overflow-hidden text-[#292320] space-y-1.5">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Direct messages
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#292320] tracking-tight">
              Direct messages
            </h1>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1] tabular-nums">
              {owners.length} registered {owners.length === 1 ? "tenant" : "tenants"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadConversations(activeOwnerId || undefined)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh conversations"
          >
            <RotateCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Split Box (100% Height, Both Panes Scroll Independently) */}
      <div className="flex-1 min-h-0 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-2xs flex flex-col md:flex-row overflow-hidden">
        {/* ======================================================== */}
        {/* LEFT PANE: Property Owners List (Independent Scroll)      */}
        {/* ======================================================== */}
        <div className="w-full md:w-80 lg:w-84 border-r border-[#D8CEC1] flex flex-col h-full bg-[#FFFCF7] shrink-0">
          {/* Pinned Search Input */}
          <div className="p-2 border-b border-[#D8CEC1] bg-[#FFFCF7] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71675E]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search property or administrator..."
                className="w-full pl-7 pr-2.5 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
              />
            </div>
          </div>

          {/* Contact Items Container (Scrolls Independently) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#D8CEC1]/60">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#71675E]">
                <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1.5"></div>
                <div>Loading property owners...</div>
              </div>
            ) : filteredOwners.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#71675E]">
                <User className="w-5 h-5 mx-auto mb-1.5 text-[#71675E]/60" />
                <div className="font-semibold text-[#292320]">No owners found</div>
              </div>
            ) : (
              filteredOwners.map((owner) => {
                const isSelected = owner.id === activeOwnerId;
                return (
                  <div
                    key={owner.id}
                    onClick={() => handleSelectOwner(owner.id)}
                    className={`py-1.5 px-2.5 cursor-pointer transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-[#EEE7DD]/70"
                        : "hover:bg-[#F7F3EC]"
                    }`}
                  >
                    {/* Owner Initials Avatar */}
                    <div className="w-7 h-7 rounded-md bg-[#292320] text-[#FFFCF7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      {getInitials(owner.name)}
                    </div>

                    {/* Owner Name, Property Badge & Snippet */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#292320] truncate">
                          {owner.name}
                        </span>
                        <span className="text-[10px] text-[#71675E] tabular-nums font-mono whitespace-nowrap">
                          {formatTime(owner.lastMessage.createdAt)}
                        </span>
                      </div>

                      {/* Property Badge */}
                      <div className="mt-0.5 mb-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#292320] bg-[#EEE7DD] border border-[#D8CEC1] px-1 py-0.2 rounded truncate max-w-[200px]">
                          <Building2 className="w-2.5 h-2.5 shrink-0 text-[#71675E]" />
                          <span className="truncate">{owner.businessName}</span>
                        </span>
                      </div>

                      {/* Last Message Snippet */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-[#71675E] truncate">
                          {owner.lastMessage.isMine && (
                            <span className="font-medium text-[#292320]">You: </span>
                          )}
                          {owner.lastMessage.content}
                        </p>
                        {owner.unreadCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#6B2837] text-white text-[9px] font-bold tabular-nums shrink-0">
                            {owner.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT PANE: Chat Conversation Box (Independent Scroll)    */}
        {/* ======================================================== */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-[#FFFCF7]">
          {activeOwner ? (
            <>
              {/* Pinned Conversation Header */}
              <div className="py-1.5 px-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-[#292320] text-[#FFFCF7] flex items-center justify-center font-bold text-[10px] shrink-0">
                    {getInitials(activeOwner.name)}
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-[#292320] leading-tight">
                      {activeOwner.name}
                    </h2>
                    <div className="text-[11px] text-[#71675E] flex items-center gap-1.5">
                      <span className="font-medium text-[#292320]">{activeOwner.businessName}</span>
                      <span className="text-[#D8CEC1]">•</span>
                      <span>{activeOwner.email}</span>
                      {activeOwner.isBlocked && (
                        <>
                          <span className="text-[#D8CEC1]">•</span>
                          <span className="text-[10px] font-semibold text-[#854D0E] bg-[#FEF08A]/40 px-1 py-0.2 rounded border border-[#FEF08A]">
                            Suspended
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleBlock}
                    disabled={blocking}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      activeOwner.isBlocked
                        ? "bg-[#6B2837] text-white border-[#6B2837] hover:bg-[#521E2A]"
                        : "bg-[#FFFCF7] text-[#71675E] border-[#D8CEC1] hover:text-[#6B2837] hover:bg-[#EEE7DD]"
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                    <span>{activeOwner.isBlocked ? "Restore Access" : "Suspend Access"}</span>
                  </button>
                </div>
              </div>

              {/* Messages Timeline (Scrolls Independently) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 bg-[#F7F3EC]/40">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#71675E]">
                    <MessageSquare className="w-7 h-7 text-[#D8CEC1] mb-1.5" />
                    <div className="font-bold text-xs text-[#292320]">Start direct message</div>
                    <div className="text-[11px] text-[#71675E] mt-0.5 max-w-sm">
                      Send a message below to communicate directly with {activeOwner.name} ({activeOwner.businessName}).
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    if (msg.isMine) {
                      // Outgoing message from Super Admin (Right Aligned)
                      return (
                        <div key={msg.id} className="flex flex-col items-end">
                          <div className="max-w-[75%] md:max-w-[60%] bg-[#6B2837] text-white px-3 py-1.5 rounded-lg rounded-tr-none text-xs leading-relaxed shadow-2xs">
                            {msg.content}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-[#71675E] mt-0.5 tabular-nums font-mono pr-0.5">
                            <span>{formatTime(msg.createdAt)}</span>
                            <CheckCheck className="w-3 h-3 text-[#6B2837]" />
                          </div>
                        </div>
                      );
                    } else {
                      // Incoming message from Client Owner (Left Aligned)
                      return (
                        <div key={msg.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-md bg-[#EEE7DD] border border-[#D8CEC1] text-[#292320] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                            {getInitials(msg.senderName || activeOwner.name)}
                          </div>
                          <div className="flex flex-col items-start max-w-[75%] md:max-w-[60%]">
                            <div className="bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] px-3 py-1.5 rounded-lg rounded-tl-none text-xs leading-relaxed shadow-2xs">
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-[#71675E] mt-0.5 pl-0.5 tabular-nums font-mono">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Pinned Chat Composer Footer */}
              <div className="py-1.5 px-3 border-t border-[#D8CEC1] bg-[#FFFCF7] shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Type your message to ${activeOwner.name}...`}
                    className="flex-1 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-3 py-1.5 text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="px-3 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#71675E]">
              <MessageSquare className="w-8 h-8 text-[#D8CEC1] mb-2" />
              <div className="text-xs font-bold text-[#292320]">No conversation selected</div>
              <div className="text-[11px] text-[#71675E] mt-0.5">
                Choose a property owner from the list on the left to begin messaging.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
