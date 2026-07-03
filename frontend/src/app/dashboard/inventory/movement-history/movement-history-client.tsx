"use client";

import React, { useState, useEffect } from "react";
import { Search, Download } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function MovementHistoryClient() {
  const { currencySymbol } = useSettings();
  const [movements, setMovements] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [days, setDays] = useState(90);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalMovements: 0,
    byType: { SALE: 0, PURCHASE: 0, ADJUSTMENT: 0, TRANSFER: 0 },
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (typeFilter) query.append("type", typeFilter);
        query.append("days", days.toString());
        if (search) query.append("search", search);

        const res = await fetch(`/api/v1/inventory/movement-history?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setMovements(data.movements);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch movement history error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [typeFilter, days, search]);

  const exportToCSV = () => {
    const csv = [
      ["Date", "Type", "Reference", "From", "To", "User", "Total Amount", "Items"].join(","),
      ...movements.map((m) =>
        [
          new Date(m.date).toLocaleString(),
          m.type,
          m.reference || "—",
          m.fromBranch || m.customer || m.supplier || m.from || "—",
          m.toBranch || m.to || "—",
          m.user || "—",
          m.totalAmount || m.total || 0,
          m.items?.map((i: any) => `${i.product || i.name}(${i.quantity})`).join("|") || "—",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movement-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getMovementTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      SALE: "bg-destructive/10 text-destructive",
      PURCHASE: "bg-primary/10 text-primary",
      ADJUSTMENT: "bg-blue-500/10 text-blue-600",
      TRANSFER: "bg-purple-500/10 text-purple-600",
    };
    return colors[type] || "bg-secondary";
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Movements</div>
          <div className="text-2xl font-black">{summary.totalMovements}</div>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="text-primary text-xs font-bold uppercase tracking-wider mb-1">Purchases</div>
          <div className="text-2xl font-black text-primary">{summary.byType.PURCHASE}</div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
          <div className="text-destructive text-xs font-bold uppercase tracking-wider mb-1">Sales</div>
          <div className="text-2xl font-black text-destructive">{summary.byType.SALE}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Adjustments</div>
          <div className="text-2xl font-black text-blue-600">{summary.byType.ADJUSTMENT}</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
          <div className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Transfers</div>
          <div className="text-2xl font-black text-purple-600">{summary.byType.TRANSFER}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by reference, user, or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="SALE">Sales</option>
            <option value="PURCHASE">Purchases</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="TRANSFER">Transfers</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={7}>7 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>90 Days</option>
            <option value={365}>1 Year</option>
          </select>

          <button
            onClick={exportToCSV}
            disabled={movements.length === 0}
            className="px-4 py-2 bg-secondary hover:bg-border disabled:opacity-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* History List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading history...</div>
        ) : movements.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No movements found</div>
        ) : (
          <div className="space-y-3">
            {movements.map((movement) => (
              <div key={movement.id} className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${getMovementTypeBadge(movement.type)}`}>
                        {movement.type}
                      </span>
                      <span className="font-bold text-foreground">{movement.reference}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(movement.date).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                      {movement.fromBranch && (
                        <div>
                          <span className="text-muted-foreground">From:</span> {movement.fromBranch}
                        </div>
                      )}
                      {movement.from && (
                        <div>
                          <span className="text-muted-foreground">From:</span> {movement.from}
                        </div>
                      )}
                      {movement.customer && (
                        <div>
                          <span className="text-muted-foreground">Customer:</span> {movement.customer}
                        </div>
                      )}
                      {movement.supplier && (
                        <div>
                          <span className="text-muted-foreground">Supplier:</span> {movement.supplier}
                        </div>
                      )}
                      {movement.toBranch && (
                        <div>
                          <span className="text-muted-foreground">To:</span> {movement.toBranch}
                        </div>
                      )}
                      {movement.to && (
                        <div>
                          <span className="text-muted-foreground">To:</span> {movement.to}
                        </div>
                      )}
                      {movement.user && (
                        <div>
                          <span className="text-muted-foreground">User:</span> {movement.user}
                        </div>
                      )}
                    </div>

                    {movement.items && movement.items.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {movement.items.map((item: any, i: number) => (
                          <span key={i} className="text-[10px] bg-secondary px-2 py-1 rounded">
                            {item.product || item.name} <span className="font-bold">×{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {movement.totalAmount && (
                      <div className="text-sm font-bold text-primary">{currencySymbol}{movement.totalAmount.toFixed(2)}</div>
                    )}
                    {movement.total && (
                      <div className="text-sm font-bold text-primary">{currencySymbol}{movement.total.toFixed(2)}</div>
                    )}
                    {movement.totalQuantity && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Qty: {movement.totalQuantity}
                      </div>
                    )}
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
