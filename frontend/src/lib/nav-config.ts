import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Store,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  Laptop,
  Activity,
  GitBranch,
  RefreshCcw,
  ClipboardList,
  AlertTriangle,
  Bell,
  History,
  TrendingUp,
  Boxes,
  PieChart,
  Building,
  DollarSign,
  HelpCircle,
  Ticket,
  FileText,
  Terminal,
  UtensilsCrossed,
  BedDouble,
  Calendar,
  KeyRound,
  ClipboardCheck,
  QrCode,
  Clock,
  Rocket,
  MessageSquare,
  BellRing,
  BookOpen,
} from "lucide-react";

export type Role =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "FRONT_DESK"
  | "HOUSEKEEPING"
  | "ACCOUNTANT";

export interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  roles: Role[];
  feature?: string;
  permission?: string;
  group?: string;
  children?: NavItem[];
}

/**
 * Navigation Configuration with Role-Based Access
 * 
 * Order:
 * 1. Dashboard
 * 2. Restaurant (Table Status, Restaurant POS, Kitchen Display)
 * 3. Hotel & Stays (if hotel enabled)
 * 4. Menu Management (/dashboard/products)
 * 5. Tables & Cabins (/dashboard/restaurant/tables)
 * 6. Generate Menu QR (/dashboard/restaurant/qr)
 * 7. Remaining back-office & administration sections
 */
export const navigationConfig: NavItem[] = [
  // 1. Dashboard - Available to Manager, Owner, Super Admin
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
    group: "Operations",
  },

  // 2. Restaurant Operations (Table Status, POS & KDS)
  {
    title: "Restaurant",
    icon: UtensilsCrossed,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    group: "Operations",
    children: [
      {
        title: "Table Status",
        href: "/dashboard/restaurant/pos?view=tables",
        icon: Store,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Restaurant POS",
        href: "/dashboard/restaurant/pos?view=menu",
        icon: ShoppingCart,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Kitchen Display (KDS)",
        href: "/dashboard/restaurant/kds",
        icon: Terminal,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
    ],
  },

  // 2b. Cash Register & Shift Management
  {
    title: "Cash Registers & Shifts",
    href: "/dashboard/shifts",
    icon: DollarSign,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    group: "Operations",
  },

  // 3. Hotel & Stays - Available to Cashier, Manager, Owner (hidden when restaurant-only)
  {
    title: "Hotel & Stays",
    icon: BedDouble,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    group: "Operations",
    children: [
      {
        title: "Rooms & Floor Manager",
        href: "/dashboard/hotel/rooms",
        icon: BedDouble,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Reservations",
        href: "/dashboard/hotel/reservations",
        icon: Calendar,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "In-House Stays",
        href: "/dashboard/hotel/stays",
        icon: KeyRound,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Guest Folios & Billing",
        href: "/dashboard/hotel/folios",
        icon: Receipt,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Housekeeping & Maintenance",
        href: "/dashboard/hotel/housekeeping",
        icon: ClipboardCheck,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Guest QR & Self-Order Stand",
        href: "/dashboard/hotel/qr-portal",
        icon: QrCode,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Pilot & Hardware Ops",
        href: "/dashboard/hotel/pilot-ops",
        icon: ShieldCheck,
        roles: ["OWNER", "MANAGER", "CASHIER"],
        permission: "pos:Access",
      },
    ],
  },

  // 4. Menu Management (formerly Products) - Cashier, Manager, Owner
  {
    title: "Menu Management",
    href: "/dashboard/products",
    icon: BookOpen,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "Products",
    group: "Dining & Menu",
  },

  // 5. Tables & Cabins - Direct on Sidebar
  {
    title: "Tables & Cabins",
    href: "/dashboard/restaurant/tables",
    icon: Store,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    group: "Dining & Menu",
  },

  // 6. Generate Menu QR - Direct on Sidebar
  {
    title: "Generate Menu QR",
    href: "/dashboard/restaurant/qr",
    icon: QrCode,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    group: "Dining & Menu",
  },

  // 7. Remaining Sections: Category & Unit - Manager and above
  {
    title: "Category & Unit",
    href: "/dashboard/categories",
    icon: Layers,
    roles: ["OWNER", "MANAGER"],
    feature: "Products",
    group: "Dining & Menu",
  },

  // Purchase - Manager and above
  {
    title: "Purchase",
    href: "/dashboard/purchases",
    icon: ShoppingCart,
    roles: ["OWNER", "MANAGER"],
    feature: "Purchases",
    group: "Inventory & Finance",
  },

  // Inventory - Cashier, Manager, Owner
  {
    title: "Inventory",
    icon: Boxes,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "Inventory",
    group: "Inventory & Finance",
    children: [
      {
        title: "Overview",
        href: "/dashboard/inventory",
        icon: LayoutDashboard,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Current Stock",
        href: "/dashboard/inventory/current-stock",
        icon: Boxes,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Stock In / Out",
        href: "/dashboard/inventory/stock-movements",
        icon: RefreshCcw,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Stock Adjustments",
        href: "/dashboard/inventory/stock-adjustments",
        icon: ClipboardList,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Batch-wise Stock",
        href: "/dashboard/inventory/batch-stock",
        icon: Layers,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Damage & Expiry",
        href: "/dashboard/inventory/damage-expiry",
        icon: AlertTriangle,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Stock Value Report",
        href: "/dashboard/inventory/stock-value",
        icon: PieChart,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Movement History",
        href: "/dashboard/inventory/movement-history",
        icon: History,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Opening Stock",
        href: "/dashboard/inventory/opening",
        icon: TrendingUp,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
      {
        title: "Stock Transfers",
        href: "/dashboard/inventory/transfers",
        icon: Truck,
        roles: ["OWNER", "MANAGER", "CASHIER"],
      },
    ],
  },

  // Customers - Cashier, Manager, Owner
  {
    title: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "Customers",
    group: "Inventory & Finance",
  },

  // Suppliers - Manager and above
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: Truck,
    roles: ["OWNER", "MANAGER"],
    feature: "Suppliers",
    group: "Inventory & Finance",
  },

  // Payments - Manager, Owner
  {
    title: "Payments",
    icon: CreditCard,
    roles: ["OWNER", "MANAGER"],
    feature: "Payments",
    group: "Inventory & Finance",
    children: [
      {
        title: "Payment Received",
        href: "/dashboard/payments/received",
        icon: CreditCard,
        roles: ["OWNER", "MANAGER"],
      },
      {
        title: "Payment Sent",
        href: "/dashboard/payments/sent",
        icon: CreditCard,
        roles: ["OWNER", "MANAGER"],
      },
    ],
  },

  // Reports - Manager, Owner (SUPER_ADMIN removed as they have dedicated Revenue reports)
  {
    title: "Reports",
    icon: BarChart3,
    roles: ["OWNER", "MANAGER"],
    feature: "Reports",
    group: "Inventory & Finance",
    children: [
      {
        title: "Daily Reports",
        href: "/dashboard/reports/daily",
        icon: TrendingUp,
        roles: ["OWNER", "MANAGER"],
      },
      {
        title: "Transaction Reports",
        href: "/dashboard/reports/transactions",
        icon: ClipboardList,
        roles: ["OWNER", "MANAGER"],
        feature: "Full Reports",
      },
      {
        title: "Outstanding Reports",
        href: "/dashboard/reports/outstanding",
        icon: AlertTriangle,
        roles: ["OWNER", "MANAGER"],
        feature: "Full Reports",
      },
      {
        title: "Accounting Reports",
        href: "/dashboard/reports/accounting",
        icon: Receipt,
        roles: ["OWNER", "MANAGER"],
        feature: "Full Reports",
      },
      {
        title: "Inventory Reports",
        href: "/dashboard/reports/inventory",
        icon: Boxes,
        roles: ["OWNER", "MANAGER"],
        feature: "Full Reports",
      },
      {
        title: "Other Reports",
        href: "/dashboard/reports/other",
        icon: PieChart,
        roles: ["OWNER", "MANAGER"],
        feature: "Full Reports",
      },
    ],
  },

  // Expenses - Manager and above
  {
    title: "Expenses",
    href: "/dashboard/expenses",
    icon: Receipt,
    roles: ["OWNER", "MANAGER"],
    feature: "Expenses",
    group: "Inventory & Finance",
  },

  // Sales History - Cashier view
  {
    title: "Sales History",
    href: "/dashboard/sales",
    icon: History,
    roles: ["CASHIER"],
    feature: "POS Billing",
    group: "Inventory & Finance",
  },

  // Branches Management - Owner only
  {
    title: "Branches",
    href: "/dashboard/branches",
    icon: GitBranch,
    roles: ["OWNER"],
    feature: "Multi Branch",
    group: "Administration",
  },

  // Users & Roles - Owner only (SUPER_ADMIN removed)
  {
    title: "Users & Roles",
    icon: Shield,
    roles: ["OWNER"],
    group: "Administration",
    children: [
      {
        title: "User List",
        href: "/dashboard/users",
        icon: Users,
        roles: ["OWNER"],
      },
      {
        title: "Roles & Permissions",
        href: "/dashboard/users/roles",
        icon: Shield,
        roles: ["OWNER"],
      },
      {
        title: "Branch Access",
        href: "/dashboard/users/branches",
        icon: GitBranch,
        roles: ["OWNER"],
        feature: "Multi Branch",
      },
      {
        title: "Device Control",
        href: "/dashboard/users/devices",
        icon: Laptop,
        roles: ["OWNER"],
        feature: "Device Control",
      },
      {
        title: "Activity Log",
        href: "/dashboard/users/activity",
        icon: Activity,
        roles: ["OWNER"],
        feature: "Activity Logs",
      },
    ],
  },
  {
    title: "Cashier Management",
    href: "/dashboard/users",
    icon: Users,
    roles: ["MANAGER"],
    group: "Administration",
  },
  {
    title: "Push Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    roles: ["OWNER", "MANAGER"],
    group: "Administration",
  },
  {
    title: "Subscription",
    href: "/dashboard/subscriptions",
    icon: CreditCard,
    roles: ["OWNER"],
    group: "Administration",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["OWNER", "MANAGER"],
    group: "Administration",
  },
  {
    title: "Support & Messages",
    href: "/dashboard/support",
    icon: HelpCircle,
    roles: ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "FRONT_DESK", "HOUSEKEEPING", "ACCOUNTANT"],
    group: "Administration",
  },

  // ==========================================
  // SUPER ADMIN PORTAL NAVIGATION ITEMS
  // ==========================================

  // Business Management
  {
    title: "Businesses",
    icon: Building,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "All Businesses",
        href: "/dashboard/super-admin/businesses",
        icon: Store,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Pending Approvals",
        href: "/dashboard/super-admin/businesses/pending",
        icon: ShieldCheck,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Expiring Subscriptions",
        href: "/dashboard/super-admin/businesses/expiring",
        icon: Clock,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // Subscription Management
  {
    title: "Subscriptions & Plans",
    icon: CreditCard,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "All Subscriptions",
        href: "/dashboard/super-admin/subscriptions",
        icon: CreditCard,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Plans & Pricing",
        href: "/dashboard/super-admin/subscriptions/plans",
        icon: Layers,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // Revenue & Payments
  {
    title: "Revenue & Payments",
    icon: DollarSign,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "Revenue Overview",
        href: "/dashboard/super-admin/revenue?tab=overview",
        icon: TrendingUp,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Business Payments",
        href: "/dashboard/super-admin/revenue?tab=payments",
        icon: DollarSign,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Invoices",
        href: "/dashboard/super-admin/revenue?tab=invoices",
        icon: FileText,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // User Management
  {
    title: "User Management",
    icon: Users,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "Business Owners",
        href: "/dashboard/super-admin/users?tab=owners",
        icon: Users,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Active Users",
        href: "/dashboard/super-admin/users?tab=active",
        icon: Laptop,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // Direct Messages
  {
    title: "Direct Messages",
    href: "/dashboard/super-admin/chat",
    icon: MessageSquare,
    roles: ["SUPER_ADMIN"],
  },

  // Push Notifications Center
  {
    title: "Push Notifications",
    href: "/dashboard/super-admin/notifications",
    icon: BellRing,
    roles: ["SUPER_ADMIN"],
  },

  // Support Center
  {
    title: "Support Center",
    icon: HelpCircle,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "Tickets",
        href: "/dashboard/super-admin/support?tab=tickets",
        icon: Ticket,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Announcements",
        href: "/dashboard/super-admin/support?tab=announcements",
        icon: AlertTriangle,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // Activity Logs
  {
    title: "Activity Logs",
    href: "/dashboard/super-admin/activity-logs",
    icon: Activity,
    roles: ["SUPER_ADMIN"],
  },

  // Platform Settings
  {
    title: "Platform Settings",
    href: "/dashboard/super-admin/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN"],
  },

  // System Monitoring
  {
    title: "System Monitoring",
    href: "/dashboard/super-admin/monitoring",
    icon: Terminal,
    roles: ["SUPER_ADMIN"],
  },
];
