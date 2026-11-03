import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/error")) {
    const errorParam = url.searchParams.get("error");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const redirectUrl = new URL("/auth/error", `${proto}://${host}`);
    if (errorParam) {
      redirectUrl.searchParams.set("error", errorParam);
    }
    return NextResponse.redirect(redirectUrl);
  }
  return handlers.GET(req);
}

export const POST = handlers.POST;
