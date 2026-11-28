"use client";

import React, { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";
import { usePosUiStore } from "../state/pos-ui.store";
import { usePosCatalogStore } from "../state/pos-catalog.store";
import { usePosTicketsStore } from "../state/pos-tickets.store";
import { usePosCartStore } from "../state/pos-cart.store";

// Components
import { PosHeader } from "./components/PosHeader";
import { FloorLayoutView } from "./components/FloorLayoutView";
import { MenuCatalogView } from "./components/MenuCatalogView";
import { TicketDrawer } from "./components/TicketDrawer";

// Dialogs
import { ActiveTicketsModal } from "./dialogs/ActiveTicketsModal";
import { TableInspectionModal } from "./dialogs/TableInspectionModal";
import { SeatingModal } from "./dialogs/SeatingModal";
import { DishModifierModal } from "./dialogs/DishModifierModal";
import { TransferModal } from "./dialogs/TransferModal";
import { MergeModal } from "./dialogs/MergeModal";
import { SettlementModal } from "./dialogs/SettlementModal";
import { DeliveryModal } from "./dialogs/DeliveryModal";
import { LineAdjustmentModal } from "./dialogs/LineAdjustmentModal";
import { CancelOrderModal } from "./dialogs/CancelOrderModal";

export const PosContainer: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stores
  const dineInView = usePosUiStore((s) => s.dineInView);
  const setDineInView = usePosUiStore((s) => s.setDineInView);
  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const setIsTicketDrawerOpen = usePosUiStore((s) => s.setIsTicketDrawerOpen);
  const setNavigator = usePosUiStore((s) => s.setNavigator);

  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);
  const refreshTables = usePosCatalogStore((s) => s.refreshTables);
  const tables = usePosCatalogStore((s) => s.tables);

  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);
  const fetchTableOrders = usePosTicketsStore((s) => s.fetchTableOrders);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);

  const viewParam = searchParams.get("view");
  const tableIdParam = searchParams.get("tableId");

  // Bind Next.js router.replace so syncUrlView keeps searchParams & sidebar in sync
  useEffect(() => {
    setNavigator((url) => router.replace(url, { scroll: false }));
    return () => setNavigator(null);
  }, [router, setNavigator]);

  // React directly to Next.js route / searchParam changes
  useEffect(() => {
    if (viewParam === "menu") {
      setDineInView("MENU_POS");
      setIsTicketDrawerOpen(true);
      if (tableIdParam) {
        setSelectedTable(tableIdParam);
        fetchTableOrders(tableIdParam);
        usePosCartStore.getState().syncDraftForTarget(`table_${tableIdParam}`);
      }
    } else {
      setDineInView("SELECT_SPACE");
      setIsTicketDrawerOpen(false);
      setSelectedTable("");
    }
  }, [viewParam, tableIdParam, setDineInView, setIsTicketDrawerOpen, setSelectedTable, fetchTableOrders]);

  // Initial catalog & active tickets load
  useEffect(() => {
    loadInitialCatalog();
    fetchActiveOrders();
  }, [loadInitialCatalog, fetchActiveOrders]);

  // 5-second visibility-aware, overlap-safe poll for live active tickets AND table statuses
  const pollLiveFloor = useCallback(async () => {
    await Promise.all([fetchActiveOrders(), refreshTables()]);
  }, [fetchActiveOrders, refreshTables]);

  useVisibilityPolling(pollLiveFloor, 5000);

  const hasHydratedRef = React.useRef(false);

  // When tables finish loading and tableId is in URL, auto-select ONCE on initial load
  useEffect(() => {
    if (!hasHydratedRef.current && tables.length > 0) {
      hasHydratedRef.current = true;
      if (tableIdParam && viewParam === "menu") {
        const match = tables.find((t) => t.id === tableIdParam);
        if (match) {
          setSelectedTable(match.id, match.currentSessionId || "");
          if (match.status === "OCCUPIED") {
            selectOccupiedSpace(match);
          }
        }
      }
    }
  }, [tableIdParam, viewParam, tables, setSelectedTable, selectOccupiedSpace]);

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#F7F3EC] text-[#292320]">
      {/* 1. Header Bar */}
      <PosHeader />

      {/* 2. Main Body (Floor Layout or Menu Catalog) */}
      <div className="relative flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col">
          {dineInView === "SELECT_SPACE" ? (
            <FloorLayoutView />
          ) : (
            <MenuCatalogView />
          )}
        </div>

        {/* 3. Ticket Drawer (Right sliding panel - displayed strictly in Menu Ordering mode) */}
        {dineInView === "MENU_POS" && <TicketDrawer />}
      </div>

      {/* 4. Feature Dialogs */}
      <ActiveTicketsModal />
      <TableInspectionModal />
      <SeatingModal />
      <DishModifierModal />
      <TransferModal />
      <MergeModal />
      <SettlementModal />
      <DeliveryModal />
      <LineAdjustmentModal />
      <CancelOrderModal />
    </div>
  );
};
