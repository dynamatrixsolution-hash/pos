"use client";

import React, { useEffect } from "react";
import { useProductsStore } from "../state/products.store";
import { useProductsUiStore } from "../state/products-ui.store";

// Components
import { ProductsHeader } from "./components/ProductsHeader";
import { ProductTable } from "./components/ProductTable";
import { ProductGridView } from "./components/ProductGridView";

// Dialogs
import { ProductModal } from "./dialogs/ProductModal";
import { RecipeBomModal } from "./dialogs/RecipeBomModal";
import { StockAdjustModal } from "./dialogs/StockAdjustModal";
import { BulkImportModal } from "./dialogs/BulkImportModal";

export const ProductsContainer: React.FC = () => {
  const loadInitialData = useProductsStore((s) => s.loadInitialData);
  const viewMode = useProductsUiStore((s) => s.viewMode);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-5 text-[#292320]">
      {/* 1. Header with Controls, Type Tabs, Search, and Action Buttons */}
      <ProductsHeader />

      {/* 2. Main Content View: Table vs Grid Cards */}
      <main className="transition-all">
        {viewMode === "table" ? <ProductTable /> : <ProductGridView />}
      </main>

      {/* 3. Feature Modals & Drawers */}
      <ProductModal />
      <RecipeBomModal />
      <StockAdjustModal />
      <BulkImportModal />
    </div>
  );
};

