"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  UploadCloud,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Image as ImageIcon,
  Building2,
  Users,
  Radio,
  SlidersHorizontal,
  Calendar,
  Clock,
  AlertTriangle,
  Send,
  Save,
} from "lucide-react";
import { toast } from "@/components/toast";

interface TenantBusiness {
  id: string;
  name: string;
  slug: string;
  type: string;
}

export default function CreateNoticePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState("");
  const [subheading, setSubheading] = useState("");
  const [category, setCategory] = useState("System Update");
  const [detailedMessage, setDetailedMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  // Audience State
  const [businesses, setBusinesses] = useState<TenantBusiness[]>([]);
  const [selectedAudience, setSelectedAudience] = useState("ALL");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["OWNER", "MANAGER"]);

  // Channels State
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelPush, setChannelPush] = useState(false);
  const [channelSms, setChannelSms] = useState(false);

  // Publish Settings
  const [priority, setPriority] = useState<"Standard" | "Urgent">("Standard");
  const [scheduleType, setScheduleType] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [auditReason, setAuditReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchTenantBusinesses();
    }
  }, [status, session, router]);

  const fetchTenantBusinesses = async () => {
    try {
      const res = await fetch("/api/v1/super-admin/notices");
      if (res.ok) {
        const data = await res.json();
        if (data.businesses) setBusinesses(data.businesses);
      }
    } catch (err) {
      console.error("Failed to fetch tenant businesses:", err);
    }
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (isDraft: boolean) => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!title.trim()) {
      setErrorMessage("Please enter a notice title");
      return;
    }
    if (!detailedMessage.trim()) {
      setErrorMessage("Please enter the detailed notice message");
      return;
    }
    if (selectedRoles.length === 0) {
      setErrorMessage("Please select at least one target user role");
      return;
    }

    const selectedChannels: string[] = [];
    if (channelInApp) selectedChannels.push("IN_APP");
    if (channelEmail) selectedChannels.push("EMAIL");
    if (channelPush) selectedChannels.push("PUSH");
    if (channelSms) selectedChannels.push("SMS");

    if (selectedChannels.length === 0) {
      setErrorMessage("Please select at least one delivery channel");
      return;
    }

    const finalAuditReason = auditReason.trim()
      ? auditReason.trim()
      : isDraft
      ? "Saved announcement as draft"
      : `Broadcasted platform notice: ${title.trim()}`;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        subheading: subheading.trim() || null,
        body: detailedMessage.trim(),
        priority: priority === "Urgent" ? "URGENT_MAINTENANCE" : "INFO",
        audience: selectedAudience,
        targetRoles: selectedRoles,
        channels: selectedChannels,
        isDraft,
        reason: finalAuditReason,
        expiresAt:
          scheduleType === "SCHEDULED" && scheduledDate
            ? new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toISOString()
            : null,
      };

      const res = await fetch("/api/v1/super-admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create announcement notice");

      toast.success(isDraft ? "Draft saved successfully!" : "Notice broadcasted successfully!");
      setTimeout(() => {
        router.push("/dashboard/super-admin/notices");
      }, 600);
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-full bg-[#F7F3EC] text-[#292320]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[1400px] mx-auto space-y-2">
        {/* Top Navigation & Header */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E] font-normal leading-none">
            <Link href="/dashboard/super-admin" className="hover:text-[#292320]">
              Platform
            </Link>
            <span>/</span>
            <Link href="/dashboard/super-admin/notices" className="hover:text-[#292320]">
              Notices
            </Link>
            <span>/</span>
            <span className="text-[#292320]">Create Notice</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <h1 className="text-xl font-bold tracking-tight text-[#292320] leading-tight">
              Create Broadcast Notice
            </h1>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/super-admin/notices"
                className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] rounded hover:bg-[#EEE7DD] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-[#71675E]" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold bg-[#6B2837] text-white rounded hover:bg-[#521E2A] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? "Broadcasting..." : "Publish Notice"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main 2-Column Form Layout */}
        <div className="grid grid-cols-12 gap-2">
          {/* Left Column: Message Content (col-span-12 lg:col-span-8) */}
          <div className="col-span-12 lg:col-span-8 space-y-2">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3">
              <h2 className="text-xs font-bold text-[#292320] mb-2 pb-1.5 border-b border-[#D8CEC1]">
                Message Content
              </h2>

            <div className="space-y-4">
              {/* Notice Title & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                    Notice Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Scheduled Platform Maintenance"
                    className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-3 py-2 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-3 py-2 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  >
                    <option value="System Update">System Update</option>
                    <option value="Fiscal & Compliance">Fiscal & Compliance</option>
                    <option value="Maintenance Advisory">Maintenance Advisory</option>
                    <option value="Seasonal & Operations">Seasonal & Operations</option>
                    <option value="General Announcement">General Announcement</option>
                  </select>
                </div>
              </div>

              {/* Subheading / Context */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                  Subheading / Summary Context
                </label>
                <input
                  type="text"
                  value={subheading}
                  onChange={(e) => setSubheading(e.target.value)}
                  placeholder="e.g., Planned database index optimization at 02:00 AM NPT"
                  className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-3 py-2 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                />
              </div>

              {/* Detailed Message with Toolbar */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                  Detailed Message <span className="text-red-500">*</span>
                </label>
                <div className="border border-[#D8CEC1] rounded-md overflow-hidden bg-[#F7F3EC]">
                  {/* Toolbar */}
                  <div className="bg-[#EEE7DD]/60 border-b border-[#D8CEC1] px-3 py-1.5 flex items-center gap-3 text-[#71675E]">
                    <button
                      type="button"
                      title="Bold"
                      onClick={() => setDetailedMessage((prev) => prev + "**bold text**")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Italic"
                      onClick={() => setDetailedMessage((prev) => prev + "*italic text*")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Underline"
                      onClick={() => setDetailedMessage((prev) => prev + "<u>underline</u>")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-[1px] bg-[#D8CEC1]"></div>
                    <button
                      type="button"
                      title="Bullet list"
                      onClick={() => setDetailedMessage((prev) => prev + "\n- Item")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Link"
                      onClick={() => setDetailedMessage((prev) => prev + " [link title](https://)")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Image"
                      onClick={() => setDetailedMessage((prev) => prev + " ![alt text](image-url)")}
                      className="p-1 hover:text-[#292320] hover:bg-[#D8CEC1] rounded"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={8}
                    value={detailedMessage}
                    onChange={(e) => setDetailedMessage(e.target.value)}
                    placeholder="Write your notice details here..."
                    className="w-full text-xs p-3.5 bg-[#FFFCF7] text-[#292320] focus:outline-none resize-y"
                  />
                </div>
              </div>

              {/* Drag & Drop Attachment Dropzone */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                  Attachment (Optional)
                </label>
                <div
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.png,.jpg,.jpeg";
                    input.onchange = (e: any) => {
                      if (e.target.files?.[0]) {
                        setAttachmentName(e.target.files[0].name);
                      }
                    };
                    input.click();
                  }}
                  className="border-2 border-dashed border-[#D8CEC1] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[#EEE7DD]/30 transition-colors text-center"
                >
                  <UploadCloud className="w-7 h-7 text-[#71675E] mb-2" />
                  <div className="text-xs font-semibold text-[#292320]">
                    {attachmentName ? (
                      <span className="text-[#059669]">Selected: {attachmentName}</span>
                    ) : (
                      "Click or drag to upload an attachment"
                    )}
                  </div>
                  <div className="text-[10px] text-[#71675E] mt-0.5">
                    PDF, PNG, JPG up to 10MB
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Audience, Channels & Publish Settings (col-span-12 lg:col-span-4) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Card 1: Target Audience */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#6B2837]" />
              <h2 className="text-xs font-bold text-[#292320] uppercase tracking-wider">Target Audience</h2>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                  Properties / Businesses
                </label>
                <select
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md px-2.5 py-1.5 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="ALL">All Properties ({businesses.length > 0 ? businesses.length : 4})</option>
                  <option value="RESTAURANT_ONLY">Restaurants Only</option>
                  <option value="HOTEL_ONLY">Hotels Only</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-2">
                  User Roles
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("OWNER")}
                      onChange={() => handleRoleToggle("OWNER")}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">Business Owners</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("MANAGER")}
                      onChange={() => handleRoleToggle("MANAGER")}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">General Managers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("CASHIER")}
                      onChange={() => handleRoleToggle("CASHIER")}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">Cashiers & Front Desk</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes("STAFF")}
                      onChange={() => handleRoleToggle("STAFF")}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">Kitchen & Service Staff</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Delivery Channels */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-[#6B2837]" />
              <h2 className="text-xs font-bold text-[#292320] uppercase tracking-wider">Delivery Channels</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* In-App Notice */}
              <div className="flex items-center justify-between p-2.5 bg-[#F7F3EC] rounded-md border border-[#EEE7DD]">
                <div>
                  <div className="font-semibold text-[#292320]">In-App Notice</div>
                  <div className="text-[10px] text-[#71675E]">Visible on user dashboard</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelInApp}
                    onChange={(e) => setChannelInApp(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#D8CEC1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8CEC1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#059669]"></div>
                </label>
              </div>

              {/* Email Broadcast */}
              <div className="flex items-center justify-between p-2.5 bg-[#F7F3EC] rounded-md border border-[#EEE7DD]">
                <div>
                  <div className="font-semibold text-[#292320]">Email Broadcast</div>
                  <div className="text-[10px] text-[#71675E]">Send to verified addresses</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelEmail}
                    onChange={(e) => setChannelEmail(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#D8CEC1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8CEC1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#059669]"></div>
                </label>
              </div>

              {/* Push Notification */}
              <div className="flex items-center justify-between p-2.5 bg-[#F7F3EC] rounded-md border border-[#EEE7DD]">
                <div>
                  <div className="font-semibold text-[#292320]">Push Notification</div>
                  <div className="text-[10px] text-[#71675E]">Alert mobile app users</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelPush}
                    onChange={(e) => setChannelPush(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#D8CEC1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8CEC1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#059669]"></div>
                </label>
              </div>

              {/* SMS Alert */}
              <div className="flex items-center justify-between p-2.5 bg-[#F7F3EC] rounded-md border border-[#EEE7DD]">
                <div>
                  <div className="font-semibold text-[#292320] flex items-center gap-1.5">
                    <span>SMS Alert</span>
                    <AlertTriangle className="w-3 h-3 text-[#D97706]" />
                  </div>
                  <div className="text-[10px] text-[#71675E]">Consumes SMS gateway credits</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelSms}
                    onChange={(e) => setChannelSms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#D8CEC1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8CEC1] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#059669]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Publish Settings */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-[#6B2837]" />
              <h2 className="text-xs font-bold text-[#292320] uppercase tracking-wider">Publish Settings</h2>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Priority segmented buttons */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority("Standard")}
                    className={`py-1.5 text-center font-semibold rounded-md border transition-colors ${
                      priority === "Standard"
                        ? "bg-[#6B2837] text-white border-[#6B2837]"
                        : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] hover:text-[#292320]"
                    }`}
                  >
                    Standard
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority("Urgent")}
                    className={`py-1.5 text-center font-semibold rounded-md border transition-colors ${
                      priority === "Urgent"
                        ? "bg-[#DC2626] text-white border-[#DC2626]"
                        : "bg-[#F7F3EC] text-[#71675E] border-[#D8CEC1] hover:text-[#DC2626]"
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              {/* Schedule Radios */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1.5">
                  Schedule
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={scheduleType === "IMMEDIATE"}
                      onChange={() => setScheduleType("IMMEDIATE")}
                      className="text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">Publish Immediately</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule"
                      checked={scheduleType === "SCHEDULED"}
                      onChange={() => setScheduleType("SCHEDULED")}
                      className="text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <span className="text-[#292320]">Schedule for later</span>
                  </label>
                </div>

                {scheduleType === "SCHEDULED" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-[#EEE7DD]">
                    <div>
                      <label className="block text-[10px] text-[#71675E] mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded px-2 py-1 text-[#292320] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#71675E] mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded px-2 py-1 text-[#292320] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Audit Reason */}
              <div className="pt-2 border-t border-[#EEE7DD]">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71675E] mb-1">
                  Audit Reason (Platform Compliance)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Broadcasted scheduled maintenance notice"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded px-2.5 py-1.5 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

