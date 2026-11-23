"use client";

import { useEffect } from "react";

export interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __restroinnInstallPrompt?: DeferredInstallPromptEvent | null;
  }
}

export const INSTALL_READY_EVENT = "restroinn-pwa-install-ready";

export function getDeferredInstallPrompt(): DeferredInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__restroinnInstallPrompt ?? null;
}

export async function triggerNativeInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = getDeferredInstallPrompt();
  if (!promptEvent) return "unavailable";
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  window.__restroinnInstallPrompt = null;
  return choice.outcome;
}

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // ignore on unsupported/non-HTTPS contexts
      });
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__restroinnInstallPrompt = e as DeferredInstallPromptEvent;
      window.dispatchEvent(new CustomEvent(INSTALL_READY_EVENT));
    };

    const onAppInstalled = () => {
      window.__restroinnInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
