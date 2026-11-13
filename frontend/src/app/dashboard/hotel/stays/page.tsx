"use client";

import React, { Suspense } from "react";
import { StaysContainer } from "@/features/hotel/presentation/StaysContainer";

export default function HotelStaysPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F3EC] p-6 space-y-4 animate-pulse">
          <div className="h-10 w-64 bg-[#EEE7DD] rounded-lg" />
          <div className="h-12 w-full bg-[#EEE7DD] rounded-xl" />
          <div className="h-96 w-full bg-[#EEE7DD] rounded-xl" />
        </div>
      }
    >
      <StaysContainer />
    </Suspense>
  );
}
