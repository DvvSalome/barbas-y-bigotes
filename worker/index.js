// Worker custom de la PWA (convención customWorkerSrc de @ducanh2912/next-pwa:
// esta carpeta `worker/` en la raíz se compila a public/worker-<hash>.js y el
// plugin la importa en sw.js vía importScripts). Acá viven los handlers de push:
// sin esto las notificaciones llegan al dispositivo pero jamás se muestran.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  const title = data.title || "Barbas & Bigotes";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/brand/icon-192x192.png",
    badge: "/brand/icon-192x192.png",
    tag: data.tag || "bb",
    data: { url: data.url || "/cuenta" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/cuenta";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if (w.url.includes(url) && "focus" in w) return w.focus();
    return clients.openWindow(url);
  }));
});
