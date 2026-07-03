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
  Laptop,
  Activity,
  GitBranch,
  RefreshCcw,
  ClipboardList,
  AlertTriangle,
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
} from "lucide-react";

export type Role = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER";

export interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  roles: Role[];
  feature?: string;
  children?: NavItem[];
}

/**
 * Navigation Configuration with Role-Based Access
 * 
 * CASHIER: POS Billing, Products, Sales History, Inventory, Customers
 * MANAGER: All services (limited to assigned warehouse)
 * OWNER: All services + Branch management + User management
 * SUPER_ADMIN: Dashboard, Business Management, Subscription Management, Revenue & Payments, Users, Support, Activity Logs, Platform Settings, Monitoring
 */
export const navigationConfig: NavItem[] = [
  // Dashboard - Available to Manager, Owner, Super Admin
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },

  // POS Billing - Available to Cashier, Manager, Owner
  {
    title: "POS Billing",
    href: "/dashboard/pos",
    icon: ShoppingCart,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "POS Billing",
  },

  // Products - Cashier, Manager, Owner (Cashier has view-only access)
  {
    title: "Products",
    href: "/dashboard/products",
    icon: Package,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "Products",
  },

  // Category & Unit - Manager and above
  {
    title: "Category & Unit",
    href: "/dashboard/categories",
    icon: Layers,
    roles: ["OWNER", "MANAGER"],
    feature: "Products",
  },

  // Purchase - Manager and above
  {
    title: "Purchase",
    href: "/dashboard/purchases",
    icon: ShoppingCart,
    roles: ["OWNER", "MANAGER"],
    feature: "Purchases",
  },

  // Inventory - Cashier, Manager, Owner
  {
    title: "Inventory",
    icon: Store,
    roles: ["OWNER", "MANAGER", "CASHIER"],
    feature: "Inventory",
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
        feature: "Batch Tracking",
      },
      {
        title: "Damage & Expiry",
        href: "/dashboard/inventory/damage-expiry",
        icon: AlertTriangle,
        roles: ["OWNER", "MANAGER", "CASHIER"],
        feature: "Expiry Tracking",
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
        feature: "Multi Branch",
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
  },

  // Suppliers - Manager and above
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: Truck,
    roles: ["OWNER", "MANAGER"],
    feature: "Suppliers",
  },

  // Payments - Manager, Owner
  {
    title: "Payments",
    icon: CreditCard,
    roles: ["OWNER", "MANAGER"],
    feature: "Payments",
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
      },
      {
        title: "Outstanding Reports",
        href: "/dashboard/reports/outstanding",
        icon: AlertTriangle,
        roles: ["OWNER", "MANAGER"],
      },
      {
        title: "Accounting Reports",
        href: "/dashboard/reports/accounting",
        icon: Receipt,
        roles: ["OWNER", "MANAGER"],
      },
      {
        title: "Inventory Reports",
        href: "/dashboard/reports/inventory",
        icon: Boxes,
        roles: ["OWNER", "MANAGER"],
      },
      {
        title: "Other Reports",
        href: "/dashboard/reports/other",
        icon: PieChart,
        roles: ["OWNER", "MANAGER"],
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
  },

  // Sales History - Cashier view
  {
    title: "Sales History",
    href: "/dashboard/sales",
    icon: History,
    roles: ["CASHIER"],
    feature: "POS Billing",
  },

  // Branches Management - Owner only
  {
    title: "Branches",
    href: "/dashboard/branches",
    icon: GitBranch,
    roles: ["OWNER"],
    feature: "Multi Branch",
  },

  // Users & Roles - Owner only (SUPER_ADMIN removed)
  {
    title: "Users & Roles",
    icon: Shield,
    roles: ["OWNER"],
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
  },
  {
    title: "Subscription",
    href: "/dashboard/subscriptions",
    icon: CreditCard,
    roles: ["OWNER"],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["OWNER", "MANAGER"],
  },

  // ==========================================
  // SUPER ADMIN PORTAL NAVIGATION ITEMS
  // ==========================================

  // Business Management
  {
    title: "Business Management",
    icon: Building,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "All Businesses",
        href: "/dashboard/super-admin/businesses?tab=all",
        icon: Store,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Add Business",
        href: "/dashboard/super-admin/businesses?tab=add",
        icon: Building,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Suspended Businesses",
        href: "/dashboard/super-admin/businesses?tab=suspended",
        icon: AlertTriangle,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  // Subscription Management
  {
    title: "Subscription Management",
    icon: CreditCard,
    roles: ["SUPER_ADMIN"],
    children: [
      {
        title: "Plans",
        href: "/dashboard/super-admin/subscriptions?tab=plans",
        icon: Layers,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Feature Toggles",
        href: "/dashboard/super-admin/subscriptions?tab=toggles",
        icon: Shield,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Plan Limits",
        href: "/dashboard/super-admin/subscriptions?tab=limits",
        icon: Laptop,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Currency Management",
        href: "/dashboard/super-admin/subscriptions?tab=currency",
        icon: Receipt,
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
