"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  X,
  Banknote,
  QrCode,
  Wallet,
  UserCheck,
  Hotel,
  Printer,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { restaurantPosRepository } from "../../repositories/restaurant-pos.repository";
import { HotelStayOption } from "../../models/pos.types";
import { toast } from "@/components/toast";
import { useSettings } from "@/components/settings-provider";
import { printThermalReceipt } from "@/lib/thermal-printer";
import { ReceiptData } from "@/components/pos/thermal-receipt";
import { createIdempotencyKey } from "@/core/api/api-client";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const SettlementModal = React.memo(function SettlementModal() {
  const show = usePosUiStore((s) => s.showSettlementModal);
  const setShow = usePosUiStore((s) => s.setShowSettlementModal);
  const selectedTableId = usePosUiStore((s) => s.selectedTableId);
  const orderType = usePosUiStore((s) => s.orderType);
  const syncUrlView = usePosUiStore((s) => s.syncUrlView);
  const setSelectedTable = usePosUiStore((s) => s.setSelectedTable);

  const tables = usePosCatalogStore((s) => s.tables);
  const loadInitialCatalog = usePosCatalogStore((s) => s.loadInitialCatalog);

  const activeOrderId = usePosTicketsStore((s) => s.activeOrderId);
  const orderNumber = usePosTicketsStore((s) => s.orderNumber);
  const existingRounds = usePosTicketsStore((s) => s.existingRounds);
  const existingOrderSubtotal = usePosTicketsStore((s) => s.existingOrderSubtotal);
  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);
  const setActiveOrder = usePosTicketsStore((s) => s.setActiveOrder);

  const draftLines = usePosCartStore((s) => s.draftLines);
  const deliveryCharge = usePosCartStore((s) => s.deliveryCharge);
  const packagingCharge = usePosCartStore((s) => s.packagingCharge);
  const setDeliveryCharge = usePosCartStore((s) => s.setDeliveryCharge);
  const setPackagingCharge = usePosCartStore((s) => s.setPackagingCharge);
  const submitKitchenRound = usePosCartStore((s) => s.submitKitchenRound);
  const clearDraft = usePosCartStore((s) => s.clearDraft);

  const settings = useSettings();

  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "FONE_PAY" | "ESEWA" | "CREDIT" | "ROOM_CHARGE"
  >("CASH");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountVal, setDiscountVal] = useState<number>(0);
  const [applyVat, setApplyVat] = useState<boolean>(true);
  const [tenderAmount, setTenderAmount] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [stays, setStays] = useState<HotelStayOption[]>([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [loadingStays, setLoadingStays] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const settleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (show) {
      settleKeyRef.current = null;
      setPaymentMethod("CASH");
      setDiscountType("FLAT");
      setDiscountVal(0);
      setApplyVat(settings.enableVat ?? true);
      setTenderAmount("");
      setCustomerName("");
      setCustomerPhone("");
      setSelectedStayId("");
    }
  }, [show, settings.enableVat]);

  useEffect(() => {
    settleKeyRef.current = null;
  }, [paymentMethod, selectedStayId, discountType, discountVal, applyVat, tenderAmount, customerName, customerPhone]);

  useEffect(() => {
    if (!show || paymentMethod !== "ROOM_CHARGE") return;
    let cancelled = false;
    setLoadingStays(true);
    restaurantPosRepository
      .fetchHotelStays()
      .then((list) => {
        if (!cancelled) setStays(list);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setStays([]);
          toast.error(err?.message || "Failed to load active hotel stays");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStays(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, paymentMethod]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  // Compute totals strictly from pre-tax subtotals (existing order pre-tax + draft pre-tax)
  const draftTotal = draftLines.reduce((acc, l) => acc + l.totalPrice, 0);
  const itemsSubtotal = Number(
    ((parseFloat(existingOrderSubtotal) || 0) + draftTotal).toFixed(2)
  );

  const discountAmount = useMemo(() => {
    const raw =
      discountType === "PERCENT"
        ? (itemsSubtotal * Math.min(100, Math.max(0, Number(discountVal) || 0))) / 100
        : Math.max(0, Number(discountVal) || 0);
    return Number(Math.min(itemsSubtotal, raw).toFixed(2));
  }, [itemsSubtotal, discountType, discountVal]);

  const afterDiscount = Math.max(0, Number((itemsSubtotal - discountAmount).toFixed(2)));
  const vatRate = settings.vatPercentage || 13;
  const vatAmount = applyVat
    ? Number(((afterDiscount * vatRate) / 100).toFixed(2))
    : 0;
  const activeDeliveryFee = orderType === "DELIVERY" ? Math.max(0, deliveryCharge || 0) : 0;
  const activePackagingFee = Math.max(0, packagingCharge || 0);
  const netPayableTotal = Number(
    (afterDiscount + vatAmount + activeDeliveryFee + activePackagingFee).toFixed(2)
  );

  // Tender & Change
  const tenderNum = parseFloat(tenderAmount) || netPayableTotal;
  const changeAmount = Math.max(0, tenderNum - netPayableTotal);

  if (!show || (itemsSubtotal <= 0 && !isSettling)) return null;

  const handleSettle = async (printReceipt = false) => {
    if (paymentMethod === "ROOM_CHARGE" && !selectedStayId) {
      toast.error("Please select an active hotel room/stay for Room Charge.");
      return;
    }

    setIsSettling(true);
    try {
      // Persist any unsent draft items before settling so kitchen, inventory & bill match
      if (draftLines.length > 0 || !activeOrderId) {
        const submitted = await submitKitchenRound();
        if (!submitted) {
          setIsSettling(false);
          return;
        }
      }

      const freshTickets = usePosTicketsStore.getState();
      const targetOrderId = freshTickets.activeOrderId;
      const freshRounds = freshTickets.existingRounds;

      if (!targetOrderId) {
        toast.error("No active order found to settle.");
        setIsSettling(false);
        return;
      }

      if (!settleKeyRef.current) {
        settleKeyRef.current = createIdempotencyKey("pos_stl");
      }

      const res = await restaurantPosRepository.settleOrder(
        targetOrderId,
        {
          paymentMethod,
          stayId: paymentMethod === "ROOM_CHARGE" ? selectedStayId : undefined,
          cashTendered: paymentMethod === "CASH" ? tenderNum : undefined,
          changeReturned: paymentMethod === "CASH" ? changeAmount : undefined,
          discountType,
          discountValue: discountVal,
          discountTotal: discountAmount,
          applyVat,
          deliveryFee: activeDeliveryFee,
          packagingFee: activePackagingFee,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          clearTable: true,
        },
        settleKeyRef.current
      );
      settleKeyRef.current = null;

      if (printReceipt || settings.autoPrint) {
        const receiptItems = freshRounds.flatMap((r) =>
          r.lines
            .filter(
              (l) => l.acceptanceStatus !== "REJECTED" && l.fulfillmentStatus !== "CANCELLED"
            )
            .map((l) => ({
              id: l.id,
              name: l.itemName,
              quantity: l.quantity,
              price: Number(l.unitPrice) || 0,
            }))
        );

        const receiptData: ReceiptData = {
          invoiceNumber: res.invoiceNumber || freshTickets.orderNumber || targetOrderId,
          createdAt: new Date().toISOString(),
          tableNumber: selectedTable?.tableNumber,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: receiptItems,
          subtotal: Number(res.order?.subtotal ?? itemsSubtotal),
          discount: Number(res.order?.discountTotal ?? discountAmount),
          taxableValue: afterDiscount,
          tax: Number(res.order?.taxTotal ?? vatAmount),
          total: Number(res.order?.totalAmount ?? netPayableTotal),
          paidAmount: Number(res.order?.paidAmount ?? netPayableTotal),
          paymentMethod,
        };

        await printThermalReceipt(receiptData, settings, res.sale?.id);
      }

      // Reset state and return to floor layout
      clearDraft();
      setDeliveryCharge(0);
      setPackagingCharge(0);
      setActiveOrder(null);
      setSelectedTable("");
      setShow(false);
      syncUrlView("SELECT_SPACE");
      await loadInitialCatalog();
      await fetchActiveOrders();
      toast.success(res.message || "Order settled successfully");
    } catch (err: any) {
      if (err?.statusCode >= 400 && err?.statusCode < 500) {
        settleKeyRef.current = null;
      }
      toast.error(err?.message || "Failed to settle order");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0]">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Payment &amp; Settlement {orderNumber ? `#${orderNumber}` : ""}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {orderType === "DINE_IN"
                  ? `Table: ${selectedTable?.tableNumber || "Selected Table"}`
                  : orderType}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {draftLines.length > 0 && (
            <div className="p-2.5 rounded-lg border border-[#EDD7AD] bg-[#FDF5E7] text-[#946000] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Includes {draftLines.length} unsent draft item(s) — will be confirmed before settlement.
              </span>
            </div>
          )}

          {/* Customer Details Box */}
          <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#292320]">
                Customer Details (Optional for Walk-in)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Customer Name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Phone number..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Bill Calculation Box */}
          <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-2 text-xs">
            <div className="flex justify-between text-[#71675E]">
              <span>Order Items Subtotal:</span>
              <span className="font-mono font-bold text-[#292320] tabular-nums">
                {formatNPR(itemsSubtotal)}
              </span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D8CEC1]/50">
              <div className="flex items-center gap-1.5">
                <span className="text-[#71675E]">Discount:</span>
                <div className="inline-flex rounded-md border border-[#D8CEC1] overflow-hidden text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType("FLAT")}
                    className={`px-1.5 py-0.5 font-bold cursor-pointer ${
                      discountType === "FLAT" ? "bg-[#6B2837] text-white" : "bg-[#FFFCF7] text-[#292320]"
                    }`}
                  >
                    Flat (Rs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("PERCENT")}
                    className={`px-1.5 py-0.5 font-bold cursor-pointer ${
                      discountType === "PERCENT" ? "bg-[#6B2837] text-white" : "bg-[#FFFCF7] text-[#292320]"
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={discountVal || ""}
                onChange={(e) => setDiscountVal(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-20 text-right font-mono font-bold px-2 py-0.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] tabular-nums"
              />
            </div>

            {/* VAT Checkbox */}
            <div className="flex items-center justify-between pt-1 border-t border-[#D8CEC1]/50">
              <label className="flex items-center gap-1.5 cursor-pointer text-[#71675E]">
                <input
                  type="checkbox"
                  checked={applyVat}
                  onChange={(e) => setApplyVat(e.target.checked)}
                  className="rounded text-[#6B2837]"
                />
                <span>Add {vatRate}% VAT</span>
              </label>
              <span className="font-mono tabular-nums text-[#71675E]">{formatNPR(vatAmount)}</span>
            </div>

            {activeDeliveryFee > 0 && (
              <div className="flex justify-between text-[#71675E] pt-1 border-t border-[#D8CEC1]/50">
                <span>Delivery Fee:</span>
                <span className="font-mono tabular-nums">{formatNPR(activeDeliveryFee)}</span>
              </div>
            )}

            {activePackagingFee > 0 && (
              <div className="flex justify-between text-[#71675E] pt-1 border-t border-[#D8CEC1]/50">
                <span>Packaging Fee:</span>
                <span className="font-mono tabular-nums">{formatNPR(activePackagingFee)}</span>
              </div>
            )}

            {/* Net Payable Total */}
            <div className="flex items-center justify-between font-black text-sm text-[#292320] pt-2 border-t border-[#D8CEC1]">
              <span>Net Payable Total:</span>
              <span className="font-mono text-base text-[#6B2837] tabular-nums">
                {formatNPR(netPayableTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-[#292320]">Select Payment Method</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "CASH", label: "Cash", icon: Banknote },
                { id: "CARD", label: "Card POS", icon: CreditCard },
                { id: "FONE_PAY", label: "FonePay / QR", icon: QrCode },
                { id: "ESEWA", label: "eSewa / Wallet", icon: Wallet },
                { id: "CREDIT", label: "Credit (Khata)", icon: UserCheck },
                { id: "ROOM_CHARGE", label: "Room Charge", icon: Hotel },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as typeof paymentMethod)}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? "border-[#28634B] bg-[#EAF3EE] text-[#28634B]"
                        : "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hotel Stay Selector when Room Charge is active */}
          {paymentMethod === "ROOM_CHARGE" && (
            <div className="p-3 rounded-lg border border-[#B8D2E6] bg-[#EDF4F9] space-y-1.5 text-xs">
              <label className="block font-bold text-[#315F85]">
                Select Checked-In Guest Room / Stay
              </label>
              {loadingStays ? (
                <div className="h-8 rounded-md bg-[#EEE7DD] animate-pulse" />
              ) : stays.length === 0 ? (
                <p className="text-[11px] text-[#71675E]">
                  No active checked-in guests available for room charge.
                </p>
              ) : (
                <select
                  value={selectedStayId}
                  onChange={(e) => setSelectedStayId(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                >
                  <option value="">-- Choose occupied room --</option>
                  {stays.map((stay) => (
                    <option key={stay.id} value={stay.id}>
                      Room {stay.room?.roomNumber || "N/A"} • {stay.guestName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Cash Tender & Quick Suggestions */}
          {paymentMethod === "CASH" && (
            <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#292320]">Quick Cash Suggestions:</span>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {[
                    netPayableTotal,
                    Math.ceil(netPayableTotal / 100) * 100,
                    Math.ceil(netPayableTotal / 500) * 500,
                  ]
                    .filter((v, idx, arr) => arr.indexOf(v) === idx)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTenderAmount(val.toString())}
                        className="px-2 py-0.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] font-mono font-bold tabular-nums cursor-pointer"
                      >
                        Rs. {val}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D8CEC1]/50">
                <div>
                  <span className="block text-[11px] text-[#71675E]">Amount Tendered (Rs.)</span>
                  <input
                    type="number"
                    value={tenderAmount}
                    onChange={(e) => setTenderAmount(e.target.value)}
                    placeholder={netPayableTotal.toString()}
                    className="w-32 text-xs font-mono font-bold px-2 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] tabular-nums"
                  />
                </div>

                <div className="text-right">
                  <span className="block text-[11px] text-[#71675E]">Change to Return:</span>
                  <span className="text-sm font-black font-mono text-[#28634B] tabular-nums">
                    {formatNPR(changeAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShow(false)}
            disabled={isSettling}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSettle(true)}
            disabled={isSettling}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-[#C3DED0] bg-[#EAF3EE] hover:bg-[#DCECE3] disabled:opacity-50 text-[#28634B] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Settle &amp; Print</span>
          </button>

          <button
            type="button"
            onClick={() => handleSettle(false)}
            disabled={isSettling}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#28634B] hover:bg-[#1F4F3B] disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="tabular-nums">
              {isSettling ? "Settling..." : `Complete Settlement (${formatNPR(netPayableTotal)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});
