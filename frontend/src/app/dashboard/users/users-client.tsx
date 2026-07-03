"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Plus, UserPlus, Shield, MapPin, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
  createdAt: string;
}

interface BranchItem {
  id: string;
  name: string;
}

const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Minimum 6 characters"),
  phone: z.string().optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER", "SALESPERSON", "DELIVERY"]),
  branchId: z.string().optional().nullable(),
});

type UserInputs = z.infer<typeof userSchema>;

export default function UsersClient() {
  const { data: session } = useSession();
  const activeUserRole = (session?.user as any)?.role || "CASHIER";
  const isOwnerOrAdmin = activeUserRole === "OWNER" || activeUserRole === "SUPER_ADMIN" || activeUserRole === "MANAGER";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserInputs>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: "CASHIER",
      branchId: "",
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, bRes] = await Promise.all([
        fetch(`/api/v1/users?search=${search}`),
        fetch("/api/v1/branches")
      ]);
      if (uRes.ok) {
        const data = await uRes.json();
        setUsers(data.users || []);
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBranches(bData);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: UserInputs) => {
    setSubmitError("");
    
    // For roles that don't need a specific branch, nullify it if left empty
    const payload = {
      ...data,
      branchId: data.branchId ? data.branchId : null,
    };

    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Failed to create user");
      }

      setIsModalOpen(false);
      reset();
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case "OWNER":
      case "SUPER_ADMIN":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "MANAGER":
        return "bg-primary/10 text-primary border-primary/20";
      case "CASHIER":
        return "bg-secondary text-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions */}
      <div className="bg-card border border-border p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        
        {isOwnerOrAdmin && (
          <button
            onClick={() => {
              reset();
              setSubmitError("");
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider whitespace-nowrap"
          >
            <UserPlus className="h-4.5 w-4.5" />
            Invite Employee
          </button>
        )}
      </div>

      {/* Main List */}
      <div className="bg-card border border-border rounded-2xl p-5">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading user directory...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">Employee Details</th>
                  <th className="py-3 px-2 text-center">System Role</th>
                  <th className="py-3 px-2">Assigned Branch</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2">
                      <div className="font-bold text-foreground">{user.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Mail className="w-3 w-3" /> {user.email}</span>
                        {user.phone && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Phone className="w-3 w-3" /> {user.phone}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border flex items-center justify-center gap-1 w-fit mx-auto ${getRoleBadgeColor(user.role)}`}>
                        <Shield className="h-3 w-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {user.branch ? (
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {user.branch.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[10px]">All Branches / HQ</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-primary' : 'bg-destructive'}`} />
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground text-[10px] font-semibold">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-border my-8">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary"/> Add New Employee</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Create a new user account. They will use their email and password to log in.
            </p>

            {submitError && <div className="p-3 mb-4 text-xs bg-destructive/10 text-destructive rounded-lg font-bold border border-destructive/20">{submitError}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    {...register("name")}
                    className={`w-full px-3 py-2 bg-background border rounded-lg text-xs focus:outline-none focus:ring-1 ${errors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
                  />
                  {errors.name && <span className="text-[9px] text-destructive">{errors.name.message}</span>}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    {...register("email")}
                    className={`w-full px-3 py-2 bg-background border rounded-lg text-xs focus:outline-none focus:ring-1 ${errors.email ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
                  />
                  {errors.email && <span className="text-[9px] text-destructive">{errors.email.message}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    {...register("password")}
                    className={`w-full px-3 py-2 bg-background border rounded-lg text-xs focus:outline-none focus:ring-1 ${errors.password ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'}`}
                  />
                  {errors.password && <span className="text-[9px] text-destructive">{errors.password.message}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phone (Optional)</label>
                  <input
                    type="text"
                    {...register("phone")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Access Role</label>
                  <select
                    {...register("role")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="CASHIER">CASHIER (POS Only)</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="STOREKEEPER">STOREKEEPER</option>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned Branch</label>
                  <select
                    {...register("branchId")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Branches / Global</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
