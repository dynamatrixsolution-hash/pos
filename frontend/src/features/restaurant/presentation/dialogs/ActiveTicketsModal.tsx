"use client";

import React, { useMemo, useState } from "react";
import {
  Receipt,
  Search,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Plus,
  CreditCard,
  X,
} from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore, selectAllActiveTickets } from "../../state/pos-tickets.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { ActiveTicket } from "../../models/pos.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const ActiveTicketsModal = React.memo(function ActiveTicketsModal() {
  const show = usePosUiStore((s) => s.showOccupiedTicketsModal);
  const setShow = usePosUiStore((s) => s.setShowOccupiedTicketsModal);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const dineInView = usePosUiStore((s) => s.dineInView);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);
  const setShowSettlementModal = usePosUiStore((s) => s.setShowSettlementModal);

  const tables = usePosCatalogStore((s) => s.tables);
  const activeAllOrders = usePosTicketsStore((s) => s.activeAllOrders);
  const activeOrderId = usePosTicketsStore((s) => s.activeOrderId);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);
  const selectTakeawayOrDelivery = usePosTicketsStore((s) => s.selectTakeawayOrDelivery);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">("ALL");

  const allActiveTickets = useMemo(
    () => selectAllActiveTickets(tables, activeAllOrders, selectedTableId, activeOrderId, dineInView),
    [tables, activeAllOrders, selectedTableId, activeOrderId, dineInView]
  );

  const counts = useMemo(
    () => ({
      all: allActiveTickets.length,
      dineIn: allActiveTickets.filter((t) => t.ticketType === "DINE_IN").length,
      takeaway: allActiveTickets.filter((t) => t.ticketType === "TAKEAWAY").length,
      delivery: allActiveTickets.filter((t) => t.ticketType === "DELIVERY").length,
    }),
    [allActiveTickets]
  );

  const filteredTickets = useMemo(() => {
    let list = allActiveTickets;
    if (filterType !== "ALL") {
      list = list.filter((t) => t.ticketType === filterType);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.subTitle.toLowerCase().includes(q) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(q))
    );
  }, [allActiveTickets, filterType, searchQuery]);

  if (!show) return null;

  const handleOpenTicket = (tkt: ActiveTicket) => {
    setShow(false);
    if (tkt.ticketType === "DINE_IN" && tkt.table) {
      selectOccupiedSpace(tkt.table, tkt.order ? { activeOrder: tkt.order } : undefined);
    } else if (tkt.order) {
      selectTakeawayOrDelivery(tkt.order);
    }
  };

  const handlePay = (tkt: ActiveTicket) => {
    setShow(false);
    if (tkt.ticketType === "DINE_IN" && tkt.table) {
      selectOccupiedSpace(tkt.table, tkt.order ? { activeOrder: tkt.order } : undefined);
      setShowSettlementModal(true);
    } else if (tkt.order) {
      selectTakeawayOrDelivery(tkt.order);
      setShowSettlementModal(true);
    }
  };

  const handleStartNew = (type: "TAKEAWAY" | "DELIVERY") => {
    setShow(false);
    usePosTicketsStore.getState().setActiveOrder(null);
    usePosUiStore.getState().setSelectedTable("");
    usePosUiStore.getState().setOrderType(type);
    usePosCartStore.getState().syncDraftForTarget(`type_${type}`);
    usePosUiStore.getState().syncUrlView("MENU_POS");
    usePosUiStore.getState().setIsTicketDrawerOpen(true);
    if (type === "DELIVERY") {
      usePosUiStore.getState().setShowDeliveryModal(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-xl rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-3.5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Active Tickets &amp; Open Tabs ({allActiveTickets.length})
              </h3>
              <p className="text-[11px] text-[#71675E]">
                View, add dishes, or settle bills across tables, takeaways and deliveries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Quick New Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, address, table, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          <button
            type="button"
            onClick={() => handleStartNew("TAKEAWAY")}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1 cursor-pointer shrink-0"
            title="Start a new Takeaway order"
          >
            <Plus className="h-3.5 w-3.5 text-[#B45309]" />
            <span>Takeaway</span>
          </button>

          <button
            type="button"
            onClick={() => handleStartNew("DELIVERY")}
            className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1 cursor-pointer shrink-0"
            title="Start a new Delivery order"
          >
            <Plus className="h-3.5 w-3.5 text-[#1E40AF]" />
            <span>Delivery</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[#D8CEC1]/70 pb-2 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === "ALL"
                ? "bg-[#6B2837] text-white"
                : "bg-[#F7F3EC] text-[#71675E] hover:bg-[#EEE7DD]"
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("DINE_IN")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              filterType === "DINE_IN"
                ? "bg-[#6B2837] text-white"
                : "bg-[#F7F3EC] text-[#71675E] hover:bg-[#EEE7DD]"
            }`}
          >
            <Store className="h-3 w-3" />
            <span>Tables ({counts.dineIn})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("TAKEAWAY")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              filterType === "TAKEAWAY"
                ? "bg-[#6B2837] text-white"
                : "bg-[#F7F3EC] text-[#71675E] hover:bg-[#EEE7DD]"
            }`}
          >
            <ShoppingBag className="h-3 w-3" />
            <span>Takeaways ({counts.takeaway})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("DELIVERY")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              filterType === "DELIVERY"
                ? "bg-[#6B2837] text-white"
                : "bg-[#F7F3EC] text-[#71675E] hover:bg-[#EEE7DD]"
            }`}
          >
            <Truck className="h-3 w-3" />
            <span>Deliveries ({counts.delivery})</span>
          </button>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredTickets.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#F7F3EC]/50 space-y-2">
              <Store className="h-8 w-8 text-[#71675E]/40 mx-auto" />
              <p className="font-bold text-xs text-[#292320]">
                {allActiveTickets.length === 0
                  ? "No active tickets or open tabs"
                  : `No active tickets match filter or "${searchQuery}"`}
              </p>
              <p className="text-[11px] text-[#71675E]">
                {allActiveTickets.length === 0
                  ? "Take a new order from tables, takeaways, or deliveries to begin."
                  : "Try clearing filters or search query."}
              </p>
            </div>
          ) : (
            filteredTickets.map((tkt) => (
              <div
                key={tkt.id}
                className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                  tkt.isCurrent
                    ? "border-[#6B2837] bg-[#F8EEF0]/50"
                    : "border-[#D8CEC1] bg-[#FFFCF7] hover:border-[#6B2837]/60"
                }`}
              >
                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-1 ${
                        tkt.ticketType === "DELIVERY"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : tkt.ticketType === "TAKEAWAY"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]"
                      }`}
                    >
                      {tkt.ticketType === "DELIVERY" ? (
                        <Truck className="h-2.5 w-2.5" />
                      ) : tkt.ticketType === "TAKEAWAY" ? (
                        <ShoppingBag className="h-2.5 w-2.5" />
                      ) : (
                        <Store className="h-2.5 w-2.5" />
                      )}
                      <span>
                        {tkt.ticketType === "DELIVERY"
                          ? "Delivery"
                          : tkt.ticketType === "TAKEAWAY"
                          ? "Takeaway"
                          : "Dine-In"}
                      </span>
                    </span>

                    <span className="text-xs font-black text-[#6B2837]">{tkt.title}</span>

                    {tkt.isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#6B2837] text-white">
                        Active in POS
                      </span>
                    )}

                    {tkt.order &&
                      (tkt.order.acceptanceStatus === "PENDING" ||
                        /\[STAFF APPROVAL REQUIRED/i.test(tkt.order.notes || "")) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
                          Pending Confirmation
                        </span>
                      )}

                    {tkt.order && /\[OUT FOR DELIVERY/i.test(tkt.order.notes || "") && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">
                        Out for Delivery
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        tkt.status === "Billed"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-red-100 text-red-800 border border-red-200"
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>

                  {tkt.subTitle && (
                    <p className="text-[11px] text-[#71675E] mt-0.5 truncate">{tkt.subTitle}</p>
                  )}

                  {tkt.order ? (
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#5A504A]">
                      {tkt.orderNumber && (
                        <span className="font-mono text-[11px] text-[#71675E]">
                          #{tkt.orderNumber}
                        </span>
                      )}
                      <span className="text-[11px] text-[#71675E]">
                        {tkt.itemCount} {tkt.itemCount === 1 ? "item" : "items"}
                        {tkt.roundCount > 0 &&
                          ` • ${tkt.roundCount} ${tkt.roundCount === 1 ? "round" : "rounds"}`}
                      </span>
                      <div className="flex items-center gap-1 font-bold">
                        <span className="text-[11px] text-[#71675E]">Running:</span>
                        <span className="font-mono text-[#6B2837] tabular-nums">
                          {formatNPR(tkt.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-[#71675E]">
                      Guests seated • No kitchen rounds yet
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(() => {
                  const notesStr = tkt.order?.notes || "";
                  const isPending =
                    tkt.order?.acceptanceStatus === "PENDING" ||
                    /\[STAFF APPROVAL REQUIRED/i.test(notesStr);
                  const isOutForDelivery = /\[OUT FOR DELIVERY/i.test(notesStr);
                  const isOnlinePrepaid = /\[PAY:\s*(ONLINE|PREPAID|PAID|ESEWA|FONE_PAY|KHALTI)/i.test(notesStr);
                  const isCodPendingDispatch =
                    tkt.ticketType === "DELIVERY" && !isOnlinePrepaid && !isOutForDelivery;
                  const canPayDirectly = !isPending && !isCodPendingDispatch && tkt.totalAmount > 0;

                  return (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenTicket(tkt)}
                        className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open ticket to review, assign rider, or edit order"
                      >
                        <UtensilsCrossed className="h-3 w-3 text-[#6B2837]" />
                        <span>
                          {isPending ? "Review" : isCodPendingDispatch ? "Assign Rider" : "Open"}
                        </span>
                      </button>

                      {canPayDirectly && (
                        <button
                          type="button"
                          onClick={() => handlePay(tkt)}
                          className="h-8 px-3 rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] text-xs font-semibold text-[#FFFCF7] flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={
                            tkt.ticketType === "DELIVERY" && !isOnlinePrepaid
                              ? "Collect COD cash submitted by rider & settle"
                              : "Proceed to payment & settlement"
                          }
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>{tkt.ticketType === "DELIVERY" && !isOnlinePrepaid ? "Settle COD" : "Pay"}</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShow(false);
              syncUrlView("SELECT_SPACE");
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#6B2837] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Browse Floor Layout &amp; All Tables</span>
          </button>

          <button
            type="button"
            onClick={() => setShow(false)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

