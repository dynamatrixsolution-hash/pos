"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Send,
  CreditCard,
  Search,
  Zap,
  MoreVertical,
  ArrowRightLeft,
  AlertTriangle,
  Phone,
  MapPin,
  CheckCircle2,
  Bike,
  Banknote,
} from "lucide-react";
import { apiClient } from "@/core/api/api-client";
import { Notify } from "@/lib/notify";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosCartStore } from "../../state/pos-cart.store";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const TicketDrawer = React.memo(function TicketDrawer() {
  const isTicketDrawerOpen = usePosUiStore((s) => s.isTicketDrawerOpen);
  const setIsTicketDrawerOpen = usePosUiStore((s) => s.setIsTicketDrawerOpen);
  const orderType = usePosUiStore((s) => s.orderType);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const dineInView = usePosUiStore((s) => s.dineInView);
  const setShowSettlementModal = usePosUiStore((s) => s.setShowSettlementModal);
  const setShowTransferModal = usePosUiStore((s) => s.setShowTransferModal);
  const setShowDeliveryModal = usePosUiStore((s) => s.setShowDeliveryModal);
  const setDeliveryModalMode = usePosUiStore((s) => s.setDeliveryModalMode);

  const tables = usePosCatalogStore((s) => s.tables);

  const activeOrderId = usePosTicketsStore((s) => s.activeOrderId);
  const activeAllOrders = usePosTicketsStore((s) => s.activeAllOrders);
  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);
  const orderNumber = usePosTicketsStore((s) => s.orderNumber);
  const existingRounds = usePosTicketsStore((s) => s.existingRounds);
  const existingOrderTotal = usePosTicketsStore((s) => s.existingOrderTotal);
  const selectOccupiedSpace = usePosTicketsStore((s) => s.selectOccupiedSpace);
  const setAdjustingLine = usePosTicketsStore((s) => s.setAdjustingLine);
  const setCancellingTable = usePosTicketsStore((s) => s.setCancellingTable);
  const convertActiveOrderType = usePosTicketsStore((s) => s.convertActiveOrderType);

  const [processingWorkflow, setProcessingWorkflow] = useState(false);
  const [riderInput, setRiderInput] = useState("");
  const [showRiderDispatch, setShowRiderDispatch] = useState(false);

  const activeOrderRecord = useMemo(
    () => activeAllOrders.find((o) => o.id === activeOrderId) || null,
    [activeAllOrders, activeOrderId]
  );

  const parsedChannelMeta = useMemo(() => {
    const notes = activeOrderRecord?.notes || "";
    const hasPendingRoundLine = existingRounds.some((r) =>
      r.lines.some(
        (l) => l.acceptanceStatus === "PENDING" && l.fulfillmentStatus !== "CANCELLED"
      )
    );
    const isPendingApproval =
      hasPendingRoundLine ||
      activeOrderRecord?.acceptanceStatus === "PENDING" ||
      /\[STAFF APPROVAL REQUIRED/i.test(notes);
    const isOutForDelivery = /\[OUT FOR DELIVERY/i.test(notes);
    const riderMatch = notes.match(/\[OUT FOR DELIVERY\s*\|\s*Rider:\s*([^\]]+)\]/i);
    const payMatch = notes.match(/\[PAY:\s*([^\]]+)\]/i);
    const gpsMatch = notes.match(/https:\/\/maps\.google\.com\/\?q=[^\s\]|]+/i);

    let customerName = "";
    let phone = "";
    let address = "";

    const delMatch = notes.match(/\[DELIVERY to ([^(]+)\(([^)]+)\)\s*-\s*([^\]|]+)/i);
    if (delMatch) {
      customerName = delMatch[1].trim();
      phone = delMatch[2].split(",")[0].trim();
      address = delMatch[3].trim();
    } else {
      const takeMatch = notes.match(/\[TAKEAWAY for ([^(]+)\(([^)]+)\)\]/i);
      if (takeMatch) {
        customerName = takeMatch[1].trim();
        phone = takeMatch[2].split(",")[0].trim();
      }
    }

    const allActiveLines = existingRounds
      .flatMap((r) => r.lines || [])
      .filter((l) => l.fulfillmentStatus !== "CANCELLED" && l.acceptanceStatus !== "REJECTED");
    const isServedOrCompleted = activeOrderRecord?.fulfillmentStatus === "SERVED";
    const isKitchenReady =
      !isPendingApproval &&
      !isServedOrCompleted &&
      (activeOrderRecord?.fulfillmentStatus === "READY" ||
        (allActiveLines.length > 0 &&
          allActiveLines.every(
            (l) => l.fulfillmentStatus === "READY" || l.fulfillmentStatus === "SERVED"
          )));

    return {
      isPendingApproval,
      isOutForDelivery,
      isKitchenReady,
      isServedOrCompleted,
      riderName: riderMatch ? riderMatch[1].trim() : null,
      paymentPref: payMatch ? payMatch[1].trim() : orderType === "DELIVERY" ? "CASH ON DELIVERY" : null,
      gpsUrl: gpsMatch ? gpsMatch[0] : null,
      customerName,
      phone,
      address,
    };
  }, [activeOrderRecord, existingRounds, orderType]);

  const handleApproveAndRoute = async () => {
    if (!activeOrderId) return;
    try {
      setProcessingWorkflow(true);
      const res = await apiClient.restaurant.approveOrder(activeOrderId);
      if (res?.order) {
        usePosTicketsStore.getState().setActiveOrder(res.order);
      }
      Notify.success("Order confirmed and routed to Kitchen!");
      await fetchActiveOrders();
      if (selectedTableId) {
        await usePosTicketsStore.getState().fetchTableOrders(selectedTableId);
      }
    } catch (err: any) {
      Notify.error(err?.message || "Failed to confirm order");
    } finally {
      setProcessingWorkflow(false);
    }
  };

  const handleDispatchDelivery = async () => {
    if (!activeOrderId) return;
    try {
      setProcessingWorkflow(true);
      await apiClient.restaurant.dispatchDelivery(activeOrderId, riderInput.trim() || "In-House Rider");
      Notify.success("Delivery dispatched! Rider is on the way.");
      setShowRiderDispatch(false);
      setRiderInput("");
      await fetchActiveOrders();
    } catch (err: any) {
      Notify.error(err?.message || "Failed to dispatch delivery");
    } finally {
      setProcessingWorkflow(false);
    }
  };

  const draftLines = usePosCartStore((s) => s.draftLines);
  const updateDraftQty = usePosCartStore((s) => s.updateDraftQty);
  const removeDraftLine = usePosCartStore((s) => s.removeDraftLine);
  const toggleDraftServingType = usePosCartStore((s) => s.toggleDraftServingType);
  const clearDraft = usePosCartStore((s) => s.clearDraft);
  const orderNotes = usePosCartStore((s) => s.orderNotes);
  const setOrderNotes = usePosCartStore((s) => s.setOrderNotes);
  const isSubmitting = usePosCartStore((s) => s.isSubmitting);
  const submitKitchenRound = usePosCartStore((s) => s.submitKitchenRound);

  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);

  const [showQuickTablePicker, setShowQuickTablePicker] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [showOrderActionsMenu, setShowOrderActionsMenu] = useState(false);

  const filteredPickerTables = useMemo(() => {
    if (!tableSearchQuery.trim()) return tables;
    const q = tableSearchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        (t.tableNumber || "").toLowerCase().includes(q) ||
        (t.floor?.name || "").toLowerCase().includes(q)
    );
  }, [tables, tableSearchQuery]);

  const handleConfirmOrder = () => {
    if (orderType === "DINE_IN" && !selectedTableId) {
      setShowQuickTablePicker(true);
      return;
    }
    submitKitchenRound();
  };

  const handleSelectTableAndSubmit = (t: typeof tables[0]) => {
    setShowQuickTablePicker(false);
    if (t.status === "OCCUPIED") {
      selectOccupiedSpace(t);
    } else {
      setSelectedTable(t.id);
    }
    setTimeout(() => {
      submitKitchenRound();
    }, 50);
  };

  const handleConfirmAsCounter = () => {
    setShowQuickTablePicker(false);
    submitKitchenRound();
  };

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  const draftRoundTotal = useMemo(
    () => draftLines.reduce((sum, line) => sum + line.totalPrice, 0),
    [draftLines]
  );

  const grandRunningTotal = (parseFloat(existingOrderTotal) || 0) + draftRoundTotal;

  const handleStartNewOrder = () => {
    usePosTicketsStore.getState().setActiveOrder(null);
    if (orderType === "DINE_IN") {
      usePosUiStore.getState().setSelectedTable("");
      usePosCartStore.getState().syncDraftForTarget("type_DINE_IN");
    } else if (orderType === "DELIVERY") {
      usePosUiStore.getState().setSelectedTable("");
      usePosCartStore.getState().syncDraftForTarget("type_DELIVERY");
      usePosUiStore.getState().setShowDeliveryModal(true);
    } else {
      usePosUiStore.getState().setSelectedTable("");
      usePosCartStore.getState().syncDraftForTarget("type_TAKEAWAY");
    }
  };

  const activeItemCount = useMemo(
    () =>
      existingRounds.reduce(
        (acc, r) =>
          acc +
          r.lines.filter(
            (l) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
          ).length,
        0
      ),
    [existingRounds]
  );

  if (!isTicketDrawerOpen) return null;

  const isFirstTimeOrder = existingRounds.length === 0;

  const showOrderActionsTrigger = (orderType === "DINE_IN" && Boolean(selectedTable)) || Boolean(activeOrderId);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-[#292320]/40 z-40 lg:hidden"
        onClick={() => setIsTicketDrawerOpen(false)}
      />

      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 max-w-full border-l border-[#D8CEC1] bg-[#FFFCF7] flex flex-col h-full shrink-0 lg:static lg:z-20 lg:w-80 xl:w-96 transition-colors select-none">
        {/* Top Header */}
        <div className="p-3 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#F8EEF0] text-[#6B2837] border border-[#E9CDD3] shrink-0">
              {orderType === "DINE_IN" ? (
                <UtensilsCrossed className="h-4 w-4" />
              ) : orderType === "DELIVERY" ? (
                <Truck className="h-4 w-4" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-[#292320] truncate">
                {orderType === "DINE_IN"
                  ? selectedTable
                    ? `Dining Table ${selectedTable.tableNumber}`
                    : "Dine-In Ticket"
                  : orderType === "TAKEAWAY"
                  ? "Takeaway Order"
                  : "Delivery Order"}
              </h3>
              {orderNumber && (
                <p className="text-[10px] font-mono text-[#71675E] truncate">
                  #{orderNumber}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {showOrderActionsTrigger && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrderActionsMenu((prev) => !prev)}
                  className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
                  title="Order & Table Actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {showOrderActionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowOrderActionsMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-xs z-50 py-1 text-xs font-semibold">
                      {orderType === "DINE_IN" && selectedTable && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowOrderActionsMenu(false);
                              setShowTransferModal(true);
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
                          >
                            <ArrowRightLeft className="h-4 w-4 text-[#946000]" />
                            <div>
                              <div>Transfer Table</div>
                              <div className="text-[10px] text-[#71675E] font-normal">
                                Move guests to another table
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowOrderActionsMenu(false);
                              convertActiveOrderType("TAKEAWAY");
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
                          >
                            <ShoppingBag className="h-4 w-4 text-[#946000]" />
                            <div>
                              <div>Convert to Takeaway</div>
                              <div className="text-[10px] text-[#71675E] font-normal">
                                Pack table meal &amp; release table
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowOrderActionsMenu(false);
                              setDeliveryModalMode("CONVERT_ACTIVE");
                              setShowDeliveryModal(true);
                            }}
                            className="w-full px-3 py-2 flex items-center gap-2 text-left text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
                          >
                            <Truck className="h-4 w-4 text-[#315F85]" />
                            <div>
                              <div>Convert to Delivery</div>
                              <div className="text-[10px] text-[#71675E] font-normal">
                                Dispatch to address &amp; release table
                              </div>
                            </div>
                          </button>

                          {(activeOrderId || selectedTable.currentSessionId) && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowOrderActionsMenu(false);
                                setCancellingTable({
                                  tableId: selectedTable.id,
                                  tableNumber: selectedTable.tableNumber,
                                  orderId: activeOrderId || undefined,
                                  sessionId: selectedTable.currentSessionId || "",
                                  itemCount: activeItemCount,
                                  totalAmount: existingOrderTotal || "0.00",
                                });
                              }}
                              className="w-full px-3 py-2 flex items-center gap-2 text-left text-[#B33432] hover:bg-[#FAEAEC] cursor-pointer border-t border-[#D8CEC1]/50"
                            >
                              <AlertTriangle className="h-4 w-4 text-[#B33432]" />
                              <div>
                                <div>Void / Cancel Order</div>
                                <div className="text-[10px] text-[#B33432]/80 font-normal">
                                  Cancel all tickets &amp; free table
                                </div>
                              </div>
                            </button>
                          )}
                        </>
                      )}

                      {orderType !== "DINE_IN" && activeOrderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowOrderActionsMenu(false);
                            setCancellingTable({
                              title: orderType === "DELIVERY" ? "Delivery Order" : "Takeaway Order",
                              orderId: activeOrderId,
                              itemCount: activeItemCount,
                              totalAmount: existingOrderTotal || "0.00",
                            });
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 text-left text-[#B33432] hover:bg-[#FAEAEC] cursor-pointer"
                        >
                          <AlertTriangle className="h-4 w-4 text-[#B33432]" />
                          <div>
                            <div>Void / Cancel Order</div>
                            <div className="text-[10px] text-[#B33432]/80 font-normal">
                              Cancel all kitchen tickets for this order
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeOrderId && (
              <button
                type="button"
                onClick={handleStartNewOrder}
                className="text-[10px] font-bold text-[#6B2837] hover:bg-[#F8EEF0] cursor-pointer px-2 py-1 rounded border border-[#6B2837]/30 bg-[#FFFCF7] flex items-center gap-1 transition-colors"
                title="Start a new order / fresh tab"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </button>
            )}
            {draftLines.length > 0 && (
              <button
                type="button"
                onClick={clearDraft}
                className="text-[10px] text-[#DC2626] hover:underline cursor-pointer font-bold px-1.5 py-0.5 rounded border border-[#DC2626]/20 bg-[#FEF2F2]"
              >
                Clear Draft
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsTicketDrawerOpen(false)}
              className="h-7 w-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              title="Close ticket drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

      {/* Scrollable Order Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Customer & Delivery Details Card (for Takeaway / Delivery orders) */}
        {activeOrderRecord && (orderType === "DELIVERY" || orderType === "TAKEAWAY") && (
          <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#292320] truncate">
                {parsedChannelMeta.customerName || (orderType === "DELIVERY" ? "Delivery Customer" : "Takeaway Customer")}
              </span>
              {parsedChannelMeta.paymentPref && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] text-[#946000] text-[10px] font-bold shrink-0">
                  <Banknote className="w-3 h-3" />
                  <span>{parsedChannelMeta.paymentPref}</span>
                </span>
              )}
            </div>

            {parsedChannelMeta.phone && (
              <a
                href={`tel:${parsedChannelMeta.phone}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B2837] hover:underline tabular-nums"
              >
                <Phone className="w-3 h-3" />
                <span>{parsedChannelMeta.phone}</span>
              </a>
            )}

            {parsedChannelMeta.address && (
              <div className="flex items-start gap-1.5 text-[11px] text-[#292320]">
                <MapPin className="w-3.5 h-3.5 text-[#6B2837] shrink-0 mt-0.5" />
                <span className="leading-snug">{parsedChannelMeta.address}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {parsedChannelMeta.gpsUrl && (
                <a
                  href={parsedChannelMeta.gpsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-[#315F85] hover:underline"
                >
                  Open GPS in Maps
                </a>
              )}
              {parsedChannelMeta.isOutForDelivery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">
                  <Bike className="w-3 h-3" />
                  <span>Out for Delivery ({parsedChannelMeta.riderName || "Rider"})</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Draft Round lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#6B2837] uppercase tracking-wider pb-1 border-b border-[#D8CEC1]/70">
            <span>Round #{existingRounds.length + 1} (Draft)</span>
            <span className="font-mono">{formatNPR(draftRoundTotal)}</span>
          </div>

          {draftLines.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#71675E] bg-[#F7F3EC]/50 rounded-lg border border-dashed border-[#D8CEC1]">
              Click <strong>+ Add</strong> on dishes to build order.
            </div>
          ) : (
            <div className="space-y-1.5">
              {draftLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[#292320] flex-1 line-clamp-1">
                      {line.item.name}
                    </span>
                    <span className="font-mono font-bold text-[#6B2837] tabular-nums">
                      {formatNPR(line.totalPrice)}
                    </span>
                  </div>

                  {line.selectedModifiers.length > 0 && (
                    <div className="text-[10px] text-[#71675E]">
                      {line.selectedModifiers.map((m) => m.optionName).join(", ")}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#D8CEC1]/50">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateDraftQty(idx, -1)}
                        className="h-5 w-5 rounded border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-bold tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateDraftQty(idx, 1)}
                        className="h-5 w-5 rounded border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center hover:bg-[#EEE7DD] cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (orderType === "DINE_IN") {
                            toggleDraftServingType(idx);
                          }
                        }}
                        disabled={orderType !== "DINE_IN"}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          orderType === "DELIVERY"
                            ? "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]"
                            : line.servingType === "TAKEAWAY_PARCEL" || orderType === "TAKEAWAY"
                            ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD] hover:bg-[#F7E9CE]"
                            : "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0] hover:bg-[#DCECE3]"
                        } ${orderType === "DINE_IN" ? "cursor-pointer" : "cursor-default"}`}
                        title={
                          orderType === "DINE_IN"
                            ? "Click to toggle between Dine-In and Takeaway Parcel"
                            : undefined
                        }
                      >
                        {orderType === "DELIVERY" ? (
                          <>
                            <Truck className="h-3 w-3" />
                            <span>Delivery</span>
                          </>
                        ) : line.servingType === "TAKEAWAY_PARCEL" || orderType === "TAKEAWAY" ? (
                          <>
                            <ShoppingBag className="h-3 w-3" />
                            <span>Takeaway</span>
                          </>
                        ) : (
                          <>
                            <UtensilsCrossed className="h-3 w-3" />
                            <span>Dine-In</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraftLine(idx)}
                        className="p-1 rounded text-[#71675E] hover:text-[#B33432] cursor-pointer"
                        title="Remove dish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Kitchen Note Input */}
              <input
                type="text"
                placeholder="Kitchen instruction / notes..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
              />
            </div>
          )}
        </div>

        {/* Confirmed Kitchen Rounds */}
        {existingRounds.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#D8CEC1]">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#71675E] uppercase tracking-wider">
              <span>Submitted Kitchen Rounds</span>
            </div>

            {existingRounds.map((round) => {
              const isRoundPending = round.lines.some(
                (l) => l.acceptanceStatus === "PENDING" && l.fulfillmentStatus !== "CANCELLED"
              );
              return (
              <div
                key={round.id}
                className="rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-2.5 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between font-bold text-[#292320]">
                  <span>Round #{round.roundNumber}</span>
                  {isRoundPending ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
                      Pending Approval
                    </span>
                  ) : parsedChannelMeta.isOutForDelivery ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6]">
                      Out for Delivery
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
                      In Kitchen
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {round.lines.map((line) => {
                    const isCancelled =
                      line.acceptanceStatus === "REJECTED" || line.fulfillmentStatus === "CANCELLED";
                    const isTakeawayLine =
                      !isCancelled && /\b(TAKEAWAY|PARCEL)\b/i.test(line.notes || "");

                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-1 text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className={`truncate ${isCancelled ? "line-through text-[#71675E]" : ""}`}>
                            {line.quantity}x {line.itemName}
                          </span>
                          {isTakeawayLine && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD] shrink-0">
                              <ShoppingBag className="h-2.5 w-2.5" />
                              <span>Takeaway</span>
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold tabular-nums">
                          {formatNPR(line.total)}
                        </span>
                        {!isCancelled && activeOrderId && (
                          <button
                            type="button"
                            onClick={() =>
                              setAdjustingLine({
                                orderId: activeOrderId,
                                lineId: line.id,
                                itemName: line.itemName,
                                currentQty: line.quantity,
                                notes: line.notes,
                                fulfillmentStatus: line.fulfillmentStatus,
                              })
                            }
                            aria-label={`Cancel or adjust ${line.itemName}`}
                            className="p-0.5 text-[#71675E] hover:text-[#B33432] cursor-pointer"
                            title="Cancel or adjust dish"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer Footer & Settle Actions */}
      <div className="p-3 border-t border-[#D8CEC1] bg-[#FFFCF7] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs text-[#71675E]">
          <span>Items Subtotal:</span>
          <span className="font-mono font-bold tabular-nums">{formatNPR(grandRunningTotal)}</span>
        </div>

        <div className="flex items-center justify-between font-black text-sm text-[#292320] pt-1 border-t border-[#D8CEC1]/50">
          <span>Total Running Balance:</span>
          <span className="font-mono text-[#6B2837] text-base tabular-nums">
            {formatNPR(grandRunningTotal)}
          </span>
        </div>

        {/* Dynamic Action Controls: Pending Confirmation -> Dispatch Rider -> Pay & Settle */}
        {parsedChannelMeta.isPendingApproval && activeOrderId ? (
          <div className="space-y-2">
            <div className="p-2 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] text-[11px] text-[#946000] font-semibold">
              Remote order awaiting staff confirmation before sending to kitchen.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApproveAndRoute}
                disabled={processingWorkflow}
                className="flex-1 py-2.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{processingWorkflow ? "Confirming..." : "Accept & Send to Kitchen"}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setCancellingTable({
                    title: orderType === "DELIVERY" ? "Delivery Order" : "Takeaway Order",
                    orderId: activeOrderId,
                    itemCount: activeItemCount,
                    totalAmount: existingOrderTotal || "0.00",
                  })
                }
                disabled={processingWorkflow}
                className="px-3 py-2.5 rounded-lg border border-[#E5B8B8] bg-[#FDF2F2] hover:bg-[#FCE6E6] text-[#8A1F2D] font-bold text-xs cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        ) : isFirstTimeOrder ? (
          /* First time order: ONLY Show Order Confirm Button */
          <button
            type="button"
            onClick={handleConfirmOrder}
            disabled={isSubmitting || draftLines.length === 0}
            className="w-full py-2.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Send className="h-4 w-4" />
            <span>{isSubmitting ? "Sending to Kitchen..." : "Confirm Order"}</span>
          </button>
        ) : draftLines.length > 0 ? (
          /* Existing rounds exist + new items added to draft: Show BOTH Confirm (Left) and Pay (Right) in same row */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="truncate">
                {isSubmitting ? "Sending..." : `Confirm Round #${existingRounds.length + 1}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettlementModal(true)}
              disabled={grandRunningTotal <= 0}
              className="flex-1 py-2.5 rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Pay &amp; Settle</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {orderType === "DELIVERY" &&
              activeOrderId &&
              !parsedChannelMeta.isOutForDelivery &&
              !parsedChannelMeta.isServedOrCompleted && (
                !parsedChannelMeta.isKitchenReady ? (
                  <div className="w-full py-2 px-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold text-[11px] flex items-center justify-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 shrink-0" />
                    <span>Preparing in Kitchen — Mark Ready in KDS to Dispatch Rider</span>
                  </div>
                ) : showRiderDispatch ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={riderInput}
                      onChange={(e) => setRiderInput(e.target.value)}
                      placeholder="Rider name (optional)"
                      className="flex-1 h-9 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320]"
                    />
                    <button
                      type="button"
                      onClick={handleDispatchDelivery}
                      disabled={processingWorkflow}
                      className="h-9 px-3 rounded-md bg-[#315F85] hover:bg-[#264B6A] text-white text-xs font-bold cursor-pointer"
                    >
                      {processingWorkflow ? "..." : "Dispatch"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRiderDispatch(true)}
                    className="w-full py-2 rounded-lg border border-[#B8D2E6] bg-[#EDF4F9] hover:bg-[#DFECF6] text-[#315F85] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Bike className="h-4 w-4" />
                    <span>Dispatch Rider (Out for Delivery)</span>
                  </button>
                )
              )}

            <button
              type="button"
              onClick={() => setShowSettlementModal(true)}
              disabled={grandRunningTotal <= 0}
              className="w-full py-2.5 rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {orderType === "DELIVERY" && parsedChannelMeta.paymentPref === "CASH ON DELIVERY"
                  ? `Collect Cash (COD) & Settle (${formatNPR(grandRunningTotal)})`
                  : `Pay & Settle (${formatNPR(grandRunningTotal)})`}
              </span>
            </button>
          </div>
        )}
      </div>
    </aside>

    {/* Quick Table Picker Modal for Direct Dine-In Orders */}
    {showQuickTablePicker && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
        <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#F8EEF0] text-[#6B2837] border border-[#E9CDD3]">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#292320]">
                  Select Table for Dine-In Order
                </h3>
                <p className="text-[11px] text-[#71675E]">
                  Assign a table or confirm as quick counter service
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickTablePicker(false)}
              className="text-[#71675E] hover:text-[#292320] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Counter Action */}
          <div className="p-3 rounded-xl border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#D97706]" />
                <span>No Table (Counter / Bar Dine-In)</span>
              </div>
              <div className="text-[11px] text-[#71675E]">
                Route order directly to kitchen as Counter service
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmAsCounter}
              className="py-1.5 px-3 rounded-lg bg-[#292320] hover:bg-[#1C1715] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Confirm as Counter
            </button>
          </div>

          {/* Table Search Input */}
          <div className="relative shrink-0">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search table number or floor..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="h-9 w-full pl-8 pr-3 text-xs rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none placeholder:text-[#71675E]"
            />
          </div>

          {/* Tables Grid */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
              Available Tables ({tables.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredPickerTables.map((t) => {
                const isAvail = t.status === "AVAILABLE";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTableAndSubmit(t)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isAvail
                        ? "border-[#16A34A]/50 bg-[#FFFCF7] hover:border-[#16A34A] hover:bg-[#F0FDF4]/30"
                        : "border-[#DC2626]/40 bg-[#FFFCF7] hover:border-[#DC2626] hover:bg-[#FEF2F2]/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-[#292320]">{t.tableNumber}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isAvail ? "bg-[#16A34A]" : "bg-[#DC2626] animate-pulse"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-[#71675E] mt-1 flex items-center justify-between">
                      <span>{t.floor?.name || "Floor"}</span>
                      <span>{t.capacity}p</span>
                    </div>
                    <div
                      className={`text-[9px] font-bold mt-1.5 px-1.5 py-0.5 rounded text-center ${
                        isAvail
                          ? "bg-[#EDF5ED] text-[#2D6A4F]"
                          : "bg-[#FEF2F2] text-[#DC2626]"
                      }`}
                    >
                      {isAvail ? "Tap to Seat & Order" : "Active Bill (Append)"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}
  </>
);
});

