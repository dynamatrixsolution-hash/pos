"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usersRepository } from "../repositories/users.repository";
import { apiClient } from "@/core/api/api-client";
import {
  Activity,
  RefreshCw,
  Search,
  Loader2,
  User,
  Building2,
} from "lucide-react";

export function ActivityLogsContainer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMetadata = useCallback(async () => {
    try {
      const [uRes, bRes] = await Promise.all([
        usersRepository.fetchUsers(),
        apiClient.settings.getBranches(),
      ]);
      setUsers(uRes);
      setBranches(bRes.branches || []);
    } catch (err) {
      console.error("Failed to load user activity metadata:", err);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersRepository.fetchUserActivity({
        search: search || undefined,
        userId: selectedUser !== "ALL" ? selectedUser : undefined,
        branchId: selectedBranch !== "ALL" ? selectedBranch : undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedUser, selectedBranch]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Staff Activity & Audit Trail</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Real-time chronological log of cashier actions, logins, bill modifications and admin overrides
          </p>
        </div>

        <button
          onClick={() => loadActivity()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#FFFCF7] p-3 border border-[#EEE7DD] rounded-lg">
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
        >
          <option value="ALL">All Staff Members</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
        >
          <option value="ALL">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action or details..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
          />
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading staff activity logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Activity className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No activity records found</h3>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Time</th>
                <th className="py-2.5 px-3 font-semibold">User</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Details</th>
                <th className="py-2.5 px-3 font-semibold text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  <td className="py-2.5 px-3 tabular-nums text-[#71675E]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#292320]">{log.user?.name || "System"}</div>
                    <div className="text-[10px] text-[#71675E]">{log.user?.role || "Staff"}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[11px] font-semibold text-[#6B2837]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#71675E] max-w-md truncate">
                    {typeof log.details === "object" ? JSON.stringify(log.details) : log.details || "—"}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-mono text-[#71675E]">
                    {log.ipAddress || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

