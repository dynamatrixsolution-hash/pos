"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import { Notify } from "@/lib/notify";
import {
  ModifierModal,
  MenuItemWithModifiers,
  SelectedModifier,
} from "@/components/restaurant/modifier-modal";
import { SplitBillSheet } from "@/components/restaurant/split-bill-sheet";
import {
  Search,
  Plus,
  Minus, 
  X,
  CreditCard,
  Banknote,
  QrCode,
  Receipt,
  CheckCircle2,
  ArrowLeft,
  UtensilsCrossed,
  Clock,
  ChevronDown,
  Truck,
  Phone,
  MapPin,
  User,
  Building,
  Home,
  DoorOpen,
  Users,
  AlertTriangle,
  Flame,
  Coffee,
  Wine,
  Cake,
  BookOpen,
  Package,
  DollarSign,
} from "lucide-react";

interface DraftLine {
  item: MenuItemWithModifiers & { isOutOfStock?: boolean; outOfStockIngredients?: string[] };
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

interface Floor {
  id: string;
  name: string;
}

interface SpaceTable {
  id: string;
  tableNumber: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
  floorId: string;
  floor?: Floor;
  currentSessionId?: string | null;
}

type OrderType = "DINE_IN" | "TAKEAWAY" | "BAR_WALK_IN" | "DELIVERY";
type SpaceCategory = "ALL" | "TABLE" | "CABIN" | "VIP_ROOM" | "HALL";

// Helper to categorize spaces: Standard Table, Private Cabin, VIP Room, Meeting Hall
function getSpaceMeta(tableNumber: string) {
  const upper = String(tableNumber).toUpperCase().trim();
  if (upper.startsWith("C-") || upper.includes("CABIN")) {
    return {
      type: "CABIN" as const,
      label: "Cabin",
      icon: Home,
      badge: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
    };
  }
  if (upper.startsWith("R-") || upper.includes("VIP") || upper.includes("ROOM")) {
    return {
      type: "VIP_ROOM" as const,
      label: "VIP Room",
      icon: DoorOpen,
      badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#DBEAFE]",
    };
  }
  if (upper.startsWith("H-") || upper.startsWith("M-") || upper.includes("HALL")) {
    return {
      type: "HALL" as const,
      label: "Hall",
      icon: Building,
      badge: "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]",
    };
  }
  return {
    type: "TABLE" as const,
    label: "Table",
    icon: Users,
    badge: "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1]",
  };
}

// Parent Category Grouping Helper
function getParentCategory(sectionName: string): string {
  const s = sectionName.toLowerCase();
  if (
    s.includes("bar") ||
    s.includes("beer") ||
    s.includes("wine") ||
    s.includes("whisky") ||
    s.includes("cocktail") ||
    s.includes("liquor") ||
    s.includes("spirit")
  ) {
    return "BAR";
  }
  if (
    s.includes("drink") ||
    s.includes("beverage") ||
    s.includes("tea") ||
    s.includes("coffee") ||
    s.includes("juice") ||
    s.includes("shake")
  ) {
    return "BEVERAGE";
  }
  if (
    s.includes("dessert") ||
    s.includes("bakery") ||
    s.includes("cake") ||
    s.includes("sweet") ||
    s.includes("ice cream")
  ) {
    return "DESSERT";
  }
  return "FOOD";
}

function RestaurantPosContent() {
  const searchParams = useSearchParams();
  const queryTableId = searchParams.get("tableId");

  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("ALL");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Floors & Spaces
  const [floors, setFloors] = useState<Floor[]>([]);
  const [tables, setTables] = useState<SpaceTable[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("ALL");
  const [selectedSpaceType, setSelectedSpaceType] = useState<SpaceCategory>("ALL");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Service Mode
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  // Delivery Specific State
  const [deliveryInfo, setDeliveryInfo] = useState({
    customerName: "",
    phone: "",
    address: "",
    riderName: "",
    deliveryFee: "100",
  });

  // Active order & rounds on this table / session
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

  // Charge to Room Modal state
  const [showChargeRoomModal, setShowChargeRoomModal] = useState(false);
  const [activeStays, setActiveStays] = useState<any[]>([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [chargingToRoom, setChargingToRoom] = useState(false);

  // Settlement & Table Release state
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<
    "CASH" | "FONE_PAY" | "CARD" | "ROOM_CHARGE" | "CREDIT"
  >("CASH");
  const [settleTenderAmount, setSettleTenderAmount] = useState<number>(0);
  const [settleReference, setSettleReference] = useState<string>("");
  const [settleClearTable, setSettleClearTable] = useState<boolean>(true);
  const [isSettlingOrder, setIsSettlingOrder] = useState<boolean>(false);

  // Raw Inventory Drawer state (Phase 3)
  const [showStockDrawer, setShowStockDrawer] = useState(false);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [restockItem, setRestockItem] = useState<{ id: string; name: string; branchId: string } | null>(null);
  const [restockQty, setRestockQty] = useState<string>("10");
  const [isRestocking, setIsRestocking] = useState(false);

  const fetchCurrentStock = useCallback(async () => {
    try {
      setLoadingStock(true);
      const res = await fetch("/api/v1/inventory/current-stock");
      if (res.ok) {
        const json = await res.json();
        setStockItems(json.data || json.products || []);
      }
    } catch (e) {
      console.warn("Failed to load inventory stock:", e);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  const handleQuickRestock = async () => {
    if (!restockItem) return;
    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) {
      Notify.failure("Please enter a valid positive restock quantity");
      return;
    }

    try {
      setIsRestocking(true);
      const res = await fetch("/api/v1/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: restockItem.id,
          branchId: restockItem.branchId,
          type: "STOCK_IN",
          quantity: qty,
          notes: "Quick Kitchen Stock Replenishment from POS",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update stock");
      }

      Notify.success(`Restocked +${qty} to ${restockItem.name}`);
      setRestockItem(null);
      setRestockQty("10");
      await Promise.all([fetchCurrentStock(), loadInitialData()]);
    } catch (err: any) {
      Notify.failure(err.message || "Failed to restock");
    } finally {
      setIsRestocking(false);
    }
  };

  // Load catalog, floors, and tables
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      const [catRes, tabRes, floorRes] = await Promise.all([
        fetch("/api/v1/restaurant/menus"),
        fetch("/api/v1/restaurant/tables?includeFloor=true"),
        fetch("/api/v1/restaurant/floors"),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.catalog && catData.catalog.length > 0) {
          setCatalog(catData.catalog);
        }
      }

      if (floorRes.ok) {
        const floorData = await floorRes.json();
        if (floorData.floors) {
          setFloors(floorData.floors);
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
      Notify.failure("Failed to load restaurant POS catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }, [queryTableId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch active orders for selected table / space
  const fetchTableOrders = useCallback(async (tableId: string) => {
    if (!tableId || orderType !== "DINE_IN") {
      setActiveOrderId("");
      setExistingRounds([]);
      setExistingOrderTotal("0.00");
      setOrderNumber("");
      return;
    }

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
        const curTable = tables.find((t) => t.id === tableId);
        setSelectedSessionId(curTable?.currentSessionId || "");
      }
    } catch (err) {
      console.error("Error loading table orders:", err);
    }
  }, [tables, orderType]);

  useEffect(() => {
    if (selectedTableId) {
      fetchTableOrders(selectedTableId);
    }
  }, [selectedTableId, fetchTableOrders]);

  // Flatten all menu sections
  const allSections = useMemo(() => {
    return catalog.flatMap((m) =>
      (m.sections || []).map((s: any) => ({
        ...s,
        parentCategory: getParentCategory(s.name),
      }))
    );
  }, [catalog]);

  // Filter sections by parent category
  const filteredSubcategories = useMemo(() => {
    if (selectedParentCategory === "ALL") return allSections;
    return allSections.filter((s) => s.parentCategory === selectedParentCategory);
  }, [allSections, selectedParentCategory]);

  // Displayed menu items based on Category, Subcategory, and Search query
  const displayedItems = useMemo(() => {
    let items = allSections.flatMap((s) =>
      (s.items || []).map((it: any) => ({
        ...it,
        sectionId: s.id,
        sectionName: s.name,
        parentCategory: s.parentCategory,
      }))
    );

    if (selectedParentCategory !== "ALL") {
      items = items.filter((it) => it.parentCategory === selectedParentCategory);
    }

    if (selectedSubcategoryId !== "ALL") {
      items = items.filter((it) => it.sectionId === selectedSubcategoryId);
    }

    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.description && it.description.toLowerCase().includes(q)) ||
        it.sectionName.toLowerCase().includes(q)
    );
  }, [allSections, selectedParentCategory, selectedSubcategoryId, searchQuery]);

  // Filtered dining spaces (by floor & space type)
  const displayedSpaces = useMemo(() => {
    let list = tables;
    if (selectedFloorId !== "ALL") {
      list = list.filter((t) => t.floorId === selectedFloorId);
    }
    if (selectedSpaceType !== "ALL") {
      list = list.filter((t) => getSpaceMeta(t.tableNumber).type === selectedSpaceType);
    }
    return list;
  }, [tables, selectedFloorId, selectedSpaceType]);

  const handleItemClick = (item: any) => {
    if (item.isOutOfStock) {
      const ingList = (item.outOfStockIngredients || []).join(", ");
      Notify.failure(
        `Cannot order ${item.name}: ${ingList || "Ingredient"} is out of stock in kitchen inventory.`
      );
      return;
    }

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
    const deliveryCents =
      orderType === "DELIVERY" && deliveryInfo.deliveryFee
        ? toCents(deliveryInfo.deliveryFee)
        : 0;

    return {
      draftSubtotalStr: fromCents(subtotalCents),
      draftTaxStr: fromCents(taxCents),
      draftTotalWithTaxStr: fromCents(subtotalCents + taxCents + deliveryCents),
    };
  }, [draftLines, orderType, deliveryInfo.deliveryFee]);

  const allExistingLines = useMemo(() => {
    return existingRounds.flatMap((r) => r.lines);
  }, [existingRounds]);

  const handleSubmitRound = async () => {
    if (draftLines.length === 0) return;

    if (orderType === "DELIVERY" && (!deliveryInfo.customerName || !deliveryInfo.phone || !deliveryInfo.address)) {
      Notify.failure("Please provide Customer Name, Phone, and Delivery Address.");
      return;
    }

    try {
      setIsSubmitting(true);

      const targetTable = tables.find((t) => t.id === selectedTableId);
      let sessionId = selectedSessionId || targetTable?.currentSessionId || "";
      if (orderType === "DINE_IN" && selectedTableId && !sessionId) {
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
        deliveryInfo: orderType === "DELIVERY" ? deliveryInfo : undefined,
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
      Notify.success(
        `Round #${orderData.round?.roundNumber || existingRounds.length + 1} dispatched to Kitchen KDS`
      );
    } catch (err: any) {
      Notify.failure(err.message || "Error sending order to kitchen");
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
      Notify.failure("Failed to fetch active hotel stays");
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
      Notify.success(`Order #${orderNumber} charged to Hotel Room Folio`);
    } catch (err: any) {
      Notify.failure(err.message || "Failed to charge room");
    } finally {
      setChargingToRoom(false);
    }
  };

  const handleClearCurrentTable = async () => {
    if (!selectedTableId) return;
    try {
      const target = tables.find((t) => t.id === selectedTableId);
      if (target?.currentSessionId) {
        await fetch(`/api/v1/restaurant/sessions/${target.currentSessionId}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true, notes: "Cleared manually from POS" }),
        });
      }
      await fetch(`/api/v1/restaurant/tables/${selectedTableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "AVAILABLE" }),
      });
      Notify.success(`Table ${target?.tableNumber || ""} cleared and marked Free`);
      setDraftLines([]);
      setOrderNotes("");
      await Promise.all([loadInitialData(), fetchTableOrders(selectedTableId)]);
    } catch (e: any) {
      Notify.failure(e.message || "Failed to clear table");
    }
  };

  const openSettlement = async () => {
    setSettleTenderAmount(parseFloat(existingOrderTotal) || 0);
    setSettlePaymentMethod("CASH");
    setSettleReference("");
    setSettleClearTable(true);
    setIsSettlementModalOpen(true);
    try {
      const res = await fetch("/api/v1/hotel/stays?status=ACTIVE");
      if (res.ok) {
        const data = await res.json();
        setActiveStays(data.stays || []);
      }
    } catch {}
  };

  const handleSettleOrder = async () => {
    if (!activeOrderId) return;
    try {
      if (draftLines.length > 0) {
        throw new Error("Send or clear the draft round before taking payment");
      }
      if (settlePaymentMethod === "ROOM_CHARGE" && !selectedStayId) {
        throw new Error("Select a guest room to charge");
      }
      setIsSettlingOrder(true);

      if (settlePaymentMethod === "ROOM_CHARGE") {
        const folRes = await fetch(`/api/v1/hotel/folios?stayId=${selectedStayId}`);
        const folData = await folRes.json();
        let folioId = folData.folios?.[0]?.id;
        if (!folioId) {
          const createFol = await fetch("/api/v1/hotel/folios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stayId: selectedStayId, windowName: "PRIMARY" }),
          });
          folioId = (await createFol.json()).folio?.id;
        }
        const postRes = await fetch(`/api/v1/hotel/folios/${folioId}/charge-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: activeOrderId, stayId: selectedStayId }),
        });
        if (!postRes.ok) {
          const pj = await postRes.json().catch(() => ({}));
          throw new Error(pj.error || "Failed to post order to room folio");
        }
      }

      const totalDue = parseFloat(existingOrderTotal) || 0;
      const tender =
        settlePaymentMethod === "CASH" && settleTenderAmount > 0
          ? Math.min(settleTenderAmount, totalDue)
          : totalDue;

      const res = await fetch(`/api/v1/restaurant/orders/${activeOrderId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: settlePaymentMethod,
          paidAmount: tender,
          paymentReference: settleReference || undefined,
          clearTable: settleClearTable,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to settle order");
      }

      const data = await res.json();
      Notify.success(data.message || "Order settled and table released");
      setIsSettlementModalOpen(false);
      setDraftLines([]);
      setOrderNotes("");
      setSettleReference("");
      await Promise.all([loadInitialData(), fetchTableOrders(selectedTableId)]);
    } catch (e: any) {
      Notify.failure(e.message || "Error settling order");
    } finally {
      setIsSettlingOrder(false);
    }
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedSpaceMeta = selectedTable ? getSpaceMeta(selectedTable.tableNumber) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#F7F3EC] text-[#292320]">
      {/* Top Bar: Navigation, Service Mode & Floor/Space Selectors */}
      <header className="border-b border-[#D8CEC1] bg-[#FFFCF7] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Back to Floor Plan */}
          <Link
            href="/dashboard/restaurant/tables"
            className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            title="Return to dining floor plan"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="hidden sm:inline">Floor Plan</span>
          </Link>

          {/* Service Mode Segmented Control (Dine-In, Takeaway, Bar, Delivery) */}
          <div className="inline-flex rounded-md border border-[#D8CEC1] bg-[#EEE7DD] p-0.5 shrink-0">
            {(
              [
                { id: "DINE_IN", label: "Dine-In", icon: Users },
                { id: "TAKEAWAY", label: "Takeaway", icon: ShoppingCartIcon },
                { id: "BAR_WALK_IN", label: "Bar", icon: Wine },
                { id: "DELIVERY", label: "Delivery", icon: Truck },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setOrderType(mode.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                    orderType === mode.id
                      ? "bg-[#6B2837] text-white shadow-xs"
                      : "text-[#71675E] hover:text-[#292320]"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dine-In Floor & Space Filters */}
          {orderType === "DINE_IN" && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-[#D8CEC1]">
              {/* Floor Filter Dropdown */}
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className="h-8 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Floors ({tables.length})</option>
                {floors.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    {fl.name}
                  </option>
                ))}
              </select>

              {/* Space Category Filter (Table, Cabin, VIP Room, Hall) */}
              <div className="hidden md:inline-flex rounded-md border border-[#D8CEC1] bg-[#EEE7DD] p-0.5">
                {(
                  [
                    { id: "ALL", label: "All" },
                    { id: "TABLE", label: "Tables" },
                    { id: "CABIN", label: "Cabins" },
                    { id: "VIP_ROOM", label: "VIP Rooms" },
                    { id: "HALL", label: "Halls" },
                  ] as const
                ).map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelectedSpaceType(sp.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      selectedSpaceType === sp.id
                        ? "bg-[#FFFCF7] text-[#292320] shadow-xs"
                        : "text-[#71675E] hover:text-[#292320]"
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>

              {/* Space Selector Horizontal Pills */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-xs md:max-w-md pb-0.5">
                {displayedSpaces.map((t) => {
                  const isSelected = t.id === selectedTableId;
                  const isOccupied = t.status === "OCCUPIED";
                  const meta = getSpaceMeta(t.tableNumber);
                  const Icon = meta.icon;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTableId(t.id)}
                      title={`${meta.label} ${t.tableNumber} (${t.capacity} covers) · ${isOccupied ? "Occupied" : "Available"}`}
                      className={`h-8 px-2.5 rounded-md text-xs font-semibold border transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
                          : isOccupied
                          ? "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5] hover:bg-[#FEECEC]"
                          : "bg-[#EAF5EE] text-[#16A34A] border-[#D1EAD8] hover:bg-[#E0F2E6]"
                      }`}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="font-mono tabular-nums">{t.tableNumber}</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-white" : isOccupied ? "bg-[#DC2626]" : "bg-[#16A34A]"
                        }`}
                      />
                      <span className="text-[10px] hidden lg:inline opacity-75 font-mono tabular-nums">
                        {t.capacity}p
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowStockDrawer(true);
              fetchCurrentStock();
            }}
            className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Inspect raw ingredients stock & 86'd levels"
          >
            <Package className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="hidden lg:inline">Raw Stock</span>
          </button>

          <Link
            href="/dashboard/restaurant/kds"
            className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5"
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-[#71675E]" />
            <span className="hidden md:inline">Kitchen KDS</span>
          </Link>

          {orderNumber && (
            <>
              <button
                type="button"
                onClick={openChargeToRoomDialog}
                className="h-8 px-2.5 rounded-md border border-[#FDE68A] bg-[#FEF3C7] hover:bg-[#FDE68A]/70 text-xs font-semibold text-[#92400E] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Room Charge</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSplitBillOpen(true)}
                className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] transition-colors cursor-pointer"
              >
                Split Bill
              </button>
              <button
                type="button"
                onClick={openSettlement}
                className="h-8 px-3 rounded-md bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Pay &amp; Settle</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Hierarchical Menu Catalog */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Level 1: Main Category Switcher Bar */}
          <div className="px-3.5 py-1.5 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E] mr-1 hidden sm:inline">
                Category:
              </span>
              {(
                [
                  { id: "ALL", label: "All Items", icon: UtensilsCrossed },
                  { id: "FOOD", label: "Kitchen Food", icon: Flame },
                  { id: "BEVERAGE", label: "Artisan Beverages", icon: Coffee },
                  { id: "DESSERT", label: "Bakery & Desserts", icon: Cake },
                  { id: "BAR", label: "Bar & Drinks", icon: Wine },
                ] as const
              ).map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedParentCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedParentCategory(cat.id);
                      setSelectedSubcategoryId("ALL");
                    }}
                    className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
                        : "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search Bar */}
            <div className="relative w-40 sm:w-56 shrink-0">
              <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food or code..."
                className="h-7 w-full pl-8 pr-7 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Level 2: Subcategory Pills Bar */}
          <div className="px-3.5 py-1.5 border-b border-[#D8CEC1] bg-[#EEE7DD]/40 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedSubcategoryId("ALL")}
              className={`h-7 px-2.5 rounded text-[11px] font-semibold transition-colors border cursor-pointer shrink-0 ${
                selectedSubcategoryId === "ALL"
                  ? "bg-[#292320] text-white border-[#292320] shadow-xs"
                  : "bg-[#FFFCF7] text-[#71675E] border-[#D8CEC1] hover:bg-[#EEE7DD]"
              }`}
            >
              All Subcategories ({displayedItems.length})
            </button>
            {filteredSubcategories.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSubcategoryId(sec.id)}
                className={`h-7 px-2.5 rounded text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer shrink-0 ${
                  sec.id === selectedSubcategoryId
                    ? "bg-[#292320] text-white border-[#292320] shadow-xs"
                    : "bg-[#FFFCF7] text-[#71675E] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                }`}
              >
                {sec.name} ({sec.items?.length || 0})
              </button>
            ))}
          </div>

          {/* Level 3: Menu Items Visual Grid */}
          <div className="flex-1 overflow-y-auto p-3.5">
            {loadingCatalog ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-2 animate-pulse"
                  >
                    <div className="h-28 w-full rounded-md bg-[#EEE7DD]" />
                    <div className="h-4 w-3/4 rounded bg-[#EEE7DD]" />
                    <div className="h-3 w-1/2 rounded bg-[#EEE7DD]" />
                  </div>
                ))}
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <UtensilsCrossed className="h-8 w-8 text-[#71675E] stroke-1" />
                <p className="text-xs font-semibold text-[#292320] mt-2">No menu items match selection</p>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  Try another category or clear your search term.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayedItems.map((item: any) => {
                  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;
                  const inDraftQty = draftLines
                    .filter((l) => l.item.id === item.id)
                    .reduce((sum, l) => sum + l.quantity, 0);

                  const isOutOfStock = Boolean(item.isOutOfStock || !item.isAvailable);
                  const missingIngredients = (item.outOfStockIngredients || []).join(", ");

                  return (
                    <div
                      key={item.id}
                      onClick={() => !isOutOfStock && handleItemClick(item)}
                      className={`rounded-lg border bg-[#FFFCF7] p-2.5 flex flex-col justify-between transition-all shadow-xs relative overflow-hidden ${
                        isOutOfStock
                          ? "border-[#FBD5D5] bg-[#FDF2F2]/40 opacity-75 cursor-not-allowed"
                          : inDraftQty > 0
                          ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 cursor-pointer"
                          : "border-[#D8CEC1] hover:border-[#6B2837]/60 cursor-pointer"
                      }`}
                    >
                      {/* Image Thumbnail with Overlay Badges */}
                      <div className="relative w-full h-28 rounded-md overflow-hidden bg-[#EEE7DD] flex items-center justify-center shrink-0 border border-[#D8CEC1]/50">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[#71675E]">
                            <UtensilsCrossed className="h-6 w-6 stroke-1" />
                            <span className="text-[10px] font-semibold mt-1 uppercase tracking-wider">
                              {item.sectionName}
                            </span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-[2px]">
                            {item.sectionName}
                          </span>
                          {inDraftQty > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#6B2837] text-white text-[10px] font-bold font-mono tabular-nums shadow-xs">
                              {inDraftQty}x
                            </span>
                          )}
                        </div>

                        {/* Out of stock banner */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-[#292320]/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white">
                            <span className="px-2 py-0.5 rounded-full bg-[#DC2626] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="h-3 w-3" />
                              Out of Stock (86'd)
                            </span>
                            {missingIngredients && (
                              <span className="text-[10px] font-medium text-amber-200 mt-1 line-clamp-1">
                                {missingIngredients} depleted
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="mt-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-[#292320] line-clamp-1">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-[11px] text-[#71675E] line-clamp-1 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-[#D8CEC1]/60 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-[#292320]">
                              {formatNPR(item.basePrice)}
                            </span>
                            {item.prepTimeMinutes && (
                              <div className="flex items-center gap-1 text-[10px] text-[#71675E] font-medium">
                                <Clock className="h-2.5 w-2.5" />
                                <span className="font-mono tabular-nums">{item.prepTimeMinutes}m</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {hasModifiers && !isOutOfStock && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveItemForModal(item);
                                }}
                                className="h-7 px-2 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] transition-colors cursor-pointer"
                              >
                                Options
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              className={`h-7 w-7 rounded flex items-center justify-center transition-colors shadow-xs ${
                                isOutOfStock
                                  ? "bg-[#D8CEC1] text-[#71675E] cursor-not-allowed"
                                  : "bg-[#6B2837] hover:bg-[#541E2A] text-white cursor-pointer"
                              }`}
                              aria-label={`Add ${item.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Order Ticket & Rounds (Width: 380px) */}
        <div className="w-88 lg:w-96 flex flex-col bg-[#FFFCF7] border-l border-[#D8CEC1] overflow-hidden shrink-0">
          {/* Ticket Header */}
          <div className="p-3 border-b border-[#D8CEC1] bg-[#EEE7DD]/40 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#292320]">
                  {orderType === "DINE_IN"
                    ? `${selectedSpaceMeta?.label || "Table"} ${selectedTable?.tableNumber || "-"}`
                    : orderType === "TAKEAWAY"
                    ? "Takeaway Order"
                    : orderType === "DELIVERY"
                    ? "Home Delivery"
                    : "Bar Counter"}
                </span>

                {orderType === "DINE_IN" && selectedSpaceMeta && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedSpaceMeta.badge}`}>
                    {selectedSpaceMeta.label}
                  </span>
                )}

                {orderType === "DELIVERY" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Delivery
                  </span>
                )}

                {existingRounds.length > 0 && (
                  <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.2 rounded border bg-[#FFFCF7] text-[#71675E] border-[#D8CEC1]">
                    {existingRounds.length} sent
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71675E] mt-0.5 font-mono tabular-nums">
                {orderNumber ? `Order #${orderNumber}` : "Draft ticket"}
              </p>
            </div>

            {existingRounds.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#71675E] block">
                  Running Total
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-[#6B2837]">
                  {formatNPR(existingOrderTotal)}
                </span>
              </div>
            )}
          </div>

          {/* Delivery Details Card (Shown when Delivery mode is active) */}
          {orderType === "DELIVERY" && (
            <div className="p-2.5 bg-[#FEF3C7]/40 border-b border-[#FDE68A] space-y-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#92400E] flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Delivery Customer Details
                </span>
                <span className="text-[10px] font-bold font-mono text-[#92400E]">
                  Fee: {formatNPR(deliveryInfo.deliveryFee)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={deliveryInfo.customerName}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, customerName: e.target.value })}
                  placeholder="Customer Name *"
                  className="h-7 px-2 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
                <input
                  type="tel"
                  value={deliveryInfo.phone}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                  placeholder="Contact Phone *"
                  className="h-7 px-2 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <input
                type="text"
                value={deliveryInfo.address}
                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                placeholder="Delivery Address (Street, Ward, Landmark) *"
                className="w-full h-7 px-2 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={deliveryInfo.riderName}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, riderName: e.target.value })}
                  placeholder="Rider/Driver Name"
                  className="h-7 px-2 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
                <input
                  type="number"
                  value={deliveryInfo.deliveryFee}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, deliveryFee: e.target.value })}
                  placeholder="Delivery Fee"
                  className="h-7 px-2 text-xs rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Ticket Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {/* Current Draft Round (N+1) */}
            <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-1.5">
                <span className="text-xs font-bold text-[#292320]">
                  Round #{existingRounds.length + 1} (Draft)
                </span>
                {draftLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftLines([])}
                    className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                  >
                    Clear draft
                  </button>
                )}
              </div>

              {draftLines.length === 0 ? (
                <div className="py-5 text-center text-xs text-[#71675E]">
                  Select items from the menu to build Round #{existingRounds.length + 1}.
                </div>
              ) : (
                <div className="space-y-2">
                  {draftLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] space-y-1 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#292320] flex-1">
                          {line.item.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(idx, -1)}
                            className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#292320] cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold font-mono tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(idx, 1)}
                            className="h-6 w-6 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#292320] cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs font-bold font-mono tabular-nums text-[#292320] w-18 text-right">
                          {formatNPR(line.totalPrice)}
                        </span>
                      </div>

                      {line.selectedModifiers.length > 0 && (
                        <p className="text-[11px] text-[#71675E]">
                          + {line.selectedModifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="text-[11px] text-[#D97706]">Note: {line.notes}</p>
                      )}
                      {line.item.isOutOfStock && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FCA5A5] px-2 py-0.5 rounded mt-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>86'd Out of Stock: {(line.item.outOfStockIngredients || []).join(", ") || "Raw ingredients unavailable"}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Kitchen special note..."
                    className="w-full px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              )}
            </div>

            {/* Dispatched Kitchen Rounds */}
            {existingRounds.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71675E] block">
                  Dispatched Kitchen Rounds
                </span>

                {existingRounds.map((round) => (
                  <div
                    key={round.roundNumber}
                    className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-2.5 space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-[#292320] border-b border-[#D8CEC1]/60 pb-1">
                      <span>Round #{round.roundNumber}</span>
                      <span className="px-2 py-0.2 rounded-full bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8] text-[10px] font-semibold">
                        Sent to Kitchen
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {round.lines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between text-xs text-[#292320]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold font-mono tabular-nums text-[#6B2837]">
                              {line.quantity}x
                            </span>
                            <span className="truncate">{line.itemName}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EEE7DD] text-[#71675E] font-medium">
                              {line.fulfillmentStatus}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-semibold shrink-0">
                            {formatNPR(line.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ticket Footer / Action Bar */}
          <div className="p-3.5 border-t border-[#D8CEC1] bg-[#EEE7DD]/40 space-y-2 shrink-0">
            {draftLines.length > 0 && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#71675E]">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatNPR(draftSubtotalStr)}</span>
                </div>
                <div className="flex justify-between text-[#71675E]">
                  <span>VAT (13%)</span>
                  <span className="font-mono tabular-nums">{formatNPR(draftTaxStr)}</span>
                </div>
                {orderType === "DELIVERY" && (
                  <div className="flex justify-between text-[#71675E]">
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">{formatNPR(deliveryInfo.deliveryFee || "0")}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#292320] pt-1 border-t border-[#D8CEC1]">
                  <span>Round #{existingRounds.length + 1} Total</span>
                  <span className="font-mono tabular-nums text-[#6B2837]">
                    {formatNPR(draftTotalWithTaxStr)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={draftLines.length === 0 || isSubmitting}
              onClick={handleSubmitRound}
              className={`w-full h-10 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs ${
                draftLines.length > 0 && !isSubmitting
                  ? "bg-[#6B2837] hover:bg-[#541E2A] text-white cursor-pointer"
                  : "bg-[#D8CEC1] text-[#71675E] cursor-not-allowed"
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>
                {isSubmitting
                  ? "Sending to Kitchen..."
                  : `Send Round #${existingRounds.length + 1} to Kitchen`}
              </span>
            </button>

            {activeOrderId && (
              <button
                type="button"
                onClick={openSettlement}
                className="w-full h-10 rounded-lg text-xs font-bold bg-[#16A34A] hover:bg-[#15803D] text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Proceed to Payment</span>
                <span className="font-mono tabular-nums">({formatNPR(existingOrderTotal)})</span>
              </button>
            )}

            {!activeOrderId && orderType === "DINE_IN" && selectedTable?.status === "OCCUPIED" && (
              <button
                type="button"
                onClick={handleClearCurrentTable}
                className="w-full h-8 rounded-lg text-xs font-semibold border border-[#FBD5D5] bg-[#FFFCF7] hover:bg-[#FDF2F2] text-[#DC2626] transition-colors cursor-pointer"
              >
                Clear Space (no order placed)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settle Order & Release Space Modal */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#292320]">
                    Settle Order &amp; Release Space
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F2] text-[#DC2626] border border-[#FBD5D5]">
                    {selectedSpaceMeta?.label || "Space"} {selectedTable?.tableNumber || "Order"}
                  </span>
                </div>
                <p className="text-xs text-[#71675E] font-mono tabular-nums mt-0.5">
                  Order #{orderNumber} · {existingRounds.length} round(s) dispatched
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bill Summary Banner */}
            <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-[#71675E]">
                <span>All Dispatched Items ({allExistingLines.length})</span>
                <span className="font-mono tabular-nums">{formatNPR(existingOrderTotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[#292320] pt-1.5 border-t border-[#D8CEC1]">
                <span>Total Amount Due</span>
                <span className="font-mono tabular-nums text-base text-[#6B2837]">
                  {formatNPR(existingOrderTotal)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#71675E] block">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "CASH", label: "Cash", icon: Banknote },
                  { id: "FONE_PAY", label: "Fonepay / QR", icon: QrCode },
                  { id: "CARD", label: "Card", icon: CreditCard },
                  { id: "ROOM_CHARGE", label: "Room Charge", icon: Receipt },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isAct = settlePaymentMethod === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSettlePaymentMethod(mode.id as any)}
                      className={`h-14 rounded-lg border text-center transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        isAct
                          ? "bg-[#6B2837] text-white border-[#6B2837] shadow-xs"
                          : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-[10px] font-semibold leading-tight">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tender Details & Presets */}
            {settlePaymentMethod === "CASH" && (
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#292320]">Amount Tendered</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={settleTenderAmount || ""}
                    onChange={(e) => setSettleTenderAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter cash received"
                    className="w-32 px-2.5 py-1 rounded-md border border-[#D8CEC1] text-right font-mono tabular-nums text-xs font-bold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>

                {/* Quick Cash Presets */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#D8CEC1]/60">
                  <span className="text-[10px] font-semibold text-[#71675E]">Quick:</span>
                  {[
                    parseFloat(existingOrderTotal),
                    Math.ceil(parseFloat(existingOrderTotal) / 100) * 100,
                    Math.ceil(parseFloat(existingOrderTotal) / 500) * 500,
                    Math.ceil(parseFloat(existingOrderTotal) / 1000) * 1000,
                  ]
                    .filter((v, i, a) => !isNaN(v) && v > 0 && a.indexOf(v) === i)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSettleTenderAmount(val)}
                        className="px-2 py-0.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[10px] font-mono tabular-nums font-semibold text-[#292320] cursor-pointer"
                      >
                        {formatNPR(val.toString())}
                      </button>
                    ))}
                </div>

                {settleTenderAmount >= parseFloat(existingOrderTotal) && (
                  <div className="flex justify-between items-center text-xs font-bold text-[#16A34A] pt-1.5 border-t border-[#D8CEC1]/60">
                    <span>Change Due to Return:</span>
                    <span className="font-mono tabular-nums text-sm">
                      {formatNPR((settleTenderAmount - parseFloat(existingOrderTotal)).toFixed(2))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* QR / Fonepay Reference */}
            {settlePaymentMethod === "FONE_PAY" && (
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-1.5">
                <p className="text-xs text-[#71675E]">
                  Customer scans merchant QR code via mobile banking or Fonepay app.
                </p>
                <input
                  type="text"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="Fonepay Trace ID / Reference (optional)..."
                  className="w-full px-2.5 py-1.5 rounded-md border border-[#D8CEC1] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>
            )}

            {/* Card Reference */}
            {settlePaymentMethod === "CARD" && (
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-1.5">
                <input
                  type="text"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  placeholder="POS Terminal Approval / Auth Code..."
                  className="w-full px-2.5 py-1.5 rounded-md border border-[#D8CEC1] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>
            )}

            {/* Room Charge Selector */}
            {settlePaymentMethod === "ROOM_CHARGE" && (
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-1.5">
                <label className="text-xs font-bold text-[#71675E] block">
                  Select Hotel Guest Folio
                </label>
                <select
                  value={selectedStayId}
                  onChange={(e) => setSelectedStayId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Choose Hotel Guest Room --</option>
                  {activeStays.map((s) => (
                    <option key={s.id} value={s.id}>
                      Room {s.room?.roomNumber} · {s.guest?.name || s.guestName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Release Space Checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] cursor-pointer">
              <input
                type="checkbox"
                checked={settleClearTable}
                onChange={(e) => setSettleClearTable(e.target.checked)}
                className="h-4 w-4 accent-[#6B2837] rounded"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-[#292320] block leading-none">
                  Release dining space back to Available
                </span>
                <span className="text-[11px] text-[#71675E] leading-tight block mt-0.5">
                  Marks space Free and resets status for incoming parties.
                </span>
              </div>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="h-10 px-4 rounded-lg text-xs font-semibold text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSettlingOrder}
                onClick={handleSettleOrder}
                className="h-10 px-5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isSettlingOrder
                    ? "Settling..."
                    : settleClearTable
                    ? "Confirm Payment & Release Space"
                    : "Confirm Payment Only"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifiers Modal */}
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
          Notify.success(`Split settlement recorded (${splits.length} shares). Releasing space...`);
          fetch(`/api/v1/restaurant/orders/${activeOrderId}/settle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentMethod: "CASH",
              paidAmount: parseFloat(existingOrderTotal),
              notes: `Split among ${splits.length} guests`,
              clearTable: true,
            }),
          }).then(() => {
            Promise.all([loadInitialData(), fetchTableOrders(selectedTableId)]);
            setIsSplitBillOpen(false);
          });
        }}
      />

      {/* Charge to Room Folio Modal */}
      {showChargeRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Charge Order to Room Folio</h3>
                <p className="text-xs text-[#71675E] font-mono tabular-nums mt-0.5">
                  Order #{orderNumber} · {formatNPR(existingOrderTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChargeRoomModal(false)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#292320] block">
                Checked-In Guest Room
              </label>
              {activeStays.length === 0 ? (
                <div className="p-3 rounded-lg border border-[#FBD5D5] bg-[#FDF2F2] text-xs text-[#DC2626]">
                  No active checked-in hotel stays found.
                </div>
              ) : (
                <select
                  value={selectedStayId}
                  onChange={(e) => setSelectedStayId(e.target.value)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-2.5 text-xs font-medium text-[#292320] focus:outline-none focus:border-[#6B2837]"
                >
                  {activeStays.map((s) => (
                    <option key={s.id} value={s.id}>
                      Room {s.room?.roomNumber || "N/A"} · {s.guestName} ({s.stayNumber})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setShowChargeRoomModal(false)}
                className="h-10 px-4 rounded-lg text-xs font-semibold text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStayId || chargingToRoom}
                onClick={handleChargeOrderToRoom}
                className="h-10 px-5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {chargingToRoom ? "Posting..." : "Post to Folio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Ingredients Stock Inspector Drawer (Phase 3) */}
      {showStockDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8CEC1] bg-[#F7F3EC]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#6B2837]/10 flex items-center justify-center text-[#6B2837]">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Kitchen Raw Inventory &amp; 86&apos;d Levels</h3>
                  <p className="text-[11px] text-[#71675E]">Real-time ingredient levels powering menu recipes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStockDrawer(false)}
                className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingStock ? (
                <div className="space-y-2 py-8 text-center text-xs text-[#71675E]">
                  <div className="h-4 w-48 mx-auto rounded bg-[#EEE7DD] animate-pulse" />
                  <p>Loading authoritative inventory ledger...</p>
                </div>
              ) : stockItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#71675E]">
                  No raw inventory products registered yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {stockItems.map((prod: any) => {
                    const totalQty = (prod.productStocks || []).reduce(
                      (acc: number, s: any) => acc + Number(s.quantity),
                      0
                    );
                    const isZero = totalQty <= 0;
                    const isLow = totalQty > 0 && totalQty < 5;
                    const branchId = prod.productStocks?.[0]?.branchId || "";

                    return (
                      <div
                        key={prod.id}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                          isZero
                            ? "bg-[#FEF2F2] border-[#FCA5A5]"
                            : isLow
                            ? "bg-[#FFFBEB] border-[#FDE68A]"
                            : "bg-[#FFFCF7] border-[#D8CEC1]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#292320] truncate">{prod.name}</span>
                            <span className="text-[10px] font-mono text-[#71675E]">{prod.sku}</span>
                            {isZero ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DC2626] text-white">
                                86&apos;D / OUT OF STOCK
                              </span>
                            ) : isLow ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#D97706] text-white">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EAF5EE] text-[#237A4B]">
                                HEALTHY
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#71675E] mt-0.5">
                            Cost: {formatNPR(prod.costPrice || 0)} / {prod.unit?.name || "unit"} · Tracked in Kitchen Ledger
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span
                              className={`text-sm font-bold font-mono tabular-nums ${
                                isZero ? "text-[#DC2626]" : "text-[#292320]"
                              }`}
                            >
                              {totalQty.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-[#71675E] ml-1">{prod.unit?.name || "kg"}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRestockItem({ id: prod.id, name: prod.name, branchId });
                              setRestockQty("10");
                            }}
                            className="h-7 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Quick Restock</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Restock Sub-Modal / Form */}
              {restockItem && (
                <div className="p-4 rounded-xl border border-[#6B2837]/30 bg-[#F7F3EC] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#292320]">
                      Replenish Stock: <span className="text-[#6B2837]">{restockItem.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRestockItem(null)}
                      className="text-xs text-[#71675E] hover:text-[#292320] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={restockQty}
                        onChange={(e) => setRestockQty(e.target.value)}
                        placeholder="Quantity to add"
                        className="w-full h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:outline-none focus:border-[#6B2837]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isRestocking}
                      onClick={handleQuickRestock}
                      className="h-8 px-3 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isRestocking ? "Updating..." : "Confirm Restock"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
              <span className="text-[11px] text-[#71675E]">
                Depleting ingredients automatically locks 86&apos;d dishes on POS &amp; Mobile QR
              </span>
              <button
                type="button"
                onClick={() => setShowStockDrawer(false)}
                className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingCartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
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
