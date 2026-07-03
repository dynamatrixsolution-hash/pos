"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GitBranch, User, MapPin, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

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
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        fetch("/api/v1/users"),
        fetch("/api/v1/branches")
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
      setErrorMsg("Failed to load users or branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBranchChange = async (userId: string, newBranchId: string) => {
    setUpdatingUserId(userId);
    setErrorMsg("");
    setSuccessMsg("");
    
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: newBranchId ? newBranchId : null }),
      });

      if (res.ok) {
        setSuccessMsg("Branch access updated successfully.");
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update branch access");
      }
    } catch (err) {
      console.error("Update user branch error:", err);
      setErrorMsg("Network error updating branch access");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            Branch Access
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign employee scopes to specific branch desks or set them as global operations.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-4 rounded-xl flex items-start gap-2.5">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Employee List & Branch Assignment table */}
      <div className="bg-card border border-border rounded-2xl p-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Loading employee directory...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Current Assignment</th>
                  <th className="py-3 px-3 text-right">Reassign Desk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/20">
                    <td className="py-3 px-3">
                      <div className="font-bold text-foreground">{u.name}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-secondary text-foreground border-border uppercase tracking-wider">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {u.branch ? (
                        <div className="flex items-center gap-1 text-primary">
                          <MapPin className="h-3.5 w-3.5" />
                          {u.branch.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Global / All Branches</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {updatingUserId === u.id ? (
                        <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 font-bold">
                          <RefreshCw className="h-3 w-3 animate-spin text-primary" /> Updating...
                        </span>
                      ) : (
                        <select
                          value={u.branch?.id || ""}
                          onChange={(e) => handleBranchChange(u.id, e.target.value)}
                          className="px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
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
