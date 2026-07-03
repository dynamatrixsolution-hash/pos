"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Box, Store, BarChart3, Layers, Zap, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { useSettings } from "@/components/settings-provider";

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  unitName: string;
  costPrice: number;
  sellingPrice: number;
  alertQuantity: number;
  totalQuantity: number;
  isLowStock: boolean;
  valuation: number;
  stocks: { branchId: string; branchName: string; quantity: number }[];
};

const INVENTORY_SECTIONS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "current-stock", label: "Current Stock", icon: "📦" },
  { id: "stock-movements", label: "Stock In/Out", icon: "↔️" },
  { id: "stock-adjustments", label: "Adjustments", icon: "⚙️" },
  { id: "batch-stock", label: "Batch Stock", icon: "🏷️" },
  { id: "damage-expiry", label: "Damage & Expiry", icon: "⚠️" },
  { id: "stock-value", label: "Stock Value", icon: "💰" },
  { id: "movement-history", label: "History", icon: "📜" },
];

export default function InventoryClient() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const branchId = session?.user ? (session.user as any).branchId : null;
  
  const [activeSection, setActiveSection] = useState("overview");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [metrics, setMetrics] = useState({ totalValuation: 0, lowStockCount: 0, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [submitError, setSubmitError] = useState("");
  
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { type: "STOCK_IN", quantity: 1, notes: "" }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory?search=${search}&lowStock=${lowStockOnly}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory);
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Fetch inventory error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, lowStockOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId !== "overview") {
      router.push(`/dashboard/inventory/${sectionId}`);
    }
  };

  const openAdjustModal = (product: InventoryItem) => {
    setSelectedProduct(product);
    reset({ type: "STOCK_IN", quantity: 1, notes: "" });
    setSubmitError("");
    setIsModalOpen(true);
  };

  const onSubmitAdjust = async (data: any) => {
    if (!branchId) {
      setSubmitError("No active branch selected.");
      return;
    }

    try {
      const res = await fetch("/api/v1/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct?.id,
          branchId,
          type: data.type,
          quantity: Number(data.quantity),
          notes: data.notes,
        }),
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Adjustment failed");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-card border border-border rounded-2xl p-0 overflow-x-auto">
        <div className="flex gap-0 min-w-full">
          {INVENTORY_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => navigateToSection(section.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeSection === section.id
                  ? "border-b-primary text-primary bg-primary/5"
                  : "border-b-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === "overview" && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Valuation</div>
              <div className="text-2xl font-black">{currencySymbol}{metrics.totalValuation.toFixed(2)}</div>
              <Store className="absolute right-4 bottom-4 h-12 w-12 text-primary/10" />
            </div>
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total Products</div>
              <div className="text-2xl font-black">{metrics.totalItems}</div>
              <Box className="absolute right-4 bottom-4 h-12 w-12 text-primary/10" />
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
              <div className="text-destructive font-bold text-xs uppercase tracking-wider mb-1">Low Stock Alerts</div>
              <div className="text-2xl font-black text-destructive">{metrics.lowStockCount} Items</div>
              <AlertTriangle className="absolute right-4 bottom-4 h-12 w-12 text-destructive/20" />
            </div>
          </div>

          {/* Main List */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by SKU or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                Show Low Stock Only
              </label>
            </div>

            {/* Data Table */}
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading inventory...</div>
            ) : inventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">No items found matching criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-2">SKU / Item</th>
                      <th className="py-3 px-2 text-center">Category</th>
                      <th className="py-3 px-2 text-right">Cost Value</th>
                      <th className="py-3 px-2 text-right">Selling Price</th>
                      <th className="py-3 px-2 text-center">Alert Lvl</th>
                      <th className="py-3 px-2 text-center">Total Stock</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {inventory.map((item) => (
                      <tr key={item.id} className="hover:bg-secondary/10">
                        <td className="py-3 px-2">
                          <div className="font-bold text-primary">{item.sku}</div>
                          <div className="text-[11px] font-semibold text-foreground mt-0.5">{item.name}</div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="bg-secondary px-2 py-0.5 rounded text-[10px]">
                            {item.categoryName}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-medium">{currencySymbol}{item.costPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-primary">{currencySymbol}{item.sellingPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-muted-foreground">{item.alertQuantity} {item.unitName}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.isLowStock ? (
                            <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-1 rounded font-bold flex items-center justify-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {item.totalQuantity}
                            </span>
                          ) : (
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded font-bold flex items-center justify-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {item.totalQuantity}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => openAdjustModal(item)}
                            className="px-3 py-1.5 bg-secondary hover:bg-border text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Adjust Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-1">Adjust Inventory</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Manually correct stock levels for <strong className="text-foreground">{selectedProduct.name}</strong>.
            </p>
            
            <div className="bg-secondary/50 p-3 rounded-lg mb-4 text-xs flex justify-between font-bold">
              <span>Current Total Stock:</span>
              <span>{selectedProduct.totalQuantity} {selectedProduct.unitName}</span>
            </div>

            {submitError && <div className="p-3 mb-4 text-sm bg-destructive/10 text-destructive rounded-lg font-medium border border-destructive/20">{submitError}</div>}

            <form onSubmit={handleSubmit(onSubmitAdjust)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Adjustment Type</label>
                  <select
                    {...register("type")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="STOCK_IN">Stock In (Add)</option>
                    <option value="STOCK_OUT">Stock Out (Subtract)</option>
                    <option value="DAMAGE">Damage (Subtract)</option>
                    <option value="ADJUSTMENT">Set Exact Quantity</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantity to adjust</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    {...register("quantity")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Audit correction, found in backroom..."
                  {...register("notes")}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? "Processing..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
