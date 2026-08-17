// public/sw.js
// ─────────────────────────────────────────────────────────
// Service Worker مسؤول عن تخزين "هيكل" التطبيق نفسه (الكود، التصميم، الأيقونات)
// بذاكرة الجهاز، حتى يقدر التطبيق يُفتح أصلاً بدون نت (مو بس بياناته — البيانات مسؤولية
// Firestore Offline Persistence المفعّلة بـ App.jsx).
//
// الإستراتيجية: Cache-First مع تحديث بالخلفية (Stale-While-Revalidate) لملفات نفس الموقع —
// أول ما يفتح الطالب صفحة وهو متصل، تُخزَّن نسخة منها؛ لما يفتحها بدون نت، تُقرأ من النسخة
// المخزَّنة فوراً، وبنفس الوقت لو كان متصل يحدّثها بالخلفية للمرة الجاية.
// ─────────────────────────────────────────────────────────

const CACHE_NAME = "edutok-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // نتعامل فقط مع طلبات GET من نفس الموقع (نتجاهل Firestore/الصور الخارجية/غيرها)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // لو موجود بالذاكرة، نرجعه فوراً (سريع + يشتغل بدون نت) ونحدّثه بالخلفية.
      // لو مو موجود، ننتظر الشبكة؛ ولو فشلت الشبكة وما فيه نسخة محفوظة، نرجع الصفحة الرئيسية
      // كحل أخير (يفيد بالتنقل بين الشرائح بدون نت حتى لو الرابط نفسه ما كان محفوظاً).
      if (cached) return cached;
      const netRes = await networkFetch;
      if (netRes) return netRes;
      const fallback = await cache.match("/index.html");
      return fallback || Response.error();
    })
  );
});
