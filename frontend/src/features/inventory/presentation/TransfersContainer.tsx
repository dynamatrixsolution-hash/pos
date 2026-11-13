"use client";

import React, { useEffect } from "react";
import { useInventoryTransfersStore } from "../state/inventory-transfers.store";
import { TransferHeader } from "./components/TransferHeader";
import { TransferTable } from "./components/TransferTable";
import { TransferCreateModal } from "./dialogs/TransferCreateModal";
import { TransferDetailsModal } from "./dialogs/TransferDetailsModal";

export const TransfersContainer: React.FC = () => {
  const loadInitialData = useInventoryTransfersStore((s) => s.loadInitialData);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <TransferHeader />
      <TransferTable />
      <TransferCreateModal />
      <TransferDetailsModal />
    </div>
  );
};

