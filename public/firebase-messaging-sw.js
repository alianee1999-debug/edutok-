// public/firebase-messaging-sw.js
// ─────────────────────────────────────────────────────────
// Service Worker يستقبل إشعارات Push حتى لو التطبيق مقفول أو المتصفح بالخلفية.
// يجب أن يبقى هذا الملف بجذر مجلد public (نفس مستوى index.html) وبنفس هذا الاسم بالضبط،
// لأن مسار "/firebase-messaging-sw.js" مسجَّل هيك بالضبط بكود التسجيل داخل App.jsx.
//
// القيم أدناه (apiKey, projectId...) هي نفس بيانات Firebase العامة المستخدمة أصلاً
// بالتطبيق نفسه — مو بيانات سرية (تظهر أصلاً بكود المتصفح لأي تطبيق ويب يستخدم Firebase).
// ─────────────────────────────────────────────────────────

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
  self.registration.showNotification(title, {
    body,
    icon: "/logo192.png",
    dir: "rtl",
  });
});
