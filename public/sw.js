// EduTok Service Worker
const CACHE_NAME = "edutok-v1";

// الملفات الأساسية اللي نخزّنها للعمل بدون إنترنت
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/css/main.chunk.css"
];

// عند تثبيت الـ Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // لو فشل أي ملف، نكمل بدون مشاكل
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// عند تفعيل الـ Service Worker الجديد، نحذف الـ cache القديم
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// استراتيجية الـ fetch: Network First للـ API، Cache First للملفات الثابتة
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls (Firebase, Groq, ImgBB) — دائماً من الشبكة مباشرة
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("groq.com") ||
    url.hostname.includes("imgbb.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // نترك المتصفح يتعامل معها مباشرة
  }

  // للملفات الثابتة: Network First مع Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // لو نجح الطلب، نحدّث الـ cache
        if (response && response.status === 200 && event.request.method === "GET") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // لو فشلت الشبكة، نرجع من الـ cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // لو ما في cache، نرجع صفحة البداية (للـ SPA routing)
          return caches.match("/index.html");
        });
      })
  );
});
