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

const CACHE_NAME = "edutok-shell-v3";
// المسارات الأساسية اللي نضمن تخزينها فوراً وقت تثبيت الـ Service Worker، حتى قبل ما
// يمر عليها أي طلب فعلي بالمتصفح (يضمن نسخة احتياطية جاهزة من أول لحظة)
const SHELL_URLS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL_URLS.map((url) =>
          fetch(url).then((res) => { if (res && res.status === 200) return cache.put(url, res); }).catch(() => {})
        )
      )
    )
  );
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

  const isNavigation = req.mode === "navigate";

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      if (cached) {
        // نحدّث النسخة بالخلفية بصمت لو كان فيه نت (لا ننتظرها، نرجع المخزَّن فوراً)
        fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); }).catch(() => {});
        return cached;
      }

      try {
        const netRes = await fetch(req);
        if (netRes && netRes.status === 200) cache.put(req, netRes.clone());
        return netRes;
      } catch (e) {
        // فشلت الشبكة، وما فيه نسخة مطابقة تماماً لهذا الرابط بالذات.
        // لو كان هذا طلب "تنقّل" (فتح صفحة)، نرجّع أي نسخة محفوظة من هيكل الصفحة الرئيسية
        // بدل ما نرجّع خطأ فاضي (اللي يخلي المتصفح يعرض صفحته الافتراضية "لا يوجد اتصال")
        if (isNavigation) {
          const shell = (await cache.match("/index.html")) || (await cache.match("/"));
          if (shell) return shell;
        }
        return Response.error();
      }
    })
  );
});
