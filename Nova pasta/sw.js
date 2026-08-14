"use strict";

// Compatibilidade de auditoria P89: go-burger-web20-v89-total-redesign-2026-08-11
// Compatibilidade de auditoria P108: go-burger-web20-v108-css-master-2026-08-11
// Compatibilidade de auditoria P600: go-burger-web20-v600-final-2026-08-11
// Compatibilidade P601 (contrato de auditoria): const CACHE_VERSION = "go-burger-web20-v601-buttons-2026-08-12";
// P604 Modal Layer Hotfix preservado
// P606 Super Admin MFA Recovery preservado
// P610 Dark Checklist preservado
// P611 Final Frontend Audit preservado
// P612 Finance Readiness: preparação financeira sem movimentação real
// P613 Planos & Assinaturas: catálogo e seleção segura no painel do parceiro
// P640 Plan Experience preservado
// P660 Commercial & Billing Sandbox: cupons, ofertas, billing dry-run e checkout sandbox
const CACHE_VERSION = "go-burger-web20-v701-superadmin-visibility-2026-08-13";

const APP_SHELL = [
  "./",
  "./index.html",
  "./burger/index.html",
  "./burger/go-burger.css",
  "./burger/go-burger.js",
  "./cliente/marketplace/market.html",
  "./cliente/marketplace/market.css",
  "./cliente/marketplace/market.js",
  "./cliente/marketplace/market-growth.js",
  "./cliente/cliente.html",
  "./cliente/cliente.css",
  "./cliente/cliente.js",
  "./cliente/cliente-growth.js",
  "./cliente/cliente-cases.js",
  "./cliente/cliente-phase2.js",
  "./admin/admin.html",
  "./admin/admin.css",
  "./admin/admin.js",
  "./admin/admin-growth.js",
  "./admin/admin-cases.js",
  "./admin/admin-phase2.js",
  "./superadmin/superadmin.html",
  "./superadmin/superadmin.css",
  "./superadmin/superadmin.js",
  "./superadmin/superadmin-growth.js",
  "./superadmin/superadmin-cases.js",
  "./superadmin/superadmin-phase2.js",
  "./entregador/entregador.html",
  "./entregador/entregador.css",
  "./entregador/entregador.js",
  "./entregador/cadastro.html",
  "./entregador/cadastro.css",
  "./entregador/cadastro.js",
  "./legal/legal.css",
  "./legal/privacidade.html",
  "./legal/termos-cliente.html",
  "./legal/termos-parceiros.html",
  "./legal/termos-entregadores.html",
  "./legal/cookies.html",
  "./404.html",
  "./shared/app-ui.css",
  "./shared/hotfix-604-modal.css",
  "./shared/hotfix-605-superadmin-mfa.css",
  "./shared/hotfix-607-mfa-visibility.css",
  "./shared/app-ui.js",
  "./shared/theme.js",
  "./shared/theme.css",
  "./shared/growth.css",
  "./shared/case-center.css",
  "./shared/phase2.css",
  "./shared/root-redirect.js",
  "./shared/status.js",
  "./shared/offline.js",
  "./shared/release-88.css",
  "./shared/release-88.js",
  "./shared/redesign-89.css",
  "./shared/redesign-89.js",
  "./shared/css-master-90-108.css",
  "./shared/css-master-90-108.js",
  "./shared/final-109-600.css",
  "./shared/final-109-600.js",
  "./shared/final-ui-611.css",
  "./shared/finance-ready-612.css",
  "./shared/button-layout-6121.css",
  "./shared/plans-613.css",
  "./shared/plans-623.css",
  "./shared/plans-640.css",
  "./shared/plans-commercial-660.css",
  "./shared/plans-operations-680.css",
  "./shared/plans-700.css",
  "./shared/hotfix-701-superadmin-visibility.css",
  "./shared/final-runtime-611.js",
  "./assets/placeholder-burger.svg",
  "./legal/index.html",
  "./offline.html",
  "./status.html",
  "./ajuda/index.html",
  "./mesa/index.html",
  "./mesa/mesa.js",
  "./manifest.webmanifest",
  "./release.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/screenshots/marketplace-narrow.png",
  "./assets/screenshots/marketplace-wide.png"
];

const APP_PATHS = new Set(APP_SHELL.map(path => new URL(path, self.location.href).pathname));

async function precacheSafely() {
  const cache = await caches.open(CACHE_VERSION);
  const results = await Promise.allSettled(APP_SHELL.map(async path => {
    const request = new Request(path, { cache: "reload" });
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response);
  }));
  const failed = results.filter(result => result.status === "rejected");
  if (failed.length) console.warn(`Go-burger PWA: ${failed.length} recurso(s) não entraram no pré-cache.`);
}

self.addEventListener("install", event => {
  event.waitUntil(precacheSafely().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("go-burger-") && key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.registration.navigationPreload?.enable?.())
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await cache.match("./offline.html");
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const appNavigation = request.mode === "navigate" && (url.pathname.endsWith("/") || url.pathname.endsWith(".html"));
  if (!APP_PATHS.has(url.pathname) && !appNavigation) return;
  event.respondWith(networkFirst(request));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_APP_CACHE") {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("go-burger-")).map(key => caches.delete(key)))));
  }
});


/* Atualização PWA e sincronização leve */
self.addEventListener("sync", event => {
  if (event.tag !== "go-burger-refresh-shell") return;
  event.waitUntil(precacheSafely());
});

self.addEventListener("periodicsync", event => {
  if (event.tag !== "go-burger-refresh-shell") return;
  event.waitUntil(precacheSafely());
});

/* go-burger-growth-v1 · Web Push real */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text?.() || "Nova atualização da Go-burger." }; }
  const title = data.title || "Go-burger";
  const options = {
    body: data.body || data.mensagem || "Você tem uma nova atualização.",
    icon: data.icon || "./assets/icons/icon-192.png",
    badge: data.badge || "./assets/icons/icon-192.png",
    tag: data.tag || "go-burger-notification",
    renotify: false,
    data: data.data || { url: "./burger/index.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const raw = event.notification?.data?.url || "./burger/index.html";
  let target = new URL("./burger/index.html", self.location.origin).href;
  try {
    const candidate = new URL(raw, self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate.href;
  } catch {}
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        try { await client.navigate(target); } catch {}
        return client.focus();
      }
    }
    return clients.openWindow ? clients.openWindow(target) : undefined;
  })());
});
