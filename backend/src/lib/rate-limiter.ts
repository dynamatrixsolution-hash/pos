/**
 * Production Sliding Window Rate Limiter & Anti-Abuse Engine
 * Prevents Brute-Force, Credential Stuffing, and Denial of Service.
 * Automatic garbage collection prevents V8 heap memory leaks.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class SlidingWindowRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run garbage collection every 5 minutes to release stale entries
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Evaluates if a request from an identifier should be allowed.
   * @param key Unique key, e.g. "auth:192.168.1.1" or "orders:userId"
   * @param maxRequests Maximum requests permitted within the window
   * @param windowSeconds Window length in seconds (default: 60)
   */
  public check(
    key: string,
    maxRequests: number,
    windowSeconds: number = 60
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      // Create new window
      const record: RateLimitRecord = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, record);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: record.resetAt,
        retryAfterSeconds: 0,
      };
    }

    // Existing active window
    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds,
      };
    }

    existing.count++;
    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetAt: existing.resetAt,
      retryAfterSeconds: 0,
    };
  }

  public reset(key: string): void {
    this.store.delete(key);
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();

/**
 * Extracts the real client IP address considering proxy headers (Cloudflare, Nginx, etc.)
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",");
    return ips[0].trim();
  }

  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "127.0.0.1";
}

/**
 * Helper to enforce rate limiting on API routes.
 * Returns an HTTP 429 response if limit is exceeded, or null if allowed.
 */
export function enforceRateLimit(
  request: Request,
  action: string,
  maxRequests: number,
  windowSeconds: number = 60
): Response | null {
  const ip = getClientIp(request);
  const key = `${action}:${ip}`;
  const result = rateLimiter.check(key, maxRequests, windowSeconds);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please slow down and try again later.",
        retryAfterSeconds: result.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

