"use client";

import React, { useState, useEffect } from "react";
import { Search, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function CurrentStockClient() {
  const { currencySymbol } = useSettings();
  const [stocks, setStocks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalProducts: 0, totalValue: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (search) query.append("search", search);
        if (selectedBranch) query.append("branchId", selectedBranch);

        const res = await fetch(`/api/v1/inventory/current-stock?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setStocks(data.stocks);
          setBranches(data.branches);
          setMetrics({ totalProducts: data.totalProducts, totalValue: data.totalValue });
        }
      } catch (err) {
        console.error("Fetch current stock error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search, selectedBranch]);

  const exportToCSV = () => {
    const csv = [
      ["Name", "SKU", "Barcode", "Category", "Brand", "Unit", "Cost Price", "Selling Price", "Total Quantity", "Value", "Status"].join(","),
      ...stocks.map((s) =>
        [
          s.name,
          s.sku,
          s.barcode,
          s.category,
          s.brand,
          s.unit,
          s.costPrice,
          s.sellingPrice,
          s.totalQuantity,
          s.value,
          s.status,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `current-stock-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Products</div>
          <div className="text-2xl font-black">{metrics.totalProducts}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Stock Value</div>
          <div className="text-2xl font-black">{currencySymbol}{metrics.totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {branches.length > 0 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={exportToCSV}
            disabled={stocks.length === 0}
            className="px-4 py-2 bg-secondary hover:bg-border disabled:opacity-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Stock Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading current stock...</div>
        ) : stocks.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No stock found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2 text-left">Name / SKU</th>
                  <th className="py-3 px-2 text-center">Category</th>
                  <th className="py-3 px-2 text-center">Unit</th>
                  <th className="py-3 px-2 text-right">Cost Price</th>
                  <th className="py-3 px-2 text-right">Sell Price</th>
                  <th className="py-3 px-2 text-center">Quantity</th>
                  <th className="py-3 px-2 text-right">Value</th>
                  <th className="py-3 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2">
                      <div className="font-bold text-primary">{stock.sku}</div>
                      <div className="text-[11px] text-foreground">{stock.name}</div>
                      {stock.barcode && (
                        <div className="text-[10px] text-muted-foreground">{stock.barcode}</div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center text-[11px]">{stock.category}</td>
                    <td className="py-3 px-2 text-center text-[11px]">{stock.unit}</td>
                    <td className="py-3 px-2 text-right font-medium">{currencySymbol}{stock.costPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium text-primary">{currencySymbol}{stock.sellingPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-center font-bold">{stock.totalQuantity}</td>
                    <td className="py-3 px-2 text-right font-bold">{currencySymbol}{stock.value.toFixed(2)}</td>
                    <td className="py-3 px-2 text-center">
                      {stock.status === "OUT_OF_STOCK" ? (
                        <span className="inline-block bg-destructive/10 text-destructive px-2 py-1 rounded text-[10px] font-bold">OUT OF STOCK</span>
                      ) : stock.status === "LOW_STOCK" ? (
                        <span className="inline-block bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> LOW
                        </span>
                      ) : (
                        <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> IN STOCK
                        </span>
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
