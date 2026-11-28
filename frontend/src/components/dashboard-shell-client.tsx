"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { clearCaches } from "@/lib/cache-utils";
import { apiClient } from "@/core/api/api-client";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";
import { navigationConfig, NavItem, Role } from "@/lib/nav-config";
import { isFirebaseWebConfigured, registerWebPushToken, subscribeForegroundPush } from "@/lib/firebase-client";
import { playNotificationChime, showBrowserNotification, vibrateMobile } from "@/lib/notification-alert";
import { toast } from "@/components/toast";
import { OpenShiftModal } from "@/components/shifts/open-shift-modal";
import {
  LogOut,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  Calculator,
  ChevronRight,
  Store,
  AlertTriangle,
  Clock,
  User,
  Loader2,
  Search,
  Zap,
  ShoppingCart,
  Package,
  Coins,
  TrendingUp,
  LayoutGrid,
  PanelLeft,
  PanelLeftClose,
  SlidersHorizontal,
  Building2,
  ShieldCheck,
  FileText,
  CreditCard,
  Layers,
  Users,
  LifeBuoy,
  History,
  Activity,
  Settings,
  Boxes,
  Megaphone,
  BarChart3,
  Rocket,
  MessageSquare,
  BellRing,
} from "lucide-react";

interface UserMeta {
  name: string;
  email: string;
  role: string;
  branchId: string | null;
}

// Feature flag: auto-logout after inactivity. Off for now; flip to true to re-enable.
const ENABLE_INACTIVITY_AUTO_LOGOUT = false;

interface BranchMeta {
  id: string;
  name: string;
  isMain: boolean;
}

interface NotificationMeta {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority?: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

interface SubscriptionMeta {
  plan: string;
  endDate: Date | string;
  status: string;
  packageType?: string;
  enabledModules?: string[];
  billingCycle?: string;
}

function SubscriptionTimer({
  endDate,
  plan,
  status,
  billingCycle,
}: SubscriptionMeta) {
  const [timeLeft, setTimeLeft] = React.useState("");
  const [urgency, setUrgency] = React.useState<"normal" | "warning" | "danger">("normal");
  const [visible, setVisible] = React.useState(false);

  const formattedEnd = React.useMemo(() => {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [endDate]);

  React.useEffect(() => {
    const isAnnual = ["ANNUAL", "YEARLY"].includes((billingCycle || "").toUpperCase());
    const thresholdDays = isAnnual ? 30 : 7;

    function updateTimer() {
      const end = new Date(endDate);
      const now = new Date();
      const diff = end.getTime() - now.getTime();

      if (diff <= 0 || status !== "ACTIVE") {
        setTimeLeft("Expired");
        setUrgency("danger");
        setVisible(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Only show renewal countdown when within threshold (<=30d for annual, <=7d for monthly)
      if (days > thresholdDays) {
        setVisible(false);
        return;
      }

      setVisible(true);
      if (days > 7) {
        setTimeLeft(`${days}d left`);
        setUrgency("warning");
      } else if (days >= 1) {
        setTimeLeft(`${days}d ${hours}h left`);
        setUrgency("danger");
      } else {
        setTimeLeft(`${hours}h ${minutes}m left`);
        setUrgency("danger");
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [endDate, status, billingCycle]);

  if (!visible) return null;

  const colorClasses = {
    normal: "bg-[#F7F3EC] border-[#D8CEC1] text-[#71675E]",
    warning: "bg-[#FDF7ED] border-[#EDD7AD] text-[#946000]",
    danger: "bg-[#FAF0F1] border-[#E9B6B7] text-[#B33432] font-bold",
  };

  return (
    <Link
      href="/dashboard/subscriptions"
      suppressHydrationWarning
      className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-[11px] font-semibold tabular-nums whitespace-nowrap transition-colors hover:bg-[#EEE7DD]/70 ${colorClasses[urgency]}`}
      title={`${plan} plan${formattedEnd ? ` • Renews ${formattedEnd}` : ""}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
      <span suppressHydrationWarning>{timeLeft}</span>
    </Link>
  );
}

export default function DashboardShellClient({
  children,
  user,
  branches,
  initialNotifications,
  subscription,
  features,
}: {
  children: React.ReactNode;
  user: UserMeta;
  branches: BranchMeta[];
  initialNotifications: any[];
  subscription?: SubscriptionMeta | null;
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const { status, update } = useSession();
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [broadcastsList, setBroadcastsList] = React.useState<any[]>([]);
  const [dismissedNoticeIds, setDismissedNoticeIds] = React.useState<string[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationMeta[]>(initialNotifications);
  const [unreadAlertCount, setUnreadAlertCount] = React.useState<number>(
    initialNotifications.filter((n: any) => !n.isRead).length
  );
  const [notifTab, setNotifTab] = React.useState<"all" | "notices" | "alerts">("all");
  const [pushReady, setPushReady] = React.useState(false);

  const unreadBroadcasts = React.useMemo(() => {
    return broadcastsList.filter((b) => !dismissedNoticeIds.includes(b.id));
  }, [broadcastsList, dismissedNoticeIds]);

  const totalNotificationsCount = unreadAlertCount + unreadBroadcasts.length;

  const seenNotificationIdsRef = React.useRef<Set<string>>(
    new Set(initialNotifications.map((n: any) => n.id))
  );
  const notificationsHydratedRef = React.useRef<boolean>(initialNotifications.length > 0);

  const fetchLiveNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=40", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        const list = data.notifications as NotificationMeta[];

        // Detect brand-new unread notifications arriving while user is online
        if (notificationsHydratedRef.current) {
          const newlyArrived = list.filter(
            (n) => !n.isRead && !seenNotificationIdsRef.current.has(n.id)
          );
          if (newlyArrived.length > 0) {
            const hasUrgent = newlyArrived.some(
              (n) => n.priority === "URGENT" || n.priority === "HIGH" || n.category === "ORDER" || n.category === "KITCHEN"
            );
            playNotificationChime(hasUrgent ? "order" : "info");
            vibrateMobile([100, 50, 100]);

            // Flood-safe toast batching (handles 20+ simultaneous orders cleanly)
            const toShow = newlyArrived.slice(0, 2);
            toShow.forEach((n) => {
              const text = `${n.title}: ${n.message}`;
              if (n.priority === "URGENT" || n.priority === "HIGH") {
                toast.warning(text, 6500);
              } else {
                toast.info(text, 5500);
              }
              if (document.visibilityState !== "visible") {
                showBrowserNotification(n.title, n.message, {
                  tag: (n as any).dedupeKey || n.id,
                  actionUrl: n.actionUrl,
                });
              }
            });
            if (newlyArrived.length > 2) {
              toast.info(
                `+${newlyArrived.length - 2} more new notifications — click the bell to review all.`,
                5500
              );
            }
          }
        }

        list.forEach((n) => seenNotificationIdsRef.current.add(n.id));
        notificationsHydratedRef.current = true;
        setNotifications(list);
        setUnreadAlertCount(
          typeof data.unreadCount === "number"
            ? data.unreadCount
            : list.filter((n) => !n.isRead).length
        );
      }
    } catch {
      // keep existing notifications on transient network error
    }
  }, []);

  useVisibilityPolling(fetchLiveNotifications, 5000, { enabled: true });

  React.useEffect(() => {
    fetchLiveNotifications();
    if (user.role !== "SUPER_ADMIN") {
      apiClient.settings
        .getBroadcasts()
        .then((data) => {
          if (Array.isArray(data?.broadcasts)) {
            setBroadcastsList(data.broadcasts);
          }
        })
        .catch(() => {});
    }

    // Auto-register FCM push token if browser permission already granted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      registerWebPushToken().then((t) => {
        if (t) setPushReady(true);
      });
    }

    let unsubscribe: (() => void) | undefined;
    subscribeForegroundPush((payload) => {
      const notifId = payload.notificationId;
      if (notifId) {
        if (seenNotificationIdsRef.current.has(notifId)) return;
        seenNotificationIdsRef.current.add(notifId);
      }
      toast.info(`${payload.title}: ${payload.body}`);
      fetchLiveNotifications();
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchLiveNotifications, user.role]);
  const [superAdminSidebarCollapsed, setSuperAdminSidebarCollapsed] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);

  // Active cashier shift state for Appbar
  const [activeShift, setActiveShift] = React.useState<any>(null);
  const [openShiftModalOpen, setOpenShiftModalOpen] = React.useState(false);

  const fetchActiveShift = React.useCallback(async () => {
    if (user.role === "SUPER_ADMIN") return;
    try {
      const res = await fetch("/api/v1/shifts/current");
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasActiveShift) {
        setActiveShift(data.shift);
      } else {
        setActiveShift(null);
      }
    } catch {
      // Preserve existing activeShift on transient network dropouts
    }
  }, [user.role]);

  useVisibilityPolling(fetchActiveShift, 25000, {
    immediate: true,
    enabled: user.role !== "SUPER_ADMIN",
  });

  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = React.useState(false);
  const [inactivityCountdown, setInactivityCountdown] = React.useState(30);
  const lastActivityRef = React.useRef<number>(Date.now());

  const [quickNavOpen, setQuickNavOpen] = React.useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<{
    products: Array<{ id: string; name: string; sku: string; sellingPrice: number | string }>;
    customers: Array<{ id: string; name: string; phone: string }>;
    suppliers: Array<{ id: string; name: string; phone: string }>;
  }>({ products: [], customers: [], suppliers: [] });
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const frequentServices = React.useMemo(() => [
    {
      name: "Restaurant POS Terminal",
      desc: "Process table, takeaway & delivery orders and settle bills",
      href: "/dashboard/restaurant/pos?view=menu",
      icon: ShoppingCart,
      color: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    },
    {
      name: "Menu Management",
      desc: "Manage restaurant menu dishes, prices, categories & recipes",
      href: "/dashboard/products",
      icon: Package,
      color: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
    {
      name: "Daily Sales Report",
      desc: "Track margins, total VAT collected, cost breakdown",
      href: "/dashboard/reports/daily",
      icon: TrendingUp,
      color: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
    },
    {
      name: "Record Expense",
      desc: "Log daily outward operations cost",
      href: "/dashboard/expenses",
      icon: Coins,
      color: "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-450",
    },
    {
      name: "Outstanding Balances",
      desc: "Track payables and client credits limit",
      href: "/dashboard/reports/outstanding",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    },
  ], []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Inactivity tracking (5 minutes auto-logout with 30 seconds warning modal)
  // Disabled for now. Set ENABLE_INACTIVITY_AUTO_LOGOUT to true to re-enable.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ENABLE_INACTIVITY_AUTO_LOGOUT) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      setShowInactivityWarning(false);
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      const inactivityLimit = 5 * 60 * 1000; // 5 minutes (300,000ms)
      const warningThreshold = inactivityLimit - 30 * 1000; // 4 minutes 30 seconds (270,000ms)

      if (timeSinceLastActivity >= inactivityLimit) {
        clearInterval(checkInterval);
        clearCaches();
        signOut({ callbackUrl: "/auth/login" });
      } else if (timeSinceLastActivity >= warningThreshold) {
        setShowInactivityWarning(true);
        const secondsLeft = Math.ceil((inactivityLimit - timeSinceLastActivity) / 1000);
        setInactivityCountdown(secondsLeft > 0 ? secondsLeft : 0);
      } else {
        setShowInactivityWarning(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(checkInterval);
    };
  }, []);

  React.useEffect(() => {
    if (headerSearchQuery.trim() === "") {
      setSearchResults({ products: [], customers: [], suppliers: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiClient.settings.search(headerSearchQuery);
        setSearchResults(data);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [headerSearchQuery]);

  const router = useRouter();
  const [superAdminSearchQuery, setSuperAdminSearchQuery] = React.useState("");

  const superAdminPageTitle = React.useMemo(() => {
    if (pathname.includes("/businesses/pending")) return "Pending approvals";
    if (pathname.includes("/businesses/expiring")) return "Expiring subscriptions";
    if (pathname.includes("/businesses")) return "Businesses";
    if (pathname.includes("/onboarding")) return "Onboarding";
    if (pathname.includes("/requests")) return "Approvals";
    if (pathname.includes("/subscriptions/plans")) return "Plans & Pricing";
    if (pathname.includes("/subscriptions")) return "Subscriptions & Plans";
    if (pathname.includes("/revenue")) return "Billing & payments";
    if (pathname.includes("/modules")) return "Modules & Features";
    if (pathname.includes("/notices")) return "Broadcast notices";
    if (pathname.includes("/notifications")) return "Push notifications";
    if (pathname.includes("/chat")) return "Direct chat";
    if (pathname.includes("/reports")) return "Platform reports";
    if (pathname.includes("/users")) return "Users & access";
    if (pathname.includes("/support")) return "Support";
    if (pathname.includes("/activity-logs")) return "Audit log";
    if (pathname.includes("/monitoring")) return "System monitoring";
    if (pathname.includes("/settings")) return "Settings";
    return "Overview";
  }, [pathname]);

  const superAdminWorkspaceItems = [
    { title: "Overview", href: "/dashboard/super-admin", icon: LayoutGrid },
    {
      title: "Businesses",
      href: "/dashboard/super-admin/businesses",
      icon: Building2,
      children: [
        { title: "All Businesses", href: "/dashboard/super-admin/businesses", icon: Store },
        { title: "Pending Approvals", href: "/dashboard/super-admin/businesses/pending", icon: ShieldCheck },
        { title: "Expiring Subscriptions", href: "/dashboard/super-admin/businesses/expiring", icon: Clock },
      ],
    },
    {
      title: "Subscriptions & Plans",
      href: "/dashboard/super-admin/subscriptions",
      icon: CreditCard,
      children: [
        { title: "All Subscriptions", href: "/dashboard/super-admin/subscriptions", icon: CreditCard },
        { title: "Plans & Pricing", href: "/dashboard/super-admin/subscriptions/plans", icon: Layers },
      ],
    },
    { title: "Billing & payments", href: "/dashboard/super-admin/revenue", icon: CreditCard },
    { title: "Modules & Features", href: "/dashboard/super-admin/modules", icon: Boxes },
    { title: "Broadcast notices", href: "/dashboard/super-admin/notices", icon: Megaphone },
    { title: "Direct messages", href: "/dashboard/super-admin/chat", icon: MessageSquare },
    { title: "Push notifications", href: "/dashboard/super-admin/notifications", icon: BellRing },
    { title: "Reports & exports", href: "/dashboard/super-admin/reports", icon: BarChart3 },
  ];

  const superAdminAdminItems = [
    { title: "Users & access", href: "/dashboard/super-admin/users", icon: Users },
    { title: "Support", href: "/dashboard/super-admin/support", icon: LifeBuoy },
    { title: "Audit log", href: "/dashboard/super-admin/activity-logs", icon: History },
    { title: "System monitoring", href: "/dashboard/super-admin/monitoring", icon: Activity },
    { title: "Settings", href: "/dashboard/super-admin/settings", icon: Settings },
  ];

  const renderSuperAdminNavItem = (item: any, isMobile = false) => {
    const isExact = pathname === item.href || (item.href === "/dashboard/super-admin" && pathname === "/dashboard");
    const isSub = item.href !== "/dashboard/super-admin" && pathname.startsWith(item.href);
    const hasActiveChild = item.children?.some(
      (child: any) =>
        pathname === child.href ||
        (child.href !== "/dashboard/super-admin/businesses" && pathname.startsWith(child.href))
    );
    const isActive = isExact || isSub || hasActiveChild;
    const isExpanded =
      expandedMenus[item.title] !== undefined
        ? expandedMenus[item.title]
        : isActive || hasActiveChild;
    const Icon = item.icon;

    if (item.children) {
      return (
        <div key={item.title} className="space-y-0.5">
          <div className="flex items-center justify-between">
            <Link
              href={item.href}
              onClick={() => {
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#FAF2F4] text-[#6B2837] border border-[#E8D7DA]/60 shadow-xs"
                  : "text-[#292320] hover:bg-[#EEE7DD]/60 hover:text-[#292320]"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#6B2837]" : "text-[#71675E]"}`} />
              <span>{item.title}</span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu(item.title);
              }}
              className="p-1.5 text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-180 text-[#6B2837]" : ""
                }`}
              />
            </button>
          </div>

          {isExpanded && (
            <div className="pl-6 pr-1 pt-1 space-y-1 border-l-2 border-[#D8CEC1]/50 ml-4">
              {item.children.map((child: any) => {
                const isChildActive = pathname === child.href;
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => {
                      if (isMobile) setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      isChildActive
                        ? "bg-[#6B2837] text-white font-semibold shadow-2xs"
                        : "text-[#71675E] hover:bg-[#EEE7DD]/60 hover:text-[#292320]"
                    }`}
                  >
                    <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-white" : "text-[#71675E]"}`} />
                    <span className="truncate">{child.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          if (isMobile) setMobileMenuOpen(false);
        }}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
          isActive
            ? "bg-[#FAF2F4] text-[#6B2837] border border-[#E8D7DA]/60 shadow-xs"
            : "text-[#292320] hover:bg-[#EEE7DD]/60 hover:text-[#292320]"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#6B2837]" : "text-[#71675E]"}`} />
        <span>{item.title}</span>
      </Link>
    );
  };

    const isPosRoute = pathname === "/dashboard/pos" || pathname === "/dashboard/restaurant/pos";
    const isChatRoute = pathname.startsWith("/dashboard/super-admin/chat") || pathname.startsWith("/dashboard/super-admin/messages");
  const [posSidebarOpen, setPosSidebarOpen] = React.useState(false);
  const [posNavbarOpen, setPosNavbarOpen] = React.useState(true);

  React.useEffect(() => {
    if (!isPosRoute) return;
    const handleToggleSidebar = () => setPosSidebarOpen((prev) => !prev);
    const handleToggleNavbar = () => setPosNavbarOpen((prev) => !prev);

    window.addEventListener("toggle-pos-sidebar", handleToggleSidebar);
    window.addEventListener("toggle-pos-navbar", handleToggleNavbar);

    return () => {
      window.removeEventListener("toggle-pos-sidebar", handleToggleSidebar);
      window.removeEventListener("toggle-pos-navbar", handleToggleNavbar);
    };
  }, [isPosRoute]);
  
  // Track expanded state for nested menus based on titles
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const [activeBranch, setActiveBranch] = React.useState<BranchMeta | null>(
    branches.find((b) => b.id === user.branchId) || branches[0] || null
  );

  const [businessType, setBusinessType] = React.useState<string>("BOTH");

  React.useEffect(() => {
    apiClient.settings
      .getSettings()
      .then((data) => {
        if (data?.settings?.businessType) {
          setBusinessType(data.settings.businessType.toUpperCase());
        }
      })
      .catch(() => {});
  }, []);
  
  // Filter navigation by user role, active features and business type
  const effectiveRoleStr = user.role === "ADMIN" ? "OWNER" : user.role;
  const userRole = (effectiveRoleStr as Role) || "CASHIER";
  const allowedNavigation = React.useMemo(() => {
    const isOwner = userRole === "OWNER";
    const effectiveDomain = (subscription?.packageType || businessType || "RESTAURANT").toUpperCase();
    const isHotelOnly = effectiveDomain === "HOTEL";
    const isRestaurantOnly = effectiveDomain === "RESTAURANT" || effectiveDomain === "CAFE";
    const hasModuleOverrides = Boolean(features?.__hasModuleEntitlements);

    const coreFeatures = [
      "Inventory",
      "Purchases",
      "Suppliers",
      "Expenses",
      "Payments",
      "POS Billing",
      "Products",
      "Customers",
      "Reports",
    ];
    return navigationConfig
      .filter((item) => {
        // 1. Role check
        if (!item.roles.includes(userRole)) return false;

        // 2. Business Type / Package Domain checks
        if (isRestaurantOnly && item.title === "Hotel & Stays") return false;
        if (isHotelOnly && (item.title === "Tables & Cabins" || item.title === "Generate Menu QR")) return false;

        // 3. Super Admin per-tenant module entitlements (instant sync)
        if (userRole !== "SUPER_ADMIN" && hasModuleOverrides) {
          if (item.title === "Hotel & Stays" && !features?.HOTEL_ROOMS && !features?.HOTEL_FOLIOS) return false;
          if (item.title === "Tables & Cabins" && !features?.RESTAURANT_POS) return false;
          if (item.title === "Generate Menu QR" && !features?.GUEST_QR_PORTAL) return false;
          if ((item.title === "Inventory" || item.title === "Purchase" || item.title === "Suppliers") && !features?.INVENTORY_RECIPES) return false;
        }

        // 4. Plan feature check: OWNER always retains full core operational access
        if (isOwner && item.feature && coreFeatures.includes(item.feature)) {
          return true;
        }
        if (userRole !== "SUPER_ADMIN" && item.feature && features && features[item.feature] === false) {
          return false;
        }
        return true;
      })
      .map((item) => {
        if (item.title === "Restaurant" && isHotelOnly) {
          return {
            ...item,
            title: "Room Service",
            children: (item.children || [])
              .filter((c) => c.title !== "Table Status")
              .map((c) => (c.title === "Restaurant POS" ? { ...c, title: "Room Service POS" } : c)),
          };
        }
        if (item.children) {
          return {
            ...item,
            children: item.children.filter((child) => {
              // Check subitem roles and features
              if (!child.roles.includes(userRole)) return false;
              if (isOwner && child.feature && coreFeatures.includes(child.feature)) {
                return true;
              }
              if (userRole !== "SUPER_ADMIN" && child.feature && features && features[child.feature] === false) {
                return false;
              }
              return true;
            }),
          };
        }
        return item;
      });
  }, [userRole, features, businessType]);

  const searchItems = React.useMemo(() => {
    const items: Array<{ name: string; href: string; parent?: string }> = [];
    allowedNavigation.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => {
          items.push({
            name: child.title,
            href: child.href || "",
            parent: item.title,
          });
        });
      } else if (item.href) {
        items.push({
          name: item.title,
          href: item.href,
        });
      }
    });
    return items;
  }, [allowedNavigation]);

  const handleBranchSwitch = async (branch: BranchMeta) => {
    setActiveBranch(branch);
    setBranchDropdownOpen(false);
    await update({ branchId: branch.id });
    window.location.reload(); 
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadAlertCount(0);
    try {
      await fetch("/api/v1/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // non-blocking
    }
  };

  const handleClickNotification = async (n: NotificationMeta) => {
    setNotificationsOpen(false);
    if (!n.isRead && !String(n.id).startsWith("low-stock-")) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      setUnreadAlertCount((c) => Math.max(0, c - 1));
      void fetch("/api/v1/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.actionUrl) {
      router.push(n.actionUrl);
    }
  };

  const [currentSearch, setCurrentSearch] = React.useState("");
  React.useEffect(() => {
    const syncCurrentSearch = () => {
      if (typeof window !== "undefined") {
        setCurrentSearch(window.location.search);
      }
    };
    syncCurrentSearch();
    window.addEventListener("popstate", syncCurrentSearch);
    window.addEventListener("urlchange", syncCurrentSearch);
    return () => {
      window.removeEventListener("popstate", syncCurrentSearch);
      window.removeEventListener("urlchange", syncCurrentSearch);
    };
  }, [pathname]);

  const isNavHrefActive = React.useCallback(
    (href?: string) => {
      if (!href) return false;
      const [basePath, queryStr] = href.split("?");
      if (pathname !== basePath) return false;
      if (!queryStr) return true;
      const targetParams = new URLSearchParams(queryStr);
      const activeParams = new URLSearchParams(currentSearch);
      for (const [key, val] of targetParams.entries()) {
        const currentVal = activeParams.get(key);
        if (currentVal !== val) {
          // Default view on /dashboard/restaurant/pos is "tables" when no ?view= is in URL
          if (basePath === "/dashboard/restaurant/pos" && key === "view" && !currentVal && val === "tables") {
            continue;
          }
          return false;
        }
      }
      return true;
    },
    [pathname, currentSearch]
  );

  const renderNavItem = (item: NavItem, isMobile = false) => {
    const isActive = isNavHrefActive(item.href);
    const hasActiveChild = item.children?.some((child) => isNavHrefActive(child.href) || (child.href && pathname === child.href.split("?")[0]));
    const Icon = item.icon;
    const isExpanded = expandedMenus[item.title] !== undefined ? expandedMenus[item.title] : Boolean(hasActiveChild);

    if (item.children) {
      const allowedChildren = item.children.filter((child) => child.roles.includes(userRole));
      if (allowedChildren.length === 0) return null;

      return (
        <div key={item.title} className="mb-0.5">
          <button
            type="button"
            onClick={() => toggleMenu(item.title)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 group cursor-pointer ${
              hasActiveChild
                ? "bg-[#2E2125] text-[#FFFCF7] border border-[#4A343B]"
                : "text-[#DFD6CB] hover:bg-[#2B2023] hover:text-[#FFFCF7] border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  hasActiveChild
                    ? "bg-[#6B2837] text-[#FFFCF7]"
                    : "bg-[#2A2023] text-[#B5A89B] group-hover:bg-[#35282C] group-hover:text-[#FFFCF7]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="truncate">{item.title}</span>
            </div>
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                isExpanded
                  ? "rotate-90 text-[#D4A56A]"
                  : "text-[#8E8074] group-hover:text-[#DFD6CB]"
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="ml-5 pl-2.5 pr-1 py-0.5 mt-0.5 space-y-0.5 border-l border-[#3B2D31]">
                  {allowedChildren.map((child) => {
                    const isChildActive = isNavHrefActive(child.href);
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.title}
                        href={child.href!}
                        onClick={() => {
                          if (child.href?.includes("?")) {
                            setCurrentSearch("?" + child.href.split("?")[1]);
                          } else {
                            setCurrentSearch("");
                          }
                          if (isMobile) setMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors duration-150 ${
                          isChildActive
                            ? "bg-[#6B2837] text-[#FFFCF7] font-semibold border border-[#853547]"
                            : "text-[#BFB2A4] hover:text-[#FFFCF7] hover:bg-[#2B2023] font-medium border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChildIcon
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isChildActive ? "text-[#FFFCF7]" : "text-[#9A8C80]"
                            }`}
                          />
                          <span className="truncate">{child.title}</span>
                        </div>
                        {isChildActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E5B97F] shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Standard Link
    return (
      <Link
        key={item.title}
        href={item.href!}
        onClick={() => {
          if (item.href?.includes("?")) {
            setCurrentSearch("?" + item.href.split("?")[1]);
          } else {
            setCurrentSearch("");
          }
          if (isMobile) setMobileMenuOpen(false);
        }}
        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 group mb-0.5 ${
          isActive
            ? "bg-[#6B2837] text-[#FFFCF7] border border-[#853547]"
            : "text-[#DFD6CB] hover:bg-[#2B2023] hover:text-[#FFFCF7] border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              isActive
                ? "bg-[#541E2A] text-[#FFFCF7]"
                : "bg-[#2A2023] text-[#B5A89B] group-hover:bg-[#35282C] group-hover:text-[#FFFCF7]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="truncate">{item.title}</span>
        </div>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5B97F] shrink-0" />
        )}
      </Link>
    );
  };

  const renderGroupedNavigation = (isMobile = false) => {
    let lastGroup: string | undefined = undefined;
    return allowedNavigation.map((item, idx) => {
      const showGroupHeader = item.group && item.group !== lastGroup;
      lastGroup = item.group;
      return (
        <React.Fragment key={item.title}>
          {showGroupHeader && (
            <div
              className={`px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9A8C80] select-none ${
                idx === 0 ? "pt-0" : "pt-2.5 mt-1.5 border-t border-[#322529]"
              }`}
            >
              {item.group}
            </div>
          )}
          {renderNavItem(item, isMobile)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* 1. Sidebar desktop */}
      {userRole === "SUPER_ADMIN" ? (
        <aside 
          className="hidden lg:flex lg:flex-col flex-shrink-0 w-64 bg-[#F7F3EC] border-r border-[#D8CEC1] no-print font-sans"
        >
          {/* Brand Header */}
          <div className="h-16 flex items-center px-5 border-b border-[#D8CEC1] bg-[#F7F3EC]">
            <Link href="/dashboard/super-admin" className="flex items-center gap-3">
              <svg className="h-7 w-7 text-[#6B2837] shrink-0" viewBox="0 0 28 28" fill="none">
                <path d="M5 14H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M14 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M20 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <path d="M9 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <circle cx="14" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
                <path d="M19 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <path d="M19 6C20.5 6 21.5 7.5 21.5 9.5C21.5 11 20.5 11 19 11" stroke="currentColor" strokeWidth="1.75"/>
              </svg>
              <div>
                <div className="font-bold text-[#292320] text-sm leading-tight tracking-tight">RestroInn</div>
                <div className="text-[11px] text-[#71675E] leading-tight">Platform admin</div>
              </div>
            </Link>
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
            <div>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                WORKSPACE
              </div>
              <div className="space-y-0.5">
                {superAdminWorkspaceItems.map((item) => renderSuperAdminNavItem(item))}
              </div>
            </div>

            <div>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                ADMINISTRATION
              </div>
              <div className="space-y-0.5">
                {superAdminAdminItems.map((item) => renderSuperAdminNavItem(item))}
              </div>
            </div>
          </nav>

          {/* Bottom Profile Badge */}
          <div className="p-3 border-t border-[#D8CEC1] bg-[#F7F3EC]">
            <div 
              onClick={() => setLogoutConfirmOpen(true)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-[#EEE7DD]/60 transition-colors cursor-pointer group"
              title="Click to switch account or log out"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[#FAF2F4] border border-[#E8D7DA] text-[#6B2837] font-bold text-[10px] flex items-center justify-center shrink-0">
                  PL
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#292320] truncate">Platform admin</div>
                  <div className="text-[10px] text-[#71675E] truncate">Super administrator</div>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-[#71675E] group-hover:text-[#292320] shrink-0" />
            </div>
          </div>
        </aside>
      ) : (
        <aside className="hidden lg:flex lg:flex-col flex-shrink-0 transition-all duration-300 bg-[#1F1719] border-r border-[#33262A] no-print w-60">
          <div className="h-14 flex items-center justify-between px-4 border-b border-[#33262A] bg-[#1F1719]">
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <img src="/logo-icon.jpg" alt="RestroInn Logo" className="h-7 w-7 rounded-lg object-contain shrink-0 border border-[#3B2D31]" />
              <div className="min-w-0">
                <div className="font-bold text-[#FFFCF7] tracking-tight text-sm leading-tight truncate">
                  RestroInn
                </div>
                <div className="text-[10px] text-[#9A8C80] font-medium leading-tight truncate mt-0.5">
                  {businessType === "HOTEL"
                    ? "Hotel & Stays Suite"
                    : businessType === "RESTAURANT" || businessType === "CAFE"
                    ? "Restaurant & POS"
                    : "Hospitality & POS Suite"}
                </div>
              </div>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
            {renderGroupedNavigation(false)}
          </nav>
          <div className="p-3 border-t border-[#33262A] bg-[#1A1315]">
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#261C1F] border border-[#36282C]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#6B2837] text-[#FFFCF7] flex items-center justify-center font-bold text-[11px] shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#FFFCF7] truncate leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-[#9A8C80] font-medium uppercase tracking-wider truncate leading-tight mt-0.5">
                    {activeBranch?.name || user.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(true)}
                title="Sign Out"
                className="p-1.5 rounded-md text-[#C8BCAE] hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 2. Main content container */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Navbar */}
        {userRole === "SUPER_ADMIN" ? (
          <header 
            className="flex items-center justify-between px-4 sm:px-6 h-16 flex-shrink-0 z-30 bg-[#FFFCF7] border-b border-[#D8CEC1] no-print font-sans"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-md text-[#71675E] hover:bg-[#EEE7DD]"
                title="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-xs font-medium text-[#71675E]">
                <span>Platform</span>
                <span className="text-[#D8CEC1]">/</span>
                <span className="text-[#292320] font-semibold">{superAdminPageTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-56 sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
                <input
                  type="text"
                  placeholder="Find a business..."
                  value={superAdminSearchQuery}
                  onChange={(e) => setSuperAdminSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && superAdminSearchQuery.trim()) {
                      router.push(`/dashboard/super-admin/businesses?search=${encodeURIComponent(superAdminSearchQuery.trim())}`);
                    }
                  }}
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-lg border border-[#D8CEC1] hover:bg-[#F7F3EC] text-[#71675E] hover:text-[#292320] transition-colors relative cursor-pointer"
                  title="Platform Notifications"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadAlertCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#6B2837] text-[#FFFCF7] text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#FFFCF7] tabular-nums">
                      {unreadAlertCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-96 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] z-50 p-2 text-left">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#D8CEC1]">
                        <div>
                          <span className="text-xs font-bold text-[#292320]">Platform Alerts</span>
                          <div className="text-[10px] text-[#71675E] font-medium">{unreadAlertCount} unread</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFirebaseWebConfigured() && !pushReady && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
                            <button
                              type="button"
                              onClick={() => registerWebPushToken().then((t) => { if (t) { setPushReady(true); toast.success("Push notifications enabled."); } })}
                              className="text-[10px] text-[#315F85] hover:underline font-semibold cursor-pointer"
                            >
                              Enable Push
                            </button>
                          )}
                          {unreadAlertCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllNotificationsRead}
                              className="text-[10px] text-[#6B2837] hover:underline font-bold cursor-pointer"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-[#D8CEC1]/50">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-xs text-[#71675E]">
                            No platform alerts yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => handleClickNotification(n)}
                              className={`w-full text-left p-2.5 hover:bg-[#F7F3EC] rounded-md flex items-start gap-2.5 cursor-pointer ${!n.isRead ? "bg-[#F7F3EC]/70" : ""}`}
                            >
                              <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? "bg-[#6B2837]" : "bg-[#D8CEC1]"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[#292320] truncate">{n.title}</div>
                                <p className="text-[11px] text-[#71675E] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
        ) : (
          <header className={`flex items-center justify-between gap-3 px-4 md:px-5 flex-shrink-0 z-30 transition-all duration-200 bg-[#FFFCF7] border-b border-[#D8CEC1] no-print ${isPosRoute && !posNavbarOpen ? "h-0 opacity-0 overflow-hidden py-0 border-b-0" : "h-14"}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-[#71675E] hover:bg-[#EEE7DD] shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden font-bold text-sm text-[#6B2837] shrink-0">RestroInn</div>

            {activeBranch && user.role !== "SUPER_ADMIN" && (
              <div className="relative shrink-0">
                {/* Only show switch option for owners; non-owners see read-only badge */}
                {["SUPER_ADMIN", "OWNER"].includes(userRole) ? (
                  <>
                    <button
                      onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                      className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-xs font-semibold text-[#292320] cursor-pointer select-none transition-colors"
                      title={activeBranch.name}
                    >
                      <Store className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                      <span className="max-w-[96px] lg:max-w-[135px] truncate">{activeBranch.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-[#71675E] shrink-0" />
                    </button>
                    {branchDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
                        <div className="absolute left-0 mt-1.5 w-56 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] z-50 p-1.5">
                          <div className="px-2.5 py-1.5 text-[10px] font-bold text-[#71675E] uppercase tracking-wider">
                            Switch Branch
                          </div>
                          {branches.map((branch) => (
                            <button
                              key={branch.id}
                              onClick={() => handleBranchSwitch(branch)}
                              className={`flex items-center justify-between w-full text-left px-2.5 py-2 text-xs rounded-md transition-colors cursor-pointer ${
                                activeBranch.id === branch.id
                                  ? "bg-[#6B2837] text-[#FFFCF7] font-semibold"
                                  : "hover:bg-[#F7F3EC] text-[#292320]"
                              }`}
                            >
                              <span className="truncate">{branch.name}</span>
                              {branch.isMain && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                                  activeBranch.id === branch.id
                                    ? "bg-[#FFFCF7]/20 text-[#FFFCF7]"
                                    : "bg-[#EEE7DD] text-[#71675E]"
                                }`}>
                                  Main
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div
                    className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-xs font-semibold text-[#292320] cursor-default select-none"
                    title={activeBranch.name}
                  >
                    <Store className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                    <span className="max-w-[96px] lg:max-w-[135px] truncate">{activeBranch.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Minimalist Global Search & Quick Navigate */}
            {user.role !== "SUPER_ADMIN" && (
              <div className="hidden lg:flex items-center gap-2 min-w-0 flex-1 max-w-md">
                <div className="relative flex-1 min-w-[150px] max-w-[300px]">
                  <div className="flex items-center h-8 px-2.5 gap-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] focus-within:bg-[#FFFCF7] focus-within:border-[#6B2837] transition-colors">
                    <Search className="h-3.5 w-3.5 text-[#71675E] shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search menu, orders, guests..."
                      value={headerSearchQuery}
                      onChange={(e) => {
                        setHeaderSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      className="flex-1 min-w-0 text-xs bg-transparent focus:outline-none text-[#292320] placeholder:text-[#71675E] border-none ring-0"
                    />
                    <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#71675E] bg-[#FFFCF7] border border-[#D8CEC1] rounded">
                      ⌘K
                    </kbd>
                  </div>

                  {/* Search Results Dropdown */}
                  {showSearchDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
                      <div className="absolute left-0 mt-2 w-full rounded-lg border border-slate-150 dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 shadow-sm z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 text-left max-h-90 overflow-y-auto">
                        {headerSearchQuery.trim() === "" ? (
                          <>
                            <div className="px-3 py-1.5 text-[9px] font-bold text-[#71675E] uppercase tracking-wider border-b border-[#D8CEC1] dark:border-slate-800 mb-1">
                              Menu Navigation Shortcuts
                            </div>
                            {searchItems.slice(0, 8).map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setShowSearchDropdown(false)}
                                className="flex items-center justify-between w-full px-3 py-2 text-xs text-[#292320] dark:text-slate-300 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 rounded-md font-bold transition-colors cursor-pointer"
                              >
                                <span>{item.name}</span>
                                {item.parent && (
                                  <span className="text-[9px] bg-[#EEE7DD] dark:bg-slate-800 text-[#71675E] dark:text-slate-550 px-1.5 py-0.5 rounded-md">
                                    {item.parent}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </>
                        ) : (
                          <>
                            {searchLoading && (
                              <div className="flex items-center justify-center py-6 text-xs text-[#71675E] gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Searching database...
                              </div>
                            )}

                            {!searchLoading &&
                              searchResults.products.length === 0 &&
                              searchResults.customers.length === 0 &&
                              searchResults.suppliers.length === 0 &&
                              searchItems.filter(item => item.name.toLowerCase().includes(headerSearchQuery.toLowerCase())).length === 0 && (
                                <div className="p-6 text-center text-xs text-[#71675E]">
                                  No records found for "{headerSearchQuery}"
                                </div>
                              )}

                            {/* 1. Menu Pages Matches */}
                            {searchItems.filter(item => item.name.toLowerCase().includes(headerSearchQuery.toLowerCase())).length > 0 && (
                              <div className="mb-2">
                                <div className="px-3 py-1 text-[8px] font-bold text-[#71675E] uppercase tracking-wider">
                                  Navigation Pages
                                </div>
                                {searchItems
                                  .filter(item => item.name.toLowerCase().includes(headerSearchQuery.toLowerCase()))
                                  .map((item) => (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      onClick={() => setShowSearchDropdown(false)}
                                      className="flex items-center justify-between w-full px-3 py-2 text-xs text-[#292320] dark:text-slate-300 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 rounded-md font-bold transition-colors cursor-pointer"
                                    >
                                      <span>{item.name}</span>
                                      <ChevronRight className="h-3.5 w-3.5 text-slate-350" />
                                    </Link>
                                  ))}
                              </div>
                            )}

                            {/* 2. Product Matches */}
                            {searchResults.products.length > 0 && (
                              <div className="mb-2 border-t border-[#D8CEC1] dark:border-slate-800 pt-1">
                                <div className="px-3 py-1 text-[8px] font-bold text-[#71675E] uppercase tracking-wider">
                                  Products
                                </div>
                                {searchResults.products.map((p) => (
                                  <Link
                                    key={p.id}
                                    href="/dashboard/products"
                                    onClick={() => setShowSearchDropdown(false)}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-[#292320] dark:text-slate-305 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 rounded-md font-bold transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <div className="text-[#292320] dark:text-slate-200 font-extrabold">{p.name}</div>
                                      <div className="text-[9px] text-[#71675E]">SKU: {p.sku || "GENERIC"}</div>
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                      Rs. {Number(p.sellingPrice || 0).toFixed(2)}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            )}

                            {/* 3. Customer Matches */}
                            {searchResults.customers.length > 0 && (
                              <div className="mb-2 border-t border-[#D8CEC1] dark:border-slate-800 pt-1">
                                <div className="px-3 py-1 text-[8px] font-bold text-[#71675E] uppercase tracking-wider">
                                  Customers
                                </div>
                                {searchResults.customers.map((c) => (
                                  <Link
                                    key={c.id}
                                    href="/dashboard/customers"
                                    onClick={() => setShowSearchDropdown(false)}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-[#292320] dark:text-slate-305 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 rounded-md font-bold transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <div className="text-slate-850 dark:text-slate-200 font-extrabold">{c.name}</div>
                                      <div className="text-[9px] text-[#71675E]">{c.phone || "No Phone"}</div>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-350" />
                                  </Link>
                                ))}
                              </div>
                            )}

                            {/* 4. Supplier Matches */}
                            {searchResults.suppliers.length > 0 && (
                              <div className="border-t border-[#D8CEC1] dark:border-slate-800 pt-1">
                                <div className="px-3 py-1 text-[8px] font-bold text-[#71675E] uppercase tracking-wider">
                                  Suppliers
                                </div>
                                {searchResults.suppliers.map((s) => (
                                  <Link
                                    key={s.id}
                                    href="/dashboard/suppliers"
                                    onClick={() => setShowSearchDropdown(false)}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-slate-750 dark:text-slate-300 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 rounded-md font-bold transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <div className="text-slate-805 dark:text-slate-200 font-extrabold">{s.name}</div>
                                      <div className="text-[9px] text-slate-405">{s.phone || "No Phone"}</div>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-350" />
                                  </Link>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Compact Quick Navigate Button */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setQuickNavOpen(!quickNavOpen)}
                    className="h-8 flex items-center gap-1.5 px-2.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none whitespace-nowrap"
                    title="Quick Navigate"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                    <span className="hidden xl:inline">Quick</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#71675E] shrink-0" />
                  </button>
                  {quickNavOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setQuickNavOpen(false)} />
                      <div className="absolute left-0 mt-1.5 w-56 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] z-50 p-1.5 text-left">
                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-[#71675E] uppercase tracking-wider border-b border-[#EEE7DD] mb-1">
                          Quick Navigation
                        </div>
                        {frequentServices.map((service) => {
                          const Icon = service.icon;
                          return (
                            <Link
                              key={service.name}
                              href={service.href}
                              onClick={() => setQuickNavOpen(false)}
                              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-[#292320] hover:bg-[#F7F3EC] rounded-md font-medium transition-colors cursor-pointer"
                            >
                              <div className={`p-1 rounded-md shrink-0 ${service.color}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="truncate">{service.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {subscription && user.role !== "SUPER_ADMIN" && (
              <div className="hidden sm:block shrink-0">
                <SubscriptionTimer
                  endDate={subscription.endDate}
                  plan={subscription.plan}
                  status={subscription.status}
                  billingCycle={subscription.billingCycle}
                />
              </div>
            )}

            {/* Compact Cashier Shift Status Chip */}
            {user.role !== "SUPER_ADMIN" && (
              <div className="shrink-0">
                {activeShift ? (
                  <Link
                    href="/dashboard/shifts"
                    className="h-8 px-2.5 rounded-lg border border-[#C3DED0] bg-[#F1F7F4] hover:bg-[#E4F0EA] text-xs font-semibold text-[#28634B] transition-colors flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap"
                    title={`Active Shift: #${activeShift.shiftNumber} (${activeShift.register?.name || "Counter"})`}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#28634B] shrink-0" />
                    <span className="max-w-[96px] truncate">
                      {activeShift.register?.name || "Shift Open"}
                    </span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenShiftModalOpen(true)}
                    className="h-8 px-2.5 rounded-lg border border-[#EDD7AD] bg-[#FDF7ED] hover:bg-[#F7EBD5] text-xs font-semibold text-[#946000] transition-colors flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap"
                    title="No active cashier shift. Click to open shift."
                  >
                    <Coins className="h-3.5 w-3.5 text-[#946000] shrink-0" />
                    <span>Open Shift</span>
                  </button>
                )}
              </div>
            )}

            <div className="relative shrink-0">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="h-8 w-8 rounded-lg border border-transparent hover:border-[#D8CEC1] text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC] transition-colors relative flex items-center justify-center cursor-pointer"
                title="Notifications & Platform Notices"
              >
                <Bell className="h-4 w-4" />
                {totalNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[#6B2837] text-[#FFFCF7] text-[9px] font-bold rounded-full flex items-center justify-center border border-[#FFFCF7] tabular-nums">
                    {totalNotificationsCount > 99 ? "99+" : totalNotificationsCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-96 rounded-lg border border-[#D8CEC1] dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 z-50 p-2 text-left">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#D8CEC1] dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-[#292320] dark:text-slate-200">Notifications & Notices</span>
                        <div className="text-[10px] text-[#71675E] font-medium">{totalNotificationsCount} unread items</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!pushReady && typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
                          <button
                            type="button"
                            onClick={async () => {
                              const perm = await Notification.requestPermission();
                              if (perm === "granted") {
                                if (isFirebaseWebConfigured()) {
                                  await registerWebPushToken();
                                }
                                setPushReady(true);
                                toast.success("Browser push notifications enabled.");
                              } else {
                                toast.warning("Browser notification permission was not granted.");
                              }
                            }}
                            className="text-[10px] text-[#315F85] hover:underline font-semibold cursor-pointer"
                          >
                            Enable Alerts
                          </button>
                        )}
                        {totalNotificationsCount > 0 && (
                          <button
                            onClick={() => {
                              handleMarkAllNotificationsRead();
                              setDismissedNoticeIds(broadcastsList.map((b) => b.id));
                            }}
                            className="text-[10px] text-[#6B2837] hover:underline font-bold cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 p-1 bg-[#F7F3EC] dark:bg-slate-800/50 rounded-md my-1.5 text-[10px] font-bold">
                      <button
                        onClick={() => setNotifTab("all")}
                        className={`flex-1 py-1 px-2 rounded cursor-pointer transition-colors ${notifTab === "all" ? "bg-[#FFFCF7] dark:bg-slate-900 text-[#292320] dark:text-slate-100 shadow-xs" : "text-[#71675E] hover:text-[#292320]"}`}
                      >
                        All ({totalNotificationsCount})
                      </button>
                      <button
                        onClick={() => setNotifTab("notices")}
                        className={`flex-1 py-1 px-2 rounded cursor-pointer transition-colors ${notifTab === "notices" ? "bg-[#FFFCF7] dark:bg-slate-900 text-[#292320] dark:text-slate-100 shadow-xs" : "text-[#71675E] hover:text-[#292320]"}`}
                      >
                        Notices ({unreadBroadcasts.length})
                      </button>
                      <button
                        onClick={() => setNotifTab("alerts")}
                        className={`flex-1 py-1 px-2 rounded cursor-pointer transition-colors ${notifTab === "alerts" ? "bg-[#FFFCF7] dark:bg-slate-900 text-[#292320] dark:text-slate-100 shadow-xs" : "text-[#71675E] hover:text-[#292320]"}`}
                      >
                        Alerts ({notifications.length})
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#D8CEC1]/50 dark:divide-slate-800/50">
                      {/* Platform Notices */}
                      {(notifTab === "all" || notifTab === "notices") && unreadBroadcasts.map((b) => (
                        <div key={b.id} className="p-2.5 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/50 rounded-md flex items-start justify-between gap-2.5 group">
                          <div className="flex items-start gap-2">
                            <div className="p-1 rounded bg-[#6B2837]/10 text-[#6B2837] mt-0.5 shrink-0">
                              <Megaphone className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#292320] dark:text-slate-200">{b.title}</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EEE7DD] dark:bg-slate-800 text-[#71675E] font-semibold">
                                  {b.priority || "Platform"}
                                </span>
                              </div>
                              {b.subheading && <div className="text-[10px] text-[#71675E] font-medium mt-0.5">{b.subheading}</div>}
                              <p className="text-[11px] text-[#292320]/80 dark:text-slate-300 mt-1 leading-snug">{b.body}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setDismissedNoticeIds((prev) => [...prev, b.id])}
                            title="Dismiss notice"
                            className="text-[#71675E] hover:text-[#292320] p-1 rounded hover:bg-[#EEE7DD] dark:hover:bg-slate-800 cursor-pointer opacity-70 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* System Alerts */}
                      {(notifTab === "all" || notifTab === "alerts") && notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleClickNotification(n)}
                          className={`w-full text-left p-2.5 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/50 rounded-md flex items-start gap-2.5 cursor-pointer ${!n.isRead ? "bg-[#F7F3EC]/70" : ""}`}
                        >
                          <div className="p-1 rounded bg-amber-500/10 text-amber-600 mt-0.5 shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#292320] dark:text-slate-200 truncate">{n.title}</div>
                            <p className="text-[11px] text-[#71675E] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          </div>
                        </button>
                      ))}

                      {totalNotificationsCount === 0 && (
                        <div className="px-4 py-8 text-center text-xs text-[#71675E]">
                          No new notifications or platform notices
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="h-8 flex items-center gap-1.5 pl-1 pr-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] transition-colors cursor-pointer select-none"
                title={`${user.name} (${user.role ? user.role.replace("_", " ") : "User"})`}
              >
                <div className="h-6 w-6 rounded-md bg-[#6B2837] text-[#FFFCF7] flex items-center justify-center font-bold text-[10px] select-none shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden xl:block max-w-[96px] truncate text-xs font-semibold text-[#292320]">
                  {user.name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#71675E] shrink-0" />
              </button>
              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#D8CEC1] dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 z-50 p-2 animate-in slide-in-from-top-2 fade-in duration-150 text-left">
                    {/* User Identity Card */}
                    <div className="p-3 rounded-lg bg-[#F7F3EC] dark:bg-slate-800/60 border border-[#D8CEC1]/60 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#6B2837] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#292320] dark:text-slate-200 truncate">{user.name}</div>
                        <div className="text-[10px] text-[#71675E] truncate">{user.email}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#6B2837]/10 text-[#6B2837] uppercase tracking-wider">
                            {user.role ? user.role.replace("_", " ") : "User"}
                          </span>
                          {activeBranch && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#EEE7DD] text-[#71675E] truncate max-w-[100px]">
                              {activeBranch.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Profile Navigation */}
                    <div className="py-2 space-y-0.5">
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-[#292320] hover:bg-[#F7F3EC] rounded-lg font-semibold transition-colors cursor-pointer"
                      >
                        <User className="h-4 w-4 text-[#71675E]" />
                        <span>My Profile</span>
                      </Link>

                      {user.role !== "SUPER_ADMIN" && (
                        <Link
                          href="/dashboard/shifts"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-[#292320] hover:bg-[#F7F3EC] rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          <Clock className="h-4 w-4 text-[#71675E]" />
                          <span>Cash Register & Shifts</span>
                        </Link>
                      )}

                      {["OWNER", "MANAGER", "SUPER_ADMIN"].includes(user.role) && (
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-[#292320] hover:bg-[#F7F3EC] rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          <SlidersHorizontal className="h-4 w-4 text-[#71675E]" />
                          <span>Business Settings</span>
                        </Link>
                      )}
                    </div>

                    {/* Sign Out Action Button */}
                    <div className="pt-2 border-t border-[#D8CEC1]/70 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setLogoutConfirmOpen(true);
                        }}
                        className="flex items-center justify-between w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg font-bold transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-red-600" />
                          <span>Sign Out</span>
                        </div>
                        <span className="text-[10px] text-red-500/70 font-normal">End Session</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        )}

        <main className={`flex-1 ${isPosRoute ? "overflow-hidden h-full p-0" : isChatRoute ? "overflow-hidden h-[calc(100vh-4rem)] p-3 md:p-4" : "overflow-y-auto p-4 md:p-6"} bg-background relative`}>
          {children}
        </main>
      </div>

      {/* 3. Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden"
              style={{ backgroundColor: userRole === "SUPER_ADMIN" ? "#F7F3EC" : "#241C1E" }}
            >
              {userRole === "SUPER_ADMIN" ? (
                <>
                  <div className="h-16 flex items-center justify-between px-5 border-b border-[#D8CEC1] bg-[#F7F3EC]">
                    <Link href="/dashboard/super-admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
                      <svg className="h-7 w-7 text-[#6B2837] shrink-0" viewBox="0 0 28 28" fill="none">
                        <path d="M5 14H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M8 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M14 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M20 14V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M7 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                        <path d="M9 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                        <circle cx="14" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
                        <path d="M19 6V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                        <path d="M19 6C20.5 6 21.5 7.5 21.5 9.5C21.5 11 20.5 11 19 11" stroke="currentColor" strokeWidth="1.75"/>
                      </svg>
                      <div>
                        <div className="font-bold text-[#292320] text-sm leading-tight">RestroInn</div>
                        <div className="text-[11px] text-[#71675E] leading-tight">Platform admin</div>
                      </div>
                    </Link>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg text-[#71675E] hover:bg-[#EEE7DD]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
                    <div>
                      <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                        WORKSPACE
                      </div>
                      <div className="space-y-0.5">
                        {superAdminWorkspaceItems.map((item) => renderSuperAdminNavItem(item, true))}
                      </div>
                    </div>
                    <div>
                      <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
                        ADMINISTRATION
                      </div>
                      <div className="space-y-0.5">
                        {superAdminAdminItems.map((item) => renderSuperAdminNavItem(item, true))}
                      </div>
                    </div>
                  </nav>
                  <div className="p-3 border-t border-[#D8CEC1] bg-[#F7F3EC]">
                    <div 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-[#EEE7DD]/60 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-[#FAF2F4] border border-[#E8D7DA] text-[#6B2837] font-bold text-[10px] flex items-center justify-center shrink-0">
                          PL
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#292320] truncate">Platform admin</div>
                          <div className="text-[10px] text-[#71675E] truncate">Super administrator</div>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[#71675E] group-hover:text-[#292320]" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-16 flex items-center justify-between px-5 border-b border-[#33262A]">
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 min-w-0">
                      <img src="/logo-icon.jpg" alt="RestroInn Logo" className="h-8 w-8 rounded-lg object-contain shrink-0 border border-[#3B2D31]" />
                      <div className="min-w-0">
                        <div className="font-bold text-[#FFFCF7] tracking-tight text-sm leading-tight truncate">
                          RestroInn
                        </div>
                        <div className="text-[10px] text-[#9A8C80] font-medium leading-tight truncate mt-0.5">
                          {businessType === "HOTEL"
                            ? "Hotel & Stays Suite"
                            : businessType === "RESTAURANT" || businessType === "CAFE"
                            ? "Restaurant & POS"
                            : "Hospitality & POS Suite"}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-md text-[#B5A89B] hover:bg-[#2B2023] hover:text-[#FFFCF7]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-3 py-4">
                    {renderGroupedNavigation(true)}
                  </nav>
                  <div className="p-3 border-t border-[#33262A] bg-[#1A1315]">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#261C1F] border border-[#36282C]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[#6B2837] text-[#FFFCF7] flex items-center justify-center font-bold text-[11px] shrink-0">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#FFFCF7] truncate leading-tight">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-[#9A8C80] font-medium uppercase tracking-wider truncate leading-tight mt-0.5">
                            {activeBranch?.name || user.role}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setLogoutConfirmOpen(true);
                        }}
                        title="Sign Out"
                        className="p-1.5 rounded-md text-[#C8BCAE] hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer shrink-0"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print animate-in fade-in duration-150">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 w-full max-w-sm shadow-md flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-md bg-[#6B2837]/10 border border-[#6B2837]/20 flex items-center justify-center text-[#6B2837] shrink-0 mt-0.5">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#292320]">Sign Out</h4>
                <p className="text-xs text-[#71675E] leading-relaxed">
                  Are you sure you want to end your current session? You will be redirected to the sign-in screen.
                </p>
              </div>
            </div>

            {user?.email && (
              <div className="px-3 py-2 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#292320] truncate max-w-[200px]">{user.email}</span>
                <span className="text-[#6B2837] font-semibold uppercase tracking-wider text-[10px]">
                  {user.role ? user.role.replace("_", " ") : "User"}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#292320] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={async () => {
                  setLogoutLoading(true);
                  clearCaches();
                  try {
                    await signOut({ redirect: false });
                  } catch (e) {
                    console.error("Signout error:", e);
                  }
                  window.location.href = "/auth/login";
                }}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {logoutLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Sign Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/70 p-4 no-print animate-in fade-in duration-200">
          <div className="bg-[#FFFCF7] dark:bg-slate-900 border border-[#D8CEC1] dark:border-slate-800 rounded-lg p-6 w-full max-w-sm shadow-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 animate-pulse">
                <Clock className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Inactivity Warning</h4>
                <p className="text-xs text-[#71675E] dark:text-[#71675E] leading-relaxed font-semibold">
                  You have been inactive for a while. You will be logged out automatically in{" "}
                  <span className="text-red-500 font-extrabold text-sm">{inactivityCountdown}</span> seconds.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  lastActivityRef.current = Date.now();
                  setShowInactivityWarning(false);
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-md shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Open Shift Modal Triggered from Appbar */}
      {user.role !== "SUPER_ADMIN" && (
        <OpenShiftModal
          isOpen={openShiftModalOpen}
          onClose={() => setOpenShiftModalOpen(false)}
          onShiftOpened={(shift) => {
            setActiveShift(shift);
            setOpenShiftModalOpen(false);
          }}
          cashierName={user.name}
        />
      )}
    </div>
  );
}
