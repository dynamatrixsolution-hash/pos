"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatMoney, toCents, fromCents } from "@/lib/currency";
import { ModifierModal, MenuItemWithModifiers, SelectedModifier } from "@/components/restaurant/modifier-modal";
import { SplitBillSheet } from "@/components/restaurant/split-bill-sheet";

interface DraftLine {
  item: MenuItemWithModifiers;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  notes: string;
  unitPrice: string;
  totalPrice: string;
}

interface ExistingRoundLine {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  acceptanceStatus: string;
  fulfillmentStatus: string;
}

interface ExistingRound {
  roundNumber: number;
  lines: ExistingRoundLine[];
}

export default function RestaurantPosPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Existing rounds on this table
  const [existingRounds, setExistingRounds] = useState<ExistingRound[]>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<string>("0.00");
  const [orderNumber, setOrderNumber] = useState<string>("");

  // Current draft round (Round N+1)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItemWithModifiers | null>(null);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load catalog and tables
  useEffect(() => {
    async function loadData() {
      try {
        const [catRes, tabRes] = await Promise.all([
          fetch("/api/v1/restaurant/menus"),
          fetch("/api/v1/restaurant/tables"),
        ]);
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.catalog && catData.catalog.length > 0) {
            setCatalog(catData.catalog);
            if (catData.catalog[0].sections?.length > 0) {
              setSelectedSectionId(catData.catalog[0].sections[0].id);
            }
          }
        }
        if (tabRes.ok) {
          const tabData = await tabRes.json();
          if (tabData.tables) {
            setTables(tabData.tables);
            const occupied = tabData.tables.find((t: any) => t.status === "OCCUPIED");
            if (occupied) {
              setSelectedTableId(occupied.id);
            } else if (tabData.tables[0]) {
              setSelectedTableId(tabData.tables[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Error loading POS initial data:", err);
      }
    }
    loadData();
  }, []);

  // Fetch active orders for selected table
  useEffect(() => {
    if (!selectedTableId) return;

    async function fetchTableOrders() {
      try {
        const res = await fetch(`/api/v1/restaurant/orders?tableId=${selectedTableId}`);
        if (!res.ok) return;
        const data = await res.json();
        const activeOrder = data.orders?.find((o: any) => o.settlementStatus !== "PAID");

        if (activeOrder) {
          setOrderNumber(activeOrder.orderNumber);
          setExistingOrderTotal(activeOrder.totalAmount?.toString() || "0.00");
          setSelectedSessionId(activeOrder.tableSessionId || "");
          const rounds = (activeOrder.rounds || []).map((r: any) => ({
            roundNumber: r.roundNumber,
            lines: (r.lines || []).map((l: any) => ({
              id: l.id,
              itemName: l.itemName,
              quantity: l.quantity,
              unitPrice: l.unitPrice?.toString() || "0.00",
              total: l.total?.toString() || "0.00",
              acceptanceStatus: l.acceptanceStatus,
              fulfillmentStatus: l.fulfillmentStatus,
            })),
          }));
          setExistingRounds(rounds);
        } else {
          setExistingRounds([]);
          setExistingOrderTotal("0.00");
          setOrderNumber("");
        }
      } catch (err) {
        console.error("Error loading table orders:", err);
      }
    }

    fetchTableOrders();
  }, [selectedTableId]);

  // Flatten all sections and items
  const allSections = useMemo(() => {
    return catalog.flatMap((m) => m.sections || []);
  }, [catalog]);

  const activeSection = allSections.find((s) => s.id === selectedSectionId) || allSections[0];
  const activeItems = activeSection?.items || [];

  // Handle item click
  const handleItemClick = (item: any) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setActiveItemForModal(item);
    } else {
      // Add directly
      setDraftLines((prev) => {
        const existingIdx = prev.findIndex((l) => l.item.id === item.id && l.selectedModifiers.length === 0);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const cur = updated[existingIdx];
          const newQty = cur.quantity + 1;
          const unitCents = toCents(cur.unitPrice);
          updated[existingIdx] = {
            ...cur,
            quantity: newQty,
            totalPrice: fromCents(unitCents * newQty),
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              item,
              quantity: 1,
              selectedModifiers: [],
              notes: "",
              unitPrice: item.basePrice?.toString() || "0.00",
              totalPrice: item.basePrice?.toString() || "0.00",
            },
          ];
        }
      });
    }
  };

  // Draft totals
  const draftTotalStr = useMemo(() => {
    const totalCents = draftLines.reduce((acc, line) => acc + toCents(line.totalPrice), 0);
    return fromCents(totalCents);
  }, [draftLines]);

  // Combined order lines for split-bill
  const allExistingLines = useMemo(() => {
    return existingRounds.flatMap((r) => r.lines);
  }, [existingRounds]);

  // Submit current draft round
  const handleSubmitRound = async () => {
    if (draftLines.length === 0) return;
    try {
      setIsSubmitting(true);
      const payload = {
        tableId: selectedTableId,
        tableSessionId: selectedSessionId || null,
        items: draftLines.map((line) => ({
          menuItemId: line.item.id,
          itemName: line.item.name,
          basePrice: line.item.basePrice,
          quantity: line.quantity,
          appliedModifiers: line.selectedModifiers,
          notes: line.notes,
        })),
      };

      const res = await fetch("/api/v1/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit order round");
      }

      setDraftLines([]);
      // Refresh table orders
      const orderData = await res.json();
      if (orderData.order) {
        setOrderNumber(orderData.order.orderNumber);
        setExistingOrderTotal(orderData.order.totalAmount?.toString() || "0.00");
        const rounds = (orderData.order.rounds || []).map((r: any) => ({
          roundNumber: r.roundNumber,
          lines: (r.lines || []).map((l: any) => ({
            id: l.id,
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: l.unitPrice?.toString() || "0.00",
            total: l.total?.toString() || "0.00",
            acceptanceStatus: l.acceptanceStatus,
            fulfillmentStatus: l.fulfillmentStatus,
          })),
        }));
        setExistingRounds(rounds);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Top Bar: Table Selector & Status */}
      <div className="border-b border-sandstone bg-porcelain px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/restaurant/tables"
            className="text-xs font-medium text-warmgray hover:text-espresso flex items-center gap-1"
          >
            ← Floor View
          </Link>
          <div className="h-4 w-[1px] bg-sandstone" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-espresso">Active Table:</span>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="rounded-lg border border-sandstone bg-warmstone/20 px-2.5 py-1 text-xs font-bold text-espresso focus:outline-none focus:border-burgundy"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tableNumber} ({t.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {orderNumber && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-warmgray">Order #{orderNumber}</span>
            <button
              type="button"
              onClick={() => setIsSplitBillOpen(true)}
              className="px-3 py-1 text-xs font-semibold rounded-lg border border-sandstone bg-porcelain text-espresso hover:bg-warmstone transition-colors"
            >
              Split Bill
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Menu Catalog Grid */}
        <div className="flex-1 flex flex-col border-r border-sandstone overflow-hidden">
          {/* Section Category Tabs */}
          <div className="flex items-center gap-2 border-b border-sandstone p-2.5 overflow-x-auto bg-warmstone/20">
            {allSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  sec.id === selectedSectionId
                    ? "bg-porcelain text-burgundy border-burgundy shadow-xs"
                    : "bg-porcelain/60 text-espresso border-sandstone hover:bg-warmstone/40"
                }`}
              >
                {sec.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-warmgray italic">No items available in this section.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {activeItems.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="p-3 rounded-xl border border-sandstone bg-porcelain hover:border-burgundy/60 hover:shadow-xs flex flex-col justify-between text-left transition-all group"
                  >
                    <div>
                      <p className="text-xs font-bold text-espresso group-hover:text-burgundy line-clamp-2">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-warmgray line-clamp-1 mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-sandstone/60">
                      <span className="text-xs font-bold tabular-nums text-espresso">
                        {formatMoney(item.basePrice)}
                      </span>
                      {item.modifierGroups?.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-warmstone text-warmgray font-medium">
                          Options
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Multi-Round Order Sheet */}
        <div className="w-80 sm:w-96 flex flex-col bg-porcelain border-l border-sandstone overflow-hidden">
          {/* Existing Rounds List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {existingRounds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-sandstone pb-1.5">
                  <span className="text-xs font-bold text-espresso uppercase tracking-wider">
                    Kitchen Rounds
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-burgundy">
                    Total: {formatMoney(existingOrderTotal)}
                  </span>
                </div>

                {existingRounds.map((round) => (
                  <div
                    key={round.roundNumber}
                    className="rounded-lg border border-sandstone/80 bg-warmivory/30 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-warmgray border-b border-sandstone/40 pb-1">
                      <span>Round #{round.roundNumber}</span>
                      <span className="px-1.5 py-0.2 rounded bg-forest/10 text-forest text-[10px]">
                        Submitted
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {round.lines.map((line) => (
                        <div key={line.id} className="flex justify-between text-xs">
                          <span className="text-espresso">
                            {line.quantity}x {line.itemName}
                          </span>
                          <span className="tabular-nums font-medium text-espresso">
                            {formatMoney(line.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current Draft Round (Round N+1) */}
            <div className="space-y-2 pt-2 border-t border-sandstone">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-espresso">
                  Round #{existingRounds.length + 1} (Draft)
                </span>
                {draftLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftLines([])}
                    className="text-[11px] text-warmgray hover:text-red"
                  >
                    Clear Draft
                  </button>
                )}
              </div>

              {draftLines.length === 0 ? (
                <p className="text-xs text-warmgray italic py-4 text-center">
                  Select menu items from the left to build the next round.
                </p>
              ) : (
                <div className="space-y-2">
                  {draftLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg border border-sandstone bg-warmstone/20 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-espresso">
                          {line.quantity}x {line.item.name}
                        </span>
                        <span className="font-bold tabular-nums text-espresso">
                          {formatMoney(line.totalPrice)}
                        </span>
                      </div>
                      {line.selectedModifiers.length > 0 && (
                        <p className="text-[11px] text-warmgray">
                          + {line.selectedModifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="text-[11px] text-warmgray italic">Note: {line.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-3 border-t border-sandstone bg-warmstone/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-warmgray">Round Draft Subtotal:</span>
              <span className="font-bold tabular-nums text-espresso">{formatMoney(draftTotalStr)}</span>
            </div>

            <button
              type="button"
              disabled={draftLines.length === 0 || isSubmitting}
              onClick={handleSubmitRound}
              className={`w-full py-2.5 rounded-lg text-xs font-bold text-porcelain flex items-center justify-center gap-2 transition-all shadow-xs ${
                draftLines.length > 0 && !isSubmitting
                  ? "bg-burgundy hover:bg-burgundy-hover cursor-pointer"
                  : "bg-sandstone text-warmgray cursor-not-allowed"
              }`}
            >
              <span>{isSubmitting ? "Sending..." : `Send Round #${existingRounds.length + 1} to Kitchen`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modifier Selection Modal */}
      <ModifierModal
        item={activeItemForModal}
        isOpen={!!activeItemForModal}
        onClose={() => setActiveItemForModal(null)}
        onConfirm={(payload) => {
          setDraftLines((prev) => [
            ...prev,
            {
              item: payload.item,
              quantity: payload.quantity,
              selectedModifiers: payload.selectedModifiers,
              notes: payload.notes,
              unitPrice: payload.unitPrice,
              totalPrice: payload.totalPrice,
            },
          ]);
        }}
      />

      {/* Split Bill Sheet */}
      <SplitBillSheet
        isOpen={isSplitBillOpen}
        onClose={() => setIsSplitBillOpen(false)}
        orderNumber={orderNumber}
        tableNumber={selectedTable?.tableNumber || ""}
        totalAmount={existingOrderTotal}
        orderLines={allExistingLines}
        onConfirmPayment={(splits) => {
          alert(`Split payment processed for ${splits.length} guests.`);
        }}
      />
    </div>
  );
}

