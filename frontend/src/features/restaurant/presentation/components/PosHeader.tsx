"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
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
import { SpaceCategory } from "../../models/pos.types";

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
  const dineInView = viewParam === "menu" ? "MENU_POS" : viewParam === "tables" ? "SELECT_SPACE" : storeDineInView;
  const orderType = usePosUiStore((s) => s.orderType);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const isTicketDrawerOpen = usePosUiStore((s) => s.isTicketDrawerOpen);
  const toggleTicketDrawer = usePosUiStore((s) => s.toggleTicketDrawer);
  const setOrderType = usePosUiStore((s) => s.setOrderType);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);
  const setShowOccupiedTicketsModal = usePosUiStore((s) => s.setShowOccupiedTicketsModal);
  const setShowDeliveryModal = usePosUiStore((s) => s.setShowDeliveryModal);

  // Catalog store filters
  const tables = usePosCatalogStore((s) => s.tables);
  const floors = usePosCatalogStore((s) => s.floors);
  const selectedFloorId = usePosCatalogStore((s) => s.selectedFloorId);
  const setSelectedFloorId = usePosCatalogStore((s) => s.setSelectedFloorId);
  const selectedSpaceType = usePosCatalogStore((s) => s.selectedSpaceType);
  const setSelectedSpaceType = usePosCatalogStore((s) => s.setSelectedSpaceType);
  const selectedStatusFilter = usePosCatalogStore((s) => s.selectedStatusFilter);
  const setSelectedStatusFilter = usePosCatalogStore((s) => s.setSelectedStatusFilter);
  const menuSearchQuery = usePosCatalogStore((s) => s.menuSearchQuery);
  const setMenuSearchQuery = usePosCatalogStore((s) => s.setMenuSearchQuery);

  const activeAllOrders = usePosTicketsStore((s) => s.activeAllOrders);
  const activeOrderId = usePosTicketsStore((s) => s.activeOrderId);
  const existingRounds = usePosTicketsStore((s) => s.existingRounds);
  const existingOrderTotal = usePosTicketsStore((s) => s.existingOrderTotal);

  const draftLines = usePosCartStore((s) => s.draftLines);

  const [orderTypeDropdownOpen, setOrderTypeDropdownOpen] = useState(false);

  // Derive aggregated tickets
  const allActiveTickets = useMemo(
    () => selectAllActiveTickets(tables, activeAllOrders, selectedTableId, activeOrderId, dineInView),
    [tables, activeAllOrders, selectedTableId, activeOrderId, dineInView]
  );

  const totalActiveTicketsCount = allActiveTickets.length;
  const totalActiveTicketsAmount = useMemo(
    () => allActiveTickets.reduce((sum, item) => sum + item.totalAmount, 0),
    [allActiveTickets]
  );

  // Calculate items in current ticket
  const draftItemsCount = draftLines.reduce((acc, l) => acc + l.quantity, 0);
  const existingItemsCount = existingRounds.reduce(
    (acc, r) =>
      acc +
      r.lines.filter((l) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED").length,
    0
  );
  const totalItemsInOrder = draftItemsCount + existingItemsCount;

  // Running balance for current order
  const draftRoundTotal = draftLines.reduce((sum, line) => sum + line.totalPrice, 0);
  const grandRunningTotal = (parseFloat(existingOrderTotal) || 0) + draftRoundTotal;

  // Space status counts
  const availableCount = useMemo(() => tables.filter((t) => t.status === "AVAILABLE").length, [tables]);
  const occupiedCount = useMemo(() => tables.filter((t) => t.status === "OCCUPIED").length, [tables]);
  const billedCount = useMemo(() => tables.filter((t) => t.status === "BILLED").length, [tables]);

  return (
    <header className="h-14 border-b border-[#D8CEC1] bg-[#FFFCF7] px-4 flex items-center justify-between gap-3 shrink-0 select-none shadow-2xs">
      {/* ===================================================================== */}
      {/* LEFT SIDE: Service Mode & View-Specific Controls                     */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Service Mode Dropdown (Outside overflow container so dropdown is NEVER clipped) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOrderTypeDropdownOpen((prev) => !prev)}
            className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-bold text-[#6B2837] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {orderType === "DINE_IN" ? (
              <Store className="h-3.5 w-3.5" />
            ) : orderType === "TAKEAWAY" ? (
              <ShoppingBag className="h-3.5 w-3.5" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            <span>{orderType === "DINE_IN" ? "Dine-In" : orderType === "TAKEAWAY" ? "Takeaway" : "Delivery"}</span>
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
                    }
                    setOrderType("DINE_IN");
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

        {/* View-Specific Filters / Controls Container */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">

        {/* ================================================================= */}
        {/* VIEW A: TABLES VIEW (Floor, Space & Status Filters in SAME ROW)   */}
        {/* ================================================================= */}
        {dineInView === "SELECT_SPACE" && (
          <div className="flex items-center gap-2">
            {/* Floor Selector Dropdown */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E] hidden md:inline">
                Floor:
              </span>
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Floors ({tables.length})</option>
                {floors.map((f) => {
                  const count = tables.filter((t) => t.floorId === f.id).length;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Space Type Selector Dropdown */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E] hidden md:inline">
                Space:
              </span>
              <select
                value={selectedSpaceType}
                onChange={(e) => setSelectedSpaceType(e.target.value as SpaceCategory)}
                className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Spaces ({tables.length})</option>
                <option value="TABLE">Dining Tables</option>
                <option value="CABIN">Private Cabins</option>
                <option value="VIP_ROOM">VIP Rooms</option>
                <option value="HALL">Banquet Halls</option>
              </select>
            </div>

            {/* Status Selector Dropdown (Consistent, neat dropdown) */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71675E] hidden md:inline">
                Status:
              </span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses ({tables.length})</option>
                <option value="AVAILABLE">Available ({availableCount})</option>
                <option value="OCCUPIED">Occupied ({occupiedCount})</option>
                <option value="BILLED">Billed ({billedCount})</option>
              </select>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW B: ORDERING VIEW (MENU_POS - Food Search Input)              */}
        {/* ================================================================= */}
        {dineInView === "MENU_POS" && (
          <div className="flex items-center gap-2">
            {/* Food Search Input */}
            <div className="relative w-56 sm:w-72 md:w-80 lg:w-96 shrink-0">
              <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search food by name, code..."
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                className="h-8 w-full pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:bg-[#FFFCF7] focus:outline-none placeholder:text-[#71675E]"
              />
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT SIDE: Visual Summary / Order & Kitchen Tools                   */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2 shrink-0">
        {/* On Tables View: Show clean space availability stats */}
        {dineInView === "SELECT_SPACE" && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD] text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
              <span>{availableCount} Available</span>
            </span>
            {occupiedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FDF2F4] text-[#B91C1C] border border-[#FCA5A5]/40 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span>{occupiedCount} Occupied</span>
              </span>
            )}
            {billedCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                <span>{billedCount} Billed</span>
              </span>
            )}
          </div>
        )}

        {/* On Ordering View (MENU_POS): Show Active Tickets & Order Drawer */}
        {dineInView === "MENU_POS" && (
          <div className="flex items-center gap-2">
            {totalActiveTicketsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowOccupiedTicketsModal(true)}
                className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#6B2837] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="View all active tickets & busy tables"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Active Tickets ({totalActiveTicketsCount})</span>
                <span className="font-mono text-[11px] bg-[#6B2837]/10 text-[#6B2837] px-1.5 py-0.5 rounded font-bold tabular-nums hidden sm:inline">
                  {formatNPR(totalActiveTicketsAmount)}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTicketDrawer}
              className={`h-8 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                totalItemsInOrder > 0
                  ? "bg-[#6B2837] text-white hover:bg-[#541E2A]"
                  : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
              title="Toggle current order draft and kitchen rounds panel"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>Current Order ({totalItemsInOrder})</span>
              {totalItemsInOrder > 0 && (
                <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded tabular-nums">
                  {formatNPR(grandRunningTotal)}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
});
