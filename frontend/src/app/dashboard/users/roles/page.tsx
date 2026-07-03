"use client";

import React, { useState } from "react";
import { Shield, Check, X, Users, Store, GitBranch, Package, HelpCircle } from "lucide-react";
import { rolePermissions, accessibleResources, Role } from "@/lib/rbac";

const ROLE_DESCRIPTIONS: Record<Role, { title: string; desc: string; color: string; badge: string }> = {
  OWNER: {
    title: "Business Owner",
    desc: "Full administrative access. Can configure billing, manage all branches, invite and manage users, change settings, and perform all business transactions.",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  MANAGER: {
    title: "Store Manager",
    desc: "Manage warehouse stock, product catalog, purchases, expenses, and view branch-level reports. Limited to data of their assigned branch location.",
    color: "from-primary/20 to-blue-500/10 border-primary/30 text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  CASHIER: {
    title: "Store Cashier",
    desc: "Create sales invoices, collect payments, and register new customers at the POS desk. Access is strictly limited to their assigned operating branch.",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  SUPER_ADMIN: {
    title: "Strategic Auditor",
    desc: "Read-only access to multi-branch performance stats, branch profiles, and employee directories. Cannot make billing changes or perform trade transactions.",
    color: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-500",
    badge: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
};

// Resources list to map in our visual matrix
const RESOURCES = [
  { key: "dashboard", label: "Dashboard Overview" },
  { key: "pos", label: "POS Billing Desk" },
  { key: "products", label: "Products Catalog" },
  { key: "categories", label: "Categories & Units" },
  { key: "purchases", label: "Inbound Purchases" },
  { key: "inventory", label: "Inventory Adjustments" },
  { key: "customers", label: "Customers Profiles" },
  { key: "suppliers", label: "Suppliers Records" },
  { key: "payments", label: "Transactions & Payments" },
  { key: "expenses", label: "Expenses Vouchers" },
  { key: "reports", label: "Reports & Stats" },
  { key: "branches", label: "Multi-branch Settings" },
  { key: "users", label: "Employees & Roles" },
  { key: "settings", label: "Business Configuration" },
];

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("OWNER");

  // Helper to format permissions list for selected role
  const getPermissionsForRole = (role: Role) => {
    return rolePermissions[role] || [];
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure access rights, review role security levels, and manage staff operations.
          </p>
        </div>
      </div>

      {/* 2. Interactive Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(Object.keys(ROLE_DESCRIPTIONS) as Role[]).map((role) => {
          const detail = ROLE_DESCRIPTIONS[role];
          const isSelected = selectedRole === role;
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`text-left bg-card border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 outline-none ${
                isSelected
                  ? "border-primary ring-1 ring-primary shadow-sm"
                  : "border-border hover:border-border/80"
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${detail.badge}`}>
                    {role}
                  </span>
                  <Shield className={`h-4.5 w-4.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{detail.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {detail.desc}
                </p>
              </div>
              
              <div className="mt-4 pt-3 border-t border-border/40 w-full text-center">
                <span className="text-[10px] font-bold text-primary">
                  {isSelected ? "Selected Role Active" : "Click to view actions"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Detailed Actions view for Selected Role */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
          <Shield className="h-4.5 w-4.5 text-primary" />
          Access Definition for: <span className="text-primary font-black uppercase">{selectedRole}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Allowed Resource Scopes
            </h3>
            <div className="flex flex-wrap gap-2">
              {accessibleResources[selectedRole]?.map((path) => (
                <span
                  key={path}
                  className="px-2.5 py-1 bg-secondary text-foreground text-[10px] font-semibold border border-border rounded-lg"
                >
                  {path}
                </span>
              )) || <span className="text-xs text-muted-foreground italic">No default routes assigned</span>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Operations Permissions Matrix
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {getPermissionsForRole(selectedRole).map((p) => (
                <div
                  key={p.resource}
                  className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-xl border border-border/40 text-xs"
                >
                  <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">
                    {p.resource}
                  </span>
                  <div className="flex gap-1.5">
                    {p.actions.map((act) => (
                      <span
                        key={act}
                        className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[9px] font-black rounded uppercase tracking-wider"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Complete Permissions Matrix Grid */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
          <Store className="h-4.5 w-4.5 text-primary" />
          Full System RBAC Control Matrix
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Resource Module</th>
                <th className="py-3 px-3 text-center">Cashier</th>
                <th className="py-3 px-3 text-center">Manager</th>
                <th className="py-3 px-3 text-center">Owner</th>
                <th className="py-3 px-3 text-center">Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {RESOURCES.map((res) => {
                const cashierPerms = rolePermissions.CASHIER.find((p) => p.resource === res.key)?.actions || [];
                const managerPerms = rolePermissions.MANAGER.find((p) => p.resource === res.key)?.actions || [];
                const ownerPerms = rolePermissions.OWNER.find((p) => p.resource === res.key)?.actions || [];
                const adminPerms = rolePermissions.SUPER_ADMIN.find((p) => p.resource === res.key)?.actions || [];

                return (
                  <tr key={res.key} className="hover:bg-secondary/20">
                    <td className="py-3 px-3">
                      <div className="font-bold text-foreground">{res.label}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Key: {res.key}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {cashierPerms.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {cashierPerms.map((a) => (
                            <span key={a} className="text-[8px] bg-emerald-500/10 text-emerald-600 font-bold px-1 rounded uppercase">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {managerPerms.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {managerPerms.map((a) => (
                            <span key={a} className="text-[8px] bg-primary/10 text-primary font-bold px-1 rounded uppercase">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {ownerPerms.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {ownerPerms.map((a) => (
                            <span key={a} className="text-[8px] bg-amber-500/10 text-amber-600 font-bold px-1 rounded uppercase">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {adminPerms.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {adminPerms.map((a) => (
                            <span key={a} className="text-[8px] bg-purple-500/10 text-purple-600 font-bold px-1 rounded uppercase">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Helpful tip */}
      <div className="bg-secondary/40 border border-border p-4 rounded-xl flex items-center gap-3 text-xs text-muted-foreground print:hidden">
        <HelpCircle className="h-5 w-5 text-primary flex-shrink-0" />
        <p>
          Role definitions and access policies are enforced cryptographically via the core RBAC middleware. If you need custom access structures, please contact system administration.
        </p>
      </div>
    </div>
  );
}
