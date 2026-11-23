"use client";

import React, { useEffect } from "react";
import { useCustomersStore } from "../../state/customers.store";
import { CustomerHeader } from "./CustomerHeader";
import { CustomerTable } from "./CustomerTable";
import { CustomerModal } from "./CustomerModal";

export const CustomersContainer: React.FC = () => {
  const loadCustomers = useCustomersStore((s) => s.loadCustomers);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <CustomerHeader />
      <CustomerTable />
      <CustomerModal />
    </div>
  );
};

