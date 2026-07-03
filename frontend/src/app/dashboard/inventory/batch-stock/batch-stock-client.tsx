"use client";

import React, { useState, useEffect } from "react";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function BatchStockClient() {
  const { currencySymbol } = useSettings();
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalBatches: 0, expiredCount: 0, expiringSoonCount: 0, totalValue: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (search) query.append("search", search);
        if (expiringSoon) query.append("expiringSoon", "true");

        const res = await fetch(`/api/v1/inventory/batch-stock?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch batch stock error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search, expiringSoon]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Batches</div>
          <div className="text-2xl font-black">{summary.totalBatches}</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
          <div className="text-destructive text-xs font-bold uppercase tracking-wider mb-1">Expired</div>
          <div className="text-2xl font-black text-destructive">{summary.expiredCount}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
          <div className="text-yellow-600 text-xs font-bold uppercase tracking-wider mb-1">Expiring Soon</div>
          <div className="text-2xl font-black text-yellow-600">{summary.expiringSoonCount}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Value</div>
          <div className="text-2xl font-black">{currencySymbol}{summary.totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by product, SKU, or batch number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={expiringSoon}
              onChange={(e) => setExpiringSoon(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            Expiring Soon
          </label>
        </div>

        {/* Batch Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No batches found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2 text-left">Product / SKU</th>
                  <th className="py-3 px-2 text-left">Batch Number</th>
                  <th className="py-3 px-2 text-left">Branch</th>
                  <th className="py-3 px-2 text-right">Quantity</th>
                  <th className="py-3 px-2 text-right">Cost Price</th>
                  <th className="py-3 px-2 text-right">Sell Price</th>
                  <th className="py-3 px-2 text-right">Total Value</th>
                  <th className="py-3 px-2 text-left">Expiry Date</th>
                  <th className="py-3 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2">
                      <div className="font-bold text-primary">{batch.sku}</div>
                      <div className="text-[11px]">{batch.productName}</div>
                    </td>
                    <td className="py-3 px-2 font-mono font-bold">{batch.batchNumber}</td>
                    <td className="py-3 px-2 text-muted-foreground">{batch.branchName}</td>
                    <td className="py-3 px-2 text-right font-bold">{batch.quantity}</td>
                    <td className="py-3 px-2 text-right">{currencySymbol}{batch.costPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right text-primary font-medium">{currencySymbol}{batch.sellingPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-bold">{currencySymbol}{batch.totalValue.toFixed(2)}</td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {batch.isExpired ? (
                        <span className="inline-flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-1 rounded text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3" /> EXPIRED
                        </span>
                      ) : batch.isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3" /> {batch.daysToExpiry}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> OK
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
