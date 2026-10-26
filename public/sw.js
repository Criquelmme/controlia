// Private business records are never cached or queued for background writes.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f6f5f1"><title>Controlia Tiendas · Sin conexión</title><body style="margin:0;background:#f6f5f1;color:#3d5d49;font-family:Arial;text-align:center;padding:20vh 25px"><h1 style="font:42px Georgia">Tu tienda te espera.</h1><p style="line-height:1.8">Necesitas conexión para abrir Controlia Tiendas.<br>No se han guardado operaciones sin conexión.</p><button onclick="location.reload()" style="background:#3d5d49;color:white;padding:14px 22px;border:0;border-radius:6px;font-size:15px">Volver a intentar</button></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })));
});
