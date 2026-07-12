"use client";

import { SessionProvider as Provider } from "next-auth/react";

if (typeof window !== "undefined") {
  const originalJson = Response.prototype.json;
  Response.prototype.json = async function () {
    const cloned = this.clone();
    try {
      return await originalJson.call(this);
    } catch (err: any) {
      if (err instanceof Error && (
        err.message.includes("is not valid JSON") || 
        err.message.includes("Unexpected token")
      )) {
        try {
          const text = await cloned.text();
          if (text && text.trim()) {
            const cleanText = text.trim();
            if (cleanText.length < 150) {
              throw new Error(cleanText);
            }
          }
        } catch (textErr) {
          // Ignore and use fallback
        }
        throw new Error(
          this.status >= 500
            ? "Internal Server Error"
            : `Server returned an invalid response (Status ${this.status}).`
        );
      }
      throw err;
    }
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>;
}
