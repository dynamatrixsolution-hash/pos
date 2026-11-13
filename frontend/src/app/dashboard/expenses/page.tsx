import { Suspense } from "react";
import { ExpensesContainer } from "@/features/financials/presentation/expenses/ExpensesContainer";

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[#EEE7DD]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        </div>
      }
    >
      <ExpensesContainer />
    </Suspense>
  );
}
