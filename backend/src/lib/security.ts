/**
 * Security, Sanitization & Cryptography Hardening Library
 * Adheres to Production Security & Anti-Exploit Standards
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

// Dummy hash generated with bcrypt 10 rounds for timing-attack mitigation
const DUMMY_BCRYPT_HASH = "$2a$10$wN1Q6N9U1L0Ym0aXfF5I1ODU9aE8t7w8P0I2N3M4L5K6J7H8G9F0A";

/**
 * Validates whether a string is a valid UUID (v1-v5) format.
 * Prevents SQL injection and directory/path enumeration in dynamic route parameters.
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Sanitizes user-supplied string inputs by stripping HTML and script tags.
 * Neutralizes Stored and Reflected Cross-Site Scripting (XSS) vectors.
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Sanitizes object fields recursively, stripping HTML tags from string values.
 */
export function sanitizePayload<T extends Record<string, any>>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;
  const sanitized: any = Array.isArray(payload) ? [] : {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      // Do not strip passwords or URLs
      if (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("url") || key.toLowerCase().includes("image")) {
        sanitized[key] = value;
      } else {
        sanitized[key] = stripHtml(value);
      }
    } else if (value && typeof value === "object" && !(value instanceof Date)) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Pre-hashes password with HMAC-SHA-256 pepper if PASSWORD_PEPPER is configured.
 */
export function pepperPassword(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) return password;
  return crypto.createHmac("sha256", pepper).update(password).digest("hex");
}

/**
 * Compares password against stored hash with timing attack resistance and pepper support.
 */
export async function verifyPasswordSecurely(
  candidate: string,
  storedHash: string
): Promise<boolean> {
  const peppered = pepperPassword(candidate);
  // Try with pepper first
  const matchPeppered = await bcrypt.compare(peppered, storedHash);
  if (matchPeppered) return true;

  // Fallback to plain candidate for legacy unpeppered hashes
  if (process.env.PASSWORD_PEPPER) {
    const matchPlain = await bcrypt.compare(candidate, storedHash);
    if (matchPlain) return true;
  }

  return false;
}

/**
 * Executes a dummy bcrypt compare when user is not found to equalize response timing.
 * Neutralizes account-enumeration timing attacks.
 */
export async function verifyDummyPassword(candidate: string = "dummy-password"): Promise<void> {
  try {
    await bcrypt.compare(candidate, DUMMY_BCRYPT_HASH);
  } catch {
    // Intentionally suppressed
  }
}

/**
 * Masks internal database, constraint, or SQL errors to prevent schema disclosure to clients.
 */
export function safeErrorMessage(error: any, fallback: string = "An unexpected error occurred"): string {
  if (!error) return fallback;

  const msg: string = error?.message || String(error);

  // Prisma error signatures
  if (error?.code === "P2002") {
    const targets = error?.meta?.target ? ` (${Array.isArray(error.meta.target) ? error.meta.target.join(", ") : error.meta.target})` : "";
    return `A record with this unique attribute${targets} already exists.`;
  }
  if (error?.code === "P2003") {
    return "This operation cannot be completed because related records depend on it.";
  }
  if (error?.code === "P2025") {
    return "The requested record could not be found or was already removed.";
  }

  // Check if error contains raw SQL or internal table names
  if (
    msg.includes("SELECT") ||
    msg.includes("INSERT") ||
    msg.includes("UPDATE") ||
    msg.includes("DELETE") ||
    msg.includes("prisma") ||
    msg.includes("database") ||
    msg.includes("foreign key") ||
    msg.includes("column")
  ) {
    return fallback;
  }

  // Safe user-facing message
  return msg.length > 200 ? fallback : msg;
}

