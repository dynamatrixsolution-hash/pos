import React, { Suspense } from "react";
import { InventoryContainer } from "@/features/inventory/presentation/InventoryContainer";

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#6B2837] border-t-transparent" />
          <p className="text-xs font-semibold text-[#71675E] mt-2">Loading Inventory System...</p>
        </div>
      }
    >
      <InventoryContainer />
    </Suspense>
  );
}
