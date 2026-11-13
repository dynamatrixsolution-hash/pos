/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines permissions and restrictions for each role
 */

export type Role =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "FRONT_DESK"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "HOUSEKEEPING"
  | "ACCOUNTANT"
  | "STOREKEEPER"
  | "SALESPERSON"
  | "DELIVERY";

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  [key: string]: Permission[];
}

// Define what each role can access and do
export const rolePermissions: RolePermissions = {
  WAITER: [
    { resource: "restaurant", actions: ["create", "view", "update"] }, // Table orders, rounds & session service
    { resource: "pos", actions: ["create", "view"] },
    { resource: "products", actions: ["view"] },
    { resource: "customers", actions: ["view", "create"] },
  ],
  KITCHEN: [
    { resource: "restaurant", actions: ["view", "update"] }, // Kitchen Display (KDS) & bump bars
    { resource: "products", actions: ["view"] },
  ],
  FRONT_DESK: [
    { resource: "hotel", actions: ["create", "view", "update"] }, // Room reservations, checkin, checkout, folios
    { resource: "customers", actions: ["create", "view", "update"] },
    { resource: "payments", actions: ["create", "view"] },
    { resource: "pilot", actions: ["view"] },
  ],
  HOUSEKEEPING: [
    { resource: "hotel", actions: ["view", "update"] }, // Room cleaning, inspection, maintenance status
  ],
  ACCOUNTANT: [
    { resource: "reports", actions: ["view"] }, // Financial, tax, CBMS reports
    { resource: "expenses", actions: ["create", "view", "update"] },
    { resource: "payments", actions: ["view", "create"] },
    { resource: "sales", actions: ["view"] },
    { resource: "purchases", actions: ["view"] },
    { resource: "shifts", actions: ["view"] },
  ],
  CASHIER: [
    { resource: "pos", actions: ["create", "view"] }, // POS Billing
    { resource: "restaurant", actions: ["create", "view", "update"] }, // Restaurant POS & Tables
    { resource: "hotel", actions: ["create", "view", "update"] }, // Hotel Front Desk & Service Desk
    { resource: "pilot", actions: ["create", "view"] }, // Pilot Rollout & Hardware Rehearsals
    { resource: "inventory", actions: ["create", "view", "update", "delete"] }, // Full inventory access
    { resource: "products", actions: ["create", "view"] }, // View and add products
    { resource: "customers", actions: ["view", "create"] }, // View and register customers
    { resource: "sales", actions: ["view"] }, // View sales history
    { resource: "shifts", actions: ["create", "view", "update"] },
  ],
  MANAGER: [
    // All services but limited to assigned warehouse
    { resource: "dashboard", actions: ["view"] },
    { resource: "pos", actions: ["create", "view"] },
    { resource: "restaurant", actions: ["create", "view", "update", "delete"] },
    { resource: "hotel", actions: ["create", "view", "update", "delete"] },
    { resource: "pilot", actions: ["create", "view", "update", "delete"] },
    { resource: "products", actions: ["view", "update"] },
    { resource: "categories", actions: ["view"] },
    { resource: "purchases", actions: ["create", "view", "update"] },
    { resource: "inventory", actions: ["view", "create", "update"] },
    { resource: "customers", actions: ["view", "create", "update"] },
    { resource: "suppliers", actions: ["view", "create", "update"] },
    { resource: "payments", actions: ["view", "create", "update"] },
    { resource: "reports", actions: ["view"] },
    { resource: "expenses", actions: ["view", "create", "update"] },
    { resource: "sales", actions: ["view"] },
    { resource: "branches", actions: ["view"] }, // View only
    { resource: "users", actions: ["view"] }, // View only users in their branch
    { resource: "settings", actions: ["view", "update"] },
    { resource: "shifts", actions: ["create", "view", "update", "delete"] },
  ],
  OWNER: [
    // All services
    { resource: "dashboard", actions: ["view"] },
    { resource: "pos", actions: ["create", "view"] },
    { resource: "restaurant", actions: ["create", "view", "update", "delete"] },
    { resource: "hotel", actions: ["create", "view", "update", "delete"] },
    { resource: "pilot", actions: ["create", "view", "update", "delete"] },
    { resource: "products", actions: ["create", "view", "update", "delete"] },
    { resource: "categories", actions: ["create", "view", "update", "delete"] },
    { resource: "purchases", actions: ["create", "view", "update", "delete"] },
    { resource: "inventory", actions: ["create", "view", "update", "delete"] },
    { resource: "customers", actions: ["create", "view", "update", "delete"] },
    { resource: "suppliers", actions: ["create", "view", "update", "delete"] },
    { resource: "payments", actions: ["create", "view", "update", "delete"] },
    { resource: "reports", actions: ["view"] },
    { resource: "expenses", actions: ["create", "view", "update", "delete"] },
    { resource: "sales", actions: ["view"] },
    { resource: "branches", actions: ["create", "view", "update", "delete"] }, // Full branch management
    { resource: "users", actions: ["create", "view", "update", "delete"] },
    { resource: "settings", actions: ["view", "update"] },
    { resource: "shifts", actions: ["create", "view", "update", "delete"] },
  ],
  SUPER_ADMIN: [
    // View-only for strategic data
    { resource: "branches", actions: ["view"] }, // View all branches
    { resource: "users", actions: ["view"] }, // View users (employees)
    { resource: "reports", actions: ["view"] }, // View statistics/reports
    { resource: "dashboard", actions: ["view"] }, // Super admin dashboard
    { resource: "hotel", actions: ["view"] },
    { resource: "pilot", actions: ["view"] },
    { resource: "shifts", actions: ["view"] },
  ],
};

// Define accessible resource patterns for each role
export const accessibleResources: Record<string, string[]> = {
  WAITER: [
    "/dashboard/restaurant",
    "/dashboard/restaurant/tables",
    "/dashboard/restaurant/pos",
    "/dashboard/restaurant/menu",
  ],
  KITCHEN: [
    "/dashboard/restaurant/kds",
    "/dashboard/restaurant/menu",
  ],
  FRONT_DESK: [
    "/dashboard/hotel",
    "/dashboard/hotel/rooms",
    "/dashboard/hotel/stays",
    "/dashboard/hotel/folios",
    "/dashboard/hotel/guest-services",
    "/dashboard/hotel/pilot-ops",
    "/dashboard/customers",
  ],
  HOUSEKEEPING: [
    "/dashboard/hotel/rooms",
    "/dashboard/hotel/maintenance",
  ],
  ACCOUNTANT: [
    "/dashboard/reports",
    "/dashboard/expenses",
    "/dashboard/sales",
    "/dashboard/purchases",
    "/dashboard/payments",
    "/dashboard/shifts",
  ],
  CASHIER: [
    "/dashboard/shifts",
    "/dashboard/pos",
    "/dashboard/restaurant",
    "/dashboard/hotel",
    "/dashboard/hotel/pilot-ops",
    "/dashboard/inventory",
    "/dashboard/customers",
    "/dashboard/products",
    "/dashboard/sales",
  ],
  MANAGER: [
    "/dashboard",
    "/dashboard/shifts",
    "/dashboard/pos",
    "/dashboard/restaurant",
    "/dashboard/hotel",
    "/dashboard/hotel/pilot-ops",
    "/dashboard/products",
    "/dashboard/categories",
    "/dashboard/purchases",
    "/dashboard/inventory",
    "/dashboard/customers",
    "/dashboard/suppliers",
    "/dashboard/payments",
    "/dashboard/reports",
    "/dashboard/expenses",
    "/dashboard/sales",
  ],
  OWNER: [
    "/dashboard",
    "/dashboard/shifts",
    "/dashboard/pos",
    "/dashboard/restaurant",
    "/dashboard/hotel",
    "/dashboard/hotel/pilot-ops",
    "/dashboard/products",
    "/dashboard/categories",
    "/dashboard/purchases",
    "/dashboard/inventory",
    "/dashboard/customers",
    "/dashboard/suppliers",
    "/dashboard/payments",
    "/dashboard/reports",
    "/dashboard/expenses",
    "/dashboard/sales",
    "/dashboard/users",
    "/dashboard/settings",
  ],
  SUPER_ADMIN: [
    "/dashboard",
    "/dashboard/shifts",
    "/dashboard/super-admin",
    "/dashboard/branches",
    "/dashboard/users",
    "/dashboard/reports",
  ],
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(role: Role, resource: string, action: string): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) return false;

  const resourcePermission = permissions.find((p) => p.resource === resource);
  return resourcePermission ? resourcePermission.actions.includes(action) : false;
}

/**
 * Check if a role can access a route
 */
export function canAccessRoute(role: Role, path: string): boolean {
  const accessible = accessibleResources[role];
  if (!accessible) return false;

  // Check exact match or prefix match
  return accessible.some((route) => path === route || path.startsWith(route + "/"));
}

/**
 * Get allowed routes for a role
 */
export function getAllowedRoutes(role: Role): string[] {
  return accessibleResources[role] || [];
}

/**
 * Check if user can perform action on resource
 */
export function authorize(role: Role, resource: string, action: string): { authorized: boolean; reason?: string } {
  if (!hasPermission(role, resource, action)) {
    return {
      authorized: false,
      reason: `Role ${role} does not have permission to ${action} ${resource}`,
    };
  }
  return { authorized: true };
}
