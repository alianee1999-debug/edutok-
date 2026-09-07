// ─── firebase.js ─────────────────────────────────────────
// إعدادات Firebase + دوال الإشعارات وتسجيل الأجهزة.
// تم نقل هذا القسم من App.jsx الأصلي دون أي تعديل بالمنطق، فقط تنظيم بملف مستقل.
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ─── FIREBASE ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:"AIzaSyA1mskTWMsVV9dpO3I7hVxZx9LUtbzNjuo",
  authDomain:"edutok-a48f9.firebaseapp.com",
  projectId:"edutok-a48f9",
  storageBucket:"edutok-a48f9.firebasestorage.app",
  messagingSenderId:"742519479032",
  appId:"1:742519479032:web:0d0606bcaf75c95a51f90d"
};
const firebaseApp = initializeApp(FIREBASE_CONFIG);
// تفعيل التخزين المحلي (Offline Persistence) — يحفظ بيانات الشرائح اللي فتحها الطالب وهو متصل
// بذاكرة الجهاز (IndexedDB)، فيقدر يعيد فتح نفس الدرس بدون نت ويقرأها من النسخة المحفوظة محلياً.
// نستخدم persistentMultipleTabManager لأن الطالب ممكن يفتح التطبيق بأكثر من تبويب بنفس الوقت.
// لو فشل التفعيل لأي سبب (متصفح قديم جداً مثلاً)، نرجع تلقائياً لـ Firestore العادي بدون تخزين محلي
// حتى ما يتعطل التطبيق بالكامل بسبب هذا فقط.
let db;
try{
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}catch(e){
  db = getFirestore(firebaseApp);
}
const auth = getAuth(firebaseApp);
const storage = getStorage(firebaseApp); // لرفع الملفات الصوتية (الأناشيد) مباشرة من لوحة الإدارة

// ─── الإشعارات الفعلية (Push / FCM) ─────────────────────────
// مفتاح VAPID عام (مو سري) خاص بمشروع Firebase — يُضبط عبر متغير بيئة يبدأ بـ REACT_APP_
// حتى ينضمّن بحزمة المتصفح وقت البناء (create-react-app يتطلب هذا البادئة تحديداً)
const FIREBASE_VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || "";

// كل إنشاء إشعار بالتطبيق يمر من هنا (بدل الكتابة المباشرة بـ Firestore من المتصفح) —
// السيرفر (api/notify.js) يسجّل الإشعار بقاعدة البيانات ويرسله كـ Push فعلي لأجهزة الطالب/الطلاب.
// لو فشل الاتصال بالسيرفر لأي سبب، نتجاهل الخطأ بصمت حتى لا نوقف العملية الأساسية
// (تفعيل اشتراك، رفض دفع...) بسبب فشل إشعار ثانوي.
const sendNotification = async({phone, title, body}) => {
  try{
    const res = await fetch("/api/notify",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({phone: phone||null, title, body}),
    });
    return await res.json().catch(()=>null);
  }catch(e){ return {ok:false, error:e.message}; }
};

// يسجّل جهاز الطالب لاستقبال إشعارات Push، ويحفظ رمز الجهاز (token) بحسابه.
// يُستدعى مرة بعد تسجيل الدخول/التسجيل. يتجاهل بصمت أي متصفح/جهاز ما يدعم الميزة
// (مثل بعض متصفحات آيفون القديمة) أو لو الطالب رفض إذن الإشعارات.
const registerPushToken = async(phone) => {
  try{
    if(!FIREBASE_VAPID_KEY) return;
    if(!("serviceWorker" in navigator) || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if(permission!=="granted") return;
    // نستخدم نفس تسجيل sw.js الموحّد (المسجَّل أصلاً عند تحميل الصفحة) بدل تسجيل ملف منفصل —
    // تسجيل ملفين لنفس النطاق "/" كان يسبب تعارض سيطرة يعطّل تخزين الشرائح بدون نت بالكامل
    const reg = await navigator.serviceWorker.ready;
    const {getMessaging, getToken} = await import("firebase/messaging");
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging,{vapidKey:FIREBASE_VAPID_KEY, serviceWorkerRegistration:reg});
    if(token){
      await updateDoc(doc(db,"students",phone),{fcmTokens:arrayUnion(token)});
    }
  }catch(e){ /* ميزة إضافية غير أساسية — نتجاهل أي فشل بصمت */ }
};

// ─── PWA SERVICE WORKER ──────────────────────────────────
if("serviceWorker" in navigator){
  // لو نسخة جديدة من الـ Service Worker تفعّلت وأخذت التحكم (بعد تحديث sw.js)، نعيد تحميل
  // الصفحة تلقائياً مرة وحدة — بدون هذا، نافذة/تبويب كان مفتوح من قبل التحديث يظل يشتغل
  // بالنسخة القديمة لين يُسكّر يدوياً بالكامل، حتى لو التحديث الجديد نزل فعلياً على السيرفر
  let _swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(_swRefreshing) return;
    _swRefreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("/sw.js")
      .then(()=>console.log("SW registered"))
      .catch(()=>console.log("SW registration failed"));
  });
}

// نسجّل محلياً لما الطالب فعلياً "يثبّت" التطبيق (يضيفه للشاشة الرئيسية) — هذا الحدث تدعمه
// كروم/أندرويد بشكل جيد، لكن آيفون/سفاري ما يرسل أي حدث مكافئ (قيد من نظام آبل نفسه، مو كودنا)
window.addEventListener("appinstalled", ()=>{
  try{ localStorage.setItem("edutok_installed","1"); }catch{}
});

// يحدّث "آخر ظهور" لحساب الطالب بكل مرة يفتح فيها التطبيق (دخول أو استرجاع جلسة)، ويسجّل
// تثبيت التطبيق مرة وحدة لو انضبط العلم أعلاه. كلاهما بصمت — ما يوقف تسجيل الدخول لو فشلا
const syncInstallAndLastSeen = async(phone) => {
  try{ await updateDoc(doc(db,"students",phone),{lastSeenAt:serverTimestamp()}); }catch(e){}
  try{
    if(localStorage.getItem("edutok_installed")==="1"){
      await updateDoc(doc(db,"students",phone),{appInstalled:true});
    }
  }catch(e){}
};

export { db, auth, storage, FIREBASE_VAPID_KEY, sendNotification, registerPushToken, syncInstallAndLastSeen };
