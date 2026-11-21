import type { NextAuthConfig } from "next-auth";

const isHttpsAuthUrl =
  process.env.AUTH_URL?.startsWith("https://") ||
  process.env.NEXTAUTH_URL?.startsWith("https://");

export const authConfig = {
  trustHost: true,
  ...(isHttpsAuthUrl ? { useSecureCookies: true } : {}),
  pages: {
    signIn: "/auth/login",
  },
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "763edd7e57c60b9057170b23348d159c948728cbc82cfdd42f78bb594f092344"
      : undefined),
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
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

          // CASHIER Route Protection: Cashiers can access Restaurant POS, Hotel, Sales, Menu Management, Customers, and Inventory
          if (role === "CASHIER") {
            const allowedPaths = [
              "/dashboard/restaurant",
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
        const redirectPath = role === "CASHIER" ? "/dashboard/restaurant/pos?view=menu" : "/dashboard";
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
        token.issuedAt = Date.now();
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
        (session.user as any).issuedAt = (token.issuedAt as number) || undefined;
      }
      return session;
    },
  },
  providers: [], // Configured inside src/auth.ts
} satisfies NextAuthConfig;
