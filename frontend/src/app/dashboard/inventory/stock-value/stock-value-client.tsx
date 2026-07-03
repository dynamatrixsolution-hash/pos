"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

export default function StockValueClient() {
  const { currencySymbol } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState("value");
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "branches">("products");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    totalCostValue: 0,
    totalSellingValue: 0,
    totalMarginValue: 0,
    profitMargin: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.append("sortBy", sortBy);

        const res = await fetch(`/api/v1/inventory/stock-value?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products);
          setCategories(data.categories);
          setBranches(data.branches);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Fetch stock value error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [sortBy]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Cost Value</div>
          <div className="text-2xl font-black">{currencySymbol}{summary.totalCostValue.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Selling Value</div>
          <div className="text-2xl font-black text-primary">{currencySymbol}{summary.totalSellingValue.toFixed(2)}</div>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
          <div className="text-primary text-xs font-bold uppercase tracking-wider mb-1">Profit Margin</div>
          <div className="text-2xl font-black text-primary flex items-center gap-2">
            {summary.profitMargin.toFixed(2)}%
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-2xl p-0 overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase transition-colors ${
              activeTab === "products"
                ? "border-b-2 border-b-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Products ({summary.totalProducts})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase transition-colors ${
              activeTab === "categories"
                ? "border-b-2 border-b-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setActiveTab("branches")}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase transition-colors ${
              activeTab === "branches"
                ? "border-b-2 border-b-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Branch
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Sort Controls */}
          {activeTab === "products" && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="value">Sort by Value</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="category">Sort by Category</option>
            </select>
          )}

          {/* Content */}
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading report...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    {activeTab === "products" && (
                      <>
                        <th className="py-3 px-2 text-left">Product</th>
                        <th className="py-3 px-2 text-center">Qty</th>
                        <th className="py-3 px-2 text-right">Cost Price</th>
                        <th className="py-3 px-2 text-right">Sell Price</th>
                        <th className="py-3 px-2 text-right">Cost Value</th>
                        <th className="py-3 px-2 text-right">Sell Value</th>
                        <th className="py-3 px-2 text-right">Margin %</th>
                      </>
                    )}
                    {activeTab === "categories" && (
                      <>
                        <th className="py-3 px-2 text-left">Category</th>
                        <th className="py-3 px-2 text-center">Qty</th>
                        <th className="py-3 px-2 text-right">Cost Value</th>
                        <th className="py-3 px-2 text-right">Sell Value</th>
                        <th className="py-3 px-2 text-right">Margin Value</th>
                      </>
                    )}
                    {activeTab === "branches" && (
                      <>
                        <th className="py-3 px-2 text-left">Branch</th>
                        <th className="py-3 px-2 text-center">Qty</th>
                        <th className="py-3 px-2 text-right">Cost Value</th>
                        <th className="py-3 px-2 text-right">Sell Value</th>
                        <th className="py-3 px-2 text-right">Margin Value</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {activeTab === "products" &&
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-secondary/10">
                        <td className="py-3 px-2">
                          <div className="font-bold text-primary">{p.sku}</div>
                          <div className="text-[11px]">{p.name}</div>
                        </td>
                        <td className="py-3 px-2 text-center font-bold">{p.quantity}</td>
                        <td className="py-3 px-2 text-right">{currencySymbol}{p.costPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-primary font-medium">{currencySymbol}{p.sellingPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold">{currencySymbol}{p.costValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-primary">{currencySymbol}{p.sellingValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">{p.marginPercent}%</td>
                      </tr>
                    ))}

                  {activeTab === "categories" &&
                    categories.map((c: any) => (
                      <tr key={c.category} className="hover:bg-secondary/10">
                        <td className="py-3 px-2 font-bold">{c.category}</td>
                        <td className="py-3 px-2 text-center font-bold">{c.quantity}</td>
                        <td className="py-3 px-2 text-right font-bold">{currencySymbol}{c.costValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-primary">{currencySymbol}{c.sellingValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-green-600">{currencySymbol}{c.marginValue.toFixed(2)}</td>
                      </tr>
                    ))}

                  {activeTab === "branches" &&
                    branches.map((b: any) => (
                      <tr key={b.branchId} className="hover:bg-secondary/10">
                        <td className="py-3 px-2 font-bold">{b.branchName}</td>
                        <td className="py-3 px-2 text-center font-bold">{b.quantity}</td>
                        <td className="py-3 px-2 text-right font-bold">{currencySymbol}{b.costValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-primary">{currencySymbol}{b.sellingValue.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-bold text-green-600">{currencySymbol}{b.marginValue.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
