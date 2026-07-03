"use client";

import React, { useState, useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, Repeat2, Search } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function StockMovementsClient() {
  const { currencySymbol } = useSettings();
  const [movements, setMovements] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, totalTransfers: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (typeFilter) query.append("type", typeFilter);
        query.append("days", days.toString());

        const res = await fetch(`/api/v1/inventory/stock-movements?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setMovements(data.movements);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch movements error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [typeFilter, days]);

  const getMovementIcon = (type: string) => {
    if (type === "STOCK_IN") return <ArrowDownRight className="h-4 w-4 text-primary" />;
    if (type === "STOCK_OUT") return <ArrowUpRight className="h-4 w-4 text-destructive" />;
    return <Repeat2 className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="text-primary text-xs font-bold uppercase tracking-wider mb-1">Stock In</div>
          <div className="text-2xl font-black text-primary">{summary.totalIn}</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
          <div className="text-destructive text-xs font-bold uppercase tracking-wider mb-1">Stock Out</div>
          <div className="text-2xl font-black text-destructive">{summary.totalOut}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Transfers</div>
          <div className="text-2xl font-black text-blue-600">{summary.totalTransfers}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Movements</option>
            <option value="STOCK_IN">Stock In (Purchases)</option>
            <option value="STOCK_OUT">Stock Out (Sales)</option>
            <option value="TRANSFER">Transfers</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last Year</option>
          </select>
        </div>

        {/* Movements List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading movements...</div>
        ) : movements.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No movements found</div>
        ) : (
          <div className="space-y-3">
            {movements.map((movement) => (
              <div key={movement.id} className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{getMovementIcon(movement.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-foreground">{movement.reference}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary">
                          {movement.type === "STOCK_IN" ? "Purchase" : movement.type === "STOCK_OUT" ? "Sale" : "Transfer"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {movement.type === "STOCK_IN" && `From: ${movement.from}`}
                        {movement.type === "STOCK_OUT" && `To: ${movement.to}`}
                        {movement.type === "TRANSFER" && `${movement.from} → ${movement.to}`}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {movement.items.map((item: any, i: number) => (
                          <span key={i} className="text-[10px] bg-secondary px-2 py-1 rounded">
                            {item.name} ({item.qty})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{currencySymbol}{movement.total.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground">{movement.user}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(movement.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
