import { Suspense } from "react";
import { PurchasesContainer } from "@/features/financials/presentation/purchases/PurchasesContainer";

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[#EEE7DD]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        </div>
      }
    >
      <PurchasesContainer />
    </Suspense>
  );
}
