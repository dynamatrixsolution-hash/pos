"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatNPR, toCents, fromCents } from "@/lib/currency";
import { DeterministicQrMatrixSvg } from "@/components/qr-matrix-svg";
import { apiClient } from "@/core/api/api-client";
import { playNotificationChime, showBrowserNotification, vibrateMobile } from "@/lib/notification-alert";
import { registerWebPushToken } from "@/lib/firebase-client";
import { GoogleReviewCard } from "@/features/guest-portal/components/GoogleReviewCard";
import { GuestProfileAndAppCard } from "@/features/guest-portal/components/GuestProfileAndAppCard";
import { InstallAppPopup } from "@/features/guest-portal/components/InstallAppPopup";
import { GuestSplashScreen } from "@/features/guest-portal/components/GuestSplashScreen";
import { GuestSettledThankYouCard } from "@/features/guest-portal/components/GuestSettledThankYouCard";
import {
  GuestOrderActionModal,
  type GuestOrderModalMode,
} from "@/features/guest-portal/components/GuestOrderActionModal";
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
  Share2,
  QrCode,
  Copy,
  Users,
  Search,
  SlidersHorizontal,
  Flame,
  Heart,
  Award,
  Info,
  Soup,
  Coffee,
  Fish,
  Drumstick,
  Pizza,
  Sandwich,
  CakeSlice,
  Truck,
  MapPin,
  Ban,
  Moon,
  Sun,
} from "lucide-react";

// Resolve a real uploaded image (menu item first, then linked product). Returns null when none.
function getItemImage(item: {
  name: string;
  imageUrl?: string | null;
  product?: { image?: string | null } | null;
}): string | null {
  const own = item.imageUrl?.trim();
  if (own) return own;
  const fromProduct = item.product?.image?.trim();
  if (fromProduct) return fromProduct;
  return null;
}

// Pick a food icon from the dish name, used when no photo is uploaded or the photo fails to load.
function getFoodIcon(name: string) {
  const n = (name || "").toLowerCase();
  if (/(momo|dumpling|soup|thukpa|broth|jhol)/.test(n)) return Soup;
  if (/(fish|trout|prawn|shrimp|seafood)/.test(n)) return Fish;
  if (/(chicken|mutton|wings|drumstick|sekuwa|choila|meat|lamb|buff)/.test(n)) return Drumstick;
  if (/(pizza)/.test(n)) return Pizza;
  if (/(burger|sandwich|wrap|roll)/.test(n)) return Sandwich;
  if (/(cake|dessert|sweet|kheer|ice cream|brownie)/.test(n)) return CakeSlice;
  if (/(tea|chai|coffee|latte|espresso|lassi|juice|drink|beverage|spritz|soda|mocktail|cocktail|beer|wine)/.test(n)) return Coffee;
  return UtensilsCrossed;
}

function FoodImage({
  item,
  className = "",
  iconClassName = "w-6 h-6",
}: {
  item: { name: string; imageUrl?: string | null; product?: { image?: string | null } | null };
  className?: string;
  iconClassName?: string;
}) {
  const src = getItemImage(item);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    const Icon = getFoodIcon(item.name);
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-[#EEE7DD] text-[#A77B38] ${className}`}
        aria-label={item.name}
      >
        <Icon className={iconClassName} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
}

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
  product?: {
    id: string;
    image?: string | null;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string } | null;
  } | null;
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
    logo?: string | null;
    currency?: string;
    googleReviewUrl?: string | null;
  };
  guestPolicy?: {
    tableQrMode: "STAFF_SEATED_OR_PIN" | "SELF_SEAT_WITH_GEOFENCE" | "OPEN_STAFF_APPROVAL";
    geofenceEnabled: boolean;
    geofenceRadiusMeters: number;
    maxGuestOrderItems: number;
    maxAutoAcceptAmount: number;
    selfCancelGraceMinutes: number;
    takeawayEnabled: boolean;
    deliveryEnabled: boolean;
    deliveryFee: number;
    requireStaffApprovalForDelivery: boolean;
    cancellationPolicyText: string;
    refundPolicyText: string;
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
    status?: "AVAILABLE" | "OCCUPIED" | "BILLED" | "RESERVED" | string;
    hasActiveSession: boolean;
    hasUnsettledBill?: boolean;
    isSettled?: boolean;
    isSettling?: boolean;
    pinRequired?: boolean;
    isBilledLocked?: boolean;
    activeOrder?: {
      orderNumber: string;
      totalAmount: string;
      settlementStatus: string;
      fulfillmentStatus: string;
      createdAt: string;
    } | null;
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
  isPendingApproval?: boolean;
  isOutForDelivery?: boolean;
  riderName?: string | null;
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

  const searchParams = useSearchParams();
  const joinParam = useMemo(() => {
    return searchParams?.get("join") || searchParams?.get("pin") || null;
  }, [searchParams]);

  const storageKey = useMemo(
    () => (publicCode ? `restro_guest_token_${publicCode}` : ""),
    [publicCode]
  );

  const grantStorageKey = useMemo(
    () => (publicCode ? `restro_guest_grant_${publicCode}` : ""),
    [publicCode]
  );

  const cartStorageKey = useMemo(
    () => (publicCode ? `restro_guest_cart_${publicCode}` : ""),
    [publicCode]
  );

  const [selectedDietary, setSelectedDietary] = useState<string>("ALL");

  const [dismissedUnsettledGate, setDismissedUnsettledGate] = useState(false);

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
  const [grantToken, setGrantToken] = useState<string | null>(null);
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

  // Table Session PIN & Companion Sharing state
  const [tablePin, setTablePin] = useState<string | null>(null);
  const [showTablePinModal, setShowTablePinModal] = useState<boolean>(false);
  const [tablePinInput, setTablePinInput] = useState<string>("");
  const [tablePinError, setTablePinError] = useState<string | null>(null);
  const [tableAlertSent, setTableAlertSent] = useState<boolean>(false);
  const [sendingTurnoverAlert, setSendingTurnoverAlert] = useState<boolean>(false);
  const [showGroupShareModal, setShowGroupShareModal] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  // Cart & Item Customization Modal state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedModOptionIds, setSelectedModOptionIds] = useState<string[]>([]);
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemNotes, setCustomItemNotes] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);

  // Multi-channel ordering (Dine-In, Takeaway, Delivery), post-settlement Thank-You & Order actions
  const initialModeParam = (searchParams?.get("mode") || "").toUpperCase();
  const initialTabParam = (searchParams?.get("tab") || "").toUpperCase();
  const [orderChannel, setOrderChannel] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">(
    initialModeParam === "DELIVERY" || initialModeParam === "TAKEAWAY"
      ? initialModeParam
      : "DINE_IN"
  );
  const channelOrderStagesRef = useRef<Record<string, string>>({});
  const isRemoteChannelMode =
    initialModeParam === "DELIVERY" || initialModeParam === "TAKEAWAY";
  const [channelPaymentPref, setChannelPaymentPref] = useState<
    "COD" | "PAY_AT_PICKUP" | "ONLINE_QR"
  >(initialModeParam === "TAKEAWAY" ? "PAY_AT_PICKUP" : "COD");
  const [channelName, setChannelName] = useState<string>("");
  const [channelPhone, setChannelPhone] = useState<string>("");
  const [channelEmail, setChannelEmail] = useState<string>("");
  const [channelAddress, setChannelAddress] = useState<string>("");
  const [channelCoords, setChannelCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [channelFieldErrors, setChannelFieldErrors] = useState<Record<string, string>>({});
  const [guestTheme, setGuestTheme] = useState<"light" | "dark">("light");
  const [sessionEndedThankYou, setSessionEndedThankYou] = useState<boolean>(false);

  const settledStorageKey = publicCode ? `restroinn_guest_settled_v1_${publicCode}` : "";
  const SETTLED_LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

  const markSessionSettled = useCallback(() => {
    setSessionEndedThankYou(true);
    if (typeof window === "undefined" || !settledStorageKey) return;
    try {
      localStorage.setItem(settledStorageKey, JSON.stringify({ settledAt: Date.now() }));
      window.history.replaceState(null, "", window.location.pathname);
    } catch {}
  }, [settledStorageKey]);

  const clearSettledMarker = useCallback(() => {
    setSessionEndedThankYou(false);
    if (typeof window === "undefined" || !settledStorageKey) return;
    try {
      localStorage.removeItem(settledStorageKey);
    } catch {}
  }, [settledStorageKey]);

  // Restore settled thank-you screen on reload OR mobile swipe-back (bfcache pageshow)
  useEffect(() => {
    if (typeof window === "undefined" || !settledStorageKey) return;
    const modeParam = (searchParams?.get("mode") || "").toUpperCase();
    if (modeParam === "DELIVERY" || modeParam === "TAKEAWAY") return;

    const checkSettledLock = () => {
      try {
        const raw = localStorage.getItem(settledStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { settledAt?: number };
        if (parsed?.settledAt && Date.now() - parsed.settledAt < SETTLED_LOCK_TTL_MS) {
          setSessionEndedThankYou(true);
        } else {
          localStorage.removeItem(settledStorageKey);
        }
      } catch {}
    };

    checkSettledLock();
    const onPageShow = () => checkSettledLock();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [settledStorageKey, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("restroinn_guest_theme_v1");
      if (saved === "dark" || saved === "light") {
        setGuestTheme(saved);
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setGuestTheme("dark");
      }
    } catch {}
  }, []);

  const toggleGuestTheme = () => {
    const next = guestTheme === "dark" ? "light" : "dark";
    setGuestTheme(next);
    try {
      localStorage.setItem("restroinn_guest_theme_v1", next);
    } catch {}
  };
  const [tableUnlockPrompt, setTableUnlockPrompt] = useState<string | null>(null);
  const [orderActionModal, setOrderActionModal] = useState<{
    mode: GuestOrderModalMode;
    order: GuestOrder;
  } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modern UI Search, Favorites & Dish Detail Modal Tabs (from sample UI)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customModalTab, setCustomModalTab] = useState<"CUSTOMIZE" | "INGREDIENTS" | "CHEF_NOTE">("CUSTOMIZE");

  // Service Requests & Cooldown Timer state
  const [serviceNote, setServiceNote] = useState<string>("");
  const [sendingRequestType, setSendingRequestType] = useState<ServiceRequestType | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Toast / Banner feedback
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [refreshingData, setRefreshingData] = useState<boolean>(false);

  // Live Guest Push / Order Status Notifications
  interface GuestNotificationItem {
    id: string;
    title: string;
    message: string;
    category: string;
    priority: string;
    metadata?: { imageUrl?: string } | null;
    createdAt: string;
  }
  const [guestNotifications, setGuestNotifications] = useState<GuestNotificationItem[]>([]);
  const [guestNotifOpen, setGuestNotifOpen] = useState<boolean>(false);
  const [showRateUsModal, setShowRateUsModal] = useState<boolean>(false);
  const [unreadGuestNotifs, setUnreadGuestNotifs] = useState<number>(0);
  const [liveStatusAlert, setLiveStatusAlert] = useState<GuestNotificationItem | null>(null);
  const seenGuestNotifIdsRef = useRef<Set<string>>(new Set());
  const guestNotifHydratedRef = useRef<boolean>(false);

  const isRoomQr = qrLocation?.locationType === "ROOM";
  const isVerified = Boolean(sessionToken);

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
    if (typeof window !== "undefined") {
      if (storageKey) sessionStorage.removeItem(storageKey);
      if (grantStorageKey) sessionStorage.removeItem(grantStorageKey);
    }
    setSessionToken(null);
    setGrantToken(null);
    setGuestDisplayName(null);
    setScopes([]);
    setFolioSummary(null);
    setOrders([]);
    setLocalServiceRequests([]);
    setTablePin(null);
    setGuestNotifications([]);
    setUnreadGuestNotifs(0);
    setLiveStatusAlert(null);
    seenGuestNotifIdsRef.current.clear();
    guestNotifHydratedRef.current = false;
  }, [storageKey, grantStorageKey]);

  // Direct Companion Share URL (embedded in screen QR code and WhatsApp share)
  const companionShareUrl = useMemo(() => {
    if (typeof window === "undefined" || !publicCode) return "";
    const base = `${window.location.origin}/guest/qr/${encodeURIComponent(publicCode)}`;
    const joinVal = grantToken || tablePin || sessionToken;
    if (!joinVal) return base;
    return `${base}?join=${encodeURIComponent(joinVal)}`;
  }, [publicCode, grantToken, tablePin, sessionToken]);

  // Validate and hydrate session state from token
  const fetchGuestSessionData = useCallback(
    async (tokenToUse: string, silent = false) => {
      if (!tokenToUse) return false;
      try {
        if (!silent) setRefreshingData(true);
        const data = await apiClient.guest.getSession(tokenToUse);

        setSessionToken(tokenToUse);
        if (data.tablePin || data.session?.tablePin) {
          setTablePin(data.tablePin || data.session?.tablePin);
        }
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
      } catch (err: any) {
        const status = err?.status || err?.statusCode;
        const code = err?.data?.code;
        if (
          status === 401 ||
          code === "GUEST_SESSION_REVOKED" ||
          code === "GUEST_TABLE_SESSION_ENDED" ||
          code === "GUEST_GRANT_REVOKED"
        ) {
          clearPrivateSessionState();
          markSessionSettled();
        }
        return false;
      } finally {
        if (!silent) setRefreshingData(false);
      }
    },
    [clearPrivateSessionState, markSessionSettled]
  );

  // Initial load: Resolve public QR location with instant Browser Caching & SWR Revalidation
  useEffect(() => {
    if (!publicCode) return;

    let isMounted = true;
    const cacheKey = `guest_qr_cache_${publicCode}`;

    // 1. Instant Cache Hydration from Browser Storage (0ms instant render)
    if (typeof window !== "undefined") {
      try {
        const rawCached = localStorage.getItem(cacheKey);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (parsed?.qrLocation && Array.isArray(parsed?.menus)) {
            setQrLocation(parsed.qrLocation);
            setMenus(parsed.menus);
            setLoadingInitial(false); // Render immediately from browser cache!
          }
        }
      } catch {}
    }

    async function initPortal() {
      try {
        setFatalError(null);

        const qrData = await apiClient.guest.getPublicQr(publicCode);
        if (!isMounted) return;

        setQrLocation(qrData.qrLocation);
        const loadedMenus: MenuCatalog[] = qrData.menus || [];
        setMenus(loadedMenus);

        // Save fresh response into browser localStorage cache
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                qrLocation: qrData.qrLocation,
                menus: loadedMenus,
                cachedAt: Date.now(),
              })
            );
          } catch {}
        }

        // Check existing session token in sessionStorage
        const savedToken =
          typeof window !== "undefined" && storageKey
            ? sessionStorage.getItem(storageKey)
            : null;

        const savedGrant =
          typeof window !== "undefined" && grantStorageKey
            ? sessionStorage.getItem(grantStorageKey)
            : null;

        if (savedGrant) {
          setGrantToken(savedGrant);
        }

        if (savedToken) {
          await fetchGuestSessionData(savedToken, true);
        } else if (joinParam) {
          // Frictionless companion join via shared companion QR or link
          try {
            const cleanJoin = joinParam.trim();
            const joinData = await apiClient.guest.verify({
              publicCode,
              joinToken: cleanJoin,
              verificationCode: cleanJoin.length === 4 ? cleanJoin : undefined,
            });

            const token = joinData.sessionToken;
            if (token && typeof window !== "undefined" && storageKey) {
              sessionStorage.setItem(storageKey, token);
            }
            if (joinData.grantToken) {
              setGrantToken(joinData.grantToken);
              if (typeof window !== "undefined" && grantStorageKey) {
                sessionStorage.setItem(grantStorageKey, joinData.grantToken);
              }
            }
            if (joinData.tablePin) {
              setTablePin(joinData.tablePin);
            }
            await fetchGuestSessionData(token, false);
            showBanner(
              `Joined Table ${qrData.qrLocation?.table?.tableNumber || ""}! You can now order together.`,
              "success"
            );
          } catch {
            clearPrivateSessionState();
          }
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
  }, [
    publicCode,
    storageKey,
    grantStorageKey,
    joinParam,
    fetchGuestSessionData,
    clearPrivateSessionState,
    showBanner,
  ]);

  // Real-time auto-poll table status when waiting for previous party's bill settlement or BILLED lock
  useEffect(() => {
    if (!publicCode || qrLocation?.locationType === "ROOM") return;
    const isBilled = Boolean(qrLocation?.table?.isBilledLocked || qrLocation?.table?.status === "BILLED");
    if (isVerified && !isBilled) return;
    if (!isVerified && qrLocation?.table?.isSettled) return;

    const interval = setInterval(async () => {
      try {
        const data = await apiClient.guest.getPublicQr(publicCode);
        if (data.qrLocation) {
          setQrLocation(data.qrLocation);
          if (data.qrLocation.table?.isSettled) {
            if (isVerified) {
              clearPrivateSessionState();
              markSessionSettled();
            } else {
              showBanner("Previous bill settled! Table is now ready for your order.", "success");
            }
          }
        }
      } catch {
        // silent poll failure
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [
    isVerified,
    publicCode,
    qrLocation?.locationType,
    qrLocation?.table?.isSettled,
    qrLocation?.table?.isBilledLocked,
    qrLocation?.table?.status,
    clearPrivateSessionState,
    showBanner,
  ]);

  // Live poll saved Delivery / Takeaway orders every 5s + notify on status transitions (Accepted / Dispatched / Cancelled)
  const fetchSavedChannelOrders = useCallback(
    async (silent = true) => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("restroinn_guest_channel_orders_v1");
        if (!raw) return;
        const refs = JSON.parse(raw);
        if (!Array.isArray(refs) || refs.length === 0) return;

        if (!silent) setRefreshingData(true);
        const res = await apiClient.guest.getChannelOrders(refs);
        const liveOrders: GuestOrder[] = Array.isArray(res?.orders) ? res.orders : [];
        if (liveOrders.length === 0) return;

        // Notify guest on every status transition (Accepted, Cooking, Out for Delivery, Delivered, Cancelled)
        for (const ord of liveOrders) {
          const statusKey = `${ord.trackerStage}|${ord.isPendingApproval ? "P" : "A"}|${ord.isOutForDelivery ? "D" : "N"}`;
          const prevKey = channelOrderStagesRef.current[ord.id];
          if (prevKey && prevKey !== statusKey) {
            let msg = "";
            if (ord.trackerStage === "REJECTED") {
              msg = `Order #${ord.orderNumber} was cancelled.`;
            } else if (ord.isOutForDelivery) {
              msg = `Order #${ord.orderNumber} is Out for Delivery${ord.riderName ? ` with ${ord.riderName}` : ""}!`;
            } else if (ord.trackerStage === "SERVED") {
              msg = `Order #${ord.orderNumber} has been delivered / completed!`;
            } else if (ord.trackerStage === "COOKING") {
              msg = `Order #${ord.orderNumber} accepted! Kitchen is preparing your food.`;
            } else if (ord.trackerStage === "ON_ITS_WAY") {
              msg = `Order #${ord.orderNumber} is ready!`;
            }
            if (msg) {
              showBanner(msg, ord.trackerStage === "REJECTED" ? "error" : "success");
              playNotificationChime();
              vibrateMobile();
            if (document.visibilityState !== "visible") {
              showBrowserNotification(`Order #${ord.orderNumber}`, msg, {
                tag: `channel-${ord.id}-${statusKey}`,
                actionUrl: "/guest",
              });
            }
            }
          }
          channelOrderStagesRef.current[ord.id] = statusKey;
        }

        setOrders((prev) => {
          const dineInOrders = prev.filter((o) => o.orderType === "DINE_IN" || o.orderType === "ROOM_SERVICE");
          const merged = [...liveOrders, ...dineInOrders];
          const seen = new Set<string>();
          return merged.filter((o) => {
            if (seen.has(o.id)) return false;
            seen.add(o.id);
            return true;
          });
        });
      } catch {
        // silent poll
      } finally {
        if (!silent) setRefreshingData(false);
      }
    },
    [showBanner]
  );

  useEffect(() => {
    if (initialTabParam === "TRACKER") {
      setActiveTab("TRACKER");
    }
    void fetchSavedChannelOrders(true);
    const interval = setInterval(() => {
      void fetchSavedChannelOrders(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [initialTabParam, fetchSavedChannelOrders]);

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

  // Live guest notification poller (works EVEN BEFORE ordering via publicCode + runs in foreground & background tabs)
  useEffect(() => {
    if (!publicCode && !sessionToken) return;
    let cancelled = false;

    const pollGuestNotifications = async () => {
      if (cancelled) return;
      try {
        const headers: Record<string, string> = {};
        if (sessionToken) headers["x-guest-session-token"] = sessionToken;
        const url = `/api/v1/guest/notifications?limit=25${publicCode ? `&publicCode=${encodeURIComponent(publicCode)}` : ""}`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list = (Array.isArray(data.notifications) ? data.notifications : []) as GuestNotificationItem[];

        if (guestNotifHydratedRef.current) {
          const fresh = list.filter((n) => !seenGuestNotifIdsRef.current.has(n.id));
          if (fresh.length > 0) {
            const latest = fresh[0];
            setLiveStatusAlert(latest);
            setUnreadGuestNotifs((prev) => prev + fresh.length);
            const isReadyOrServed = /ready|served/i.test(latest.title);
            playNotificationChime(isReadyOrServed ? "ready" : "info");
            vibrateMobile(isReadyOrServed ? [140, 60, 140] : [90]);

            const bannerImg = latest.metadata?.imageUrl;
            // Only show OS notification when tab is in background (in-app alert handles visible tab),
            // deduplicated by tag, and always navigating to /guest so old notifications never re-open a settled table.
            if (
              typeof window !== "undefined" &&
              document.visibilityState !== "visible" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              const notifTag = (latest as any).dedupeKey || latest.id;
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready
                  .then((reg) =>
                    reg.showNotification(latest.title, {
                      body: latest.message,
                      icon: "/icons/icon-192.png",
                      badge: "/icons/icon-192.png",
                      ...(bannerImg && /^https?:\/\//i.test(bannerImg) ? { image: bannerImg } : {}),
                      tag: notifTag,
                      data: { actionUrl: "/guest" },
                    } as NotificationOptions)
                  )
                  .catch(() => {
                    showBrowserNotification(latest.title, latest.message, {
                      tag: notifTag,
                      actionUrl: "/guest",
                    });
                  });
              } else {
                showBrowserNotification(latest.title, latest.message, {
                  tag: notifTag,
                  actionUrl: "/guest",
                });
              }
            }

            if (sessionToken) {
              void fetchGuestSessionData(sessionToken, true);
            }
          }
        }

        list.forEach((n) => seenGuestNotifIdsRef.current.add(n.id));
        guestNotifHydratedRef.current = true;
        setGuestNotifications(list);
      } catch {
        // silent network retry
      }
    };

    void pollGuestNotifications();
    // Auto-register FCM Web Push token for closed-app background notifications when permission is already granted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      void registerWebPushToken({ publicCode, guestSessionToken: sessionToken });
    }
    const interval = setInterval(() => {
      void pollGuestNotifications();
    }, 5000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void pollGuestNotifications();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [publicCode, sessionToken, fetchGuestSessionData]);

  // Auto-dismiss floating guest live status alert after 9 seconds
  useEffect(() => {
    if (!liveStatusAlert) return;
    const t = setTimeout(() => {
      setLiveStatusAlert((prev) => (prev?.id === liveStatusAlert.id ? null : prev));
    }, 9000);
    return () => clearTimeout(t);
  }, [liveStatusAlert]);

  // Background poll when on TRACKER or BILL or SERVICES tab with an active session
  useEffect(() => {
    if (!sessionToken) return;
    if (activeTab !== "TRACKER" && activeTab !== "BILL" && activeTab !== "SERVICES") return;

    const interval = setInterval(() => {
      fetchGuestSessionData(sessionToken, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [sessionToken, activeTab, fetchGuestSessionData]);

  // Hydrate persisted cart & notes on reload so accidental refresh never wipes guest's tray
  useEffect(() => {
    if (typeof window === "undefined" || !cartStorageKey) return;
    try {
      const raw = sessionStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.cart)) setCart(parsed.cart);
        if (typeof parsed?.orderNotes === "string") setOrderNotes(parsed.orderNotes);
      }
    } catch {
      // ignore corrupted storage
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !cartStorageKey) return;
    try {
      sessionStorage.setItem(cartStorageKey, JSON.stringify({ cart, orderNotes }));
    } catch {
      // ignore storage quota errors
    }
  }, [cartStorageKey, cart, orderNotes]);

  // Dynamic page <title> + persist last visited restaurant for installed PWA /guest launcher
  useEffect(() => {
    if (!qrLocation?.business?.name) return;
    const loc = qrLocation.locationType === "ROOM"
      ? `Room ${qrLocation.room?.roomNumber || ""}`
      : `Table ${qrLocation.table?.tableNumber || ""}`;
    document.title = `${qrLocation.business.name} — ${loc} Menu`;

    try {
      localStorage.setItem(
        "restroinn_last_guest_restaurant_v1",
        JSON.stringify({
          publicCode,
          businessName: qrLocation.business.name,
          businessLogo: qrLocation.business.logo || null,
          branchName: qrLocation.branch?.name || null,
          locationLabel: loc,
          visitedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [qrLocation, publicCode]);

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

  // Map each menuItem.id -> real Menu Section name (prevents leaking retail product category)
  const itemSectionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of allSections) {
      for (const it of sec.items) {
        if (!map.has(it.id)) map.set(it.id, sec.name);
      }
    }
    return map;
  }, [allSections]);

  // Collect unique dietary tags across menu items for quick filtering
  const availableDietaryTags = useMemo(() => {
    const set = new Set<string>();
    for (const sec of allSections) {
      for (const it of sec.items) {
        for (const tag of it.dietaryTags || []) {
          if (tag?.trim()) set.add(tag.trim());
        }
      }
    }
    return Array.from(set).slice(0, 6);
  }, [allSections]);

  const visibleSections = useMemo(() => {
    if (selectedSectionId === "ALL") return allSections;
    return allSections.filter((s) => s.id === selectedSectionId);
  }, [allSections, selectedSectionId]);

  // Filtered sections by course, dietary tag, AND real-time search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const diet = selectedDietary === "ALL" ? null : selectedDietary.toLowerCase();
    return visibleSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => {
          const matchesDiet =
            !diet ||
            (Array.isArray(it.dietaryTags) &&
              it.dietaryTags.some((t) => t.toLowerCase() === diet));
          const matchesQuery =
            !q ||
            it.name.toLowerCase().includes(q) ||
            (it.description && it.description.toLowerCase().includes(q)) ||
            (it.dietaryTags && it.dietaryTags.some((t) => t.toLowerCase().includes(q)));
          return matchesDiet && matchesQuery;
        }),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [visibleSections, searchQuery, selectedDietary]);

  // Featured Popular Picks (capped at 4 items so it never duplicates the entire menu)
  const popularItems = useMemo(() => {
    const all: MenuItem[] = [];
    for (const s of allSections) {
      for (const it of s.items) {
        if (it.isAvailable !== false && !all.some((x) => x.id === it.id)) {
          all.push(it);
        }
      }
    }
    return all.slice(0, 4);
  }, [allSections]);

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

      const data = await apiClient.guest.verify({
        publicCode,
        guestLastName: verifyLastName.trim() || undefined,
        guestPhoneLast4: verifyPhoneLast4.trim() || undefined,
      });

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

  // Verify Table PIN for companions or occupied table
  const handleVerifyTablePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!publicCode) return;
    const cleanPin = tablePinInput.trim();
    if (cleanPin.length !== 4) {
      setTablePinError("Please enter the 4-digit Dining PIN.");
      return;
    }

    try {
      setVerifying(true);
      setTablePinError(null);
      const data = await apiClient.guest.verify({
        publicCode,
        verificationCode: cleanPin,
      });

      const token = data.sessionToken;
      if (token && typeof window !== "undefined" && storageKey) {
        sessionStorage.setItem(storageKey, token);
      }
      if (data.grantToken) {
        setGrantToken(data.grantToken);
        if (typeof window !== "undefined" && grantStorageKey) {
          sessionStorage.setItem(grantStorageKey, data.grantToken);
        }
      }
      if (data.tablePin || data.session?.tablePin) {
        setTablePin(data.tablePin || data.session?.tablePin);
      }
      setShowTablePinModal(false);
      setTablePinInput("");
      await fetchGuestSessionData(token, false);
      if (cart.length > 0) {
        setIsCartOpen(true);
      }
      showBanner(
        `Verified! You have joined Table ${qrLocation?.table?.tableNumber || ""}'s dining order.`,
        "success"
      );
    } catch (err: any) {
      setTablePinError(err.message || "Failed to verify PIN");
    } finally {
      setVerifying(false);
    }
  };

  // Alert staff when a new party is seated but the previous bill is unsettled
  const handleAlertStaffTurnover = async () => {
    if (!publicCode || sendingTurnoverAlert) return;
    try {
      setSendingTurnoverAlert(true);
      await apiClient.guest.createServiceRequest({
        publicCode,
        requestType: "WAITER_CALL",
        notes: `[Table Turnover Needed] New guests seated at Table ${qrLocation?.table?.tableNumber || ""}. Previous party has left but bill is unsettled. Please settle & reset table.`,
        priority: "URGENT",
      });

      setTableAlertSent(true);
      showBanner("Staff has been alerted! A server will reset this table shortly.", "success");
    } catch (err: any) {
      showBanner(err.message || "Could not alert staff. Please call a server directly.", "error");
    } finally {
      setSendingTurnoverAlert(false);
    }
  };

  // Re-check table status (after staff clears / resets table)
  const handleRefreshTableStatus = async () => {
    if (!publicCode) return;
    try {
      setRefreshingData(true);
      const qrData = await apiClient.guest.getPublicQr(publicCode);
      setQrLocation(qrData.qrLocation);
      if (qrData.menus) setMenus(qrData.menus);
      if (qrData.qrLocation?.table?.status === "AVAILABLE") {
        showBanner("Table is now reset and available! You can place your order.", "success");
        setTableAlertSent(false);
      } else {
        showBanner("Table status checked.", "info");
      }
    } catch {
      showBanner("Could not check table status.", "error");
    } finally {
      setRefreshingData(false);
    }
  };

  // Automatically enroll Table QR session if not yet enrolled (respects anti-prank & GPS geofence rules)
  const ensureTableSessionToken = useCallback(
    async (pin?: string): Promise<string | null> => {
      if (sessionToken) return sessionToken;
      if (!publicCode || isRoomQr) return null;

      try {
        setVerifying(true);
        setTableUnlockPrompt(null);

        let lat: number | undefined;
        let lng: number | undefined;
        if (
          qrLocation?.guestPolicy?.geofenceEnabled &&
          typeof navigator !== "undefined" &&
          navigator.geolocation
        ) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 7000,
              })
            );
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch {
            // Backend will return clear GEOFENCE_REQUIRED error
          }
        }

        const data = await apiClient.guest.verify({
          publicCode,
          verificationCode: pin?.trim() || undefined,
          lat,
          lng,
        });

        const token = data.sessionToken;
        if (token && typeof window !== "undefined" && storageKey) {
          sessionStorage.setItem(storageKey, token);
        }
        if (data.grantToken) {
          setGrantToken(data.grantToken);
          if (typeof window !== "undefined" && grantStorageKey) {
            sessionStorage.setItem(grantStorageKey, data.grantToken);
          }
        }
        if (data.tablePin || data.session?.tablePin) {
          setTablePin(data.tablePin || data.session?.tablePin);
        }
        await fetchGuestSessionData(token, true);
        return token;
      } catch (err: any) {
        const code = err?.data?.code;
        if (
          code === "TABLE_UNLOCK_REQUIRED" ||
          code === "GEOFENCE_REQUIRED" ||
          code === "OUTSIDE_GEOFENCE"
        ) {
          setTableUnlockPrompt(err.message);
        } else {
          showBanner(err.message || "Could not start table session", "error");
        }
        return null;
      } finally {
        setVerifying(false);
      }
    },
    [
      sessionToken,
      publicCode,
      isRoomQr,
      qrLocation?.guestPolicy?.geofenceEnabled,
      storageKey,
      grantStorageKey,
      fetchGuestSessionData,
      showBanner,
    ]
  );

  // Open item detail / customization screen (matching sample Screen 2 & 3)
  const handleSelectMenuItem = (item: MenuItem) => {
    setCustomizingItem(item);
    setSelectedModOptionIds([]);
    setCustomItemQty(1);
    setCustomItemNotes("");
    setCustomModalTab("CUSTOMIZE");
  };

  // Live server check before adding items or submitting order on a Table QR
  // Prevents stale-screen race conditions if cashier just opened Settlement / Print Bill
  const verifyTableOpenForOrdering = async (): Promise<boolean> => {
    if (isRoomQr || !publicCode) return true;
    try {
      const fresh = await apiClient.guest.getPublicQr(publicCode);
      if (fresh?.qrLocation) {
        setQrLocation(fresh.qrLocation);
        const t = fresh.qrLocation.table;
        const billedNow = Boolean(t?.isBilledLocked || t?.isSettling || t?.status === "BILLED");
        if (billedNow || (!isVerified && t?.isSettled === false)) {
          setCustomizingItem(null);
          setIsCartOpen(false);
          setDismissedUnsettledGate(false);
          return false;
        }
      }
    } catch {
      // Fall back to existing client state + server-side lock on submit
    }
    return true;
  };

  // Quick 1-tap optimistic add from card (if no required modifier options)
  const handleQuickAddMenuItem = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    if (item.isAvailable === false) return;

    const hasRequiredModifiers =
      Array.isArray(item.modifierGroups) &&
      item.modifierGroups.some(
        (mg) =>
          mg.modifierGroup?.isRequired ||
          ((mg.modifierGroup?.minSelect ?? 0) > 0)
      );

    if (hasRequiredModifiers) {
      handleSelectMenuItem(item);
    } else {
      addItemToCart(item, 1, [], "");
    }
  };

  const getItemCartQty = (menuItemId: string) =>
    cart.filter((c) => c.menuItem.id === menuItemId).reduce((sum, c) => sum + c.quantity, 0);

  const decrementItemFromCart = (e: React.MouseEvent, menuItemId: string) => {
    e.stopPropagation();
    setCart((prev) => {
      const idx = [...prev].reverse().findIndex((c) => c.menuItem.id === menuItemId);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const next = [...prev];
      if (next[realIdx].quantity <= 1) {
        next.splice(realIdx, 1);
      } else {
        next[realIdx] = { ...next[realIdx], quantity: next[realIdx].quantity - 1 };
      }
      return next;
    });
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
    if (!customizingItem || customizingItem.isAvailable === false) return;

    // Enforce required / minSelect / maxSelect modifier group constraints
    for (const link of customizingItem.modifierGroups || []) {
      const group = link.modifierGroup;
      if (!group || !group.options?.length) continue;
      const selectedCount = group.options.filter((o) => selectedModOptionIds.includes(o.id)).length;
      const minRequired = Math.max(group.isRequired ? 1 : 0, group.minSelect ?? 0);
      if (selectedCount < minRequired) {
        showBanner(
          `Please select at least ${minRequired} option${minRequired > 1 ? "s" : ""} for ${group.displayName || group.name}.`,
          "error"
        );
        return;
      }
      if (group.maxSelect && group.maxSelect > 0 && selectedCount > group.maxSelect) {
        showBanner(
          `Please select at most ${group.maxSelect} option${group.maxSelect > 1 ? "s" : ""} for ${group.displayName || group.name}.`,
          "error"
        );
        return;
      }
    }

    const allOptions: ModifierOption[] = [];
    for (const link of customizingItem.modifierGroups || []) {
      for (const opt of link.modifierGroup?.options || []) {
        if (opt.isAvailable !== false && selectedModOptionIds.includes(opt.id)) {
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

  // Submit Guest Order (Dine-In, Takeaway, or Delivery)
  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    // Request OS notification permission + register FCM Web Push on user gesture
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void registerWebPushToken({ publicCode, guestSessionToken: sessionToken });
    }

    // Channel orders (Takeaway / Delivery) never lock a dining table
    if (!isRoomQr && (orderChannel === "TAKEAWAY" || orderChannel === "DELIVERY")) {
      const cleanName = channelName.trim();
      const cleanPhone = channelPhone.trim();
      const cleanEmail = channelEmail.trim();
      const cleanAddress = channelAddress.trim();
      const nextErrors: Record<string, string> = {};

      if (cleanName.length < 2) {
        nextErrors.name = "Enter your full name (at least 2 characters) so staff can identify your order.";
      }
      if (cleanPhone.replace(/\D/g, "").length < 7) {
        nextErrors.phone = "Enter a valid mobile number (e.g. 98XXXXXXXX) so we can call you on updates.";
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        nextErrors.email = "Enter a valid email like name@example.com, or leave it blank.";
      }
      if (orderChannel === "DELIVERY" && cleanAddress.length < 5) {
        nextErrors.address = "Enter your street, tole, and a nearby landmark so our rider can find you.";
      }

      setChannelFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        showBanner("Please fix the highlighted fields before placing your order.", "error");
        return;
      }

      try {
        setSubmittingOrder(true);
        const res = await apiClient.guest.createChannelOrder({
          publicCode,
          orderType: orderChannel,
          customerName: cleanName,
          phone: cleanPhone,
          email: channelEmail.trim() || null,
          deliveryAddress: orderChannel === "DELIVERY" ? cleanAddress : null,
          paymentPreference:
            orderChannel === "DELIVERY"
              ? channelPaymentPref === "ONLINE_QR"
                ? "ONLINE_QR"
                : "COD"
              : channelPaymentPref === "ONLINE_QR"
              ? "ONLINE_QR"
              : "PAY_AT_PICKUP",
          lat: channelCoords?.lat ?? null,
          lng: channelCoords?.lng ?? null,
          notes: orderNotes.trim() || undefined,
          items: cart.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            selectedOptionIds: c.selectedOptions.map((o) => o.id),
            notes: c.notes || undefined,
          })),
        });

        const created = res?.order;
        if (created) {
          // Persist reference in localStorage so customer can track live across reloads & in /guest app
          if (typeof window !== "undefined") {
            try {
              const key = "restroinn_guest_channel_orders_v1";
              const prevList = JSON.parse(localStorage.getItem(key) || "[]");
              const nextList = [
                {
                  orderId: created.id,
                  orderNumber: created.orderNumber,
                  phone: cleanPhone,
                  orderType: orderChannel,
                  publicCode,
                  createdAt: Date.now(),
                },
                ...(Array.isArray(prevList) ? prevList : []).filter(
                  (x: any) => x?.orderNumber !== created.orderNumber
                ),
              ].slice(0, 10);
              localStorage.setItem(key, JSON.stringify(nextList));
            } catch {
              // ignore storage errors
            }
          }
          setOrders((prev) => [
            {
              ...created,
              trackerStage: "ORDER_RECEIVED",
              isPendingApproval: Boolean(res?.requiresStaffApproval),
              rounds: res?.round ? [{ ...res.round, lines: res.lines || [] }] : [],
            },
            ...prev.filter((o) => o.id !== created.id),
          ]);
        }

        setCart([]);
        setOrderNotes("");
        setIsCartOpen(false);
        setActiveTab("TRACKER");
        showBanner(
          res?.requiresStaffApproval
            ? `${orderChannel === "DELIVERY" ? "Delivery" : "Takeaway"} order #${created?.orderNumber || ""} received — our staff will confirm shortly!`
            : `${orderChannel === "DELIVERY" ? "Delivery" : "Takeaway"} order #${created?.orderNumber || ""} sent to kitchen!`,
          "success"
        );
      } catch (err: any) {
        showBanner(err.message || "Unable to place order", "error");
      } finally {
        setSubmittingOrder(false);
      }
      return;
    }

    const canOrder = await verifyTableOpenForOrdering();
    if (!canOrder) return;

    let activeToken = sessionToken;
    if (!activeToken) {
      if (isRoomQr) {
        setIsCartOpen(false);
        setShowVerifyModal(true);
        return;
      } else {
        if (
          qrLocation?.table?.isBilledLocked ||
          qrLocation?.table?.isSettling ||
          qrLocation?.table?.status === "BILLED"
        ) {
          showBanner("Table bill payment is currently in progress. Additional orders are locked.", "error");
          return;
        }
        if (
          qrLocation?.table?.pinRequired ||
          qrLocation?.table?.status === "OCCUPIED" ||
          !qrLocation?.table?.isSettled
        ) {
          setIsCartOpen(false);
          setShowTablePinModal(true);
          return;
        }
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

      const res = await apiClient.guest.createOrder(payload, activeToken);

      setCart([]);
      setOrderNotes("");
      setIsCartOpen(false);
      await fetchGuestSessionData(activeToken, true);
      setActiveTab("TRACKER");
      showBanner(
        res?.requiresStaffApproval
          ? "Order received and sent to staff for quick confirmation before kitchen starts."
          : isRoomQr
          ? "Room service order received! Track live kitchen preparation below."
          : "Order sent to kitchen! Track live preparation below.",
        "success"
      );
    } catch (err: any) {
      const errCode = err?.data?.code;
      if (errCode === "TABLE_BILLED_LOCKED" || errCode === "SESSION_CLOSED") {
        if (errCode === "SESSION_CLOSED") {
          clearPrivateSessionState();
          setSessionEndedThankYou(true);
        }
        setIsCartOpen(false);
        setDismissedUnsettledGate(false);
        void handleRefreshTableStatus();
      }
      showBanner(err.message || "Unable to place order", "error");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Ask waiter to unlock an AVAILABLE table when STAFF_SEATED_OR_PIN mode is active
  const handleRequestTableUnlock = async () => {
    if (!publicCode) return;
    try {
      setVerifying(true);
      await apiClient.guest.createServiceRequest({
        publicCode,
        requestType: "TABLE_UNLOCK_REQUEST",
        notes: `Guest seated at Table ${qrLocation?.table?.tableNumber || ""} requested staff to seat & unlock the table for QR ordering.`,
        priority: "HIGH",
      });
      setTableUnlockPrompt(null);
      showBanner("Waiter notified! Once they seat your table, enter the 4-digit PIN or submit your order.", "success");
    } catch (err: any) {
      showBanner(err.message || "Could not notify staff right now.", "error");
    } finally {
      setVerifying(false);
    }
  };

  const handleCaptureChannelGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setChannelCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
        showBanner("Could not read GPS location. Please type your full address.", "info");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCancelOrRefundOrder = async (reason: string) => {
    if (!orderActionModal) return;
    try {
      setActionSubmitting(true);
      setActionError(null);
      const res = await apiClient.guest.cancelOrder(
        orderActionModal.order.id,
        { reason, phone: channelPhone.trim() || null },
        sessionToken
      );
      setOrderActionModal(null);
      showBanner(res?.message || "Request submitted.", "success");
      if (sessionToken) {
        await fetchGuestSessionData(sessionToken, true);
      } else if (res?.action === "CANCELLED") {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderActionModal.order.id
              ? { ...o, fulfillmentStatus: "CANCELLED", trackerStage: "REJECTED" }
              : o
          )
        );
      }
    } catch (err: any) {
      setActionError(err.message || "Unable to process request.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePackTakeawayOrder = async (itemIds: string[], notes: string) => {
    if (!orderActionModal || !sessionToken) return;
    try {
      setActionSubmitting(true);
      setActionError(null);
      const res = await apiClient.guest.requestOrderFulfillment(
        orderActionModal.order.id,
        { mode: "PACK_TAKEAWAY", itemIds, notes },
        sessionToken
      );
      setOrderActionModal(null);
      showBanner(res?.message || "Takeaway packing requested.", "success");
    } catch (err: any) {
      setActionError(err.message || "Unable to submit packing request.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleDeliverElsewhereOrder = async (payload: {
    itemIds: string[];
    customerName: string;
    phone: string;
    deliveryAddress: string;
    lat?: number | null;
    lng?: number | null;
    notes: string;
  }) => {
    if (!orderActionModal || !sessionToken) return;
    try {
      setActionSubmitting(true);
      setActionError(null);
      const res = await apiClient.guest.requestOrderFulfillment(
        orderActionModal.order.id,
        { mode: "REQUEST_DELIVERY", ...payload },
        sessionToken
      );
      setOrderActionModal(null);
      showBanner(res?.message || "Delivery request sent to staff.", "success");
    } catch (err: any) {
      setActionError(err.message || "Unable to submit delivery request.");
    } finally {
      setActionSubmitting(false);
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

      const data = await apiClient.guest.createServiceRequest(
        {
          sessionToken: activeToken || undefined,
          publicCode,
          requestType,
          notes: (customNotes ?? serviceNote).trim() || undefined,
          priority: requestType === "CHECKOUT_REQUEST" ? "HIGH" : "NORMAL",
          idempotencyKey,
        },
        activeToken || undefined,
        idempotencyKey
      );

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

  const locationBadgeText =
    orderChannel === "DELIVERY"
      ? "Delivery"
      : orderChannel === "TAKEAWAY"
      ? "Takeaway"
      : isRoomQr
      ? `Room ${qrLocation.room?.roomNumber || qrLocation.label}`
      : `Table ${qrLocation.table?.tableNumber || qrLocation.label}`;

  const isBilledLockedNow =
    !isRoomQr &&
    Boolean(qrLocation.table?.isBilledLocked || qrLocation.table?.status === "BILLED");

  const isTableWaitingForSettlement =
    !isRoomQr &&
    Boolean(qrLocation.table) &&
    orderChannel === "DINE_IN" &&
    ((!isVerified && qrLocation.table?.isSettled === false) || isBilledLockedNow);

  if (sessionEndedThankYou) {
    return (
      <div data-theme={guestTheme} className="guest-shell min-h-[100dvh] font-sans">
        <GuestSettledThankYouCard
          businessName={qrLocation.business.name}
          businessLogo={qrLocation.business.logo}
          branchName={qrLocation.branch?.name}
          tableLabel={locationBadgeText}
          hasGoogleReview={Boolean(qrLocation.business.googleReviewUrl)}
          takeawayEnabled={qrLocation.guestPolicy?.takeawayEnabled !== false}
          deliveryEnabled={qrLocation.guestPolicy?.deliveryEnabled !== false}
          onRateGoogle={() => {
            setSessionEndedThankYou(false);
            setShowRateUsModal(true);
          }}
          onStartTakeaway={() => {
            setOrderChannel("TAKEAWAY");
            clearSettledMarker();
            setActiveTab("MENU");
          }}
          onStartDelivery={() => {
            setOrderChannel("DELIVERY");
            clearSettledMarker();
            setActiveTab("MENU");
          }}
          onScanNewTable={() => {
            clearSettledMarker();
            window.location.href = "/guest";
          }}
        />
      </div>
    );
  }

  if (isTableWaitingForSettlement && !dismissedUnsettledGate) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] text-[#292320] font-sans flex flex-col">
        {/* Clean Sticky Header */}
        <header className="w-full bg-[#FFFCF7] border-b border-[#D8CEC1] px-4 py-2.5">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md bg-[#6B2837] text-[#FFFCF7] flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#292320] truncate leading-tight">
                  {qrLocation.business.name}
                </p>
                {qrLocation.branch?.name && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E] truncate">
                    {qrLocation.branch.name}
                  </p>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs font-semibold text-[#6B2837] shrink-0">
              {locationBadgeText}
            </span>
          </div>
        </header>

        {/* Main Mobile-First 3-Card Stack */}
        <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 space-y-3">
          {/* Card 1: Dining Space Hero Card (with real restaurant asset photo on right) */}
          <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden grid grid-cols-12">
            <div className="col-span-7 p-4 space-y-1.5 flex flex-col justify-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F1F7F4] border border-[#C3DED0] text-[#28634B] text-[10px] font-semibold w-fit">
                <Clock className="w-3 h-3 shrink-0" />
                <span>Bill Settlement in Progress</span>
              </span>
              <div className="pt-0.5">
                <p className="text-[11px] font-medium text-[#71675E]">Dining Space</p>
                <h1 className="text-2xl font-extrabold text-[#292320] tracking-tight leading-tight">
                  {locationBadgeText}
                </h1>
              </div>
              {qrLocation.table?.floorName && (
                <p className="text-[11px] text-[#71675E] flex items-center gap-1.5 pt-0.5">
                  <Users className="w-3.5 h-3.5 text-[#292320] shrink-0" />
                  <span className="truncate">
                    {qrLocation.table.floorName}
                    {qrLocation.table.capacity ? ` • ${qrLocation.table.capacity} Covers` : ""}
                  </span>
                </p>
              )}
            </div>
            <div className="col-span-5 relative min-h-[126px] bg-[#EEE7DD] border-l border-[#EEE7DD]">
              <img
                src="/assets/clean-restaurant.jpg"
                alt={locationBadgeText}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-md bg-[#292320] border border-[#FFFCF7]/25 text-[#FFFCF7] text-center">
                <span className="text-xs font-bold tabular-nums tracking-wide">
                  {qrLocation.table?.tableNumber || qrLocation.label}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Horizontal 3-Step Table Readiness */}
          <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#292320]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6B2837]" />
              <span>Table Readiness</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-start text-center relative">
              <div className="absolute top-3.5 left-[18%] right-[18%] h-px bg-[#D8CEC1]" aria-hidden="true" />
              <div className="absolute top-3.5 left-[18%] right-[50%] h-px bg-[#28634B]" aria-hidden="true" />

              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <span className="w-7 h-7 rounded-full bg-[#28634B] text-[#FFFCF7] flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-medium text-[#292320] leading-tight">
                  Previous order completed
                </span>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <span className="w-7 h-7 rounded-full bg-[#FDF7ED] border border-[#946000] text-[#946000] flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-semibold text-[#946000] leading-tight">
                  Cashier settling previous bill
                </span>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <span className="w-7 h-7 rounded-full bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] text-[11px] font-bold flex items-center justify-center tabular-nums">
                  3
                </span>
                <span className="text-[11px] text-[#71675E] leading-tight">
                  {locationBadgeText} unlocks for your order
                </span>
              </div>
            </div>
          </section>

          {/* Card 3: Waiting Message with Flat Serving Cloche Icon */}
          <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 text-center space-y-2.5">
            <div className="w-14 h-14 rounded-full bg-[#F7F3EC] border border-[#EEE7DD] flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#6B2837]" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="9" r="2" fill="currentColor" />
                <path d="M7 21C7 15.5 11 11.5 16 11.5C21 11.5 25 15.5 25 21H7Z" fill="currentColor" />
                <rect x="4.5" y="22.5" width="23" height="2.2" rx="1.1" fill="#292320" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#292320]">
              Waiting for {locationBadgeText} to clear
            </h2>
            <p className="text-xs text-[#71675E] leading-relaxed">
              The previous guests&apos; bill is being cleared at the cashier. Ordering unlocks automatically in a moment, or tap below to notify our staff.
            </p>
            {tableAlertSent && (
              <div className="p-2.5 rounded-md bg-[#F1F7F4] border border-[#C3DED0] text-xs text-[#28634B] font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Staff notified. Clearing {locationBadgeText} now.</span>
              </div>
            )}
          </section>

          {/* Clean Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleRefreshTableStatus}
              className="w-full h-11 px-4 rounded-full bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload &amp; Check Status</span>
            </button>

            <button
              type="button"
              onClick={handleAlertStaffTurnover}
              disabled={sendingTurnoverAlert || tableAlertSent}
              className="w-full h-11 px-4 rounded-full border border-[#6B2837] bg-[#FFFCF7] hover:bg-[#FAF2F4] text-[#292320] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Bell className="w-3.5 h-3.5 text-[#6B2837]" />
              <span>
                {sendingTurnoverAlert
                  ? "Calling Service..."
                  : tableAlertSent
                  ? "Staff Notified"
                  : "Call Service (Previous Guests Left)"}
              </span>
            </button>

            <div className="pt-2 flex items-center justify-center gap-3">
              <span className="h-px flex-1 bg-[#D8CEC1]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setDismissedUnsettledGate(true)}
                className="py-1 text-xs font-semibold text-[#71675E] hover:text-[#292320] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-[#6B2837]" />
                <span>Preview Menu While Waiting</span>
              </button>
              <span className="h-px flex-1 bg-[#D8CEC1]" aria-hidden="true" />
            </div>

            {!qrLocation.table?.isBilledLocked && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setDismissedUnsettledGate(true);
                    setShowTablePinModal(true);
                  }}
                  className="py-1 text-xs font-semibold text-[#6B2837] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Join Table with 4-Digit PIN</span>
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="w-full py-3 px-4 text-center text-[11px] text-[#71675E] flex items-center justify-center gap-3">
          <span>Auto-checks every 4s</span>
          <span>•</span>
          <a href="/terms" className="hover:text-[#292320] underline underline-offset-2">
            Terms
          </a>
          <a href="/privacy" className="hover:text-[#292320] underline underline-offset-2">
            Privacy
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div data-theme={guestTheme} className="guest-shell min-h-[100dvh] flex justify-center">
      <GuestSplashScreen
        businessName={qrLocation.business.name}
        locationLabel={locationBadgeText}
        publicCode={publicCode}
      />
      <div
        className="w-full max-w-lg min-h-[100dvh] flex flex-col relative pb-28"
        style={{
          backgroundColor: "var(--guest-bg)",
          borderLeft: "1px solid var(--guest-border)",
          borderRight: "1px solid var(--guest-border)",
        }}
      >
        {/* Sticky Mobile Hospitality Header — 44px tap targets, hairline border, single accent */}
        <header
          className="sticky top-0 z-30 px-4 py-3"
          style={{
            backgroundColor: "var(--guest-surface)",
            borderBottom: "1px solid var(--guest-border)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Top Left: Restaurant Name */}
            <div className="min-w-0 pr-1">
              <h1 className="text-base font-semibold leading-snug truncate">
                {qrLocation.business.name}
              </h1>
              {qrLocation.branch?.name && (
                <p
                  className="text-sm font-normal leading-snug truncate"
                  style={{ color: "var(--guest-muted)" }}
                >
                  {qrLocation.branch.name}
                </p>
              )}
            </div>

            {/* Top Right: Channel Badge + Theme + Search + Bell (all 44px tap targets) */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold"
                style={{
                  backgroundColor: "var(--guest-accent-soft)",
                  color: "var(--guest-accent-text)",
                  border: "1px solid var(--guest-border)",
                }}
              >
                {orderChannel === "DELIVERY" ? (
                  <Truck className="w-4 h-4 shrink-0" />
                ) : orderChannel === "TAKEAWAY" ? (
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                ) : isRoomQr ? (
                  <BedDouble className="w-4 h-4 shrink-0" />
                ) : (
                  <Store className="w-4 h-4 shrink-0" />
                )}
                <span>{locationBadgeText}</span>
              </span>

              <button
                type="button"
                onClick={toggleGuestTheme}
                aria-label={guestTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="w-11 h-11 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  backgroundColor: "var(--guest-surface-subtle)",
                  border: "1px solid var(--guest-border)",
                  color: "var(--guest-fg)",
                }}
              >
                {guestTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                aria-label="Search menu"
                className="w-11 h-11 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  backgroundColor: "var(--guest-surface-subtle)",
                  border: "1px solid var(--guest-border)",
                  color: "var(--guest-fg)",
                }}
                title="Search Menu"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setGuestNotifOpen((prev) => !prev);
                  setUnreadGuestNotifs(0);
                }}
                aria-label="Order updates and alerts"
                className="w-11 h-11 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer relative"
                style={{
                  backgroundColor: "var(--guest-surface-subtle)",
                  border: "1px solid var(--guest-border)",
                  color: "var(--guest-accent-text)",
                }}
                title="Live Order Updates"
              >
                <Bell className="w-5 h-5" />
                {unreadGuestNotifs > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full text-xs font-semibold flex items-center justify-center tabular-nums"
                    style={{
                      backgroundColor: "var(--guest-accent)",
                      color: "var(--guest-accent-fg)",
                    }}
                  >
                    {unreadGuestNotifs > 9 ? "9+" : unreadGuestNotifs}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Sub-strip ONLY when Table is unsettled/settling or verified host actions */}
          {(!isRoomQr && (isTableWaitingForSettlement || isVerified)) && (
            <div className="mt-2 pt-1.5 border-t border-[#EEE7DD] flex items-center justify-between text-xs">
              {isVerified ? (
                <div className="flex items-center justify-between w-full">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#292320] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Table {qrLocation.table?.tableNumber} Active
                    {tablePin && (
                      <span className="px-1.5 py-0.5 rounded bg-[#FAF6F0] text-[#6B2837] border border-[#EEE7DD] font-mono font-bold text-[10px]">
                        PIN: {tablePin}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowGroupShareModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#6B2837] text-white font-bold text-[11px] hover:bg-[#541E2A] transition cursor-pointer"
                    >
                      <Users className="w-3 h-3" />
                      <span>Invite</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-[#946000] font-semibold text-[11px] flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Previous bill not settled yet</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleAlertStaffTurnover}
                      disabled={sendingTurnoverAlert || tableAlertSent}
                      className="px-2 py-0.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] font-semibold text-[10px] cursor-pointer disabled:opacity-60"
                    >
                      {tableAlertSent ? "Staff Alerted" : "Call Service"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshTableStatus}
                      className="px-2 py-0.5 rounded bg-[#6B2837] text-white font-semibold text-[10px] cursor-pointer"
                    >
                      Reload
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Floating Live Kitchen / Offer Push Alert (does NOT shift page body; supports optional Offer Banner image) */}
        {liveStatusAlert && (
          <div className="fixed top-16 left-0 right-0 z-50 max-w-lg mx-auto px-3 pointer-events-none">
            <div className="pointer-events-auto rounded-lg border border-[#853547] bg-[#6B2837] text-[#FFFCF7] overflow-hidden shadow-xs">
              {liveStatusAlert.metadata?.imageUrl && (
                <img
                  src={liveStatusAlert.metadata.imageUrl}
                  alt={liveStatusAlert.title}
                  className="w-full h-28 object-cover border-b border-[#853547]"
                />
              )}
              <div className="p-3 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ChefHat className="w-4 h-4 text-[#F3E5AB] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-snug">{liveStatusAlert.title}</p>
                    <p className="text-[11px] text-[#FFFCF7]/90 leading-snug mt-0.5">{liveStatusAlert.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveStatusAlert(null)}
                  className="text-[#FFFCF7]/80 hover:text-[#FFFCF7] p-0.5 cursor-pointer shrink-0"
                  aria-label="Dismiss order update"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Notifications Popover (triggered by top-right Bell; does NOT push body down) */}
        {guestNotifOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-[#292320]/20" onClick={() => setGuestNotifOpen(false)} />
            <div className="fixed top-14 left-0 right-0 z-50 max-w-lg mx-auto px-3">
              <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden shadow-xs">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F7F3EC] border-b border-[#D8CEC1]">
                  <span className="text-xs font-bold text-[#292320]">Notifications &amp; Offers</span>
                  <div className="flex items-center gap-2.5">
                    {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
                      <button
                        type="button"
                        onClick={async () => {
                          const token = await registerWebPushToken({ publicCode, guestSessionToken: sessionToken });
                          if (token || (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted")) {
                            showBanner("Background push alerts enabled!", "success");
                          }
                        }}
                        className="text-[10px] font-bold text-[#6B2837] underline cursor-pointer"
                      >
                        Enable Alerts
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setGuestNotifOpen(false)}
                      className="text-[#71675E] hover:text-[#292320] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#EEE7DD]">
                  {guestNotifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-[#71675E]">
                      Kitchen order updates and restaurant offers will appear here in real time.
                    </p>
                  ) : (
                    guestNotifications.map((n) => (
                      <div key={n.id} className="px-3.5 py-2.5 text-left space-y-1.5">
                        {n.metadata?.imageUrl && (
                          <img
                            src={n.metadata.imageUrl}
                            alt={n.title}
                            className="w-full h-24 object-cover rounded-md border border-[#EEE7DD]"
                          />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#292320]">{n.title}</span>
                          <span className="text-[10px] text-[#71675E] tabular-nums shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71675E] leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating Toast Notification (fixed overlay — never shifts page body) */}
        {toast && (
          <div className="fixed top-16 left-0 right-0 z-50 max-w-lg mx-auto px-3 pointer-events-none">
            <div className="pointer-events-auto p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 bg-[#FFFCF7] border-[#D8CEC1] text-[#292320] shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                {toast.type === "error" ? (
                  <AlertCircle className="w-4 h-4 text-[#B33432] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#28634B] shrink-0" />
                )}
                <span className="truncate">{toast.text}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToast(null)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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

              {/* =========================================================
                  CLEAN MINIMALIST MENU FEED (FOOD FIRST)
                 ========================================================= */}
              <div className="space-y-4">
                {/* Popular Dishes Carousel (shown only on All view when not searching) */}
                {!searchQuery && selectedSectionId === "ALL" && selectedDietary === "ALL" && popularItems.length > 0 && (
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#292320] uppercase tracking-wider">
                        Chef&apos;s Picks
                      </h3>
                      <span className="text-[10px] font-medium text-[#71675E]">Top {popularItems.length}</span>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {popularItems.map((item) => {
                        const qtyInCart = getItemCartQty(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectMenuItem(item)}
                            className="w-40 shrink-0 bg-[#FFFCF7] rounded-lg p-2.5 border border-[#D8CEC1] hover:border-[#6B2837] transition cursor-pointer space-y-2"
                          >
                            <div className="relative aspect-4/3 rounded-md overflow-hidden bg-[#EEE7DD]">
                              <FoodImage item={item} iconClassName="w-7 h-7" />
                              {item.prepTimeMinutes ? (
                                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#FFFCF7]/95 text-[9px] text-[#292320] font-bold tabular-nums">
                                  {item.prepTimeMinutes}m
                                </div>
                              ) : null}
                            </div>

                            <div className="space-y-1.5">
                              <h4 className="text-xs font-bold text-[#292320] line-clamp-1">
                                {item.name}
                              </h4>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-extrabold text-[#6B2837] tabular-nums">
                                  {formatNPR(item.basePrice)}
                                </span>
                                {qtyInCart > 0 ? (
                                  <div
                                    className="inline-flex items-center gap-1 rounded-md bg-[#6B2837] text-[#FFFCF7] px-1 h-7"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      aria-label={`Remove one ${item.name}`}
                                      onClick={(e) => decrementItemFromCart(e, item.id)}
                                      className="w-5 h-5 flex items-center justify-center cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-[11px] font-bold tabular-nums min-w-[14px] text-center">
                                      {qtyInCart}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Add one more ${item.name}`}
                                      onClick={(e) => handleQuickAddMenuItem(e, item)}
                                      className="w-5 h-5 flex items-center justify-center cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Add ${item.name}`}
                                    onClick={(e) => handleQuickAddMenuItem(e, item)}
                                    className="h-7 px-2.5 rounded-md bg-[#6B2837] text-[#FFFCF7] text-[11px] font-bold flex items-center gap-0.5 hover:bg-[#541E2A] transition cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Horizontal Category & Dietary Nav Chips — 44px tap targets, hairline border, single accent */}
                {(allSections.length > 1 || availableDietaryTags.length > 0) && (
                  <div
                    id="catalog-courses-scroll"
                    className="sticky top-[68px] z-20 -mx-4 px-4 py-3 space-y-2"
                    style={{
                      backgroundColor: "var(--guest-surface)",
                      borderBottom: "1px solid var(--guest-border)",
                    }}
                  >
                    {allSections.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedSectionId("ALL")}
                          className="min-h-[44px] px-4 rounded-[8px] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
                          style={
                            selectedSectionId === "ALL"
                              ? {
                                  backgroundColor: "var(--guest-accent)",
                                  color: "var(--guest-accent-fg)",
                                }
                              : {
                                  backgroundColor: "var(--guest-surface-subtle)",
                                  color: "var(--guest-fg)",
                                  border: "1px solid var(--guest-border)",
                                }
                          }
                        >
                          All
                        </button>
                        {allSections.map((sec) => (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => setSelectedSectionId(sec.id)}
                            className="min-h-[44px] px-4 rounded-[8px] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
                            style={
                              selectedSectionId === sec.id
                                ? {
                                    backgroundColor: "var(--guest-accent)",
                                    color: "var(--guest-accent-fg)",
                                  }
                                : {
                                    backgroundColor: "var(--guest-surface-subtle)",
                                    color: "var(--guest-fg)",
                                    border: "1px solid var(--guest-border)",
                                  }
                            }
                          >
                            {sec.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {availableDietaryTags.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedDietary("ALL")}
                          className="min-h-[36px] px-3 rounded-[8px] text-sm font-medium whitespace-nowrap cursor-pointer"
                          style={
                            selectedDietary === "ALL"
                              ? {
                                  backgroundColor: "var(--guest-accent-soft)",
                                  color: "var(--guest-accent-text)",
                                  border: "1px solid var(--guest-accent)",
                                }
                              : {
                                  backgroundColor: "var(--guest-surface)",
                                  color: "var(--guest-muted)",
                                  border: "1px solid var(--guest-border)",
                                }
                          }
                        >
                          All Diets
                        </button>
                        {availableDietaryTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedDietary(tag)}
                            className="min-h-[36px] px-3 rounded-[8px] text-sm font-medium whitespace-nowrap cursor-pointer"
                            style={
                              selectedDietary === tag
                                ? {
                                    backgroundColor: "var(--guest-accent-soft)",
                                    color: "var(--guest-accent-text)",
                                    border: "1px solid var(--guest-accent)",
                                  }
                                : {
                                    backgroundColor: "var(--guest-surface)",
                                    color: "var(--guest-muted)",
                                    border: "1px solid var(--guest-border)",
                                  }
                            }
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Search indicator pill if active search from top header */}
                {searchQuery && (
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-[12px] text-sm"
                    style={{
                      backgroundColor: "var(--guest-surface)",
                      border: "1px solid var(--guest-border)",
                    }}
                  >
                    <span>
                      Showing results for{" "}
                      <span className="font-semibold" style={{ color: "var(--guest-accent-text)" }}>
                        &quot;{searchQuery}&quot;
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="min-h-[36px] px-2 font-semibold underline cursor-pointer"
                      style={{ color: "var(--guest-accent-text)" }}
                    >
                      Clear
                    </button>
                  </div>
                )}

                {filteredSections.length === 0 ? (
                  <div className="guest-card p-8 text-center space-y-3">
                    <UtensilsCrossed
                      className="w-8 h-8 mx-auto"
                      style={{ color: "var(--guest-accent-text)" }}
                    />
                    <p className="text-lg font-semibold">No matching dishes</p>
                    <p
                      className="text-base font-normal max-w-[44ch] mx-auto"
                      style={{ color: "var(--guest-muted)" }}
                    >
                      Try choosing another category above or clear your search filter to see the full menu.
                    </p>
                    {(searchQuery || selectedSectionId !== "ALL" || selectedDietary !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedSectionId("ALL");
                          setSelectedDietary("ALL");
                        }}
                        className="guest-btn-primary px-6 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredSections.map((section) => (
                      <section key={section.id} className="space-y-3">
                        <div
                          className="flex items-center justify-between pb-2"
                          style={{ borderBottom: "1px solid var(--guest-border)" }}
                        >
                          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--guest-accent-text)" }}>
                            {section.name}
                          </h2>
                          <span className="text-sm font-normal tabular-nums" style={{ color: "var(--guest-muted)" }}>
                            {section.items.length} {section.items.length === 1 ? "item" : "items"}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {section.items.map((item) => {
                            const tags = Array.isArray(item.dietaryTags) ? item.dietaryTags : [];
                            const hasMods =
                              Array.isArray(item.modifierGroups) &&
                              item.modifierGroups.some(
                                (mg) =>
                                  mg.modifierGroup?.options &&
                                  mg.modifierGroup.options.length > 0
                              );

                            return (
                              <div
                                key={item.id}
                                onClick={() => handleSelectMenuItem(item)}
                                className="guest-card p-4 transition-colors cursor-pointer flex items-center justify-between gap-4"
                              >
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-semibold leading-snug">
                                      {item.name}
                                    </h3>
                                    {tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="text-xs font-medium px-2 py-0.5 rounded-[6px]"
                                        style={{
                                          backgroundColor: "var(--guest-surface-subtle)",
                                          color: "var(--guest-muted)",
                                          border: "1px solid var(--guest-border)",
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>

                                  {item.description && (
                                    <p
                                      className="text-sm font-normal line-clamp-2 leading-relaxed max-w-[65ch]"
                                      style={{ color: "var(--guest-muted)" }}
                                    >
                                      {item.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-3 pt-1">
                                    <span
                                      className="text-base font-semibold tabular-nums"
                                      style={{ color: "var(--guest-accent-text)" }}
                                    >
                                      {formatNPR(item.basePrice)}
                                    </span>
                                    {item.prepTimeMinutes ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-sm font-normal"
                                        style={{ color: "var(--guest-muted)" }}
                                      >
                                        <Clock className="w-4 h-4 shrink-0" />
                                        <span>{item.prepTimeMinutes} min</span>
                                      </span>
                                    ) : null}
                                    {hasMods && (
                                      <span
                                        className="text-sm font-normal"
                                        style={{ color: "var(--guest-muted)" }}
                                      >
                                        Customizable
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Concentric Inner Radius (16px outer -> 8px inner) + 44px Tap Target */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <div
                                    className="relative w-24 h-24 rounded-[8px] overflow-hidden"
                                    style={{
                                      backgroundColor: "var(--guest-surface-subtle)",
                                      border: "1px solid var(--guest-border)",
                                    }}
                                  >
                                    <FoodImage item={item} iconClassName="w-8 h-8" />
                                    {item.isAvailable === false && (
                                      <div className="absolute inset-0 bg-[#181412]/70 flex items-center justify-center">
                                        <span className="text-xs font-semibold uppercase text-[#FFFCF7] px-2 py-1 rounded-[6px] bg-[#9E2625]">
                                          Sold Out
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {item.isAvailable !== false && (() => {
                                    const qty = getItemCartQty(item.id);
                                    return qty > 0 ? (
                                      <div
                                        className="inline-flex items-center justify-between w-24 min-h-[44px] px-1 rounded-[8px]"
                                        style={{
                                          backgroundColor: "var(--guest-accent)",
                                          color: "var(--guest-accent-fg)",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          aria-label={`Remove one ${item.name}`}
                                          onClick={(e) => decrementItemFromCart(e, item.id)}
                                          className="w-8 h-10 flex items-center justify-center cursor-pointer"
                                        >
                                          <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-base font-semibold tabular-nums">
                                          {qty}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Add one more ${item.name}`}
                                          onClick={(e) => handleQuickAddMenuItem(e, item)}
                                          className="w-8 h-10 flex items-center justify-center cursor-pointer"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        aria-label={`Add ${item.name} to tray`}
                                        onClick={(e) => handleQuickAddMenuItem(e, item)}
                                        className="w-24 min-h-[44px] rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                        style={{
                                          backgroundColor: "var(--guest-surface-subtle)",
                                          color: "var(--guest-accent-text)",
                                          border: "1px solid var(--guest-border-strong)",
                                        }}
                                      >
                                        <Plus className="w-4 h-4 shrink-0" />
                                        <span>Add</span>
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
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
                {(sessionToken || orders.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (sessionToken) void fetchGuestSessionData(sessionToken, false);
                      void fetchSavedChannelOrders(false);
                    }}
                    disabled={refreshingData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FFFCF7] border border-[#D8CEC1] text-xs font-bold text-[#6B2837] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                )}
              </div>

              {!isVerified && orders.length === 0 ? (
                <div className="bg-[#FFFCF7] rounded-2xl p-6 text-center border border-[#E6DEC8] space-y-3">
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
                <div className="bg-[#FFFCF7] rounded-2xl p-6 text-center border border-[#E6DEC8] space-y-3">
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
                        className="bg-[#FFFCF7] rounded-2xl p-4 border border-[#E6DEC8] shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-[#6B2837] tabular-nums">
                                Order #{order.orderNumber}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[10px] font-bold text-[#292320]">
                                {order.orderType === "DELIVERY"
                                  ? "Delivery"
                                  : order.orderType === "TAKEAWAY"
                                  ? "Takeaway"
                                  : order.orderType === "ROOM_SERVICE"
                                  ? "Room Service"
                                  : "Dine-In"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6E655F]">
                              Placed {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                              stage === "REJECTED"
                                ? "bg-[#FDF2F2] text-[#8A1F2D] border-[#E5B8B8]"
                                : stage === "SERVED"
                                ? "bg-[#F1F7F4] text-[#28634B] border-[#C3DED0]"
                                : order.isOutForDelivery
                                ? "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]"
                                : order.isPendingApproval
                                ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                                : stage === "ON_ITS_WAY"
                                ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
                                : "bg-[#F7F3EC] text-[#6B2837] border-[#D8CEC1]"
                            }`}
                          >
                            {stage === "REJECTED"
                              ? "Cancelled"
                              : stage === "SERVED"
                              ? order.orderType === "DELIVERY"
                                ? "Delivered"
                                : "Served / Completed"
                              : order.isOutForDelivery
                              ? `Out for Delivery${order.riderName ? ` (${order.riderName})` : ""}`
                              : order.isPendingApproval
                              ? "Awaiting Confirmation"
                              : stage === "ORDER_RECEIVED"
                              ? "Order Received"
                              : stage === "COOKING"
                              ? "Cooking in Kitchen"
                              : "Ready"}
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
                          <span className="text-sm font-extrabold text-[#6B2837] tabular-nums">
                            {formatNPR(order.totalAmount)}
                          </span>
                        </div>

                        {/* Customer Lifecycle Actions: Pack Takeaway, Deliver Elsewhere, Cancel / Refund */}
                        {stage !== "REJECTED" && (
                          <div className="pt-2 border-t border-[#F0EAE0] flex flex-wrap items-center gap-1.5">
                            {sessionToken && order.orderType === "DINE_IN" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null);
                                    setOrderActionModal({ mode: "PACK_TAKEAWAY", order });
                                  }}
                                  className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ShoppingBag className="w-3 h-3 text-[#6B2837]" />
                                  <span>Pack Takeaway</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null);
                                    setOrderActionModal({ mode: "REQUEST_DELIVERY", order });
                                  }}
                                  className="h-8 px-2.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Truck className="w-3 h-3 text-[#6B2837]" />
                                  <span>Deliver Elsewhere</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setOrderActionModal({ mode: "CANCEL", order });
                              }}
                              className="h-8 px-2.5 rounded-md border border-[#E5B8B8] bg-[#FDF2F2] hover:bg-[#FCE6E6] text-[11px] font-semibold text-[#8A1F2D] inline-flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <Ban className="w-3 h-3" />
                              <span>
                                {order.settlementStatus === "PAID" || order.settlementStatus === "PARTIAL"
                                  ? "Request Refund"
                                  : "Cancel Order"}
                              </span>
                            </button>
                          </div>
                        )}
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
                <div className="bg-[#FFFCF7] rounded-2xl p-4 border border-[#A77B38] shadow-sm flex items-center justify-between gap-3">
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
              <div className="bg-[#FFFCF7] rounded-2xl p-3.5 border border-[#E6DEC8] shadow-sm">
                <label className="block text-xs font-bold text-[#1E1B18] mb-1.5">
                  Optional Note for Staff
                </label>
                <input
                  type="text"
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  placeholder={isRoomQr ? "e.g., Extra towels, pillows, late checkout..." : "e.g., Extra plates, baby chair, spicy sauce..."}
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
                        className="w-full text-left bg-[#FFFCF7] rounded-2xl p-3.5 border border-[#E6DEC8] hover:border-[#6B2837] shadow-sm flex items-center justify-between gap-3 disabled:opacity-60 transition"
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
                          className="w-full text-left bg-[#FFFCF7] rounded-2xl p-3.5 border border-[#E6DEC8] hover:border-[#6B2837] shadow-sm flex items-center justify-between gap-3 disabled:opacity-60 transition"
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
                        className="bg-[#FFFCF7] rounded-xl p-3 border border-[#E6DEC8] flex items-center justify-between gap-2 text-xs"
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
              {/* Optional Guest Details, Installable PWA App & Rate Us Trigger */}
              <GuestProfileAndAppCard
                businessName={qrLocation.business.name}
                sessionToken={sessionToken}
                onEnsureSession={ensureTableSessionToken}
                onNotify={showBanner}
              />

              {qrLocation.business.googleReviewUrl && (
                <button
                  type="button"
                  onClick={() => setShowRateUsModal(true)}
                  className="w-full h-11 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] px-4 flex items-center justify-between text-xs font-bold text-[#292320] cursor-pointer transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#A77B38] fill-[#A77B38]" />
                    <span>Rate Us on Google</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#71675E]" />
                </button>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 4: TABLE BILL REVIEW (BILL - Table QR)
             ========================================================= */}
          {activeTab === "BILL" && !isRoomQr && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#292320]">
                    Table {qrLocation.table?.tableNumber || ""} Bill
                  </h2>
                  <p className="text-xs text-[#71675E]">
                    Real-time order summary & dining charges
                  </p>
                </div>
                {sessionToken && (
                  <button
                    type="button"
                    onClick={() => fetchGuestSessionData(sessionToken, false)}
                    disabled={refreshingData}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFFCF7] border border-[#EEE7DD] text-xs font-bold text-[#6B2837] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="bg-[#FFFCF7] rounded-2xl p-8 text-center border border-[#EEE7DD] space-y-2">
                  <Receipt className="w-8 h-8 text-[#A77B38] mx-auto" />
                  <p className="text-sm font-bold text-[#292320]">No Orders Placed Yet</p>
                  <p className="text-xs text-[#71675E]">
                    Add items from the menu to see your table bill here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("MENU")}
                    className="px-4 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold mt-2 cursor-pointer"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Total Amount Due Card */}
                  {(() => {
                    const totalBillCents = orders.reduce(
                      (acc, ord) => acc + toCents(ord.totalAmount),
                      0
                    );
                    return (
                      <div className="rounded-2xl bg-[#6B2837] text-[#FFFCF7] p-5 border border-[#8B3547] shadow-md space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#F3E5AB]">
                            Table {qrLocation.table?.tableNumber} Total
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/15 text-[10px] font-bold">
                            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
                          </span>
                        </div>
                        <div className="text-2xl font-black tabular-nums">
                          {formatNPR(fromCents(totalBillCents))}
                        </div>
                        <p className="text-[11px] text-[#FFFCF7]/80">
                          Taxes and restaurant service charge included where applicable.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Orders Breakdown */}
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-[#FFFCF7] rounded-2xl p-4 border border-[#EEE7DD] shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-2">
                        <div>
                          <p className="text-xs font-bold text-[#292320]">
                            Order #{ord.orderNumber}
                          </p>
                          <p className="text-[10px] text-[#71675E]">
                            {new Date(ord.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF6F0] text-[#6B2837] border border-[#EEE7DD]">
                          {ord.settlementStatus}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {ord.rounds.flatMap((r) => r.lines).map((line) => (
                          <div
                            key={line.id}
                            className="flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="text-[#292320] font-medium">
                                {line.quantity}× {line.itemName}
                              </span>
                              {Array.isArray(line.appliedModifiers) && line.appliedModifiers.length > 0 && (
                                <p className="text-[10px] text-[#71675E] mt-0.5">
                                  {line.appliedModifiers.map((m) => m.optionName).join(", ")}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-[#292320] tabular-nums shrink-0">
                              {formatNPR(line.total)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-[#EEE7DD] space-y-1 text-xs">
                        {ord.subtotal !== undefined && (
                          <div className="flex items-center justify-between text-[#71675E]">
                            <span>Subtotal</span>
                            <span className="tabular-nums">{formatNPR(ord.subtotal)}</span>
                          </div>
                        )}
                        {ord.taxTotal !== undefined && toCents(ord.taxTotal) > 0 && (
                          <div className="flex items-center justify-between text-[#71675E]">
                            <span>Tax (VAT)</span>
                            <span className="tabular-nums">{formatNPR(ord.taxTotal)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between font-bold pt-1 border-t border-[#EEE7DD]/70">
                          <span className="text-[#292320]">Order Total</span>
                          <span className="text-[#6B2837] tabular-nums">
                            {formatNPR(ord.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Post-Order Rate Us Button on Table Bill */}
                  {qrLocation.business.googleReviewUrl && (
                    <button
                      type="button"
                      onClick={() => setShowRateUsModal(true)}
                      className="w-full h-11 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] px-4 flex items-center justify-between text-xs font-bold text-[#292320] cursor-pointer transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Star className="w-4 h-4 text-[#A77B38] fill-[#A77B38]" />
                        <span>Enjoyed your meal? Rate Us on Google</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#71675E]" />
                    </button>
                  )}

                  {/* 1-Tap Bill Settlement Request */}
                  <div className="rounded-2xl bg-[#FFFCF7] border border-[#EEE7DD] p-4 shadow-xs space-y-2.5">
                    <p className="text-xs font-bold text-[#292320]">
                      Ready to settle payment?
                    </p>
                    <p className="text-xs text-[#71675E] leading-relaxed">
                      Tap below to alert your waiter or cashier to bring the final tax invoice to your table.
                    </p>
                    <button
                      type="button"
                      disabled={
                        sendingRequestType === "BILL_REQUEST" ||
                        (cooldowns["BILL_REQUEST"] || 0) > 0
                      }
                      onClick={() => handleTriggerServiceRequest("BILL_REQUEST")}
                      className="w-full py-3 rounded-xl bg-[#6B2837] text-white font-bold text-xs shadow-sm hover:bg-[#541E2A] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>
                        {(cooldowns["BILL_REQUEST"] || 0) > 0
                          ? `Bill Requested (${formatCooldown(cooldowns["BILL_REQUEST"])})`
                          : sendingRequestType === "BILL_REQUEST"
                          ? "Calling Staff..."
                          : "Request Physical Bill at Table"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFFCF7] border border-[#E2D9C8] text-xs font-bold text-[#6B2837]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                )}
              </div>

              {!isVerified || !folioSummary ? (
                <div className="bg-[#FFFCF7] rounded-2xl p-5 border border-[#E6DEC8] shadow-sm space-y-4">
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
                      className="bg-[#FFFCF7] rounded-2xl p-4 border border-[#E6DEC8] shadow-sm space-y-3"
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

        {/* Floating Cart Bar (ONLY on MENU tab when cart drawer is closed) */}
        {activeTab === "MENU" && !isCartOpen && cartSummary.count > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-30 max-w-lg mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="guest-btn-primary w-full min-h-[52px] px-4 rounded-[12px] flex items-center justify-between cursor-pointer"
              style={{ boxShadow: "var(--guest-shadow-soft)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-[6px] font-semibold text-sm flex items-center justify-center tabular-nums"
                  style={{
                    backgroundColor: "var(--guest-accent-fg)",
                    color: "var(--guest-accent-text)",
                  }}
                >
                  {cartSummary.count}
                </span>
                <span className="text-base font-semibold">View Order Tray</span>
              </div>
              <div className="flex items-center gap-1.5 text-base font-semibold tabular-nums">
                <span>{formatNPR(cartSummary.subtotal)}</span>
                <ChevronRight className="w-5 h-5 shrink-0" />
              </div>
            </button>
          </div>
        )}

        {/* Sticky Bottom Navigation Bar — 44px+ tap targets, hairline top border, lifted dark surface */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 max-w-lg mx-auto px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
          style={{
            backgroundColor: "var(--guest-surface)",
            borderTop: "1px solid var(--guest-border)",
          }}
        >
          <div
            className={`grid ${
              orderChannel === "DINE_IN" || isRoomQr ? "grid-cols-4" : "grid-cols-2"
            } gap-1`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("MENU")}
              className="min-h-[48px] flex flex-col items-center justify-center py-1 rounded-[8px] text-sm font-medium transition-colors cursor-pointer"
              style={
                activeTab === "MENU"
                  ? {
                      backgroundColor: "var(--guest-accent-soft)",
                      color: "var(--guest-accent-text)",
                      fontWeight: 600,
                    }
                  : { color: "var(--guest-muted)" }
              }
            >
              <UtensilsCrossed className="w-5 h-5 mb-0.5 shrink-0" />
              <span>Menu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("TRACKER")}
              className="min-h-[48px] flex flex-col items-center justify-center py-1 rounded-[8px] text-sm font-medium transition-colors relative cursor-pointer"
              style={
                activeTab === "TRACKER"
                  ? {
                      backgroundColor: "var(--guest-accent-soft)",
                      color: "var(--guest-accent-text)",
                      fontWeight: 600,
                    }
                  : { color: "var(--guest-muted)" }
              }
            >
              <ChefHat className="w-5 h-5 mb-0.5 shrink-0" />
              <span>{orderChannel === "DINE_IN" || isRoomQr ? "Tracker" : "My Orders"}</span>
              {orders.length > 0 && (
                <span
                  className="absolute top-1.5 right-4 w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--guest-accent)" }}
                />
              )}
            </button>

            {(orderChannel === "DINE_IN" || isRoomQr) && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("SERVICES")}
                  className="min-h-[48px] flex flex-col items-center justify-center py-1 rounded-[8px] text-sm font-medium transition-colors cursor-pointer"
                  style={
                    activeTab === "SERVICES"
                      ? {
                          backgroundColor: "var(--guest-accent-soft)",
                          color: "var(--guest-accent-text)",
                          fontWeight: 600,
                        }
                      : { color: "var(--guest-muted)" }
                  }
                >
                  <Bell className="w-5 h-5 mb-0.5 shrink-0" />
                  <span>Services</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("BILL")}
                  className="min-h-[48px] flex flex-col items-center justify-center py-1 rounded-[8px] text-sm font-medium transition-colors cursor-pointer"
                  style={
                    activeTab === "BILL"
                      ? {
                          backgroundColor: "var(--guest-accent-soft)",
                          color: "var(--guest-accent-text)",
                          fontWeight: 600,
                        }
                      : { color: "var(--guest-muted)" }
                  }
                >
                  <Receipt className="w-5 h-5 mb-0.5 shrink-0" />
                  <span>{isRoomQr ? "Room Bill" : "Table Bill"}</span>
                </button>
              </>
            )}
          </div>
        </nav>

        {/* =========================================================
            MODAL: DISH DETAIL & CUSTOMIZATION (RESPONSIVE & CLEAN)
           ========================================================= */}
        {customizingItem && (() => {
          const curBaseCents = toCents(customizingItem.basePrice);
          const curModsCents = (customizingItem.modifierGroups || []).reduce((acc, mg) => {
            const selectedInGroup = (mg.modifierGroup?.options || []).filter((o) =>
              selectedModOptionIds.includes(o.id)
            );
            return acc + selectedInGroup.reduce((sum, opt) => sum + toCents(opt.priceDelta), 0);
          }, 0);
          const curTotalCents = (curBaseCents + curModsCents) * customItemQty;

          const hasHeroPhoto = Boolean(getItemImage(customizingItem));
          const realSectionName = itemSectionNameMap.get(customizingItem.id) || "Menu";

          return (
            <div
              className="fixed inset-0 z-50 bg-[#292320]/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-label={customizingItem.name}
              onClick={() => setCustomizingItem(null)}
            >
              <div
                className="bg-[#FFFCF7] w-full max-w-lg sm:max-w-md rounded-t-xl sm:rounded-xl max-h-[90dvh] overflow-hidden flex flex-col border-t sm:border border-[#D8CEC1]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Hero Dish Photo (compact header bar when no photo exists) */}
                {hasHeroPhoto ? (
                  <div className="relative aspect-16/9 w-full overflow-hidden bg-[#F7F3EC] shrink-0 border-b border-[#EEE7DD]">
                    <FoodImage item={customizingItem} iconClassName="w-10 h-10" />
                    <button
                      type="button"
                      aria-label="Close dish details"
                      onClick={() => setCustomizingItem(null)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#FFFCF7] border border-[#D8CEC1] flex items-center justify-center text-[#292320] hover:bg-[#F7F3EC] transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F7F3EC] border-b border-[#EEE7DD] shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B2837]">
                      {realSectionName}
                    </span>
                    <button
                      type="button"
                      aria-label="Close dish details"
                      onClick={() => setCustomizingItem(null)}
                      className="w-8 h-8 rounded-full bg-[#FFFCF7] border border-[#D8CEC1] flex items-center justify-center text-[#292320] hover:bg-[#EEE7DD] transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base sm:text-lg font-bold text-[#292320]">
                        {customizingItem.name}
                      </h2>
                      <span className="text-base font-extrabold text-[#6B2837] tabular-nums shrink-0">
                        {formatNPR(customizingItem.basePrice)}
                      </span>
                    </div>
                    {customizingItem.description && (
                      <p className="text-xs text-[#71675E] leading-relaxed mt-1">
                        {customizingItem.description}
                      </p>
                    )}
                    {Array.isArray(customizingItem.allergens) && customizingItem.allergens.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold uppercase text-[#946000]">Allergens:</span>
                        {customizingItem.allergens.map((alg) => (
                          <span
                            key={alg}
                            className="px-1.5 py-0.5 rounded bg-[#FDF7ED] border border-[#EDD7AD] text-[10px] font-semibold text-[#946000]"
                          >
                            {alg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Real Culinary Metrics from Menu */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F7F3EC] rounded-lg p-2.5 text-center border border-[#EEE7DD] space-y-0.5">
                      <Clock className="w-4 h-4 text-[#A77B38] mx-auto" />
                      <p className="text-xs font-bold text-[#292320] tabular-nums">
                        {customizingItem.prepTimeMinutes || 15} mins
                      </p>
                      <p className="text-[9px] uppercase font-semibold text-[#71675E]">Est. Prep Time</p>
                    </div>

                    <div className="bg-[#F7F3EC] rounded-lg p-2.5 text-center border border-[#EEE7DD] space-y-0.5">
                      <ChefHat className="w-4 h-4 text-[#6B2837] mx-auto" />
                      <p className="text-xs font-bold text-[#292320] truncate">
                        {realSectionName}
                      </p>
                      <p className="text-[9px] uppercase font-semibold text-[#71675E]">Menu Section</p>
                    </div>
                  </div>

                  {/* Modifiers & Options (supports radio for maxSelect === 1 + required validation) */}
                  {Array.isArray(customizingItem.modifierGroups) &&
                    customizingItem.modifierGroups.map((link) => {
                      const group = link.modifierGroup;
                      if (!group || !group.options || group.options.length === 0) return null;
                      const isSingleSelect = group.maxSelect === 1;
                      const groupOptionIds = group.options.map((o) => o.id);
                      return (
                        <div key={group.id} className="space-y-2 pt-2 border-t border-[#EEE7DD]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#292320]">
                              {group.displayName || group.name}
                            </span>
                            <span className={`text-[10px] font-semibold ${group.isRequired ? "text-[#6B2837]" : "text-[#71675E]"}`}>
                              {group.isRequired ? "Required" : "Optional"}
                              {group.maxSelect && group.maxSelect > 1 ? ` (up to ${group.maxSelect})` : ""}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {group.options.map((opt) => {
                              const checked = selectedModOptionIds.includes(opt.id);
                              const unavailable = opt.isAvailable === false;
                              return (
                                <label
                                  key={opt.id}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition ${
                                    unavailable
                                      ? "border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E] opacity-60 cursor-not-allowed"
                                      : checked
                                      ? "border-[#6B2837] bg-[#F7F3EC] font-semibold text-[#292320] cursor-pointer"
                                      : "border-[#EEE7DD] bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC]/50 cursor-pointer"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type={isSingleSelect ? "radio" : "checkbox"}
                                      name={isSingleSelect ? `mod-group-${group.id}` : undefined}
                                      disabled={unavailable}
                                      checked={checked}
                                      onChange={() => {
                                        if (unavailable) return;
                                        setSelectedModOptionIds((prev) => {
                                          if (isSingleSelect) {
                                            return [...prev.filter((id) => !groupOptionIds.includes(id)), opt.id];
                                          }
                                          return prev.includes(opt.id)
                                            ? prev.filter((id) => id !== opt.id)
                                            : [...prev, opt.id];
                                        });
                                      }}
                                      className="accent-[#6B2837] w-4 h-4 rounded"
                                    />
                                    <span>{opt.name}</span>
                                    {unavailable && <span className="text-[10px] text-[#B33432] font-semibold">(Sold Out)</span>}
                                  </div>
                                  {toCents(opt.priceDelta) > 0 && (
                                    <span className="text-[#6B2837] font-bold tabular-nums">
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

                  {/* Cooking / Preparation Notes */}
                  <div className="space-y-1.5 pt-2 border-t border-[#EEE7DD]">
                    <label className="block text-xs font-bold text-[#292320]">
                      Special Instructions
                    </label>
                    <input
                      type="text"
                      value={customItemNotes}
                      onChange={(e) => setCustomItemNotes(e.target.value)}
                      placeholder="e.g. Less spicy, no coriander, extra sauce..."
                      className="w-full px-3 py-2 rounded-lg bg-[#FFFCF7] border border-[#EEE7DD] text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-3.5 bg-[#FFFCF7] border-t border-[#EEE7DD] flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 bg-[#FAF6F0] p-1 rounded-lg border border-[#EEE7DD]">
                    <button
                      type="button"
                      onClick={() => setCustomItemQty((q) => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded bg-[#FFFCF7] border border-[#EEE7DD] flex items-center justify-center text-[#292320] cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold w-5 text-center tabular-nums text-[#292320]">
                      {customItemQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomItemQty((q) => q + 1)}
                      className="w-7 h-7 rounded bg-[#FFFCF7] border border-[#EEE7DD] flex items-center justify-center text-[#292320] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmCustomItem}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#6B2837] text-white font-bold text-xs hover:bg-[#541E2A] transition flex items-center justify-between cursor-pointer shadow-xs"
                  >
                    <span>Add to Tray</span>
                    <span className="tabular-nums font-extrabold">
                      {formatNPR(fromCents(curTotalCents))}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* =========================================================
            MODAL: CART DRAWER & SUBMIT ORDER
           ========================================================= */}
        {isCartOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:p-4"
            style={{ backgroundColor: "rgba(24, 20, 18, 0.56)" }}
          >
            <div
              className="w-full max-w-md rounded-t-[16px] sm:rounded-[16px] p-4 max-h-[88dvh] overflow-y-auto space-y-6"
              style={{
                backgroundColor: "var(--guest-surface-raised)",
                border: "1px solid var(--guest-border)",
                boxShadow: "var(--guest-shadow-soft)",
              }}
            >
              <div
                className="flex items-center justify-between gap-3 pb-3"
                style={{ borderBottom: "1px solid var(--guest-border)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingBag
                    className="w-5 h-5 shrink-0"
                    style={{ color: "var(--guest-accent-text)" }}
                  />
                  <h3 className="text-lg font-semibold leading-snug truncate">
                    Your {locationBadgeText} Tray
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Close order tray"
                  className="w-11 h-11 rounded-[8px] flex items-center justify-center cursor-pointer shrink-0"
                  style={{
                    backgroundColor: "var(--guest-surface-subtle)",
                    border: "1px solid var(--guest-border)",
                    color: "var(--guest-fg)",
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center space-y-4">
                  <p
                    className="text-base font-normal max-w-[40ch] mx-auto"
                    style={{ color: "var(--guest-muted)" }}
                  >
                    Your tray is empty. Browse the menu and tap + Add on any dish to begin your order.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="guest-btn-primary px-6 cursor-pointer"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((line) => (
                      <div
                        key={line.cartKey}
                        className="p-3 rounded-[8px] flex items-center justify-between gap-3"
                        style={{
                          backgroundColor: "var(--guest-surface-subtle)",
                          border: "1px solid var(--guest-border)",
                        }}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-base font-semibold leading-snug">{line.menuItem.name}</p>
                          {line.selectedOptions.length > 0 && (
                            <p className="text-sm font-normal" style={{ color: "var(--guest-muted)" }}>
                              + {line.selectedOptions.map((o) => o.name).join(", ")}
                            </p>
                          )}
                          {line.notes && (
                            <p className="text-sm italic" style={{ color: "var(--guest-muted)" }}>
                              Note: {line.notes}
                            </p>
                          )}
                          <p
                            className="text-sm font-semibold tabular-nums pt-1"
                            style={{ color: "var(--guest-accent-text)" }}
                          >
                            {formatNPR(fromCents(line.unitPriceCents * line.quantity))}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${line.menuItem.name}`}
                            onClick={() => updateCartQty(line.cartKey, -1)}
                            className="w-11 h-11 rounded-[8px] flex items-center justify-center cursor-pointer"
                            style={{
                              backgroundColor: "var(--guest-surface)",
                              border: "1px solid var(--guest-border)",
                            }}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-base font-semibold w-7 text-center tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${line.menuItem.name}`}
                            onClick={() => updateCartQty(line.cartKey, 1)}
                            className="w-11 h-11 rounded-[8px] flex items-center justify-center cursor-pointer"
                            style={{
                              backgroundColor: "var(--guest-surface)",
                              border: "1px solid var(--guest-border)",
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fulfillment Channel Selector — 44px tap targets, single accent */}
                  {!isRoomQr && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                          How would you like to receive your order?
                        </label>
                        <div
                          className={`grid ${isRemoteChannelMode ? "grid-cols-2" : "grid-cols-3"} gap-2`}
                        >
                          {!isRemoteChannelMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderChannel("DINE_IN");
                                setTableUnlockPrompt(null);
                                setChannelFieldErrors({});
                              }}
                              className="min-h-[44px] px-2 rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              style={
                                orderChannel === "DINE_IN"
                                  ? {
                                      backgroundColor: "var(--guest-accent-soft)",
                                      color: "var(--guest-accent-text)",
                                      border: "2px solid var(--guest-accent)",
                                    }
                                  : {
                                      backgroundColor: "var(--guest-surface-subtle)",
                                      color: "var(--guest-fg)",
                                      border: "1px solid var(--guest-border)",
                                    }
                              }
                            >
                              <UtensilsCrossed className="w-4 h-4 shrink-0" />
                              <span>Dine-In</span>
                            </button>
                          )}
                          {qrLocation?.guestPolicy?.takeawayEnabled !== false && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderChannel("TAKEAWAY");
                                setTableUnlockPrompt(null);
                                setChannelFieldErrors({});
                              }}
                              className="min-h-[44px] px-2 rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              style={
                                orderChannel === "TAKEAWAY"
                                  ? {
                                      backgroundColor: "var(--guest-accent-soft)",
                                      color: "var(--guest-accent-text)",
                                      border: "2px solid var(--guest-accent)",
                                    }
                                  : {
                                      backgroundColor: "var(--guest-surface-subtle)",
                                      color: "var(--guest-fg)",
                                      border: "1px solid var(--guest-border)",
                                    }
                              }
                            >
                              <ShoppingBag className="w-4 h-4 shrink-0" />
                              <span>Takeaway</span>
                            </button>
                          )}
                          {qrLocation?.guestPolicy?.deliveryEnabled !== false && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderChannel("DELIVERY");
                                setTableUnlockPrompt(null);
                                setChannelFieldErrors({});
                              }}
                              className="min-h-[44px] px-2 rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              style={
                                orderChannel === "DELIVERY"
                                  ? {
                                      backgroundColor: "var(--guest-accent-soft)",
                                      color: "var(--guest-accent-text)",
                                      border: "2px solid var(--guest-accent)",
                                    }
                                  : {
                                      backgroundColor: "var(--guest-surface-subtle)",
                                      color: "var(--guest-fg)",
                                      border: "1px solid var(--guest-border)",
                                    }
                              }
                            >
                              <Truck className="w-4 h-4 shrink-0" />
                              <span>Delivery</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {tableUnlockPrompt && orderChannel === "DINE_IN" && (
                        <div
                          className="p-3 rounded-[8px] text-sm space-y-3"
                          style={{
                            backgroundColor: "var(--guest-warning-bg)",
                            color: "var(--guest-warning)",
                            border: "1px solid var(--guest-warning-border)",
                          }}
                        >
                          <p className="font-medium max-w-[60ch]">{tableUnlockPrompt}</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleRequestTableUnlock}
                              className="guest-btn-primary px-4 cursor-pointer"
                            >
                              Notify Waiter
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderChannel("DELIVERY");
                                setTableUnlockPrompt(null);
                              }}
                              className="guest-btn-secondary px-4 cursor-pointer"
                            >
                              Switch to Delivery
                            </button>
                          </div>
                        </div>
                      )}

                      {(orderChannel === "TAKEAWAY" || orderChannel === "DELIVERY") && (
                        <div
                          className="p-4 rounded-[12px] space-y-4"
                          style={{
                            backgroundColor: "var(--guest-surface-subtle)",
                            border: "1px solid var(--guest-border)",
                          }}
                        >
                          <div className="space-y-1">
                            <label htmlFor="guest-channel-name" className="block text-sm font-semibold">
                              Your Name *
                            </label>
                            <input
                              id="guest-channel-name"
                              type="text"
                              value={channelName}
                              aria-invalid={Boolean(channelFieldErrors.name)}
                              onChange={(e) => {
                                setChannelName(e.target.value);
                                if (channelFieldErrors.name)
                                  setChannelFieldErrors((p) => ({ ...p, name: "" }));
                              }}
                              placeholder="Full name"
                              className="guest-input"
                            />
                            {channelFieldErrors.name && (
                              <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                                {channelFieldErrors.name}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label htmlFor="guest-channel-phone" className="block text-sm font-semibold">
                              Mobile Number *
                            </label>
                            <input
                              id="guest-channel-phone"
                              type="tel"
                              value={channelPhone}
                              aria-invalid={Boolean(channelFieldErrors.phone)}
                              onChange={(e) => {
                                setChannelPhone(e.target.value);
                                if (channelFieldErrors.phone)
                                  setChannelFieldErrors((p) => ({ ...p, phone: "" }));
                              }}
                              placeholder="98XXXXXXXX"
                              className="guest-input tabular-nums"
                            />
                            {channelFieldErrors.phone && (
                              <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                                {channelFieldErrors.phone}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label htmlFor="guest-channel-email" className="block text-sm font-semibold">
                              Email (Optional)
                            </label>
                            <input
                              id="guest-channel-email"
                              type="email"
                              value={channelEmail}
                              aria-invalid={Boolean(channelFieldErrors.email)}
                              onChange={(e) => {
                                setChannelEmail(e.target.value);
                                if (channelFieldErrors.email)
                                  setChannelFieldErrors((p) => ({ ...p, email: "" }));
                              }}
                              placeholder="name@example.com"
                              className="guest-input"
                            />
                            {channelFieldErrors.email && (
                              <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                                {channelFieldErrors.email}
                              </p>
                            )}
                          </div>

                          {orderChannel === "DELIVERY" && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <label htmlFor="guest-channel-addr" className="text-sm font-semibold">
                                  Delivery Address *
                                </label>
                                <button
                                  type="button"
                                  onClick={handleCaptureChannelGps}
                                  disabled={locatingGps}
                                  className="min-h-[36px] px-2 text-sm font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  style={{ color: "var(--guest-accent-text)" }}
                                >
                                  <MapPin className="w-4 h-4 shrink-0" />
                                  <span>
                                    {channelCoords
                                      ? "GPS Attached"
                                      : locatingGps
                                      ? "Locating..."
                                      : "Use My GPS"}
                                  </span>
                                </button>
                              </div>
                              <textarea
                                id="guest-channel-addr"
                                rows={2}
                                value={channelAddress}
                                aria-invalid={Boolean(channelFieldErrors.address)}
                                onChange={(e) => {
                                  setChannelAddress(e.target.value);
                                  if (channelFieldErrors.address)
                                    setChannelFieldErrors((p) => ({ ...p, address: "" }));
                                }}
                                placeholder="Street, Tole, House/Flat No., Nearby Landmark"
                                className="guest-input"
                              />
                              {channelFieldErrors.address && (
                                <p className="text-sm font-medium" style={{ color: "var(--guest-danger)" }}>
                                  {channelFieldErrors.address}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Payment Method */}
                          <div className="space-y-1.5">
                            <label className="block text-sm font-semibold">Payment Method</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setChannelPaymentPref(
                                    orderChannel === "DELIVERY" ? "COD" : "PAY_AT_PICKUP"
                                  )
                                }
                                className="min-h-[44px] px-3 rounded-[8px] text-sm font-semibold cursor-pointer transition-colors"
                                style={
                                  channelPaymentPref !== "ONLINE_QR"
                                    ? {
                                        backgroundColor: "var(--guest-accent-soft)",
                                        color: "var(--guest-accent-text)",
                                        border: "2px solid var(--guest-accent)",
                                      }
                                    : {
                                        backgroundColor: "var(--guest-surface)",
                                        color: "var(--guest-fg)",
                                        border: "1px solid var(--guest-border)",
                                      }
                                }
                              >
                                {orderChannel === "DELIVERY" ? "Cash on Delivery" : "Pay at Pickup"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setChannelPaymentPref("ONLINE_QR")}
                                className="min-h-[44px] px-3 rounded-[8px] text-sm font-semibold cursor-pointer transition-colors"
                                style={
                                  channelPaymentPref === "ONLINE_QR"
                                    ? {
                                        backgroundColor: "var(--guest-accent-soft)",
                                        color: "var(--guest-accent-text)",
                                        border: "2px solid var(--guest-accent)",
                                      }
                                    : {
                                        backgroundColor: "var(--guest-surface)",
                                        color: "var(--guest-fg)",
                                        border: "1px solid var(--guest-border)",
                                      }
                                }
                              >
                                Online QR
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="guest-kitchen-notes" className="block text-sm font-semibold">
                      Kitchen Notes (Optional)
                    </label>
                    <input
                      id="guest-kitchen-notes"
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Allergies, spice level, extra cutlery..."
                      className="guest-input"
                    />
                  </div>

                  {qrLocation?.guestPolicy?.cancellationPolicyText && (
                    <div
                      className="p-3 rounded-[8px] text-sm leading-relaxed max-w-[65ch]"
                      style={{
                        backgroundColor: "var(--guest-surface-subtle)",
                        border: "1px solid var(--guest-border)",
                        color: "var(--guest-muted)",
                      }}
                    >
                      <span className="font-semibold" style={{ color: "var(--guest-fg)" }}>
                        Cancellation policy:{" "}
                      </span>
                      {qrLocation.guestPolicy.cancellationPolicyText}
                    </div>
                  )}

                  <div
                    className="pt-4 space-y-4"
                    style={{ borderTop: "1px solid var(--guest-border)" }}
                  >
                    <div className="flex items-center justify-between text-base">
                      <span style={{ color: "var(--guest-muted)" }}>Estimated Subtotal</span>
                      <span
                        className="text-lg font-semibold tabular-nums"
                        style={{ color: "var(--guest-accent-text)" }}
                      >
                        {formatNPR(cartSummary.subtotal)}
                      </span>
                    </div>

                    {/* Single filled primary CTA in the Cart Drawer */}
                    <button
                      type="button"
                      disabled={submittingOrder}
                      onClick={handleSubmitOrder}
                      className="guest-btn-primary w-full px-4 inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-5 h-5 shrink-0" />
                      <span>
                        {submittingOrder
                          ? "Submitting Order..."
                          : orderChannel === "DELIVERY"
                          ? "Place Delivery Order"
                          : orderChannel === "TAKEAWAY"
                          ? "Place Takeaway Order"
                          : isRoomQr && !isVerified
                          ? "Verify Room & Submit Order"
                          : !isVerified &&
                            (qrLocation?.table?.pinRequired ||
                              qrLocation?.table?.status === "OCCUPIED" ||
                              !qrLocation?.table?.isSettled)
                          ? "Enter PIN & Place Order"
                          : "Submit Dine-In Order"}
                      </span>
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
            <div className="bg-[#FFFCF7] w-full max-w-sm rounded-xl p-5 border border-[#D8CEC1] space-y-4">
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
        {/* =========================================================
            MODAL: TABLE DINING PIN VERIFICATION & ANTI-PRANK GUARD
           ========================================================= */}
        {showTablePinModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#FFFCF7] w-full max-w-sm rounded-2xl p-5 border border-[#D8CEC1] space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#D8CEC1] flex items-center justify-center text-[#6B2837]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1E1B18]">
                      Join Table {qrLocation.table?.tableNumber || ""}
                    </h3>
                    <p className="text-[11px] text-[#6E655F]">
                      Active dining session in progress
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTablePinModal(false)}
                  className="text-[#8C827A] hover:text-[#1E1B18]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {qrLocation.table?.isBilledLocked || qrLocation.table?.isSettling || qrLocation.table?.status === "BILLED" ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
                    <p className="font-bold">Bill settlement is in progress</p>
                    <p>The previous bill at Table {qrLocation.table?.tableNumber || ""} is being settled by our cashier. Please wait a moment or alert our staff below if you are a new guest.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAlertStaffTurnover}
                    disabled={sendingTurnoverAlert}
                    className="w-full py-2.5 rounded-xl bg-[#6B2837] text-white text-xs font-bold hover:bg-[#541E2A] transition cursor-pointer"
                  >
                    {sendingTurnoverAlert ? "Alerting Server..." : "We Are New Guests (Reset Table)"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyTablePin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E1B18] mb-1">
                      Enter 4-Digit Dining PIN
                    </label>
                    <p className="text-[11px] text-[#71675E] mb-2">
                      Table {qrLocation.table?.tableNumber || ""} has an active dining session. Enter the table&apos;s 4-digit PIN to place your order.
                    </p>
                    <input
                      type="text"
                      maxLength={4}
                      value={tablePinInput}
                      onChange={(e) => setTablePinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="e.g. 4821"
                      className="w-full px-3 py-2.5 text-center font-mono font-bold text-lg tracking-widest rounded-xl bg-[#FAF6F0] border border-[#D8CEC1] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>

                  {tablePinError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                      {tablePinError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAlertStaffTurnover}
                      disabled={sendingTurnoverAlert}
                      className="text-[11px] font-semibold text-[#6B2837] hover:underline cursor-pointer"
                    >
                      {tableAlertSent ? "Server Alerted" : "Previous guests left?"}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTablePinModal(false)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6E655F]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={verifying || tablePinInput.length !== 4}
                        className="px-4 py-2 rounded-xl bg-[#6B2837] text-white text-xs font-bold shadow hover:bg-[#541E2A] disabled:opacity-50 cursor-pointer"
                      >
                        {verifying ? "Verifying..." : "Verify & Order"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
        {/* =========================================================
            MODAL: INVITE TABLE COMPANIONS (GROUP ORDERING)
           ========================================================= */}
        {showGroupShareModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#FFFCF7] w-full max-w-sm rounded-2xl p-6 border border-[#D8CEC1] space-y-4">
              <div className="flex items-start justify-between pb-2 border-b border-[#EEE7DD]">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EEE7DD] text-[#6B2837] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#292320]">
                      Invite Table Companions
                    </h3>
                    <p className="text-[11px] text-[#71675E]">
                      Table {qrLocation.table?.tableNumber || ""} • Group Ordering
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroupShareModal(false)}
                  className="text-[#71675E] hover:text-[#292320] p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center space-y-3">
                <p className="text-xs text-[#71675E] leading-relaxed">
                  Friends at your table can scan this QR code with their phone camera to start ordering dishes together:
                </p>

                {/* ISO Standard Companion QR Code */}
                <div className="inline-block p-3.5 bg-[#FFFCF7] rounded-xl border border-[#D8CEC1] shadow-xs">
                  <DeterministicQrMatrixSvg value={companionShareUrl} size={180} />
                  <p className="text-[10px] text-[#71675E] font-medium mt-2">
                    Point camera at this screen to join instantly
                  </p>
                </div>

                {/* 1-Tap Share / WhatsApp / Copy Link */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        try {
                          await navigator.share({
                            title: `Order Together at Table ${qrLocation.table?.tableNumber || ""}`,
                            text: `Join our dining table ${qrLocation.table?.tableNumber || ""} at ${qrLocation.business.name} to order dishes!`,
                            url: companionShareUrl,
                          });
                          return;
                        } catch {
                          // fallback to copy
                        }
                      }
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        await navigator.clipboard.writeText(companionShareUrl);
                        setCopiedShareLink(true);
                        setTimeout(() => setCopiedShareLink(false), 2500);
                        showBanner("Invite link copied! Share it in your WhatsApp / Messenger chat.", "success");
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#6B2837] text-white text-xs font-bold hover:bg-[#541E2A] transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {copiedShareLink ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Invite Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Share Invite (WhatsApp / Chat)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Fallback 4-digit PIN */}
                {tablePin && (
                  <div className="pt-2 border-t border-[#EEE7DD] text-center">
                    <span className="text-[11px] text-[#71675E]">Or enter 4-digit PIN manually: </span>
                    <span className="font-mono font-bold text-sm text-[#292320] px-2 py-0.5 rounded bg-[#EEE7DD]">
                      {tablePin}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGroupShareModal(false)}
                className="w-full py-2 rounded-xl bg-[#EEE7DD] text-[#292320] text-xs font-semibold hover:bg-[#D8CEC1] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: MOBILE SEARCH & CHEF FOOD RECOMMENDATIONS
           ========================================================= */}
        {isSearchModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#292320]/45 flex flex-col justify-start p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Search menu"
          >
            <div className="bg-[#FFFCF7] w-full max-w-lg sm:max-w-md mx-auto sm:rounded-xl h-[100dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col border-0 sm:border border-[#D8CEC1]">
              {/* Search Header Bar */}
              <div className="p-3.5 border-b border-[#EEE7DD] bg-[#FFFCF7] sm:rounded-t-xl flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-4 h-4 text-[#71675E] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes, momos, drinks..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] text-xs sm:text-sm text-[#292320] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (filteredSections.flatMap((s) => s.items).length === 0) {
                      setSearchQuery("");
                    }
                    setIsSearchModalOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-bold text-[#6B2837] hover:bg-[#F7F3EC] rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Search Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {searchQuery.trim() ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-[#71675E] tabular-nums">
                      Search Results ({filteredSections.flatMap((s) => s.items).length})
                    </p>
                    {filteredSections.flatMap((s) => s.items).length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#71675E] space-y-1">
                        <UtensilsCrossed className="w-6 h-6 text-[#A77B38] mx-auto mb-1" />
                        <p className="font-bold text-[#292320]">No dishes found</p>
                        <p>Try searching with another keyword or explore Chef&apos;s Picks.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredSections.flatMap((s) => s.items).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setIsSearchModalOpen(false);
                              handleSelectMenuItem(item);
                            }}
                            className="p-3 rounded-lg bg-[#FFFCF7] border border-[#D8CEC1] flex items-center justify-between gap-3 hover:border-[#6B2837] transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 border border-[#EEE7DD]">
                                <FoodImage item={item} iconClassName="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[#292320] truncate">
                                  {item.name}
                                </h4>
                                <p className="text-[11px] text-[#6B2837] font-extrabold tabular-nums">
                                  {formatNPR(item.basePrice)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleQuickAddMenuItem(e, item)}
                              className="h-8 px-3 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold shrink-0 cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                        <ChefHat className="w-4 h-4 text-[#6B2837]" />
                        Chef&apos;s Picks
                      </span>
                      <span className="text-[10px] text-[#71675E] font-semibold">Menu Favorites</span>
                    </div>

                    <div className="space-y-2">
                      {popularItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setIsSearchModalOpen(false);
                            handleSelectMenuItem(item);
                          }}
                          className="p-3 rounded-lg bg-[#FFFCF7] border border-[#D8CEC1] flex items-center justify-between gap-3 hover:border-[#6B2837] transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 border border-[#EEE7DD]">
                              <FoodImage item={item} iconClassName="w-5 h-5" />
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <h4 className="text-xs font-bold text-[#292320] truncate">
                                {item.name}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] text-[#71675E] line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                              <p className="text-xs text-[#6B2837] font-extrabold tabular-nums">
                                {formatNPR(item.basePrice)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleQuickAddMenuItem(e, item)}
                            className="h-8 px-3 rounded-md bg-[#6B2837] text-[#FFFCF7] text-xs font-bold hover:bg-[#541E2A] transition shrink-0 cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Floating Install Mobile App Popup (shown when cart bar isn't covering bottom) */}
        {!(activeTab === "MENU" && !isCartOpen && cartSummary.count > 0) && (
          <InstallAppPopup businessName={qrLocation.business.name} />
        )}

        {/* Floating Rate Us on Google Modal */}
        {showRateUsModal && (
          <div
            className="fixed inset-0 z-50 bg-[#292320]/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Rate us on Google"
            onClick={() => setShowRateUsModal(false)}
          >
            <div
              className="w-full max-w-lg sm:max-w-md rounded-t-xl sm:rounded-xl bg-[#FFFCF7] border-t sm:border border-[#D8CEC1] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B2837]">
                  Google Review
                </span>
                <button
                  type="button"
                  aria-label="Close review dialog"
                  onClick={() => setShowRateUsModal(false)}
                  className="p-1 rounded-md text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <GoogleReviewCard
                publicCode={publicCode}
                businessName={qrLocation.business.name}
                initialReviewUrl={qrLocation.business.googleReviewUrl}
              />
            </div>
          </div>
        )}

        {orderActionModal && (
          <GuestOrderActionModal
            mode={orderActionModal.mode}
            orderNumber={orderActionModal.order.orderNumber}
            settlementStatus={orderActionModal.order.settlementStatus}
            lines={(orderActionModal.order.rounds || []).flatMap((r) => r.lines || [])}
            cancellationPolicyText={qrLocation.guestPolicy?.cancellationPolicyText}
            refundPolicyText={qrLocation.guestPolicy?.refundPolicyText}
            submitting={actionSubmitting}
            error={actionError}
            onClose={() => {
              setOrderActionModal(null);
              setActionError(null);
            }}
            onSubmitCancel={handleCancelOrRefundOrder}
            onSubmitPackTakeaway={handlePackTakeawayOrder}
            onSubmitDelivery={handleDeliverElsewhereOrder}
          />
        )}
      </div>
    </div>
  );
}
