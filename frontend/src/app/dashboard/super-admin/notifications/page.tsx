"use client";

import * as React from "react";
import Link from "next/link";
import {
  Send,
  UploadCloud,
  X,
  Smartphone,
  Shield,
  RefreshCw,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { toast } from "@/components/toast";

interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  targetRole: string;
  targetProperty: string;
  propertyName?: string | null;
  propertySlug?: string | null;
  imageUrl?: string | null;
  channels: string[];
  sentCount: number;
  status: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface BusinessOption {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  userCount: number;
}

interface StatsData {
  totalBroadcasts: number;
  totalRecipientsReached: number;
  activeProperties: number;
  deliveryRate: string;
}

export default function NotificationsCenterPage() {
  const [broadcasts, setBroadcasts] = React.useState<BroadcastItem[]>([]);
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [stats, setStats] = React.useState<StatsData>({
    totalBroadcasts: 0,
    totalRecipientsReached: 0,
    activeProperties: 0,
    deliveryRate: "99.8%",
  });

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Form State
  const [targetRole, setTargetRole] = React.useState("ALL");
  const [targetProperty, setTargetProperty] = React.useState("ALL");
  const [title, setTitle] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [enableInApp, setEnableInApp] = React.useState(true);
  const [enablePush, setEnablePush] = React.useState(true);

  const bannerFileRef = React.useRef<HTMLInputElement>(null);

  // Fetch initial data
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/super-admin/notifications");
      if (!res.ok) {
        throw new Error(`Failed to load notification broadcasts (HTTP ${res.status})`);
      }
      const data = await res.json();
      setBroadcasts(data.broadcasts || []);
      setBusinesses(data.businesses || []);
      if (data.stats) setStats(data.stats);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load notifications data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Device File Upload
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setImageUrl(uploadEvent.target?.result as string);
      toast.success("Banner image loaded from device.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = () => {
    setImageUrl("");
    if (bannerFileRef.current) {
      bannerFileRef.current.value = "";
    }
  };

  // Handle Form Submit
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a notification title.");
      return;
    }
    if (!body.trim()) {
      toast.error("Please provide a broadcast message body.");
      return;
    }
    if (body.trim().length > 250) {
      toast.error("Message body exceeds the 250 character limit.");
      return;
    }

    const channels: string[] = [];
    if (enableInApp) channels.push("IN_APP");
    if (enablePush) channels.push("PUSH");

    if (channels.length === 0) {
      toast.error("Please select at least one delivery channel (In-App or Push).");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/super-admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetRole,
          targetProperty,
          imageUrl: imageUrl.trim() || undefined,
          channels,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to dispatch broadcast");
      }

      toast.success(result.message || "Broadcast successfully sent to recipients!");
      // Reset form
      setTitle("");
      setBody("");
      handleRemoveBanner();
      // Refresh broadcasts
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Network error while sending broadcast.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "OWNER":
        return "Property Owners Only";
      case "MANAGER":
        return "General Managers Only";
      case "CASHIER":
        return "Front Desk & Cashiers";
      case "STAFF":
        return "Kitchen & Service Staff";
      default:
        return "All Property Roles";
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* Top Header - Zero redundant sentences */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Push notifications
          </div>
          <h1 className="text-base font-bold text-[#292320] tracking-tight">
            Push notifications
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/dashboard/super-admin/notices"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors"
          >
            Broadcast notices
          </Link>
          <Link
            href="/dashboard/super-admin/chat"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#FFFCF7] bg-[#6B2837] hover:bg-[#521E2A] rounded-md transition-colors shadow-2xs"
          >
            Direct messages &rarr;
          </Link>
        </div>
      </div>

      {/* Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Total broadcasts</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{stats.totalBroadcasts}</span>
            <span className="text-[10px] text-[#71675E]">All-time</span>
          </div>
        </div>
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Recipients reached</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{stats.totalRecipientsReached}</span>
            <span className="text-[10px] text-[#71675E]">Delivered</span>
          </div>
        </div>
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Active properties</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{stats.activeProperties}</span>
            <span className="text-[10px] text-[#71675E]">Venues</span>
          </div>
        </div>
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Delivery rate</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{stats.deliveryRate}</span>
            <span className="text-[10px] text-[#71675E]">Real-time push</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Broadcast Form (Left) & Recipient View Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
        {/* Left Column: Composer Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-2xs overflow-hidden">
          <div className="py-1.5 px-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#292320]">Broadcast composer</h2>
            <span className="text-[11px] text-[#71675E]">Target role & property</span>
          </div>

          <form onSubmit={handleSendBroadcast} className="p-3 space-y-2.5">
            {/* Target Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Target role / audience
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all cursor-pointer"
                >
                  <option value="ALL">All Property Roles</option>
                  <option value="OWNER">Property Owners Only</option>
                  <option value="MANAGER">General Managers Only</option>
                  <option value="CASHIER">Cashiers & Front Desk</option>
                  <option value="STAFF">Kitchen & Service Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Target property / business
                </label>
                <select
                  value={targetProperty}
                  onChange={(e) => setTargetProperty(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all cursor-pointer"
                >
                  <option value="ALL">All Properties (Global)</option>
                  {businesses.map((biz) => (
                    <option key={biz.id} value={biz.id}>
                      {biz.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notification Title */}
            <div>
              <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                Notification title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. System Maintenance or Menu Sync & Fiscal Guidelines"
                className="w-full px-2.5 py-1.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
                required
              />
            </div>

            {/* Banner Image Upload & Device File Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#71675E]">
                  Banner image (optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[10px] text-[#6B2837] hover:underline cursor-pointer"
                >
                  {showUrlInput ? "Hide URL input" : "Or paste image URL"}
                </button>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={bannerFileRef}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleBannerFileChange}
                className="hidden"
                id="notification-banner-file-input"
              />

              {/* Device Upload Bar & Thumbnail Preview */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="notification-banner-file-input"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer shadow-2xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-[#6B2837]" />
                  <span>Choose image from device</span>
                </label>

                {imageUrl ? (
                  <div className="flex items-center gap-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-2 py-1">
                    <img
                      src={imageUrl}
                      alt="Uploaded Banner"
                      className="h-6 w-10 object-cover rounded border border-[#D8CEC1] bg-black/5"
                    />
                    <span className="text-[11px] text-[#292320] font-medium">Banner attached</span>
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="text-[#9C3232] hover:text-[#6B2837] p-0.5 rounded cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#71675E]">PNG, JPG, WebP up to 5MB</span>
                )}
              </div>

              {/* Optional Direct URL Input */}
              {showUrlInput && (
                <div className="relative mt-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full pl-2.5 pr-8 py-1.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
                  />
                  <ImageIcon className="absolute right-2.5 top-2 h-3.5 w-3.5 text-[#71675E] pointer-events-none" />
                </div>
              )}
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#71675E]">Message body</label>
                <span
                  className={`text-[10px] tabular-nums font-mono ${
                    body.length > 240
                      ? "text-[#6B2837] font-semibold"
                      : "text-[#71675E]"
                  }`}
                >
                  {body.length} / 250
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={250}
                rows={3}
                placeholder="Type your broadcast notification message here..."
                className="w-full px-2.5 py-1.5 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all resize-y"
                required
              />
            </div>

            {/* Delivery Channel Options */}
            <div className="pt-1.5 border-t border-[#D8CEC1] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#292320] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableInApp}
                    onChange={(e) => setEnableInApp(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                  />
                  <span>In-app bell alert</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-[#292320] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePush}
                    onChange={(e) => setEnablePush(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                  />
                  <span>Mobile POS push</span>
                </label>
              </div>

              <span className="text-[11px] text-[#71675E]">
                Audience: <strong className="text-[#292320]">{getRoleLabel(targetRole)}</strong>
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-1.5 px-3 rounded-md bg-[#6B2837] hover:bg-[#521E2A] text-white font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Broadcasting to recipients...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send broadcast (In-app & push)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Recipient View Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {/* Recipient View Preview Card */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-2xs overflow-hidden">
            <div className="py-1.5 px-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#292320]">
                <Smartphone className="h-3.5 w-3.5 text-[#6B2837]" />
                <span>Recipient view preview</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1]">
                Live preview
              </span>
            </div>

            <div className="p-3 space-y-2">
              <div className="text-[11px] flex items-center justify-between text-[#71675E]">
                <span>Notification bell & push alert</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#EEE7DD] text-[#292320] font-medium">
                  In-App
                </span>
              </div>

              {/* Notification Preview Box */}
              <div className="p-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] shadow-2xs space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-md bg-[#6B2837] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    R
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#292320]">RestroInn Official</span>
                      <span className="text-[10px] text-[#71675E] font-mono">now</span>
                    </div>
                    <h4 className="text-xs font-bold text-[#292320] mt-0.5 truncate">
                      {title.trim() || "Notification title"}
                    </h4>
                  </div>
                </div>

                {/* Message Body in Preview */}
                <p className="text-[11px] text-[#71675E] leading-relaxed break-words">
                  {body.trim() || "Notification message preview will appear here in real-time as you compose."}
                </p>

                {/* Rich Banner Preview if Image is provided */}
                {imageUrl.trim() && (
                  <div className="relative rounded-md overflow-hidden border border-[#D8CEC1] bg-black/5 aspect-video max-h-32 flex items-center justify-center">
                    <img
                      src={imageUrl.trim()}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Badges footer */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1] font-medium">
                    Platform official
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1] font-medium">
                    Push & in-app alert
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Channels Info Card */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-2xs overflow-hidden">
            <div className="py-1.5 px-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center gap-1.5 text-xs font-bold text-[#292320]">
              <Shield className="h-3.5 w-3.5 text-[#6B2837]" />
              <span>Delivery channels</span>
            </div>

            <div className="p-3 text-[11px] text-[#71675E] space-y-1.5 leading-relaxed">
              <div className="flex items-start gap-1.5">
                <span className="text-[#6B2837] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-[#292320]">In-App Bell:</strong> Immediately reaches the notification bell of all Property Owners and chosen role users upon portal visit.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#6B2837] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-[#292320]">Mobile Push:</strong> Dispatched via Firebase Cloud Messaging & Web Push to mobile POS tablets and waiter handheld terminals.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#6B2837] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-[#292320]">Target Precision:</strong> Target specific hotel or restaurant branches or broadcast universally across all hospitality entities.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Recent Broadcast History */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[#292320]">Recent broadcast history</h3>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#71675E] font-medium tabular-nums font-mono">
              {broadcasts.length}
            </span>
          </div>

          <span className="text-[11px] text-[#71675E]">Real-time delivery log</span>
        </div>

        {loading ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#71675E]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#6B2837]" />
              <span>Loading broadcast archives...</span>
            </div>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs font-medium text-[#71675E]">No broadcasts sent yet.</p>
            <p className="text-[11px] text-[#71675E]/80 mt-0.5">
              Compose a message above to deliver your first platform-wide notification.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3">Title & message</th>
                  <th className="py-1.5 px-3">Target role</th>
                  <th className="py-1.5 px-3">Property</th>
                  <th className="py-1.5 px-3">Channels</th>
                  <th className="py-1.5 px-3 text-center">Recipients</th>
                  <th className="py-1.5 px-3">Sent at</th>
                  <th className="py-1.5 px-3">Status</th>
                  <th className="py-1.5 px-3">Sender</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {broadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-1.5 px-3 max-w-xs">
                      <div className="font-semibold text-xs text-[#292320] truncate" title={b.title}>
                        {b.title}
                      </div>
                      <div className="text-[11px] text-[#71675E] line-clamp-1">
                        {b.body}
                      </div>
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#EEE7DD] text-[#292320]">
                        {getRoleLabel(b.targetRole)}
                      </span>
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap text-[#292320] font-medium text-xs">
                      {b.propertyName || "All Properties (Global)"}
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {b.channels.map((ch) => (
                          <span
                            key={ch}
                            className="px-1 py-0.2 rounded text-[9px] font-mono bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-1.5 px-3 text-center font-mono font-semibold tabular-nums text-[#292320] text-xs">
                      {b.sentCount}
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap text-[#71675E] font-mono text-[11px] tabular-nums">
                      {new Date(b.createdAt).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                        <Check className="h-2.5 w-2.5" />
                        {b.status}
                      </span>
                    </td>

                    <td className="py-1.5 px-3 whitespace-nowrap text-[#71675E] text-[11px]">
                      {b.createdBy?.name || "Platform Admin"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
