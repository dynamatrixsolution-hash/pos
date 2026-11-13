"use client";

import React, { useEffect } from "react";
import { useInventoryOpeningStore } from "../state/inventory-opening.store";
import { OpeningStockHeader } from "./components/OpeningStockHeader";
import { OpeningStockTable } from "./components/OpeningStockTable";
import { OpeningStockModal } from "./dialogs/OpeningStockModal";
import { OpeningStockActionModal } from "./dialogs/OpeningStockActionModal";
import { exportToExcel, exportToPDF } from "@/lib/export-helper";

export const OpeningStockContainer: React.FC = () => {
  const loadInitialData = useInventoryOpeningStore((s) => s.loadInitialData);
  const entries = useInventoryOpeningStore((s) => s.entries);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleExportExcel = () => {
    if (!entries.length) return;
    const exportData = entries.map((e) => ({
      "Product Name": e.product.name,
      SKU: e.product.sku || "",
      Barcode: e.product.barcode || "",
      Branch: e.branch?.name || "",
      Quantity: e.quantity,
      Unit: e.unitType,
      "Purchase Rate": e.purchaseRate,
      "Selling Price": e.sellingPrice,
      "Total Valuation": e.totalValue || e.quantity * e.purchaseRate,
      Batch: e.batchNumber || "",
      Expiry: e.expiryDate ? e.expiryDate.split("T")[0] : "",
      Status: e.approvalStatus,
    }));
    exportToExcel(exportData, `Opening_Stock_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPdf = () => {
    if (!entries.length) return;
    const headers = ["Product", "Branch", "Quantity", "Rate", "Total", "Status"];
    const rows = entries.map((e) => [
      e.product.name,
      e.branch?.name || "",
      `${e.quantity} ${e.unitType}`,
      e.purchaseRate,
      e.totalValue || e.quantity * e.purchaseRate,
      e.approvalStatus,
    ]);
    exportToPDF(
      headers,
      rows,
      "Opening Stock Master Ledger",
      `Opening_Stock_${new Date().toISOString().split("T")[0]}`
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <OpeningStockHeader onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} />
      <OpeningStockTable />
      <OpeningStockModal />
      <OpeningStockActionModal />
    </div>
  );
};
