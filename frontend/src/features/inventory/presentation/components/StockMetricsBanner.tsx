"use client";

import React from "react";
import { CircleDollarSign, AlertTriangle, Package } from "lucide-react";
import { useInventoryStockStore } from "../../state/inventory-stock.store";
import { formatNPR } from "@/lib/currency";

export const StockMetricsBanner: React.FC = () => {
  const metrics = useInventoryStockStore((s) => s.metrics);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 select-none">
      {/* Total Valuation */}
      <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-[#71675E] text-xs font-semibold">
          <span>Total Stock Valuation</span>
          <CircleDollarSign className="h-4 w-4 text-[#6B2837]" />
        </div>
        <div className="text-xl font-extrabold font-mono text-[#292320] tabular-nums">
          {formatNPR(metrics.totalValuation)}
        </div>
        <p className="text-[11px] text-[#71675E]">Calculated at current unit cost price</p>
      </div>

      {/* Low Stock Alerts */}
      <div className="p-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-[#B45309] text-xs font-semibold">
          <span>Low Stock Items</span>
          <AlertTriangle className="h-4 w-4 text-[#B45309]" />
        </div>
        <div className="text-xl font-extrabold font-mono text-[#B45309] tabular-nums">
          {metrics.lowStockCount}
        </div>
        <p className="text-[11px] text-[#B45309]/80">SKUs below alert reorder thresholds</p>
      </div>

      {/* Total Items */}
      <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-[#71675E] text-xs font-semibold">
          <span>Total Products &amp; SKUs</span>
          <Package className="h-4 w-4 text-[#2D6A4F]" />
        </div>
        <div className="text-xl font-extrabold font-mono text-[#292320] tabular-nums">
          {metrics.totalItems}
        </div>
        <p className="text-[11px] text-[#71675E]">Active products tracked in inventory</p>
      </div>
    </div>
  );
};

