"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import {
  UtensilsCrossed,
  Clock,
  Bell,
  Receipt,
  ShieldCheck,
  Lock,
  Unlock,
  Plus,
  Minus,
  ShoppingBag,
  CheckCircle2,
  ChefHat,
  RefreshCw,
  AlertCircle,
  Star,
  BedDouble,
  Store,
  Droplets,
  KeyRound,
  X,
  ChevronRight,
  Send,
  LogOut,
} from "lucide-react";

type GuestTab = "MENU" | "TRACKER" | "SERVICES" | "BILL";

type ServiceRequestType =
  | "WAITER_CALL"
  | "WATER_REFILL"
  | "BILL_REQUEST"
  | "EXTRA_TOWELS"
  | "HOUSEKEEPING"
  | "ROOM_AMENITIES"
  | "CHECKOUT_REQUEST"
  | "OTHER";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: string | number;
  isAvailable?: boolean;
}

interface ModifierGroupLink {
  id: string;
  displayOrder?: number;
  modifierGroup: {
    id: string;
    name: string;
    displayName?: string | null;
    isRequired?: boolean;
    minSelect?: number;
    maxSelect?: number;
    options: ModifierOption[];
  };
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  basePrice: string | number;
  imageUrl?: string | null;
  prepTimeMinutes?: number | null;
  dietaryTags?: string[] | null;
  allergens?: string[] | null;
  isAvailable?: boolean;
  modifierGroups?: ModifierGroupLink[];
}

interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  items: MenuItem[];
}

interface MenuCatalog {
  id: string;
  name: string;
  description?: string | null;
  sections: MenuSection[];
}

interface QrLocationPublicData {
  id: string;
  publicCode: string;
  locationType: "ROOM" | "TABLE";
  label: string;
  requiresVerification: boolean;
  business: {
    id: string;
    name: string;
    currency?: string;
    googleReviewUrl?: string | null;
  };
  branch?: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  room?: {
    id: string;
    roomNumber: string;
    roomTypeName?: string | null;
    floorName?: string | null;
    hasActiveStay: boolean;
  } | null;
  table?: {
    id: string;
    tableNumber: string;
    capacity?: number;
    floorName?: string | null;
    hasActiveSession: boolean;
  } | null;
}

interface CartItem {
  cartKey: string;
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: ModifierOption[];
  notes: string;
  unitPriceCents: number;
}

interface GuestOrderLine {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  appliedModifiers?: { optionName: string; priceDelta?: string | number }[] | null;
  notes?: string | null;
  acceptanceStatus: string;
  fulfillmentStatus: string;
}

interface GuestOrderRound {
  id: string;
  roundNumber: number;
  status: string;
  submittedAt: string;
  lines: GuestOrderLine[];
}

interface GuestOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  acceptanceStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  trackerStage: "ORDER_RECEIVED" | "COOKING" | "ON_ITS_WAY" | "SERVED" | "REJECTED";
  subtotal: string | number;
  taxTotal: string | number;
  totalAmount: string | number;
  createdAt: string;
  rounds: GuestOrderRound[];
}

interface FolioEntryItem {
  id: string;
  entryNumber?: string;
  category?: string;
  description: string;
  amount: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
  direction?: "DEBIT" | "CREDIT" | string;
  postedAt?: string;
}

interface GuestFolioWindow {
  id: string;
  folioNumber: string;
  windowName: string;
  status: string;
  chargesTotal: string | number;
  creditsTotal: string | number;
  paymentsTotal: string | number;
  balance: string | number;
  entries: FolioEntryItem[];
}

interface GuestServiceRequestRecord {
  id: string;
  requestNumber: string;
  requestType: ServiceRequestType;
  category: string;
  priority: string;
  status: "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  requestedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

interface GuestFolioSummary {
  stayNumber: string;
  roomNumber?: string | null;
  guestDisplayName: string;
  checkInTime: string;
  expectedCheckOut: string;
  folios: GuestFolioWindow[];
  totalCharges: string | number;
  totalCredits: string | number;
  totalPayments: string | number;
  totalBalance: string | number;
  serviceRequests?: GuestServiceRequestRecord[];
}

export default function GuestQrPortalPage() {
  const params = useParams<{ publicCode: string }>();
  const publicCode = useMemo(() => {
    const raw = params?.publicCode;
    return Array.isArray(raw) ? raw[0] : raw || "";
  }, [params]);

  const storageKey = useMemo(
    () => (publicCode ? `restro_guest_token_${publicCode}` : ""),
    [publicCode]
  );

  // Public QR Location & Digital Menu state
  const [qrLocation, setQrLocation] = useState<QrLocationPublicData | null>(null);
  const [menus, setMenus] = useState<MenuCatalog[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ALL");
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<GuestTab>("MENU");

  // Guest Session & Verification state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState<string | null>(null);
  const [scopes, setScopes] = useState<string[]>([]);
  const [folioSummary, setFolioSummary] = useState<GuestFolioSummary | null>(null);
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [localServiceRequests, setLocalServiceRequests] = useState<GuestServiceRequestRecord[]>([]);

  // Verification Modal state
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [verifyLastName, setVerifyLastName] = useState<string>("");
  const [verifyPhoneLast4, setVerifyPhoneLast4] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Cart & Item Customization Modal state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedModOptionIds, setSelectedModOptionIds] = useState<string[]>([]);
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemNotes, setCustomItemNotes] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);

  // Service Requests & Cooldown Timer state
  const [serviceNote, setServiceNote] = useState<string>("");
  const [sendingRequestType, setSendingRequestType] = useState<ServiceRequestType | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Toast / Banner feedback
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [refreshingData, setRefreshingData] = useState<boolean>(false);

  const showBanner = useCallback(
    (text: string, type: "success" | "error" | "info" = "success") => {
      setToast({ text, type });
      setTimeout(() => {
        setToast((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  // Reset all private occupant state immediately on 401 / checkout / revocation
  const clearPrivateSessionState = useCallback(() => {
    if (typeof window !== "undefined" && storageKey) {
      sessionStorage.removeItem(storageKey);
    }
    setSessionToken(null);
    setGuestDisplayName(null);
    setScopes([]);
    setFolioSummary(null);
    setOrders([]);
    setLocalServiceRequests([]);
  }, [storageKey]);

  // Validate and hydrate session state from token
  const fetchGuestSessionData = useCallback(
    async (tokenToUse: string, silent = false) => {
      if (!tokenToUse) return false;
      try {
        if (!silent) setRefreshingData(true);
        const res = await fetch("/api/v1/guest/session", {
          headers: {
            "x-guest-session-token": tokenToUse,
          },
          cache: "no-store",
        });

        if (res.status === 401 || res.status === 403) {
          // Occupant checked out or session expired — wipe all private state immediately!
          clearPrivateSessionState();
          return false;
        }

        if (!res.ok) return false;

        const data = await res.json();
        setSessionToken(tokenToUse);
        const grantScopes: string[] = Array.isArray(data.grant?.scopes)
          ? data.grant.scopes
          : [];
        setScopes(grantScopes);
        setGuestDisplayName(
          data.grant?.guestDisplayName ||
            data.folioSummary?.guestDisplayName ||
            (data.qrLocation?.locationType === "TABLE" ? "Table Guest" : "Verified Guest")
        );

        if (data.folioSummary) {
          setFolioSummary(data.folioSummary);
          if (Array.isArray(data.folioSummary.serviceRequests)) {
            setLocalServiceRequests(data.folioSummary.serviceRequests);
          }
        } else {
          setFolioSummary(null);
        }

        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }

        return true;
      } catch {
        return false;
      } finally {
        if (!silent) setRefreshingData(false);
      }
    },
    [clearPrivateSessionState]
  );

  // Initial load: Resolve public QR location & check sessionStorage token
  useEffect(() => {
    if (!publicCode) return;

    let isMounted = true;
    async function initPortal() {
      try {
        setLoadingInitial(true);
        setFatalError(null);

        const qrRes = await fetch(`/api/v1/guest/qr/${encodeURIComponent(publicCode)}`, {
          cache: "no-store",
        });

        if (!qrRes.ok) {
          const errData = await qrRes.json().catch(() => ({}));
          throw new Error(
            errData.error || "This QR plaque is inactive or could not be recognized."
          );
        }

        const qrData = await qrRes.json();
        if (!isMounted) return;

        setQrLocation(qrData.qrLocation);
        const loadedMenus: MenuCatalog[] = qrData.menus || [];
        setMenus(loadedMenus);

        // Check existing session token in sessionStorage
        const savedToken =
          typeof window !== "undefined" && storageKey
            ? sessionStorage.getItem(storageKey)
            : null;

        if (savedToken) {
          await fetchGuestSessionData(savedToken, true);
        } else {
          clearPrivateSessionState();
        }
      } catch (err: any) {
        if (isMounted) {
          setFatalError(err.message || "Unable to load Guest Self-Service Portal.");
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    }

    initPortal();
    return () => {
      isMounted = false;
    };
  }, [publicCode, storageKey, fetchGuestSessionData, clearPrivateSessionState]);

  // Cooldown countdown tick every 1 second
  useEffect(() => {
    const hasActiveCooldown = Object.values(cooldowns).some((sec) => sec > 0);
    if (!hasActiveCooldown) return;

    const timer = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) next[k] = v - 1;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldowns]);

  // Background poll when on TRACKER or BILL or SERVICES tab with an active session
  useEffect(() => {
    if (!sessionToken) return;
    if (activeTab !== "TRACKER" && activeTab !== "BILL" && activeTab !== "SERVICES") return;

    const interval = setInterval(() => {
      fetchGuestSessionData(sessionToken, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [sessionToken, activeTab, fetchGuestSessionData]);

  const isRoomQr = qrLocation?.locationType === "ROOM";
  const isVerified = Boolean(sessionToken);

  // Flatten all sections across active menus
  const allSections = useMemo(() => {
    const list: MenuSection[] = [];
    for (const m of menus) {
      for (const s of m.sections || []) {
        if (s.items && s.items.length > 0) {
          list.push(s);
        }
      }
    }
    return list;
  }, [menus]);

  const visibleSections = useMemo(() => {
    if (selectedSectionId === "ALL") return allSections;
    return allSections.filter((s) => s.id === selectedSectionId);
  }, [allSections, selectedSectionId]);

  // Cart totals
  const cartSummary = useMemo(() => {
    let count = 0;
    let subtotalCents = 0;
    for (const line of cart) {
      count += line.quantity;
      subtotalCents += line.unitPriceCents * line.quantity;
    }
    return {
      count,
      subtotal: fromCents(subtotalCents),
    };
  }, [cart]);

  // Enroll / Verify Guest Session
  const handleVerifyRoomGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicCode) return;

    if (!verifyLastName.trim() && !verifyPhoneLast4.trim()) {
      setVerifyError("Please enter your Last Name or the last 4 digits of your phone number.");
      return;
    }

    try {
      setVerifying(true);
      setVerifyError(null);

      const res = await fetch("/api/v1/guest/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicCode,
          guestLastName: verifyLastName.trim() || undefined,
          guestPhoneLast4: verifyPhoneLast4.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not verify guest details. Please check your registered last name or phone digits."
        );
      }

      const token = data.sessionToken;
      if (token && typeof window !== "undefined" && storageKey) {
        sessionStorage.setItem(storageKey, token);
      }

      setShowVerifyModal(false);
      setVerifyLastName("");
      setVerifyPhoneLast4("");
      await fetchGuestSessionData(token, false);
      showBanner(
        `Welcome, ${data.session?.guestDisplayName || "Verified Guest"}! Room services & bill view unlocked.`,
        "success"
      );
    } catch (err: any) {
      setVerifyError(err.message || "Guest verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  // Automatically enroll Table QR session if not yet enrolled
  const ensureTableSessionToken = useCallback(async (): Promise<string | null> => {
    if (sessionToken) return sessionToken;
    if (!publicCode || isRoomQr) return null;

    try {
      setVerifying(true);
      const res = await fetch("/api/v1/guest/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Unable to start table ordering session.");
      }

      const token = data.sessionToken;
      if (token && typeof window !== "undefined" && storageKey) {
        sessionStorage.setItem(storageKey, token);
      }
      await fetchGuestSessionData(token, true);
      return token;
    } catch (err: any) {
      showBanner(err.message || "Could not start table session", "error");
      return null;
    } finally {
      setVerifying(false);
    }
  }, [sessionToken, publicCode, isRoomQr, storageKey, fetchGuestSessionData, showBanner]);

  // Open item modal or quick-add if no modifier groups
  const handleSelectMenuItem = (item: MenuItem) => {
    const hasModifiers =
      Array.isArray(item.modifierGroups) &&
      item.modifierGroups.some(
        (mg) => mg.modifierGroup?.options && mg.modifierGroup.options.length > 0
      );

    if (hasModifiers) {
      setCustomizingItem(item);
      setSelectedModOptionIds([]);
      setCustomItemQty(1);
      setCustomItemNotes("");
    } else {
      addItemToCart(item, 1, [], "");
    }
  };

  const addItemToCart = (
    item: MenuItem,
    quantity: number,
    selectedOptions: ModifierOption[],
    notes: string
  ) => {
    const baseCents = toCents(item.basePrice);
    const modCents = selectedOptions.reduce((acc, opt) => acc + toCents(opt.priceDelta), 0);
    const unitPriceCents = baseCents + modCents;
    const optionKey = selectedOptions
      .map((o) => o.id)
      .sort()
      .join(",");
    const cartKey = `${item.id}::${optionKey}::${notes.trim().toLowerCase()}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.cartKey === cartKey);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartKey,
          menuItem: item,
          quantity,
          selectedOptions,
          notes: notes.trim(),
          unitPriceCents,
        },
      ];
    });

    setCustomizingItem(null);
    showBanner(`Added ${quantity}× ${item.name} to your tray`, "info");
  };

  const handleConfirmCustomItem = () => {
    if (!customizingItem) return;
    const allOptions: ModifierOption[] = [];
    for (const link of customizingItem.modifierGroups || []) {
      for (const opt of link.modifierGroup?.options || []) {
        if (selectedModOptionIds.includes(opt.id)) {
          allOptions.push(opt);
        }
      }
    }
    addItemToCart(customizingItem, customItemQty, allOptions, customItemNotes);
  };

  const updateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.cartKey === cartKey ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  // Submit Guest Order
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    let activeToken = sessionToken;
    if (!activeToken) {
      if (isRoomQr) {
        setIsCartOpen(false);
        setShowVerifyModal(true);
        return;
      } else {
        activeToken = await ensureTableSessionToken();
        if (!activeToken) return;
      }
    }

    try {
      setSubmittingOrder(true);
      const payload = {
        sessionToken: activeToken,
        notes: orderNotes.trim() || undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          selectedOptionIds: c.selectedOptions.map((o) => o.id),
          notes: c.notes || undefined,
        })),
      };

      const res = await fetch("/api/v1/guest/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-session-token": activeToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        clearPrivateSessionState();
        setIsCartOpen(false);
        if (isRoomQr) setShowVerifyModal(true);
        throw new Error(
          data.error || "Your guest session has expired. Please verify your room again."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit order.");
      }

      setCart([]);
      setOrderNotes("");
      setIsCartOpen(false);
      await fetchGuestSessionData(activeToken, true);
      setActiveTab("TRACKER");
      showBanner(
        isRoomQr
          ? "Room service order received! Track live kitchen preparation below."
          : "Order sent to your waiter/cashier terminal for instant confirmation!",
        "success"
      );
    } catch (err: any) {
      showBanner(err.message || "Unable to place order", "error");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Trigger One-Tap Service Request / Waiter Call
  const handleTriggerServiceRequest = async (
    requestType: ServiceRequestType,
    customNotes?: string
  ) => {
    const roomOnlyTypes: ServiceRequestType[] = [
      "EXTRA_TOWELS",
      "HOUSEKEEPING",
      "ROOM_AMENITIES",
      "CHECKOUT_REQUEST",
    ];

    if (isRoomQr && !sessionToken) {
      setShowVerifyModal(true);
      return;
    }

    if (roomOnlyTypes.includes(requestType) && !isRoomQr) {
      showBanner("This service is exclusively for in-house hotel rooms.", "error");
      return;
    }

    if ((cooldowns[requestType] || 0) > 0) {
      showBanner(
        `Please wait ${cooldowns[requestType]}s before repeating this request.`,
        "info"
      );
      return;
    }

    let activeToken = sessionToken;
    if (!activeToken && !isRoomQr) {
      // Table QR can either enroll or pass publicCode directly
      activeToken = await ensureTableSessionToken();
    }

    try {
      setSendingRequestType(requestType);
      const idempotencyKey = `${publicCode}-${requestType}-${Math.floor(Date.now() / 15000)}`;

      const res = await fetch("/api/v1/guest/service-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeToken ? { "x-guest-session-token": activeToken } : {}),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          sessionToken: activeToken || undefined,
          publicCode,
          requestType,
          notes: (customNotes ?? serviceNote).trim() || undefined,
          priority: requestType === "CHECKOUT_REQUEST" ? "HIGH" : "NORMAL",
          idempotencyKey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429 || data.code === "RATE_LIMIT_EXCEEDED") {
        // Parse seconds from message or default to 180s (3 minutes)
        const match = String(data.error || "").match(/(\d+)\s*seconds/i);
        const waitSec = match ? Math.min(180, Math.max(10, Number(match[1]))) : 180;
        setCooldowns((prev) => ({ ...prev, [requestType]: waitSec }));
        showBanner(
          data.error ||
            `Request throttled (1 call per 3 minutes). Please wait ${waitSec}s.`,
          "info"
        );
        return;
      }

      if (res.status === 401 || res.status === 403) {
        clearPrivateSessionState();
        if (isRoomQr) setShowVerifyModal(true);
        throw new Error(data.error || "Please verify your room stay to request services.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Could not send service request.");
      }

      if (data.serviceRequest) {
        setLocalServiceRequests((prev) => {
          const exists = prev.some((r) => r.id === data.serviceRequest.id);
          if (exists) return prev;
          return [data.serviceRequest, ...prev];
        });
      }

      setServiceNote("");
      // Set 3-minute (180s) cooldown on this request type per Phase 7 spec
      setCooldowns((prev) => ({ ...prev, [requestType]: 180 }));

      if (activeToken) {
        await fetchGuestSessionData(activeToken, true);
      }

      showBanner(
        requestType === "CHECKOUT_REQUEST"
          ? "Express Checkout requested! Front desk is preparing your final invoice."
          : requestType === "WAITER_CALL"
          ? "Waiter notified! A team member is headed to your location."
          : "Service request dispatched to our hospitality team!",
        "success"
      );
    } catch (err: any) {
      showBanner(err.message || "Failed to send service request", "error");
    } finally {
      setSendingRequestType(null);
    }
  };

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] text-[#1A1614]">
        <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#F7F3EC] border-x border-[#D8CEC1]">
          <div className="bg-[#1A1614] px-4 py-4 border-b border-[#D8CEC1]">
            <div className="h-3 w-28 rounded-sm bg-[#2E2723] animate-pulse mb-2" />
            <div className="h-5 w-48 rounded-sm bg-[#2E2723] animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            <div className="h-14 w-full rounded-lg bg-[#EFE9DF] border border-[#D8CEC1] animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-md bg-[#EFE9DF] animate-pulse" />
              <div className="h-8 w-24 rounded-md bg-[#EFE9DF] animate-pulse" />
              <div className="h-8 w-24 rounded-md bg-[#EFE9DF] animate-pulse" />
            </div>
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-[#FFFCF7] border border-[#D8CEC1] space-y-2"
              >
                <div className="h-4 w-40 rounded-sm bg-[#EFE9DF] animate-pulse" />
                <div className="h-3 w-full rounded-sm bg-[#EFE9DF] animate-pulse" />
                <div className="h-4 w-20 rounded-sm bg-[#EFE9DF] animate-pulse mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fatalError || !qrLocation) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] flex flex-col items-center justify-center p-6 text-center text-[#1A1614]">
        <div className="max-w-sm bg-[#FFFCF7] rounded-lg p-6 border border-[#D8CEC1]">
          <AlertCircle className="w-10 h-10 text-[#B42318] mx-auto mb-3" />
          <h1 className="text-lg font-bold text-[#1A1614]">QR Plaque Unavailable</h1>
          <p className="text-sm text-[#57504A] mt-2">
            {fatalError || "This QR location could not be found or has been rotated by staff."}
          </p>
          <p className="text-xs text-[#857B72] mt-4">
            Code: <span className="font-mono">{publicCode}</span>
          </p>
        </div>
      </div>
    );
  }

  const locationBadgeText = isRoomQr
    ? `Room ${qrLocation.room?.roomNumber || qrLocation.label}`
    : `Table ${qrLocation.table?.tableNumber || qrLocation.label}`;

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#1A1614]">
      <div className="max-w-md mx-auto min-h-screen flex flex-col border-x border-[#D8CEC1] bg-[#F7F3EC] relative pb-24">
        {/* Sticky Top Hospitality Header */}
        <header className="sticky top-0 z-30 bg-[#1A1614] text-[#F7F3EC] px-4 py-3.5 border-b border-[#A77B38]/40">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold truncate">
                  {qrLocation.branch?.name || "Hospitality Portal"}
                </span>
              </div>
              <h1 className="text-base font-bold tracking-tight text-[#FFFCF7] truncate">
                {qrLocation.business.name}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {qrLocation.business.googleReviewUrl && (
                <a
                  href={qrLocation.business.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#A77B38]/20 text-[#F3E5AB] border border-[#A77B38]/40 hover:bg-[#A77B38]/30 transition"
                >
                  <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                  Review
                </a>
              )}

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#6B2837] text-white border border-[#A77B38]/40 shadow-sm">
                {isRoomQr ? (
                  <BedDouble className="w-3.5 h-3.5 text-[#F3E5AB]" />
                ) : (
                  <Store className="w-3.5 h-3.5 text-[#F3E5AB]" />
                )}
                {locationBadgeText}
              </span>
            </div>
          </div>

          {/* Sub-bar: Verification / Session Privacy Status */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            {isRoomQr ? (
              isVerified ? (
                <div className="flex items-center justify-between w-full">
                  <span className="inline-flex items-center gap-1.5 text-[#E2F1E8] font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Verified Stay: <strong className="text-white">{guestDisplayName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={clearPrivateSessionState}
                    className="inline-flex items-center gap-1 text-[11px] text-[#D6CEC2] hover:text-white underline"
                  >
                    <LogOut className="w-3 h-3" /> Lock
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[#E6DEC8]">
                    <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Browse menu freely or verify stay for room service & bill
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="px-2.5 py-1 rounded-md bg-[#A77B38] text-white font-semibold text-[11px] shrink-0 hover:bg-[#8E672D] transition"
                  >
                    Unlock Room
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-[#D6CEC2] text-[11px]">
                  {isVerified
                    ? `Active Dining Session • ${guestDisplayName}`
                    : "Scan-to-Order • Direct Waiter & Kitchen Link"}
                </span>
                {!isVerified && (
                  <button
                    type="button"
                    onClick={() => ensureTableSessionToken()}
                    disabled={verifying}
                    className="px-2.5 py-0.5 rounded bg-[#A77B38] text-white font-semibold text-[11px]"
                  >
                    {verifying ? "Starting..." : "Start Table Ordering"}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Floating Toast Notification */}
        {toast && (
          <div className="mx-4 mt-3 p-3 rounded-xl shadow-md border text-xs font-medium flex items-center justify-between gap-2 bg-white border-[#A77B38]/40 text-[#1E1B18]">
            <div className="flex items-center gap-2">
              {toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-[#9E2A2B] shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#8C827A] hover:text-[#1E1B18]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 px-4 pt-4 pb-8 space-y-4">
          {/* =========================================================
              TAB 1: DIGITAL MENU & ORDERING (MENU)
             ========================================================= */}
          {activeTab === "MENU" && (
            <div className="space-y-4">
              {/* Room Unlock Banner for unverified Room QR visitors */}
              {isRoomQr && !isVerified && (
                <div className="rounded-lg bg-[#6B2837] text-[#FFFCF7] p-4 border border-[#A77B38]/40 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#F3E5AB] font-semibold">
                      In-Room Dining & Concierge
                    </p>
                    <p className="text-sm font-bold mt-0.5">
                      Unlock Room Services & Live Folio Bill
                    </p>
                    <p className="text-[11px] text-[#FFFCF7]/80 mt-0.5">
                      Verify with your Last Name or Phone Last 4 digits.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="px-3.5 py-2 rounded-md bg-[#FFFCF7] text-[#6B2837] font-bold text-xs shrink-0 hover:bg-[#F7F3EC] transition"
                  >
                    Verify Stay
                  </button>
                </div>
              )}

              {/* Table QR workflow notice */}
              {!isRoomQr && (
                <div className="rounded-xl bg-[#F5EFE6] border border-[#E2D9C8] px-3.5 py-2.5 flex items-start gap-2.5">
                  <UtensilsCrossed className="w-4 h-4 text-[#6B2837] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#4A433E] leading-relaxed">
                    Orders are sent to your waiter/cashier terminal for instant confirmation before
                    kitchen preparation.
                  </p>
                </div>
              )}

              {/* Quick 1-Tap Waiter Call Strip */}
              <div className="bg-white rounded-xl p-3 border border-[#E6DEC8] shadow-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1E1B18]">Need immediate assistance?</p>
                    <p className="text-[11px] text-[#6E655F]">
                      {(cooldowns["WAITER_CALL"] || 0) > 0
                        ? `Waiter notified • Cooldown ${formatCooldown(cooldowns["WAITER_CALL"])}`
                        : "Summon a server or room attendant in one tap"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    sendingRequestType === "WAITER_CALL" || (cooldowns["WAITER_CALL"] || 0) > 0
                  }
                  onClick={() => handleTriggerServiceRequest("WAITER_CALL")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6B2837] text-white disabled:opacity-50 hover:bg-[#561F2B] transition shrink-0"
                >
                  {(cooldowns["WAITER_CALL"] || 0) > 0
                    ? formatCooldown(cooldowns["WAITER_CALL"])
                    : sendingRequestType === "WAITER_CALL"
                    ? "Calling..."
                    : "Call Waiter"}
                </button>
              </div>

              {/* Section / Category Filter Pills */}
              {allSections.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedSectionId("ALL")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                      selectedSectionId === "ALL"
                        ? "bg-[#6B2837] text-white shadow-sm"
                        : "bg-white text-[#4A433E] border border-[#E2D9C8] hover:bg-[#F5EFE6]"
                    }`}
                  >
                    All Courses
                  </button>
                  {allSections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                        selectedSectionId === sec.id
                          ? "bg-[#6B2837] text-white shadow-sm"
                          : "bg-white text-[#4A433E] border border-[#E2D9C8] hover:bg-[#F5EFE6]"
                      }`}
                    >
                      {sec.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Menu Sections & High-Contrast Porcelain Item Cards */}
              {visibleSections.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-[#E6DEC8]">
                  <UtensilsCrossed className="w-8 h-8 text-[#A77B38] mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#1E1B18]">Menu Currently Updating</p>
                  <p className="text-xs text-[#6E655F] mt-1">
                    Please tap &ldquo;Call Waiter&rdquo; above for today&apos;s chef specials.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleSections.map((section) => (
                    <section key={section.id} className="space-y-3">
                      <div className="border-b border-[#E2D9C8] pb-1.5">
                        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#6B2837]">
                          {section.name}
                        </h2>
                        {section.description && (
                          <p className="text-xs text-[#6E655F] mt-0.5">{section.description}</p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {section.items.map((item) => {
                          const tags = Array.isArray(item.dietaryTags) ? item.dietaryTags : [];
                          const hasMods =
                            Array.isArray(item.modifierGroups) &&
                            item.modifierGroups.some(
                              (mg) =>
                                mg.modifierGroup?.options && mg.modifierGroup.options.length > 0
                            );

                          return (
                            <div
                              key={item.id}
                              className="bg-white rounded-2xl p-3.5 border border-[#E6DEC8] shadow-sm flex items-start justify-between gap-3 hover:border-[#A77B38] transition"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="text-sm font-bold text-[#1E1B18]">{item.name}</h3>
                                  {tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-[#EFE9DF] text-[#6B2837] border border-[#D8CEC1]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                {item.description && (
                                  <p className="text-xs text-[#6E655F] mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 mt-2.5">
                                  <span className="text-sm font-extrabold text-[#6B2837]">
                                    {formatNPR(item.basePrice)}
                                  </span>
                                  {item.prepTimeMinutes && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6E655F]">
                                      <Clock className="w-3 h-3 text-[#A77B38]" />
                                      {item.prepTimeMinutes}m prep
                                    </span>
                                  )}
                                  {hasMods && (
                                    <span className="text-[10px] font-semibold text-[#A77B38] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#E6DEC8]">
                                      Customizable
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSelectMenuItem(item)}
                                className="px-3 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#6B2837] text-[#6B2837] hover:text-white border border-[#6B2837]/30 font-bold text-xs inline-flex items-center gap-1 transition shrink-0 self-center"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 2: LIVE ORDER TRACKER (TRACKER)
             ========================================================= */}
          {activeTab === "TRACKER" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#1E1B18]">
                    Live Kitchen Order Tracker
                  </h2>
                  <p className="text-xs text-[#6E655F]">
                    Real-time status from waiter confirmation to your {isRoomQr ? "room" : "table"}
                  </p>
                </div>
                {sessionToken && (
                  <button
                    type="button"
                    onClick={() => fetchGuestSessionData(sessionToken, false)}
                    disabled={refreshingData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E2D9C8] text-xs font-bold text-[#6B2837] shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                )}
              </div>

              {!isVerified ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-[#E6DEC8] space-y-3">
                  <Lock className="w-8 h-8 text-[#A77B38] mx-auto" />
                  <h3 className="text-sm font-bold text-[#1E1B18]">
                    {isRoomQr ? "Verify Your Room Stay to Track Orders" : "No Active Table Orders Yet"}
                  </h3>
                  <p className="text-xs text-[#6E655F]">
                    {isRoomQr
                      ? "For guest privacy, room order history is protected behind stay verification."
                      : "Place an item from the Digital Menu to begin tracking your meal."}
                  </p>
                  {isRoomQr ? (
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="px-4 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold"
                    >
                      Verify Room Stay
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("MENU")}
                      className="px-4 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold"
                    >
                      Browse Menu
                    </button>
                  )}
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-[#E6DEC8] space-y-3">
                  <ChefHat className="w-9 h-9 text-[#A77B38] mx-auto" />
                  <h3 className="text-sm font-bold text-[#1E1B18]">No Orders Placed Yet</h3>
                  <p className="text-xs text-[#6E655F]">
                    Your freshly prepared dishes will appear here with live kitchen progress.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("MENU")}
                    className="px-4 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold"
                  >
                    Explore Digital Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const stage = order.trackerStage || "ORDER_RECEIVED";
                    const stepIndex =
                      stage === "SERVED" || stage === "ON_ITS_WAY"
                        ? 3
                        : stage === "COOKING"
                        ? 2
                        : 1;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl p-4 border border-[#E6DEC8] shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-2.5">
                          <div>
                            <span className="text-xs font-extrabold text-[#6B2837]">
                              Order #{order.orderNumber}
                            </span>
                            <p className="text-[11px] text-[#6E655F]">
                              Placed {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              stage === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : stage === "SERVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : stage === "ON_ITS_WAY"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-[#F5EFE6] text-[#6B2837]"
                            }`}
                          >
                            {stage === "ORDER_RECEIVED"
                              ? "Order Received"
                              : stage === "COOKING"
                              ? "Cooking in Kitchen"
                              : stage === "ON_ITS_WAY"
                              ? "Ready / On Its Way"
                              : stage === "SERVED"
                              ? "Served"
                              : "Cancelled"}
                          </span>
                        </div>

                        {/* 3-Step Visual Progress Bar */}
                        {stage !== "REJECTED" && (
                          <div className="pt-1 pb-2">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              {/* Step 1 */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    stepIndex >= 1
                                      ? "bg-[#6B2837] text-white"
                                      : "bg-[#F0EAE0] text-[#8C827A]"
                                  }`}
                                >
                                  1
                                </div>
                                <span className="text-[11px] font-bold mt-1 text-[#1E1B18]">
                                  Order Received
                                </span>
                                <span className="text-[10px] text-[#6E655F]">
                                  {order.acceptanceStatus === "OPEN"
                                    ? "Awaiting Waiter"
                                    : "Confirmed"}
                                </span>
                              </div>

                              {/* Step 2 */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    stepIndex >= 2
                                      ? "bg-[#A77B38] text-white"
                                      : "bg-[#F0EAE0] text-[#8C827A]"
                                  }`}
                                >
                                  2
                                </div>
                                <span className="text-[11px] font-bold mt-1 text-[#1E1B18]">
                                  Cooking
                                </span>
                                <span className="text-[10px] text-[#6E655F]">Kitchen Station</span>
                              </div>

                              {/* Step 3 */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    stepIndex >= 3
                                      ? "bg-emerald-700 text-white"
                                      : "bg-[#F0EAE0] text-[#8C827A]"
                                  }`}
                                >
                                  3
                                </div>
                                <span className="text-[11px] font-bold mt-1 text-[#1E1B18]">
                                  {stage === "SERVED" ? "Served" : "On Its Way"}
                                </span>
                                <span className="text-[10px] text-[#6E655F]">
                                  {isRoomQr ? "Room Delivery" : "Table Service"}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2.5 h-1.5 w-full bg-[#F0EAE0] rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-[#6B2837] transition-all duration-300"
                                style={{
                                  width:
                                    stepIndex === 1 ? "33%" : stepIndex === 2 ? "66%" : "100%",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Order Rounds & Items */}
                        <div className="space-y-2 pt-1">
                          {(order.rounds || []).map((round) => (
                            <div
                              key={round.id}
                              className="bg-[#FAF6F0] rounded-xl p-2.5 border border-[#E6DEC8] space-y-1.5"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E655F]">
                                Round #{round.roundNumber}
                              </div>
                              {round.lines.map((line) => (
                                <div
                                  key={line.id}
                                  className="flex items-start justify-between text-xs gap-2"
                                >
                                  <div>
                                    <span className="font-bold text-[#1E1B18]">
                                      {line.quantity}× {line.itemName}
                                    </span>
                                    {Array.isArray(line.appliedModifiers) &&
                                      line.appliedModifiers.length > 0 && (
                                        <p className="text-[11px] text-[#6E655F]">
                                          +{" "}
                                          {line.appliedModifiers
                                            .map((m) => m.optionName)
                                            .join(", ")}
                                        </p>
                                      )}
                                  </div>
                                  <span className="font-semibold text-[#1E1B18] shrink-0">
                                    {formatNPR(line.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#F0EAE0] text-xs">
                          <span className="font-semibold text-[#6E655F]">Order Total (incl. tax)</span>
                          <span className="text-sm font-extrabold text-[#6B2837]">
                            {formatNPR(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 3: SERVICE REQUESTS & WAITER CALL (SERVICES)
             ========================================================= */}
          {activeTab === "SERVICES" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#1E1B18]">
                  Concierge & Service Requests
                </h2>
                <p className="text-xs text-[#6E655F]">
                  One-tap requests routed directly to our staff console (rate-limited to 1 call per
                  3 mins)
                </p>
              </div>

              {isRoomQr && !isVerified && (
                <div className="bg-white rounded-2xl p-4 border border-[#A77B38] shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#6B2837]">
                      Room Verification Required
                    </p>
                    <p className="text-[11px] text-[#6E655F]">
                      Unlock housekeeping, extra towels, and express checkout for {locationBadgeText}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="px-3 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold shrink-0"
                  >
                    Verify Room
                  </button>
                </div>
              )}

              {/* Optional Custom Note */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#E6DEC8] shadow-sm">
                <label className="block text-xs font-bold text-[#1E1B18] mb-1.5">
                  Optional Note for Staff
                </label>
                <input
                  type="text"
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  placeholder="e.g., Extra ice, 2 bath towels, baby chair..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-xs text-[#1E1B18] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              {/* Dining & Waiter Requests (Available to both Table & Room) */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6B2837]">
                  Dining & Attendant Assistance
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {(
                    [
                      {
                        type: "WAITER_CALL" as ServiceRequestType,
                        title: "Call Waiter / Attendant",
                        desc: "Summon a server to your location",
                        icon: Bell,
                      },
                      {
                        type: "WATER_REFILL" as ServiceRequestType,
                        title: "Water Refill / Beverages",
                        desc: "Request fresh drinking water at your table or room",
                        icon: Droplets,
                      },
                      {
                        type: "BILL_REQUEST" as ServiceRequestType,
                        title: "Request Physical Bill",
                        desc: "Ask staff to bring your printed check",
                        icon: Receipt,
                      },
                    ] as const
                  ).map((card) => {
                    const Icon = card.icon;
                    const cd = cooldowns[card.type] || 0;
                    const busy = sendingRequestType === card.type;

                    return (
                      <button
                        key={card.type}
                        type="button"
                        disabled={busy || cd > 0}
                        onClick={() => handleTriggerServiceRequest(card.type)}
                        className="w-full text-left bg-white rounded-2xl p-3.5 border border-[#E6DEC8] hover:border-[#6B2837] shadow-sm flex items-center justify-between gap-3 disabled:opacity-60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1E1B18]">{card.title}</p>
                            <p className="text-xs text-[#6E655F]">{card.desc}</p>
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF6F0] text-[#6B2837] border border-[#E2D9C8] shrink-0">
                          {cd > 0 ? `Wait ${formatCooldown(cd)}` : busy ? "Sending..." : "Request"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hotel Room Exclusive Services */}
              {isRoomQr && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6B2837]">
                    In-Room Housekeeping & Front Desk
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        {
                          type: "EXTRA_TOWELS" as ServiceRequestType,
                          title: "Extra Towels & Linens",
                          desc: "Fresh bath towels, pillows, or blankets",
                          icon: BedDouble,
                        },
                        {
                          type: "HOUSEKEEPING" as ServiceRequestType,
                          title: "Make Up Room / Housekeeping",
                          desc: "Schedule room cleaning or turndown service",
                          icon: BedDouble,
                        },
                        {
                          type: "ROOM_AMENITIES" as ServiceRequestType,
                          title: "Toiletries & Room Amenities",
                          desc: "Dental kit, slippers, coffee/tea replenishment",
                          icon: Star,
                        },
                        {
                          type: "CHECKOUT_REQUEST" as ServiceRequestType,
                          title: "Express Checkout Request",
                          desc: "Alert Front Desk to prepare your final invoice & luggage help",
                          icon: KeyRound,
                        },
                      ] as const
                    ).map((card) => {
                      const Icon = card.icon;
                      const cd = cooldowns[card.type] || 0;
                      const busy = sendingRequestType === card.type;

                      return (
                        <button
                          key={card.type}
                          type="button"
                          disabled={busy || cd > 0}
                          onClick={() => handleTriggerServiceRequest(card.type)}
                          className="w-full text-left bg-white rounded-2xl p-3.5 border border-[#E6DEC8] hover:border-[#6B2837] shadow-sm flex items-center justify-between gap-3 disabled:opacity-60 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#A77B38]">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#1E1B18]">{card.title}</p>
                              <p className="text-xs text-[#6E655F]">{card.desc}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#6B2837] text-white shrink-0">
                            {cd > 0
                              ? `Wait ${formatCooldown(cd)}`
                              : busy
                              ? "Sending..."
                              : isVerified
                              ? "Dispatch"
                              : "Unlock"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Service Requests Status List */}
              {localServiceRequests.length > 0 && (
                <div className="space-y-2 pt-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6E655F]">
                    Your Recent Service Requests
                  </h3>
                  <div className="space-y-2">
                    {localServiceRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white rounded-xl p-3 border border-[#E6DEC8] flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#1E1B18]">
                            {req.requestType.replace(/_/g, " ")}
                          </span>
                          {req.notes && (
                            <p className="text-[11px] text-[#6E655F] mt-0.5">&ldquo;{req.notes}&rdquo;</p>
                          )}
                          <p className="text-[10px] text-[#8C827A] mt-0.5">
                            #{req.requestNumber}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            req.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : req.status === "IN_PROGRESS" || req.status === "ACKNOWLEDGED"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-[#F5EFE6] text-[#6B2837]"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 4: ROOM BILL & FOLIO REVIEW (BILL - Room QR only)
             ========================================================= */}
          {activeTab === "BILL" && isRoomQr && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#1E1B18]">
                    Live Room Folio & Bill Review
                  </h2>
                  <p className="text-xs text-[#6E655F]">
                    Real-time itemized charges & payments for {locationBadgeText}
                  </p>
                </div>
                {isVerified && sessionToken && (
                  <button
                    type="button"
                    onClick={() => fetchGuestSessionData(sessionToken, false)}
                    disabled={refreshingData}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#E2D9C8] text-xs font-bold text-[#6B2837]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                )}
              </div>

              {!isVerified || !folioSummary ? (
                <div className="bg-white rounded-2xl p-5 border border-[#E6DEC8] shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E1B18]">
                        Guest Privacy Verification
                      </h3>
                      <p className="text-xs text-[#6E655F]">
                        Verify your stay to view your itemized room folio.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyRoomGuest} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                        Registered Guest Last Name
                      </label>
                      <input
                        type="text"
                        value={verifyLastName}
                        onChange={(e) => setVerifyLastName(e.target.value)}
                        placeholder="e.g. Thapa"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                        Last 4 Digits of Registered Phone
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={verifyPhoneLast4}
                        onChange={(e) => setVerifyPhoneLast4(e.target.value)}
                        placeholder="e.g. 4321"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-sm"
                      />
                    </div>
                    {verifyError && (
                      <p className="text-xs text-[#9E2A2B] font-medium">{verifyError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={verifying}
                      className="w-full py-2.5 rounded-xl bg-[#6B2837] text-white font-bold text-xs shadow hover:bg-[#561F2B] transition"
                    >
                      {verifying ? "Verifying Stay..." : "Unlock My Room Bill"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stay Summary Header Card */}
                  <div className="bg-[#1A1614] text-[#FFFCF7] rounded-lg p-4 space-y-3 border border-[#A77B38]/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">
                          Stay #{folioSummary.stayNumber}
                        </span>
                        <h3 className="text-base font-bold text-white">
                          {folioSummary.guestDisplayName}
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#6B2837] text-white">
                        Room {folioSummary.roomNumber || qrLocation.room?.roomNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                      <div>
                        <p className="text-white/60 text-[10px] uppercase">Total Charges</p>
                        <p className="font-bold text-white mt-0.5">
                          {formatNPR(folioSummary.totalCharges)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/60 text-[10px] uppercase">
                          Payments & Credits
                        </p>
                        <p className="font-bold text-emerald-300 mt-0.5">
                          {formatNPR(
                            fromCents(
                              toCents(folioSummary.totalPayments) +
                                toCents(folioSummary.totalCredits)
                            )
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/15 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F3E5AB]">
                        Current Balance Due
                      </span>
                      <span className="text-lg font-extrabold text-white">
                        {formatNPR(folioSummary.totalBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Line-itemized Folios */}
                  {(folioSummary.folios || []).map((folio) => (
                    <div
                      key={folio.id}
                      className="bg-white rounded-2xl p-4 border border-[#E6DEC8] shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-2">
                        <div>
                          <span className="text-xs font-extrabold text-[#6B2837]">
                            {folio.windowName} FOLIO
                          </span>
                          <p className="text-[10px] text-[#6E655F]">#{folio.folioNumber}</p>
                        </div>
                        <span className="text-xs font-bold text-[#1E1B18]">
                          Bal: {formatNPR(folio.balance)}
                        </span>
                      </div>

                      {folio.entries.length === 0 ? (
                        <p className="text-xs text-[#6E655F] py-2">
                          No posted entries on this window yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-[#F0EAE0]">
                          {folio.entries.map((entry) => {
                            const isCredit = entry.direction === "CREDIT";
                            return (
                              <div
                                key={entry.id}
                                className="py-2 flex items-start justify-between gap-2 text-xs"
                              >
                                <div>
                                  <p className="font-semibold text-[#1E1B18]">
                                    {entry.description}
                                  </p>
                                  <p className="text-[10px] text-[#8C827A]">
                                    {entry.category || "CHARGE"} •{" "}
                                    {entry.postedAt
                                      ? new Date(entry.postedAt).toLocaleDateString()
                                      : ""}
                                  </p>
                                </div>
                                <span
                                  className={`font-bold shrink-0 ${
                                    isCredit ? "text-emerald-700" : "text-[#1E1B18]"
                                  }`}
                                >
                                  {isCredit ? "-" : ""}
                                  {formatNPR(entry.totalAmount ?? entry.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Express Checkout Request CTA (Creates ServiceRequest, never silently checks out) */}
                  <div className="bg-[#F5EFE6] rounded-2xl p-4 border border-[#E2D9C8] space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <KeyRound className="w-5 h-5 text-[#6B2837] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1E1B18]">
                          Ready for Express Checkout?
                        </h4>
                        <p className="text-[11px] text-[#6E655F]">
                          Notify Front Desk to prepare your final tax invoice and assist with
                          luggage before you head downstairs.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={
                        sendingRequestType === "CHECKOUT_REQUEST" ||
                        (cooldowns["CHECKOUT_REQUEST"] || 0) > 0
                      }
                      onClick={() => handleTriggerServiceRequest("CHECKOUT_REQUEST")}
                      className="w-full py-2.5 rounded-xl bg-[#6B2837] text-white font-bold text-xs shadow hover:bg-[#561F2B] disabled:opacity-50 transition"
                    >
                      {(cooldowns["CHECKOUT_REQUEST"] || 0) > 0
                        ? `Express Checkout Requested (${formatCooldown(
                            cooldowns["CHECKOUT_REQUEST"]
                          )})`
                        : sendingRequestType === "CHECKOUT_REQUEST"
                        ? "Notifying Front Desk..."
                        : "Request Express Checkout"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legal & Privacy Footer */}
          <footer className="pt-6 pb-4 border-t border-[#D8CEC1] text-center space-y-1.5 text-[11px] text-[#857B72]">
            <p className="font-medium text-[#57504A]">
              {qrLocation.business.name} • Secure Guest Self-Service Portal
            </p>
            <div className="flex items-center justify-center gap-3">
              <a href="/terms" className="hover:text-[#1A1614] underline">
                Terms of Service
              </a>
              <span>•</span>
              <a href="/privacy" className="hover:text-[#1A1614] underline">
                Privacy Policy
              </a>
              <span>•</span>
              <span>Room & Table Data Protected</span>
            </div>
          </footer>
        </main>

        {/* Floating Cart Bar (when items in cart on MENU tab) */}
        {cartSummary.count > 0 && (
          <div className="fixed bottom-16 left-0 right-0 z-30 max-w-md mx-auto px-4">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-[#6B2837] text-white shadow-xl border border-[#A77B38]/50 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-white text-[#6B2837] font-extrabold text-xs flex items-center justify-center">
                  {cartSummary.count}
                </span>
                <span className="text-xs font-bold">View Order Tray</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-extrabold">
                <span>{formatNPR(cartSummary.subtotal)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Sticky Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto bg-white border-t border-[#E6DEC8] shadow-lg px-2 py-1.5">
          <div
            className={`grid ${isRoomQr ? "grid-cols-4" : "grid-cols-3"} gap-1`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("MENU")}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
                activeTab === "MENU"
                  ? "text-[#6B2837] bg-[#FAF6F0]"
                  : "text-[#6E655F] hover:text-[#1E1B18]"
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 mb-0.5" />
              Menu
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("TRACKER")}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition relative ${
                activeTab === "TRACKER"
                  ? "text-[#6B2837] bg-[#FAF6F0]"
                  : "text-[#6E655F] hover:text-[#1E1B18]"
              }`}
            >
              <ChefHat className="w-4 h-4 mb-0.5" />
              Tracker
              {orders.length > 0 && (
                <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-[#A77B38]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("SERVICES")}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
                activeTab === "SERVICES"
                  ? "text-[#6B2837] bg-[#FAF6F0]"
                  : "text-[#6E655F] hover:text-[#1E1B18]"
              }`}
            >
              <Bell className="w-4 h-4 mb-0.5" />
              Services
            </button>

            {isRoomQr && (
              <button
                type="button"
                onClick={() => setActiveTab("BILL")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-bold transition ${
                  activeTab === "BILL"
                    ? "text-[#6B2837] bg-[#FAF6F0]"
                    : "text-[#6E655F] hover:text-[#1E1B18]"
                }`}
              >
                <Receipt className="w-4 h-4 mb-0.5" />
                Room Bill
              </button>
            )}
          </div>
        </nav>

        {/* =========================================================
            MODAL: ITEM MODIFIER SELECTOR
           ========================================================= */}
        {customizingItem && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-[#F0EAE0] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#1E1B18]">{customizingItem.name}</h3>
                  <p className="text-xs font-bold text-[#6B2837]">
                    Base Price: {formatNPR(customizingItem.basePrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingItem(null)}
                  className="p-1 rounded-lg text-[#6E655F] hover:text-[#1E1B18]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(customizingItem.modifierGroups || []).map((link) => {
                const group = link.modifierGroup;
                if (!group || !group.options || group.options.length === 0) return null;
                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1E1B18]">
                        {group.displayName || group.name}
                      </span>
                      <span className="text-[10px] text-[#6E655F]">Optional Add-ons</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.options.map((opt) => {
                        const checked = selectedModOptionIds.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${
                              checked
                                ? "border-[#6B2837] bg-[#FAF6F0] font-semibold"
                                : "border-[#E6DEC8] bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedModOptionIds((prev) =>
                                    prev.includes(opt.id)
                                      ? prev.filter((id) => id !== opt.id)
                                      : [...prev, opt.id]
                                  );
                                }}
                                className="accent-[#6B2837]"
                              />
                              <span>{opt.name}</span>
                            </div>
                            {toCents(opt.priceDelta) > 0 && (
                              <span className="text-[#6B2837] font-bold">
                                +{formatNPR(opt.priceDelta)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                  Special Preparation Notes
                </label>
                <input
                  type="text"
                  value={customItemNotes}
                  onChange={(e) => setCustomItemNotes(e.target.value)}
                  placeholder="e.g., Less spicy, no cilantro..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#F0EAE0]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomItemQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E2D9C8] flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold">{customItemQty}</span>
                  <button
                    type="button"
                    onClick={() => setCustomItemQty((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E2D9C8] flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmCustomItem}
                  className="px-5 py-2.5 rounded-xl bg-[#6B2837] text-white font-bold text-xs shadow"
                >
                  Add to Order Tray
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: CART DRAWER & SUBMIT ORDER
           ========================================================= */}
        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#6B2837]" />
                  <h3 className="text-base font-extrabold text-[#1E1B18]">
                    Your Order Tray ({locationBadgeText})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-[#6E655F] hover:text-[#1E1B18]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-[#6E655F] text-center py-6">Your tray is empty.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((line) => (
                      <div
                        key={line.cartKey}
                        className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1E1B18]">{line.menuItem.name}</p>
                          {line.selectedOptions.length > 0 && (
                            <p className="text-[11px] text-[#6E655F]">
                              + {line.selectedOptions.map((o) => o.name).join(", ")}
                            </p>
                          )}
                          {line.notes && (
                            <p className="text-[10px] italic text-[#8C827A]">
                              Note: {line.notes}
                            </p>
                          )}
                          <p className="text-xs font-extrabold text-[#6B2837] mt-1">
                            {formatNPR(fromCents(line.unitPriceCents * line.quantity))}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.cartKey, -1)}
                            className="w-7 h-7 rounded-lg bg-white border border-[#E2D9C8] flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.cartKey, 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-[#E2D9C8] flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                      Order / Delivery Instructions
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Allergies, cutlery requests, or delivery notes..."
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-xs"
                    />
                  </div>

                  <div className="pt-3 border-t border-[#F0EAE0] space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-[#6E655F]">Estimated Subtotal</span>
                      <span className="text-base font-extrabold text-[#6B2837]">
                        {formatNPR(cartSummary.subtotal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={submittingOrder}
                      onClick={handleSubmitOrder}
                      className="w-full py-3 rounded-xl bg-[#6B2837] text-white font-bold text-xs shadow-lg hover:bg-[#561F2B] disabled:opacity-50 flex items-center justify-center gap-2 transition"
                    >
                      <Send className="w-4 h-4" />
                      {submittingOrder
                        ? "Submitting Order..."
                        : isRoomQr && !isVerified
                        ? "Verify Room & Submit Order"
                        : "Submit Order"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: ROOM STAY VERIFICATION GATE
           ========================================================= */}
        {showVerifyModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-[#E6DEC8] space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E6DEC8] flex items-center justify-center text-[#6B2837]">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1E1B18]">
                      Verify Stay • {locationBadgeText}
                    </h3>
                    <p className="text-[11px] text-[#6E655F]">
                      Protects guest privacy across room turnovers
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="text-[#8C827A] hover:text-[#1E1B18]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleVerifyRoomGuest} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Guest Last Name (or Full Name)
                  </label>
                  <input
                    type="text"
                    value={verifyLastName}
                    onChange={(e) => setVerifyLastName(e.target.value)}
                    placeholder="e.g. Thapa"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                    Last 4 Digits of Phone Number
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={verifyPhoneLast4}
                    onChange={(e) => setVerifyPhoneLast4(e.target.value)}
                    placeholder="e.g. 4321"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E2D9C8] text-sm"
                  />
                </div>

                {verifyError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {verifyError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6E655F]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold shadow"
                  >
                    {verifying ? "Verifying..." : "Verify & Unlock"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
