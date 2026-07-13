/**
 * Utility to clear all client-side caches while preserving device authorization state.
 */
export function clearCaches() {
  if (typeof window !== "undefined") {
    try {
      // 1. Preserve device-specific identifier to avoid triggering device authentication locks
      const deviceId = localStorage.getItem("dyna_device_id");

      // 2. Clear localStorage
      localStorage.clear();

      // 3. Restore device id if it existed
      if (deviceId) {
        localStorage.setItem("dyna_device_id", deviceId);
      }

      // 4. Clear sessionStorage
      sessionStorage.clear();

      // 5. Clear Browser Cache Storage API (caches)
      if ("caches" in window) {
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              return caches.delete(cacheName);
            })
          );
        }).catch((err) => {
          console.error("Failed to clear browser cache storage:", err);
        });
      }

      // 6. Unregister service workers if any
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        }).catch((err) => {
          console.error("Failed to unregister service workers:", err);
        });
      }
    } catch (error) {
      console.error("Error clearing caches:", error);
    }
  }
}
