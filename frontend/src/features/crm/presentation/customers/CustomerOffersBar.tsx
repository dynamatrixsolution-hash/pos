"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Send, Users, Clock, X, Loader2 } from "lucide-react";
import { Notify } from "@/lib/notify";

interface OfferStats {
  totalCustomers: number;
  inactive3DaysCount: number;
  guestPushDevices: number;
  recentOffers: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

const OFFER_PRESETS = [
  {
    label: "Good Friday 30% Off",
    title: "Good Friday Special — 30% Off!",
    message: "Celebrate with us today and enjoy 30% off your dine-in order. Show this alert at your table!",
  },
  {
    label: "Buy 1 Get 1 Free",
    title: "Buy 1 Pizza, Get 1 Free!",
    message: "Order any signature pizza today and get a second one completely free. Limited time offer!",
  },
  {
    label: "3-Day Miss You Reminder",
    title: "We Miss You! Come Back for a Treat",
    message: "It has been a few days since your last visit. Drop by this week for a complimentary drink with your meal!",
  },
];

export function CustomerOffersBar() {
  const [stats, setStats] = useState<OfferStats | null>(null);
  const [open, setOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<"ALL" | "INACTIVE_3_DAYS">("ALL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/customers/offers", { credentials: "include" });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // ignore for non-owner roles
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (!stats) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || message.trim().length < 5) {
      Notify.warning("Please enter an offer title and message.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/v1/customers/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetMode,
          inactiveDays: 3,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Notify.error(data.error || "Failed to send customer offer.");
        return;
      }

      if (data.skipped) {
        Notify.info("This exact offer was already sent in the last hour (duplicate prevented).");
      } else {
        Notify.success(
          `Offer dispatched to ${data.targetedCustomers} customer(s) (${data.pushDispatched} active push device(s)).`
        );
      }
      setOpen(false);
      setTitle("");
      setMessage("");
      void loadStats();
    } catch {
      Notify.error("Network error while sending offer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-[#6B2837]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#292320]">Customer Offers &amp; Return Reminders</h2>
            <p className="text-xs text-[#71675E] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Users className="w-3.5 h-3.5" />
                {stats.totalCustomers} saved customers
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                {stats.inactive3DaysCount} inactive 3+ days
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 px-3.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Offer Push</span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-[#292320]/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Send Customer Offer Push"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEE7DD] bg-[#F7F3EC]">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Send Promotional Offer / Reminder</h3>
                <p className="text-[11px] text-[#71675E]">
                  Notify opted-in guests with deals or 3-4 day return reminders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close offer modal"
                className="p-1.5 rounded-md text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-5 space-y-4">
              {/* Quick Presets */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1.5">
                  Quick Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {OFFER_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTitle(p.title);
                        setMessage(p.message);
                        if (p.label.includes("3-Day")) setTargetMode("INACTIVE_3_DAYS");
                      }}
                      className="px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode("ALL")}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    targetMode === "ALL"
                      ? "border-[#6B2837] bg-[#FAF2F4] text-[#6B2837]"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                  }`}
                >
                  <div className="text-xs font-bold">All Customers</div>
                  <div className="text-[11px] opacity-80 tabular-nums">{stats.totalCustomers} saved</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("INACTIVE_3_DAYS")}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    targetMode === "INACTIVE_3_DAYS"
                      ? "border-[#6B2837] bg-[#FAF2F4] text-[#6B2837]"
                      : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
                  }`}
                >
                  <div className="text-xs font-bold">Inactive 3+ Days</div>
                  <div className="text-[11px] opacity-80 tabular-nums">{stats.inactive3DaysCount} to re-engage</div>
                </button>
              </div>

              <div>
                <label htmlFor="offer-title" className="block text-xs font-semibold text-[#292320] mb-1">
                  Offer Headline
                </label>
                <input
                  id="offer-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Good Friday 30% Off!"
                  className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label htmlFor="offer-message" className="block text-xs font-semibold text-[#292320] mb-1">
                  Offer Message
                </label>
                <textarea
                  id="offer-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the discount, combo, or validity..."
                  className="w-full px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-3.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-xs font-semibold text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="h-9 px-4 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{sending ? "Sending..." : "Send Offer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
