"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function DamageExpiryClient() {
  const { currencySymbol } = useSettings();
  const [items, setItems] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalExpired: 0, totalExpiringSoon: 0, totalDamaged: 0, totalValue: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (typeFilter) query.append("type", typeFilter);

        const res = await fetch(`/api/v1/inventory/damage-expiry?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch damage & expiry error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [typeFilter]);

  const getStatusColor = (status: string) => {
    if (status === "CRITICAL") return "bg-destructive/10 text-destructive border border-destructive/20";
    if (status === "WARNING") return "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20";
    return "bg-secondary";
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
          <div className="text-destructive text-xs font-bold uppercase tracking-wider mb-1">Expired</div>
          <div className="text-2xl font-black text-destructive">{summary.totalExpired}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
          <div className="text-yellow-600 text-xs font-bold uppercase tracking-wider mb-1">Expiring Soon</div>
          <div className="text-2xl font-black text-yellow-600">{summary.totalExpiringSoon}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Damaged Items</div>
          <div className="text-2xl font-black text-blue-600">{summary.totalDamaged}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Loss Value</div>
          <div className="text-2xl font-black">{currencySymbol}{summary.totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Controls & List */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full sm:w-48 px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Items</option>
          <option value="EXPIRED">Expired Only</option>
          <option value="EXPIRING_SOON">Expiring Soon Only</option>
          <option value="DAMAGE">Damage Only</option>
        </select>

        {/* Items List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No items found</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className={`border rounded-lg p-4 ${getStatusColor(item.status)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-bold">
                        {item.productName || item.details}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-black/10">
                        {item.type}
                      </span>
                    </div>
                    {item.sku && (
                      <div className="text-xs mb-2">
                        <span className="text-muted-foreground">SKU: {item.sku}</span>
                        {item.batchNumber && (
                          <span className="ml-4">Batch: <span className="font-mono">{item.batchNumber}</span></span>
                        )}
                      </div>
                    )}
                    {item.branch && (
                      <div className="text-xs text-muted-foreground mb-2">Branch: {item.branch}</div>
                    )}
                    <div className="text-xs">
                      <span className="font-bold">{item.quantity} units</span>
                      {item.value && (
                        <span className="ml-4 text-muted-foreground">Value: {currencySymbol}{item.value.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {item.daysExpired && (
                      <div className="text-sm font-bold">Expired {item.daysExpired}d ago</div>
                    )}
                    {item.daysToExpiry && (
                      <div className="text-sm font-bold">Expires in {item.daysToExpiry}d</div>
                    )}
                    {item.date && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    )}
                    {item.expiryDate && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </div>
                    )}
                    {item.user && (
                      <div className="text-xs text-muted-foreground mt-1">{item.user}</div>
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
