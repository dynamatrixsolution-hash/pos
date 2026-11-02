"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import {
  ModifierModal,
  MenuItemWithModifiers,
  SelectedModifier,
} from "@/components/restaurant/modifier-modal";
import { SplitBillSheet } from "@/components/restaurant/split-bill-sheet";
import { Search, Plus, Minus, X } from "lucide-react";

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
  id: string;
  roundNumber: number;
  lines: ExistingRoundLine[];
}

function RestaurantPosContent() {
  const searchParams = useSearchParams();
  const queryTableId = searchParams.get("tableId");

  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "BAR_WALK_IN">("DINE_IN");
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  // Active order & rounds on this table
  const [activeOrderId, setActiveOrderId] = useState<string>("");
  const [existingRounds, setExistingRounds] = useState<ExistingRound[]>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<string>("0.00");
  const [orderNumber, setOrderNumber] = useState<string>("");

  // Current draft round (Round N+1)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItemWithModifiers | null>(null);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Charge to Room Modal state
  const [showChargeRoomModal, setShowChargeRoomModal] = useState(false);
  const [activeStays, setActiveStays] = useState<any[]>([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [chargingToRoom, setChargingToRoom] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load catalog and tables
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      const [catRes, tabRes] = await Promise.all([
        fetch("/api/v1/restaurant/menus"),
        fetch("/api/v1/restaurant/tables"),
      ]);
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.catalog && catData.catalog.length > 0) {
          setCatalog(catData.catalog);
        }
      }
      if (tabRes.ok) {
        const tabData = await tabRes.json();
        if (tabData.tables && tabData.tables.length > 0) {
          setTables(tabData.tables);
          if (queryTableId && tabData.tables.some((t: any) => t.id === queryTableId)) {
            setSelectedTableId(queryTableId);
          } else {
            const occupied = tabData.tables.find((t: any) => t.status === "OCCUPIED");
            setSelectedTableId((prev) => prev || occupied?.id || tabData.tables[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error loading POS initial data:", err);
    } finally {
      setLoadingCatalog(false);
    }
  }, [queryTableId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch active orders for selected table
  const fetchTableOrders = useCallback(async (tableId: string) => {
    if (!tableId) return;
    try {
      const res = await fetch(`/api/v1/restaurant/orders?tableId=${tableId}`);
      if (!res.ok) return;
      const data = await res.json();
      const activeOrder = data.orders?.find((o: any) => o.settlementStatus !== "PAID");

      if (activeOrder) {
        setActiveOrderId(activeOrder.id);
        setOrderNumber(activeOrder.orderNumber);
        setExistingOrderTotal(activeOrder.totalAmount?.toString() || "0.00");
        setSelectedSessionId(activeOrder.tableSessionId || "");
        const rounds = (activeOrder.rounds || []).map((r: any) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          lines: (r.lines || []).map((l: any) => ({
            id: l.id,
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: l.unitPrice?.toString() || "0.00",
            total: l.lineTotal?.toString() || l.total?.toString() || "0.00",
            acceptanceStatus: l.acceptanceStatus,
            fulfillmentStatus: l.fulfillmentStatus,
          })),
        }));
        setExistingRounds(rounds);
      } else {
        setActiveOrderId("");
        setExistingRounds([]);
        setExistingOrderTotal("0.00");
        setOrderNumber("");
        setSelectedSessionId("");
      }
    } catch (err) {
      console.error("Error loading table orders:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedTableId) {
      fetchTableOrders(selectedTableId);
    }
  }, [selectedTableId, fetchTableOrders]);

  const allSections = useMemo(() => {
    return catalog.flatMap((m) => m.sections || []);
  }, [catalog]);

  const displayedItems = useMemo(() => {
    const baseItems =
      selectedSectionId === "ALL"
        ? allSections.flatMap((s) =>
            (s.items || []).map((it: any) => ({ ...it, sectionName: s.name }))
          )
        : (allSections.find((s) => s.id === selectedSectionId)?.items || []).map((it: any) => ({
            ...it,
            sectionName: allSections.find((s) => s.id === selectedSectionId)?.name,
          }));

    if (!searchQuery.trim()) return baseItems;
    const q = searchQuery.toLowerCase();
    return baseItems.filter(
      (it: any) =>
        it.name.toLowerCase().includes(q) ||
        (it.description && it.description.toLowerCase().includes(q))
    );
  }, [allSections, selectedSectionId, searchQuery]);

  const handleItemClick = (item: any) => {
    setDraftLines((prev) => {
      const existingIdx = prev.findIndex(
        (l) => l.item.id === item.id && l.selectedModifiers.length === 0 && !l.notes
      );
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
  };

  const updateDraftQuantity = (idx: number, delta: number) => {
    setDraftLines((prev) => {
      const updated = [...prev];
      const target = updated[idx];
      if (!target) return prev;
      const nextQty = target.quantity + delta;
      if (nextQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      const unitCents = toCents(target.unitPrice);
      updated[idx] = {
        ...target,
        quantity: nextQty,
        totalPrice: fromCents(unitCents * nextQty),
      };
      return updated;
    });
  };

  const { draftSubtotalStr, draftTaxStr, draftTotalWithTaxStr } = useMemo(() => {
    const subtotalCents = draftLines.reduce((acc, line) => acc + toCents(line.totalPrice), 0);
    const taxCents = Math.round(subtotalCents * 0.13);
    return {
      draftSubtotalStr: fromCents(subtotalCents),
      draftTaxStr: fromCents(taxCents),
      draftTotalWithTaxStr: fromCents(subtotalCents + taxCents),
    };
  }, [draftLines]);

  const allExistingLines = useMemo(() => {
    return existingRounds.flatMap((r) => r.lines);
  }, [existingRounds]);

  const handleSubmitRound = async () => {
    if (draftLines.length === 0) return;
    try {
      setIsSubmitting(true);

      let sessionId = selectedSessionId;
      const targetTable = tables.find((t) => t.id === selectedTableId);
      if (
        orderType === "DINE_IN" &&
        selectedTableId &&
        targetTable?.status === "AVAILABLE" &&
        !sessionId
      ) {
        const sessRes = await fetch("/api/v1/restaurant/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: selectedTableId, guestCount: 2 }),
        });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          sessionId = sessData.session?.id || "";
          setSelectedSessionId(sessionId);
        }
      }

      const payload = {
        tableId: orderType === "DINE_IN" ? selectedTableId : null,
        tableSessionId: orderType === "DINE_IN" ? sessionId || null : null,
        orderType,
        notes: orderNotes || undefined,
        autoRouteToKitchen: true,
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

      const orderData = await res.json();
      setDraftLines([]);
      setOrderNotes("");
      await Promise.all([loadInitialData(), fetchTableOrders(selectedTableId)]);
      showToast(
        `Round #${orderData.round?.roundNumber || existingRounds.length + 1} sent to Kitchen KDS`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Error sending order to kitchen", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openChargeToRoomDialog = async () => {
    try {
      const res = await fetch("/api/v1/hotel/stays?status=ACTIVE");
      if (res.ok) {
        const data = await res.json();
        setActiveStays(data.stays || []);
        if (data.stays?.[0]) setSelectedStayId(data.stays[0].id);
      }
      setShowChargeRoomModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChargeOrderToRoom = async () => {
    if (!activeOrderId || !selectedStayId) return;
    try {
      setChargingToRoom(true);
      const folRes = await fetch(`/api/v1/hotel/folios?stayId=${selectedStayId}`);
      const folData = await folRes.json();
      let folioId = folData.folios?.[0]?.id;
      if (!folioId) {
        const createFol = await fetch("/api/v1/hotel/folios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stayId: selectedStayId, windowName: "PRIMARY" }),
        });
        const createdData = await createFol.json();
        folioId = createdData.folio?.id;
      }

      const postRes = await fetch(`/api/v1/hotel/folios/${folioId}/charge-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activeOrderId,
          stayId: selectedStayId,
        }),
      });
      const postJson = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postJson.error || "Failed to post order to room folio");
      }

      setShowChargeRoomModal(false);
      await fetchTableOrders(selectedTableId);
      showToast(`Order #${orderNumber} transferred to Hotel Room Folio`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setChargingToRoom(false);
    }
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#F7F3EC] text-[#292320]">
      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-3.5 py-2.5 rounded-lg border text-xs font-semibold ${
            toastMessage.type === "success"
              ? "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]"
              : "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]"
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Top Bar */}
      <div className="border-b border-[#D8CEC1] bg-[#FFFCF7] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/restaurant/tables"
            className="px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            Floor Plan
          </Link>

          <div className="inline-flex rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] p-0.5">
            {(
              [
                { id: "DINE_IN", label: "Dine-In" },
                { id: "TAKEAWAY", label: "Takeaway" },
                { id: "BAR_WALK_IN", label: "Bar" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setOrderType(mode.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  orderType === mode.id
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {orderType === "DINE_IN" && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
              {tables.map((t) => {
                const isSelected = t.id === selectedTableId;
                const isOccupied = t.status === "OCCUPIED";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTableId(t.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                        : isOccupied
                        ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                        : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                    }`}
                  >
                    <span className="tabular-nums">{t.tableNumber}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isOccupied ? "bg-[#946000]" : "bg-[#28634B]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/restaurant/kds"
            className="px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors"
          >
            Kitchen KDS
          </Link>

          {orderNumber && (
            <>
              <button
                type="button"
                onClick={openChargeToRoomDialog}
                className="px-3 py-1.5 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] hover:bg-[#EDD7AD]/50 text-xs font-semibold text-[#946000] transition-colors"
              >
                Charge to Room
              </button>
              <button
                type="button"
                onClick={() => setIsSplitBillOpen(true)}
                className="px-3 py-1.5 rounded-md bg-[#28634B] hover:bg-[#28634B]/90 text-xs font-semibold text-[#FFFCF7] transition-colors"
              >
                Split / Settle Bill
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Menu Catalog */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#D8CEC1] bg-[#EEE7DD]/60 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedSectionId("ALL")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                  selectedSectionId === "ALL"
                    ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                    : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                }`}
              >
                All ({allSections.reduce((acc, s) => acc + (s.items?.length || 0), 0)})
              </button>
              {allSections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors border ${
                    sec.id === selectedSectionId
                      ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                      : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                  }`}
                >
                  {sec.name} ({sec.items?.length || 0})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter menu items..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
              />
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto p-3.5">
            {loadingCatalog ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3.5 space-y-2.5"
                  >
                    <div className="h-3 w-1/3 rounded bg-[#EEE7DD] animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-[#EEE7DD] animate-pulse" />
                    <div className="h-3 w-full rounded bg-[#EEE7DD] animate-pulse" />
                    <div className="h-7 w-full rounded bg-[#EEE7DD] animate-pulse pt-2" />
                  </div>
                ))}
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-semibold text-[#292320]">No menu items found</p>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  Select another category or clear your search filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayedItems.map((item: any) => {
                  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;
                  const inDraftQty = draftLines
                    .filter((l) => l.item.id === item.id)
                    .reduce((sum, l) => sum + l.quantity, 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`cursor-pointer rounded-lg border bg-[#FFFCF7] p-3.5 flex flex-col justify-between transition-colors ${
                        inDraftQty > 0
                          ? "border-[#6B2837]"
                          : "border-[#D8CEC1] hover:border-[#292320]/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
                            {item.sectionName}
                          </span>
                          {inDraftQty > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-[#6B2837] text-[#FFFCF7] text-[10px] font-semibold tabular-nums">
                              {inDraftQty}x
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs font-semibold text-[#292320] mt-1 line-clamp-1">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-[11px] text-[#71675E] line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#D8CEC1]/60 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold tabular-nums text-[#292320]">
                            {formatNPR(item.basePrice)}
                          </span>
                          {item.prepTimeMinutes && (
                            <span className="block text-[10px] text-[#71675E] tabular-nums">
                              {item.prepTimeMinutes}m prep
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {hasModifiers && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveItemForModal(item);
                              }}
                              className="px-2 py-1 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-medium text-[#292320] transition-colors"
                            >
                              Options
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            className="h-7 w-7 rounded bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] flex items-center justify-center transition-colors"
                            aria-label="Add item"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Ticket & Rounds */}
        <div className="w-88 lg:w-96 flex flex-col bg-[#FFFCF7] border-l border-[#D8CEC1] overflow-hidden">
          <div className="p-3.5 border-b border-[#D8CEC1] bg-[#EEE7DD]/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#292320]">
                  {orderType === "DINE_IN"
                    ? `Table ${selectedTable?.tableNumber || "-"}`
                    : orderType === "TAKEAWAY"
                    ? "Takeaway"
                    : "Bar Counter"}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    existingRounds.length > 0
                      ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                      : "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]"
                  }`}
                >
                  {existingRounds.length > 0 ? `${existingRounds.length} Sent` : "New"}
                </span>
              </div>
              <p className="text-[11px] text-[#71675E] mt-0.5 tabular-nums">
                {orderNumber ? `Order #${orderNumber}` : "No active order"}
              </p>
            </div>

            {existingRounds.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#71675E] block">
                  Running Total
                </span>
                <span className="text-xs font-bold tabular-nums text-[#6B2837]">
                  {formatNPR(existingOrderTotal)}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* Current Draft Round */}
            <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-1.5">
                <span className="text-xs font-bold text-[#292320]">
                  Round #{existingRounds.length + 1} (Draft)
                </span>
                {draftLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftLines([])}
                    className="text-[11px] font-medium text-[#B33432] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {draftLines.length === 0 ? (
                <p className="py-5 text-center text-xs text-[#71675E]">
                  Select items from the menu to build Round #{existingRounds.length + 1}.
                </p>
              ) : (
                <div className="space-y-2">
                  {draftLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#292320] flex-1">
                          {line.item.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(idx, -1)}
                            className="h-5 w-5 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#292320]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-semibold tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(idx, 1)}
                            className="h-5 w-5 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#292320]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[#292320] w-18 text-right">
                          {formatNPR(line.totalPrice)}
                        </span>
                      </div>

                      {line.selectedModifiers.length > 0 && (
                        <p className="text-[11px] text-[#71675E]">
                          + {line.selectedModifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="text-[11px] text-[#946000]">Note: {line.notes}</p>
                      )}
                    </div>
                  ))}

                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Kitchen prep note..."
                    className="w-full px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              )}
            </div>

            {/* Sent Rounds */}
            {existingRounds.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E] block">
                  Dispatched Kitchen Rounds
                </span>

                {existingRounds.map((round) => (
                  <div
                    key={round.roundNumber}
                    className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC]/60 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[#292320] border-b border-[#D8CEC1]/60 pb-1">
                      <span>Round #{round.roundNumber}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0] text-[10px] font-semibold">
                        Sent
                      </span>
                    </div>

                    <div className="space-y-1">
                      {round.lines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between text-xs text-[#292320]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold tabular-nums">{line.quantity}x</span>
                            <span>{line.itemName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEE7DD] text-[#71675E]">
                              {line.fulfillmentStatus}
                            </span>
                          </div>
                          <span className="tabular-nums font-medium">{formatNPR(line.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-3.5 border-t border-[#D8CEC1] bg-[#EEE7DD]/60 space-y-2.5">
            {draftLines.length > 0 && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#71675E]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatNPR(draftSubtotalStr)}</span>
                </div>
                <div className="flex justify-between text-[#71675E]">
                  <span>VAT (13%)</span>
                  <span className="tabular-nums">{formatNPR(draftTaxStr)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#292320] pt-1 border-t border-[#D8CEC1]">
                  <span>Round #{existingRounds.length + 1} Total</span>
                  <span className="tabular-nums text-[#6B2837]">
                    {formatNPR(draftTotalWithTaxStr)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={draftLines.length === 0 || isSubmitting}
              onClick={handleSubmitRound}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                draftLines.length > 0 && !isSubmitting
                  ? "bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                  : "bg-[#D8CEC1] text-[#71675E] cursor-not-allowed"
              }`}
            >
              {isSubmitting
                ? "Sending to Kitchen..."
                : `Send Round #${existingRounds.length + 1} to Kitchen`}
            </button>
          </div>
        </div>
      </div>

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

      <SplitBillSheet
        isOpen={isSplitBillOpen}
        onClose={() => setIsSplitBillOpen(false)}
        orderNumber={orderNumber}
        tableNumber={selectedTable?.tableNumber || ""}
        totalAmount={existingOrderTotal}
        orderLines={allExistingLines}
        onConfirmPayment={(splits) => {
          showToast(`Split settlement recorded (${splits.length} shares)`, "success");
        }}
      />

      {showChargeRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4">
          <div className="w-full max-w-md rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Charge Order to Room Folio</h3>
                <p className="text-[11px] text-[#71675E] tabular-nums">
                  Order #{orderNumber} • {formatNPR(existingOrderTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChargeRoomModal(false)}
                className="text-[#71675E] hover:text-[#292320]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#292320] block">
                Checked-In Guest Room
              </label>
              {activeStays.length === 0 ? (
                <p className="text-xs text-[#B33432]">No active checked-in stays found.</p>
              ) : (
                <select
                  value={selectedStayId}
                  onChange={(e) => setSelectedStayId(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                >
                  {activeStays.map((s) => (
                    <option key={s.id} value={s.id}>
                      Room {s.room?.roomNumber || "N/A"} - {s.guestName} ({s.stayNumber})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setShowChargeRoomModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#D8CEC1] text-xs font-semibold text-[#71675E] hover:text-[#292320]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStayId || chargingToRoom}
                onClick={handleChargeOrderToRoom}
                className="px-3.5 py-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-semibold text-[#FFFCF7] disabled:opacity-50"
              >
                {chargingToRoom ? "Posting..." : "Post to Folio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RestaurantPosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-3">
          <div className="h-8 w-48 rounded bg-[#EEE7DD] animate-pulse" />
          <div className="h-96 w-full rounded-lg bg-[#EEE7DD] animate-pulse" />
        </div>
      }
    >
      <RestaurantPosContent />
    </Suspense>
  );
}
