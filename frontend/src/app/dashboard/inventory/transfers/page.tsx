import { Suspense } from "react";
import { TransfersContainer } from "@/features/inventory/presentation/TransfersContainer";

export default function StockTransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[#EEE7DD]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[#EEE7DD]" />
        </div>
      }
    >
      <TransfersContainer />
    </Suspense>
  );
}
