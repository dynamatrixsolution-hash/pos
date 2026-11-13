"use client";

import React, { useEffect } from "react";
import { useSuppliersStore } from "../../state/suppliers.store";
import { SupplierHeader } from "./SupplierHeader";
import { SupplierTable } from "./SupplierTable";
import { SupplierModal } from "./SupplierModal";

export const SuppliersContainer: React.FC = () => {
  const loadSuppliers = useSuppliersStore((s) => s.loadSuppliers);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <SupplierHeader />
      <SupplierTable />
      <SupplierModal />
    </div>
  );
};

