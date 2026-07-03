"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";

export default function StockAdjustmentsClient() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalAdjustments: 0, byType: {} });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (typeFilter) query.append("type", typeFilter);
        query.append("days", days.toString());

        const res = await fetch(`/api/v1/inventory/adjustments-history?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setAdjustments(data.adjustments);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch adjustments error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [typeFilter, days]);

  const getAdjustmentColor = (type: string) => {
    if (type === "STOCK_IN") return "bg-primary/10 text-primary";
    if (type === "STOCK_OUT" || type === "DAMAGE") return "bg-destructive/10 text-destructive";
    return "bg-secondary";
  };

  const getAdjustmentIcon = (type: string) => {
    if (type === "STOCK_IN") return <ArrowDown className="h-4 w-4" />;
    if (type === "STOCK_OUT") return <ArrowUp className="h-4 w-4" />;
    if (type === "DAMAGE") return <AlertTriangle className="h-4 w-4" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Adjustments</div>
          <div className="text-2xl font-black">{summary.totalAdjustments}</div>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="text-primary text-xs font-bold uppercase tracking-wider mb-1">Stock In</div>
          <div className="text-2xl font-black text-primary">{(summary.byType as any)?.STOCK_IN || 0}</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
          <div className="text-destructive text-xs font-bold uppercase tracking-wider mb-1">Stock Out</div>
          <div className="text-2xl font-black text-destructive">{(summary.byType as any)?.STOCK_OUT || 0}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
          <div className="text-yellow-600 text-xs font-bold uppercase tracking-wider mb-1">Damage</div>
          <div className="text-2xl font-black text-yellow-600">{(summary.byType as any)?.DAMAGE || 0}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Adjustments</div>
          <div className="text-2xl font-black text-blue-600">{(summary.byType as any)?.ADJUSTMENT || 0}</div>
        </div>
      </div>

      {/* Controls & List */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="STOCK_IN">Stock In</option>
            <option value="STOCK_OUT">Stock Out</option>
            <option value="DAMAGE">Damage</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>

        {/* Adjustments List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading adjustments...</div>
        ) : adjustments.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No adjustments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2 text-left">Date & Time</th>
                  <th className="py-3 px-2 text-center">Type</th>
                  <th className="py-3 px-2 text-right">Quantity</th>
                  <th className="py-3 px-2 text-left">Notes</th>
                  <th className="py-3 px-2 text-left">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-secondary/10">
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(adj.date).toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-1 rounded text-[10px] ${getAdjustmentColor(adj.type)}`}>
                        {getAdjustmentIcon(adj.type)}
                        {adj.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-bold">{adj.quantity}</td>
                    <td className="py-3 px-2 text-muted-foreground">{adj.notes || "—"}</td>
                    <td className="py-3 px-2 text-foreground">{adj.user}</td>
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
