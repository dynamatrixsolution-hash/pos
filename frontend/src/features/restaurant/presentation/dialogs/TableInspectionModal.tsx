"use client";

import React, { useEffect } from "react";
import {
  X,
  UtensilsCrossed,
  CreditCard,
  Trash2,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosUiStore } from "../../state/pos-ui.store";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const TableInspectionModal = React.memo(function TableInspectionModal() {
  const inspectingTable = usePosTicketsStore((s) => s.inspectingTable);
  const inspectingOrderData = usePosTicketsStore((s) => s.inspectingOrderData);
  const isInspectingLoading = usePosTicketsStore((s) => s.isInspectingLoading);
  const closeTableInspection = usePosTicketsStore((s) => s.closeTableInspection);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);
  const setCancellingTable = usePosTicketsStore((s) => s.setCancellingTable);
  const setAdjustingLine = usePosTicketsStore((s) => s.setAdjustingLine);

  const setShowSettlementModal = usePosUiStore((s) => s.setShowSettlementModal);

  useEffect(() => {
    if (!inspectingTable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTableInspection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectingTable, closeTableInspection]);

  if (!inspectingTable) return null;

  const activeOrder = inspectingOrderData?.activeOrder;
  const activeItemCount =
    activeOrder?.rounds?.reduce(
      (acc: number, r: any) =>
        acc +
        (r.lines || []).filter(
          (l: any) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
        ).length,
      0
    ) || 0;
  const canPay = !isInspectingLoading && Boolean(activeOrder) && activeItemCount > 0;

  const handleTakeOrder = () => {
    selectOccupiedSpace(inspectingTable, activeOrder ? { activeOrder } : undefined);
    closeTableInspection();
  };

  const handlePay = () => {
    selectOccupiedSpace(inspectingTable, activeOrder ? { activeOrder } : undefined);
    closeTableInspection();
    setShowSettlementModal(true);
  };

  const handleOpenCancelConfirmation = () => {
    setCancellingTable({
      tableId: inspectingTable.id,
      tableNumber: inspectingTable.tableNumber,
      orderId: activeOrder?.id,
      sessionId:
        activeOrder?.tableSessionId ||
        inspectingTable.currentSessionId ||
        inspectingOrderData?.activeSession?.id ||
        inspectingTable.tableSessions?.[0]?.id ||
        "",
      itemCount:
        activeOrder?.rounds?.reduce((acc: number, r: any) => acc + (r.lines?.length || 0), 0) || 0,
      totalAmount: activeOrder?.totalAmount?.toString() || "0.00",
    });
  };

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-inspection-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeTableInspection();
        }}
      >
        <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#6B2837] text-[#FFFCF7]">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <h3 id="table-inspection-title" className="text-sm font-bold text-[#292320]">
                  Table {inspectingTable.tableNumber} Order Details
                </h3>
                <p className="text-[11px] text-[#71675E] tabular-nums">
                  {inspectingTable.floor?.name || "Floor"} &bull; {inspectingTable.capacity} covers
                  {activeOrder?.orderNumber && (
                    <span className="font-mono font-bold text-[#6B2837] ml-2">
                      #{activeOrder.orderNumber}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeTableInspection}
              aria-label="Close modal"
              className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body: Rounds & Lines */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isInspectingLoading ? (
              <div className="space-y-2.5 py-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-24 rounded bg-[#EEE7DD] animate-pulse" />
                      <div className="h-4 w-16 rounded bg-[#EEE7DD] animate-pulse" />
                    </div>
                    <div className="h-3 w-3/4 rounded bg-[#EEE7DD] animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-[#EEE7DD] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : activeOrder && activeOrder.rounds?.length > 0 ? (
              <div className="space-y-3">
                {activeOrder.rounds.map((round: any) => (
                  <div
                    key={round.id}
                    className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-[#292320]">
                      <span>Round #{round.roundNumber}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD]">
                        {round.status || "PREPARING"}
                      </span>
                    </div>

                    <div className="space-y-1.5 divide-y divide-[#D8CEC1]/50">
                      {round.lines?.map((line: any) => {
                        const isCancelled =
                          line.acceptanceStatus === "REJECTED" || line.fulfillmentStatus === "CANCELLED";
                        const isParcel = (line.notes || "").includes("PARCEL");

                        return (
                          <div
                            key={line.id}
                            className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-[#292320] shrink-0">
                                {line.quantity}x
                              </span>
                              <span
                                className={`truncate ${
                                  isCancelled ? "line-through text-[#71675E]" : "font-medium"
                                }`}
                              >
                                {line.itemName}
                              </span>

                              {isCancelled ? (
                                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                                  Cancelled {line.rejectionReason ? `(${line.rejectionReason})` : ""}
                                </span>
                              ) : isParcel ? (
                                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] flex items-center gap-1">
                                  <ShoppingBag className="h-2.5 w-2.5" />
                                  <span>Takeaway</span>
                                </span>
                              ) : (
                                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#EDF5ED] text-[#2D6A4F] border border-[#C8DFCD] flex items-center gap-1">
                                  <UtensilsCrossed className="h-2.5 w-2.5" />
                                  <span>Dine-in</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-mono font-bold tabular-nums ${
                                  isCancelled ? "line-through text-[#71675E]" : ""
                                }`}
                              >
                                {formatNPR(line.total || line.lineTotal)}
                              </span>
                              {!isCancelled && activeOrder.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAdjustingLine({
                                      orderId: activeOrder.id,
                                      lineId: line.id,
                                      itemName: line.itemName,
                                      currentQty: line.quantity,
                                      notes: line.notes,
                                      fulfillmentStatus: line.fulfillmentStatus,
                                    })
                                  }
                                  aria-label={`Cancel or adjust ${line.itemName}`}
                                  title="Cancel or adjust dish"
                                  className="p-1 rounded text-[#71675E] hover:text-[#B33432] hover:bg-[#FAEAEC] cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Balance Summary */}
                <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between text-xs">
                  <span className="text-[#71675E]">Running Total Balance:</span>
                  <span className="text-base font-black font-mono text-[#6B2837] tabular-nums">
                    {formatNPR(activeOrder.totalAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                <UtensilsCrossed className="h-8 w-8 text-[#71675E]/40 mx-auto" />
                <p className="font-bold text-[#292320]">Table is seated</p>
                <p className="text-[11px] text-[#71675E]">
                  No kitchen rounds have been submitted yet. Click below to add dishes!
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              disabled={isInspectingLoading}
              onClick={handleOpenCancelConfirmation}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#E9B6B7] bg-[#FAEAEC] hover:bg-[#F5D8DC] disabled:opacity-40 disabled:cursor-not-allowed text-[#B33432] flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Cancel table and void all orders"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Cancel Table</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTakeOrder}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Take Order</span>
              </button>

              <button
                type="button"
                disabled={!canPay}
                onClick={handlePay}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] disabled:opacity-40 disabled:cursor-not-allowed text-[#FFFCF7] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Pay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
  );
});

