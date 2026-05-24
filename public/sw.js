// Service Worker — совместим с любым подпутём (GitHub Pages, поддиректории и т.д.)
const CACHE_NAME = "habit-tracker-v3";

// Базовый путь определяется из расположения самого SW-файла.
// На GitHub Pages это будет "/habbit-tracker/", на корневом хосте — "/"
const BASE = self.registration.scope; // например "https://xelay.github.io/habbit-tracker/"

const PRECACHE_PATHS = [
  "",           // index.html в корне scope
  "index.html",
  "manifest.json",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
];

const PRECACHE_URLS = PRECACHE_PATHS.map((p) => BASE + p);

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Не падаем если что-то недоступно офлайн при первой установке
      })
    )
  );
  self.skipWaiting();
});

// ── Activate: удаляем старые кэши ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем запросы к другим доменам (CDN, шрифты)
  if (url.origin !== self.location.origin) return;

  // Навигационные запросы — network first, офлайн-fallback на index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(BASE + "index.html").then(
            (cached) => cached || caches.match(BASE)
          )
        )
    );
    return;
  }

  // Статические ассеты (JS, CSS, картинки) — cache-first
  if (
    url.pathname.includes("/assets/") ||
    /\.(png|jpg|jpeg|svg|ico|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Остальное — network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
