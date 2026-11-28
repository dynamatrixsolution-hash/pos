"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Store,
  Receipt,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  ChevronDown,
  Search,
} from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore, selectAllActiveTickets } from "../../state/pos-tickets.store";
import { usePosCartStore } from "../../state/pos-cart.store";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PosHeader = React.memo(function PosHeader() {
  const searchParams = useSearchParams();
  const storeDineInView = usePosUiStore((s) => s.dineInView);
  const viewParam = searchParams.get("view");
  const dineInView =
    viewParam === "menu" ? "MENU_POS" : viewParam === "tables" ? "SELECT_SPACE" : storeDineInView;

  const orderType = usePosUiStore((s) => s.orderType);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const toggleTicketDrawer = usePosUiStore((s) => s.toggleTicketDrawer);
  const setOrderType = usePosUiStore((s) => s.setOrderType);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);
  const setShowOccupiedTicketsModal = usePosUiStore((s) => s.setShowOccupiedTicketsModal);
  const setShowDeliveryModal = usePosUiStore((s) => s.setShowDeliveryModal);

  const tables = usePosCatalogStore((s) => s.tables);
  const selectedFloorId = usePosCatalogStore((s) => s.selectedFloorId);
  const menuSearchQuery = usePosCatalogStore((s) => s.menuSearchQuery);
  const setMenuSearchQuery = usePosCatalogStore((s) => s.setMenuSearchQuery);

  const activeAllOrders = usePosTicketsStore((s) => s.activeAllOrders);
  const activeOrderId = usePosTicketsStore((s) => s.activeOrderId);
  const existingRounds = usePosTicketsStore((s) => s.existingRounds);
  const existingOrderTotal = usePosTicketsStore((s) => s.existingOrderTotal);

  const draftLines = usePosCartStore((s) => s.draftLines);

  const [orderTypeDropdownOpen, setOrderTypeDropdownOpen] = useState(false);

  const allActiveTickets = useMemo(
    () => selectAllActiveTickets(tables, activeAllOrders, selectedTableId, activeOrderId, dineInView),
    [tables, activeAllOrders, selectedTableId, activeOrderId, dineInView]
  );

  const totalActiveTicketsCount = allActiveTickets.length;
  const totalActiveTicketsAmount = useMemo(
    () => allActiveTickets.reduce((sum, item) => sum + item.totalAmount, 0),
    [allActiveTickets]
  );

  const draftItemsCount = draftLines.reduce((acc, l) => acc + l.quantity, 0);
  const existingItemsCount = existingRounds.reduce(
    (acc, r) =>
      acc +
      r.lines.filter((l) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED")
        .length,
    0
  );
  const totalItemsInOrder = draftItemsCount + existingItemsCount;
  const draftRoundTotal = draftLines.reduce((sum, line) => sum + line.totalPrice, 0);
  const grandRunningTotal = (parseFloat(existingOrderTotal) || 0) + draftRoundTotal;

  // Floor-scoped status counts so header badges stay accurate when filtering by floor
  const floorScopedTables = useMemo(
    () =>
      selectedFloorId === "ALL" ? tables : tables.filter((t) => t.floorId === selectedFloorId),
    [tables, selectedFloorId]
  );

  const statusCounts = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let billed = 0;
    let reserved = 0;
    for (const t of floorScopedTables) {
      if (t.status === "AVAILABLE") available++;
      else if (t.status === "OCCUPIED") occupied++;
      else if (t.status === "BILLED") billed++;
      else if (t.status === "RESERVED") reserved++;
    }
    return { available, occupied, billed, reserved };
  }, [floorScopedTables]);

  return (
    <header className="min-h-14 border-b border-[#D8CEC1] bg-[#FFFCF7] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
      {/* LEFT: Service Mode + Tables/Menu Toggle + Menu Search */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        {/* Service Mode Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOrderTypeDropdownOpen((prev) => !prev)}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-bold text-[#6B2837] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {orderType === "DINE_IN" ? (
              <Store className="h-3.5 w-3.5" />
            ) : orderType === "TAKEAWAY" ? (
              <ShoppingBag className="h-3.5 w-3.5" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            <span>
              {orderType === "DINE_IN" ? "Dine-In" : orderType === "TAKEAWAY" ? "Takeaway" : "Delivery"}
            </span>
            <ChevronDown className="h-3 w-3 text-[#71675E]" />
          </button>

          {orderTypeDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOrderTypeDropdownOpen(false)} />
              <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-xs z-50 py-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    if (orderType !== "DINE_IN") {
                      usePosTicketsStore.getState().setActiveOrder(null);
                      usePosUiStore.getState().setSelectedTable("", "");
                      usePosCartStore.getState().syncDraftForTarget("type_DINE_IN");
                      setOrderType("DINE_IN");
                      syncUrlView("SELECT_SPACE");
                    }
                    setOrderTypeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                    orderType === "DINE_IN"
                      ? "bg-[#F7F3EC] text-[#6B2837] font-bold"
                      : "text-[#292320] hover:bg-[#F7F3EC]"
                  }`}
                >
                  <Store className="h-4 w-4 text-[#6B2837]" />
                  <div>
                    <div>Dine-In</div>
                    <div className="text-[10px] text-[#71675E] font-normal">Table &amp; Cabin service</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    usePosUiStore.getState().setSelectedTable("", "");
                    usePosTicketsStore.getState().setActiveOrder(null);
                    setOrderType("TAKEAWAY");
                    usePosCartStore.getState().syncDraftForTarget("type_TAKEAWAY");
                    setOrderTypeDropdownOpen(false);
                    syncUrlView("MENU_POS");
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                    orderType === "TAKEAWAY"
                      ? "bg-[#F7F3EC] text-[#6B2837] font-bold"
                      : "text-[#292320] hover:bg-[#F7F3EC]"
                  }`}
                >
                  <ShoppingBag className="h-4 w-4 text-[#6B2837]" />
                  <div>
                    <div>Takeaway</div>
                    <div className="text-[10px] text-[#71675E] font-normal">Parcel / Counter pickup</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    usePosUiStore.getState().setSelectedTable("", "");
                    usePosTicketsStore.getState().setActiveOrder(null);
                    setOrderType("DELIVERY");
                    usePosCartStore.getState().syncDraftForTarget("type_DELIVERY");
                    setOrderTypeDropdownOpen(false);
                    syncUrlView("MENU_POS");
                    setShowDeliveryModal(true);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                    orderType === "DELIVERY"
                      ? "bg-[#F7F3EC] text-[#6B2837] font-bold"
                      : "text-[#292320] hover:bg-[#F7F3EC]"
                  }`}
                >
                  <Truck className="h-4 w-4 text-[#6B2837]" />
                  <div>
                    <div>Delivery</div>
                    <div className="text-[10px] text-[#71675E] font-normal">Dispatched rider order</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Menu Search Input (MENU_POS only) */}
        {dineInView === "MENU_POS" && (
          <div className="relative w-48 sm:w-64 lg:w-80 shrink-0">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="pos-menu-search"
              type="text"
              placeholder="Search food by name, code..."
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              aria-label="Search food by name or code"
              className="h-8 w-full pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>
        )}
      </div>

      {/* RIGHT: Live Status Summary, Active Tickets & Order Drawer */}
      <div className="flex items-center gap-2 shrink-0">
        {dineInView === "SELECT_SPACE" && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0] text-[11px] font-semibold tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-[#28634B]" />
              {statusCounts.available} Free
            </span>
            {statusCounts.occupied > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] text-[11px] font-semibold tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B33432]" />
                {statusCounts.occupied} Occupied
              </span>
            )}
            {statusCounts.billed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6] text-[11px] font-semibold tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-[#315F85]" />
                {statusCounts.billed} Billed
              </span>
            )}
            {statusCounts.reserved > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD] text-[11px] font-semibold tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-[#946000]" />
                {statusCounts.reserved} Reserved
              </span>
            )}
          </div>
        )}

        {/* Active Tickets button accessible from BOTH Tables and Menu views */}
        {totalActiveTicketsCount > 0 && (
          <button
            type="button"
            onClick={() => setShowOccupiedTicketsModal(true)}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#6B2837] flex items-center gap-1.5 cursor-pointer transition-colors"
            title="View all active dine-in, takeaway, and delivery tickets"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Active ({totalActiveTicketsCount})</span>
            <span className="font-mono text-[11px] bg-[#F7F3EC] text-[#6B2837] px-1.5 py-0.5 rounded font-bold tabular-nums hidden md:inline">
              {formatNPR(totalActiveTicketsAmount)}
            </span>
          </button>
        )}

        {dineInView === "MENU_POS" && (
          <button
            type="button"
            onClick={toggleTicketDrawer}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
              totalItemsInOrder > 0
                ? "bg-[#6B2837] text-[#FFFCF7] hover:bg-[#541E2A]"
                : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
            }`}
            title="Toggle current order draft and kitchen rounds panel"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>Order ({totalItemsInOrder})</span>
            {totalItemsInOrder > 0 && (
              <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded tabular-nums">
                {formatNPR(grandRunningTotal)}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
});
