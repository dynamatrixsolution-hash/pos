/**
 * Client-side Authorization Utilities
 * Hook and functions for checking user permissions on the client
 */

"use client";

import { useSession } from "next-auth/react";
import { navigationConfig, NavItem } from "@/lib/nav-config";
import { hasPermission } from "@/lib/rbac";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
  branchId: string | null;
  isActive: boolean;
}

/**
 * Hook to get current user from session
 */
export function useUser(): User | null {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return {
    id: (session.user as any).id,
    email: session.user.email || "",
    name: session.user.name || "",
    role: (session.user as any).role || "CASHIER",
    businessId: (session.user as any).businessId,
    branchId: (session.user as any).branchId,
    isActive: true,
  };
}

/**
 * Hook to check if user has permission
 */
export function usePermission(resource: string, action: string): boolean {
  const user = useUser();
  if (!user) return false;

  return hasPermission(user.role as any, resource, action);
}

/**
 * Hook to get filtered navigation based on user role
 */
export function useFilteredNavigation(): NavItem[] {
  const user = useUser();
  if (!user) return [];

  return filterNavigationByRole(navigationConfig, user.role);
}

/**
 * Filter navigation items based on role
 */
export function filterNavigationByRole(items: NavItem[], role: string): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role as any))
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: filterNavigationByRole(item.children, role),
        };
      }
      return item;
    })
    .filter((item) => !item.children || item.children.length > 0);
}

/**
 * Check if user can perform action on resource
 */
export function canPerform(role: string, resource: string, action: string): boolean {
  return hasPermission(role as any, resource, action);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    SUPER_ADMIN: "Super Administrator",
    OWNER: "Owner",
    MANAGER: "Manager",
    CASHIER: "Cashier",
  };
  return roleNames[role] || role;
}

/**
 * Check if user is admin (Owner or Super Admin)
 */
export function isAdmin(role: string): boolean {
  return ["OWNER", "SUPER_ADMIN"].includes(role);
}

/**
 * Check if user can manage branches
 */
export function canManageBranches(role: string): boolean {
  return role === "OWNER";
}

/**
 * Check if user is cashier
 */
export function isCashier(role: string): boolean {
  return role === "CASHIER";
}

/**
 * Check if user is manager
 */
export function isManager(role: string): boolean {
  return role === "MANAGER";
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}
