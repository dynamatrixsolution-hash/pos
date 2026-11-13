"use client";

import React, { useEffect } from "react";
import { useInventoryStockStore } from "../state/inventory-stock.store";
import { InventoryHeader } from "./components/InventoryHeader";
import { StockMetricsBanner } from "./components/StockMetricsBanner";
import { StockOverviewTable } from "./components/StockOverviewTable";
import { StockAdjustmentModal } from "./dialogs/StockAdjustmentModal";

export const InventoryContainer: React.FC = () => {
  const loadInventory = useInventoryStockStore((s) => s.loadInventory);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  return (
    <div className="space-y-5">
      {/* 1. Header with Section Tabs and Filters */}
      <InventoryHeader />

      {/* 2. Key Valuation & Alert Metrics */}
      <StockMetricsBanner />

      {/* 3. Real-Time Stock Table */}
      <StockOverviewTable />

      {/* 4. Stock Adjustment Modal */}
      <StockAdjustmentModal />
    </div>
  );
};

