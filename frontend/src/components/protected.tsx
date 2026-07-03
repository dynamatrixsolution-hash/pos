/**
 * Protected Component - Restricts access based on user role
 * Can be used to wrap pages or page sections
 */

"use client";

import { ReactNode } from "react";
import { useUser } from "@/lib/client-auth";
import { hasPermission } from "@/lib/rbac";

interface ProtectedProps {
  children: ReactNode;
  resource: string;
  action: string;
  fallback?: ReactNode;
}

export function Protected({ children, resource, action, fallback }: ProtectedProps) {
  const user = useUser();

  if (!user) {
    return <>{fallback || <AccessDenied />}</>;
  }

  const hasAccess = hasPermission(user.role as any, resource, action);

  if (!hasAccess) {
    return <>{fallback || <AccessDenied />}</>;
  }

  return <>{children}</>;
}

/**
 * Access Denied Component
 */
export function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2m0 0h.01M4.217 4.217l1.414 1.414m4.243-4.243l1.414 1.414m4.243 0l1.414-1.414m0 4.243l1.414-1.414M5.04 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600">
          You don't have permission to access this resource.
        </p>
      </div>
    </div>
  );
}

/**
 * Conditional render based on permission
 */
interface IfPermittedProps {
  children: ReactNode;
  resource: string;
  action: string;
}

export function IfPermitted({ children, resource, action }: IfPermittedProps) {
  const user = useUser();

  if (!user) return null;

  const hasAccess = hasPermission(user.role as any, resource, action);

  return hasAccess ? <>{children}</> : null;
}

/**
 * Admin only component
 */
interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const user = useUser();

  if (!user) return <>{fallback}</>;

  const isAdmin = ["OWNER", "SUPER_ADMIN"].includes(user.role);

  return isAdmin ? <>{children}</> : <>{fallback}</>;
}

/**
 * Owner only component
 */
export function OwnerOnly({ children, fallback }: AdminOnlyProps) {
  const user = useUser();

  if (!user) return <>{fallback}</>;

  return user.role === "OWNER" ? <>{children}</> : <>{fallback}</>;
}

/**
 * Manager and above component
 */
export function ManagerAndAbove({ children, fallback }: AdminOnlyProps) {
  const user = useUser();

  if (!user) return <>{fallback}</>;

  const isManagerOrAbove = ["OWNER", "MANAGER", "SUPER_ADMIN"].includes(user.role);

  return isManagerOrAbove ? <>{children}</> : <>{fallback}</>;
}

/**
 * Cashier view component
 */
export function CashierView({ children, fallback }: AdminOnlyProps) {
  const user = useUser();

  if (!user) return <>{fallback}</>;

  return user.role === "CASHIER" ? <>{children}</> : <>{fallback}</>;
}
