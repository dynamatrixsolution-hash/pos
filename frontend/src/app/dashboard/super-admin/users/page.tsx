"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  Calendar,
  Lock,
  UserCheck,
  RefreshCw,
  UserX,
  Shield,
  Plus,
  Eye,
  KeyRound,
  Download,
  X,
  MoreVertical,
  ChevronDown,
  Check,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface PlatformUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  branchName: string;
  isActive: boolean;
  createdAt: string;
  lastActive: string | null;
}

interface BusinessOption {
  id: string;
  name: string;
  slug: string;
}

interface UsersCounts {
  total: number;
  active: number;
  pendingInvites: number;
  businessOwners: number;
  institutionAdmins?: number;
  suspended: number;
}

export default function SuperAdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [counts, setCounts] = useState<UsersCounts>({
    total: 0,
    active: 0,
    pendingInvites: 0,
    businessOwners: 0,
    suspended: 0,
  });

  // Tab & Filters matching Hospitality Requirements
  const [activeTab, setActiveTab] = useState<"all" | "admins" | "staff" | "pending" | "suspended">("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [businessFilter, setBusinessFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modals & Actions
  const [inspectUser, setInspectUser] = useState<PlatformUser | null>(null);
  const [showGenerateLoginModal, setShowGenerateLoginModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<PlatformUser | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);

  // Form states for Generate Login
  const [newLoginBusinessId, setNewLoginBusinessId] = useState("");
  const [newLoginName, setNewLoginName] = useState("");
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [newLoginRole, setNewLoginRole] = useState("OWNER");
  const [isSubmittingNewLogin, setIsSubmittingNewLogin] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchUsersData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (businessFilter !== "ALL") params.set("businessId", businessFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/v1/super-admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        if (data.businesses) setBusinesses(data.businesses);
        if (data.counts) {
          setCounts({
            total: data.counts.total ?? 0,
            active: data.counts.active ?? 0,
            pendingInvites: data.counts.pendingInvites ?? 0,
            businessOwners: data.counts.businessOwners ?? data.counts.institutionAdmins ?? 0,
            suspended: data.counts.suspended ?? 0,
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: err.error || "Failed to load user accounts" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network connection error loading users." });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, businessFilter, statusFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchUsersData();
    }
  }, [status, session, router, fetchUsersData]);

  // Tab Filtering
  const tabFilteredUsers = useMemo(() => {
    if (activeTab === "admins") {
      return users.filter((u) => u.role === "OWNER" || u.role === "SUPER_ADMIN");
    }
    if (activeTab === "staff") {
      return users.filter((u) => u.role !== "OWNER" && u.role !== "SUPER_ADMIN");
    }
    if (activeTab === "pending") {
      return [];
    }
    if (activeTab === "suspended") {
      return users.filter((u) => !u.isActive);
    }
    return users;
  }, [users, activeTab]);

  // Toggle user status
  const handleToggleUser = async (user: PlatformUser) => {
    try {
      const res = await fetch("/api/v1/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_STATUS",
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user status");

      setFeedback({ type: "success", message: data.message });
      fetchUsersData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Reset user password
  const handleResetPassword = async (user: PlatformUser) => {
    try {
      const res = await fetch("/api/v1/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_PASSWORD",
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setResetPasswordUser(user);
      setTempPasswordResult(data.tempPassword);
      setFeedback({ type: "success", message: `Password reset generated for ${user.email}.` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Generate new login
  const handleGenerateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginBusinessId || !newLoginName || !newLoginEmail) {
      setFeedback({ type: "error", message: "Please fill all required fields." });
      return;
    }

    setIsSubmittingNewLogin(true);
    try {
      const res = await fetch("/api/v1/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_LOGIN",
          businessId: newLoginBusinessId,
          name: newLoginName,
          email: newLoginEmail,
          role: newLoginRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate admin login");

      setShowGenerateLoginModal(false);
      setNewLoginName("");
      setNewLoginEmail("");
      setTempPasswordResult(data.tempPassword);
      setResetPasswordUser({
        name: data.user.name,
        email: data.user.email,
      } as any);

      setFeedback({ type: "success", message: "Login generated successfully." });
      fetchUsersData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmittingNewLogin(false);
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedUserIds.length === tabFilteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(tabFilteredUsers.map((u) => u.id));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Export
  const getExportOptions = (): ExportOptions => ({
    filename: `hospitality-users-${new Date().toISOString().split("T")[0]}`,
    title: "Users & Role Management Directory",
    subtitle: "Complete cross-tenant hospitality staff, managers, and business owners",
    dateRange: activeTab === "all" ? "All Platform Users" : `Segment: ${activeTab}`,
    columns: [
      { header: "User", key: "name", width: 22 },
      { header: "Username", key: "username", width: 16 },
      { header: "Role", key: "role", width: 16 },
      { header: "Restaurant / Property", key: "businessName", width: 24 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Status", key: "status", width: 12 },
      { header: "Last Active", key: "lastActive", width: 16 },
    ],
    data: tabFilteredUsers.map((u) => ({
      name: u.name,
      username: u.username,
      role: u.role,
      businessName: u.businessName,
      email: u.email,
      phone: u.phone,
      status: u.isActive ? "ACTIVE" : "SUSPENDED",
      lastActive: u.lastActive
        ? new Date(u.lastActive).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "Never",
    })),
  });

  return (
    <div className="space-y-5 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Primary Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Users & Role Management</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage platform users, restaurant owners, managers, staff access and role assignments across RestroInn.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateLoginModal(true)}
          className="px-3.5 py-2 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Generate Business Owner Login</span>
        </button>
      </div>

      {/* 2. Feedback Notification */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3. 5-KPI Cards Row (Hospitality Focus) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Users */}
        <div
          onClick={() => setActiveTab("all")}
          className={`bg-[#FFFCF7] rounded-lg border px-4 py-3 transition-all flex items-center justify-between gap-2 cursor-pointer ${
            activeTab === "all" ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Total Users</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {counts.total}
              </span>
              <span className="text-[10px] text-[#71675E] truncate">All time</span>
            </div>
          </div>
          <div className="text-[#71675E] shrink-0">
            <Users className="h-4.5 w-4.5 text-[#6B2837]" />
          </div>
        </div>

        {/* Active Users */}
        <div
          onClick={() => setActiveTab("all")}
          className="bg-[#FFFCF7] rounded-lg border px-4 py-3 border-[#D8CEC1]/80 hover:border-[#D8CEC1] transition-all flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Active Users</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {counts.active}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium truncate">Currently active</span>
            </div>
          </div>
          <div className="text-[#71675E] shrink-0">
            <UserCheck className="h-4.5 w-4.5 text-emerald-600" />
          </div>
        </div>

        {/* Pending Invites */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`bg-[#FFFCF7] rounded-lg border px-4 py-3 transition-all flex items-center justify-between gap-2 cursor-pointer ${
            activeTab === "pending" ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Pending Invites</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {counts.pendingInvites}
              </span>
              <span className="text-[10px] text-[#71675E] truncate">Awaiting setup</span>
            </div>
          </div>
          <div className="text-[#71675E] shrink-0">
            <Mail className="h-4.5 w-4.5 text-[#71675E]" />
          </div>
        </div>

        {/* Business Owners */}
        <div
          onClick={() => setActiveTab("admins")}
          className={`bg-[#FFFCF7] rounded-lg border px-4 py-3 transition-all flex items-center justify-between gap-2 cursor-pointer ${
            activeTab === "admins" ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Business Owners</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                {counts.businessOwners}
              </span>
              <span className="text-[10px] text-[#6B2837] font-medium truncate">Proprietors & GMs</span>
            </div>
          </div>
          <div className="text-[#71675E] shrink-0">
            <Shield className="h-4.5 w-4.5 text-[#6B2837]" />
          </div>
        </div>

        {/* Suspended Users */}
        <div
          onClick={() => setActiveTab("suspended")}
          className={`bg-[#FFFCF7] rounded-lg border px-4 py-3 transition-all flex items-center justify-between gap-2 cursor-pointer ${
            activeTab === "suspended" ? "border-rose-600 ring-1 ring-rose-600/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Suspended Users</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-rose-700 tabular-nums">
                {counts.suspended}
              </span>
              <span className="text-[10px] text-rose-600 truncate">No access</span>
            </div>
          </div>
          <div className="text-[#71675E] shrink-0">
            <UserX className="h-4.5 w-4.5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "all"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => setActiveTab("admins")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "admins"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Business Owners
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "staff"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Staff & Managers
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "pending"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Pending Invites <span className="ml-1 text-[11px] text-[#71675E]">{counts.pendingInvites}</span>
        </button>
        <button
          onClick={() => setActiveTab("suspended")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "suspended"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Suspended <span className="ml-1 text-[11px] text-[#71675E]">{counts.suspended}</span>
        </button>
      </div>

      {/* 5. Filter Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
          <input
            type="text"
            placeholder="Search by name, email, restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837] focus:border-[#6B2837] transition-all"
          />
        </div>

        {/* Dropdowns & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Role Dropdown with Floating Label */}
          <div className="relative">
            <span className="absolute -top-2 left-2 px-1 bg-[#FFFCF7] text-[10px] font-semibold text-[#71675E] z-10 pointer-events-none">
              Role
            </span>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Business Owner</option>
                <option value="MANAGER">Restaurant Manager</option>
                <option value="CASHIER">Cashier / Front Desk</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="SUPER_ADMIN">Platform Super Admin</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Restaurant / Property Dropdown with Floating Label */}
          <div className="relative">
            <span className="absolute -top-2 left-2 px-1 bg-[#FFFCF7] text-[10px] font-semibold text-[#71675E] z-10 pointer-events-none">
              Restaurant / Property
            </span>
            <div className="relative">
              <select
                value={businessFilter}
                onChange={(e) => setBusinessFilter(e.target.value)}
                className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] max-w-[190px] truncate cursor-pointer"
              >
                <option value="ALL">All Restaurants & Hotels</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Status Dropdown with Floating Label */}
          <div className="relative">
            <span className="absolute -top-2 left-2 px-1 bg-[#FFFCF7] text-[10px] font-semibold text-[#71675E] z-10 pointer-events-none">
              Status
            </span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchUsersData()}
            title="Refresh list"
            className="p-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Export Data Button */}
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />
        </div>
      </div>

      {/* 6. NexaEdu Pixel-Perfect Table */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
            <p className="text-xs text-[#71675E]">Loading users directory...</p>
          </div>
        ) : tabFilteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#292320]">No users found</p>
            <p className="text-[11px] text-[#71675E]">
              {search.trim()
                ? "No users matched your search criteria."
                : "No user accounts in this category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedUserIds.length === tabFilteredUsers.length && tabFilteredUsers.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Restaurant / Property</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Active</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {tabFilteredUsers.map((u) => {
                  const initials = u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();
                  const isSelected = selectedUserIds.includes(u.id);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#F7F3EC]/40 transition-colors ${
                        isSelected ? "bg-[#FAF2F4]/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                        />
                      </td>

                      {/* User (Avatar + Name + @username) */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#EEE7DD] text-[#6B2837] flex items-center justify-center font-bold text-xs shrink-0 border border-[#D8CEC1]">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-[#292320] leading-tight">{u.name}</div>
                            <div className="text-[11px] text-[#71675E] leading-tight mt-0.5 font-mono">
                              {u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role with Dot */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.role === "OWNER"
                                ? "bg-emerald-600"
                                : u.role === "SUPER_ADMIN"
                                ? "bg-[#6B2837]"
                                : u.role === "MANAGER"
                                ? "bg-blue-600"
                                : "bg-[#71675E]"
                            }`}
                          />
                          <span
                            className={
                              u.role === "OWNER"
                                ? "text-emerald-700 font-semibold"
                                : u.role === "SUPER_ADMIN"
                                ? "text-[#6B2837] font-semibold"
                                : "text-[#292320]"
                            }
                          >
                            {u.role === "OWNER"
                              ? "Business Owner"
                              : u.role === "SUPER_ADMIN"
                              ? "Platform Super Admin"
                              : u.role === "MANAGER"
                              ? "Restaurant Manager"
                              : u.role === "CASHIER"
                              ? "Cashier / Front Desk"
                              : u.role === "ACCOUNTANT"
                              ? "Accountant"
                              : u.role}
                          </span>
                        </div>
                      </td>

                      {/* Restaurant / Property */}
                      <td className="py-3 px-3 text-[#292320] font-medium max-w-[200px] truncate">
                        {u.businessName}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3 text-[#71675E] font-mono text-[11px] max-w-[180px] truncate">
                        {u.email}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-3 text-[#71675E] tabular-nums font-mono text-[11px]">
                        {u.phone}
                      </td>

                      {/* Status matching NexaEdu ◎ ACTIVE */}
                      <td className="py-3 px-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                            <span className="h-2 w-2 rounded-full border border-emerald-500 flex items-center justify-center shrink-0">
                              <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            </span>
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                            <span className="h-2 w-2 rounded-full border border-rose-500 flex items-center justify-center shrink-0">
                              <span className="h-1 w-1 rounded-full bg-rose-500" />
                            </span>
                            <span>SUSPENDED</span>
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-3 text-[#71675E] tabular-nums text-[11px]">
                        {u.lastActive
                          ? new Date(u.lastActive).toLocaleDateString(undefined, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-[#71675E]">
                          <button
                            onClick={() => setInspectUser(u)}
                            title="Inspect user details"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#292320] transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            title="Reset password"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#292320] transition-colors cursor-pointer"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleUser(u)}
                            title={u.isActive ? "Suspend user account" : "Activate user account"}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              u.isActive
                                ? "hover:bg-rose-50 hover:text-rose-600"
                                : "hover:bg-emerald-50 hover:text-emerald-600"
                            }`}
                          >
                            {u.isActive ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setInspectUser(u)}
                            title="More options"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#292320] transition-colors cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Generate Business Admin Login */}
      {showGenerateLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Generate Business Owner Login</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Provision direct platform credentials for a restaurant owner or general manager.
                </p>
              </div>
              <button
                onClick={() => setShowGenerateLoginModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Target Restaurant / Property <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={newLoginBusinessId}
                  onChange={(e) => setNewLoginBusinessId(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:ring-1 focus:ring-[#6B2837]"
                >
                  <option value="">Select a restaurant or hotel property...</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Owner / Manager Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Shrestha"
                  value={newLoginName}
                  onChange={(e) => setNewLoginName(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Email Address <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@restaurant.com"
                  value={newLoginEmail}
                  onChange={(e) => setNewLoginEmail(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Assign Role
                </label>
                <select
                  value={newLoginRole}
                  onChange={(e) => setNewLoginRole(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                >
                  <option value="OWNER">Business Owner (Proprietor)</option>
                  <option value="MANAGER">Restaurant Manager</option>
                  <option value="CASHIER">Cashier / Front Desk</option>
                  <option value="ACCOUNTANT">Accountant</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowGenerateLoginModal(false)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-[#292320] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewLogin}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingNewLogin ? "Generating..." : "Generate & Provision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Temporary Password Result */}
      {tempPasswordResult && resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Credentials Generated</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  For: <span className="font-semibold text-[#292320]">{resetPasswordUser.email}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setTempPasswordResult(null);
                  setResetPasswordUser(null);
                }}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAF2F4] border border-[#E8D7DA] rounded-md space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-[#6B2837] tracking-wider">
                Temporary Password
              </p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono font-bold text-[#292320] select-all">
                  {tempPasswordResult}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordResult);
                    alert("Password copied to clipboard!");
                  }}
                  className="px-2 py-1 text-[10px] bg-white border border-[#D8CEC1] rounded font-semibold text-[#6B2837] hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#71675E]">
              Share this password with the business owner or staff member. They will be prompted to change it upon first login.
            </p>

            <div className="flex justify-end pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => {
                  setTempPasswordResult(null);
                  setResetPasswordUser(null);
                }}
                className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Inspect User */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">User Account Profile</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  ID: <span className="font-mono text-[#292320]">{inspectUser.id}</span>
                </p>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Identity</p>
                <p className="text-sm font-bold text-[#292320]">{inspectUser.name}</p>
                <p className="text-[#71675E] font-mono">{inspectUser.username} • {inspectUser.email}</p>
                <p className="text-[#71675E]">Phone: {inspectUser.phone}</p>
              </div>

              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Assignment & Role</p>
                <p className="font-semibold text-[#292320]">Role: {inspectUser.role}</p>
                <p className="text-[#71675E]">Restaurant / Property: {inspectUser.businessName}</p>
                <p className="text-[#71675E]">Branch: {inspectUser.branchName}</p>
              </div>

              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Timestamps & Security</p>
                <p className="text-[#71675E]">Status: <span className={inspectUser.isActive ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>{inspectUser.isActive ? "ACTIVE" : "SUSPENDED"}</span></p>
                <p className="text-[#71675E]">Registered: {new Date(inspectUser.createdAt).toLocaleString()}</p>
                <p className="text-[#71675E]">Last Active: {inspectUser.lastActive ? new Date(inspectUser.lastActive).toLocaleString() : "Never"}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setInspectUser(null)}
                className="px-3.5 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = inspectUser;
                  setInspectUser(null);
                  handleResetPassword(target);
                }}
                className="px-3.5 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
