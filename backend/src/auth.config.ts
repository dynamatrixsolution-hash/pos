import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/login",
  },
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
              const redirectPath = role === "CASHIER" ? "/dashboard/pos" : "/dashboard";
              return Response.redirect(new URL(redirectPath, nextUrl));
            }
          }

          // CASHIER Route Protection: Cashiers can access POS, Sales, Products, Customers, and Inventory
          if (role === "CASHIER") {
            const allowedPaths = [
              "/dashboard/pos",
              "/dashboard/sales",
              "/dashboard/products",
              "/dashboard/customers",
              "/dashboard/inventory",
            ];
            const isAllowed = allowedPaths.some(
              (allowedPath) => path === allowedPath || path.startsWith(allowedPath + "/")
            );
            if (!isAllowed) {
              return Response.redirect(new URL("/dashboard/pos", nextUrl));
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
        const redirectPath = role === "CASHIER" ? "/dashboard/pos" : "/dashboard";
        return Response.redirect(new URL(redirectPath, nextUrl));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.businessId = (user as any).businessId;
        token.branchId = (user as any).branchId;
      }
      // Handle session update triggers
      if (trigger === "update" && session) {
        token.role = session.role ?? token.role;
        token.branchId = session.branchId ?? token.branchId;
      }
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
