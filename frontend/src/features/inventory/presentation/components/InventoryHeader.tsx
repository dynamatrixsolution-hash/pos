"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Package,
  ArrowLeftRight,
  SlidersHorizontal,
  Tags,
  AlertOctagon,
  CircleDollarSign,
  History,
  Search,
  Building,
} from "lucide-react";
import { useInventoryUiStore } from "../../state/inventory-ui.store";
import { useInventoryStockStore } from "../../state/inventory-stock.store";

const SECTIONS = [
  { href: "/dashboard/inventory", label: "Overview", icon: Boxes },
  { href: "/dashboard/inventory/current-stock", label: "Current Stock", icon: Package },
  { href: "/dashboard/inventory/stock-movements", label: "Stock In/Out", icon: ArrowLeftRight },
  { href: "/dashboard/inventory/stock-adjustments", label: "Adjustments", icon: SlidersHorizontal },
  { href: "/dashboard/inventory/batch-stock", label: "Batch Stock", icon: Tags },
  { href: "/dashboard/inventory/damage-expiry", label: "Damage & Expiry", icon: AlertOctagon },
  { href: "/dashboard/inventory/stock-value", label: "Stock Value", icon: CircleDollarSign },
  { href: "/dashboard/inventory/movement-history", label: "History", icon: History },
];

export const InventoryHeader: React.FC = () => {
  const pathname = usePathname();
  const search = useInventoryUiStore((s) => s.search);
  const setSearch = useInventoryUiStore((s) => s.setSearch);
  const lowStockOnly = useInventoryUiStore((s) => s.lowStockOnly);
  const setLowStockOnly = useInventoryUiStore((s) => s.setLowStockOnly);
  const selectedBranchId = useInventoryUiStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useInventoryUiStore((s) => s.setSelectedBranchId);

  const branches = useInventoryStockStore((s) => s.branches);
  const isOwner = useInventoryStockStore((s) => s.isOwner);
  const loadInventory = useInventoryStockStore((s) => s.loadInventory);

  const handleSearchChange = (val: string) => {
    setSearch(val);
  };

  const handleLowStockToggle = () => {
    setLowStockOnly(!lowStockOnly);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#6B2837] text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#292320]">Inventory Management</h1>
            <p className="text-xs text-[#71675E]">
              Track real-time stock levels, branch allocations, valuations, and adjustments
            </p>
          </div>
        </div>

        {/* Branch Filter for Multi-Branch Owners */}
        {isOwner && branches.length > 1 && (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-[#71675E]" />
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                loadInventory();
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isMain ? "(Main)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs (Clean icons, no emojis) */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC]">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = pathname === sec.href;
          return (
            <Link
              key={sec.href}
              href={sec.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#6B2837] text-white shadow-xs"
                  : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{sec.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Filter Toolbar (Only on Overview) */}
      {pathname === "/dashboard/inventory" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadInventory();
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#292320]">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={() => {
                  handleLowStockToggle();
                  loadInventory();
                }}
                className="h-4 w-4 rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
              />
              <span>Low Stock Alerts Only</span>
            </label>

            <button
              type="button"
              onClick={() => loadInventory()}
              className="px-3 py-1.5 rounded-lg bg-[#6B2837] text-white text-xs font-bold hover:bg-[#59222e] cursor-pointer shadow-xs transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

