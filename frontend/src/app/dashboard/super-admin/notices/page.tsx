"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Edit3,
  AlertTriangle,
  TrendingUp,
  Monitor,
  Mail,
  MessageSquare,
  Smartphone,
  Eye,
  Edit2,
  Trash2,
  Download,
  X,
  ChevronRight,
  FileText,
} from "lucide-react";

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

interface ChannelStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
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
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([
    { name: "In-App", count: 11, percentage: 46, color: "#10B981" },
    { name: "Email", count: 1, percentage: 4, color: "#3B82F6" },
    { name: "SMS", count: 1, percentage: 4, color: "#F59E0B" },
    { name: "Push", count: 11, percentage: 46, color: "#6B2837" },
  ]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PUBLISHED" | "SCHEDULED" | "DRAFTS" | "URGENT" | "ARCHIVED">("ALL");

  // Inline filter states
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  const [editError, setEditError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchNotices();
    }
  }, [status, session, router]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/notices");
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.analytics?.channelDistribution) {
          setChannelStats(data.analytics.channelDistribution);
        }
        if (data.analytics?.recentActivity) {
          setRecentActivity(data.analytics.recentActivity);
        }
      }
    } catch (err) {
      console.error("Failed to load notices:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      // Tab filter
      if (activeTab === "PUBLISHED" && !n.isActive) return false;
      if (activeTab === "DRAFTS" && n.isActive) return false;
      if (activeTab === "URGENT" && n.priority !== "Urgent") return false;
      if (activeTab === "SCHEDULED" && n.status !== "Scheduled") return false;
      if (activeTab === "ARCHIVED") return false;

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
        if (audienceFilter === "SELECTED" && n.audience !== "Selected Properties") return false;
      }

      // Channel filter
      if (channelFilter !== "ALL") {
        if (!n.channels.includes(channelFilter)) return false;
      }

      // Priority filter
      if (priorityFilter !== "ALL" && n.priority !== priorityFilter) return false;

      return true;
    });
  }, [notices, activeTab, searchQuery, categoryFilter, audienceFilter, channelFilter, priorityFilter]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredNotices.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const headers = ["Title", "Category", "Audience", "Channels", "Priority", "Status", "Publish Date", "Engagement"];
    const rows = filteredNotices.map((n) => [
      `"${n.title.replace(/"/g, '""')}"`,
      `"${n.category}"`,
      `"${n.audience}"`,
      `"${n.channels.join(", ")}"`,
      `"${n.priority}"`,
      `"${n.status}"`,
      `"${new Date(n.createdAt).toLocaleDateString()}"`,
      `"${n.engagement}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `platform_notices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim()) {
      setEditError("Notice title is required");
      return;
    }
    if (!editForm.body.trim()) {
      setEditError("Notice body is required");
      return;
    }
    if (!editForm.auditReason.trim() || editForm.auditReason.trim().length < 5) {
      setEditError("Mandatory administrative audit reason (min 5 chars) is required");
      return;
    }

    setEditSaving(true);
    setEditError("");
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
          reason: editForm.auditReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update notice");

      setEditingNotice(null);
      fetchNotices();
    } catch (err: any) {
      setEditError(err.message || "Failed to save notice changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim() || deleteReason.trim().length < 5) {
      alert("A valid audit reason (minimum 5 characters) is required to delete a platform announcement");
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/notices?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete notice");

      setDeleteTarget(null);
      setDeleteReason("");
      fetchNotices();
    } catch (err: any) {
      alert(err.message || "Failed to delete notice");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 md:p-6 lg:p-8 text-[#292320]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#71675E] mb-1">
            <span>Platform</span>
            <span>/</span>
            <span className="font-medium text-[#292320]">Notices & Announcements</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#292320]">
            Notices & Announcements
          </h1>
          <p className="text-xs md:text-sm text-[#71675E] mt-0.5">
            Managing dining & hotel-wide communications, platform maintenance notices, urgent alerts, and scheduled announcements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71675E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notices..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#D8CEC1] rounded-md focus:outline-none focus:ring-1 focus:ring-[#6B2837] w-44 md:w-56"
            />
          </div>

          <button
            onClick={() => {
              setCategoryFilter("ALL");
              setAudienceFilter("ALL");
              setChannelFilter("ALL");
              setPriorityFilter("ALL");
              setSearchQuery("");
            }}
            title="Reset filters"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Data</span>
          </button>

          <Link
            href="/dashboard/super-admin/notices/create"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#6B2837] text-white rounded-md hover:bg-[#521E2A] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Notice</span>
          </Link>
        </div>
      </div>

      {/* 6 KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total Notices */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Total Notices</div>
            <div className="text-xl font-bold text-[#292320] mt-1 tabular-nums">{metrics.total}</div>
            <div className="text-[10px] text-[#71675E] mt-0.5">All time</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#EEE7DD] flex items-center justify-center text-[#71675E]">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        {/* Published */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Published</div>
            <div className="text-xl font-bold text-[#059669] mt-1 tabular-nums">{metrics.published}</div>
            <div className="text-[10px] text-[#71675E] mt-0.5">Live broadcasts</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#D1FAE5] flex items-center justify-center text-[#059669]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Scheduled */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Scheduled</div>
            <div className="text-xl font-bold text-[#2563EB] mt-1 tabular-nums">{metrics.scheduled}</div>
            <div className="text-[10px] text-[#71675E] mt-0.5">Upcoming queue</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#DBEAFE] flex items-center justify-center text-[#2563EB]">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        {/* Drafts */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Drafts</div>
            <div className="text-xl font-bold text-[#D97706] mt-1 tabular-nums">{metrics.drafts}</div>
            <div className="text-[10px] text-[#71675E] mt-0.5">In preparation</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
            <Edit3 className="w-4 h-4" />
          </div>
        </div>

        {/* Urgent Notices */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Urgent Notices</div>
            <div className="text-xl font-bold text-[#DC2626] mt-1 tabular-nums">{metrics.urgent}</div>
            <div className="text-[10px] text-[#71675E] mt-0.5">Critical priority</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Engagement Rate */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#71675E] uppercase tracking-wider">Engagement Rate</div>
            <div className="text-xl font-bold text-[#6B2837] mt-1 tabular-nums">72.4%</div>
            <div className="text-[10px] text-[#059669] mt-0.5 font-medium">+3.8% vs last mo</div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FCE7F3] flex items-center justify-center text-[#6B2837]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Table & Right Sidebar */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Left Column: Notices Directory (col-span-12 lg:col-span-9) */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-[#EEE7DD] px-4 pt-3 flex items-center gap-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "ALL"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                All ({metrics.total})
              </button>
              <button
                onClick={() => setActiveTab("PUBLISHED")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "PUBLISHED"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Published ({metrics.published})
              </button>
              <button
                onClick={() => setActiveTab("SCHEDULED")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "SCHEDULED"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Scheduled ({metrics.scheduled})
              </button>
              <button
                onClick={() => setActiveTab("DRAFTS")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "DRAFTS"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Drafts ({metrics.drafts})
              </button>
              <button
                onClick={() => setActiveTab("URGENT")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "URGENT"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Urgent ({metrics.urgent})
              </button>
              <button
                onClick={() => setActiveTab("ARCHIVED")}
                className={`pb-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === "ARCHIVED"
                    ? "border-[#6B2837] text-[#6B2837]"
                    : "border-transparent text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Archived (0)
              </button>
            </div>

            {/* Inline Dropdown Filters */}
            <div className="p-3 bg-[#F7F3EC]/50 border-b border-[#EEE7DD] flex flex-wrap items-center gap-2">
              {/* Category */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs bg-[#FFFCF7] border border-[#D8CEC1] rounded-md px-2.5 py-1 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="System Update">System Update</option>
                  <option value="Billing Advisory">Billing Advisory</option>
                  <option value="Feature Update">Feature Update</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Audience */}
              <div className="relative">
                <select
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                  className="text-xs bg-[#FFFCF7] border border-[#D8CEC1] rounded-md px-2.5 py-1 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="ALL">All Audiences</option>
                  <option value="ALL_PROPERTIES">All Properties</option>
                  <option value="RESTAURANTS">Restaurants Only</option>
                  <option value="HOTELS">Hotels Only</option>
                  <option value="SELECTED">Selected Properties</option>
                </select>
              </div>

              {/* Channels */}
              <div className="relative">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="text-xs bg-[#FFFCF7] border border-[#D8CEC1] rounded-md px-2.5 py-1 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="ALL">All Channels</option>
                  <option value="IN_APP">In-App Dashboard</option>
                  <option value="EMAIL">Email Broadcast</option>
                  <option value="PUSH">Push Notifications</option>
                  <option value="SMS">SMS Alerts</option>
                </select>
              </div>

              {/* Priorities */}
              <div className="relative">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="text-xs bg-[#FFFCF7] border border-[#D8CEC1] rounded-md px-2.5 py-1 text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="Standard">Standard</option>
                  <option value="Warning">Warning / Medium</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {selectedIds.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-[#71675E]">{selectedIds.length} selected</span>
                  <button
                    onClick={() => {
                      if (confirm(`Archive ${selectedIds.length} selected notices?`)) {
                        setSelectedIds([]);
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-[#EEE7DD] text-[#292320] rounded-md hover:bg-[#D8CEC1]"
                  >
                    Archive
                  </button>
                </div>
              )}
            </div>

            {/* Directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F3EC] text-[#71675E] uppercase text-[10px] tracking-wider border-b border-[#EEE7DD]">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredNotices.length}
                        onChange={handleSelectAll}
                        className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                      />
                    </th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Audience</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Publish Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Engagement</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7DD]">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[#71675E]">
                        <div className="inline-block animate-spin w-5 h-5 border-2 border-[#6B2837] border-t-transparent rounded-full mb-2"></div>
                        <div>Loading notices directory...</div>
                      </td>
                    </tr>
                  ) : filteredNotices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[#71675E]">
                        <div className="w-10 h-10 rounded-full bg-[#EEE7DD] flex items-center justify-center mx-auto mb-2 text-[#71675E]">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="font-medium text-[#292320]">No notices found</div>
                        <div className="text-[11px] text-[#71675E] mt-0.5">Try adjusting your filters or search term</div>
                      </td>
                    </tr>
                  ) : (
                    filteredNotices.map((n) => {
                      const isSelected = selectedIds.includes(n.id);
                      return (
                        <tr key={n.id} className={`hover:bg-[#F7F3EC]/50 transition-colors ${isSelected ? "bg-[#EEE7DD]/40" : ""}`}>
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(n.id)}
                              className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-[#292320] max-w-[240px] truncate">{n.title}</div>
                            {n.subheading ? (
                              <div className="text-[11px] text-[#71675E] max-w-[240px] truncate">{n.subheading}</div>
                            ) : (
                              <div className="text-[11px] text-[#71675E]/60 italic">No subheading</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#71675E]">{n.category}</td>
                          <td className="py-3 px-3 text-[#292320]">{n.audience}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-[#71675E]">
                              {n.channels.includes("IN_APP") && (
                                <span title="In-App Notice" className="p-1 rounded bg-[#EEE7DD]/60">
                                  <Monitor className="w-3 h-3 text-[#10B981]" />
                                </span>
                              )}
                              {n.channels.includes("EMAIL") && (
                                <span title="Email Broadcast" className="p-1 rounded bg-[#EEE7DD]/60">
                                  <Mail className="w-3 h-3 text-[#3B82F6]" />
                                </span>
                              )}
                              {n.channels.includes("SMS") && (
                                <span title="SMS Alert" className="p-1 rounded bg-[#EEE7DD]/60">
                                  <MessageSquare className="w-3 h-3 text-[#F59E0B]" />
                                </span>
                              )}
                              {n.channels.includes("PUSH") && (
                                <span title="Push Notification" className="p-1 rounded bg-[#EEE7DD]/60">
                                  <Smartphone className="w-3 h-3 text-[#6B2837]" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {n.priority === "Urgent" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEE2E2] text-[#991B1B]">
                                Urgent
                              </span>
                            )}
                            {n.priority === "Warning" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                                Medium
                              </span>
                            )}
                            {n.priority === "Standard" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E0E7FF] text-[#3730A3]">
                                Standard
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#71675E] tabular-nums whitespace-nowrap">
                            {new Date(n.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            <div className="text-[10px] text-[#71675E]/70">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {n.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                                Published
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#71675E]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#71675E]"></span>
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 tabular-nums font-medium text-[#292320]">{n.engagement}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1 text-[#71675E]">
                              <button
                                onClick={() => setPreviewNotice(n)}
                                title="View notice details"
                                className="p-1 hover:text-[#292320] hover:bg-[#EEE7DD] rounded"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(n)}
                                title="Edit notice"
                                className="p-1 hover:text-[#292320] hover:bg-[#EEE7DD] rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(n)}
                                title="Delete notice"
                                className="p-1 hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="p-3 border-t border-[#EEE7DD] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#71675E]">
              <div>
                Showing 1 to {filteredNotices.length} of {filteredNotices.length} notices
              </div>
              <div className="flex items-center gap-3">
                <span>Rows per page: 10</span>
                <div className="flex items-center gap-1">
                  <button className="w-6 h-6 border border-[#D8CEC1] rounded flex items-center justify-center text-[#71675E] hover:bg-[#EEE7DD] disabled:opacity-50" disabled>
                    &lt;
                  </button>
                  <button className="w-6 h-6 bg-[#6B2837] text-white rounded font-medium flex items-center justify-center">
                    1
                  </button>
                  <button className="w-6 h-6 border border-[#D8CEC1] rounded flex items-center justify-center text-[#71675E] hover:bg-[#EEE7DD] disabled:opacity-50" disabled>
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Workflow, Data Model & Guidelines Sidebar (col-span-12 lg:col-span-3) */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Notice Workflow */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
            <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider mb-3">Notice Workflow</h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6B2837] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-semibold text-[#292320]">Create Notice</div>
                  <div className="text-[11px] text-[#71675E]">Write and configure your notice</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6B2837] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="font-semibold text-[#292320]">Select Audience</div>
                  <div className="text-[11px] text-[#71675E]">Choose target audience groups</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6B2837] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="font-semibold text-[#292320]">Choose Channels</div>
                  <div className="text-[11px] text-[#71675E]">Select delivery channels</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6B2837] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <div className="font-semibold text-[#292320]">Schedule / Publish</div>
                  <div className="text-[11px] text-[#71675E]">Set publish time or publish now</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6B2837] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  5
                </span>
                <div>
                  <div className="font-semibold text-[#292320]">Track Engagement</div>
                  <div className="text-[11px] text-[#71675E]">Monitor reach and interactions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Database & Data Model */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
            <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider mb-2.5">Database & Data Model</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EEE7DD]">
                <code className="text-[11px] font-mono font-medium text-[#6B2837] bg-[#F7F3EC] px-1.5 py-0.5 rounded">
                  platform_notices
                </code>
                <span className="text-[10px] text-[#71675E]">Main notice info</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EEE7DD]">
                <code className="text-[11px] font-mono font-medium text-[#6B2837] bg-[#F7F3EC] px-1.5 py-0.5 rounded">
                  notice_recipients
                </code>
                <span className="text-[10px] text-[#71675E]">Audience & delivery status</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EEE7DD]">
                <code className="text-[11px] font-mono font-medium text-[#6B2837] bg-[#F7F3EC] px-1.5 py-0.5 rounded">
                  notice_comments
                </code>
                <span className="text-[10px] text-[#71675E]">Comments and replies</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EEE7DD]">
                <code className="text-[11px] font-mono font-medium text-[#6B2837] bg-[#F7F3EC] px-1.5 py-0.5 rounded">
                  notice_reactions
                </code>
                <span className="text-[10px] text-[#71675E]">Likes & read receipts</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-[11px] font-mono font-medium text-[#6B2837] bg-[#F7F3EC] px-1.5 py-0.5 rounded">
                  notice_views
                </code>
                <span className="text-[10px] text-[#71675E]">Seen & audit telemetry</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#EEE7DD]">
              <span className="text-[11px] text-[#6B2837] font-medium hover:underline cursor-pointer flex items-center gap-1">
                View ER Diagram <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Communication Guideline Warning Callout */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-[#92400E]">Communication Guideline</div>
              <p className="text-[11px] text-[#B45309] mt-0.5 leading-relaxed">
                Use priority labels to highlight important notices and schedule announcements in advance to ensure timely delivery across all tenant restaurants and hotels.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: 3 Analytics Cards (Matching Screenshot 2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Notice Engagement Trend */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#292320]">Notice Engagement Trend</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-[#292320] tabular-nums">72.4%</span>
                <span className="text-[11px] text-[#059669] font-medium">+5.2% vs last month</span>
              </div>
            </div>
            <select className="text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded px-2 py-1 text-[#71675E] focus:outline-none">
              <option>This Month</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>

          {/* Trend SVG Area Chart */}
          <div className="relative h-44 w-full">
            <svg viewBox="0 0 400 150" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="30" x2="400" y2="30" stroke="#EEE7DD" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="400" y2="75" stroke="#EEE7DD" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="#EEE7DD" strokeDasharray="3 3" />

              {/* Area path */}
              <path
                d="M 0,130 Q 70,120 140,95 T 280,65 T 400,45 L 400,150 L 0,150 Z"
                fill="url(#engagementGrad)"
              />
              {/* Stroke line */}
              <path
                d="M 0,130 Q 70,120 140,95 T 280,65 T 400,45"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
              />
              {/* Data points */}
              <circle cx="280" cy="65" r="4" fill="#10B981" stroke="#FFFCF7" strokeWidth="2" />
            </svg>

            {/* Hover tooltip pill */}
            <div className="absolute top-8 left-[60%] -translate-x-1/2 bg-[#292320] text-white text-[10px] px-2 py-1 rounded shadow-sm">
              <div className="font-semibold">May 15, 2026</div>
              <div className="text-emerald-300">Engagement: 72.4%</div>
            </div>

            <div className="flex justify-between text-[10px] text-[#71675E] mt-2">
              <span>Oct 27</span>
              <span>Oct 29</span>
              <span>Oct 31</span>
              <span>Nov 2</span>
            </div>
          </div>
        </div>

        {/* Card 2: Channel Distribution */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#292320]">Channel Distribution</h3>
          </div>

          <div className="flex items-center justify-center gap-6 py-2">
            {/* Donut Chart */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {/* Channel 1: In-App (46%) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="5"
                  strokeDasharray="40 60"
                  strokeDashoffset="0"
                />
                {/* Channel 2: Email (4%) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="5"
                  strokeDasharray="4 96"
                  strokeDashoffset="-40"
                />
                {/* Channel 3: SMS (4%) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="5"
                  strokeDasharray="4 96"
                  strokeDashoffset="-44"
                />
                {/* Channel 4: Push (46%) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#6B2837"
                  strokeWidth="5"
                  strokeDasharray="40 60"
                  strokeDashoffset="-48"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-bold text-[#292320] tabular-nums">11</span>
                <span className="text-[9px] text-[#71675E]">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]"></span>
                  <span className="text-[#292320]">In-App</span>
                </div>
                <span className="text-[#71675E] text-[11px] tabular-nums">11 (45.8%)</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6]"></span>
                  <span className="text-[#292320]">Email</span>
                </div>
                <span className="text-[#71675E] text-[11px] tabular-nums">1 (4.2%)</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]"></span>
                  <span className="text-[#292320]">SMS</span>
                </div>
                <span className="text-[#71675E] text-[11px] tabular-nums">1 (4.2%)</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#6B2837]"></span>
                  <span className="text-[#292320]">Push</span>
                </div>
                <span className="text-[#71675E] text-[11px] tabular-nums">11 (45.8%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Recent Activity Feed */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#292320]">Recent Activity</h3>
            <span className="text-[11px] text-[#6B2837] font-medium hover:underline cursor-pointer">
              View All
            </span>
          </div>

          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 pb-2.5 border-b border-[#EEE7DD] last:border-0 last:pb-0">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#292320] truncate">{item.title}</div>
                    <div className="flex items-center justify-between text-[10px] text-[#71675E] mt-0.5">
                      <span>{item.status}</span>
                      <span className="tabular-nums">
                        {new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              notices.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 pb-2.5 border-b border-[#EEE7DD] last:border-0 last:pb-0">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#292320] truncate">{item.title}</div>
                    <div className="flex items-center justify-between text-[10px] text-[#71675E] mt-0.5">
                      <span>{item.status}</span>
                      <span className="tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Notice Detail / Preview Modal */}
      {previewNotice && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B2837] bg-[#F7F3EC] px-2 py-0.5 rounded">
                  {previewNotice.category}
                </span>
                <h3 className="text-lg font-bold text-[#292320] mt-1.5">{previewNotice.title}</h3>
                {previewNotice.subheading && (
                  <p className="text-xs text-[#71675E] mt-0.5">{previewNotice.subheading}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewNotice(null)}
                className="text-[#71675E] hover:text-[#292320] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F7F3EC] p-3.5 rounded-md border border-[#EEE7DD] text-xs text-[#292320] leading-relaxed mb-4 whitespace-pre-line">
              {previewNotice.body}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-5 border-t border-[#EEE7DD] pt-3">
              <div>
                <span className="text-[#71675E]">Audience:</span>{" "}
                <strong className="text-[#292320] font-medium">{previewNotice.audience}</strong>
              </div>
              <div>
                <span className="text-[#71675E]">Priority:</span>{" "}
                <strong className="text-[#292320] font-medium">{previewNotice.priority}</strong>
              </div>
              <div>
                <span className="text-[#71675E]">Channels:</span>{" "}
                <span className="font-medium text-[#292320]">{previewNotice.channels.join(", ")}</span>
              </div>
              <div>
                <span className="text-[#71675E]">Status:</span>{" "}
                <span className="font-medium text-[#059669]">{previewNotice.status}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPreviewNotice(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#EEE7DD] text-[#292320] rounded-md hover:bg-[#D8CEC1]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notice Modal */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-xl w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#292320]">Edit Announcement Notice</h3>
              <button
                onClick={() => setEditingNotice(null)}
                className="text-[#71675E] hover:text-[#292320] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Notice Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Subheading / Context</label>
                <input
                  type="text"
                  value={editForm.subheading}
                  onChange={(e) => setEditForm({ ...editForm, subheading: e.target.value })}
                  className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Detailed Message</label>
                <textarea
                  rows={4}
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                    className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Warning">Warning / Medium</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Audience</label>
                  <select
                    value={editForm.audience}
                    onChange={(e) => setEditForm({ ...editForm, audience: e.target.value })}
                    className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  >
                    <option value="ALL">All Properties</option>
                    <option value="RESTAURANT_ONLY">Restaurants Only</option>
                    <option value="HOTEL_ONLY">Hotels Only</option>
                    <option value="BOTH_ONLY">Selected Properties</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">
                  Administrative Audit Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Updated holiday schedule advisory timing"
                  value={editForm.auditReason}
                  onChange={(e) => setEditForm({ ...editForm, auditReason: e.target.value })}
                  className="w-full bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setEditingNotice(null)}
                  className="px-3.5 py-1.5 font-medium bg-[#EEE7DD] text-[#292320] rounded hover:bg-[#D8CEC1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-3.5 py-1.5 font-semibold bg-[#6B2837] text-white rounded hover:bg-[#521E2A] disabled:opacity-50"
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#292320]">Delete Notice Announcement</h3>
            </div>
            <p className="text-xs text-[#71675E] leading-relaxed mb-3">
              Are you sure you want to permanently delete <strong>{deleteTarget.title}</strong>? This action will remove the announcement across all tenant dashboards and will be logged in the immutable platform audit trail.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#292320] mb-1">
                Reason for deletion <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Expired promotional notice"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs font-medium bg-[#EEE7DD] text-[#292320] rounded hover:bg-[#D8CEC1]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNotice}
                disabled={deleteLoading || !deleteReason.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
