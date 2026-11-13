"use client";

import React, { useEffect } from "react";
import { useHotelFoliosStore } from "../state/hotel-folios.store";

// Components
import { FoliosListPane } from "./components/FoliosListPane";
import { FolioLedgerPane } from "./components/FolioLedgerPane";

// Dialogs
import { PostChargeModal } from "./dialogs/PostChargeModal";
import { SettleFolioModal } from "./dialogs/SettleFolioModal";

export const FoliosContainer: React.FC = () => {
  const loadFolios = useHotelFoliosStore((s) => s.loadFolios);

  useEffect(() => {
    loadFolios();
  }, [loadFolios]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-4 sm:p-6 lg:p-8 space-y-4 text-[#292320]">
      {/* 1. Header Banner */}
      <div>
        <h1 className="text-xl font-bold text-[#292320] tracking-tight">
          Hotel Billing &amp; Guest Folios
        </h1>
        <p className="text-xs text-[#71675E] mt-0.5">
          Real-time room charges, F&amp;B incidental postings, split payment settlement, and tax invoices
        </p>
      </div>

      {/* 2. Main Two-Pane Ledger Workspace */}
      <main className="flex flex-col lg:flex-row gap-4 items-start">
        <FoliosListPane />
        <FolioLedgerPane />
      </main>

      {/* 3. Feature Modals */}
      <PostChargeModal />
      <SettleFolioModal />
    </div>
  );
};

