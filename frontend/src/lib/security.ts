/**
 * Security, Sanitization & Cryptography Hardening Library (Frontend / Server Runtime)
 * Adheres to Production Security & Anti-Exploit Standards
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

const DUMMY_BCRYPT_HASH = "$2a$10$wN1Q6N9U1L0Ym0aXfF5I1ODU9aE8t7w8P0I2N3M4L5K6J7H8G9F0A";

export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function pepperPassword(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) return password;
  return crypto.createHmac("sha256", pepper).update(password).digest("hex");
}

export async function verifyPasswordSecurely(
  candidate: string,
  storedHash: string
): Promise<boolean> {
  const peppered = pepperPassword(candidate);
  const matchPeppered = await bcrypt.compare(peppered, storedHash);
  if (matchPeppered) return true;

  if (process.env.PASSWORD_PEPPER) {
    const matchPlain = await bcrypt.compare(candidate, storedHash);
    if (matchPlain) return true;
  }

  return false;
}

export async function verifyDummyPassword(candidate: string = "dummy-password"): Promise<void> {
  try {
    await bcrypt.compare(candidate, DUMMY_BCRYPT_HASH);
  } catch {
    // Intentionally suppressed
  }
}

