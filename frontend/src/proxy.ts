import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { canAccessRoute, getDefaultDashboardRoute } from "./lib/rbac";

const { auth } = NextAuth(authConfig);

export default auth(function proxy(req: any): any {
  const pathname = req.nextUrl.pathname;
  const user = req.auth?.user as any;

  if (!user) {
    const loginUrl = new URL("/auth/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const role = user.role || "CASHIER";

  // Always allow the unauthorized page itself to prevent redirect loops
  if (pathname === "/dashboard/unauthorized" || pathname.startsWith("/dashboard/unauthorized/")) {
    return NextResponse.next();
  }

  // Transparently land non-owner roles on their workspace home when hitting /dashboard directly
  if (pathname === "/dashboard" && !canAccessRoute(role, "/dashboard")) {
    const homeUrl = new URL(getDefaultDashboardRoute(role), req.nextUrl.origin);
    return NextResponse.redirect(homeUrl);
  }

  // Enforce strict RBAC route boundaries
  if (!canAccessRoute(role, pathname)) {
    const redirectUrl = new URL("/dashboard/unauthorized", req.nextUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
