"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/core/api/api-client";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  Package,
  Download,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function InventoryReportContainer() {
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, bRes] = await Promise.all([
        apiClient.product.getProducts({ limit: 250 }),
        apiClient.settings.getBranches(),
      ]);
      setProducts(pRes.products || []);
      setBranches(bRes.branches || []);
    } catch (err: any) {
      console.error("Failed to load inventory report:", err);
      Notify.error(err.message || "Failed to load inventory report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search))
    );
  });

  const totalValuation = filteredProducts.reduce((acc, p) => {
    const qty = p.stocks?.reduce((sAcc: number, s: any) => sAcc + Number(s.quantity || 0), 0) || Number(p.stock || 0);
    const cost = parseMoney(p.costPrice || 0);
    return acc + qty * cost;
  }, 0);

  const lowStockCount = filteredProducts.filter((p) => {
    const qty = p.stocks?.reduce((sAcc: number, s: any) => sAcc + Number(s.quantity || 0), 0) || Number(p.stock || 0);
    const min = Number(p.minStockLevel || p.reorderPoint || 5);
    return qty <= min;
  }).length;

  const handleExport = () => {
    if (filteredProducts.length === 0) {
      Notify.warning("No inventory records to export");
      return;
    }
    const rows = filteredProducts.map((p) => {
      const qty = p.stocks?.reduce((sAcc: number, s: any) => sAcc + Number(s.quantity || 0), 0) || Number(p.stock || 0);
      const cost = parseMoney(p.costPrice || 0);
      const price = parseMoney(p.sellingPrice || 0);
      return {
        Product: p.name,
        SKU: p.sku || "—",
        Category: p.category?.name || "General",
        Quantity_On_Hand: qty,
        Unit_Cost_NPR: cost,
        Selling_Price_NPR: price,
        Asset_Valuation_NPR: qty * cost,
      };
    });
    exportToExcel(rows, "Inventory_Valuation_Report");
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Inventory & Valuation Report</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Stock quantities, inventory asset valuation, unit costs & reorder level audits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">Total Stock Asset Valuation</div>
          <div className="text-xl font-bold text-[#292320] tabular-nums">
            {formatNPR(totalValuation)}
          </div>
          <p className="text-[11px] text-[#71675E]">At purchase cost basis</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">Catalog SKU Count</div>
          <div className="text-xl font-bold text-[#292320] tabular-nums">
            {filteredProducts.length}
          </div>
          <p className="text-[11px] text-[#71675E]">Active products tracked</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="text-xs font-semibold text-[#71675E]">Low Stock Warnings</div>
          <div className="text-xl font-bold text-[#B33432] tabular-nums">
            {lowStockCount}
          </div>
          <p className="text-[11px] text-[#71675E]">At or below reorder threshold</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name, SKU or barcode..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Auditing warehouse & branch inventory...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Package className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No inventory items found</h3>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Product Name</th>
                <th className="py-2.5 px-3 font-semibold">SKU / Code</th>
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold text-right">In Stock</th>
                <th className="py-2.5 px-3 font-semibold text-right">Cost (NPR)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Selling Price</th>
                <th className="py-2.5 px-3 font-semibold text-right">Valuation (NPR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {filteredProducts.map((p) => {
                const qty = p.stocks?.reduce((sAcc: number, s: any) => sAcc + Number(s.quantity || 0), 0) || Number(p.stock || 0);
                const cost = parseMoney(p.costPrice || 0);
                const price = parseMoney(p.sellingPrice || 0);
                const val = qty * cost;
                const min = Number(p.minStockLevel || p.reorderPoint || 5);
                const isLow = qty <= min;

                return (
                  <tr key={p.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#292320]">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-[#71675E]">{p.sku || "—"}</td>
                    <td className="py-2.5 px-3 text-[#71675E]">{p.category?.name || "General"}</td>
                    <td className="py-2.5 px-3 tabular-nums text-right">
                      <span className={`font-bold ${isLow ? "text-[#B33432]" : "text-[#292320]"}`}>
                        {qty} {p.unit || "units"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-right text-[#71675E]">{formatNPR(cost)}</td>
                    <td className="py-2.5 px-3 tabular-nums text-right font-medium text-[#292320]">{formatNPR(price)}</td>
                    <td className="py-2.5 px-3 tabular-nums text-right font-bold text-[#28634B]">{formatNPR(val)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
