"use client";

let sharedAudioCtx: AudioContext | null = null;

/**
 * Play a crisp, non-intrusive dual-tone Web Audio chime for live notifications.
 * Safe against browser autoplay blocks (silently no-ops if user hasn't interacted yet).
 */
export function playNotificationChime(kind: "order" | "ready" | "info" = "info"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume().catch(() => {});
    }

    const now = sharedAudioCtx.currentTime;
    const tones =
      kind === "order"
        ? [784, 1046.5] // G5 -> C6 (bright new order alert)
        : kind === "ready"
          ? [587.33, 880, 1174.66] // D5 -> A5 -> D6 (food ready chime)
          : [659.25, 880]; // E5 -> A5 (standard info)

    tones.forEach((freq, idx) => {
      if (!sharedAudioCtx) return;
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.22);

      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.24);
    });
  } catch {
    // Autoplay policy or unsupported browser — ignore safely
  }
}

/**
 * Trigger a subtle vibration pattern on mobile devices when supported.
 */
export function vibrateMobile(pattern: number | number[] = [100, 50, 100]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

/**
 * Show a native OS/browser notification if permission is granted.
 * Works immediately on desktop and mobile browsers even before Firebase Web VAPID is configured.
 */
export function showBrowserNotification(
  title: string,
  body: string,
  options?: { tag?: string; actionUrl?: string | null }
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(title, {
      body,
      icon: "/logo-icon.jpg",
      badge: "/logo-icon.jpg",
      tag: options?.tag,
    });
    if (options?.actionUrl) {
      n.onclick = () => {
        window.focus();
        window.location.href = options.actionUrl!;
        n.close();
      };
    }
  } catch {
    // Some mobile browsers require ServiceWorkerRegistration.showNotification instead of new Notification()
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification(title, {
            body,
            icon: "/logo-icon.jpg",
            tag: options?.tag,
            data: { actionUrl: options?.actionUrl || "/" },
          })
        )
        .catch(() => {});
    }
  }
}
