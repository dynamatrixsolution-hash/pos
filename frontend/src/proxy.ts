import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { canAccessRoute } from "./lib/rbac";

import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth(function proxy(req: any): any {
  const pathname = req.nextUrl.pathname;
  const user = req.auth?.user as any;
  const role = user?.role || "CASHIER";

  // Check if user has access to the requested route
  if (!canAccessRoute(role, pathname)) {
    const redirectUrl = new URL("/dashboard/unauthorized", req.nextUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
