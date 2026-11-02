"use client";

import * as React from "react";
import ToastContainer from "@/components/toast";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { clearCaches } from "@/lib/cache-utils";
import { navigationConfig, NavItem, Role } from "@/lib/nav-config";
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
} from "lucide-react";

interface UserMeta {
  name: string;
  email: string;
  role: string;
  branchId: string | null;
}

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
  isRead: boolean;
  createdAt: Date;
}

interface SubscriptionMeta {
  plan: string;
  endDate: Date | string;
  status: string;
}

function SubscriptionTimer({
  endDate,
  plan,
  status,
}: SubscriptionMeta) {
  const [timeLeft, setTimeLeft] = React.useState("");
  const [urgency, setUrgency] = React.useState<"normal" | "warning" | "danger">("normal");

  const formattedEnd = React.useMemo(() => {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [endDate]);

  React.useEffect(() => {
    function updateTimer() {
      const end = new Date(endDate);
      const now = new Date();
      const diff = end.getTime() - now.getTime();

      if (diff <= 0 || status !== "ACTIVE") {
        setTimeLeft("Expired");
        setUrgency("danger");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 30) {
        setTimeLeft(`${days}d left`);
        setUrgency("normal");
      } else if (days > 7) {
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
    const interval = setInterval(updateTimer, 60000); // update every minute
    return () => clearInterval(interval);
  }, [endDate, status]);

  const colorClasses = {
    normal: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 dark:bg-blue-500/5",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 dark:bg-amber-500/5 animate-pulse",
    danger: "bg-red-500/10 border-red-500/20 text-red-655 dark:text-red-400 dark:bg-red-500/5 font-extrabold animate-pulse",
  };

  return (
    <div
      suppressHydrationWarning
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${colorClasses[urgency]} transition-all duration-300 shadow-xs`}
      title={`Plan: ${plan}${formattedEnd ? ` (Ends: ${formattedEnd})` : ""}`}
    >
      <Clock className="h-3 w-3" />
      <span className="hidden xs:inline uppercase tracking-wider text-[8px] opacity-75">{plan}:</span>
      <span suppressHydrationWarning>{timeLeft}</span>
    </div>
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

  React.useEffect(() => {
    fetch("/api/v1/notifications/broadcasts")
      .then((res) => (res.ok ? res.json() : { broadcasts: [] }))
      .then((data) => {
        if (Array.isArray(data.broadcasts)) {
          setBroadcastsList(data.broadcasts);
        }
      })
      .catch(() => {});
  }, []);
  const [superAdminSidebarCollapsed, setSuperAdminSidebarCollapsed] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);

  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = React.useState(false);
  const [inactivityCountdown, setInactivityCountdown] = React.useState(30);
  const lastActivityRef = React.useRef<number>(Date.now());

  const [quickNavOpen, setQuickNavOpen] = React.useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<{
    products: Array<{ id: string; name: string; sku: string; sellingPrice: number }>;
    customers: Array<{ id: string; name: string; phone: string }>;
    suppliers: Array<{ id: string; name: string; phone: string }>;
  }>({ products: [], customers: [], suppliers: [] });
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const frequentServices = React.useMemo(() => [
    {
      name: "POS Invoice Terminal",
      desc: "Process sales, print receipts, apply discounts",
      href: "/dashboard/pos",
      icon: ShoppingCart,
      color: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    },
    {
      name: "Product Catalog",
      desc: "Manage item master, prices, subcategories",
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
  React.useEffect(() => {
    if (typeof window === "undefined") return;

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
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(headerSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
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
    if (pathname.includes("/businesses")) return "Businesses";
    if (pathname.includes("/requests")) return "Approvals";
    if (pathname.includes("/subscriptions/plans")) return "Plans & Pricing";
    if (pathname.includes("/subscriptions")) return "Subscriptions & Plans";
    if (pathname.includes("/revenue")) return "Billing & payments";
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

    const isPosRoute = pathname === "/dashboard/pos";
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
  
  const [notifications, setNotifications] = React.useState<NotificationMeta[]>(initialNotifications);

  // Filter navigation by user role and active features
  const userRole = (user.role as Role) || "CASHIER";
  const allowedNavigation = React.useMemo(() => {
    return navigationConfig
      .filter((item) => {
        // 1. Role check
        if (!item.roles.includes(userRole)) return false;
        // 2. Plan feature check
        if (userRole !== "SUPER_ADMIN" && item.feature && features && features[item.feature] === false) {
          return false;
        }
        return true;
      })
      .map((item) => {
        if (item.children) {
          return {
            ...item,
            children: item.children.filter((child) => {
              // Check subitem roles and features
              if (!child.roles.includes(userRole)) return false;
              if (userRole !== "SUPER_ADMIN" && child.feature && features && features[child.feature] === false) {
                return false;
              }
              return true;
            }),
          };
        }
        return item;
      });
  }, [userRole, features]);

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

  const handleMarkAllNotificationsRead = () => setNotifications([]);

  const renderNavItem = (item: NavItem, isMobile = false) => {
    const isActive = item.href ? pathname === item.href : false;
    const hasActiveChild = item.children?.some(child => pathname === child.href);
    const Icon = item.icon;
    const isExpanded = expandedMenus[item.title] || hasActiveChild;

    if (item.children) {
      // Filter children by role
      const allowedChildren = item.children.filter((child) => child.roles.includes(userRole));
      if (allowedChildren.length === 0) return null;

      return (
        <div key={item.title} className="mb-1.5">
          <button
            onClick={() => toggleMenu(item.title)}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold transition-all duration-200 group cursor-pointer ${
              hasActiveChild
                ? "bg-[#6B2837] text-white shadow-sm shadow-[#6B2837]/20" 
                : "text-slate-300 hover:bg-[#6B2837]/50 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`h-4.5 w-4.5 ${hasActiveChild ? "text-[#A77B38]" : "text-[#71675E] group-hover:text-white"}`} />
              {item.title}
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-3.5 w-3.5 text-[#71675E] group-hover:text-white" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pl-6 pr-2 py-1.5 space-y-1 border-l border-[#3B2D31] ml-5 mt-1">
                  {allowedChildren.map((child) => {
                    const isChildActive = pathname === child.href;
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.title}
                        href={child.href!}
                        onClick={() => isMobile && setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-bold transition-all duration-200 ${
                          isChildActive
                            ? "bg-[#6B2837] text-white"
                            : "text-[#71675E] hover:text-white hover:bg-[#FFFCF7]/10"
                        }`}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        {child.title}
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
        onClick={() => isMobile && setMobileMenuOpen(false)}
        className={`flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-bold transition-all duration-200 group mb-1.5 ${
          isActive
            ? "bg-[#6B2837] hover:bg-[#541E2A] text-white shadow-sm shadow-[#6B2837]/25"
            : "text-slate-300 hover:bg-[#FFFCF7]/10 hover:text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-[#71675E] group-hover:text-white"}`} />
          {item.title}
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* 1. Sidebar desktop */}
      {userRole === "SUPER_ADMIN" ? (
        <aside 
          className="hidden md:flex md:flex-col flex-shrink-0 w-64 bg-[#F7F3EC] border-r border-[#D8CEC1] no-print"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
          }}
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
        <aside className={`hidden md:flex md:flex-col flex-shrink-0 transition-all duration-300 bg-[#241C1E] border-r border-[#3B2D31] no-print ${isPosRoute && !posSidebarOpen ? "w-0 overflow-hidden" : "w-64"}`}>
          <div className="h-16 flex items-center justify-between px-6 border-b border-[#3B2D31] bg-[#241C1E]">
            <Link href="/dashboard" className="flex items-center gap-3">
              <img src="/logo-icon.jpg" alt="RestroInn Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" />
              <span className="font-black text-white dark:text-slate-100 tracking-tight text-sm">
                RestroInn
              </span>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            {allowedNavigation.map((item) => renderNavItem(item))}
          </nav>
          <div className="p-4 border-t border-[#3B2D31] bg-[#241C1E]">
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-red-400 hover:bg-red-500/10 font-bold transition-colors cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* 2. Main content container */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Navbar */}
        {userRole === "SUPER_ADMIN" ? (
          <header 
            className="flex items-center justify-between px-4 sm:px-6 h-16 flex-shrink-0 z-30 bg-[#FFFCF7] border-b border-[#D8CEC1] no-print"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
              letterSpacing: '-0.011em',
            }}
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

              <button
                onClick={() => router.push("/dashboard/super-admin/monitoring")}
                className="p-2 rounded-lg border border-[#D8CEC1] hover:bg-[#F7F3EC] text-[#71675E] hover:text-[#292320] transition-colors relative cursor-pointer"
                title="System Notifications & Diagnostics"
              >
                <Bell className="h-4.5 w-4.5" />
              </button>
            </div>
          </header>
        ) : (
          <header className={`flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 transition-all duration-300 bg-[#FFFCF7] border-b border-[#E5E7EB] no-print ${isPosRoute && !posNavbarOpen ? "h-0 opacity-0 overflow-hidden py-0 border-b-0" : "h-16"}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-[#EEE7DD]"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="md:hidden font-bold text-base sm:text-xl text-[#6B2837] shrink-0">RestroInn</div>
            
            {activeBranch && user.role !== "SUPER_ADMIN" && (
              <div className="relative">
                {/* Only show switch option for owners; non-owners see read-only badge */}
                {["SUPER_ADMIN", "OWNER"].includes(userRole) ? (
                  <>
                    <button
                      onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-[#D8CEC1] dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 text-xs font-semibold cursor-pointer shadow-xs select-none hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center justify-center p-1 bg-[#2563EB]/10 dark:bg-[#2563EB]/20 rounded-lg text-[#2563EB] dark:text-purple-400 shrink-0">
                        <Store className="h-3.5 w-3.5" />
                      </div>
                      <span className="max-w-[80px] sm:max-w-[120px] truncate text-[#292320] dark:text-slate-200 font-extrabold whitespace-nowrap inline-block">{activeBranch.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-[#71675E]" />
                    </button>
                    {branchDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-56 rounded-lg border border-slate-150 dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 shadow-sm z-50 p-1.5">
                          <div className="px-3 py-2 text-[10px] font-bold text-[#71675E] dark:text-[#71675E] uppercase tracking-wider">
                            Switch Branch
                          </div>
                          {branches.map((branch) => (
                            <button
                              key={branch.id}
                              onClick={() => handleBranchSwitch(branch)}
                              className={`flex items-center justify-between w-full text-left px-3 py-2.5 text-xs rounded-md transition-colors cursor-pointer ${
                                activeBranch.id === branch.id
                                  ? "bg-[#2563EB] text-white font-bold"
                                  : "hover:bg-[#F7F3EC] dark:hover:bg-slate-800/70 text-[#292320] dark:text-slate-300"
                              }`}
                            >
                              {branch.name}
                              {branch.isMain && <span className="text-[8px] bg-[#EEE7DD] dark:bg-slate-800 text-[#71675E] px-1.5 py-0.5 rounded-md whitespace-nowrap">Main</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* Non-owners see only their assigned warehouse as read-only */
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-[#D8CEC1] dark:border-slate-855 bg-[#F7F3EC] dark:bg-slate-900/50 text-xs font-semibold cursor-default select-none">
                    <div className="flex items-center justify-center p-1 bg-[#2563EB]/10 dark:bg-[#2563EB]/20 rounded-lg text-[#2563EB] dark:text-purple-400 shrink-0">
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <span className="max-w-[80px] sm:max-w-[120px] truncate text-[#292320] dark:text-slate-200 font-extrabold whitespace-nowrap inline-block">{activeBranch.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Search and Quick Navigate Buttons */}
            {user.role !== "SUPER_ADMIN" && (
              <div className="hidden md:flex items-center gap-3">
                {/* Global Search Bar (Daraz Style) */}
                <div className="relative w-80 lg:w-[420px] shrink-0">
                  <div className="flex h-9 rounded-md overflow-hidden border border-[#D8CEC1] dark:border-slate-800 focus-within:border-black dark:focus-within:border-white focus-within:ring-1 focus-within:ring-black/10 dark:focus-within:ring-white/10 transition-all bg-[#F7F3EC] dark:bg-slate-900">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search products, pages, customers, suppliers..."
                      value={headerSearchQuery}
                      onChange={(e) => {
                        setHeaderSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      className="flex-1 px-3 text-xs bg-transparent focus:outline-none text-foreground border-none ring-0"
                    />
                    <button className="px-3.5 bg-[#241C1E] hover:bg-[#541E2A] text-white flex items-center justify-center transition-colors cursor-pointer border-none outline-none">
                      <Search className="h-4 w-4" />
                    </button>
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
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Rs. {p.sellingPrice.toFixed(2)}</span>
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

                {/* Quick Navigate Button */}
                <div className="relative">
                  <button
                    onClick={() => setQuickNavOpen(!quickNavOpen)}
                    className="flex items-center gap-2 px-3.5 h-9 bg-[#FFFCF7] dark:bg-slate-900 hover:bg-[#F7F3EC] dark:hover:bg-slate-800 border border-black dark:border-white text-black dark:text-white rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs select-none whitespace-nowrap"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span>Quick Navigate</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#71675E]" />
                  </button>
                  {quickNavOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setQuickNavOpen(false)} />
                      <div className="absolute left-0 mt-2 w-56 rounded-lg border border-slate-150 bg-[#FFFCF7] shadow-sm z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
                        <div className="px-3 py-1.5 text-[9px] font-bold text-[#71675E] uppercase tracking-wider border-b border-[#D8CEC1] mb-1.5">
                          Quick Navigation
                        </div>
                        {frequentServices.map((service) => {
                          const Icon = service.icon;
                          return (
                            <Link
                              key={service.name}
                              href={service.href}
                              onClick={() => setQuickNavOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-750 hover:bg-[#F7F3EC] rounded-md font-bold transition-colors cursor-pointer"
                            >
                              <div className={`p-1 rounded-lg shrink-0 ${service.color}`}>
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

          <div className="flex items-center gap-2 md:gap-4">
            {subscription && user.role !== "SUPER_ADMIN" && (
              <div className="hidden sm:block shrink-0">
                <SubscriptionTimer
                  endDate={subscription.endDate}
                  plan={subscription.plan}
                  status={subscription.status}
                />
              </div>
            )}
            {/* Theme switcher removed */}

            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-md text-[#71675E] hover:text-[#292320] dark:text-[#71675E] dark:hover:text-slate-200 hover:bg-[#F7F3EC] dark:hover:bg-slate-900 transition-colors relative cursor-pointer"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-[#050B1E]" />
                )}
              </button>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-150 dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 shadow-sm z-50 p-1.5">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#D8CEC1] dark:border-slate-800">
                      <span className="text-xs font-bold text-[#292320] dark:text-slate-200">Alerts & Logs</span>
                      {notifications.length > 0 && (
                        <button onClick={handleMarkAllNotificationsRead} className="text-[10px] text-[#2563EB] hover:underline font-semibold cursor-pointer">
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-450">No alerts right now</div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3 hover:bg-[#F7F3EC] dark:hover:bg-slate-800/50 rounded-md flex items-start gap-2.5 border-b border-[#D8CEC1] dark:border-slate-800/50 last:border-b-0">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-slate-850 dark:text-slate-200">{n.title}</div>
                              <p className="text-[10px] text-[#71675E] dark:text-[#71675E] mt-0.5 leading-snug">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 hover:bg-[#F7F3EC] dark:hover:bg-slate-900/60 p-1 rounded-md transition-colors cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/25 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs select-none">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-extrabold text-[#292320] dark:text-slate-200">{user.name}</div>
                  <div className="text-[9px] text-[#71675E] dark:text-[#71675E] tracking-wider uppercase font-bold">
                    {user.role}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#71675E] hidden lg:block" />
              </button>
              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-150 dark:border-slate-800 bg-[#FFFCF7] dark:bg-slate-900 shadow-sm z-50 p-1.5">
                    <div className="px-3 py-2 border-b border-[#D8CEC1] dark:border-slate-800 text-left">
                      <div className="text-xs font-bold text-[#292320] dark:text-slate-200">{user.name}</div>
                      <div className="text-[10px] text-slate-450 dark:text-[#71675E] truncate mt-0.5">{user.email}</div>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs text-[#292320] dark:text-slate-350 hover:bg-[#F7F3EC] dark:hover:bg-slate-800 rounded-md mt-1.5 font-bold transition-colors cursor-pointer"
                    >
                      <User className="h-4 w-4 text-[#71675E]" />
                      My Profile
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md mt-1 font-bold transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        )}

        <main className={`flex-1 ${isPosRoute ? "overflow-hidden h-full" : "overflow-y-auto"} bg-background relative ${isPosRoute ? "p-0" : "p-4 md:p-6"}`}>
          {/* Platform Broadcast Banner */}
          {broadcastsList.filter((b) => !dismissedNoticeIds.includes(b.id)).map((broadcast) => (
            <div
              key={broadcast.id}
              className={`mb-4 px-4 py-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                broadcast.priority === "URGENT_MAINTENANCE"
                  ? "bg-[#FDE8E8] border-[#F8B4B4] text-[#9C3232]"
                  : broadcast.priority === "WARNING"
                  ? "bg-[#FEF08A]/30 border-[#FEF08A] text-[#854D0E]"
                  : "bg-[#DEF7EC] border-[#BCF0DA] text-[#03543F]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">{broadcast.title}</span>
                  {broadcast.subheading && <span className="ml-1.5 opacity-80 font-medium">— {broadcast.subheading}</span>}
                  <p className="mt-0.5 leading-relaxed">{broadcast.body}</p>
                </div>
              </div>
              <button
                onClick={() => setDismissedNoticeIds((prev) => [...prev, broadcast.id])}
                className="opacity-70 hover:opacity-100 p-1 shrink-0 cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
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
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden shadow-xl"
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
                  <div className="h-16 flex items-center justify-between px-6 border-b border-[#3B2D31]">
                    <Link href="/dashboard" className="flex items-center gap-3">
                      <img src="/logo-icon.jpg" alt="RestroInn Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" />
                      <span className="font-black text-white dark:text-slate-100 tracking-tight text-sm">
                        RestroInn
                      </span>
                    </Link>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1 rounded-md text-[#71675E] hover:bg-[#FFFCF7]/10 hover:text-white"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-4 py-6">
                    {allowedNavigation.map((item) => renderNavItem(item, true))}
                  </nav>
                  <div className="p-4 border-t border-[#3B2D31]">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-red-400 hover:bg-red-500/10 font-bold transition-colors cursor-pointer"
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print animate-in fade-in duration-150">
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
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
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

      <ToastContainer />
    </div>
  );
}
