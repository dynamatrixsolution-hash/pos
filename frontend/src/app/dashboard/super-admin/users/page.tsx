"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  CheckCircle,
  AlertTriangle,
  Mail,
  Phone,
  Building,
  Shield,
  Calendar,
  Lock,
  UserCheck,
} from "lucide-react";

interface OwnerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessSlug: string;
  isActive: boolean;
  createdAt: string;
}

interface ActiveUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  businessName: string;
  branchName: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"owners" | "active">("owners");
  const [owners, setOwners] = useState<OwnerItem[]>([]);
  const [users, setUsers] = useState<ActiveUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadUsersData();
    }
  }, [status, session, router]);

  const loadUsersData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/users");
      if (res.ok) {
        const data = await res.json();
        setOwners(data.businessOwners || []);
        setUsers(data.activeUsers || []);
      }
    } catch (err) {
      console.error("Load users logs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentActive: boolean) => {
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/action-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_USER_ACTIVE",
          payload: { userId, isActive: !currentActive },
        }),
      });

      // Quick local mock update to feel responsive
      setOwners(owners.map(o => o.id === userId ? { ...o, isActive: !currentActive } : o));
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentActive } : u));
      
      setActionSuccess(`User account status updated successfully`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      setActionError("Failed to update status");
    }
  };

  const filteredOwners = owners.filter((o) => {
    return o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase()) ||
      o.businessName.toLowerCase().includes(search.toLowerCase());
  });

  const filteredUsers = users.filter((u) => {
    return u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.businessName.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Aggregating platform user directories...</p>
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
            <Users className="h-5.5 w-5.5 text-blue-600" /> Platform User Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit registered business owners, cashiers, managers, and monitor tenant account logins.
          </p>
        </div>
      </div>

      {/* 2. Messages */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-bold border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {actionSuccess}
        </div>
      )}

      {/* 3. Tab Selection */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => { setActiveTab("owners"); setSearch(""); }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "owners" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Business Owners ({owners.length})
        </button>
        <button
          onClick={() => { setActiveTab("active"); setSearch(""); }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "active" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Active Platform Users ({users.length})
        </button>
      </div>

      {/* 4. Controls */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-450" />
          <input
            type="text"
            placeholder={activeTab === "owners" ? "Search owners name, email or business..." : "Search user name, email, role..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* 5. USER TABLES */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 overflow-hidden">
        {activeTab === "owners" ? (
          /* OWNERS TAB */
          filteredOwners.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-450">No business owners found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3 px-2">Owner Profile</th>
                    <th className="py-3 px-2">Contact Info</th>
                    <th className="py-3 px-2">Assigned Business</th>
                    <th className="py-3 px-2 text-center">Registrar Date</th>
                    <th className="py-3 px-2 text-right">Login Allowed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOwners.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2">
                        <div className="font-bold text-slate-700">{o.name}</div>
                        <span className="text-[9px] text-slate-400 font-mono">{o.id}</span>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-slate-650">
                            <Mail className="w-3 h-3 text-slate-400" /> {o.email}
                          </span>
                          <span className="flex items-center gap-1 text-slate-450">
                            <Phone className="w-3 h-3 text-slate-400" /> {o.phone}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="font-bold text-slate-700 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-blue-500" /> {o.businessName}
                        </div>
                        <span className="text-[9px] text-slate-400 ml-4.5 block">slug: {o.businessSlug}</span>
                      </td>
                      <td className="py-3.5 px-2 text-center text-slate-450 font-medium">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <button
                          onClick={() => handleToggleUserStatus(o.id, o.isActive)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider cursor-pointer transition-colors ${
                            o.isActive
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/60"
                              : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100/60"
                          }`}
                        >
                          {o.isActive ? "ACTIVE" : "DISABLED"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ACTIVE USERS TAB */
          filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-450">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3 px-2">User Details</th>
                    <th className="py-3 px-2">Tenant Business</th>
                    <th className="py-3 px-2">Workstation Branch</th>
                    <th className="py-3 px-2 text-center">System Role</th>
                    <th className="py-3 px-2 text-right">Allowed Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2">
                        <div className="font-bold text-slate-700">{u.name}</div>
                        <div className="text-[10px] text-slate-450 mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-2 font-bold text-slate-700">
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" /> {u.businessName}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 font-medium text-slate-600">{u.branchName}</td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          u.role === "OWNER"
                            ? "bg-blue-50 text-blue-600"
                            : u.role === "MANAGER"
                            ? "bg-purple-50 text-purple-600"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase cursor-pointer ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50"
                              : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100/50"
                          }`}
                        >
                          {u.isActive ? "ACTIVE" : "BLOCKED"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
