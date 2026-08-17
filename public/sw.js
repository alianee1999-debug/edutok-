// public/sw.js
// ─────────────────────────────────────────────────────────
// Service Worker موحّد (وظيفتان بملف واحد، تعمداً، بدل ملفين منفصلين):
// 1) استقبال إشعارات Push بالخلفية (Firebase Cloud Messaging)
// 2) تخزين "هيكل" التطبيق نفسه (offline caching) حتى يشتغل بدون نت
//
// ‼️ السبب اللي خلانا ندمجهم بملف واحد: المتصفح يسمح بـService Worker وحد بس يتحكم
// بنفس النطاق ("/") بأي لحظة. لما كان عندنا sw.js و firebase-messaging-sw.js مسجّلين
// لحالهم بنفس النطاق، كانا يتنازعون السيطرة — ولما يفوز firebase-messaging-sw.js (اللي
// ما عنده كود تخزين إطلاقاً)، تنكسر ميزة العمل بدون نت بالكامل. دمجهم بملف واحد يلغي
// هذا التعارض نهائياً لأنه ما عاد فيه إلا تسجيل واحد بالنطاق.
// ─────────────────────────────────────────────────────────

// نحمّل مكتبة Firebase Messaging بأمان — لو فشل التحميل لأي سبب (مشكلة شبكة مؤقتة،
// حاجب إعلانات، إلخ)، ما نوقف باقي عمل الـ Service Worker؛ التخزين (offline caching)
// أهم وظيفة هنا ولازم يستمر يشتغل حتى لو تعطّلت الإشعارات بالخلفية.
// 🔧 تشخيص مؤقت: لو فشل هذا الجزء، نعرض إشعار حقيقي بسبب الفشل (بدل ما ينبلع بصمت)
// حتى نقدر نشوف الخطأ الفعلي بدون أدوات مطوّرين على الموبايل
try{
  importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyA1mskTWMsVV9dpO3I7hVxZx9LUtbzNjuo",
    authDomain: "edutok-a48f9.firebaseapp.com",
    projectId: "edutok-a48f9",
    storageBucket: "edutok-a48f9.firebasestorage.app",
    messagingSenderId: "742519479032",
    appId: "1:742519479032:web:0d0606bcaf75c95a51f90d",
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "إشعار جديد من EduTok";
    const body = payload.notification?.body || payload.data?.body || "";
    self.registration.showNotification(title, { body, icon: "/logo192.png", dir: "rtl" });
  });
}catch(e){
  // تجاهل — التخزين بالأسفل يستمر يشتغل بشكل مستقل تماماً عن نجاح أو فشل هذا الجزء
}

// ─── تخزين هيكل التطبيق (offline caching) ───────────────
const CACHE_NAME = "edutok-shell-v6";
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

  if (isNavigation) {
    // Network-First لطلبات فتح الصفحة نفسها تحديداً — يضمن دايماً آخر نسخة منشورة فعلياً
    // للمستخدم المتصل (حتى بعد نشر تحديث جديد للتطبيق)، ويستخدم النسخة المخزَّنة فقط
    // كحل أخير لو فشلت الشبكة (بدون نت). بدون هذا، أي تحديث جديد للكود ما يظهر للمستخدم
    // حتى لو كان متصل بالنت، لأن النسخة القديمة المخزَّنة كانت تُعرض له دائماً أولاً.
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = (await cache.match(req)) || (await cache.match("/index.html")) || (await cache.match("/"));
        return shell || Response.error();
      })
    );
    return;
  }

  // لباقي الملفات (JS/CSS/صور) نبقى على Cache-First — أسرع، وآمن هنا لأن أسماءها تتغيّر
  // تلقائياً (بصمة/hash) مع كل نشر جديد، فما فيه خطر عرض نسخة قديمة بالغلط
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); }).catch(() => {});
        return cached;
      }
      try {
        const netRes = await fetch(req);
        if (netRes && netRes.status === 200) cache.put(req, netRes.clone());
        return netRes;
      } catch (e) {
        return Response.error();
      }
    })
  );
});
