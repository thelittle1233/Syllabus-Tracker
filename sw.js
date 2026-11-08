// Class 11 Syllabus Tracker: network-first updates with offline fallback.
// The app is a single HTML file, so its CSS and JavaScript are included in index.html.
const CACHE_NAME = "class11-syllabus-shell-v1";
const APP_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(APP_URL, { cache: "reload" });

    if (!response.ok) {
      throw new Error("Could not cache the app shell: " + response.status);
    }

    await cache.put(APP_URL, response);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("class11-syllabus-shell-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // For app-page navigation, always try GitHub Pages first so published
  // changes are picked up on the next launch while online.
  if (request.mode === "navigate" || requestUrl.href === APP_URL) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_URL, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await caches.match(APP_URL);
        if (cached) return cached;
        return new Response("The app is not cached yet. Connect to the internet and open it once.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // Other same-origin files: network first, then cache if offline.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
