"use client";

import { useEffect, useRef } from "react";

interface UseVisibilityPollingOptions {
  immediate?: boolean;
  enabled?: boolean;
}

/**
 * Overlap-safe, visibility-aware polling hook.
 * Pauses background fetches when the browser tab is hidden and refreshes cleanly on return.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: UseVisibilityPollingOptions = {}
) {
  const { immediate = false, enabled = true } = options;
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);

  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let unmounted = false;

    const runTick = async () => {
      if (unmounted || inFlightRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (immediate) {
      void runTick();
    }

    const timer = setInterval(() => {
      void runTick();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runTick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unmounted = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, immediate, enabled]);
}
