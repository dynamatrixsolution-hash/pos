import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

export function getFirebaseMessaging(): Messaging | null {
  try {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !rawKey) {
        return null;
      }

      const privateKey = rawKey.replace(/\\n/g, "\n");
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    if (getApps().length === 0) return null;
    return getMessaging();
  } catch (err) {
    console.error("[FCM] Failed to initialize firebase-admin:", err);
    return null;
  }
}
