"use client";

import React, { useEffect } from "react";
import { usePurchasesStore } from "../../state/purchases.store";
import { PurchaseHeader } from "./PurchaseHeader";
import { PurchaseTable } from "./PurchaseTable";
import { PurchaseCreateModal } from "./PurchaseCreateModal";
import { PurchaseDetailsModal } from "./PurchaseDetailsModal";

export const PurchasesContainer: React.FC = () => {
  const loadInitialData = usePurchasesStore((s) => s.loadInitialData);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <PurchaseHeader />
      <PurchaseTable />
      <PurchaseCreateModal />
      <PurchaseDetailsModal />
    </div>
  );
};

