import fs from 'node:fs';

const filePath = 'frontend/src/components/dashboard-shell-client.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { usePathname } from "next/navigation";',
  'import { usePathname, useRouter } from "next/navigation";'
);

content = content.replace(
  '  TrendingUp,\n} from "lucide-react";',
  `  TrendingUp,
  LayoutGrid,
  Building2,
  ShieldCheck,
  FileText,
  CreditCard,
  Users,
  LifeBuoy,
  History,
  Activity,
  Settings,
} from "lucide-react";`
);

// 2. Add router and superAdmin state inside DashboardShellClient
const routerInsertionTarget = '  const isPosRoute = pathname === "/dashboard/pos";';
const routerCode = `  const router = useRouter();
  const [superAdminSearchQuery, setSuperAdminSearchQuery] = React.useState("");

  const superAdminPageTitle = React.useMemo(() => {
    if (pathname.includes("/businesses")) return "Businesses";
    if (pathname.includes("/requests")) return "Approvals";
    if (pathname.includes("/subscriptions")) return "Subscriptions";
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
    { title: "Businesses", href: "/dashboard/super-admin/businesses", icon: Building2 },
    { title: "Approvals", href: "/dashboard/super-admin/requests", icon: ShieldCheck },
    { title: "Subscriptions", href: "/dashboard/super-admin/subscriptions", icon: FileText },
    { title: "Billing & payments", href: "/dashboard/super-admin/revenue", icon: CreditCard },
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
    const isActive = isExact || isSub;
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => { if (isMobile) setMobileMenuOpen(false); }}
        className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all \${
          isActive
            ? "bg-[#FAF2F4] text-[#6B2837] border border-[#E8D7DA]/60 shadow-xs"
            : "text-[#292320] hover:bg-[#EEE7DD]/60 hover:text-[#292320]"
        }\`}
      >
        <Icon className={\`h-4 w-4 \${isActive ? "text-[#6B2837]" : "text-[#71675E]"}\`} />
        <span>{item.title}</span>
      </Link>
    );
  };
`;

content = content.replace(routerInsertionTarget, `${routerCode}\n  ${routerInsertionTarget}`);

// 3. Replace desktop sidebar
const desktopSidebarOld = `<aside className={\`hidden md:flex md:flex-col flex-shrink-0 transition-all duration-300 bg-[#241C1E] border-r border-[#3B2D31] no-print \${isPosRoute && !posSidebarOpen ? "w-0 overflow-hidden" : "w-64"}\`}>
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
      </aside>`;

const desktopSidebarNew = `{userRole === "SUPER_ADMIN" ? (
        <aside className="hidden md:flex md:flex-col flex-shrink-0 w-64 bg-[#F7F3EC] border-r border-[#D8CEC1] no-print">
          <div className="h-16 flex items-center px-6 border-b border-[#D8CEC1] bg-[#F7F3EC]">
            <Link href="/dashboard/super-admin" className="flex items-center gap-2.5">
              <div className="h-8 w-8 text-[#6B2837] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M4 11h16M7 11v8M17 11v8M5 4v7M9 4v7M7 4h2M15 4v7M19 4v7M19 7h-4" />
                </svg>
              </div>
              <div>
                <div className="font-extrabold text-base text-[#292320] leading-tight">RestroInn</div>
                <div className="text-[11px] text-[#71675E] leading-tight font-medium">Platform admin</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold text-[#71675E] uppercase tracking-wider">
                WORKSPACE
              </div>
              <div className="space-y-1">
                {superAdminWorkspaceItems.map((item) => renderSuperAdminNavItem(item))}
              </div>
            </div>

            <div>
              <div className="px-3 mb-2 text-[10px] font-bold text-[#71675E] uppercase tracking-wider">
                ADMINISTRATION
              </div>
              <div className="space-y-1">
                {superAdminAdminItems.map((item) => renderSuperAdminNavItem(item))}
              </div>
            </div>
          </nav>

          <div className="p-3 border-t border-[#D8CEC1] bg-[#F7F3EC]">
            <div
              onClick={() => setLogoutConfirmOpen(true)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-[#EEE7DD]/60 transition-colors cursor-pointer group"
              title="Click to logout or switch account"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[#FAF2F4] border border-[#E8D7DA] text-[#6B2837] font-bold text-xs flex items-center justify-center shrink-0">
                  PL
                </div>
                <div>
                  <div className="text-xs font-bold text-[#292320]">Platform admin</div>
                  <div className="text-[10px] text-[#71675E]">Super administrator</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#71675E] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </aside>
      ) : (
        <aside className={\`hidden md:flex md:flex-col flex-shrink-0 transition-all duration-300 bg-[#241C1E] border-r border-[#3B2D31] no-print \${isPosRoute && !posSidebarOpen ? "w-0 overflow-hidden" : "w-64"}\`}>
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
      )}`;

content = content.replace(desktopSidebarOld, desktopSidebarNew);

// 4. Update top header for SUPER_ADMIN
const headerOld = `<header className={\`flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 transition-all duration-300 bg-[#FFFCF7] border-b border-[#E5E7EB] no-print \${isPosRoute && !posNavbarOpen ? "h-0 opacity-0 overflow-hidden py-0 border-b-0" : "h-16"}\`}>`;

const headerReplacement = `{userRole === "SUPER_ADMIN" ? (
          <header className="flex items-center justify-between px-6 h-16 flex-shrink-0 z-30 bg-[#FFFCF7] border-b border-[#D8CEC1] no-print">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-md text-[#71675E] hover:bg-[#EEE7DD]"
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
              <div className="relative w-56 sm:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#71675E]" />
                <input
                  type="text"
                  placeholder="Find a business..."
                  value={superAdminSearchQuery}
                  onChange={(e) => setSuperAdminSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && superAdminSearchQuery.trim()) {
                      router.push(\`/dashboard/super-admin/businesses?search=\${encodeURIComponent(superAdminSearchQuery.trim())}\`);
                    }
                  }}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] transition-all"
                />
              </div>

              <button
                onClick={() => router.push("/dashboard/super-admin/monitoring")}
                className="p-2 rounded-lg border border-transparent hover:border-[#D8CEC1] hover:bg-[#F7F3EC] text-[#71675E] transition-colors relative"
                title="System Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </header>
        ) : (
          ${headerOld}`;

// Add closing tag for standard header
content = content.replace(headerOld, headerReplacement);
content = content.replace(
  '          </div>\n        </header>\n\n        {/* Main Content Area */}',
  '          </div>\n        </header>\n        )}\n\n        {/* Main Content Area */}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched dashboard-shell-client.tsx with Super Admin sidebar & navbar!');

