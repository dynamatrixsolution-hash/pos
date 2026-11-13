"use client";

import React, { useEffect } from "react";
import { useExpensesStore } from "../../state/expenses.store";
import { ExpenseHeader } from "./ExpenseHeader";
import { ExpenseTable } from "./ExpenseTable";
import { ExpenseCreateModal } from "./ExpenseCreateModal";

export const ExpensesContainer: React.FC = () => {
  const loadInitialData = useExpensesStore((s) => s.loadInitialData);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#F7F3EC] min-h-screen text-[#292320]">
      <ExpenseHeader />
      <ExpenseTable />
      <ExpenseCreateModal />
    </div>
  );
};

