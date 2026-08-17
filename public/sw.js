// public/sw.js
// ─────────────────────────────────────────────────────────
// Service Worker موحّد (وظيفتان بملف واحد، تعمداً، بدل ملفين منفصلين):
// 1) استقبال إشعارات Push بالخلفية
// 2) تخزين "هيكل" التطبيق نفسه (offline caching) حتى يشتغل بدون نت
//
// ‼️ السبب اللي خلانا ندمجهم بملف واحد: المتصفح يسمح بـService Worker وحد بس يتحكم
// بنفس النطاق ("/") بأي لحظة. لما كان عندنا sw.js و firebase-messaging-sw.js مسجّلين
// لحالهم بنفس النطاق، كانا يتنازعون السيطرة — دمجهم بملف واحد يلغي هذا التعارض نهائياً.
//
// 🔧 تعديل مهم (إصلاح فعلي لمشكلة إشعارات لا تصل كإشعار نظام):
// النسخة السابقة كانت تحمّل مكتبة Firebase Messaging من الإنترنت (importScripts)
// في كل مرة "يستيقظ" فيها الـ Service Worker (وهذا يصير مع كل حدث push جديد لو كان
// نايم). المشكلة: لو الجهاز لسا صاحي من نوم عميق ولسا ما جهزت الشبكة (شائع جداً
// بأجهزة Samsung بسبب توفير الطاقة العدواني)، فشل التحميل ده كان يتم تجاهله بصمت
// تماماً، فيضيع تسجيل مستمع الإشعارات ولا يظهر أي إشعار نظام إطلاقاً — رغم إن FCM
// فعلياً وصّل الرسالة بنجاح للجهاز.
//
// الحل: نتعامل مع حدث push مباشرة بكود JS عادي (بدون أي مكتبة، بدون أي طلب إنترنت)
// — بيانات FCM Web Push تكون بصيغة JSON بسيطة داخل event.data، نقدر نقرأها ونعرض
// الإشعار مباشرة بدون أي اعتماد على الشبكة وقت الاستقبال. هذا يزيل المشكلة نهائياً.
// ─────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  // بيانات FCM Web Push تجي بأحد شكلين حسب كيف أُرسلت من السيرفر:
  // { notification: {title, body} } أو { data: {title, body} }
  const title =
    payload.notification?.title || payload.data?.title || "إشعار جديد من EduTok";
  const body = payload.notification?.body || payload.data?.body || "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo192.png",
      dir: "rtl",
      tag: "edutok-notification",
      renotify: true,
      requireInteraction: false,
      data: { link: payload.fcmOptions?.link || payload.data?.link || "/" },
    })
  );
});

// لما المستخدم يضغط على الإشعار، نفتح له التطبيق (أو نركّز التبويب المفتوح أصلاً)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── تخزين هيكل التطبيق (offline caching) ───────────────
const CACHE_NAME = "edutok-shell-v7";
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
    // كحل أخير لو فشلت الشبكة (بدون نت).
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
