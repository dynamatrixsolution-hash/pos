"use client";

import React, { Suspense } from "react";
import { RoomsContainer } from "@/features/hotel/presentation/RoomsContainer";

export default function HotelRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F7F3EC]">
          <div className="text-center space-y-2">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#6B2837] border-t-transparent" />
            <p className="text-xs font-semibold text-[#71675E]">Loading Rooms &amp; Floor Manager...</p>
          </div>
        </div>
      }
    >
      <RoomsContainer />
    </Suspense>
  );
}
