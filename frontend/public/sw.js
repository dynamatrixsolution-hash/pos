// RestroInn PWA & Background Push Service Worker
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first pass-through satisfies Chrome/Android native PWA installability without stale caching
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

// Background Web Push handler (works even when app/tab is minimized or closed)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "RestroInn", body: event.data.text() };
  }

  const notif = payload.notification || payload;
  const data = payload.data || {};
  const title = notif.title || "RestroInn Update";
  const body = notif.body || "";
  const actionUrl = data.actionUrl || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.notificationId || "restroinn-push",
      vibrate: [120, 60, 120],
      data: { actionUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.actionUrl || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if (targetUrl && targetUrl !== "/" && "navigate" in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
