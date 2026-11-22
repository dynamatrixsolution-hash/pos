/* RestroInn Firebase Cloud Messaging Background Service Worker */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: "RestroInn", body: event.data.text() } };
  }

  const title = payload?.notification?.title || payload?.data?.title || "RestroInn Notification";
  const body = payload?.notification?.body || payload?.data?.body || "";
  const actionUrl = payload?.data?.actionUrl || payload?.fcmOptions?.link || "/dashboard";
  const tag = payload?.data?.dedupeKey || payload?.data?.notificationId || undefined;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      data: { actionUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.actionUrl || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
