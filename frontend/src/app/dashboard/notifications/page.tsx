"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BellRing,
  Send,
  Users,
  UserCheck,
  Clock,
  Megaphone,
  Shield,
  RefreshCw,
  Loader2,
  Check,
} from "lucide-react";
import { Notify } from "@/lib/notify";

type AudienceType =
  | "ALL_CUSTOMERS"
  | "INACTIVE_CUSTOMERS"
  | "ALL_STAFF"
  | "STAFF_ROLE"
  | "INDIVIDUAL_STAFF";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SentNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  targetRoles: string[];
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PushHubData {
  totalCustomers: number;
  inactive3DaysCount: number;
  guestPushDevices: number;
  staffMembers: StaffMember[];
  recentSent: SentNotification[];
}

const STAFF_ROLES = [
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "MANAGER",
  "ACCOUNTANT",
  "FRONT_DESK",
  "HOUSEKEEPING",
];

const QUICK_TEMPLATES: Array<{
  label: string;
  audience: AudienceType;
  title: string;
  message: string;
}> = [
  {
    label: "Good Friday 30% Off",
    audience: "ALL_CUSTOMERS",
    title: "Good Friday Special — 30% Off!",
    message: "Celebrate with us today and enjoy 30% off your dine-in order. Show this alert at your table!",
  },
  {
    label: "Buy 1 Get 1 Free",
    audience: "ALL_CUSTOMERS",
    title: "Buy 1 Pizza, Get 1 Free!",
    message: "Order any signature pizza today and get a second one completely free. Limited time offer!",
  },
  {
    label: "3-Day Return Offer",
    audience: "INACTIVE_CUSTOMERS",
    title: "We Miss You! Special 15% Return Offer",
    message: "It has been a few days since your last visit. Dine with us this week for 15% off your order!",
  },
  {
    label: "Staff Shift Briefing",
    audience: "ALL_STAFF",
    title: "Pre-Service Team Briefing",
    message: "Busy evening expected today. Please check table readiness, kitchen prep stock, and POS shifts 15 mins early.",
  },
];

export default function BusinessPushNotificationsPage() {
  const [data, setData] = useState<PushHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [targetGroup, setTargetGroup] = useState<"CUSTOMERS" | "EMPLOYEES">("CUSTOMERS");
  const [audience, setAudience] = useState<AudienceType>("ALL_CUSTOMERS");
  const [inactiveDays, setInactiveDays] = useState(3);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["CASHIER", "WAITER"]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("HIGH");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 350 * 1024) {
      Notify.warning("Please choose a banner image under 350 KB (or paste an image URL).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const loadHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications/send", { credentials: "include" });
      if (res.ok) {
        setData(await res.json());
      } else {
        Notify.error("Unable to load notification hub.");
      }
    } catch {
      Notify.error("Network error while loading notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  const handleGroupSwitch = (group: "CUSTOMERS" | "EMPLOYEES") => {
    setTargetGroup(group);
    setAudience(group === "CUSTOMERS" ? "ALL_CUSTOMERS" : "ALL_STAFF");
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || message.trim().length < 5) {
      Notify.warning("Please enter both a title and a message.");
      return;
    }
    if (audience === "STAFF_ROLE" && selectedRoles.length === 0) {
      Notify.warning("Select at least one employee role.");
      return;
    }
    if (audience === "INDIVIDUAL_STAFF" && selectedUserIds.length === 0) {
      Notify.warning("Select at least one employee.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/v1/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audience,
          title: title.trim(),
          message: message.trim(),
          priority,
          inactiveDays,
          targetRoles: audience === "STAFF_ROLE" ? selectedRoles : [],
          userIds: audience === "INDIVIDUAL_STAFF" ? selectedUserIds : [],
          imageUrl: imageUrl.trim() || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        Notify.error(result.error || "Failed to send push notification.");
        return;
      }

      if (result.skipped) {
        Notify.info("Identical notification was already sent in the last hour (duplicate blocked).");
      } else {
        Notify.success(
          `Push notification dispatched to ${result.recipientCount} recipient(s).`
        );
      }
      setTitle("");
      setMessage("");
      setImageUrl("");
      void loadHub();
    } catch {
      Notify.error("Network error while sending notification.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 text-[#292320]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D8CEC1] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BellRing className="w-5 h-5 text-[#6B2837]" />
            <span>Push Notifications</span>
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Send foreground &amp; background alerts to customers (offers &amp; 3-4 day return reminders) or employees (all, by role, or individual).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHub()}
          disabled={loading}
          className="h-9 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-[#EEE7DD] animate-pulse" />
          ))
        ) : (
          <>
            <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                Saved Customers
              </div>
              <div className="text-2xl font-bold text-[#292320] tabular-nums mt-1">
                {data?.totalCustomers ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                Inactive 3+ Days
              </div>
              <div className="text-2xl font-bold text-[#946000] tabular-nums mt-1">
                {data?.inactive3DaysCount ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                Active Staff
              </div>
              <div className="text-2xl font-bold text-[#292320] tabular-nums mt-1">
                {data?.staffMembers.length ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
                Recent Campaigns
              </div>
              <div className="text-2xl font-bold text-[#6B2837] tabular-nums mt-1">
                {data?.recentSent.length ?? 0}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Composer (7 cols) */}
        <form
          onSubmit={handleSend}
          className="lg:col-span-7 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4"
        >
          {/* Primary Audience Group Tabs: Customers vs Employees */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1]">
            <button
              type="button"
              onClick={() => handleGroupSwitch("CUSTOMERS")}
              className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                targetGroup === "CUSTOMERS"
                  ? "bg-[#6B2837] text-[#FFFCF7]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Customers (Offers &amp; Deals)</span>
            </button>
            <button
              type="button"
              onClick={() => handleGroupSwitch("EMPLOYEES")}
              className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                targetGroup === "EMPLOYEES"
                  ? "bg-[#6B2837] text-[#FFFCF7]"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Employees / Staff</span>
            </button>
          </div>

          {/* Sub-Audience Selector */}
          {targetGroup === "CUSTOMERS" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAudience("ALL_CUSTOMERS")}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    audience === "ALL_CUSTOMERS"
                      ? "border-[#6B2837] bg-[#FAF2F4] text-[#6B2837]"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                  }`}
                >
                  <div className="text-xs font-bold">All Customers</div>
                  <div className="text-[11px] opacity-80 tabular-nums">
                    {data?.totalCustomers ?? 0} saved customers
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("INACTIVE_CUSTOMERS")}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    audience === "INACTIVE_CUSTOMERS"
                      ? "border-[#6B2837] bg-[#FAF2F4] text-[#6B2837]"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Inactive {inactiveDays}+ Days</span>
                  </div>
                  <div className="text-[11px] opacity-80 tabular-nums">
                    Re-engage guests who haven&apos;t visited recently
                  </div>
                </button>
              </div>

              {audience === "INACTIVE_CUSTOMERS" && (
                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor="inactive-days" className="font-semibold text-[#71675E]">
                    No visit for at least:
                  </label>
                  <select
                    id="inactive-days"
                    value={inactiveDays}
                    onChange={(e) => setInactiveDays(Number(e.target.value))}
                    className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320]"
                  >
                    <option value={3}>3 days</option>
                    <option value={4}>4 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["ALL_STAFF", "All Employees", Users],
                    ["STAFF_ROLE", "By Role", Shield],
                    ["INDIVIDUAL_STAFF", "Individual", UserCheck],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAudience(key)}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      audience === key
                        ? "border-[#6B2837] bg-[#FAF2F4] text-[#6B2837]"
                        : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {audience === "STAFF_ROLE" && (
                <div className="flex flex-wrap gap-1.5">
                  {STAFF_ROLES.map((r) => {
                    const active = selectedRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? "border-[#6B2837] bg-[#6B2837] text-[#FFFCF7]"
                            : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                        }`}
                      >
                        {r.replace("_", " ")}
                      </button>
                    );
                  })}
                </div>
              )}

              {audience === "INDIVIDUAL_STAFF" && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#D8CEC1] divide-y divide-[#EEE7DD] bg-[#F7F3EC]">
                  {(data?.staffMembers || []).length === 0 ? (
                    <p className="p-3 text-xs text-[#71675E] text-center">No staff accounts found.</p>
                  ) : (
                    data?.staffMembers.map((u) => {
                      const checked = selectedUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u.id)}
                          className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs cursor-pointer transition-colors ${
                            checked ? "bg-[#FAF2F4] text-[#6B2837]" : "hover:bg-[#EEE7DD]/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{u.name}</div>
                            <div className="text-[10px] text-[#71675E] truncate">
                              {u.role.replace("_", " ")} • {u.email}
                            </div>
                          </div>
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked
                                ? "bg-[#6B2837] border-[#6B2837] text-[#FFFCF7]"
                                : "border-[#D8CEC1] bg-[#FFFCF7]"
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Templates */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1.5">
              Quick Templates
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => {
                    const isCust = tpl.audience === "ALL_CUSTOMERS" || tpl.audience === "INACTIVE_CUSTOMERS";
                    setTargetGroup(isCust ? "CUSTOMERS" : "EMPLOYEES");
                    setAudience(tpl.audience);
                    setTitle(tpl.title);
                    setMessage(tpl.message);
                  }}
                  className="px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="push-title" className="block text-xs font-semibold text-[#292320] mb-1">
                Notification Headline
              </label>
              <input
                id="push-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Good Friday 30% Off or Evening Shift Briefing"
                className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
              />
            </div>
            <div>
              <label htmlFor="push-priority" className="block text-xs font-semibold text-[#292320] mb-1">
                Priority
              </label>
              <select
                id="push-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "NORMAL" | "HIGH" | "URGENT")}
                className="w-full h-9 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320]"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label htmlFor="push-message" className="block text-xs font-semibold text-[#292320] mb-1">
              Message Body
            </label>
            <textarea
              id="push-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your promotional offer or staff announcement..."
              className="w-full px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] resize-none"
            />
          </div>

          {/* Optional Offer Banner Image (Upload or URL) */}
          <div className="space-y-2">
            <label htmlFor="push-banner-url" className="block text-xs font-semibold text-[#292320]">
              Banner Image (Optional)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="push-banner-url"
                type="text"
                value={imageUrl.startsWith("data:") ? "" : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste banner image URL (https://...) or upload below"
                className="flex-1 h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
              />
              <label className="h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] inline-flex items-center justify-center cursor-pointer shrink-0">
                Upload Banner
                <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
              </label>
            </div>
            {imageUrl && (
              <div className="relative rounded-md overflow-hidden border border-[#D8CEC1] bg-[#F7F3EC] max-h-36">
                <img src={imageUrl} alt="Offer banner preview" className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-[#292320]/80 text-[#FFFCF7] text-[10px] font-semibold cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[#EEE7DD]">
            <button
              type="submit"
              disabled={sending}
              className="h-9 px-5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{sending ? "Sending..." : "Send Push Notification"}</span>
            </button>
          </div>
        </form>

        {/* Recent Sent History (5 cols) */}
        <div className="lg:col-span-5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EEE7DD] bg-[#F7F3EC] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#292320]">
              Recent Dispatches
            </h2>
            <span className="text-[11px] text-[#71675E] tabular-nums">
              {data?.recentSent.length ?? 0} sent
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-[#EEE7DD]">
            {loading && !data ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded bg-[#EEE7DD] animate-pulse" />
                ))}
              </div>
            ) : (data?.recentSent || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-[#71675E]">
                No promotional offers or team push broadcasts sent yet.
              </div>
            ) : (
              data?.recentSent.map((item) => (
                <div key={item.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#292320] truncate">{item.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                        item.category === "OFFER"
                          ? "bg-[#FDF7ED] border border-[#EDD7AD] text-[#946000]"
                          : "bg-[#F2F6F9] border border-[#B8D2E6] text-[#315F85]"
                      }`}
                    >
                      {item.category === "OFFER" ? "Customer Offer" : "Staff Alert"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#71675E] leading-snug line-clamp-2">
                    {item.message}
                  </p>
                  <div className="text-[10px] text-[#71675E] tabular-nums pt-0.5">
                    {new Date(item.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
