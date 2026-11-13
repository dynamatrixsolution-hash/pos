"use client";

import React, { useMemo, useState } from "react";
import {
  Receipt,
  Search,
  Store,
  UtensilsCrossed,
  CreditCard,
  X,
} from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore, selectAllActiveTickets } from "../../state/pos-tickets.store";
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

  const allActiveTickets = useMemo(
    () => selectAllActiveTickets(tables, activeAllOrders, selectedTableId, activeOrderId, dineInView),
    [tables, activeAllOrders, selectedTableId, activeOrderId, dineInView]
  );

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return allActiveTickets;
    const q = searchQuery.toLowerCase().trim();
    return allActiveTickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.subTitle.toLowerCase().includes(q) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(q))
    );
  }, [allActiveTickets, searchQuery]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-3.5 shadow-2xl max-h-[85vh] flex flex-col">
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
                View, add dishes, or settle bills across all active dining spaces
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

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search table, floor, customer or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-2 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
          />
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredTickets.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#F7F3EC]/50 space-y-2">
              <Store className="h-8 w-8 text-[#71675E]/40 mx-auto" />
              <p className="font-bold text-xs text-[#292320]">
                {allActiveTickets.length === 0
                  ? "No active tickets or occupied spaces"
                  : `No active tickets match "${searchQuery}"`}
              </p>
              <p className="text-[11px] text-[#71675E]">
                {allActiveTickets.length === 0
                  ? "All dining spaces are available. Seat guests from the floor layout to start an order."
                  : "Try adjusting your search query."}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#6B2837]">{tkt.title}</span>
                    <span className="text-[11px] text-[#71675E]">{tkt.subTitle}</span>
                    {tkt.isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#6B2837] text-white">
                        Active in POS
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenTicket(tkt)}
                    className="h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-bold text-[#292320] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Open ticket to add dishes or edit order"
                  >
                    <UtensilsCrossed className="h-3 w-3 text-[#6B2837]" />
                    <span>Open Ticket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePay(tkt)}
                    className="h-8 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Proceed to payment & settlement"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Pay</span>
                  </button>
                </div>
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

