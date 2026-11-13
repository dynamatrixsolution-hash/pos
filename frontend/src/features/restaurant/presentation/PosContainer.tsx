"use client";

import React, { useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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

export const PosContainer: React.FC = () => {
  const searchParams = useSearchParams();

  // Stores
  const dineInView = usePosUiStore((s) => s.dineInView);
  const setDineInView = usePosUiStore((s) => s.setDineInView);
  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);
  const isTicketDrawerOpen = usePosUiStore((s) => s.isTicketDrawerOpen);
  const setIsTicketDrawerOpen = usePosUiStore((s) => s.setIsTicketDrawerOpen);

  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);
  const tables = usePosCatalogStore((s) => s.tables);

  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);
  const fetchTableOrders = usePosTicketsStore((s) => s.fetchTableOrders);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);

  const viewParam = searchParams.get("view");
  const tableIdParam = searchParams.get("tableId");

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

  // Initial catalog load & silent poll
  useEffect(() => {
    loadInitialCatalog();
    fetchActiveOrders();

    // 5-second silent background poll for live kitchen orders
    const interval = setInterval(() => {
      fetchActiveOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadInitialCatalog, fetchActiveOrders]);

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
      <main className="relative flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col">
          {dineInView === "SELECT_SPACE" ? (
            <FloorLayoutView />
          ) : (
            <MenuCatalogView />
          )}
        </div>

        {/* 3. Ticket Drawer (Right sliding panel - displayed strictly in Menu Ordering mode) */}
        {dineInView === "MENU_POS" && <TicketDrawer />}
      </main>

      {/* 4. Feature Dialogs */}
      <ActiveTicketsModal />
      <TableInspectionModal />
      <SeatingModal />
      <DishModifierModal />
      <TransferModal />
      <MergeModal />
      <SettlementModal />
      <DeliveryModal />
    </div>
  );
};
