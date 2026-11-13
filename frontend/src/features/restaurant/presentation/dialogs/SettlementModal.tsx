"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { usePosUiStore } from "../../state/pos-ui.store";
import { usePosCatalogStore } from "../../state/pos-catalog.store";
import { usePosTicketsStore } from "../../state/pos-tickets.store";
import { usePosCartStore } from "../../state/pos-cart.store";
import { restaurantPosRepository } from "../../repositories/restaurant-pos.repository";

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
  const existingOrderTotal = usePosTicketsStore((s) => s.existingOrderTotal);
  const fetchActiveOrders = usePosTicketsStore((s) => s.fetchActiveOrders);
  const setActiveOrder = usePosTicketsStore((s) => s.setActiveOrder);

  const draftLines = usePosCartStore((s) => s.draftLines);
  const clearDraft = usePosCartStore((s) => s.clearDraft);

  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "FONE_PAY" | "ESEWA" | "CREDIT" | "ROOM_CHARGE"
  >("CASH");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountVal, setDiscountVal] = useState<number>(0);
  const [applyVat, setApplyVat] = useState<boolean>(true);
  const [tenderAmount, setTenderAmount] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  // Calculate calculations
  const draftTotal = draftLines.reduce((acc, l) => acc + l.totalPrice, 0);
  const itemsSubtotal = (parseFloat(existingOrderTotal) || 0) + draftTotal;

  const discountAmount = useMemo(() => {
    if (discountType === "PERCENT") {
      return (itemsSubtotal * (Number(discountVal) || 0)) / 100;
    }
    return Number(discountVal) || 0;
  }, [itemsSubtotal, discountType, discountVal]);

  const afterDiscount = Math.max(0, itemsSubtotal - discountAmount);
  const vatAmount = applyVat ? afterDiscount * 0.13 : 0;
  const netPayableTotal = Math.round((afterDiscount + vatAmount) * 100) / 100;

  // Tender & Change
  const tenderNum = parseFloat(tenderAmount) || netPayableTotal;
  const changeAmount = Math.max(0, tenderNum - netPayableTotal);

  if (!show || itemsSubtotal <= 0) return null;

  const handleSettle = async (printReceipt = false) => {
    if (!activeOrderId && !selectedTableId) return;

    setIsSettling(true);
    try {
      // Settle order via repository
      await restaurantPosRepository.settleOrder(activeOrderId, {
        paymentMethod,
        tenderAmount: tenderNum,
        cashTendered: paymentMethod === "CASH" ? tenderNum : undefined,
        changeReturned: paymentMethod === "CASH" ? changeAmount : undefined,
        discountAmount,
        discountTotal: discountAmount,
        totalAmount: netPayableTotal,
        discountType,
        applyVat,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        clearTable: true,
      });

      // Reset state and return to floor layout
      clearDraft();
      setActiveOrder(null);
      setSelectedTable("");
      setShow(false);
      syncUrlView("SELECT_SPACE");
      await loadInitialCatalog();
      await fetchActiveOrders();
    } catch {
      // Error handled
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EDF5ED] text-[#2D6A4F]">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Payment &amp; Settlement {orderNumber ? `— #${orderNumber}` : ""}
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
                className="text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320]"
              />
              <input
                type="text"
                placeholder="Phone number..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320]"
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
                <div className="inline-flex rounded border border-[#D8CEC1] text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType("FLAT")}
                    className={`px-1.5 py-0.5 font-bold ${
                      discountType === "FLAT" ? "bg-[#6B2837] text-white" : "bg-[#FFFCF7]"
                    }`}
                  >
                    Flat (Rs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("PERCENT")}
                    className={`px-1.5 py-0.5 font-bold ${
                      discountType === "PERCENT" ? "bg-[#6B2837] text-white" : "bg-[#FFFCF7]"
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
                className="w-20 text-right font-mono font-bold px-2 py-0.5 rounded border border-[#D8CEC1] bg-[#F7F3EC]"
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
                <span>Add 13% VAT</span>
              </label>
              <span className="font-mono tabular-nums text-[#71675E]">{formatNPR(vatAmount)}</span>
            </div>

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
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? "border-[#16A34A] bg-[#EDF5ED] text-[#2D6A4F] shadow-2xs"
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

          {/* Cash Tender & Quick Suggestions */}
          {paymentMethod === "CASH" && (
            <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#292320]">Quick Cash Suggestions:</span>
                <div className="flex gap-1.5">
                  {[netPayableTotal, Math.ceil(netPayableTotal / 100) * 100, Math.ceil(netPayableTotal / 500) * 500]
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
                    className="w-32 text-xs font-mono font-bold px-2 py-1 rounded border border-[#D8CEC1] bg-[#FFFCF7]"
                  />
                </div>

                <div className="text-right">
                  <span className="block text-[11px] text-[#71675E]">Change to Return:</span>
                  <span className="text-sm font-black font-mono text-[#16A34A] tabular-nums">
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
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSettle(true)}
            disabled={isSettling}
            className="px-4 py-2 text-xs font-bold rounded-lg border border-[#16A34A] bg-[#EDF5ED] hover:bg-[#DCFCE7] text-[#15803D] flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Settle &amp; Print</span>
          </button>

          <button
            type="button"
            onClick={() => handleSettle(false)}
            disabled={isSettling}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isSettling ? "Settling..." : `Complete Settlement (${formatNPR(netPayableTotal)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

