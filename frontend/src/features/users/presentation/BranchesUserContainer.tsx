"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usersRepository } from "../repositories/users.repository";
import { apiClient } from "@/core/api/api-client";
import { GitBranch, MapPin, RefreshCw, Loader2, Check } from "lucide-react";
import { Notify } from "@/lib/notify";

export function BranchesUserContainer() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [uRes, bRes] = await Promise.all([
        usersRepository.fetchUsers(),
        apiClient.settings.getBranches(),
      ]);
      setUsers(uRes);
      setBranches(bRes.branches || []);
    } catch (err: any) {
      console.error("Fetch branch access error:", err);
      Notify.error("Failed to load staff or branches directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBranchChange = async (userId: string, newBranchId: string) => {
    try {
      setUpdatingUserId(userId);
      await usersRepository.updateUser(userId, { branchId: newBranchId || null });
      Notify.success("Staff branch assignment updated");
      await loadData();
    } catch (err: any) {
      console.error("Failed to update branch:", err);
      Notify.error(err.message || "Failed to update branch assignment");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Staff Branch Assignments</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Restrict cashiers and store managers to designated physical store outlets and warehouses
          </p>
        </div>

        <button
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading branch access matrix...
        </div>
      ) : users.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <GitBranch className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No staff accounts found</h3>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Employee</th>
                <th className="py-2.5 px-3 font-semibold">System Role</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Branch / Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#292320]">{u.name}</div>
                    <div className="text-[11px] text-[#71675E]">{u.email}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#F7F3EC] text-[#292320] border border-[#EEE7DD]">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.role === "OWNER" || u.role === "SUPER_ADMIN" ? (
                      <span className="text-[11px] font-medium text-[#28634B]">
                        All Outlets (Global Unrestricted Access)
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 max-w-xs">
                        <select
                          disabled={updatingUserId === u.id}
                          value={u.branch?.id || u.branchId || ""}
                          onChange={(e) => handleBranchChange(u.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                        >
                          <option value="">Unassigned (No Branch)</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} {b.isMain ? "(HQ)" : ""}
                            </option>
                          ))}
                        </select>
                        {updatingUserId === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B2837]" />}
                      </div>
                    )}
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

