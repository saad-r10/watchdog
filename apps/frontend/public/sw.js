self.addEventListener("push", (event) => {
  if (!event.data) return;
  let title = "Watchdog Alert";
  let body = "";
  let data = {};
  try {
    const parsed = JSON.parse(event.data.text());
    title = parsed.title ?? title;
    body = parsed.body ?? body;
    data = parsed;
  } catch {
    body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/apple-touch-icon.png",
      badge: "/favicon.svg",
      data,
      tag: data.monitorId ?? "watchdog",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const monitorId = event.notification.data?.monitorId;
      const url = monitorId ? `/monitors/${monitorId}` : "/";
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
