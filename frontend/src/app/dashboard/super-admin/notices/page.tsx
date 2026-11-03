"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Monitor,
  Mail,
  MessageSquare,
  Smartphone,
  Eye,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/components/toast";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface NoticeItem {
  id: string;
  title: string;
  subheading?: string;
  body: string;
  category: string;
  priority: "Standard" | "Warning" | "Urgent";
  audience: string;
  rawAudience?: string;
  targetRoles: string[];
  channels: string[];
  startsAt: string;
  expiresAt?: string | null;
  status: "Published" | "Draft" | "Scheduled";
  isActive: boolean;
  engagement: string;
  createdAt: string;
  createdBy: string;
}

interface NoticeMetrics {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  urgent: number;
  engagementRate: number;
}

export default function NoticesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [metrics, setMetrics] = useState<NoticeMetrics>({
    total: 0,
    published: 0,
    scheduled: 0,
    drafts: 0,
    urgent: 0,
    engagementRate: 72.4,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PUBLISHED" | "DRAFTS" | "URGENT">("ALL");

  // Inline filter states
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Modals
  const [previewNotice, setPreviewNotice] = useState<NoticeItem | null>(null);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subheading: "",
    body: "",
    priority: "Standard",
    audience: "ALL",
    targetRoles: ["OWNER", "MANAGER"],
    channels: ["IN_APP"],
    auditReason: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/notices");
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        toast.error("Failed to load platform notices");
      }
    } catch {
      toast.error("Network connection error loading notices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchNotices();
    }
  }, [status, session, router, fetchNotices]);

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      // Tab filter
      if (activeTab === "PUBLISHED" && !n.isActive) return false;
      if (activeTab === "DRAFTS" && n.isActive) return false;
      if (activeTab === "URGENT" && n.priority !== "Urgent") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesSub = (n.subheading || "").toLowerCase().includes(q);
        const matchesBody = n.body.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSub && !matchesBody) return false;
      }

      // Category filter
      if (categoryFilter !== "ALL" && n.category !== categoryFilter) return false;

      // Audience filter
      if (audienceFilter !== "ALL") {
        if (audienceFilter === "ALL_PROPERTIES" && n.audience !== "All Properties") return false;
        if (audienceFilter === "RESTAURANTS" && n.audience !== "Restaurants Only") return false;
        if (audienceFilter === "HOTELS" && n.audience !== "Hotels Only") return false;
      }

      // Priority filter
      if (priorityFilter !== "ALL" && n.priority !== priorityFilter) return false;

      return true;
    });
  }, [notices, activeTab, searchQuery, categoryFilter, audienceFilter, priorityFilter]);

  const openEditModal = (notice: NoticeItem) => {
    setEditingNotice(notice);
    setEditForm({
      title: notice.title,
      subheading: notice.subheading || "",
      body: notice.body,
      priority: notice.priority,
      audience: notice.rawAudience || "ALL",
      targetRoles: notice.targetRoles || ["OWNER", "MANAGER"],
      channels: notice.channels || ["IN_APP"],
      auditReason: "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim()) {
      toast.error("Notice title is required");
      return;
    }
    if (!editForm.body.trim()) {
      toast.error("Notice body is required");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch("/api/v1/super-admin/notices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingNotice?.id,
          title: editForm.title.trim(),
          subheading: editForm.subheading.trim() || null,
          body: editForm.body.trim(),
          priority: editForm.priority,
          audience: editForm.audience,
          targetRoles: editForm.targetRoles,
          channels: editForm.channels,
          reason: editForm.auditReason.trim() || "Super Admin notice update",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update notice");

      toast.success("Notice updated successfully.");
      setEditingNotice(null);
      fetchNotices();
    } catch (err: any) {
      toast.error(err.message || "Failed to save notice changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/notices?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete notice");

      toast.success("Notice deleted successfully.");
      setDeleteTarget(null);
      setDeleteReason("");
      fetchNotices();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getExportOptions = (): ExportOptions => ({
    filename: `platform-notices-${new Date().toISOString().slice(0, 10)}`,
    title: "Platform Broadcast Notices Ledger",
    subtitle: `Generated on ${new Date().toLocaleDateString()} • RestroInn Hospitality OS`,
    data: filteredNotices.map((n) => ({
      Title: n.title,
      Subheading: n.subheading || "-",
      Category: n.category,
      Audience: n.audience,
      Priority: n.priority,
      Status: n.status,
      Channels: n.channels.join(", "),
      "Created Date": formatDate(n.createdAt),
    })),
    columns: [
      { header: "Title", key: "Title" },
      { header: "Subheading", key: "Subheading" },
      { header: "Category", key: "Category" },
      { header: "Audience", key: "Audience" },
      { header: "Priority", key: "Priority" },
      { header: "Status", key: "Status" },
      { header: "Channels", key: "Channels" },
      { header: "Created Date", key: "Created Date" },
    ],
  });

  return (
    <div
      className="min-h-full bg-[#F7F3EC] text-[#292320]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[1400px] mx-auto space-y-2">
        {/* 1. Header Block: Breadcrumb & Title grouped tightly */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-[#71675E] font-normal leading-none">
            <Link href="/dashboard/super-admin" className="hover:text-[#292320]">
              Platform
            </Link>
            <span>/</span>
            <span className="text-[#292320]">Notices &amp; Announcements</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <h1 className="text-xl font-bold tracking-tight text-[#292320] leading-tight">
              Broadcast Notices
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotices}
                disabled={loading}
                className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <ExportDropdown
                getExportOptions={getExportOptions}
                buttonText="Export Data"
                className="!text-xs !py-1 !px-3"
              />

              <Link
                href="/dashboard/super-admin/notices/create"
                className="px-3.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-medium rounded shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3 stroke-[2.5]" />
                <span>Create Notice</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Top Metric Bar (4-Column Connected Strip with compact <= 7px padding) */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#D8CEC1]">
          {/* Total Notices */}
          <div
            onClick={() => setActiveTab("ALL")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Total broadcasts</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {metrics.total}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">All time</span>
            </div>
          </div>

          {/* Published */}
          <div
            onClick={() => setActiveTab("PUBLISHED")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Live broadcasts</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#057A55] tabular-nums leading-none">
                {metrics.published}
              </span>
              <span className="text-[11px] font-medium text-[#057A55] leading-none">Active</span>
            </div>
          </div>

          {/* Urgent Notices */}
          <div
            onClick={() => setActiveTab("URGENT")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Urgent alerts</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-lg font-bold tabular-nums leading-none ${
                  metrics.urgent > 0 ? "text-[#9C3232]" : "text-[#292320]"
                }`}
              >
                {metrics.urgent}
              </span>
              {metrics.urgent > 0 && (
                <span className="text-xs font-medium text-[#9C3232] leading-none">High Priority</span>
              )}
            </div>
          </div>

          {/* Drafts */}
          <div
            onClick={() => setActiveTab("DRAFTS")}
            className="px-3.5 py-1.5 cursor-pointer hover:bg-[#F7F3EC]/50 transition-colors"
          >
            <div className="text-xs text-[#71675E] leading-none">Drafts</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-[#292320] tabular-nums leading-none">
                {metrics.drafts}
              </span>
              <span className="text-[11px] text-[#71675E] leading-none">Unpublished</span>
            </div>
          </div>
        </div>

        {/* 3. Filter Bar & Controls */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setActiveTab("PUBLISHED")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "PUBLISHED"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Published ({metrics.published})
            </button>
            <button
              onClick={() => setActiveTab("URGENT")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "URGENT"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Urgent ({metrics.urgent})
            </button>
            <button
              onClick={() => setActiveTab("DRAFTS")}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "DRAFTS"
                  ? "bg-[#6B2837] text-white"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              Drafts ({metrics.drafts})
            </button>
          </div>

          {/* Right: Category, Priority & Search */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="System Update">System Update</option>
              <option value="Billing Advisory">Billing Advisory</option>
              <option value="Feature Update">Feature Update</option>
              <option value="General">General</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="Standard">Standard</option>
              <option value="Warning">Warning</option>
              <option value="Urgent">Urgent</option>
            </select>

            <input
              type="text"
              placeholder="Search notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837] w-full sm:w-48"
            />
          </div>
        </div>

        {/* 4. Directory Table (compact <= 7px padding) */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#D8CEC1]">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs font-bold text-[#292320]">Notices Directory</span>
              <span className="text-xs text-[#71675E]">({filteredNotices.length} records)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[#71675E] border-b border-[#D8CEC1]">
                  <th className="py-1.5 px-3 font-normal">Notice Title</th>
                  <th className="py-1.5 px-3 font-normal">Category</th>
                  <th className="py-1.5 px-3 font-normal">Audience</th>
                  <th className="py-1.5 px-3 font-normal">Channels</th>
                  <th className="py-1.5 px-3 font-normal">Priority</th>
                  <th className="py-1.5 px-3 font-normal">Published Date</th>
                  <th className="py-1.5 px-3 font-normal">Status</th>
                  <th className="py-1.5 px-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-xs text-[#71675E]">
                      Loading notices...
                    </td>
                  </tr>
                ) : filteredNotices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-xs text-[#71675E]">
                      No notices found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredNotices.map((n) => (
                    <tr key={n.id} className="hover:bg-[#F7F3EC]/30 transition-colors">
                      <td className="py-1.5 px-3">
                        <div className="font-semibold text-[#292320] leading-tight">{n.title}</div>
                        {n.subheading && (
                          <div className="text-[11px] text-[#71675E] truncate max-w-xs">
                            {n.subheading}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-[#71675E]">{n.category}</td>
                      <td className="py-1.5 px-3 text-[#292320]">{n.audience}</td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1 text-[#71675E]">
                          {n.channels.includes("IN_APP") && (
                            <span title="In-App Banner" className="p-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                              <Monitor className="w-3 h-3 text-[#057A55]" />
                            </span>
                          )}
                          {n.channels.includes("EMAIL") && (
                            <span title="Email Broadcast" className="p-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                              <Mail className="w-3 h-3 text-[#1C64F2]" />
                            </span>
                          )}
                          {n.channels.includes("SMS") && (
                            <span title="SMS Notice" className="p-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                              <MessageSquare className="w-3 h-3 text-[#D97706]" />
                            </span>
                          )}
                          {n.channels.includes("PUSH") && (
                            <span title="Push Alert" className="p-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1]">
                              <Smartphone className="w-3 h-3 text-[#6B2837]" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            n.priority === "Urgent"
                              ? "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                              : n.priority === "Warning"
                              ? "bg-[#FEF08A]/40 text-[#854D0E] border border-[#FEF08A]"
                              : "bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]"
                          }`}
                        >
                          {n.priority}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums">
                        {formatDate(n.createdAt)}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              n.isActive ? "bg-[#057A55]" : "bg-[#71675E]"
                            }`}
                          />
                          <span className="text-[#292320]">
                            {n.isActive ? "Published" : "Draft"}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setPreviewNotice(n)}
                            title="Preview Notice"
                            className="p-1 rounded text-[#71675E] hover:text-[#6B2837] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(n)}
                            title="Edit Notice"
                            className="p-1 rounded text-[#71675E] hover:text-[#6B2837] hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(n)}
                            title="Delete Notice"
                            className="p-1 rounded text-[#71675E] hover:text-[#9C3232] hover:bg-[#FDE8E8] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Preview Notice Modal */}
        {previewNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] w-full max-w-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Notice Preview</h3>
                  <p className="text-xs text-[#71675E]">How tenants see this broadcast</p>
                </div>
                <button
                  onClick={() => setPreviewNotice(null)}
                  className="p-1 text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rendered Notice Card matching Platform Banner */}
              <div
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  previewNotice.priority === "Urgent"
                    ? "bg-[#FDE8E8] border-[#F8B4B4] text-[#9C3232]"
                    : previewNotice.priority === "Warning"
                    ? "bg-[#FEF08A]/30 border-[#FEF08A] text-[#854D0E]"
                    : "bg-[#DEF7EC] border-[#BCF0DA] text-[#03543F]"
                }`}
              >
                <div className="font-bold text-sm">{previewNotice.title}</div>
                {previewNotice.subheading && (
                  <div className="opacity-80 font-medium">{previewNotice.subheading}</div>
                )}
                <p className="mt-1 leading-relaxed text-xs">{previewNotice.body}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-[#71675E] pt-2 border-t border-[#D8CEC1]">
                <div>
                  <span className="font-semibold text-[#292320]">Audience:</span> {previewNotice.audience}
                </div>
                <div>
                  <span className="font-semibold text-[#292320]">Channels:</span> {previewNotice.channels.join(", ")}
                </div>
                <div>
                  <span className="font-semibold text-[#292320]">Status:</span> {previewNotice.status}
                </div>
                <div>
                  <span className="font-semibold text-[#292320]">Published:</span> {formatDate(previewNotice.createdAt)}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#D8CEC1]">
                <button
                  onClick={() => setPreviewNotice(null)}
                  className="px-4 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Edit Notice Modal */}
        {editingNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] w-full max-w-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
                <h3 className="text-sm font-bold text-[#292320]">Edit Broadcast Notice</h3>
                <button
                  onClick={() => setEditingNotice(null)}
                  className="p-1 text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[#71675E] mb-1">Notice Title *</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block text-[#71675E] mb-1">Subheading</label>
                  <input
                    type="text"
                    value={editForm.subheading}
                    onChange={(e) => setEditForm({ ...editForm, subheading: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block text-[#71675E] mb-1">Notice Message Body *</label>
                  <textarea
                    rows={3}
                    required
                    value={editForm.body}
                    onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#71675E] mb-1">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none"
                    >
                      <option value="Standard">Standard / Normal</option>
                      <option value="Warning">Warning / Medium</option>
                      <option value="Urgent">Urgent / Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#71675E] mb-1">Audience</label>
                    <select
                      value={editForm.audience}
                      onChange={(e) => setEditForm({ ...editForm, audience: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-[#292320] focus:outline-none"
                    >
                      <option value="ALL">All Properties</option>
                      <option value="RESTAURANT_ONLY">Restaurants Only</option>
                      <option value="HOTEL_ONLY">Hotels Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                  <button
                    type="button"
                    onClick={() => setEditingNotice(null)}
                    className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-4 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white font-medium rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Delete Notice Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] w-full max-w-md p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
                <h3 className="text-sm font-bold text-[#9C3232]">Delete Broadcast Notice</h3>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="p-1 text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#292320] leading-relaxed">
                Are you sure you want to permanently delete the notice:{" "}
                <span className="font-bold">&quot;{deleteTarget.title}&quot;</span>? This will immediately remove it from all tenant dashboards.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-medium rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteNotice}
                  disabled={deleteLoading}
                  className="px-4 py-1 bg-[#9C3232] hover:bg-[#7E2525] text-white text-xs font-semibold rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
