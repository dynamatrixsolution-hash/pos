"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Truck,
  Store,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  UtensilsCrossed,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "@/core/api/api-client";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const RestaurantReportsContainer: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.restaurant.getVoidReconciliationReport();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSales = Number(data?.totalFoodSales) || 0;
  const totalCogs = Number(data?.totalCogs) || 0;
  const grossProfit = Math.max(0, totalSales - totalCogs);
  const foodCostPct = totalSales > 0 ? (totalCogs / totalSales) * 100 : 0;

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFCF7] p-4 rounded-xl border border-[#D8CEC1] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#6B2837] text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">
              Restaurant Sales &amp; Food Cost Reconciliation
            </h1>
            <p className="text-xs text-[#71675E]">
              Audited dining sales, raw ingredient consumption COGS, recipe gross margins, and void tracking
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="h-8 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            Settled Food Sales
          </span>
          <div className="text-xl font-black font-mono text-[#16A34A] tabular-nums mt-1">
            {formatNPR(totalSales)}
          </div>
          <p className="text-[10px] text-[#71675E] mt-1">Gross paid restaurant tickets</p>
        </div>

        <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            Ingredient COGS
          </span>
          <div className="text-xl font-black font-mono text-[#B45309] tabular-nums mt-1">
            {formatNPR(totalCogs)}
          </div>
          <p className="text-[10px] text-[#71675E] mt-1">Raw stock consumption deducted</p>
        </div>

        <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            Estimated Gross Profit
          </span>
          <div className="text-xl font-black font-mono text-[#6B2837] tabular-nums mt-1">
            {formatNPR(grossProfit)}
          </div>
          <p className="text-[10px] text-[#71675E] mt-1">Kitchen sales margin</p>
        </div>

        <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
            Food Cost Percentage
          </span>
          <div className="text-xl font-black font-mono text-[#292320] tabular-nums mt-1">
            {foodCostPct.toFixed(1)}%
          </div>
          <p className="text-[10px] text-[#71675E] mt-1">Industry target: 28% – 35%</p>
        </div>
      </div>

      {/* Navigation Quick Links to Full Financial Sub-modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/dashboard/purchases"
          className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div>
            <div className="font-bold text-xs text-[#292320] group-hover:text-[#6B2837]">
              Vendor Purchase Bills
            </div>
            <div className="text-[11px] text-[#71675E]">Manage raw food ingredient invoices</div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#71675E] group-hover:text-[#6B2837] transition-colors" />
        </Link>

        <Link
          href="/dashboard/payments/sent"
          className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div>
            <div className="font-bold text-xs text-[#292320] group-hover:text-[#6B2837]">
              Supplier Payables
            </div>
            <div className="text-[11px] text-[#71675E]">Settle vendor dues &amp; bank disbursements</div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#71675E] group-hover:text-[#6B2837] transition-colors" />
        </Link>

        <Link
          href="/dashboard/payments/received"
          className="p-3.5 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
        >
          <div>
            <div className="font-bold text-xs text-[#292320] group-hover:text-[#6B2837]">
              Customer Receivables
            </div>
            <div className="text-[11px] text-[#71675E]">Track guest remittances &amp; QR payments</div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#71675E] group-hover:text-[#6B2837] transition-colors" />
        </Link>
      </div>

      {/* Dish Recipe Gross Margin Table */}
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-2xs">
        <div className="p-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-[#6B2837]" />
            <h3 className="text-xs font-bold text-[#292320]">
              Menu Item Food Cost &amp; Profit Margins
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
              <tr>
                <th className="px-3.5 py-3">Menu Dish</th>
                <th className="px-3.5 py-3 text-right">Units Sold</th>
                <th className="px-3.5 py-3 text-right">Revenue (NPR)</th>
                <th className="px-3.5 py-3 text-right">Raw Cost (COGS)</th>
                <th className="px-3.5 py-3 text-right">Gross Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CEC1]/60">
              {data?.cogsByDish && Object.keys(data.cogsByDish).length > 0 ? (
                Object.entries(data.cogsByDish).map(([dishId, dish]: any) => {
                  const rev = Number(dish.revenue) || 0;
                  const cogs = Number(dish.totalCogs) || 0;
                  const marginPct = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;

                  return (
                    <tr key={dishId} className="hover:bg-[#F7F3EC]/50 transition-colors">
                      <td className="px-3.5 py-3 font-bold text-[#292320]">{dish.name}</td>
                      <td className="px-3.5 py-3 text-right tabular-nums">{dish.quantity || 1}</td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-[#292320] tabular-nums">
                        {formatNPR(rev)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-[#B45309] tabular-nums">
                        {formatNPR(cogs)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums">
                        <span
                          className={
                            marginPct >= 65
                              ? "text-[#16A34A]"
                              : marginPct >= 50
                              ? "text-[#D97706]"
                              : "text-[#DC2626]"
                          }
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#71675E] italic">
                    {isLoading ? "Loading food cost breakdown..." : "No settled orders in the active period."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

