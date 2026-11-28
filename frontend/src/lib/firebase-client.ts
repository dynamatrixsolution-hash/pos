"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId,
    appId,
  };
}

export function isFirebaseWebConfigured(): boolean {
  return Boolean(getFirebaseConfig() && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

/**
 * Requests browser push permission, obtains FCM Web token, and registers it with backend.
 * Safe no-op if Firebase Web config or browser Notification API is unavailable.
 */
export async function registerWebPushToken(options?: {
  guestSessionId?: string;
  guestSessionToken?: string | null;
  publicCode?: string | null;
}): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }
  const config = getFirebaseConfig();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!config || !vapidKey) return null;

  try {
    const supported = await isSupported();
    if (!supported) return null;

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") return null;

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await fetch("/api/v1/notifications/register-token", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.guestSessionToken ? { "x-guest-session-token": options.guestSessionToken } : {}),
      },
      body: JSON.stringify({
        token,
        platform: "WEB",
        deviceLabel: navigator.userAgent.slice(0, 100),
        ...(options?.guestSessionId ? { guestSessionId: options.guestSessionId } : {}),
        ...(options?.guestSessionToken ? { guestSessionToken: options.guestSessionToken } : {}),
        ...(options?.publicCode ? { publicCode: options.publicCode } : {}),
      }),
    });

    return token;
  } catch (err) {
    console.warn("[FCM Web] Push registration skipped:", err);
    return null;
  }
}

export async function subscribeForegroundPush(
  callback: (payload: {
    title: string;
    body: string;
    actionUrl?: string;
    notificationId?: string;
    dedupeKey?: string;
  }) => void
): Promise<() => void> {
  if (typeof window === "undefined") return () => {};
  const config = getFirebaseConfig();
  if (!config) return () => {};

  try {
    const supported = await isSupported();
    if (!supported) return () => {};

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      callback({
        title: payload.notification?.title || "RestroInn",
        body: payload.notification?.body || "",
        actionUrl: payload.data?.actionUrl,
        notificationId: payload.data?.notificationId,
        dedupeKey: payload.data?.dedupeKey,
      });
    });
  } catch {
    return () => {};
  }
}
