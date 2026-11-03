"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Search,
  Eye,
  KeyRound,
  UserX,
  UserCheck,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  Check,
  Copy,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";

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

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<"all" | "admins" | "staff" | "suspended">("all");
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
        toast.error(err.error || "Failed to load user accounts");
      }
    } catch {
      toast.error("Network connection error loading users.");
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

      toast.success(data.message || "User status updated.");
      fetchUsersData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user status");
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
      toast.success(`Temporary credentials generated for ${user.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
  };

  // Generate new login
  const handleGenerateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginBusinessId || !newLoginName || !newLoginEmail) {
      toast.error("Please fill all required fields.");
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
      if (!res.ok) throw new Error(data.error || "Failed to generate login");

      setShowGenerateLoginModal(false);
      setNewLoginName("");
      setNewLoginEmail("");
      setTempPasswordResult(data.tempPassword);
      setResetPasswordUser({
        name: data.user.name,
        email: data.user.email,
      } as any);

      toast.success("Login generated successfully.");
      fetchUsersData();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate login");
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
    filename: `platform-users-${new Date().toISOString().split("T")[0]}`,
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
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* 1. Header with Breadcrumb & Primary Action Buttons */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <div className="text-[11px] font-semibold text-[#71675E] tracking-tight mb-0.5">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
              Platform
            </Link>{" "}
            <span className="text-[#D8CEC1] mx-1">/</span> Users & access
          </div>
          <h1 className="text-base font-bold text-[#292320] tracking-tight">
            Users & access
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchUsersData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3 h-3 text-[#71675E] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export dataset"
            variant="outline"
          />

          <button
            onClick={() => setShowGenerateLoginModal(true)}
            className="px-2.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Generate Owner Login</span>
          </button>
        </div>
      </div>

      {/* 2. Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Total users</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#292320] tabular-nums font-mono">{counts.total}</span>
            <span className="text-[10px] text-[#71675E]">All accounts</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Active operators</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-emerald-800 tabular-nums font-mono">{counts.active}</span>
            <span className="text-[10px] text-emerald-700">Currently active</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Business owners</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#6B2837] tabular-nums font-mono">{counts.businessOwners}</span>
            <span className="text-[10px] text-[#71675E]">Proprietors & GMs</span>
          </div>
        </div>

        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">Suspended accounts</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#9C3232] tabular-nums font-mono">{counts.suspended}</span>
            <span className="text-[10px] text-[#9C3232]">Access restricted</span>
          </div>
        </div>
      </div>

      {/* 3. Main Table Card */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
        {/* Unified Category Tabs & Filter Toolbar Header */}
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#FFFCF7]">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "all"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <Users className="w-3 h-3" />
              <span>All users</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({counts.total})</span>
            </button>

            <button
              onClick={() => setActiveTab("admins")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "admins"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <span>Owners & GMs</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({counts.businessOwners})</span>
            </button>

            <button
              onClick={() => setActiveTab("staff")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "staff"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <span>Staff & cashiers</span>
            </button>

            <button
              onClick={() => setActiveTab("suspended")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "suspended"
                  ? "bg-[#6B2837] text-white"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <span>Suspended</span>
              <span className="text-[10px] opacity-80 tabular-nums font-mono">({counts.suspended})</span>
            </button>
          </div>

          {/* Search & Filter Dropdowns */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71675E]" />
              <input
                type="text"
                placeholder="Search name, email, property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="CASHIER">Cashier</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>

            {/* Property Filter */}
            <select
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] max-w-[140px] truncate cursor-pointer"
            >
              <option value="ALL">All Properties</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* High-density Table */}
        {loading ? (
          <div className="py-12 text-center text-[#71675E]">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-[#6B2837] border-t-transparent rounded-full mb-1"></div>
            <div className="text-xs">Loading user accounts...</div>
          </div>
        ) : tabFilteredUsers.length === 0 ? (
          <div className="py-12 text-center text-[#71675E]">
            <p className="text-xs font-semibold text-[#292320]">No users found</p>
            <p className="text-[11px] text-[#71675E] mt-0.5">
              {search.trim()
                ? "No user accounts matched your search criteria."
                : "No users in this category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold">
                  <th className="py-1.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedUserIds.length === tabFilteredUsers.length && tabFilteredUsers.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                    />
                  </th>
                  <th className="py-1.5 px-3">User</th>
                  <th className="py-1.5 px-3">Role</th>
                  <th className="py-1.5 px-3">Property</th>
                  <th className="py-1.5 px-3">Contact</th>
                  <th className="py-1.5 px-3">Status</th>
                  <th className="py-1.5 px-3">Last active</th>
                  <th className="py-1.5 px-3 text-right">Actions</th>
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
                      className={`hover:bg-[#F7F3EC]/50 transition-colors ${
                        isSelected ? "bg-[#FAF2F4]/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-1.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                        />
                      </td>

                      {/* User (Avatar + Name + @username) */}
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-[#292320] text-[#FFFCF7] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-[#292320] leading-tight truncate">{u.name}</div>
                            <div className="text-[10px] text-[#71675E] leading-tight font-mono truncate">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            u.role === "OWNER"
                              ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                              : u.role === "SUPER_ADMIN"
                              ? "bg-[#6B2837] text-white"
                              : "bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1]"
                          }`}
                        >
                          {u.role === "OWNER"
                            ? "Owner"
                            : u.role === "SUPER_ADMIN"
                            ? "Super Admin"
                            : u.role === "MANAGER"
                            ? "Manager"
                            : u.role === "CASHIER"
                            ? "Cashier"
                            : u.role === "ACCOUNTANT"
                            ? "Accountant"
                            : u.role}
                        </span>
                      </td>

                      {/* Property */}
                      <td className="py-1.5 px-3 text-[#292320] font-medium max-w-[180px] truncate">
                        {u.businessName}
                      </td>

                      {/* Contact */}
                      <td className="py-1.5 px-3 text-[#71675E] font-mono text-[11px] whitespace-nowrap">
                        <div>{u.email}</div>
                        {u.phone && <div className="text-[10px] text-[#71675E]">{u.phone}</div>}
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                            <Check className="h-2.5 w-2.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]">
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-1.5 px-3 text-[#71675E] tabular-nums font-mono text-[11px] whitespace-nowrap">
                        {u.lastActive
                          ? new Date(u.lastActive).toLocaleDateString(undefined, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 text-[#71675E]">
                          <button
                            onClick={() => setInspectUser(u)}
                            title="Inspect details"
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
                              <UserX className="h-3.5 w-3.5 text-rose-600" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                            )}
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
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#292320]">Generate Business Owner Login</h3>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  Provision direct platform credentials for a restaurant owner or general manager.
                </p>
              </div>
              <button
                onClick={() => setShowGenerateLoginModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleGenerateLogin} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Target property <span className="text-[#6B2837]">*</span>
                </label>
                <select
                  required
                  value={newLoginBusinessId}
                  onChange={(e) => setNewLoginBusinessId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
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
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Owner / Manager full name <span className="text-[#6B2837]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Shrestha"
                  value={newLoginName}
                  onChange={(e) => setNewLoginName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Email address <span className="text-[#6B2837]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@restaurant.com"
                  value={newLoginEmail}
                  onChange={(e) => setNewLoginEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] mb-1">
                  Assign role
                </label>
                <select
                  value={newLoginRole}
                  onChange={(e) => setNewLoginRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                >
                  <option value="OWNER">Business Owner (Proprietor)</option>
                  <option value="MANAGER">Restaurant Manager</option>
                  <option value="CASHIER">Cashier / Front Desk</option>
                  <option value="ACCOUNTANT">Accountant</option>
                </select>
              </div>

              <div className="flex justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowGenerateLoginModal(false)}
                  className="px-2.5 py-1 border border-[#D8CEC1] text-[#292320] text-xs font-semibold rounded-md hover:bg-[#EEE7DD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewLogin}
                  className="px-3 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer shadow-2xs"
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
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-sm w-full p-4 space-y-3 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#292320]">Credentials Generated</h3>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  For: <span className="font-semibold text-[#292320]">{resetPasswordUser.email}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setTempPasswordResult(null);
                  setResetPasswordUser(null);
                }}
                className="text-[#71675E] hover:text-[#292320] p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-2.5 bg-[#FAF2F4] border border-[#E8D7DA] rounded-md space-y-1">
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
                    toast.success("Password copied to clipboard");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white border border-[#D8CEC1] rounded font-semibold text-[#6B2837] hover:bg-[#F7F3EC] cursor-pointer"
                >
                  <Copy className="h-2.5 w-2.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#71675E] leading-relaxed">
              Share this password with the user. They will be prompted to change it upon first login.
            </p>

            <div className="flex justify-end pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => {
                  setTempPasswordResult(null);
                  setResetPasswordUser(null);
                }}
                className="px-3 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] cursor-pointer"
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
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#292320]">User Account Profile</h3>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  ID: <span className="font-mono text-[#292320]">{inspectUser.id}</span>
                </p>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="text-[#71675E] hover:text-[#292320] p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-0.5">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Identity</p>
                <p className="font-bold text-[#292320]">{inspectUser.name}</p>
                <p className="text-[#71675E] font-mono text-[11px]">@{inspectUser.username} • {inspectUser.email}</p>
                <p className="text-[#71675E] font-mono text-[11px]">Phone: {inspectUser.phone || "None"}</p>
              </div>

              <div className="p-2.5 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-0.5">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Assignment & Role</p>
                <p className="font-semibold text-[#292320]">Role: {inspectUser.role}</p>
                <p className="text-[#71675E]">Property: {inspectUser.businessName}</p>
                <p className="text-[#71675E]">Branch: {inspectUser.branchName || "Main"}</p>
              </div>

              <div className="p-2.5 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-0.5">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Timestamps & Security</p>
                <p className="text-[#71675E]">
                  Status:{" "}
                  <span className={inspectUser.isActive ? "text-emerald-800 font-bold" : "text-[#9C3232] font-bold"}>
                    {inspectUser.isActive ? "ACTIVE" : "SUSPENDED"}
                  </span>
                </p>
                <p className="text-[#71675E] font-mono text-[11px]">
                  Registered: {new Date(inspectUser.createdAt).toLocaleDateString()}
                </p>
                <p className="text-[#71675E] font-mono text-[11px]">
                  Last Active: {inspectUser.lastActive ? new Date(inspectUser.lastActive).toLocaleString() : "Never"}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setInspectUser(null)}
                className="px-2.5 py-1 border border-[#D8CEC1] text-xs font-semibold rounded-md bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = inspectUser;
                  setInspectUser(null);
                  handleResetPassword(target);
                }}
                className="px-2.5 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Reset Password</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
