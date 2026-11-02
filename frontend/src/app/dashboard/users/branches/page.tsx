"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GitBranch, MapPin, RefreshCw } from "lucide-react";
import { Notify } from "@/lib/notify";

interface Branch {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: Branch | null;
}

export default function BranchAccessPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        fetch("/api/v1/users"),
        fetch("/api/v1/branches"),
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBranches(bData);
      }
    } catch (err) {
      console.error("Fetch branch access error:", err);
      Notify.failure("Failed to load users or branches directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBranchChange = async (userId: string, newBranchId: string) => {
    setUpdatingUserId(userId);

    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: newBranchId ? newBranchId : null }),
      });

      if (res.ok) {
        Notify.success("Branch assignment updated successfully.");
        fetchData();
      } else {
        const err = await res.json();
        Notify.failure(err.error || "Failed to update branch access");
      }
    } catch (err) {
      console.error("Update user branch error:", err);
      Notify.failure("Network error updating branch access");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1] p-5 rounded-lg">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#292320] flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-[#6B2837]" />
            Branch Access
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Assign employee scopes to specific branch desks or set them as global operations.
          </p>
        </div>
      </div>

      {/* 2. Employee List & Branch Assignment Table */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#71675E]">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6B2837] mb-2" />
            Loading employee directory...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#71675E]">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8CEC1] text-[#71675E] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Current Assignment</th>
                  <th className="py-3 px-3 text-right">Reassign Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE7DD]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#292320]">{u.name}</div>
                      <div className="text-[10px] text-[#71675E]">{u.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-[#FAF7F2] text-[#6B2837] border-[#D8CEC1] uppercase tracking-wider">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#292320]">
                      {u.branch ? (
                        <div className="flex items-center gap-1.5 text-[#28634B]">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{u.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-[#71675E] italic">Global / All Branches</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {updatingUserId === u.id ? (
                        <span className="text-[10px] text-[#71675E] flex items-center justify-end gap-1 font-bold">
                          <RefreshCw className="h-3 w-3 animate-spin text-[#6B2837]" /> Updating...
                        </span>
                      ) : (
                        <select
                          value={u.branch?.id || ""}
                          onChange={(e) => handleBranchChange(u.id, e.target.value)}
                          className="px-2.5 py-1.5 bg-[#FAF7F2] border border-[#D8CEC1] rounded-md text-xs font-semibold text-[#292320] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                        >
                          <option value="">Global / All Branches</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      )}
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
