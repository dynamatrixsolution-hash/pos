import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimiter, getClientIp } from "@/lib/rate-limiter";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply rate limiting and API defense to /api/v1 routes
  if (!pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // Preflight requests should always pass through uninhibited
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  // Determine client IP
  const ip = getClientIp(request);

  // Tiered rate limit based on path sensitivity
  let limit = 300; // 300 requests/minute for general POS, Hotel & Restaurant operations
  let windowSeconds = 60;
  let action = "api-general";

  if (pathname.startsWith("/api/v1/auth")) {
    limit = 30; // 30 requests/minute for authentication endpoints
    action = "api-auth";
  } else if (pathname.startsWith("/api/v1/guest/verify")) {
    limit = 20; // 20 scans/minute for QR table verification
    action = "api-guest-verify";
  }

  const key = `${action}:${ip}`;
  const result = rateLimiter.check(key, limit, windowSeconds);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  return response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
