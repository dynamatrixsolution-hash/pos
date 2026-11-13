"use client";

import React, { useState } from "react";
import { Shield, Check, X, Users, Store, GitBranch, Package } from "lucide-react";
import { rolePermissions, accessibleResources, Role } from "@/lib/rbac";

const ROLE_DESCRIPTIONS: Record<Role, { title: string; desc: string }> = {
  OWNER: {
    title: "Business Owner",
    desc: "Full administrative access. Can configure billing, manage all branches, invite and manage users, change settings, and perform all business transactions.",
  },
  MANAGER: {
    title: "F&B / Operations Manager",
    desc: "Manage floor tables, restaurant orders, room allocations, purchases, inventory, and branch-level reports.",
  },
  FRONT_DESK: {
    title: "Hotel Front Desk",
    desc: "Manage room reservations, guest check-in & check-out, room folios, guest requests, and room key cards.",
  },
  CASHIER: {
    title: "Billing Cashier",
    desc: "Create sales invoices, collect payments, and settle table dining and hotel checkouts.",
  },
  WAITER: {
    title: "Restaurant Waiter / Steward",
    desc: "Manage dining tables, enter customer food orders, send rounds to kitchen, and handle table service.",
  },
  KITCHEN: {
    title: "Chef / Kitchen Staff",
    desc: "View live Kitchen Display System (KDS), manage ticket statuses (queued, preparing, ready), and view recipes.",
  },
  HOUSEKEEPING: {
    title: "Housekeeping Attendant",
    desc: "Inspect rooms, manage cleaning tasks, toggle room cleanliness states (dirty/clean), and report maintenance issues.",
  },
  ACCOUNTANT: {
    title: "Auditor & Accountant",
    desc: "View financial reports, audit logs, manage expense/income vouchers, and track CBMS tax compliance.",
  },
  SUPER_ADMIN: {
    title: "Strategic Platform Admin",
    desc: "Read-only access to multi-branch performance stats, branch profiles, and SaaS platform management.",
  },
  STOREKEEPER: {
    title: "Storekeeper (Legacy)",
    desc: "Manage raw inventory stocks and inward supplies.",
  },
  SALESPERSON: {
    title: "Salesperson (Legacy)",
    desc: "Handle customer queries and sales orders.",
  },
  DELIVERY: {
    title: "Delivery Staff (Legacy)",
    desc: "Handle takeaway deliveries and dispatch.",
  },
};

const RESOURCES = [
  { key: "dashboard", label: "Dashboard Overview" },
  { key: "restaurant", label: "Restaurant & KDS" },
  { key: "hotel", label: "Hotel & Reservations" },
  { key: "pos", label: "POS Billing Desk" },
  { key: "products", label: "Menu & Products Catalog" },
  { key: "categories", label: "Categories & Units" },
  { key: "purchases", label: "Inbound Purchases" },
  { key: "inventory", label: "Inventory & Stock" },
  { key: "customers", label: "Guest & Customer Profiles" },
  { key: "suppliers", label: "Suppliers Records" },
  { key: "payments", label: "Transactions & Payments" },
  { key: "expenses", label: "Expenses Vouchers" },
  { key: "reports", label: "Reports & Stats" },
  { key: "branches", label: "Multi-branch Settings" },
  { key: "users", label: "Employees & Roles" },
  { key: "settings", label: "Business Configuration" },
];

export function RolesContainer() {
  const [selectedRole, setSelectedRole] = useState<Role>("OWNER");

  const getPermissionsForRole = (role: Role) => {
    return rolePermissions[role] || [];
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#EEE7DD] pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#6B2837]" />
          <h1 className="text-xl font-bold text-[#292320] tracking-tight">Roles & Access Control (RBAC)</h1>
        </div>
        <p className="text-xs text-[#71675E] mt-0.5">
          Role-based security policies, authorization boundaries & module permissions matrix
        </p>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(ROLE_DESCRIPTIONS) as Role[]).map((r) => {
          const isSelected = selectedRole === r;
          const info = ROLE_DESCRIPTIONS[r];
          return (
            <div
              key={r}
              onClick={() => setSelectedRole(r)}
              className={`p-4 rounded-lg border cursor-pointer transition-colors space-y-2 ${
                isSelected
                  ? "bg-[#F9EFF1] border-[#E3C6CC] shadow-sm"
                  : "bg-[#FFFCF7] border-[#EEE7DD] hover:border-[#6B2837]/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSelected ? "text-[#6B2837]" : "text-[#292320]"}`}>
                  {info.title}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isSelected
                      ? "bg-[#6B2837] text-white border-[#6B2837]"
                      : "bg-[#F7F3EC] text-[#71675E] border-[#EEE7DD]"
                  }`}
                >
                  {r}
                </span>
              </div>
              <p className="text-[11px] text-[#71675E] leading-relaxed line-clamp-3">{info.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#292320]">
              Authorized Modules for {ROLE_DESCRIPTIONS[selectedRole].title}
            </h3>
            <p className="text-xs text-[#71675E]">
              Modules this role can read, write or administer
            </p>
          </div>
          <span className="text-xs font-semibold text-[#6B2837] font-mono">
            {getPermissionsForRole(selectedRole).length} Permissions Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {RESOURCES.map((res) => {
            const hasAccess = accessibleResources[selectedRole]?.includes(res.key);
            return (
              <div
                key={res.key}
                className={`p-3 rounded border text-xs flex items-center justify-between ${
                  hasAccess
                    ? "bg-[#EBF4F0] border-[#C3DED0] text-[#28634B]"
                    : "bg-[#F7F3EC] border-[#EEE7DD] text-[#71675E]"
                }`}
              >
                <span className="font-medium">{res.label}</span>
                {hasAccess ? (
                  <Check className="h-4 w-4 text-[#28634B] flex-shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-[#71675E] opacity-50 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

