"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
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
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${colorClasses[urgency]} transition-all duration-300 shadow-xs`}
      title={`Plan: ${plan} (Ends: ${new Date(endDate).toLocaleDateString()})`}
    >
      <Clock className="h-3 w-3" />
      <span className="hidden xs:inline uppercase tracking-wider text-[8px] opacity-75">{plan}:</span>
      <span>{timeLeft}</span>
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
  const { update } = useSession();
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);

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
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 group cursor-pointer ${
              hasActiveChild
                ? "bg-[#1E3A5F] text-white" 
                : "text-slate-300 hover:bg-[#1E3A5F] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`h-4.5 w-4.5 ${hasActiveChild ? "text-[#38BDF8]" : "text-slate-400 group-hover:text-white"}`} />
              {item.title}
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
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
                <div className="pl-6 pr-2 py-1.5 space-y-1 border-l border-slate-800 ml-5 mt-1">
                  {allowedChildren.map((child) => {
                    const isChildActive = pathname === child.href;
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.title}
                        href={child.href!}
                        onClick={() => isMobile && setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                          isChildActive
                            ? "bg-[#2563EB] text-white"
                            : "text-slate-400 hover:text-white hover:bg-[#1E3A5F]"
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
        className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 group mb-1.5 ${
          isActive
            ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-md shadow-[#2563EB]/15"
            : "text-slate-300 hover:bg-[#1E3A5F] hover:text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
          {item.title}
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 1. Sidebar desktop (Fixed dark theme) */}
      <aside className={`hidden md:flex md:flex-col flex-shrink-0 transition-all duration-300 bg-[#111827] border-r border-slate-800 ${isPosRoute && !posSidebarOpen ? "w-0 overflow-hidden" : "w-64"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#111827]">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img src="/logo.jpg" alt="DynaOne Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" />
            <span className="text-xl font-extrabold text-white tracking-tight">
              DynaOne
            </span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {allowedNavigation.map((item) => renderNavItem(item))}
        </nav>
        <div className="p-4 border-t border-slate-800 bg-[#111827]">
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 font-bold transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* 2. Main content container */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className={`flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 transition-all duration-300 bg-white border-b border-[#E5E7EB] ${isPosRoute && !posNavbarOpen ? "h-0 opacity-0 overflow-hidden py-0 border-b-0" : "h-16"}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-slate-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="md:hidden font-bold text-base sm:text-xl text-[#2563EB] shrink-0">DynaOne</div>
            
            {activeBranch && user.role !== "SUPER_ADMIN" && (
              <div className="relative">
                {/* Only show switch option for owners; non-owners see read-only badge */}
                {["SUPER_ADMIN", "OWNER"].includes(userRole) ? (
                  <>
                    <button
                      onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer shadow-xs select-none hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center justify-center p-1 bg-[#2563EB]/10 dark:bg-[#2563EB]/20 rounded-lg text-[#2563EB] dark:text-purple-400 shrink-0">
                        <Store className="h-3.5 w-3.5" />
                      </div>
                      <span className="max-w-[80px] sm:max-w-[120px] truncate text-slate-800 dark:text-slate-200 font-extrabold">{activeBranch.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                    {branchDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 p-1.5">
                          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Switch Branch
                          </div>
                          {branches.map((branch) => (
                            <button
                              key={branch.id}
                              onClick={() => handleBranchSwitch(branch)}
                              className={`flex items-center justify-between w-full text-left px-3 py-2.5 text-xs rounded-xl transition-colors cursor-pointer ${
                                activeBranch.id === branch.id
                                  ? "bg-[#2563EB]/10 text-[#2563EB] font-bold"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {branch.name}
                              {branch.isMain && <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">Main</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* Non-owners see only their assigned warehouse as read-only */
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold cursor-default select-none">
                    <div className="flex items-center justify-center p-1 bg-[#2563EB]/10 dark:bg-[#2563EB]/20 rounded-lg text-[#2563EB] dark:text-purple-400 shrink-0">
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <span className="max-w-[80px] sm:max-w-[120px] truncate text-slate-800 dark:text-slate-200 font-extrabold">{activeBranch.name}</span>
                  </div>
                )}
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
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors relative cursor-pointer"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-[#050B1E]" />
                )}
              </button>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 p-1.5">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Alerts & Logs</span>
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
                          <div key={n.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl flex items-start gap-2.5 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-slate-850 dark:text-slate-200">{n.title}</div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{n.message}</p>
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
                className="flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/60 p-1 rounded-xl transition-colors cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/25 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs select-none">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{user.name}</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 tracking-wider uppercase font-bold">
                    {user.role}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden lg:block" />
              </button>
              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 p-1.5">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-left">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{user.name}</div>
                      <div className="text-[10px] text-slate-450 dark:text-slate-500 truncate mt-0.5">{user.email}</div>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl mt-1.5 font-bold transition-colors cursor-pointer"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      My Profile
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl mt-1 font-bold transition-colors cursor-pointer"
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

        <main className={`flex-1 overflow-y-auto bg-background relative ${isPosRoute ? "p-0" : "p-4 md:p-6"}`}>
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
              className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden"
              style={{ backgroundColor: "#111827" }}
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                <Link href="/dashboard" className="flex items-center gap-3">
                  <img src="/logo.jpg" alt="DynaOne Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" />
                  <span className="text-xl font-extrabold text-white tracking-tight">
                    DynaOne
                  </span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                {allowedNavigation.map((item) => renderNavItem(item, true))}
              </nav>
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Confirm Logout</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  Are you sure you want to log out of your session? You will need to sign in again to access the dashboard.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold transition-all cursor-pointer text-slate-700 dark:text-slate-350 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={async () => {
                  setLogoutLoading(true);
                  await signOut({ callbackUrl: "/auth/login" });
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {logoutLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Log Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
