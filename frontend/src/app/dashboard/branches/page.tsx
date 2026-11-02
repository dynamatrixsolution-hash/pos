"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  Store,
  Plus,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Power,
  Edit2,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const { data: session, update } = useSession();
  
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editBranchId, setEditBranchId] = React.useState<string | null>(null);

  const userRole = (session?.user as any)?.role || "CASHIER";
  const activeBranchId = (session?.user as any)?.branchId;
  const isOwner = userRole === "OWNER" || userRole === "SUPER_ADMIN";

  const fetchBranches = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to load branches");
      }
    } catch (err) {
      console.error("Fetch branches error:", err);
      setErrorMsg("Network error loading branches");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    if (!name.trim()) {
      setErrorMsg("Branch name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editBranchId ? `/api/v1/branches/${editBranchId}` : "/api/v1/branches";
      const method = editBranchId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address }),
      });

      if (res.ok) {
        setSuccessMsg(editBranchId ? `Branch details updated!` : `Branch "${name}" successfully registered!`);
        setName("");
        setPhone("");
        setAddress("");
        setEditBranchId(null);
        setShowAddForm(false);
        fetchBranches();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to save branch");
      }
    } catch (err) {
      console.error("Save branch error:", err);
      setErrorMsg("Network error saving branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBranchSwitch = async (branchId: string) => {
    try {
      await update({ branchId });
      setSuccessMsg("Switched active branch. Reloading workspace context...");
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error("Failed to switch branch context:", err);
      setErrorMsg("Failed to switch active branch context");
    }
  };

  const handleToggleActive = async (branchId: string, currentStatus: boolean) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/v1/branches/${branchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setSuccessMsg("Branch status updated successfully.");
        fetchBranches();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update branch status");
      }
    } catch (err) {
      console.error("Toggle branch active error:", err);
      setErrorMsg("Network error updating branch status");
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!window.confirm(`Are you sure you want to delete branch "${branchName}"? This action cannot be undone.`)) {
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/v1/branches/${branchId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg(`Branch "${branchName}" has been deleted.`);
        fetchBranches();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to delete branch");
      }
    } catch (err) {
      console.error("Delete branch error:", err);
      setErrorMsg("Network error deleting branch");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-lg">
        <div>
          <h1 className="text-2xl font-black">Multi-Branch Outlets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your retail locations, review addresses, and switch operating contexts.
          </p>
        </div>
        {isOwner && !showAddForm && (
          <button
            onClick={() => {
              setEditBranchId(null);
              setName("");
              setPhone("");
              setAddress("");
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-md text-xs font-black shadow-sm transition-all uppercase tracking-wider cursor-pointer border-none"
          >
            <Plus className="h-4.5 w-4.5" />
            Add New Branch
          </button>
        )}
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-md flex items-start gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-4 rounded-md flex items-start gap-2.5">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add/Edit Branch Dialog Form */}
      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
            <Store className="h-4.5 w-4.5 text-[#064E3B]" />
            {editBranchId ? "Edit Branch Outlet Details" : "Branch Outlet Setup Form"}
          </h2>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Downtown Express Outlet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-md text-xs text-foreground font-semibold placeholder:text-muted-foreground focus:ring-1 focus:ring-[#064E3B] outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="e.g. +1 555-0199"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-md text-xs text-foreground font-semibold placeholder:text-muted-foreground focus:ring-1 focus:ring-[#064E3B] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                Physical Address
              </label>
              <input
                type="text"
                placeholder="e.g. 52 Main St, New York, NY"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-md text-xs text-foreground font-semibold placeholder:text-muted-foreground focus:ring-1 focus:ring-[#064E3B] outline-none"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setName("");
                  setPhone("");
                  setAddress("");
                  setEditBranchId(null);
                }}
                className="px-4 py-2 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-black text-black text-xs font-bold rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-md text-xs font-black shadow-sm transition-all uppercase tracking-wider cursor-pointer border-none"
              >
                {isSubmitting ? "Saving..." : editBranchId ? "Update Location" : "Save Location"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid listing */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-[10px] text-muted-foreground">Listing outlets...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {branches.map((branch) => {
            const isCurrentContext = activeBranchId === branch.id;
            const isDisabled = !branch.isActive;
            return (
              <div
                key={branch.id}
                className={`bg-card border rounded-lg p-5 flex flex-col justify-between shadow-sm transition-all duration-200 ${
                  isCurrentContext
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-border/80"
                } ${isDisabled ? "opacity-75" : ""}`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isCurrentContext ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{branch.name}</h3>
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                          ID: {branch.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {branch.isMain && (
                        <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest">
                          Main
                        </span>
                      )}
                      {isDisabled && (
                        <span className="text-[8px] bg-destructive/10 text-destructive font-bold px-1.5 py-0.5 rounded border border-destructive/20 uppercase tracking-widest">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground mt-4 mb-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate">{branch.address || "No Address Provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{branch.phone || "No Phone Registered"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>Created {new Date(branch.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 flex flex-col gap-2">
                  {isCurrentContext ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-bold w-full justify-center py-2 bg-primary/10 rounded-md border border-primary/20">
                      <CheckCircle className="h-4 w-4" />
                      <span>Active Operation Desk</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => !isDisabled && handleBranchSwitch(branch.id)}
                      disabled={isDisabled}
                      className={`w-full py-2 font-bold rounded-md text-xs transition-colors cursor-pointer border-none ${
                        isDisabled
                          ? "bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1] cursor-not-allowed opacity-50"
                          : "bg-[#064E3B] hover:bg-[#053F30] text-white"
                      }`}
                    >
                      {isDisabled ? "Branch is Disabled" : "Switch context to this branch"}
                    </button>
                  )}

                  {isOwner && !branch.isMain && !isCurrentContext && (
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleToggleActive(branch.id, branch.isActive)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isDisabled
                            ? "bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-700 border border-emerald-500/30"
                            : "bg-amber-50/50 hover:bg-amber-100/50 text-amber-700 border border-amber-500/30"
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        {isDisabled ? "Enable Branch" : "Disable Branch"}
                      </button>
                      <button
                        onClick={() => {
                          setEditBranchId(branch.id);
                          setName(branch.name);
                          setPhone(branch.phone || "");
                          setAddress(branch.address || "");
                          setShowAddForm(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="py-1.5 px-3.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-black text-black rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription limits tip */}
      <div className="bg-secondary/40 border border-border p-4 rounded-md flex items-center gap-3 text-xs text-muted-foreground print:hidden">
        <p>
          Need to add more outlets? Branches are limited based on your active subscription plan package. Go to the{" "}
          <a href="/dashboard/subscriptions" className="text-primary hover:underline font-bold">
            Subscription Plan panel
          </a>{" "}
          to review allocations and limits.
        </p>
      </div>
    </div>
  );
}
