import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "763edd7e57c60b9057170b23348d159c948728cbc82cfdd42f78bb594f092344"
      : undefined),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAuth = nextUrl.pathname.startsWith("/auth");

      if (isOnDashboard) {
        if (isLoggedIn) {
          const role = (auth.user as any)?.role || "CASHIER";
          const path = nextUrl.pathname;

          // SUPER_ADMIN Route Protection: Prevent non-SUPER_ADMIN users from accessing platform admin settings
          if (path.startsWith("/dashboard/super-admin")) {
            if (role !== "SUPER_ADMIN") {
              const redirectPath = role === "CASHIER" ? "/dashboard/restaurant/pos?view=menu" : "/dashboard";
              return Response.redirect(new URL(redirectPath, nextUrl));
            }
          }

          // CASHIER Route Protection: Cashiers can access Restaurant POS, Shifts, Hotel, Sales, Menu Management, Customers, and Inventory
          if (role === "CASHIER") {
            const allowedPaths = [
              "/dashboard/restaurant",
              "/dashboard/shifts",
              "/dashboard/hotel",
              "/dashboard/sales",
              "/dashboard/products",
              "/dashboard/customers",
              "/dashboard/inventory",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/restaurant/pos?view=menu", nextUrl));
            }
          }

          // WAITER Route Protection: Restaurant tables, POS ordering, and menus
          if (role === "WAITER") {
            const allowedPaths = [
              "/dashboard/restaurant",
              "/dashboard/restaurant/tables",
              "/dashboard/restaurant/pos",
              "/dashboard/restaurant/menu",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/restaurant/tables", nextUrl));
            }
          }

          // KITCHEN Route Protection: Kitchen Display System (KDS)
          if (role === "KITCHEN") {
            const allowedPaths = [
              "/dashboard/restaurant/kds",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/restaurant/kds", nextUrl));
            }
          }

          // FRONT_DESK Route Protection: Hotel rooms, stays, folios, guest services
          if (role === "FRONT_DESK") {
            const allowedPaths = [
              "/dashboard/hotel",
              "/dashboard/customers",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/hotel/rooms", nextUrl));
            }
          }

          // HOUSEKEEPING Route Protection: Room status & maintenance
          if (role === "HOUSEKEEPING") {
            const allowedPaths = [
              "/dashboard/hotel/rooms",
              "/dashboard/hotel/maintenance",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/hotel/rooms", nextUrl));
            }
          }

          // ACCOUNTANT Route Protection: Financial & tax reporting, sales, expenses
          if (role === "ACCOUNTANT") {
            const allowedPaths = [
              "/dashboard/reports",
              "/dashboard/expenses",
              "/dashboard/sales",
              "/dashboard/purchases",
              "/dashboard/payments",
              "/dashboard/profile",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/reports", nextUrl));
            }
          }

          // VENDOR (MANAGER) Route Protection: Prevent global system and roles access
          if (role === "MANAGER") {
            if (
              path.startsWith("/dashboard/users/roles") ||
              path.startsWith("/dashboard/users/branches") ||
              path.startsWith("/dashboard/users/devices") ||
              path.startsWith("/dashboard/users/activity")
            ) {
              return Response.redirect(new URL("/dashboard", nextUrl));
            }
          }

          return true;
        }
        return false; // Redirect unauthenticated users to login page
      } else if (isOnAuth && isLoggedIn) {
        const role = (auth.user as any)?.role || "CASHIER";
        let redirectPath = "/dashboard";
        if (role === "CASHIER") redirectPath = "/dashboard/restaurant/pos?view=menu";
        else if (role === "WAITER") redirectPath = "/dashboard/restaurant/tables";
        else if (role === "KITCHEN") redirectPath = "/dashboard/restaurant/kds";
        else if (role === "FRONT_DESK" || role === "HOUSEKEEPING") redirectPath = "/dashboard/hotel/rooms";
        else if (role === "ACCOUNTANT") redirectPath = "/dashboard/reports";
        return Response.redirect(new URL(redirectPath, nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.businessId = (user as any).businessId;
        token.branchId = (user as any).branchId;
      }
      // Authority is resolved from the database, never from client session updates.
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).businessId = token.businessId as string;
        (session.user as any).branchId = token.branchId as string;
      }
      return session;
    },
  },
  providers: [], // Configured inside src/auth.ts
} satisfies NextAuthConfig;
