"use client";

import React, { Suspense } from "react";
import { FoliosContainer } from "@/features/hotel/presentation/FoliosContainer";

export default function GuestFoliosBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F3EC] p-6 space-y-4 animate-pulse">
          <div className="h-10 w-64 bg-[#EEE7DD] rounded-lg" />
          <div className="h-12 w-full bg-[#EEE7DD] rounded-xl" />
          <div className="h-[600px] w-full bg-[#EEE7DD] rounded-xl" />
        </div>
      }
    >
      <FoliosContainer />
    </Suspense>
  );
}
