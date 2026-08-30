import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc, setDoc, getDoc, getDocs, doc, query, where, orderBy, limit, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Bookmark, Share2, Bot, MessageCircle, MoreHorizontal, FileText, Camera, Search, ChevronUp, ChevronDown, Settings, User, Home, Bell, DollarSign, Users, Layers, Film, Sparkles, X, Save, BookOpen, GraduationCap, Plus, Play, Pause, Loader, Key, Copy, CheckCircle, Trash2, ClipboardList, Lock, Wand2, Pencil, Volume2, Square } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem"; // يضيف أمر \ce{} لكتابة معادلات كيميائية متقدمة (أسهم اتزان، حالات المادة، نظائر)

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

// ─── KEYS & CONSTANTS ───────────────────────────────────
// ✅ تم نقل مفتاح Groq إلى السيرفر (api/groq.js) ولا يظهر هنا بعد الآن
// ✅ تم نقل مفتاح ImgBB إلى السيرفر (api/imgbb.js) ولا يظهر هنا بعد الآن
// ✅ تم استبدال بيانات المدير الثابتة بـ Firebase Authentication الحقيقي
const ZAINCASH_NUM = "07700000000";
const LOGO         = "/logo512.png";

const SUBJECTS     = ["الرياضيات","العلوم","اللغة العربية","اللغة الإنجليزية","الفيزياء","الكيمياء","الأحياء","التربية الإسلامية","التاريخ"];
const STAGES       = ["الابتدائية","المتوسطة","الإعدادية"];
const GRADES       = {"الابتدائية":["الأول","الثاني","الثالث","الرابع","الخامس","السادس"],"المتوسطة":["الأول","الثاني","الثالث"],"الإعدادية":["الرابع","الخامس","السادس"]};
const CLIP_TYPES   = ["معلم","طالب","مراجعة","اختبار"];
const PRICE_SUBJECTS = ["الرياضيات","العلوم","اللغة العربية","اللغة الإنجليزية","الفيزياء","الكيمياء","الأحياء","التربية الإسلامية","ملازم PDF"];
const THEMES       = [{label:"برتقالي",color:"#b45309"},{label:"أخضر",color:"#166534"},{label:"بنفسجي",color:"#5b21b6"},{label:"أزرق متدرج",color:"#0c4a6e"},{label:"داكن",color:"#27272a"},{label:"أحمر ناري",color:"#991b1b"},{label:"وردي",color:"#9d174d"},{label:"فيروزي",color:"#0f766e"}];
const THEME_STYLES = {
  "برتقالي"    :{bg:"linear-gradient(135deg,#7c2d12,#c2410c)",accent:"#fb923c",card:"rgba(194,65,12,0.25)"},
  "أخضر"       :{bg:"linear-gradient(135deg,#14532d,#15803d)",accent:"#4ade80",card:"rgba(21,128,61,0.25)"},
  "بنفسجي"     :{bg:"linear-gradient(135deg,#4c1d95,#6d28d9)",accent:"#c4b5fd",card:"rgba(109,40,217,0.25)"},
  "أزرق متدرج":{bg:"linear-gradient(135deg,#0c4a6e,#0369a1)",accent:"#38bdf8",card:"rgba(3,105,161,0.25)"},
  "داكن"       :{bg:"linear-gradient(135deg,#09090b,#18181b)",accent:"#a1a1aa",card:"rgba(255,255,255,0.06)"},
  "أحمر ناري" :{bg:"linear-gradient(135deg,#7f1d1d,#b91c1c)",accent:"#f87171",card:"rgba(185,28,28,0.25)"},
  "وردي"       :{bg:"linear-gradient(135deg,#831843,#be185d)",accent:"#f9a8d4",card:"rgba(190,24,93,0.25)"},
  "فيروزي"     :{bg:"linear-gradient(135deg,#134e4a,#0d9488)",accent:"#5eead4",card:"rgba(13,148,136,0.25)"},
};
const DURATIONS    = [{label:"شهري — 30 يوم",days:30},{label:"فصلي — 90 يوم",days:90},{label:"سنوي — 365 يوم",days:365}];
// ─── خطوات جولة الشرح التعريفية (Onboarding) ─────────────
// 4 شاشات بسيطة تغطي أهم أجزاء التطبيق — تظهر تلقائياً أول مرة، وتقدر ترجع
// تفتحها بأي وقت من زر داخل "مساعد" (زكي)
const ONBOARDING_STEPS = [
  {
    emoji: "🎬",
    title: "تصفّح الدروس",
    desc: "اسحب لفوق أو لتحت للانتقال بين الدروس والشرائح، تماماً زي أي تطبيق فيديوهات قصيرة تعرفه.",
  },
  {
    emoji: "🤖",
    title: "زكي — مساعدك الذكي",
    desc: "اضغط زر «مساعد» بأي وقت لتسأل عن أي درس، تحل سؤال بالصورة، أو تسمع أناشيد أثناء المذاكرة.",
  },
  {
    emoji: "🎓",
    title: "الامتحانات",
    desc: "بعد ما تكمل فصل كامل (أو تشاهد أغلب مقاطعه)، بطاقة الامتحان تفتح تلقائياً — لازم نتيجة 60% فأكثر عشان تنتقل للفصل التالي.",
  },
  {
    emoji: "🔑",
    title: "الاشتراك والأكواد",
    desc: "تقدر تشترك عبر زين كاش، أو تفعّل كود اشتراك جاهز من زر «الكود» بقائمة «المزيد» — وإذا وصلك كود شراكة، فعّله من نفس المكان.",
  },
];

const ADMIN_TABS   = [
  {key:"clips",         label:"المقاطع",   Icon:Film},
  {key:"slides",        label:"شرائح",     Icon:Layers},
  {key:"editor",        label:"تعديل",     Icon:Save},
  {key:"exams",         label:"الامتحانات", Icon:ClipboardList},
  {key:"pdf",           label:"PDF",        Icon:FileText},
  {key:"teacherpdf",    label:"ملازم الأساتذة", Icon:BookOpen},
  {key:"wallet",        label:"المحفظة",   Icon:DollarSign},
  {key:"codes",         label:"الأكواد",   Icon:Key},
  {key:"partners",      label:"الشراكات",  Icon:Share2},
  {key:"students",      label:"الطلاب",    Icon:Users},
  {key:"subscriptions", label:"الاشتراكات", Icon:ClipboardList},
  {key:"prices",        label:"الأسعار",   Icon:Bell},
  {key:"audio",         label:"الأناشيد",  Icon:Volume2},
  {key:"notifications", label:"إشعارات",   Icon:Bell},
  {key:"settings",      label:"الإعدادات", Icon:Settings},
];
const SAMPLE_VIDEOS = [];

// ─── SUBSCRIPTION HELPERS ───────────────────────────────
const subKey = (subject,stage) => subject+"__"+stage;
// مفتاح خاص بالتحقق من صلاحية الوصول للاشتراكات فقط (يشمل الصف) — منفصل عمداً
// عن subKey العادي المستخدم لتتبع "آخر فيديو شاهده الطالب" بكل مادة/مرحلة (بلا صف)،
// حتى لا يتأثر تتبّع موضع المشاهدة القديم بهذا التغيير
const subAccessKey = (subject,stage,grade) => subject+"__"+stage+"__"+(grade||"");
// مفتاح موحّد لتحديد فصل دراسي معين (يُستخدم في: الشهادات، تتبع المشاهدة، ونظام الامتحانات)
const topicKey = (subject,stage,topic) => subject+"__"+stage+"__"+topic;
// هل النص "شكله رقم صفحة" نظيف؟ (رقم صرف مثل "102"، أو مدى مثل "120-121") —
// نستخدم نفس القاعدة بالضبط عند الحفظ (لتحديد هل نأخذ رقم الصفحة من العنوان)
// وبأداة تدقيق لوحة الإدارة (لعرض أي مقطع قديم عنوانه لسا مو بهذا الشكل)
const looksLikePageTitle = (title) => /^\d+\s*(-\s*\d+)?$/.test(String(title||"").trim());
// الحد الأقصى لعدد المقاطع اللي يُسمح للطالب يفوّتها بفصل معيّن ولسه يقدر يفتح
// امتحان الفصل — رقم واحد مشترك بين منطق فتح الامتحان (markClipWatched) وعرض
// التقدّم للطالب (VideoDescriptionModal) عشان ما ينعزلون ويصير تناقض بينهم لاحقاً
const MAX_SKIPPED_CLIPS = 5;
// ─── التحقق من الاشتراك مقيّد بالصف تحديداً (وليس فقط المادة والمرحلة) ───
// لو الفيديو/المحتوى له صف محدد (grade)، لازم يملك الطالب اشتراكاً بنفس الصف بالضبط.
// نحافظ على توافق رجعي مع الاشتراكات القديمة التي سُجّلت قبل إضافة هذا التقييد
// (لا تحمل حقل grade أصلاً) عبر قبولها كبديل صالح لأي صف، حتى لا يفقد المشتركون
// الحاليون وصولهم فجأة بعد هذا التحديث — الاشتراكات الجديدة ستُسجَّل دائماً بصف محدد.
const isSubscribed = (subs,subject,stage,grade) => {
  if(!subs||!subject||!stage) return false;
  const exact = subs[subAccessKey(subject,stage,grade)];
  const legacyUngraded = subs[subAccessKey(subject,stage,"")];
  const s = exact || legacyUngraded;
  return s && new Date(s.expiresAt)>new Date();
};
const daysLeft = (subs,subject,stage,grade) => {
  if(!subs||!subject||!stage) return 0;
  const exact = subs[subAccessKey(subject,stage,grade)];
  const legacyUngraded = subs[subAccessKey(subject,stage,"")];
  const s = exact || legacyUngraded;
  if(!s) return 0;
  return Math.max(0,Math.ceil((new Date(s.expiresAt)-new Date())/86400000));
};
// هل المادة مجانية؟ (سعرها = 0 أو غير محدد) — السعر لا يعتمد على الصف، فقط المادة والمرحلة
const isFreeSubject = (prices,subject,stage) => {
  if(!prices||!subject||!stage) return true; // لو الأسعار ما حُملت بعد، نفترض مجاني
  const key = subject+"__"+stage;
  const p = prices[key];
  return !p || Number(p)===0;
};
// هل الطالب يملك صلاحية الوصول؟ (مشترك بنفس الصف تحديداً، أو المادة مجانية)
const hasAccess = (subs,prices,subject,stage,grade) => {
  return isFreeSubject(prices,subject,stage) || isSubscribed(subs,subject,stage,grade);
};

// ─── CODE SYSTEM HELPERS ─────────────────────────────────
// عدد الأيام اللي يبقى فيها الكود صالح للاستخدام (قبل أن ينتهي إذا لم يُستخدم)
const CODE_VALIDITY_DAYS = 7;
// حروف بدون رموز ملتبسة (بدون O/0 وI/1) لتقليل الأخطاء عند كتابة الكود يدوياً
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateRandomCode = (length=7) => {
  let out="";
  for(let i=0;i<length;i++) out += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
  return out;
};
// يحسب تاريخ الانتهاء الجديد بعد تفعيل كود: يمدد الاشتراك الحالي لنفس الصف تحديداً
// (إن وجد ولم ينتهِ) بدل استبداله — مع نفس منطق التوافق الرجعي مع الاشتراكات القديمة بلا صف
const computeExtendedExpiry = (currentSubs,subject,stage,durationDays,grade) => {
  const now = new Date();
  const existing = currentSubs?.[subAccessKey(subject,stage,grade)] || currentSubs?.[subAccessKey(subject,stage,"")];
  const base = (existing && new Date(existing.expiresAt) > now) ? new Date(existing.expiresAt) : now;
  const next = new Date(base);
  next.setDate(next.getDate()+Number(durationDays||0));
  return next;
};


// ─── PARTNER CAMPAIGN CODES (أكواد شراكة جماعية للصفحات/المجموعات) ─────
const defaultCampaignExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate()+30); // شهر واحد افتراضياً
  return d;
};

// ─── SESSION PERSISTENCE ─────────────────────────────────
const saveSession = (student, role) => {
  try { localStorage.setItem("edutok_session", JSON.stringify({student, role})); } catch{}
};
const loadSession = () => {
  try { return JSON.parse(localStorage.getItem("edutok_session")||"null"); } catch{ return null; }
};
const clearSession = () => {
  try { localStorage.removeItem("edutok_session"); } catch{}
};

// ─── PASSWORD HASHING (SHA-256 + ملح عشوائي لكل طالب) ───
const bufferToHex = (buf) => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
const randomSalt = () => bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
};
// يولّد {hash, salt} من كلمة مرور خام، لتخزينها في Firestore بدل النص الواضح
const hashPassword = async (plainPass) => {
  const salt = randomSalt();
  const hash = await sha256Hex(salt + ":" + plainPass);
  return { hash, salt };
};
// يتحقق من تطابق كلمة مرور خام مع hash/salt مخزّنين مسبقاً
const verifyPassword = async (plainPass, hash, salt) => {
  if(!hash || !salt) return false;
  const candidate = await sha256Hex(salt + ":" + plainPass);
  return candidate === hash;
};

// ─── YOUTUBE HELPER ─────────────────────────────────────
const getYoutubeId = (url) => {
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|m\.youtube\.com\/watch\?v=)([^&\n?#]+)/);
  return m ? m[1] : null;
};

// ─── طلب fetch بحد زمني (Timeout) ───────────────────────
// بدون هذا، لو مزود ذكاء اصطناعي واحد تأخر بالرد (Cold Start مثلاً)، الطلب
// كله يفضل معلّق بلا نهاية ولا ينتقل لمزود تاني — حتى لو باقي المزودين شغالين
// تمام. هذا الحد الزمني يضمن فشل سريع (بدل تعليق للأبد) عشان الـ Fallback
// التلقائي بـcallAI يقدر ينتقل فوراً للمزود التالي.
const FETCH_TIMEOUT_MS = 20000; // 20 ثانية
const fetchWithTimeout = (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(()=>clearTimeout(timer));
};

// ─── GROQ AI (عبر السيرفر، المفتاح غير مكشوف بالمتصفح) ──
const callGroq = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/groq", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt, imageBase64, imageMime })
    });
  }catch(e){
    if(e.name==="AbortError") throw new Error("انتهت المهلة — Groq تأخر بالرد أكثر من اللازم");
    throw new Error("تعذّر الاتصال بـ Groq: "+e.message);
  }
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.error) throw new Error(d.error||"خطأ بالاتصال بالمساعد الذكي");
  return d.text || "";
};
// callGemini كانت سابقاً مجرد اسم مستعار لـ callGroq (أي أنها كانت تتصل بـ Groq فعلياً رغم الاسم) — الآن اتصال حقيقي منفصل بـ Gemini
const callGemini = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/gemini", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt, imageBase64, imageMime })
    });
  }catch(e){
    if(e.name==="AbortError") throw new Error("انتهت المهلة — Gemini تأخر بالرد أكثر من اللازم");
    throw new Error("تعذّر الاتصال بـ Gemini: "+e.message);
  }
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.error) throw new Error(d.error||"خطأ بالاتصال بـ Gemini");
  return d.text || "";
};

// ─── OPENROUTER (عبر السيرفر، المفتاح غير مكشوف بالمتصفح) ──
// مجاني بالكامل بدون بطاقة بنكية — مفتاح واحد يوصل لعشرات الموديلات المجانية
// (اللاحقة :free). بديل GitHub Models بعد ما تقاعدت الخدمة نهائياً 30 يوليو 2026.
// الموديل النصي فقط، نفس منطق الصورة المتجاهلة تلقائياً بالسيرفر (راجع
// api/openrouter.js)
const callOpenRouter = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/openrouter", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt, imageBase64, imageMime })
    });
  }catch(e){
    if(e.name==="AbortError") throw new Error("انتهت المهلة — OpenRouter تأخر بالرد أكثر من اللازم");
    throw new Error("تعذّر الاتصال بـ OpenRouter: "+e.message);
  }
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.error) throw new Error(d.error||"خطأ بالاتصال بـ OpenRouter");
  return d.text || "";
};

// ─── NVIDIA NIM (عبر السيرفر، المفتاح غير مكشوف بالمتصفح) ──
// مجاني بالكامل بدون بطاقة بنكية (كتالوج مفتوح من مئات الموديلات) — نفس منطق
// الصورة المتجاهلة تلقائياً بالسيرفر لأن الموديل النصي المختار لا يدعم الصور
// (راجع api/nvidia.js)
const callNvidia = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/nvidia", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt, imageBase64, imageMime })
    });
  }catch(e){
    if(e.name==="AbortError") throw new Error("انتهت المهلة — NVIDIA تأخر بالرد أكثر من اللازم");
    throw new Error("تعذّر الاتصال بـ NVIDIA: "+e.message);
  }
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.error) throw new Error(d.error||"خطأ بالاتصال بـ NVIDIA");
  return d.text || "";
};

// ─── استدعاء ذكي بتوزيع عشوائي + خيار احتياطي تلقائي بين كل المزودين ───
// الهدف: (1) توزيع الحمل تلقائياً على كل المزودين المسجّلين بدل تركيزه دايماً
// على مزود واحد بالبداية (Gemini) و(2) لو فشل مزود بسبب امتلاء الحصة/الازدحام،
// ننتقل تلقائياً للي بعده بترتيب عشوائي، بدون ما يحتاج الطالب/المدير يعرف أو يتدخل.
//
// ملاحظة مهمة: الصور (OCR) تحتاج مزود يدعم الرؤية. Mistral وNVIDIA حالياً
// نصّيين فقط، فلو الطلب فيه صورة، نستثنيهم من قائمة المحاولة تلقائياً — إرسال
// الطلب لهم أصلاً بلا فائدة (السيرفر يتجاهل الصورة ويرد بنص غير مرتبط بالسؤال).
const AI_PROVIDERS = [
  { name: "Gemini",   fn: callGemini,   supportsImage: true  },
  { name: "Groq",     fn: callGroq,     supportsImage: true  },
  { name: "OpenRouter", fn: callOpenRouter, supportsImage: false },
  { name: "NVIDIA",   fn: callNvidia,   supportsImage: false },
];

const isQuotaOrOverloadError = (e) => {
  const msg = (e.message||"").toLowerCase();
  return msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")
    || msg.includes("resource_exhausted") || msg.includes("high demand") || msg.includes("overloaded");
};

// خلط عشوائي (Fisher-Yates) — يضمن ترتيب مختلف بكل استدعاء، فيتوزع الحمل
// تلقائياً بين المزودين بدل ما يبدأ نفس المزود دايماً بالمقدمة
const shuffleProviders = (list) => {
  const arr = [...list];
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const callAI = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  const eligible = imageBase64 ? AI_PROVIDERS.filter(p=>p.supportsImage) : AI_PROVIDERS;
  const order = shuffleProviders(eligible);

  // ── حالة سؤال نصي بحت (بدون صورة) ──────────────────────
  // نطلق كل المزودين المؤهّلين بالتوازي بنفس اللحظة (مو واحد ورا الثاني) —
  // أول مزود يرد بنجاح هو اللي يُستخدم فوراً. حجم النص صغير جداً فما فيه أي
  // كلفة شبكة إضافية من إرساله لعدة مزودين بنفس الوقت.
  if(!imageBase64){
    try{
      return await Promise.any(order.map(p=>p.fn(prompt, imageBase64, imageMime)));
    }catch(aggregateError){
      const errors = aggregateError?.errors || [aggregateError];
      throw errors[errors.length-1];
    }
  }

  // ── حالة سؤال فيه صورة (OCR) ────────────────────────────
  // نرجع للأسلوب التتابعي (مزود واحد بالمرة) عمداً — إرسال نفس الصورة الثقيلة
  // بالتوازي لعدة مزودين بنفس اللحظة يخلي جوال الطالب يرفعها أكثر من مرة سوا
  // عبر شبكة محدودة (LTE/بيانات)، فيتنافسون على نفس عرض النطاق ويصيرون أبطأ
  // من إرسالها لمزود وحد بكامل سرعة الاتصال المتاحة.
  let lastError = null;
  for(let i=0; i<order.length; i++){
    try{
      return await order[i].fn(prompt, imageBase64, imageMime);
    }catch(e){
      lastError = e;
      if(i===order.length-1) throw lastError;
    }
  }
  throw lastError;
};


// ─── IMGBB UPLOAD (عبر السيرفر، المفتاح غير مكشوف) ─────
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(",")[1]); // إزالة data:...;base64,
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const uploadToImgBB = async (file) => {
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/imgbb", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ imageBase64: base64 })
  });
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.url) return {url:d.url, base64:d.base64||null};
  throw new Error(d.error||"فشل رفع الصورة");
};

// ─── STYLES ─────────────────────────────────────────────
const C = {
  app:{width:"100%",maxWidth:"420px",minHeight:"100vh",backgroundColor:"#09090b",color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif",direction:"rtl",margin:"0 auto",paddingBottom:"72px",boxSizing:"border-box",overflowX:"hidden",overflowY:"auto",position:"relative"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoRow:{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"},
  section:{padding:"16px"},
  twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  tabsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"6px",padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  tab:(a)=>({padding:"8px 4px",borderRadius:"10px",border:"none",fontSize:"10px",fontWeight:"bold",cursor:"pointer",backgroundColor:a?"#f97316":"#27272a",color:"#fff",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:"3px"}),
  label:{display:"block",fontSize:"13px",color:"#a1a1aa",marginBottom:"6px"},
  input:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none"},
  select:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none",appearance:"none"},
  gradBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#f97316,#ef4444)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px",marginBottom:"10px"},
  blueBtn:{width:"100%",padding:"14px",backgroundColor:"#0ea5e9",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  redBtn:{width:"100%",padding:"14px",backgroundColor:"#ef4444",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  purpleBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#7c3aed,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px"},
  primaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px"},
  secondaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.12)",backgroundColor:"#18181b",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer"},
  saveRow:{display:"flex",gap:"10px",marginTop:"8px"},
  cancelBtn:{flex:1,padding:"14px",backgroundColor:"#27272a",color:"#a1a1aa",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  saveBtn:{flex:1,padding:"14px",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  adminBtn:{background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"},
  infoBanner:{backgroundColor:"rgba(8,47,73,0.4)",border:"1px solid #0369a1",borderRadius:"12px",padding:"12px",fontSize:"13px",color:"#38bdf8",marginBottom:"16px",display:"flex",alignItems:"center",gap:"6px"},
  card:{backgroundColor:"#18181b",borderRadius:"14px",padding:"14px 16px",marginBottom:"10px",border:"1px solid rgba(255,255,255,0.04)"},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"64px",backgroundColor:"#09090b",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:100,boxSizing:"border-box"},
  navItem:(a)=>({display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:a?"#38bdf8":"#71717a",gap:"2px",padding:"4px"}),
  welcomeWrap:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",minHeight:"88vh"},
  welcomeTitle:{fontSize:"36px",fontWeight:"900",background:"linear-gradient(to right,#38bdf8,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:"12px 0 4px"},
  priceRow:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#18181b",padding:"10px 16px",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.04)"},
  priceInput:{width:"100%",background:"none",border:"none",color:"#fff",textAlign:"right",fontSize:"14px",outline:"none"},
  statsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"10px"},
  statCard:{backgroundColor:"#18181b",padding:"16px 12px",borderRadius:"14px",textAlign:"center",border:"1px solid rgba(255,255,255,0.03)"},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:200,padding:"16px"},
  modalBox:{backgroundColor:"#18181b",borderRadius:"24px",padding:"24px",width:"100%",maxWidth:"380px",maxHeight:"88vh",overflowY:"auto"},
  videoWrap:{position:"relative",width:"calc(100% - 32px)",height:"500px",margin:"16px auto",borderRadius:"24px",border:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"center",alignItems:"center",overflow:"hidden"},
  confirmBox:{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"},
  sidebar:{position:"absolute",left:"10px",bottom:"96px",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",gap:"14px",zIndex:15},
  sideBtn:(a)=>({width:"40px",height:"40px",background:"transparent",border:"none",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",cursor:"pointer",color:a?"#22d3ee":"#fff",gap:"3px",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.9)) drop-shadow(0 0 1px rgba(0,0,0,0.6))"}),
  sideTxt:(a)=>({fontSize:"9px",fontWeight:"600",color:a?"#22d3ee":"#fff",textShadow:"0 1px 3px rgba(0,0,0,0.9)"}),
  moreMenu:{position:"absolute",bottom:"20px",left:"16px",right:"16px",backgroundColor:"rgba(24,24,27,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px",padding:"14px 12px",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:30,backdropFilter:"blur(12px)"},
  moreItem:{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:"#fff",padding:"4px 8px"},
  // ── وضع ملء الشاشة (الشاشة الرئيسية فقط) ──
  fullScreenWrap:{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"100vh",backgroundColor:"#000",overflow:"hidden",zIndex:1},
  fullHeader:{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",zIndex:20,background:"linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0))"},
  floatingNav:{position:"absolute",bottom:0,left:0,right:0,display:"flex",justifyContent:"space-around",alignItems:"center",padding:"10px 0 48px",zIndex:25,background:"linear-gradient(0deg,rgba(0,0,0,0.75),rgba(0,0,0,0))"},
};

// ─── SHARED COMPONENTS ──────────────────────────────────
const Spinner = ({color="#38bdf8",size=24}) => (
  <div style={{display:"inline-block",animation:"spin 1s linear infinite"}}>
    <Loader size={size} color={color}/>
    <style dangerouslySetInnerHTML={{__html:"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
  </div>
);
const MHead = ({icon,title,color,onClose,extra}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>{icon}<span style={{fontWeight:"bold",fontSize:"16px",color:color||"#fff"}}>{title}</span></div>
    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
      {extra}
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#71717a"}}><X size={20}/></button>
    </div>
  </div>
);
const ErrBox = ({msg}) => msg?<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"14px",textAlign:"center"}}>! {msg}</div>:null;

// ─── FIRST-USE TIP (تلميح سياقي يظهر أول مرة بس) ──────────
// فقاعة صغيرة توضح ميزة معيّنة أول مرة يفتحها الطالب، وتختفي للأبد بعد أول
// ظهور (تُتابع بـlocalStorage بمفتاح مستقل لكل ميزة عبر tipKey) — بدل شرح عام
// طويل، توجيه لحظي بالضبط وقت الحاجة الحقيقية
const FirstUseTip = ({tipKey, text}) => {
  const storageKey = "edutok_tip_seen_"+tipKey;
  const [seen,setSeen]=useState(()=>{
    try{ return localStorage.getItem(storageKey)==="1"; }catch{ return true; } // بحال فشل التخزين، ما نزعج الطالب بتكرار التلميح
  });
  if(seen) return null;
  const dismiss=()=>{
    try{ localStorage.setItem(storageKey,"1"); }catch{}
    setSeen(true);
  };
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:"8px",backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"10px",padding:"10px 12px",marginBottom:"14px",animation:"pageBadgeIn 0.3s ease-out both"}}>
      <span style={{fontSize:"15px",flexShrink:0}}>💡</span>
      <div style={{flex:1,fontSize:"12px",color:"#bae6fd",lineHeight:"1.6"}}>{text}</div>
      <button onClick={dismiss} style={{background:"none",border:"none",color:"#7dd3fc",cursor:"pointer",flexShrink:0,padding:0}}><X size={14}/></button>
    </div>
  );
};

// ─── MATH TEXT (يعرض النصوص العادية + رموز KaTeX الموجودة بين $...$) ───
// مثال: "احسب $\\frac{5}{2}$ ثم بسّط الناتج" → يطبع النص عادي، ويرسم الكسر رياضياً
// mathHighlight: تفعيل اختياري لإطار ملوّن حول كل رمز/معادلة (يُستخدم بالمساعد الذكي لجعل الرموز أوضح وأجمل)
// يدعم: $...$  و  \(...\)  و  \[...\]  بالإضافة لـ **bold** (Markdown بسيط) —
// بعض المزودين (Cerebras/DeepSeek) لا يلتزمون دايماً بصيغة $...$ المطلوبة بالبرومبت
// ويرجعون بصيغتهم الافتراضية، فنجعل الواجهة نفسها تتعرف على كل الصيغ الشائعة بدل
// الاعتماد الكامل على انضباط النموذج.
const MathText = ({text,style,mathHighlight}) => {
  if(text===undefined||text===null||text==="") return null;
  let raw = String(text);
  // نوحّد كل صيغ LaTeX الشائعة إلى $...$ عشان نتعامل معها بمكان واحد فقط
  raw = raw
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => "$"+inner+"$") // \[ ... \] → $...$
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => "$"+inner+"$"); // \( ... \) → $...$

  // نقسم النص عند كل جزء محاط بـ $...$ (بدون شرطة مائلة قبل $) مع الاحتفاظ بالفواصل
  const mathParts = raw.split(/(\$[^$]+\$)/g);
  const hasMath = mathParts.some(p=>p.startsWith("$")&&p.endsWith("$")&&p.length>1);
  const hasBold = /\*\*[^*]+\*\*/.test(raw);
  if(!hasMath && !hasBold) return <span style={style}>{raw}</span>;

  // يقسم نص عادي (بلا لاتكس) على **bold** ويطبعه
  const renderPlain = (str, keyPrefix) => {
    const boldParts = str.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp,j)=>{
      if(bp.startsWith("**")&&bp.endsWith("**")&&bp.length>3){
        return <strong key={keyPrefix+"-b-"+j}>{bp.slice(2,-2)}</strong>;
      }
      return bp?<span key={keyPrefix+"-t-"+j}>{bp}</span>:null;
    });
  };

  return (
    <span style={{...style,unicodeBidi:"plaintext"}}>
      {mathParts.map((part,i)=>{
        if(part.startsWith("$")&&part.endsWith("$")&&part.length>1){
          const latex=part.slice(1,-1);
          let html;
          try{ html=katex.renderToString(latex,{throwOnError:false,displayMode:false}); }
          catch{ return <span key={i}>{part}</span>; }
          return <span key={i} dir="ltr" style={mathHighlight?{
              unicodeBidi:"isolate",display:"inline-block",verticalAlign:"middle",
              background:"linear-gradient(135deg,rgba(56,189,248,0.14),rgba(168,85,247,0.14))",
              border:"1px solid rgba(56,189,248,0.25)",borderRadius:"8px",
              padding:"3px 8px",margin:"2px 3px",
            }:{unicodeBidi:"isolate",display:"inline-block",verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:html}}/>;
        }
        return part ? <React.Fragment key={i}>{renderPlain(part,i)}</React.Fragment> : null;
      })}
    </span>
  );
};

// ─── قراءة صوتية (Text-to-Speech) ────────────────────────
// نحذف رموز LaTeX الخام ($...$) من النص المنطوق ونستبدلها بكلمة "معادلة"
// لأن قراءة كود LaTeX حرفياً بصوت عالي غير مفهومة؛ نكتفي بالإشارة لوجود رمز/معادلة هناك
let _currentUtterance = null;
const stopSpeaking = () => { try{ window.speechSynthesis?.cancel(); }catch{} _currentUtterance=null; };
// يتحقق من توفر صوت عربي فعلي مثبت بالجهاز/المتصفح (وليس مجرد صوت افتراضي بلغة إنجليزية
// نلصق عليه وسم "ar")، حتى لا نعرض زر قراءة صوتية بصوت غير مفهوم لطالب جهازه ما يدعم ذلك
const getArabicVoice = () => {
  try{
    if(!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v=>v.lang?.toLowerCase().startsWith("ar")) || null;
  }catch{ return null; }
};
const speakText = (text, onEnd) => {
  try{
    if(!("speechSynthesis" in window)) return false;
    stopSpeaking();
    const spoken = String(text).replace(/\$[^$]+\$/g, " معادلة ").replace(/\s+/g," ").trim();
    if(!spoken) return false;
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = "ar-SA";
    utter.rate = 0.95;
    const arVoice = getArabicVoice();
    if(arVoice) utter.voice = arVoice;
    utter.onend = ()=>{ _currentUtterance=null; if(onEnd) onEnd(); };
    utter.onerror = ()=>{ _currentUtterance=null; if(onEnd) onEnd(); };
    _currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return true;
  }catch{ return false; }
};

// ─── TOAST NOTIFICATION ──────────────────────────────────
// ─── أصوات تفاعلية بسيطة (Sound Design) ─────────────────
// نولّدها برمجياً بنغمات بسيطة (بدون ملفات صوت خارجية، صفر اعتماديات جديدة)
let _audioCtx = null;
const playTone = (freq, duration=150, volume=0.12) => {
  try{
    if(!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==="suspended") _audioCtx.resume();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain); gain.connect(_audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration/1000);
    osc.stop(_audioCtx.currentTime + duration/1000);
  }catch(e){ /* بعض المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بصمت، غير حرج */ }
};
const playCorrectSound = () => { playTone(880,110); setTimeout(()=>playTone(1175,150),90); };
const playWrongSound = () => { playTone(220,220); };
const playFanfareSound = () => { playTone(523,110); setTimeout(()=>playTone(659,110),110); setTimeout(()=>playTone(784,220),220); };
const playLevelUpSound = () => { playTone(659,90); setTimeout(()=>playTone(784,90),90); setTimeout(()=>playTone(988,90),180); setTimeout(()=>playTone(1319,260),270); };

// ─── رفيق النمو (Growth Mascot) — يتطوّر شكله مع ارتفاع مستوى الطالب ───
const getMascot = (level) => {
  if(level>=11) return {emoji:"🐉", label:"أسطورة"};
  if(level>=8)  return {emoji:"🦉", label:"حكيم"};
  if(level>=5)  return {emoji:"🌳", label:"شجرة يانعة"};
  if(level>=3)  return {emoji:"🌿", label:"نبتة نامية"};
  return {emoji:"🌱", label:"بذرة"};
};

let _setToast = null;
const showMsg = (msg) => { if(_setToast) _setToast(msg); };
const Toast = () => {
  const [msg,setMsg] = useState("");
  _setToast = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3000); };
  if(!msg) return null;
  return (
    <div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",
      backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.15)",
      borderRadius:"12px",padding:"12px 20px",fontSize:"13px",color:"#fff",
      zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",maxWidth:"320px",
      textAlign:"center",direction:"rtl"}}>
      {msg}
    </div>
  );
};

// ─── IMAGE UPLOADER ──────────────────────────────────────
// يضغط/يصغّر صورة بالمتصفح قبل رفعها (باستخدام Canvas) — يقلل حجمها بشكل كبير
// بدون فقدان وضوح ملحوظ للقراءة، ويوفر استهلاك بيانات الطالب عند فتحها لاحقاً.
// اختياري بالكامل (مو مفعّل تلقائياً لكل استخدامات ImageUploader) لتفادي أي
// تأثير على حالات حساسة لدقة الصورة (مثل قراءة نص إيصال دفع أو تحليل OCR)
const compressImage = (file, maxWidth = 1280, quality = 0.75) => new Promise((resolve, reject) => {
  const img = new Image();
  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; };
  reader.onerror = reject;
  img.onload = () => {
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("فشل ضغط الصورة")),
      "image/jpeg",
      quality
    );
  };
  img.onerror = reject;
  reader.readAsDataURL(file);
});

const ImageUploader = ({onUpload, onBase64, color="#34d399", label="اضغط لرفع صورة", compress=false}) => {
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  const handleFile=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    try{
      // نضغط الصورة فقط لو الاستخدام طلب ذلك صراحة (compress=true) — باقي
      // استخدامات هذا المكوّن (إيصالات، صور OCR) تبقى بدون أي تغيير
      const toUpload = compress ? await compressImage(file).catch(()=>file) : file;
      const result=await uploadToImgBB(toUpload);
      setPreview(result.url);
      onUpload && onUpload(result.url);
      onBase64 && onBase64(result.base64);
    }catch{showMsg("فشل رفع الصورة، حاول مرة أخرى");}
    setUploading(false);
  };
  return (
    <div style={{marginBottom:"12px"}}>
      {preview&&<img src={preview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
      {uploading
        ?<div style={{textAlign:"center",padding:"16px",color}}><Spinner color={color}/><div style={{marginTop:"8px",fontSize:"12px"}}>جارٍ رفع الصورة...</div></div>
        :<label style={{display:"block",width:"100%",padding:"16px",backgroundColor:"rgba(52,211,153,0.08)",border:"2px dashed rgba(52,211,153,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
          <Camera size={28} color={color} style={{margin:"0 auto 6px"}}/>
          <div style={{fontSize:"13px",color,fontWeight:"bold"}}>{preview?"تغيير الصورة":label}</div>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"3px"}}>من الكاميرا أو معرض الصور</div>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
      }
    </div>
  );
};

// ─── VIDEO PLAYER ────────────────────────────────────────
const SLIDE_CSS = `
@keyframes slideGlowPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.15)}}
@keyframes slideFadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideFadeOut{from{opacity:1}to{opacity:0}}
@keyframes titleReveal{from{opacity:0;transform:scaleX(0.6)}to{opacity:1;transform:scaleX(1)}}
@keyframes underlineDraw{from{width:0}to{width:100%}}
@keyframes pointUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes iconSpin{from{opacity:0;transform:scale(0.3) rotate(-180deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
@keyframes particleFloat{0%{transform:translate(0,0) scale(1);opacity:0.7}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
@keyframes progressGrow{from{width:0}to{width:var(--pw)}}
@keyframes bgGlow{0%{transform:translate(0%,0%)}25%{transform:translate(30%,-20%)}50%{transform:translate(-10%,30%)}75%{transform:translate(-30%,10%)}100%{transform:translate(0%,0%)}}
@keyframes pageBadgeIn{from{opacity:0;transform:scale(0.6) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes gradeBadgeIn{from{opacity:0;transform:scale(0.6) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
`;

const AnimatedSlides = ({video, playing, onClick, ts, slideIdx, setSlideIdx, fontSize="medium"}) => {
  const [visible, setVisible] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  // يتحكم بعرض/إخفاء صورة صفحة الكتاب بملء الشاشة (زر 📖 تحت شارة رقم الصفحة)
  const [showPageImage, setShowPageImage] = useState(false);
  useEffect(()=>{ setShowPageImage(false); }, [video.id]);
  const DURATION = 5000;
  const TRANSITION = 450;
  const touchX = useRef(null);

  // أحجام الخط حسب الإعداد
  const fontSizes = {
    small:  {title:"15px", point:"11px"},
    medium: {title:"18px", point:"13px"},
    large:  {title:"22px", point:"16px"},
  };
  const fs = fontSizes[fontSize] || fontSizes.medium;

  const goTo = (next) => {
    if(next<0||next>=video.slides.length) return;
    setVisible(false);
    setTimeout(()=>{ setSlideIdx(next); setAnimKey(k=>k+1); setVisible(true); }, TRANSITION);
  };

  // سحب جانبي لتغيير الشرائح
  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if(touchX.current===null) return;
    const diff = touchX.current - e.changedTouches[0].clientX;
    if(Math.abs(diff)>50){
      if(diff>0) goTo(slideIdx+1); // سحب يسار → التالي
      else goTo(slideIdx-1);       // سحب يمين → السابق
    }
    touchX.current=null;
  };

  const sl = video.slides[slideIdx] || {};
  const total = video.slides.length;
  const progressW = ((slideIdx+1)/total*100)+"%";

  // جسيمات عشوائية
  const particles = Array.from({length:8},(_,i)=>({
    id:i,
    top: Math.random()*100+"%",
    left: Math.random()*100+"%",
    tx: (Math.random()-0.5)*80+"px",
    ty: (Math.random()-0.5)*80+"px",
    size: 2+Math.random()*4,
    delay: Math.random()*2+"s",
    dur: 2+Math.random()*2+"s",
    color: ts.accent,
  }));

  return (
    <div style={{position:"absolute",inset:0,zIndex:2,background:ts.bg,overflow:"hidden",cursor:"pointer"}}
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={e=>{
        if(touchX.current!==null){
          const diffX=touchX.current-e.changedTouches[0].clientX;
          if(Math.abs(diffX)>50) e.stopPropagation();
        }
        handleTouchEnd(e);
      }}
    >
      <style>{SLIDE_CSS}</style>

      {/* خلفية توهج ضبابي متحرك */}
      <div style={{position:"absolute",width:"280px",height:"280px",borderRadius:"50%",background:`radial-gradient(circle,${ts.accent}30,transparent 70%)`,top:"-60px",right:"-60px",animation:"bgGlow 8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:"200px",height:"200px",borderRadius:"50%",background:`radial-gradient(circle,${ts.accent}20,transparent 70%)`,bottom:"-40px",left:"-40px",animation:"bgGlow 10s ease-in-out infinite reverse",pointerEvents:"none"}}/>

      {/* جسيمات */}
      {particles.map(p=>(
        <div key={p.id} style={{position:"absolute",top:p.top,left:p.left,width:p.size+"px",height:p.size+"px",borderRadius:"50%",backgroundColor:p.color,animation:`particleFloat ${p.dur} ${p.delay} ease-out infinite`,"--tx":p.tx,"--ty":p.ty,pointerEvents:"none",opacity:0.6}}/>
      ))}

      {/* عداد الشرائح — أعلى وسط الشاشة تماماً، بعيد عن شعار التطبيق تفادياً
          لأي تصادم بصري معه، وثابت بنفس ارتفاع الهيدر العلوي.
          اسم الفصل يظهر تحته مباشرة بنفس المحاذاة (منتصف أعلى الشاشة) */}
      <div style={{position:"absolute",top:"12px",left:"50%",transform:"translateX(-50%)",zIndex:6,display:"flex",flexDirection:"column",alignItems:"center",gap:"5px"}}>
        <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"3px 12px",border:`1px solid ${ts.accent}44`}}>
          <span dir="ltr" style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>{slideIdx+1} / {total}</span>
        </div>
        {video.topic&&(
          <div style={{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px",maxWidth:"220px"}}>
            <span style={{color:"rgba(255,255,255,0.75)",fontSize:"10px",fontWeight:"bold",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>{video.topic}</span>
          </div>
        )}
      </div>

      {/* شارة المادة والصفحة — ثابتة بموضع مطلق بنفس ارتفاع الهيدر العلوي (الشعار
          وشارة الصف)، عمداً منفصلة عن محتوى الشريحة المتحرك بالـfade، عشان تبقى
          بنفس المستوى الأفقي دايماً بغض النظر عن طول نص أي شريحة */}
      <div style={{position:"absolute",top:"12px",left:"18px",zIndex:6,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"5px"}}>
        <div style={{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px"}}>
          <span style={{color:"rgba(255,255,255,0.6)",fontSize:"10px"}}>{video.subject}</span>
        </div>
        {video.page&&(
          <div style={{display:"flex",alignItems:"center",gap:"4px",background:`linear-gradient(135deg,${ts.accent},${ts.accent}99)`,borderRadius:"20px",padding:"3px 10px 3px 8px",boxShadow:`0 2px 10px ${ts.accent}66`,animation:"pageBadgeIn 0.4s ease-out both"}}>
            <BookOpen size={11} color="#fff" strokeWidth={2.5}/>
            <span style={{color:"#fff",fontSize:"11px",fontWeight:"900",letterSpacing:"0.3px"}}>صفحة {video.page}</span>
          </div>
        )}
        {video.pageImage&&(
          <button onClick={()=>setShowPageImage(true)} title="عرض صفحة الكتاب" style={{display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:`1px solid ${ts.accent}55`,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(4px)",cursor:"pointer",padding:0,animation:"pageBadgeIn 0.5s ease-out both"}}>
            <span style={{fontSize:"15px",lineHeight:1}}>📖</span>
          </button>
        )}
      </div>

      {/* عرض صورة صفحة الكتاب بملء الشاشة — تُفتح بالضغط على أيقونة 📖 أعلاه */}
      {showPageImage&&video.pageImage&&(
        <div onClick={()=>setShowPageImage(false)} style={{position:"fixed",inset:0,zIndex:200,backgroundColor:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",animation:"pageBadgeIn 0.25s ease-out both"}}>
          <button onClick={()=>setShowPageImage(false)} style={{position:"absolute",top:"18px",left:"18px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:"38px",height:"38px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
            <X size={20}/>
          </button>
          <img src={video.pageImage} alt="صفحة الكتاب" onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:"8px"}}/>
        </div>
      )}
      <div key={animKey} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",justifyContent:"flex-start",padding:"82px 18px 80px",animation:`${visible?"slideFadeIn":"slideFadeOut"} ${TRANSITION}ms ease forwards`}}>

        {/* أيقونة */}
        <div style={{textAlign:"center",marginBottom:"10px",animation:"iconSpin 0.6s cubic-bezier(0.34,1.56,0.64,1) both"}}>
          <span style={{fontSize:"28px",filter:`drop-shadow(0 0 8px ${ts.accent})`}}>◆</span>
        </div>

        {/* عنوان مع توهج وخط */}
        <div style={{textAlign:"center",marginBottom:"18px"}}>
          <h3 style={{color:"#fff",fontSize:fs.title,fontWeight:"900",margin:"0 0 6px",lineHeight:1.4,animation:"titleReveal 0.5s ease-out both",transformOrigin:"center",textShadow:`0 0 20px ${ts.accent}88`}}>
            <MathText text={sl.title}/>
          </h3>
          <div style={{height:"2px",background:`linear-gradient(to left,transparent,${ts.accent},transparent)`,animation:"underlineDraw 0.5s 0.2s ease-out both",width:"0%"}}/>
        </div>

        {/* النقاط */}
        <ul style={{listStyle:"none",padding:0,margin:0}}>
          {(sl.points||[]).map((pt,i)=>(
            <li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",animation:`pointUp 0.4s ${0.3+i*0.15}s ease-out both`,opacity:0}}>
              <span style={{color:ts.accent,flexShrink:0,marginTop:"2px",fontSize:"12px",filter:`drop-shadow(0 0 4px ${ts.accent})`}}>◆</span>
              <span style={{color:"rgba(255,255,255,0.9)",fontSize:fs.point,lineHeight:1.6}}><MathText text={pt}/></span>
            </li>
          ))}
        </ul>
      </div>

      {/* شريط التقدم */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"3px",backgroundColor:"rgba(255,255,255,0.1)"}}>
        <div style={{height:"100%",background:`linear-gradient(to left,${ts.accent},${ts.accent}88)`,"--pw":progressW,animation:`progressGrow 0.5s ease-out both`,width:progressW,transition:"width 0.4s ease"}}/>
      </div>

      {/* نقاط التنقل */}
      <div style={{position:"absolute",top:"10px",left:"50%",transform:"translateX(-50%)",display:"flex",gap:"4px",zIndex:10}} onClick={e=>e.stopPropagation()}>
        {video.slides.map((_,i)=>(
          <div key={i} onClick={()=>goTo(i)} style={{width:i===slideIdx?"16px":"5px",height:"5px",borderRadius:"3px",backgroundColor:i===slideIdx?ts.accent:"rgba(255,255,255,0.25)",cursor:"pointer",transition:"all 0.3s ease"}}/>
        ))}
      </div>

      {playing&&<div style={{position:"absolute",top:"10px",right:"12px",fontSize:"9px",color:ts.accent,opacity:0.7}}>▶ تلقائي</div>}
    </div>
  );
};

const VideoPlayer = ({video, playing, onClick, canAccess=true, onSubscribe, externalSlideIdx, onExternalSlideChange, fontSize="medium"}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef(null);

  // استخدم الـ slideIdx الخارجي لو موجود
  const activeIdx = externalSlideIdx!==undefined ? externalSlideIdx : slideIdx;
  const setActiveIdx = onExternalSlideChange || setSlideIdx;

  useEffect(()=>{
    if(video.type==="شرائح AI" && video.slides?.length && playing && canAccess){
      slideTimer.current = setInterval(()=>{
        setActiveIdx(i=> i < video.slides.length-1 ? i+1 : 0);
      }, 5000);
    }
    return ()=>clearInterval(slideTimer.current);
  },[playing, video, canAccess]);

  // شاشة الحجب للمحتوى المدفوع
  if(!canAccess){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,background:"linear-gradient(180deg,rgba(0,0,0,0.7),rgba(0,0,0,0.9))",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:"16px",padding:"24px"}}>
        {video.thumbUrl&&<img src={video.thumbUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.15,zIndex:-1}}/>}
        <div style={{width:"64px",height:"64px",borderRadius:"50%",backgroundColor:"rgba(239,68,68,0.2)",border:"2px solid rgba(239,68,68,0.5)",display:"flex",justifyContent:"center",alignItems:"center"}}>
          <span style={{fontSize:"28px"}}>🔒</span>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"16px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}}>{video.title}</div>
          <div style={{fontSize:"13px",color:"rgba(255,255,255,0.6)",marginBottom:"4px"}}>{video.subject} • {video.stage}</div>
          {video.grade&&<div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)"}}>الصف {video.grade}</div>}
        </div>
        <button onClick={onSubscribe} style={{padding:"12px 28px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#ef4444,#f97316)",color:"#fff",fontSize:"14px",fontWeight:"bold",cursor:"pointer"}}>
          اشترك للوصول
        </button>
      </div>
    );
  }

  // ─── شرائح AI بأنيميشن ───────────────────────────────────
  if(video.type==="شرائح AI" && video.slides?.length){
    const ts = THEME_STYLES[video.theme] || THEME_STYLES["أزرق متدرج"];
    return <AnimatedSlides video={video} playing={playing} onClick={onClick} ts={ts} slideIdx={activeIdx} setSlideIdx={setActiveIdx} fontSize={fontSize}/>;
  }

  // ─── Zoho Show (لا يدعم iframe — نعرض زر فتح خارجي) ────
  if(video.videoUrl && video.videoUrl.includes("zoho.com/show")){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"16px",padding:"24px",background:"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
        <div style={{fontSize:"40px"}}>📊</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"15px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}}>{video.title}</div>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",marginBottom:"16px"}}>عرض تقديمي Zoho Show</div>
        </div>
        <a href={video.videoUrl} target="_blank" rel="noreferrer" style={{padding:"12px 24px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#2563eb)",color:"#fff",fontWeight:"bold",fontSize:"14px",textDecoration:"none",display:"flex",alignItems:"center",gap:"8px"}}>
          🔗 فتح العرض التقديمي
        </a>
      </div>
    );
  }

  const ytId = getYoutubeId(video.videoUrl);
  if(ytId) return (
    <div style={{position:"absolute",inset:0,zIndex:2}}>
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?autoplay=${playing?1:0}&mute=0&controls=1&rel=0`}
        style={{width:"100%",height:"100%",border:"none"}}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
  if(video.videoUrl) return (
    <video
      src={video.videoUrl}
      autoPlay={playing} loop muted playsInline
      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:2}}
    />
  );
  return (
    <>
      {video.thumbUrl&&<img src={video.thumbUrl} alt={video.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:1,opacity:0.6}}/>}
      {!playing&&(
        <div style={{position:"absolute",zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",gap:"8px",pointerEvents:"none"}}>
          <div style={{width:70,height:70,borderRadius:"50%",backgroundColor:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center"}}>
            <Play size={30} color="#fff" fill="#fff"/>
          </div>
          <span style={{color:"rgba(255,255,255,0.8)",fontSize:"12px"}}>اضغط للتشغيل</span>
        </div>
      )}
      {playing&&(
        <div style={{position:"absolute",bottom:"16px",right:"16px",display:"flex",alignItems:"flex-end",gap:"3px",zIndex:6,pointerEvents:"none"}}>
          {[1,2,3,4].map(i=><div key={i} style={{width:"3px",borderRadius:"2px",backgroundColor:"#38bdf8",animation:`eq${i} 0.8s ease-in-out infinite alternate`,height:(8+i*4)+"px",animationDelay:(i*0.15)+"s"}}/>)}
          <style dangerouslySetInnerHTML={{__html:"@keyframes eq1{to{height:16px}}@keyframes eq2{to{height:8px}}@keyframes eq3{to{height:20px}}@keyframes eq4{to{height:10px}}"}}/>
        </div>
      )}
    </>
  );
};

// ─── AI MODAL ────────────────────────────────────────────
// "زكي" — الاسم المقترح لشخصية المساعد الذكي (من "ذكي"، قريب ومألوف وسهل النطق)
function AIModal({onClose,video,currentSlide,audioTracks,currentTrack,setCurrentTrack,audioPlaying,setAudioPlaying,audioVolume,setAudioVolume,onOpenOnboarding}) {
  const [showAudioPanel,setShowAudioPanel]=useState(false);
  const [q,setQ]=useState("");
  const [messages,setMessages]=useState([]); // [{role:"user"|"assistant", text}] — ذاكرة المحادثة الكاملة بالجلسة
  const [loading,setLoading]=useState(false);
  const [mode,setMode]=useState("full"); // "full" = حل كامل دفعة وحدة | "step" = خطوة بخطوة تفاعلي
  const [speakingIdx,setSpeakingIdx]=useState(null);
  const bottomRef = useRef(null);
  // ─── حماية بسيطة من إرسال أسئلة متلاحقة بسرعة ───────────
  // الأسئلة النصية تُرسل بالتوازي لأربعة مزودين مجانيين بنفس اللحظة، فطالب واحد
  // يرسل أسئلة متتالية بسرعة (بقصد أو غلط) يقدر يستنزف حصتهم اليومية بسرعة
  // ويأثر على باقي الطلاب. هذا تبريد بسيط من طرف الواجهة (مو حل شامل مضمون
  // 100%، بس يمنع الإرسال العشوائي السريع بأقل جهد ممكن)
  const AI_COOLDOWN_SECONDS = 4;
  const [cooldown,setCooldown]=useState(0);
  useEffect(()=>{
    if(cooldown<=0) return;
    const t=setTimeout(()=>setCooldown(c=>c-1),1000);
    return ()=>clearTimeout(t);
  },[cooldown]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);
  useEffect(()=>()=>stopSpeaking(),[]); // نوقف أي قراءة صوتية جارية عند إغلاق النافذة

  // نبني وصف دقيق لمحتوى الشريحة الحالية (العنوان + كل النقاط) حتى يجيب زكي بناءً على ما يراه الطالب فعلاً، مو بس اسم الدرس العام
  const slideContext = currentSlide
    ? "عنوان الشريحة الحالية: "+currentSlide.title+"\nمحتوى الشريحة (بالضبط كما يراه الطالب الآن):\n- "+(currentSlide.points||[]).join("\n- ")
    : "";

  const toggleSpeak = (idx, text) => {
    if(speakingIdx===idx){ stopSpeaking(); setSpeakingIdx(null); return; }
    const ok = speakText(text, ()=>setSpeakingIdx(null));
    setSpeakingIdx(ok?idx:null);
  };

  const ask=async(customQ, isContinue)=>{
    const question = customQ || q;
    if(!question.trim())return;
    if(cooldown>0)return; // تجاهل أي محاولة إرسال أثناء فترة التبريد
    stopSpeaking(); setSpeakingIdx(null);
    setCooldown(AI_COOLDOWN_SECONDS);
    const newUserMsg = {role:"user", text:isContinue?"(تابع الخطوة التالية)":question};
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setQ(""); setLoading(true);
    try{
      // نبني تاريخ المحادثة كسياق نصي (ذاكرة المحادثة) لأن الاتصال بالمساعد أحادي الطلب أساساً
      const historyText = messages.length>0
        ? "\n\nسياق المحادثة السابقة بهذي الجلسة (اعتمد عليه، ولا تكرر نفس الشرح إذا الطالب يبني على سؤال سابق):\n"
          + messages.map(m=>(m.role==="user"?"❯ الطالب: ":"❯ زكي: ")+m.text).join("\n")
        : "";
      const stepRule = mode==="step"
        ? "\n\nمهم جداً — وضع \"خطوة بخطوة\" مفعّل: اشرح خطوة واحدة فقط ثم توقف، واختم كلامك بجملة تشجيعية تدعو الطالب يجرب يكمل بنفسه أو يضغط زر \"الخطوة التالية\". لا تعطِ الحل الكامل دفعة وحدة."
        : "\n\nأعطِ الحل أو الشرح كاملاً ومباشرة (وضع الحل الكامل مفعّل).";
      const prompt = "أنت \"زكي\"، مساعد تعليمي ذكي وودود جداً يتكلم بالعربية الفصحى البسيطة، متخصص بمساعدة الطلاب. الطالب يشاهد درس \""+video.title+"\" في مادة "+video.subject+".\n"
        + slideContext + historyText + "\n\n"
        + "سؤال الطالب الآن: "+question+"\n\n"
        + "مهم جداً: أجب بالاعتماد على محتوى الشريحة أعلاه بالضبط (نفس الرموز والخطوات المذكورة فيها)، وليس بشرح عام عن الموضوع. "
        + "اشرح بوضوح: وضّح كل خطوة وسبب استخدامها، اربطها بالمحتوى المعروض، وإن أمكن أضف مثالاً إضافياً بسيطاً يوضح نفس الفكرة."
        + stepRule + "\n\n"
        + "قاعدة إلزامية بصيغة الكتابة: أي رمز أو معادلة رياضية يجب إحاطتها بعلامتي $ من الطرفين وكتابتها بصيغة LaTeX (مثال: $x^2$ للأس، $\\frac{1}{2}$ للكسر، $\\sqrt{x}$ للجذر). أي معادلة أو رمز كيميائي يجب كتابته داخل $\\ce{...}$ (مثال: $\\ce{H2O}$، $\\ce{N2 + 3H2 <=> 2NH3}$). لا تكتب أي رمز رياضي أو كيميائي كنص عادي خارج هذه العلامات. ممنوع استخدام صيغة \\[ ... \\] أو \\( ... \\) نهائياً تحت أي ظرف — استخدم $...$ فقط دائماً.";
      const r=await callAI(prompt);
      setMessages(cur=>[...cur, {role:"assistant", text:r||"لم أتمكن من الإجابة."}]);
    }catch(e){
      // isError + lastQuestion: تُستخدم بزر "حاول مرة أخرى" أسفل الرسالة — نعيد
      // نفس السؤال، وبما إن callAI تخلط ترتيب المزودين عشوائياً بكل استدعاء،
      // إعادة المحاولة غالباً تجرب مزوداً مختلفاً تلقائياً بدون أي تعقيد إضافي
      setMessages(cur=>[...cur, {role:"assistant", text:"حدث خطأ: "+e.message, isError:true, lastQuestion:question}]);
    }
    setLoading(false);
  };

  const lastIsAssistant = messages.length>0 && messages[messages.length-1].role==="assistant";

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)",display:"flex",flexDirection:"column"}}>
    <MHead icon={<Bot size={20} color="#38bdf8"/>} title="زكي 🤖 مساعدك التعليمي" color="#38bdf8" onClose={onClose}
      extra={
        <button onClick={()=>setShowAudioPanel(v=>!v)} title="أناشيد وموسيقى دراسة" style={{background:showAudioPanel?"rgba(56,189,248,0.15)":"none",border:"none",borderRadius:"8px",padding:"5px",cursor:"pointer",color:currentTrack?"#38bdf8":"#71717a",display:"flex",alignItems:"center"}}>
          <Volume2 size={19}/>
        </button>
      }/>

    {/* زر كبير بلون جذاب لإعادة فتح جولة الشرح التعريفية بأي وقت */}
    {onOpenOnboarding&&(
      <button onClick={onOpenOnboarding} style={{width:"100%",padding:"14px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)",backgroundSize:"200% 200%",color:"#fff",fontSize:"14px",fontWeight:"900",cursor:"pointer",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",boxShadow:"0 4px 16px rgba(236,72,153,0.35)"}}>
        <Sparkles size={18}/> كيف يعمل التطبيق؟ 🎯
      </button>
    )}

    <FirstUseTip tipKey="ai_audio_feature" text="🎵 يقدر تشغّل أناشيد وموسيقى دراسة أثناء تصفّح الدروس — اضغط أيقونة السماعة 🔊 أعلى النافذة."/>

    {/* لوحة الأناشيد/الموسيقى — اختيارية بالكامل، تظهر فقط لما الطالب يضغط
        أيقونة السماعة أعلى النافذة. التشغيل نفسه عالمي (يستمر حتى بعد إغلاق
        هذي النافذة، تديره عناصر <audio> وMini Player بجذر التطبيق) */}
    {showAudioPanel&&(
      <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"12px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}>🎵 أناشيد وموسيقى دراسة (اختياري)</div>
        {audioTracks?.length>0?(
          <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"160px",overflowY:"auto"}}>
            {audioTracks.map(t=>{
              const isActive = currentTrack?.id===t.id;
              return (
                <button key={t.id} onClick={()=>{
                    if(isActive){ setAudioPlaying(p=>!p); }
                    else { setCurrentTrack(t); setAudioPlaying(true); }
                  }}
                  style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"8px",border:`1px solid ${isActive?"#38bdf8":"rgba(255,255,255,0.08)"}`,backgroundColor:isActive?"rgba(56,189,248,0.12)":"rgba(0,0,0,0.2)",color:isActive?"#38bdf8":"#d4d4d8",fontSize:"12px",cursor:"pointer",textAlign:"right"}}>
                  {isActive&&audioPlaying?<Pause size={14} fill="currentColor"/>:<Play size={14} fill="currentColor"/>}
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                </button>
              );
            })}
          </div>
        ):(
          <div style={{fontSize:"12px",color:"#71717a",textAlign:"center",padding:"8px"}}>لا توجد أناشيد مضافة حالياً</div>
        )}
        {currentTrack&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"10px",paddingTop:"10px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <Volume2 size={14} color="#71717a"/>
            <input type="range" min="0" max="1" step="0.05" value={audioVolume}
              onChange={e=>setAudioVolume(Number(e.target.value))}
              style={{flex:1,height:"3px",accentColor:"#38bdf8",cursor:"pointer"}}/>
            <button onClick={()=>{setAudioPlaying(false);setCurrentTrack(null);}} title="إيقاف النشيد نهائياً" style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",flexShrink:0,display:"flex"}}>
              <X size={16}/>
            </button>
          </div>
        )}
      </div>
    )}

    <div style={{...C.infoBanner,marginBottom:"12px"}}> اسألني عن درس: <strong>{video.title}</strong></div>

    {/* اختيار أسلوب الحل — اختياري بالكامل، يبقى محفوظاً طول الجلسة لين يغيّره الطالب */}
    <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
      <button onClick={()=>setMode("full")} style={{flex:1,padding:"9px",borderRadius:"10px",border:`1px solid ${mode==="full"?"#38bdf8":"rgba(255,255,255,0.1)"}`,backgroundColor:mode==="full"?"rgba(56,189,248,0.15)":"transparent",color:mode==="full"?"#38bdf8":"#a1a1aa",fontSize:"12.5px",fontWeight:"bold",cursor:"pointer"}}>🎯 حل كامل</button>
      <button onClick={()=>setMode("step")} style={{flex:1,padding:"9px",borderRadius:"10px",border:`1px solid ${mode==="step"?"#a855f7":"rgba(255,255,255,0.1)"}`,backgroundColor:mode==="step"?"rgba(168,85,247,0.15)":"transparent",color:mode==="step"?"#c084fc":"#a1a1aa",fontSize:"12.5px",fontWeight:"bold",cursor:"pointer"}}>🪜 خطوة بخطوة</button>
    </div>

    {messages.length===0&&!loading&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
      <button onClick={()=>ask("اشرحلي هذي الشريحة بالتفصيل الكامل خطوة بخطوة")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>📖 اشرح بالتفصيل</button>
      <button onClick={()=>ask("لم أفهم هذي الفكرة، اشرحها بطريقة أبسط مع مثال جديد مختلف")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>🐣 أبسط مع مثال</button>
      <button onClick={()=>ask("ليش نستخدم هذي الخطوة أو القاعدة بالذات هنا؟")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>🤔 ليش هالخطوة؟</button>
    </div>}

    {messages.length>0&&<div style={{maxHeight:"46vh",overflowY:"auto",marginBottom:"12px",paddingLeft:"2px"}}>
      {messages.map((m,i)=>(
        m.role==="user"?(
          <div key={i} style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}>
            <div style={{maxWidth:"85%",backgroundColor:"rgba(56,189,248,0.15)",border:"1px solid rgba(56,189,248,0.25)",borderRadius:"14px 14px 4px 14px",padding:"10px 14px",fontSize:"15.5px",lineHeight:"1.7",color:"#e0f2fe"}}>{m.text}</div>
          </div>
        ):(
          <div key={i} style={{marginBottom:"14px"}}>
            <div style={{backgroundColor:"#09090b",borderRadius:"14px 14px 14px 4px",padding:"14px",border:"1px solid rgba(56,189,248,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div style={{color:"#38bdf8",fontSize:"12px",fontWeight:"bold"}}>🤖 زكي</div>
                <button onClick={()=>toggleSpeak(i,m.text)} title="استمع للشرح" style={{background:"none",border:"none",cursor:"pointer",color:speakingIdx===i?"#a855f7":"#71717a",display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",padding:"2px 4px"}}>
                  {speakingIdx===i?<><Square size={14}/> إيقاف</>:<><Volume2 size={14}/> استمع</>}
                </button>
              </div>
              <div style={{fontSize:"16.5px",color:"#e4e4e7",lineHeight:"1.85",whiteSpace:"pre-wrap"}}><MathText text={m.text} mathHighlight/></div>
              {m.isError&&(
                <button
                  onClick={()=>ask(m.lastQuestion)}
                  disabled={loading}
                  style={{marginTop:"10px",width:"100%",padding:"9px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.35)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"13px",fontWeight:"bold",cursor:loading?"default":"pointer",opacity:loading?0.6:1}}
                >
                  🔄 حاول مرة أخرى
                </button>
              )}
            </div>
          </div>
        )
      ))}
      <div ref={bottomRef}/>
    </div>}

    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner/><div style={{marginTop:"8px",fontSize:"13px",color:"#38bdf8"}}>زكي يفكّر...</div></div>}

    {!loading&&mode==="step"&&lastIsAssistant&&(
      <button onClick={()=>ask(messages[messages.length-2]?.text||"تابع من نفس الموضوع", true)} style={{...C.secondaryBtn,marginBottom:"10px",border:"1px solid rgba(168,85,247,0.35)",color:"#c084fc",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>⏭ الخطوة التالية</button>
    )}

    <textarea rows={3} value={q} onChange={e=>setQ(e.target.value)} placeholder="اكتب سؤالك هنا..." style={{...C.input,resize:"none",marginBottom:"10px",fontSize:"15.5px"}}/>
    <button onClick={()=>ask()} disabled={loading||!q.trim()||cooldown>0} style={{...C.primaryBtn,opacity:(q.trim()&&cooldown===0)?1:0.5,marginBottom:0}}>
      <Bot size={16}/> {cooldown>0?`انتظر ${cooldown} ثانية...`:"أرسل السؤال"}
    </button>
  </div></div>;
}

// ─── SHARE MODAL ─────────────────────────────────────────
function ShareModal({onClose,video}) {
  const link="https://edutok-neon.vercel.app/v/"+video.id;
  return <div style={C.overlay}><div style={C.modalBox}>
    <MHead icon={<Share2 size={20} color="#38bdf8"/>} title="مشاركة الدرس" onClose={onClose}/>
    <div style={{...C.card,marginBottom:"14px"}}><div style={{fontWeight:"bold",fontSize:"13px",marginBottom:"4px"}}>{video.title}</div><div style={{fontSize:"12px",color:"#71717a"}}>{link}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
      {[["واتساب","#25D366"],["تيليغرام","#229ED9"],["نسخ الرابط","#6366f1"],["المزيد","#f97316"]].map(([n,c])=>(
        <button key={n} onClick={()=>{if(n==="نسخ الرابط")navigator.clipboard?.writeText(link);onClose();}} style={{padding:"12px",borderRadius:"12px",border:"none",backgroundColor:c,color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>{n}</button>
      ))}
    </div>
  </div></div>;
}

// ─── CHAT MODAL ──────────────────────────────────────────
const REACTION_EMOJIS = ["👍","❤️","🤔"];

function ChatModal({onClose, currentStudent, role, subject}) {
  const [msg,setMsg]=useState("");
  const [msgs,setMsgs]=useState([]);
  const [sending,setSending]=useState(false);
  const [chatEnabled,setChatEnabled]=useState(true);
  const [isQuestion,setIsQuestion]=useState(false);
  const [replyingTo,setReplyingTo]=useState(null); // {id,name,text}
  const bottomRef=useRef(null);
  const roomSubject = subject || "عام";
  const myAccount = role==="admin" ? "admin" : (currentStudent?.account||"");

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
      else setChatEnabled(true);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(
      query(collection(db,"chat"), where("subject","==",roomSubject), orderBy("sentAt","asc")),
      snap=>{ setMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))); }
    );
    return ()=>unsub();
  },[roomSubject]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[msgs]);

  const send=async()=>{
    if(!msg.trim()||sending) return;
    setSending(true);
    try{
      const name = role==="admin" ? "المدير" : (currentStudent?.name||"طالب");
      const account = myAccount;
      const payload = {
        text:msg.trim(), name, account,
        from: role==="admin"?"admin":"student",
        subject: roomSubject,
        isQuestion,
        sentAt:serverTimestamp()
      };
      if(replyingTo) payload.replyTo = {id:replyingTo.id, name:replyingTo.name, text:replyingTo.text.slice(0,80)};
      await addDoc(collection(db,"chat"), payload);
      setMsg(""); setIsQuestion(false); setReplyingTo(null);
    }catch(e){console.error(e);}
    setSending(false);
  };

  const toggleReaction=async(m,emoji)=>{
    if(!myAccount) return;
    const already = (m.reactions?.[emoji]||[]).includes(myAccount);
    try{
      await updateDoc(doc(db,"chat",m.id),{
        [`reactions.${emoji}`]: already ? arrayRemove(myAccount) : arrayUnion(myAccount)
      });
    }catch(e){console.error(e);}
  };

  const markBestAnswer=async(question,reply)=>{
    try{
      await updateDoc(doc(db,"chat",question.id),{bestAnswerId:reply.id});
      showMsg("⭐ تم اعتماد أفضل إجابة");
    }catch(e){console.error(e);}
  };

  const canMarkBest=(question)=> role==="admin" || question.account===myAccount;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.2)",display:"flex",flexDirection:"column",maxHeight:"85vh"}}>
    <MHead icon={<MessageCircle size={20} color="#a855f7"/>} title={"نقاش: "+roomSubject} color="#a855f7" onClose={onClose}/>

    {/* النقاش موقوف */}
    {!chatEnabled&&role!=="admin"&&(
      <div style={{textAlign:"center",padding:"24px",backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"12px",marginBottom:"12px"}}>
        <div style={{fontSize:"28px",marginBottom:"8px"}}>🔕</div>
        <div style={{fontWeight:"bold",color:"#f87171",marginBottom:"4px"}}>النقاش موقوف مؤقتاً</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>قام المدير بإيقاف غرفة النقاش</div>
      </div>
    )}

    <div style={{flex:1,backgroundColor:"#09090b",borderRadius:"12px",padding:"12px",marginBottom:"12px",overflowY:"auto",minHeight:"200px",maxHeight:"340px"}}>
      {msgs.length===0&&<div style={{textAlign:"center",color:"#52525b",fontSize:"13px",padding:"20px"}}>لا توجد رسائل بعد بهذه المادة — كن أول من يكتب!</div>}
      {msgs.map((m,i)=>{
        const isMe = m.account===myAccount;
        return (
          <div key={m.id||i} style={{display:"flex",gap:"8px",marginBottom:"12px",justifyContent:isMe?"flex-end":"flex-start"}}>
            {!isMe&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><User size={14} color="#fff"/></div>}
            <div style={{maxWidth:"78%"}}>
              {m.replyTo&&<div style={{fontSize:"10px",color:"#a1a1aa",backgroundColor:"rgba(255,255,255,0.04)",borderRight:"2px solid rgba(168,85,247,0.4)",padding:"3px 8px",borderRadius:"6px",marginBottom:"3px"}}>↩ {m.replyTo.name}: {m.replyTo.text}</div>}
              <div style={{backgroundColor:isMe?"rgba(168,85,247,0.2)":m.from==="admin"?"rgba(251,191,36,0.1)":"#1c1c1e",borderRadius:"10px",padding:"8px 12px",border:m.from==="admin"?"1px solid rgba(251,191,36,0.3)":m.isQuestion?"1px solid rgba(56,189,248,0.35)":"none"}}>
                <div style={{fontSize:"10px",color:m.from==="admin"?"#fbbf24":"#71717a",marginBottom:"2px",fontWeight:"bold",display:"flex",alignItems:"center",gap:"5px"}}>
                  {m.name}{m.account&&m.from!=="admin"?" @"+m.account:""}
                  {m.isQuestion&&<span style={{color:"#38bdf8",fontSize:"9px",fontWeight:"bold"}}>❓ سؤال</span>}
                </div>
                <div style={{fontSize:"13px",color:"#fff"}}>{m.text}</div>
                {m.bestAnswerId&&<div style={{fontSize:"10px",color:"#4ade80",marginTop:"4px",fontWeight:"bold"}}>⭐ تم اعتماد إجابة لهذا السؤال</div>}
              </div>
              {/* أزرار التفاعل والرد */}
              <div style={{display:"flex",gap:"6px",marginTop:"3px",flexWrap:"wrap",alignItems:"center"}}>
                {REACTION_EMOJIS.map(em=>{
                  const users=m.reactions?.[em]||[];
                  const mine=users.includes(myAccount);
                  return (
                    <button key={em} onClick={()=>toggleReaction(m,em)} style={{fontSize:"11px",padding:"2px 6px",borderRadius:"8px",border:mine?"1px solid rgba(168,85,247,0.5)":"1px solid rgba(255,255,255,0.08)",backgroundColor:mine?"rgba(168,85,247,0.15)":"transparent",color:"#cbd5e1",cursor:"pointer"}}>{em}{users.length>0?" "+users.length:""}</button>
                  );
                })}
                <button onClick={()=>setReplyingTo({id:m.id,name:m.name,text:m.text})} style={{fontSize:"11px",color:"#818cf8",background:"none",border:"none",cursor:"pointer"}}>↩ رد</button>
                {/* زر اعتماد كأفضل إجابة: يظهر على أي رد لسؤال يملكه صاحبه أو المدير */}
                {(()=>{
                  if(!m.replyTo) return null;
                  const question = msgs.find(q=>q.id===m.replyTo.id);
                  if(!question || !canMarkBest(question) || question.bestAnswerId===m.id) return null;
                  return <button onClick={()=>markBestAnswer(question,m)} style={{fontSize:"11px",color:"#fbbf24",background:"none",border:"none",cursor:"pointer"}}>⭐ اعتماد كأفضل إجابة</button>;
                })()}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef}/>
    </div>

    {/* معاينة الرد قبل الإرسال */}
    {replyingTo&&<div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:"8px",padding:"6px 10px",marginBottom:"8px",fontSize:"11px"}}>
      <span style={{flex:1,color:"#cbd5e1"}}>↩ رد على {replyingTo.name}: {replyingTo.text.slice(0,50)}</span>
      <button onClick={()=>setReplyingTo(null)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"14px"}}>✕</button>
    </div>}

    {/* حقل الإرسال — يُعطَّل للطلاب لما النقاش موقوف */}
    {(chatEnabled||role==="admin")&&<div>
      <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"#a1a1aa",marginBottom:"6px",cursor:"pointer"}}>
        <input type="checkbox" checked={isQuestion} onChange={e=>setIsQuestion(e.target.checked)}/> علّم هذه الرسالة كسؤال ❓
      </label>
      <div style={{display:"flex",gap:"8px"}}>
        <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="اكتب رسالتك..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
        <button onClick={send} disabled={sending||!msg.trim()} style={{padding:"10px 14px",backgroundColor:"#a855f7",border:"none",borderRadius:"10px",color:"#fff",cursor:"pointer",fontWeight:"bold",opacity:sending||!msg.trim()?0.5:1}}>إرسال</button>
      </div>
    </div>}
  </div></div>;
}

// ─── PDF MODAL ───────────────────────────────────────────
function PDFModal({onClose, studentStage, studentGrade, globalPrices, mySubscriptions, onWallet, isAdmin}) {
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [downloadEnabled,setDownloadEnabled]=useState(true);
  const [searchText,setSearchText]=useState("");

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"pdfs"),snap=>{setFiles(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(doc(db,"settings","pdfDownload"),snap=>{
      if(snap.exists()) setDownloadEnabled(snap.data().enabled!==false);
      else setDownloadEnabled(true);
    });
    return ()=>{ u1(); u2(); };
  },[]);

  const goToWallet = () => { onWallet && onWallet(); };

  // المدير يرى كل شيء بدون قيود
  if(isAdmin){
    const adminFiltered = files.filter(f=>{
      if(!searchText.trim()) return true;
      const q=searchText.trim();
      return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
    });
    return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    {files.length>0&&<input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملف أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :adminFiltered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>{files.length===0?"لا توجد ملفات بعد":"لا توجد نتائج"}</div></div>
      :adminFiltered.map(f=>(
        <div key={f.id} style={{...C.card}}>
          <div style={{marginBottom:"8px"}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <a href={f.url} target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>قراءة 👁</a>
            <a href={f.url} download target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(249,115,22,0.3)",backgroundColor:"rgba(249,115,22,0.15)",color:"#f97316",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>تحميل ⬇</a>
          </div>
        </div>
      ))
    }
  </div></div>;
  }

  // الطالب: التحقق من السعر والاشتراك
  const pdfFree = isFreeSubject(globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  const pdfSubscribed = hasAccess(mySubscriptions, globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  // يمكن القراءة: مجاني أو مشترك
  const canRead = pdfFree || pdfSubscribed;
  // يمكن التحميل: يمكن القراءة + التحميل مسموح من الإدارة
  const canDownload = canRead && downloadEnabled;
  const myFiles = files.filter(f=>{
    if(f.stage && f.stage!==studentStage) return false;
    if(f.grade && studentGrade && f.grade!==studentGrade) return false;
    return true;
  });
  const myFilesFiltered = myFiles.filter(f=>{
    if(!searchText.trim()) return true;
    const q=searchText.trim();
    return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
  });

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"10px",textAlign:"center"}}>
      المرحلة: <strong style={{color:"#f97316"}}>{studentStage}</strong>
    </div>

    {myFiles.length>1&&<input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملزمة أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>}

    {/* غير مؤهل للقراءة */}
    {!canRead&&(
      <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"4px"}}>محتوى مدفوع</div>
        <div style={{color:"#71717a",fontSize:"12px",marginBottom:"10px"}}>اشترك للوصول لملازم {studentStage}</div>
        <button onClick={goToWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"10px",padding:"8px 20px",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>اشترك الآن عبر زين كاش</button>
      </div>
    )}

    {/* التحميل موقوف من الإدارة */}
    {canRead&&!downloadEnabled&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#f87171",textAlign:"center"}}>
        🔒 التحميل موقوف مؤقتاً من قبل المدير
      </div>
    )}

    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :myFilesFiltered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>{myFiles.length===0?"لا توجد ملازم لمرحلتك بعد":"لا توجد نتائج مطابقة للبحث"}</div></div>
      :myFilesFiltered.map(f=>(
        <div key={f.id} style={{...C.card}}>
          <div style={{marginBottom:"8px"}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div>
          </div>
          {!canRead
            // غير مؤهل → اشترك
            ?<button onClick={goToWallet} style={{width:"100%",padding:"8px",borderRadius:"8px",border:"1px solid rgba(234,179,8,0.3)",backgroundColor:"rgba(234,179,8,0.1)",color:"#fbbf24",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>اشترك للوصول</button>
            :<div style={{display:"flex",gap:"8px"}}>
              {/* زر القراءة مع العلامة المائية */}
              <a href={f.url} target="_blank" rel="noreferrer" onClick={()=>{
                if(f.watermark){showMsg("💧 هذه الملزمة محمية بعلامة مائية");}
              }} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>
                قراءة 👁{f.watermark?" 💧":""}
              </a>
              {/* زر التحميل — حسب الإعداد العام + إعداد الملف */}
              {canDownload && !f.downloadBlocked
                ?<a href={f.url} download target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(249,115,22,0.3)",backgroundColor:"rgba(249,115,22,0.15)",color:"#f97316",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>تحميل ⬇</a>
                :<span style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.08)",backgroundColor:"rgba(255,255,255,0.04)",color:"#52525b",fontSize:"12px",textAlign:"center"}}>موقوف 🔒</span>
              }
            </div>
          }
        </div>
      ))
    }
  </div></div>;
}

// ─── SOLVE MODAL ─────────────────────────────────────────
function SolveModal({onClose,video}) {
  const [tab,setTab]=useState("text");
  const [q,setQ]=useState("");
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [ans,setAns]=useState("");
  const [loading,setLoading]=useState(false);

  const handleImageFile=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const full=ev.target.result;
      setImgPreview(full);
      setImgB64(full.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const KATEX_RULE = " قاعدة إلزامية بصيغة الكتابة: أي رمز أو معادلة رياضية يجب إحاطتها بعلامتي $ من الطرفين وكتابتها بصيغة LaTeX (مثال: $x^2$ للأس، $\\frac{1}{2}$ للكسر، $\\sqrt{x}$ للجذر). أي معادلة أو رمز كيميائي يجب كتابته داخل $\\ce{...}$ (مثال: $\\ce{H2O}$). لا تكتب أي رمز رياضي أو كيميائي كنص عادي خارج هذه العلامات. ممنوع استخدام صيغة \\[ ... \\] أو \\( ... \\) نهائياً تحت أي ظرف — استخدم $...$ فقط دائماً.";

  const solve=async()=>{
    setLoading(true); setAns("");
    try{
      let r;
      if(tab==="text"){
        r=await callAI("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". السؤال: "+q+". حله خطوة بخطوة بالعربية."+KATEX_RULE);
      } else {
        if(!imgB64){setAns("يرجى رفع صورة أولاً.");setLoading(false);return;}
        r=await callAI("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". انظر للصورة وحل هذا السؤال خطوة بخطوة بالعربية."+KATEX_RULE,imgB64);
      }
      setAns(r||"لم أتمكن من الإجابة.");
    }catch(e){setAns(" خطأ: "+e.message);}
    setLoading(false);
  };

  const canSolve=tab==="text"?q.trim():imgB64;
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(52,211,153,0.2)"}}>
    <MHead icon={<Camera size={20} color="#34d399"/>} title="حل الأسئلة الذكي" color="#34d399" onClose={onClose}/>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <button onClick={()=>setTab("text")} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:tab==="text"?"#34d399":"#27272a",color:tab==="text"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}> اكتب السؤال</button>
      <button onClick={()=>setTab("img")} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:tab==="img"?"#34d399":"#27272a",color:tab==="img"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}> صوّر السؤال</button>
    </div>
    {tab==="text"&&<textarea rows={4} value={q} onChange={e=>setQ(e.target.value)} placeholder="مثال: احسب مساحة مثلث قاعدته 6سم وارتفاعه 4سم" style={{...C.input,resize:"none"}}/>}
    {tab==="img"&&(
      <div style={{marginBottom:"12px"}}>
        {imgPreview&&<img src={imgPreview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
        <label style={{display:"block",width:"100%",padding:"14px",backgroundColor:"rgba(52,211,153,0.08)",border:"2px dashed rgba(52,211,153,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
          <Camera size={26} color="#34d399" style={{margin:"0 auto 6px"}}/>
          <div style={{fontSize:"13px",color:"#34d399",fontWeight:"bold"}}>{imgPreview?"تغيير الصورة":"صوّر السؤال أو اختره من المعرض"}</div>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImageFile}/>
        </label>
      </div>
    )}
    {ans&&<div style={{backgroundColor:"#09090b",borderRadius:"12px",padding:"14px",fontSize:"14px",color:"#e4e4e7",lineHeight:"1.8",marginBottom:"14px",border:"1px solid rgba(52,211,153,0.15)",whiteSpace:"pre-wrap",maxHeight:"240px",overflowY:"auto"}}><div style={{color:"#34d399",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}> الحل:</div><MathText text={ans}/></div>}
    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#34d399"/><div style={{marginTop:"8px",fontSize:"13px",color:"#34d399"}}>جارٍ الحل...</div></div>}
    {!ans&&!loading&&<button onClick={solve} disabled={!canSolve} style={{...C.purpleBtn,background:canSolve?"linear-gradient(to right,#059669,#34d399)":"#27272a",opacity:canSolve?1:0.5}}><Bot size={16}/> حل السؤال بالذكاء الاصطناعي</button>}
    {ans&&<div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setAns("");setQ("");setImgB64(null);setImgPreview(null);}} style={C.cancelBtn}>سؤال جديد</button><button onClick={onClose} style={C.saveBtn}>إغلاق </button></div>}
  </div></div>;
}

// ─── SEARCH MODAL ────────────────────────────────────────
// ─── BROWSE MODAL ────────────────────────────────────────
function BrowseModalContent({onClose, clips, globalPrices, onBrowse, role, examScores}) {
  const [step,setStep]=useState("stage");
  const [selStage,setSelStage]=useState("");
  const [selGrade,setSelGrade]=useState("");
  const [selSubject,setSelSubject]=useState("");
  const [searchQuery,setSearchQuery]=useState("");

  const availableSubjects = React.useMemo(()=>{
    if(!selStage||!selGrade) return [];
    const subjs=new Set();
    // نعرض فقط المواد المحدد لها نفس الصف تحديداً (مو كل المرحلة) — كل مادة معنونة لصفها الفعلي
    clips.forEach(c=>{ if(c.stage===selStage&&c.grade===selGrade) subjs.add(c.subject); });
    return [...subjs].sort();
  },[clips,selStage,selGrade]);

  const availableTopics = React.useMemo(()=>{
    if(!selStage||!selGrade||!selSubject) return [];
    // نرتب الفصول حسب تسلسلها الفعلي بالمنهج (أصغر رقم مقطع بكل فصل)، مو أبجدياً
    const topicMinNum={};
    clips.forEach(c=>{
      if(c.stage===selStage&&c.grade===selGrade&&c.subject===selSubject&&c.topic){
        const n=Number(c.num||0);
        if(!(c.topic in topicMinNum) || n<topicMinNum[c.topic]) topicMinNum[c.topic]=n;
      }
    });
    return Object.keys(topicMinNum).sort((a,b)=>topicMinNum[a]-topicMinNum[b]);
  },[clips,selStage,selGrade,selSubject]);

  // بحث سريع عبر كل المقاطع (بغض النظر عن الخطوة الحالية) — بالاسم أو المادة أو المعلم أو الفصل
  const searchResults = React.useMemo(()=>{
    const q=searchQuery.trim();
    if(!q) return [];
    // نجمّع نتائج البحث حسب "فصل" فريد (مادة+مرحلة+فصل)، عشان ما نكرر نفس الفصل لعدة مقاطع
    const seen=new Set();
    const results=[];
    clips.forEach(c=>{
      const hit = c.title?.includes(q)||c.subject?.includes(q)||c.teacher?.includes(q)||c.topic?.includes(q);
      if(!hit) return;
      const key = c.subject+"__"+c.stage+"__"+(c.topic||"");
      if(seen.has(key)) return;
      seen.add(key);
      results.push(c);
    });
    return results.slice(0,30);
  },[clips,searchQuery]);

  const stageEmoji={"الابتدائية":"🏫","المتوسطة":"📚","الإعدادية":"🎓"};

  return <>
    {/* بحث سريع — يبحث بالمادة أو المعلم أو الفصل أو اسم المقطع، بغض النظر عن خطوة التصفح الحالية */}
    <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="ابحث بالمادة أو المعلم أو الفصل..." style={{...C.input,marginBottom:searchQuery.trim()?"10px":"14px"}}/>

    {searchQuery.trim()?(
      <div>
        {searchResults.length===0
          ?<div style={{textAlign:"center",padding:"20px",color:"#52525b",fontSize:"13px"}}>لا توجد نتائج مطابقة</div>
          :searchResults.map((c,i)=>{
            const isFree=isFreeSubject(globalPrices,c.subject,c.stage);
            return <div key={i} onClick={()=>{onBrowse(c.subject,c.stage,c.grade||"",c.topic||"",isFree);onClose();}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:`1px solid ${isFree?"rgba(52,211,153,0.2)":"rgba(129,140,248,0.2)"}`}}>
              <div style={{width:"40px",height:"40px",borderRadius:"10px",background:"rgba(129,140,248,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><BookOpen size={17} color="#818cf8"/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:"bold",fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.topic||c.title}</div>
                <div style={{fontSize:"11px",color:"#71717a"}}>{c.subject} • {c.stage}{c.grade?" • الصف "+c.grade:""}{c.teacher?" • "+c.teacher:""}</div>
              </div>
              <span style={{color:isFree?"#34d399":"#818cf8",fontSize:"16px",flexShrink:0}}>←</span>
            </div>;
          })
        }
      </div>
    ):<>

    {/* خبز الفتات */}
    {selStage&&<div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"14px",fontSize:"12px",flexWrap:"wrap"}}>
      <span style={{color:"#818cf8",cursor:"pointer"}} onClick={()=>{setStep("stage");setSelStage("");setSelGrade("");setSelSubject("");}}>المراحل</span>
      {selStage&&<><span style={{color:"#52525b"}}>←</span>
        <span style={{color:selGrade?"#818cf8":"#fff",cursor:selGrade?"pointer":"default"}}
          onClick={()=>{if(selGrade){setStep("grade");setSelGrade("");setSelSubject("");}}}>{selStage}</span></>}
      {selGrade&&<><span style={{color:"#52525b"}}>←</span>
        <span style={{color:selSubject?"#818cf8":"#fff",cursor:selSubject?"pointer":"default"}}
          onClick={()=>{if(selSubject){setStep("subject");setSelSubject("");}}}>الصف {selGrade}</span></>}
      {selSubject&&<><span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{selSubject}</span></>}
    </div>}

    {/* خطوة ١: المرحلة */}
    {step==="stage"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المرحلة الدراسية</div>
      {STAGES.map(s=>(
        <div key={s} onClick={()=>{setSelStage(s);setStep("grade");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(129,140,248,0.2)"}}>
          <span style={{fontSize:"32px"}}>{stageEmoji[s]||"📖"}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:"bold",fontSize:"15px"}}>{s}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{clips.filter(c=>c.stage===s).length} مقطع</div>
          </div>
          <span style={{color:"#818cf8",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* خطوة ٢: الصف */}
    {step==="grade"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الصف الدراسي</div>
      {(GRADES[selStage]||["الأول","الثاني","الثالث"]).map((g,i)=>{
        const count=clips.filter(c=>c.stage===selStage&&c.grade===g).length;
        return <div key={g} onClick={()=>{setSelGrade(g);setStep("subject");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(129,140,248,0.2)"}}>
          <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:"bold",fontSize:"15px"}}>الصف {g}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{count} مقطع</div>
          </div>
          <span style={{color:"#818cf8",fontSize:"18px"}}>←</span>
        </div>;
      })}
    </div>}

    {/* خطوة ٣: المادة */}
    {step==="subject"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المادة</div>
      {availableSubjects.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}>لا توجد مواد لهذا الصف</div>
        :availableSubjects.map(subj=>{
          const isFree=isFreeSubject(globalPrices,subj,selStage);
          const count=clips.filter(c=>c.stage===selStage&&c.subject===subj).length;
          const hasTopics=clips.some(c=>c.stage===selStage&&c.subject===subj&&c.topic);
          return <div key={subj} onClick={()=>{setSelSubject(subj);setStep("topic");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:`1px solid ${isFree?"rgba(52,211,153,0.3)":"rgba(129,140,248,0.2)"}`}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:isFree?"linear-gradient(135deg,#059669,#34d399)":"linear-gradient(135deg,#4f46e5,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <BookOpen size={20} color="#fff"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{subj}</div>
              <div style={{fontSize:"11px",color:"#71717a"}}>{count} مقطع • {isFree?"🆓 مجاني":"💰 مدفوع"}{hasTopics?" • فيها مباحث":""}</div>
            </div>
            <span style={{color:isFree?"#34d399":"#818cf8",fontSize:"18px"}}>←</span>
          </div>;
        })
      }
    </div>}

    {/* خطوة ٤: الفصل */}
    {step==="topic"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الفصل</div>
      <div onClick={()=>{const isFree=isFreeSubject(globalPrices,selSubject,selStage);onBrowse(selSubject,selStage,selGrade,"",isFree);onClose();}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(56,189,248,0.3)"}}>
        <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"20px"}}>📋</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:"bold",fontSize:"14px"}}>كل الفصول</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>جميع مقاطع {selSubject}</div>
        </div>
        <span style={{color:"#38bdf8",fontSize:"18px"}}>←</span>
      </div>
      {availableTopics.length===0
        ?<div style={{textAlign:"center",padding:"16px",color:"#52525b",fontSize:"12px"}}>لا توجد فصول محددة — اضغط "كل الفصول" أعلاه</div>
        :availableTopics.map((topic,i)=>{
          const isFree=isFreeSubject(globalPrices,selSubject,selStage);
          const count=clips.filter(c=>c.stage===selStage&&c.subject===selSubject&&c.topic===topic).length;
          // الفصل مقفول إذا كان الطالب لم يجتز امتحان الفصل الذي يسبقه بالتسلسل (الفصل الأول دائماً مفتوح)
          const prevTopic = i>0 ? availableTopics[i-1] : null;
          const locked = role==="student" && prevTopic && !examScores?.[topicKey(selSubject,selStage,prevTopic)]?.passed;
          return <div key={topic} onClick={()=>{
            if(locked){ showMsg("🔒 يجب اجتياز امتحان فصل \""+prevTopic+"\" أولاً بنسبة 60% على الأقل"); return; }
            onBrowse(selSubject,selStage,selGrade,topic,isFree);onClose();
          }} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",opacity:locked?0.55:1,border:`1px solid ${locked?"rgba(255,255,255,0.08)":isFree?"rgba(52,211,153,0.2)":"rgba(129,140,248,0.2)"}`}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:locked?"rgba(255,255,255,0.05)":"rgba(129,140,248,0.15)",border:`1px solid ${locked?"rgba(255,255,255,0.1)":"rgba(129,140,248,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"16px",fontWeight:"bold",color:locked?"#71717a":"#818cf8"}}>
              {locked?<Lock size={16}/>:i+1}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px",color:locked?"#71717a":"#fff"}}>{topic}</div>
              <div style={{fontSize:"11px",color:locked?"#f87171":"#71717a"}}>{locked?"🔒 يتطلب اجتياز امتحان الفصل السابق":count+" مقطع • "+(isFree?"🆓 كامل":"💰 أول 5 + عشوائي")}</div>
            </div>
            {!locked&&<span style={{color:isFree?"#34d399":"#818cf8",fontSize:"18px"}}>←</span>}
          </div>;
        })
      }
    </div>}
    </>}
  </>;
}

function SearchModalContent({onClose,allVideos,onSelectVideo,clips,examScores,role}) {
  const [q,setQ]=useState("");
  // رقم الصفحة قد يكون مدى ("120-121")، فنتحقق رقمياً هل رقم البحث يقع ضمن
  // المدى، أو يطابق رقم صفحة مفردة تطابقاً دقيقاً — عمداً بدون أي مطابقة نصية
  // جزئية (Substring) على الأرقام، لأنها كانت تسبب نتائج خاطئة (بحث "16" كان
  // يطابق أي رقم يحتوي "16" بأي مكان منه، مثل 160 و165 و216... إلخ)
  const matchesPage = (pageStr, query) => {
    if(!pageStr) return false;
    const p = String(pageStr).trim();
    if(p===query) return true; // مطابقة نصية دقيقة كاملة (يغطي مدى مكتوب بالكامل زي "120-121")
    const qNum = Number(query);
    if(!Number.isFinite(qNum)) return false; // البحث نفسه مو رقم، ما ينفع يطابق صفحة أصلاً
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if(range){ const [,a,b]=range; return qNum>=Number(a)&&qNum<=Number(b); }
    return Number(p)===qNum;
  };
  // نقسّم نص البحث لكلمات منفصلة، وكل كلمة لازم تطابق حقل واحد على الأقل
  // (عنوان/مادة/معلم/صف/صفحة) — يعني البحث "الرياضيات 100" يشترط وجود
  // "الرياضيات" بمكان ما (المادة مثلاً) و"100" بمكان ما (رقم الصفحة) بنفس
  // النتيجة، مو بحث عن الجملة الكاملة كنص واحد حرفي
  const terms = q.trim().split(/\s+/).filter(Boolean);
  const matchesTerm = (v, term) =>
    v.title?.includes(term)||v.subject?.includes(term)||v.teacher?.includes(term)||v.grade?.includes(term)||matchesPage(v.page,term);
  const filtered=allVideos.map((v,idx)=>({...v,_idx:idx})).filter(v=>
    terms.length===0 || terms.every(t=>matchesTerm(v,t))
  );

  // ─── فحص قفل الفصل — بنفس منطق تبويب "تصفح" بالضبط (ما ينفع نتيجة بحث
  // تتجاوز نظام القفل، وإلا صار البحث ثغرة يلتف فيها الطالب على شرط اجتياز
  // امتحان الفصل السابق بنسبة 60% قبل ما يفتح الفصل التالي) ───────────────
  // نحسب ترتيب الفصول الفعلي (بأصغر رقم مقطع بكل فصل) لكل مادة+مرحلة+صف على
  // حدة، مرة وحدة بس، ونعيد استخدامه لكل نتائج البحث
  const topicOrderMap = React.useMemo(()=>{
    if(!clips) return {};
    const map={}; // "subject__stage__grade" -> [topics بالترتيب]
    const minNum={};
    clips.forEach(c=>{
      if(!c.topic) return;
      const key = c.subject+"__"+c.stage+"__"+(c.grade||"");
      const n = Number(c.num||0);
      if(!minNum[key]) minNum[key]={};
      if(!(c.topic in minNum[key]) || n<minNum[key][c.topic]) minNum[key][c.topic]=n;
    });
    Object.keys(minNum).forEach(key=>{
      map[key] = Object.keys(minNum[key]).sort((a,b)=>minNum[key][a]-minNum[key][b]);
    });
    return map;
  },[clips]);

  const getLockInfo = (v) => {
    if(role!=="student"||!v.topic) return {locked:false};
    const key = v.subject+"__"+v.stage+"__"+(v.grade||"");
    const topics = topicOrderMap[key]||[];
    const idx = topics.indexOf(v.topic);
    if(idx<=0) return {locked:false}; // أول فصل، أو فصل غير مصنّف بترتيب — مفتوح دائماً
    const prevTopic = topics[idx-1];
    const locked = !examScores?.[topicKey(v.subject,v.stage,prevTopic)]?.passed;
    return {locked, prevTopic};
  };

  return <>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن درس أو مادة أو معلم أو رقم صفحة..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
    </div>
    {q&&<div style={{fontSize:"11px",color:"#71717a",marginBottom:"8px"}}>{filtered.length} نتيجة</div>}
    {filtered.slice(0,20).map((v,i)=>{
      const {locked,prevTopic} = getLockInfo(v);
      return (
        <div key={i} onClick={()=>{
            if(locked){ showMsg("🔒 يجب اجتياز امتحان فصل \""+prevTopic+"\" أولاً بنسبة 60% على الأقل"); return; }
            onSelectVideo(v._idx,v);onClose();
          }} style={{display:"flex",alignItems:"center",gap:"10px",...C.card,cursor:"pointer",marginBottom:"6px",opacity:locked?0.55:1,border:locked?"1px solid rgba(255,255,255,0.08)":undefined}}>
          <div style={{width:36,height:36,borderRadius:"8px",background:locked?"rgba(255,255,255,0.05)":(v.bg||"linear-gradient(135deg,#1e1b4b,#312e81)"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {locked?<Lock size={15} color="#71717a"/>:v.type==="شرائح AI"?<Layers size={16} color="#c4b5fd"/>:<Film size={16} color="#fff"/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:locked?"#71717a":"#fff"}}>{v.num?`#${v.num} `:""}{v.title}</div>
            <div style={{fontSize:"11px",color:locked?"#f87171":"#71717a"}}>{locked?"🔒 يتطلب اجتياز امتحان الفصل السابق":`${v.subject} • ${v.stage}${v.grade?` • الصف ${v.grade}`:""}${v.page?` • صفحة ${v.page}`:""}`}</div>
          </div>
          {!locked&&<div style={{fontSize:"10px",color:"#38bdf8",flexShrink:0}}>انتقال ←</div>}
        </div>
      );
    })}
    {filtered.length===0&&q&&<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Search size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد نتائج لـ "{q}"</div></div>}
  </>;
}

// ─── SAVED MODAL ─────────────────────────────────────────
// ─── BROWSE + SEARCH MODAL (دمج زري "تصفح" و"البحث" بنافذة واحدة) ───
// الاثنين مختلفان بالوظيفة فعلياً: "تصفح" ينتقل خطوة بخطوة (مرحلة→صف→مادة→فصل)
// ويودّي لبداية الفصل، بينما "بحث دقيق" يوديك مباشرة لمقطع/شريحة محددة بالضبط
// (بما فيها البحث برقم الصفحة). عشان كذا نحافظ عليهم منفصلين تماماً كتبويبين
// داخليين بدل خلط منطقهم، بس بزر دخول واحد بمكان زرين منفصلين سابقاً.
function BrowseSearchModal({onClose, clips, globalPrices, onBrowse, role, examScores, allVideos, onSelectVideo}) {
  const [tab,setTab]=useState("browse"); // "browse" | "search"
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(99,102,241,0.3)"}}>
    <MHead icon={tab==="browse"?<BookOpen size={20} color="#818cf8"/>:<Search size={20} color="#38bdf8"/>} title={tab==="browse"?"تصفح المواد":"بحث دقيق"} color={tab==="browse"?"#818cf8":"#38bdf8"} onClose={onClose}/>

    {/* تبويبان — يحافظان على الوظيفتين منفصلتين تماماً بدون أي خلط بمنطقهما */}
    <div style={{display:"flex",gap:"6px",marginBottom:"14px",backgroundColor:"rgba(255,255,255,0.03)",borderRadius:"10px",padding:"4px"}}>
      <button onClick={()=>setTab("browse")} style={{flex:1,padding:"8px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"bold",backgroundColor:tab==="browse"?"rgba(129,140,248,0.18)":"transparent",color:tab==="browse"?"#818cf8":"#71717a"}}>
        <BookOpen size={13} style={{verticalAlign:"middle",marginLeft:"4px"}}/> تصفح بالتصنيف
      </button>
      <button onClick={()=>setTab("search")} style={{flex:1,padding:"8px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"bold",backgroundColor:tab==="search"?"rgba(56,189,248,0.18)":"transparent",color:tab==="search"?"#38bdf8":"#71717a"}}>
        <Search size={13} style={{verticalAlign:"middle",marginLeft:"4px"}}/> بحث دقيق (بالصفحة)
      </button>
    </div>

    {tab==="browse"
      ?<BrowseModalContent onClose={onClose} clips={clips} globalPrices={globalPrices} onBrowse={onBrowse} role={role} examScores={examScores}/>
      :<SearchModalContent onClose={onClose} allVideos={allVideos} onSelectVideo={onSelectVideo} clips={clips} examScores={examScores} role={role}/>
    }
  </div></div>;
}

function SavedModal({onClose,saved,video}) {
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,211,238,0.2)"}}>
    <MHead icon={<Bookmark size={20} color="#22d3ee"/>} title="المحفوظات" color="#22d3ee" onClose={onClose}/>
    {saved?<div style={{display:"flex",alignItems:"center",gap:"10px",...C.card,border:"1px solid rgba(34,211,238,0.2)"}}><Bookmark size={18} color="#22d3ee" fill="#22d3ee"/><div><div style={{fontSize:"13px",fontWeight:"bold"}}>{video.title}</div><div style={{fontSize:"11px",color:"#71717a"}}>{video.subject}</div></div></div>
    :<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Bookmark size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div style={{fontSize:"14px"}}>لا توجد مقاطع محفوظة بعد</div></div>}
  </div></div>;
}

// ─── NOTIFICATIONS MODAL (للطالب) ────────────────────────
function NotificationsModal({onClose,notifications}) {
  const formatTime=(ts)=>{
    if(!ts?.seconds) return "";
    try{ return new Date(ts.seconds*1000).toLocaleString("ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
    catch{ return ""; }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)"}}>
    <MHead icon={<Bell size={20} color="#38bdf8"/>} title="الإشعارات" color="#38bdf8" onClose={onClose}/>
    {notifications.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Bell size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div style={{fontSize:"14px"}}>لا توجد إشعارات حتى الآن</div></div>
      :notifications.map((n,i)=>(
        <div key={n.id||i} style={{...C.card,border:n.targetPhone?"1px solid rgba(168,85,247,0.25)":"1px solid rgba(56,189,248,0.15)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"4px"}}>
            <div style={{fontWeight:"bold",fontSize:"14px"}}>{n.title}</div>
            {n.targetPhone&&<span style={{backgroundColor:"rgba(168,85,247,0.15)",color:"#c4b5fd",fontSize:"10px",padding:"2px 8px",borderRadius:"6px",flexShrink:0}}>خاص بك</span>}
          </div>
          <div style={{fontSize:"13px",color:"#cbd5e1",lineHeight:"1.6",marginBottom:"6px"}}>{n.body}</div>
          <div style={{fontSize:"11px",color:"#52525b"}}>{formatTime(n.sentAt)}</div>
        </div>
      ))
    }
  </div></div>;
}

// ─── VIDEO DESCRIPTION MODAL (وضع ملء الشاشة) ────────────
function VideoDescriptionModal({onClose,video,role,mySubscriptions,globalPrices,onOpenWallet,onOpenCode,onSelectSubject,videoIdx,totalVideos,clips,watchedClipIds,examScores,progressUpdatedAt,allVideos,studentProgress,onJumpToVideo}) {
  const free = isFreeSubject(globalPrices,video.subject,video.stage);
  const sub = role==="student"&&video.subject ? hasAccess(mySubscriptions,globalPrices,video.subject,video.stage,video.grade) : true;
  const d = role==="student"&&video.subject ? daysLeft(mySubscriptions,video.subject,video.stage,video.grade) : 0;

  // المواد التي اشترك بها الطالب (نشطة فقط) — مع رقم آخر صفحة وصلها الطالب
  // بكل مادة، مستخرج من فهرس آخر مقطع محفوظ بـstudentProgress
  const mySubjects = Object.entries(mySubscriptions)
    .filter(([,s])=>new Date(s.expiresAt)>new Date())
    .map(([key,s])=>{
      const progressIdx = studentProgress?.[subKey(s.subject,s.stage)];
      const lastVideo = (progressIdx!=null && allVideos) ? allVideos[progressIdx] : null;
      return {key, subject:s.subject, stage:s.stage, lastPage: lastVideo?.page || null};
    });

  // المواد المجانية (سعرها 0) تُضاف تلقائياً
  const freeSubjects = SUBJECTS
    .filter(subj=>STAGES.some(st=>isFreeSubject(globalPrices,subj,st)))
    .filter(subj=>!mySubjects.find(s=>s.subject===subj));

  // ─── تقدّم الطالب بفصل هذا المقطع (لو منتمي لفصل محدد) ───
  // نحسبها هنا بدل ما نعتمد على أي حالة جاهزة، عشان تنعكس فوراً بمجرد ما
  // يتغيّر watchedClipIds (بعد إكمال مشاهدة مقطع جديد مثلاً)
  const chapterInfo = (()=>{
    if(role!=="student"||!video.topic||!video.subject||!clips) return null;
    const topicClips = clips.filter(c=>c.subject===video.subject && c.stage===video.stage && c.topic===video.topic)
      .sort((a,b)=>Number(a.num||0)-Number(b.num||0));
    if(topicClips.length===0) return null;
    const watchedCount = topicClips.filter(c=>watchedClipIds?.includes(c.id)).length;
    const missingCount = topicClips.length - watchedCount;
    const unlocked = missingCount<=MAX_SKIPPED_CLIPS;
    const remainingAllowance = Math.max(0, MAX_SKIPPED_CLIPS - missingCount);
    const stillNeededToUnlock = Math.max(0, missingCount - MAX_SKIPPED_CLIPS);
    const missingClips = topicClips.filter(c=>!watchedClipIds?.includes(c.id));
    const firstUnwatched = missingClips[0] || null;
    const tKey = topicKey(video.subject,video.stage,video.topic);
    const score = examScores?.[tKey];
    return {topicClips,watchedCount,missingCount,unlocked,remainingAllowance,stillNeededToUnlock,firstUnwatched,missingClips,score};
  })();

  const jumpToClip = (clip) => {
    if(!clip||!allVideos||!onJumpToVideo) return;
    const idx = allVideos.findIndex(v=>v.id===clip.id);
    if(idx>=0){ onJumpToVideo(idx); onClose(); }
  };


  // "آخر نشاط" — ملاحظة: هذا وقت آخر تحديث لتقدّم الطالب عموماً بكل المواد، مو
  // خاص بهذا المقطع تحديداً (البيانات المخزّنة فيها طابع زمني واحد للمستند كامل)
  const formatLastActivity = (ts) => {
    if(!ts?.seconds) return null;
    try{ return new Date(ts.seconds*1000).toLocaleString("ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
    catch{ return null; }
  };
  const lastActivityText = formatLastActivity(progressUpdatedAt);

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(255,255,255,0.1)"}}>
    <MHead icon={<FileText size={20} color="#38bdf8"/>} title="تفاصيل الاشتراك" color="#38bdf8" onClose={onClose}/>

    {/* رقم المقطع */}
    {totalVideos>0&&<div style={{textAlign:"center",marginBottom:"10px"}}>
      <span style={{backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"20px",padding:"4px 14px",fontSize:"12px",color:"#38bdf8",fontWeight:"bold"}}>
        {video.type==="شرائح AI"?"شريحة":"مقطع"} رقم {video.num||(videoIdx+1)}
      </span>
    </div>}

    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
      <h2 style={{fontSize:"17px",fontWeight:"bold",margin:0}}>{video.title}</h2>
      <span style={{backgroundColor:"rgba(14,116,144,0.3)",border:"1px solid #0e7490",color:"#22d3ee",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.type||"معلم"}</span>
      {video.duration&&<span style={{backgroundColor:"rgba(255,255,255,0.08)",color:"#d1d5db",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.duration}</span>}
    </div>
    <p style={{fontSize:"13px",color:"#cbd5e1",margin:"0 0 14px"}}>‍ {video.teacher} • {video.subject} • {video.stage}{video.grade?" - الصف "+video.grade:""}</p>

    {chapterInfo&&<FirstUseTip tipKey="chapter_progress_card" text="📊 هذي البطاقة تعرض كم مقطع شاهدت من الفصل، وتنبهك قبل ما يُقفل الامتحان — تقدر تتابع تقدّمك بأي وقت من هنا."/>}

    {/* تقدّم الفصل — شريط تقدّم + تحذير عند اقتراب الحد + رابط نتيجة الامتحان + زر الانتقال لأول مقطع غير مشاهد */}
    {chapterInfo&&(
      <div style={{backgroundColor:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"12px 14px",marginBottom:"12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <div style={{fontSize:"12px",fontWeight:"bold",color:"#e4e4e7"}}>تقدّمك بفصل «{video.topic}»</div>
          <div dir="ltr" style={{fontSize:"12px",fontWeight:"900",color:chapterInfo.missingCount===0?"#4ade80":chapterInfo.unlocked?"#38bdf8":"#f87171"}}>
            {chapterInfo.watchedCount} / {chapterInfo.topicClips.length}
          </div>
        </div>

        <div style={{width:"100%",height:"6px",backgroundColor:"rgba(255,255,255,0.08)",borderRadius:"4px",overflow:"hidden",marginBottom:"10px"}}>
          <div style={{width:(chapterInfo.watchedCount/chapterInfo.topicClips.length*100)+"%",height:"100%",backgroundColor:chapterInfo.missingCount===0?"#4ade80":chapterInfo.unlocked?"#38bdf8":"#f87171",borderRadius:"4px",transition:"width 0.4s ease"}}/>
        </div>

        {chapterInfo.missingCount===0?(
          <div style={{fontSize:"12px",color:"#4ade80",marginBottom:chapterInfo.score!=null?"8px":0}}>✓ أكملت كل مقاطع هذا الفصل</div>
        ):chapterInfo.unlocked?(
          <div style={{fontSize:"12px",color:chapterInfo.remainingAllowance<=1?"#fbbf24":"#a1a1aa",marginBottom:"8px"}}>
            {chapterInfo.remainingAllowance<=1
              ?`⚠️ فوّت ${chapterInfo.missingCount} مقطع — مقطع واحد إضافي وراح يُقفل الامتحان`
              :`فوّت ${chapterInfo.missingCount} من ${chapterInfo.topicClips.length} — يقدر يفوّت ${chapterInfo.remainingAllowance} إضافي ولسه الامتحان متاح`}
          </div>
        ):(
          <div style={{fontSize:"12px",color:"#f87171",marginBottom:"8px"}}>
            🔒 الامتحان مقفل حالياً — شاهد {chapterInfo.stillNeededToUnlock} مقطع إضافي على الأقل ليفتح
          </div>
        )}

        {chapterInfo.score!=null&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:chapterInfo.score>=60?"rgba(74,222,128,0.08)":"rgba(248,113,113,0.08)",border:`1px solid ${chapterInfo.score>=60?"rgba(74,222,128,0.25)":"rgba(248,113,113,0.25)"}`,borderRadius:"8px",padding:"7px 10px",marginBottom:chapterInfo.firstUnwatched?"8px":0}}>
            <span style={{fontSize:"12px",color:"#d4d4d8"}}>نتيجتك بامتحان هذا الفصل</span>
            <span style={{fontSize:"13px",fontWeight:"900",color:chapterInfo.score>=60?"#4ade80":"#f87171"}}>{chapterInfo.score}%</span>
          </div>
        )}

        {chapterInfo.firstUnwatched&&(
          <div style={{marginTop:"4px"}}>
            <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px",fontWeight:"bold"}}>المقاطع الناقصة ({chapterInfo.missingClips.length}):</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"200px",overflowY:"auto"}}>
              {chapterInfo.missingClips.map(clip=>(
                <button key={clip.id} onClick={()=>jumpToClip(clip)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 10px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.25)",backgroundColor:"rgba(56,189,248,0.06)",color:"#e4e4e7",fontSize:"12px",cursor:"pointer",textAlign:"right"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{clip.num?`#${clip.num} `:""}{clip.title}</span>
                  <span style={{color:"#38bdf8",fontSize:"11px",flexShrink:0,marginRight:"8px"}}>مشاهدة ←</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* حالة الاشتراك للمقطع الحالي */}
    {role==="student"&&video.subject&&(
      sub&&d>0?(
        <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:"#fbbf24",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <span>اشتراك {video.subject} ينتهي خلال {d} يوم</span>
          <button onClick={onOpenWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"6px",padding:"5px 12px",color:"#fff",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>جدد</button>
        </div>
      ):!sub?(
        <div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:"#f87171",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <span>اشترك للوصول لمحتوى {video.subject}</span>
          <button onClick={onOpenWallet} style={{backgroundColor:"#ef4444",border:"none",borderRadius:"6px",padding:"5px 12px",color:"#fff",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>اشترك</button>
        </div>
      ):null
    )}

    {/* السعر — ظاهر دائماً لأي مادة مدفوعة، لكن زر "اشترك الآن" يتعطّل تلقائياً
        أثناء وجود اشتراك نشط (نفس منطق زر الكود بالضبط للاتساق)، ويرجع
        يشتغل تلقائياً بمجرد انتهاء الاشتراك */}
    {role==="student"&&video.subject&&!free&&(()=>{
      const priceKey = video.subject+"__"+video.stage;
      const price = globalPrices?.[priceKey];
      const activeNow = sub&&d>0;
      return price&&Number(price)>0?(
        <div style={{backgroundColor:activeNow?"rgba(255,255,255,0.03)":"rgba(251,191,36,0.08)",border:`1px solid ${activeNow?"rgba(255,255,255,0.1)":"rgba(251,191,36,0.2)"}`,borderRadius:"10px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:"11px",color:"#71717a",marginBottom:"2px"}}>سعر الاشتراك</div>
            <div style={{fontSize:"18px",fontWeight:"900",color:activeNow?"#71717a":"#fbbf24"}}>{price} <span style={{fontSize:"12px",fontWeight:"normal"}}>د.ع شهرياً</span></div>
          </div>
          <button
            onClick={activeNow?undefined:onOpenWallet}
            disabled={activeNow}
            title={activeNow?"غير متاح أثناء وجود اشتراك نشط — استخدم زر «جدد» بالأعلى بدلاً منه":""}
            style={{backgroundColor:activeNow?"rgba(255,255,255,0.06)":"#f97316",border:"none",borderRadius:"10px",padding:"8px 16px",color:activeNow?"#52525b":"#fff",fontSize:"13px",fontWeight:"bold",cursor:activeNow?"not-allowed":"pointer"}}>
            {activeNow?"مشترك حالياً":"اشترك الآن"}
          </button>
        </div>
      ):null;
    })()}

    {/* بديل عن زين كاش — يفعّل نفس المادة فوراً بكود جاهز بدل انتظار مراجعة
        الدفع. ظاهر دائماً (مو بس للطالب غير المشترك) عشان يعرف الخيار موجود،
        لكن معطّل تلقائياً أثناء وجود اشتراك نشط بنفس المادة — ويرجع يشتغل
        تلقائياً بمجرد انتهاء الاشتراك (d<=0) بدون أي تدخل إضافي */}
    {role==="student"&&video.subject&&!free&&(()=>{
      const activeNow = sub&&d>0;
      return (
        <button
          onClick={activeNow?undefined:onOpenCode}
          disabled={activeNow}
          title={activeNow?"غير متاح أثناء وجود اشتراك نشط — يشتغل تلقائياً بعد انتهائه":""}
          style={{
            width:"100%",padding:"9px",borderRadius:"10px",
            border:`1px dashed ${activeNow?"rgba(255,255,255,0.15)":"rgba(196,181,253,0.4)"}`,
            backgroundColor:activeNow?"rgba(255,255,255,0.03)":"rgba(168,85,247,0.06)",
            color:activeNow?"#52525b":"#c4b5fd",
            fontSize:"12px",fontWeight:"bold",
            cursor:activeNow?"not-allowed":"pointer",
            marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"
          }}>
          <Key size={13}/> {activeNow?"كود التفعيل غير متاح (أنت مشترك حالياً)":"أو لدي كود تفعيل جاهز"}
        </button>
      );
    })()}

    {/* اشتراك أسرع عبر بوت تيليجرام — يعطي كود تفعيل فور موافقة الإدارة على وصل التحويل،
        بدل انتظار مراجعة يدوية داخل التطبيق. معطّل أثناء وجود اشتراك نشط بنفس منطق الأزرار أعلاه */}
    {role==="student"&&video.subject&&!free&&(()=>{
      const activeNow = sub&&d>0;
      return (
        <a
          href={activeNow?undefined:"https://t.me/edutok_sub_bot"}
          target="_blank"
          rel="noreferrer"
          onClick={activeNow?(e)=>e.preventDefault():undefined}
          title={activeNow?"غير متاح أثناء وجود اشتراك نشط — يشتغل تلقائياً بعد انتهائه":""}
          style={{
            width:"100%",padding:"9px",borderRadius:"10px",boxSizing:"border-box",
            border:`1px dashed ${activeNow?"rgba(255,255,255,0.15)":"rgba(56,189,248,0.4)"}`,
            backgroundColor:activeNow?"rgba(255,255,255,0.03)":"rgba(56,189,248,0.06)",
            color:activeNow?"#52525b":"#7dd3fc",
            fontSize:"12px",fontWeight:"bold",textDecoration:"none",
            cursor:activeNow?"not-allowed":"pointer",
            marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"
          }}>
          📱 {activeNow?"بوت تيليجرام غير متاح (أنت مشترك حالياً)":"أو اشترك بشكل أسرع عبر بوت تيليجرام"}
        </a>
      );
    })()}

    {/* قسم مادتي — للطلاب المشتركين فقط */}
    {role==="student"&&mySubjects.length>0&&(
      <div style={{marginTop:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}>
          <BookOpen size={13}/> مادتي — تصفح بالتسلسل
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {mySubjects.map(s=>(
            <button key={s.key} onClick={()=>{onSelectSubject(s.subject,s.stage);onClose();}}
              style={{padding:"7px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer",textAlign:"center"}}>
              <div>{s.subject}<span style={{fontSize:"10px",color:"#71717a",marginRight:"4px"}}>{s.stage}</span></div>
              {s.lastPage&&<div style={{fontSize:"10px",color:"#71717a",fontWeight:"normal",marginTop:"2px"}}>آخر صفحة وصلتها: {s.lastPage}</div>}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* آخر نشاط — عام لكل التقدّم، مو خاص بهذا المقطع تحديداً (نوضح ذلك بالنص) */}
    {role==="student"&&lastActivityText&&(
      <div style={{marginTop:"12px",textAlign:"center",fontSize:"10px",color:"#52525b"}}>
        آخر نشاط لك بالتطبيق: {lastActivityText}
      </div>
    )}
  </div></div>;
}


function AdminLoginModal({onClose,onSuccess}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  const login=async()=>{
    if(!email.trim()||!pass.trim()) return setErr("أدخل البريد الإلكتروني وكلمة المرور");
    setLoading(true); setErr("");
    try{
      await signInWithEmailAndPassword(auth,email.trim(),pass);
      onSuccess();
    }catch(e){
      if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found") setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      else if(e.code==="auth/too-many-requests") setErr("محاولات كثيرة فاشلة، حاول بعد قليل");
      else setErr("فشل تسجيل الدخول: "+e.message);
    }
    setLoading(false);
  };
  const sendReset=async()=>{
    if(!email.trim()) return setErr("أدخل البريد الإلكتروني أولاً لإرسال رابط الاستعادة");
    try{ await sendPasswordResetEmail(auth,email.trim()); setResetSent(true); setErr(""); }
    catch(e){ setErr("فشل إرسال رابط الاستعادة: "+e.message); }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(234,179,8,0.2)"}}>
    <div style={{textAlign:"center",marginBottom:"20px"}}>
      <GraduationCap size={40} color="#eab308" style={{margin:"0 auto 8px"}}/>
      <h3 style={{color:"#eab308",fontWeight:"bold",fontSize:"18px",margin:"0 0 4px"}}>دخول المدير</h3>
    </div>
    <label style={C.label}> البريد الإلكتروني</label>
    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");setResetSent(false);}} placeholder="admin@example.com" style={C.input}/>
    <label style={C.label}> كلمة المرور</label>
    <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} placeholder="كلمة المرور" style={C.input} onKeyDown={e=>e.key==="Enter"&&login()}/>
    <ErrBox msg={err}/>
    {resetSent&&<div style={{backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#4ade80",marginBottom:"14px",textAlign:"center"}}>تم إرسال رابط استعادة كلمة المرور إلى بريدك</div>}
    <button onClick={login} disabled={loading} style={{...C.gradBtn,background:"linear-gradient(to right,#eab308,#f97316)",opacity:loading?0.7:1}}>
      {loading?<><Spinner size={16}/> جارٍ تسجيل الدخول...</>:<>دخول لوحة الإدارة ←</>}
    </button>
    <button onClick={sendReset} style={{width:"100%",padding:"10px",backgroundColor:"transparent",color:"#38bdf8",border:"none",fontSize:"13px",cursor:"pointer",marginBottom:"8px"}}>نسيت كلمة المرور؟</button>
    <button onClick={onClose} style={{width:"100%",padding:"12px",backgroundColor:"transparent",color:"#71717a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",fontSize:"14px",cursor:"pointer"}}>إلغاء</button>
  </div></div>;
}

// ─── WALLET MODAL ────────────────────────────────────────
function WalletModal({onClose,student,subscriptions}) {
  const [selSubject,setSelSubject]=useState(SUBJECTS[0]);
  const [selStage,setSelStage]=useState(STAGES[0]);
  const [selGrade,setSelGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [selDuration,setSelDuration]=useState(DURATIONS[0]);
  const [amount,setAmount]=useState("");
  const [receipt,setReceipt]=useState(null);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [prices,setPrices]=useState({});

  // لازم نصفّر الصف المختار كل ما تتغيّر المرحلة، حتى لا يبقى صف من مرحلة سابقة
  // غير موجود أصلاً بالمرحلة الجديدة (مثلاً "السادس" من الإعدادية بعد التحويل للمتوسطة)
  const onStageChange=(s)=>{ setSelStage(s); setSelGrade((GRADES[s]||[])[0]||""); };

  useEffect(()=>{
    // ✅ إصلاح: نفس مشكلة شاشة الأكواد — نقرأ من مجموعة "prices" الحقيقية
    // بدل مستند "settings/prices" الذي لا يُكتب فيه شيء أبداً.
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage&&data.value!==undefined){
          vals[data.subject+"__"+data.stage]=data.value;
        }
      });
      setPrices(vals);
    });
    return ()=>unsub();
  },[]);

  const recommendedPrice = prices[selSubject+"__"+selStage];

  const sendPayment=async()=>{
    if(!amount.trim()) return showMsg("أدخل المبلغ المحوّل");
    setSending(true);
    try{
      await addDoc(collection(db,"payments"),{
        studentName:student?.name||"",studentPhone:student?.phone||"",studentId:student?.id||"",
        subject:selSubject,stage:selStage,grade:selGrade,duration:selDuration.days,durationLabel:selDuration.label,
        amount,receiptUrl:receipt||"",status:"pending",createdAt:serverTimestamp()
      });
      setSent(true);
    }catch(e){showMsg("حدث خطأ: "+e.message);}
    setSending(false);
  };

  if(sent) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم إرسال طلب الاشتراك!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"4px"}}>المادة: <strong style={{color:"#fff"}}>{selSubject} — {selStage} — الصف {selGrade}</strong></div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>سيتم تفعيل اشتراكك بعد مراجعة المدير</div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)"}}>
    <MHead icon={<DollarSign size={20} color="#4ade80"/>} title="محفظة زين كاش" color="#4ade80" onClose={onClose}/>
    {subscriptions&&Object.keys(subscriptions).length>0&&(
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"6px"}}>اشتراكاتي النشطة:</div>
        {Object.entries(subscriptions).map(([key,sub])=>{
          const parts=key.split("__");
          const d=daysLeft(subscriptions,parts[0],parts[1],parts[2]);
          return <div key={key} style={{...C.card,marginBottom:"6px",border:"1px solid rgba(34,197,94,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:"bold",fontSize:"12px"}}>{sub.subject}</div><div style={{fontSize:"10px",color:"#71717a"}}>{sub.stage}{sub.grade?" — الصف "+sub.grade:""}</div></div>
              <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
            </div>
          </div>;
        })}
      </div>
    )}
    <a href="https://t.me/edutok_sub_bot" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",backgroundColor:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textDecoration:"none",color:"#7dd3fc",fontWeight:"bold",fontSize:"13px"}}>📱 أو اشترك بشكل أسرع عبر بوت تيليجرام</a>
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:"12px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"4px"}}>رقم زين كاش للمدير</div>
      <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px"}}>{ZAINCASH_NUM}</div>
      <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>حوّل المبلغ ثم أرسل الإيصال</div>
    </div>
    <label style={C.label}> المادة</label>
    <select value={selSubject} onChange={e=>setSelSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> المرحلة</label>
    <select value={selStage} onChange={e=>onStageChange(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> الصف</label>
    <select value={selGrade} onChange={e=>setSelGrade(e.target.value)} style={C.select}>{(GRADES[selStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
    <label style={C.label}> مدة الاشتراك</label>
    <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
      {DURATIONS.map(d=><button key={d.days} onClick={()=>setSelDuration(d)} style={{flex:1,padding:"9px 4px",borderRadius:"10px",border:"none",backgroundColor:selDuration.days===d.days?"#4ade80":"#27272a",color:selDuration.days===d.days?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"10px",cursor:"pointer"}}>{d.label}</button>)}
    </div>
    <label style={C.label}> المبلغ المحوّل (د.ع)</label>
    {recommendedPrice&&<div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px"}}>السعر المحدد لهذا الاشتراك: {recommendedPrice} د.ع</div>}
    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="أدخل المبلغ" style={C.input}/>
    <label style={C.label}> إيصال التحويل</label>
    <ImageUploader onUpload={url=>setReceipt(url)} onBase64={()=>{}} color="#4ade80" label="صوّر إيصال زين كاش"/>
    {sending?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#4ade80"/></div>
    :<button onClick={sendPayment} style={{...C.primaryBtn,background:"linear-gradient(to right,#15803d,#4ade80)",marginBottom:0}}>إرسال طلب الاشتراك للمدير</button>}
  </div></div>;
}

// ─── CODE MODAL (تفعيل اشتراك عبر كود) ───────────────────
function CodeModal({onClose,student,mySubscriptions}) {
  const [code,setCode]=useState("");
  const [checking,setChecking]=useState(false);
  const [err,setErr]=useState("");
  const [result,setResult]=useState(null); // {subject,stage,newExpiry}

  const redeem=async()=>{
    const c=code.trim().toUpperCase();
    if(!c) return setErr("أدخل الكود أولاً");
    if(!student?.phone) return setErr("يجب تسجيل الدخول كطالب أولاً");
    setErr(""); setChecking(true);
    try{
      const ref=doc(db,"codes",c);
      const snap=await getDoc(ref);
      if(!snap.exists()){ setErr("الكود غير صحيح، تأكد من كتابته بشكل سليم"); setChecking(false); return; }
      const data=snap.data();
      if(data.used){ setErr("هذا الكود تم استخدامه مسبقاً"); setChecking(false); return; }
      // التحقق من صلاحية الكود الزمنية (قبل الاستخدام)
      const createdMs = data.createdAt?.seconds ? data.createdAt.seconds*1000 : null;
      if(createdMs && (Date.now()-createdMs) > CODE_VALIDITY_DAYS*86400000){
        setErr("انتهت صلاحية هذا الكود، تواصل مع المدير للحصول على كود جديد");
        setChecking(false); return;
      }
      // حساب تاريخ الانتهاء الجديد (يمدد الاشتراك الحالي لنفس الصف إن وجد وإلا يبدأ من الآن)
      let newExpiry = computeExtendedExpiry(mySubscriptions, data.subject, data.stage, data.durationDays, data.grade);
      // لو الطالب مسجّل بكود شراكة ولم يستلم هديته بعد، نضيفها هنا أيضاً (أول اشتراك فعلي، سواء عبر كود أو دفع مباشر)
      let bonusApplied = 0;
      try{
        const studentSnap = await getDoc(doc(db,"students",student.phone));
        if(studentSnap.exists()){
          const sd = studentSnap.data();
          if(sd.campaignCode && !sd.campaignBonusGiven && Number(sd.campaignBonusDays)>0){
            bonusApplied = Number(sd.campaignBonusDays);
            newExpiry = new Date(newExpiry);
            newExpiry.setDate(newExpiry.getDate()+bonusApplied);
          }
        }
      }catch{}
      // 1) إنشاء/تمديد سجل الاشتراك
      await addDoc(collection(db,"subscriptions"),{
        studentPhone: student.phone,
        studentName: student.name||"",
        subject: data.subject,
        stage: data.stage,
        grade: data.grade||"",
        duration: data.durationDays,
        expiresAt: newExpiry.toISOString(),
        activatedAt: serverTimestamp(),
        viaCode: c,
      });
      if(bonusApplied>0){
        await updateDoc(doc(db,"students",student.phone),{campaignBonusGiven:true});
      }
      // 2) تعليم الكود كمستخدم (يمنع إعادة استخدامه)
      await updateDoc(ref,{
        used:true, usedBy: student.phone, usedByName: student.name||"", usedAt: serverTimestamp(),
      });
      // 3) إشعار الطالب
      await sendNotification({
        phone: student.phone,
        title:"✅ تم تفعيل اشتراكك بالكود!",
        body:"تم تفعيل/تمديد اشتراكك في "+data.subject+" ("+data.stage+(data.grade?" - "+data.grade:"")+")"+(bonusApplied>0?" (تشمل "+bonusApplied+" يوم هدية ترحيبية 🎁)":"")+". ينتهي في "+newExpiry.toLocaleDateString("ar"),
      });
      setResult({subject:data.subject,stage:data.stage,grade:data.grade,newExpiry,bonusApplied});
    }catch(e){
      setErr("حدث خطأ: "+e.message);
    }
    setChecking(false);
  };

  if(result) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم تفعيل الاشتراك بنجاح!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"4px"}}>المادة: <strong style={{color:"#fff"}}>{result.subject} — {result.stage}{result.grade?" — الصف "+result.grade:""}</strong></div>
    {result.bonusApplied>0&&<div style={{color:"#fbbf24",fontSize:"13px",marginBottom:"4px"}}>🎁 تمت إضافة {result.bonusApplied} يوم هدية ترحيبية!</div>}
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>ينتهي الاشتراك في: <strong style={{color:"#fbbf24"}}>{result.newExpiry.toLocaleDateString("ar")}</strong></div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.25)"}}>
    <MHead icon={<Key size={20} color="#c4b5fd"/>} title="تفعيل بالكود" color="#c4b5fd" onClose={onClose}/>
    <div style={{...C.infoBanner,backgroundColor:"rgba(88,28,135,0.2)",border:"1px solid rgba(168,85,247,0.35)",color:"#c4b5fd"}}>
      احصل على الكود بالتواصل مع المدير، ثم أدخله هنا لتفعيل اشتراكك فوراً.
    </div>
    <FirstUseTip tipKey="subscription_vs_partner_code" text="ℹ️ هذا الكود يفتح مادة كاملة فوراً. لو الكود اللي وصلك من صفحة/مجموعة شريكة (يعطي أيام هدية بس، مو مادة)، استخدم «كود شراكة» من حسابك بدل هذا."/>
    <label style={C.label}>كود التفعيل</label>
    <input
      value={code}
      onChange={e=>{setCode(e.target.value.toUpperCase());setErr("");}}
      onKeyDown={e=>e.key==="Enter"&&redeem()}
      placeholder="مثال: A7K9PXQ"
      maxLength={12}
      style={{...C.input,textAlign:"center",fontSize:"18px",fontWeight:"bold",letterSpacing:"3px",fontFamily:"monospace"}}
    />
    <ErrBox msg={err}/>
    {checking
      ?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#c4b5fd"/></div>
      :<button onClick={redeem} disabled={!code.trim()} style={{...C.purpleBtn,opacity:code.trim()?1:0.5,marginBottom:0}}><Key size={16}/> تفعيل الكود</button>
    }
  </div></div>;
}

// ─── PARTNER CODE MODAL (إضافة كود شراكة بعد التسجيل) ────
// يسمح لطالب مسجَّل مسبقاً بإضافة كود شراكة لم يدخله وقت إنشاء الحساب — عبر
// مسار سيرفر مخصص (راجع api/redeem-partner-code.js) لأن قواعد أمان Firestore
// تمنع الطالب من كتابة حقلي campaignCode/campaignBonusDays مباشرة من المتصفح
function PartnerCodeModal({onClose,student,onRedirectToCode}) {
  const [code,setCode]=useState("");
  const [checking,setChecking]=useState(false);
  const [err,setErr]=useState("");
  const [wrongType,setWrongType]=useState(false);
  const [result,setResult]=useState(null); // {bonusDays}

  const redeem=async()=>{
    const c=code.trim().toUpperCase();
    if(!c) return setErr("أدخل الكود أولاً");
    if(!student?.phone) return setErr("يجب تسجيل الدخول كطالب أولاً");
    setErr(""); setWrongType(false); setChecking(true);
    try{
      const res=await fetch("/api/redeem-partner-code",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ phone: student.phone, code: c })
      });
      let d;
      try{ d = await res.json(); }
      catch{ setErr("تعذّر الاتصال بالخادم (رمز "+res.status+")"); setChecking(false); return; }
      if(!d.ok){
        setErr(d.error||"فشل تفعيل كود الشراكة");
        if(d.wrongType==="subscription") setWrongType(true);
        setChecking(false); return;
      }
      setResult({bonusDays:d.bonusDays||0});
    }catch(e){
      setErr("حدث خطأ: "+e.message);
    }
    setChecking(false);
  };

  if(result) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>🎁</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم تسجيل كود الشراكة بنجاح!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>
      {result.bonusDays>0
        ?<>ستحصل على <strong style={{color:"#fbbf24"}}>{result.bonusDays} يوم هدية</strong> تلقائياً عند تفعيل أول اشتراك لك (بكود أو دفع مباشر).</>
        :"تم تسجيل الكود بنجاح."}
    </div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.25)"}}>
    <MHead icon={<Users size={20} color="#c4b5fd"/>} title="كود شراكة" color="#c4b5fd" onClose={onClose}/>
    <div style={{...C.infoBanner,backgroundColor:"rgba(88,28,135,0.2)",border:"1px solid rgba(168,85,247,0.35)",color:"#c4b5fd"}}>
      لو وصلك كود من صفحة أو مجموعة شريكة ولم تدخله وقت إنشاء حسابك، أدخله هنا — تحصل على أيام هدية عند تفعيل أول اشتراك لك.
    </div>
    <FirstUseTip tipKey="partner_vs_subscription_code" text="⚠️ هذا غير كود تفعيل المادة! كود الشراكة يعطيك أيام هدية بس، ما يفتح مادة لحاله. لو عندك كود لتفعيل مادة معيّنة، استخدم «لدي كود تفعيل» من حسابك بدل هذا."/>
    <label style={C.label}>كود الشراكة</label>
    <input
      value={code}
      onChange={e=>{setCode(e.target.value.toUpperCase());setErr("");setWrongType(false);}}
      onKeyDown={e=>e.key==="Enter"&&redeem()}
      placeholder="مثال: A7K9PXQ"
      maxLength={12}
      style={{...C.input,textAlign:"center",fontSize:"18px",fontWeight:"bold",letterSpacing:"3px",fontFamily:"monospace"}}
    />
    <ErrBox msg={err}/>
    {wrongType&&onRedirectToCode&&(
      <button onClick={()=>{onClose();onRedirectToCode();}} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <Key size={14}/> افتح «تفعيل كود اشتراك» بدلاً من هذا
      </button>
    )}
    {checking
      ?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#c4b5fd"/></div>
      :<button onClick={redeem} disabled={!code.trim()} style={{...C.purpleBtn,opacity:code.trim()?1:0.5,marginBottom:0}}><Users size={16}/> تسجيل الكود</button>
    }
  </div></div>;
}

// ─── ONBOARDING MODAL (جولة شرح تعريفية — 4 خطوات) ────────
// تظهر تلقائياً أول مرة يفتح الطالب التطبيق (تُتابع عبر localStorage)، وتقدر
// ترجع تفتحها بأي وقت من زر داخل نافذة "مساعد" (زكي)
function OnboardingModal({onClose}) {
  const [step,setStep]=useState(0);
  const isLast = step===ONBOARDING_STEPS.length-1;
  const s = ONBOARDING_STEPS[step];

  const finish=()=>{
    try{ localStorage.setItem("edutok_onboarding_seen","1"); }catch{}
    onClose();
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.25)",textAlign:"center"}}>
    <button onClick={finish} style={{position:"absolute",top:"14px",left:"14px",background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"12px"}}>تخطي</button>

    <div style={{fontSize:"64px",margin:"18px 0 10px"}}>{s.emoji}</div>
    <div style={{fontSize:"18px",fontWeight:"bold",color:"#fff",marginBottom:"10px"}}>{s.title}</div>
    <div style={{fontSize:"14px",color:"#a1a1aa",lineHeight:"1.8",marginBottom:"22px",padding:"0 6px"}}>{s.desc}</div>

    {/* نقاط التقدّم */}
    <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"22px"}}>
      {ONBOARDING_STEPS.map((_,i)=>(
        <div key={i} style={{width:i===step?"20px":"6px",height:"6px",borderRadius:"3px",backgroundColor:i===step?"#38bdf8":"rgba(255,255,255,0.15)",transition:"all 0.25s ease"}}/>
      ))}
    </div>

    <div style={{display:"flex",gap:"8px"}}>
      {step>0&&(
        <button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"12px",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.15)",backgroundColor:"transparent",color:"#d4d4d8",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>السابق</button>
      )}
      <button onClick={()=>isLast?finish():setStep(s=>s+1)} style={{flex:2,padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#000",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>
        {isLast?"ابدأ الآن 🚀":"التالي"}
      </button>
    </div>
  </div></div>;
}

// ─── CERTIFICATE MODAL (شهادة إتمام فصل — قابلة للمشاركة) ─
// cert: {subject,stage,topic,examScore}  حيث examScore = {score,passed,attempts} أو null (لم يُمتحن بعد)
function CertificateModal({onClose,student,cert,onStartExam}) {
  const [copied,setCopied]=useState(false);
  const dateStr = new Date().toLocaleDateString("ar",{year:"numeric",month:"long",day:"numeric"});
  const passed = cert.examScore?.passed;
  const attempted = !!cert.examScore;
  const shareText = "🎓 أنهيت فصل \""+cert.topic+"\" في مادة "+cert.subject+" ("+cert.stage+") على تطبيق EduTok!"
    +(passed?"\nبنسبة نجاح "+cert.examScore.score+"% بامتحان الفصل! 💯":"")
    +"\nتاريخ الإنجاز: "+dateStr;

  const share=async()=>{
    try{
      if(navigator.share){ await navigator.share({title:"شهادة إتمام",text:shareText}); return; }
    }catch{}
    try{ await navigator.clipboard?.writeText(shareText); setCopied(true); setTimeout(()=>setCopied(false),2000); }catch{}
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(251,191,36,0.35)",textAlign:"center"}}>
    <div style={{background:"linear-gradient(135deg,#78350f,#b45309)",borderRadius:"18px",padding:"28px 20px",marginBottom:"16px",border:"1px solid rgba(251,191,36,0.4)"}}>
      <div style={{fontSize:"46px",marginBottom:"8px"}}>🎓</div>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.7)",marginBottom:"4px"}}>شهادة إتمام فصل</div>
      <div style={{fontSize:"19px",fontWeight:"900",color:"#fde68a",marginBottom:"10px"}}>{cert.topic}</div>
      <div style={{height:"1px",background:"rgba(255,255,255,0.2)",margin:"10px 0"}}/>
      <div style={{fontSize:"14px",fontWeight:"bold",color:"#fff",marginBottom:"2px"}}>{student?.name}</div>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.6)"}}>{cert.subject} • {cert.stage}</div>
      <div style={{fontSize:"11px",color:"rgba(255,255,255,0.45)",marginTop:"8px"}}>{dateStr}</div>
    </div>

    {/* حالة امتحان الفصل — النجاح شرط لفتح الفصل التالي */}
    {passed
      ?<div style={{backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{fontSize:"22px",marginBottom:"2px"}}>{cert.examScore.score>=80?"🏅":"✅"}</div>
        <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"14px"}}>اجتزت امتحان الفصل بنسبة {cert.examScore.score}%</div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"2px"}}>الفصل التالي متاح الآن</div>
      </div>
      :<div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{fontSize:"22px",marginBottom:"2px"}}>{attempted?"❌":"🔒"}</div>
        <div style={{color:"#f87171",fontWeight:"bold",fontSize:"14px"}}>
          {attempted?"لم تجتز بعد — آخر نتيجة "+cert.examScore.score+"%":"درجة امتحان الفصل: لم تُحدد بعد"}
        </div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"2px"}}>يجب تحقيق 60% على الأقل لفتح الفصل التالي</div>
      </div>
    }

    {!passed&&onStartExam&&(
      <button onClick={()=>onStartExam(cert.subject,cert.stage,cert.topic)} style={{...C.primaryBtn,background:"linear-gradient(to right,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <ClipboardList size={16}/> {attempted?"أعد المحاولة":"ابدأ امتحان الفصل الآن"}
      </button>
    )}
    <div style={{fontSize:"13px",color:"#a1a1aa",marginBottom:"16px"}}>🎉 مبروك! أنهيت مشاهدة هذا الفصل بالكامل</div>
    <button onClick={share} style={{...C.primaryBtn,background:"linear-gradient(to right,#d97706,#fbbf24)"}}>
      {copied?"✅ تم نسخ النص":<><Share2 size={16}/> شارك إنجازك</>}
    </button>
    <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
  </div></div>;
}

// ─── EXAM MODAL (امتحان فصل — يختار الطالب المادة/المرحلة/الفصل أو يفتح مباشرة على فصل محدد) ─
const EXAM_PASS_THRESHOLD = 60; // نسبة النجاح المطلوبة (%)
const EXAM_MAX_QUESTIONS = 30;  // أقصى عدد أسئلة تُعرض بالمحاولة الواحدة (تُسحب عشوائياً من بنك الأسئلة)

const shuffleArray = (arr) => {
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};

function ExamModal({onClose, initial, currentStudent, mySubscriptions, globalPrices, clips, examScores, onResult}) {
  // step: "picker" (اختيار مادة/مرحلة/فصل) → "loading" → "empty" (لا أسئلة) → "quiz" → "result"
  const [step,setStep]=useState(initial?"loading":"picker");
  const [pickStage,setPickStage]=useState(initial?.stage||"");
  const [pickGrade,setPickGrade]=useState("");
  const [pickSubject,setPickSubject]=useState(initial?.subject||"");
  const [pickTopic,setPickTopic]=useState(initial?.topic||"");
  const [pickerSub,setPickerSub]=useState(initial?"topic":"stage"); // مرحلة فرعية بداخل خطوة "picker": stage → grade → subject → topic

  const [questions,setQuestions]=useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [answers,setAnswers]=useState([]); // فهرس الخيار المختار لكل سؤال، بنفس ترتيب questions
  const [result,setResult]=useState(null); // {score, correct, total, passed}

  const availableStages = STAGES;
  // نطابق الصف بنفس المرونة المعتمدة بباقي التطبيق: نقبل المقطع لو صفه مطابق أو لو ما حُدد له صف أصلاً
  const availableSubjects = React.useMemo(()=>{
    if(!pickStage) return [];
    const subjs = new Set();
    clips.forEach(c=>{ if(c.stage===pickStage && (!pickGrade||c.grade===pickGrade||!c.grade) && c.topic) subjs.add(c.subject); });
    return [...subjs].filter(s=>hasAccess(mySubscriptions,globalPrices,s,pickStage,pickGrade)).sort();
  },[clips,pickStage,pickGrade,mySubscriptions,globalPrices]);
  const availableTopics = React.useMemo(()=>{
    if(!pickStage||!pickSubject) return [];
    const topicMinNum={};
    clips.forEach(c=>{
      if(c.stage===pickStage&&c.subject===pickSubject&&(!pickGrade||c.grade===pickGrade||!c.grade)&&c.topic){
        const n=Number(c.num||0);
        if(!(c.topic in topicMinNum)||n<topicMinNum[c.topic]) topicMinNum[c.topic]=n;
      }
    });
    return Object.keys(topicMinNum).sort((a,b)=>topicMinNum[a]-topicMinNum[b]);
  },[clips,pickStage,pickSubject,pickGrade]);

  const loadQuestions = async(subject,stage,topic)=>{
    setStep("loading");
    try{
      const snap = await getDocs(query(collection(db,"examQuestions"),
        where("subject","==",subject), where("stage","==",stage), where("topic","==",topic), where("published","==",true)));
      const bank = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(bank.length===0){ setStep("empty"); return; }
      const picked = shuffleArray(bank).slice(0,EXAM_MAX_QUESTIONS);
      setQuestions(picked);
      setAnswers(new Array(picked.length).fill(null));
      setQIdx(0);
      setResult(null);
      setStep("quiz");
    }catch(e){
      showMsg("تعذّر تحميل أسئلة الامتحان: "+e.message);
      setStep("empty");
    }
  };

  useEffect(()=>{
    if(initial?.subject && initial?.stage && initial?.topic) loadQuestions(initial.subject,initial.stage,initial.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const selectAnswer = (optIdx)=>{
    const next=[...answers]; next[qIdx]=optIdx; setAnswers(next);
    if(optIdx===questions[qIdx]?.correctIndex) playCorrectSound(); else playWrongSound();
  };
  const goNext = ()=>{
    if(qIdx<questions.length-1){ setQIdx(qIdx+1); return; }
    finishExam();
  };
  const goPrev = ()=>{ if(qIdx>0) setQIdx(qIdx-1); };
  const finishExam = ()=>{
    let correct=0;
    questions.forEach((q,i)=>{ if(answers[i]===q.correctIndex) correct++; });
    const total=questions.length;
    const score=Math.round((correct/total)*100);
    const passed=score>=EXAM_PASS_THRESHOLD;
    if(passed) playFanfareSound(); else playWrongSound();
    setResult({score,correct,total,passed});
    setStep("result");
    onResult && onResult(pickSubject||initial?.subject, pickStage||initial?.stage, pickTopic||initial?.topic, score, passed);
  };
  const retry = ()=>{
    const subject=pickSubject||initial?.subject, stage=pickStage||initial?.stage, topic=pickTopic||initial?.topic;
    loadQuestions(subject,stage,topic);
  };

  const q = questions[qIdx];
  const stageEmoji={"الابتدائية":"🏫","المتوسطة":"📚","الإعدادية":"🎓"};

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.3)"}}>
    <MHead icon={<ClipboardList size={20} color="#c4b5fd"/>} title="امتحان الفصل" color="#c4b5fd" onClose={onClose}/>

    {/* ─── خطوة الاختيار: المرحلة ─── */}
    {step==="picker"&&pickerSub==="stage"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المرحلة الدراسية</div>
      {availableStages.map(s=>(
        <div key={s} onClick={()=>{setPickStage(s);setPickGrade("");setPickerSub("grade");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
          <span style={{fontSize:"28px"}}>{stageEmoji[s]||"📖"}</span>
          <div style={{flex:1,fontWeight:"bold",fontSize:"15px"}}>{s}</div>
          <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* ─── خطوة الاختيار: الصف ─── */}
    {step==="picker"&&pickerSub==="grade"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{pickStage}</span>
      </div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الصف الدراسي</div>
      {(GRADES[pickStage]||[]).map((g,i)=>(
        <div key={g} onClick={()=>{setPickGrade(g);setPickerSub("subject");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
          <div style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"17px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,fontWeight:"bold",fontSize:"15px"}}>الصف {g}</div>
          <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* ─── خطوة الاختيار: المادة ─── */}
    {step==="picker"&&pickerSub==="subject"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px",flexWrap:"wrap"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("grade")}>{pickStage}</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>الصف {pickGrade}</span>
      </div>
      {availableSubjects.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b",fontSize:"13px"}}>لا توجد مواد متاحة لك بهذه المرحلة/الصف</div>
        :availableSubjects.map(subj=>(
          <div key={subj} onClick={()=>{setPickSubject(subj);setPickerSub("topic");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
            <div style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><BookOpen size={18} color="#fff"/></div>
            <div style={{flex:1,fontWeight:"bold",fontSize:"14px"}}>{subj}</div>
            <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
          </div>
        ))
      }
    </div>}

    {/* ─── خطوة الاختيار: الفصل ─── */}
    {step==="picker"&&pickerSub==="topic"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px",flexWrap:"wrap"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("grade")}>{pickStage}</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("subject")}>الصف {pickGrade}</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{pickSubject}</span>
      </div>
      {availableTopics.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b",fontSize:"13px"}}>لا توجد فصول محددة لهذه المادة بعد</div>
        :availableTopics.map((topic,i)=>{
          const tKey=topicKey(pickSubject,pickStage,topic);
          const sc=examScores?.[tKey];
          return <div key={topic} onClick={()=>{setPickTopic(topic);loadQuestions(pickSubject,pickStage,topic);}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
            <div style={{width:"40px",height:"40px",borderRadius:"12px",background:sc?.passed?"rgba(34,197,94,0.15)":"rgba(168,85,247,0.15)",border:`1px solid ${sc?.passed?"rgba(34,197,94,0.3)":"rgba(168,85,247,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"15px",fontWeight:"bold",color:sc?.passed?"#4ade80":"#c4b5fd"}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{topic}</div>
              <div style={{fontSize:"11px",color:sc?.passed?"#4ade80":"#71717a"}}>{sc?(sc.passed?"✅ ناجح — "+sc.score+"%":"❌ آخر نتيجة "+sc.score+"%"):"لم يُمتحن بعد"}</div>
            </div>
            <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
          </div>;
        })
      }
    </div>}

    {/* ─── تحميل الأسئلة ─── */}
    {step==="loading"&&<div style={{textAlign:"center",padding:"40px 0"}}>
      <Spinner color="#c4b5fd" size={32}/>
      <div style={{marginTop:"10px",fontSize:"13px",color:"#a1a1aa"}}>جارٍ تحضير أسئلة الامتحان...</div>
    </div>}

    {/* ─── لا توجد أسئلة ─── */}
    {step==="empty"&&<div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontSize:"40px",marginBottom:"10px"}}>📭</div>
      <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"6px"}}>لا توجد أسئلة لهذا الفصل بعد</div>
      <div style={{color:"#71717a",fontSize:"12px",marginBottom:"16px"}}>لم يقم المدير بإضافة بنك أسئلة لهذا الفصل حتى الآن</div>
      <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
    </div>}

    {/* ─── الامتحان (سؤال واحد بالشاشة) ─── */}
    {step==="quiz"&&q&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <span style={{fontSize:"12px",color:"#a1a1aa"}}>سؤال {qIdx+1} من {questions.length}</span>
        <span style={{fontSize:"12px",color:"#c4b5fd",fontWeight:"bold"}}>{Math.round(((qIdx+1)/questions.length)*100)}%</span>
      </div>
      <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden",marginBottom:"18px"}}>
        <div style={{height:"100%",width:((qIdx+1)/questions.length*100)+"%",background:"linear-gradient(to left,#7c3aed,#c4b5fd)",borderRadius:"3px",transition:"width 0.3s ease"}}/>
      </div>

      <div style={{...C.card,border:"1px solid rgba(168,85,247,0.2)",marginBottom:"14px"}}>
        <MathText text={q.question} style={{fontSize:"15px",fontWeight:"bold",color:"#fff",lineHeight:"1.6"}}/>
      </div>

      {(q.options||[]).map((opt,i)=>{
        const isSelected = answers[qIdx]===i;
        const letter = String.fromCharCode(65+i); // A, B, C, D
        return <div key={i} onClick={()=>selectAnswer(i)} style={{
          ...C.card, cursor:"pointer", marginBottom:"8px", display:"flex", alignItems:"center", gap:"10px",
          border: isSelected?"1px solid #a855f7":"1px solid rgba(255,255,255,0.06)",
          background: isSelected?"rgba(168,85,247,0.15)":"#18181b",
        }}>
          <div style={{width:"26px",height:"26px",borderRadius:"50%",flexShrink:0,border:`2px solid ${isSelected?"#a855f7":"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"bold",color:isSelected?"#a855f7":"rgba(255,255,255,0.5)"}}>
            {letter}
          </div>
          <MathText text={opt} style={{fontSize:"13px",color:"#fff"}}/>
        </div>;
      })}

      <div style={{display:"flex",gap:"8px",marginTop:"16px"}}>
        {qIdx>0&&<button onClick={goPrev} style={{...C.cancelBtn,flex:1}}>السابق</button>}
        <button onClick={goNext} disabled={answers[qIdx]===null} style={{...C.saveBtn,flex:2,opacity:answers[qIdx]===null?0.5:1,background:qIdx===questions.length-1?"linear-gradient(to right,#7c3aed,#a855f7)":C.saveBtn.background}}>
          {qIdx===questions.length-1?"إنهاء الامتحان":"التالي"}
        </button>
      </div>
    </div>}

    {/* ─── النتيجة ─── */}
    {step==="result"&&result&&<div style={{textAlign:"center"}}>
      <div style={{fontSize:"52px",marginBottom:"8px"}}>{result.passed?(result.score>=80?"🏅":"✅"):"❌"}</div>
      <div style={{fontSize:"32px",fontWeight:"900",color:result.passed?"#4ade80":"#f87171",marginBottom:"4px"}}>{result.score}%</div>
      <div style={{fontSize:"13px",color:"#a1a1aa",marginBottom:"16px"}}>أجبت بشكل صحيح على {result.correct} من أصل {result.total} سؤال</div>
      {result.passed
        ?<div style={{...C.infoBanner,backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",color:"#4ade80",justifyContent:"center"}}>🎉 مبروك! اجتزت امتحان الفصل، الفصل التالي متاح الآن</div>
        :<div style={{...C.infoBanner,backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",justifyContent:"center"}}>لم تحقق نسبة النجاح المطلوبة ({EXAM_PASS_THRESHOLD}%) — راجع الفصل وحاول مرة أخرى</div>
      }
      {!result.passed&&<button onClick={retry} style={{...C.primaryBtn,background:"linear-gradient(to right,#7c3aed,#a855f7)"}}>🔄 إعادة المحاولة</button>}
      <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
    </div>}
  </div></div>;
}

// ─── SLIDES STUDIO ───────────────────────────────────────

function SlidesStudio({slidesTheme,setSlidesTheme,onSaveClip,clips}) {
  // يحسب رقم المقطع التالي واسم الفصل المقترح تلقائياً، بناءً على آخر مقطع محفوظ بنفس المادة/المرحلة/الصف
  const getAutoFill=(subject,stage,grade)=>{
    const matches=(clips||[]).filter(c=>c.subject===subject && c.stage===stage && (!grade||c.grade===grade));
    if(matches.length===0) return {nextNum:1,topic:""};
    let maxNum=0, topicOfMax="";
    matches.forEach(c=>{
      const n=Number(c.num||0);
      if(n>=maxNum){ maxNum=n; topicOfMax=c.topic||topicOfMax; }
    });
    return {nextNum:maxNum+1, topic:topicOfMax};
  };
  const [mode,setMode]=useState("menu");
  const [topic,setTopic]=useState("");
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [slidesCount,setCount]=useState(6);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [slides,setSlides]=useState([]);
  const [curSlide,setCurSlide]=useState(0);
  const [clipTitle,setClipTitle]=useState("");
  const [clipSubj,setClipSubj]=useState("الرياضيات");
  const [clipStage,setClipStage]=useState("الابتدائية");
  const [clipGrade,setClipGrade]=useState("الأول");
  const [clipTopic,setClipTopic]=useState("");
  const [clipNum,setClipNum]=useState(1);
  const [saving,setSaving]=useState(false);
  // تعبئة تلقائية للفصل ورقم المقطع كلما تغيّرت المادة/المرحلة/الصف (تبقى قابلة للتعديل يدوياً)
  useEffect(()=>{
    const auto=getAutoFill(clipSubj,clipStage,clipGrade);
    setClipTopic(auto.topic);
    setClipNum(auto.nextNum);
  },[clipSubj,clipStage,clipGrade]);
  // ─── JSON Import ───
  const [jsonText,setJsonText]=useState("");
  const [jsonErr,setJsonErr]=useState("");
  const JSONSUFFIX=' أجب بـ JSON فقط بلا أي نص خارجه: {"title":"العنوان","slides":[{"title":"عنوان الشريحة","points":["نقطة 1","نقطة 2","نقطة 3"]}]}. مهم: أي رمز \\ داخل معادلات LaTeX (مثل \\omega أو \\frac) يجب كتابته مضاعفاً \\\\ داخل نصوص JSON وإلا يصبح الرد غير صالح.';

  const generate=async(fromImage)=>{
    setLoading(true);
    setLoadMsg(fromImage?" Gemini يقرأ الورقة...":" Gemini يبني الشرائح...");
    try{
      let raw;
      if(fromImage){
        if(!imgB64){showMsg("يرجى رفع صورة أولاً");setLoading(false);return;}
        raw=await callAI("اقرأ هذه الورقة الدراسية وحوّل محتواها إلى "+slidesCount+" شرائح تعليمية."+JSONSUFFIX,imgB64);
      }else{
        if(!topic.trim()){showMsg("يرجى إدخال الموضوع");setLoading(false);return;}
        raw=await callAI("أنشئ "+slidesCount+" شرائح تعليمية احترافية عن الموضوع التالي: "+topic+". اجعل كل شريحة تحتوي على 3-4 نقاط مفيدة وواضحة."+JSONSUFFIX);
      }
      const clean=raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const start=clean.indexOf("{");
      const end=clean.lastIndexOf("}");
      // نصلح أي "\" وحيدة غير صحيحة (رموز LaTeX مثل \omega) بدون كسر تسلسلات الهروب الصحيحة أصلاً مثل \\ أو \n
      const fixed=clean.substring(start,end+1).replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      const parsed=JSON.parse(fixed);
      setSlides(parsed.slides||[]);
      setClipTitle(parsed.title||(fromImage?"شرائح من ورقة":topic));
      setCurSlide(0);
      setMode("result");
    }catch(e){
      showMsg("حدث خطأ: "+e.message+". حاول مرة أخرى.");
    }
    setLoading(false);
  };

  const saveToFirestore=async()=>{
    if(!clipTitle.trim()) return showMsg("أدخل عنوان المقطع");
    setSaving(true);
    try{
      await addDoc(collection(db,"clips"),{title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,topic:clipTopic,num:Number(clipNum)||1,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)",createdAt:serverTimestamp()});
      onSaveClip({title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,topic:clipTopic,num:Number(clipNum)||1,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)"});
      showMsg(" تم حفظ الشرائح في Firebase!");
      setMode("menu");
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSaving(false);
  };

  const importFromJSON=()=>{
    setJsonErr("");
    if(!jsonText.trim()) return setJsonErr("الصق كود JSON أولاً");
    try{
      const clean0=jsonText.replace(/```json/g,"").replace(/```/g,"").trim();
      // نصلح أي "\" وحيدة غير صحيحة بدون كسر تسلسلات الهروب الصحيحة أصلاً مثل \\ أو \n
      const clean=clean0.replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      // تحقق: هل هو مصفوفة (استيراد جماعي) أم مقطع واحد؟
      const firstChar=clean[0];
      if(firstChar==="["){
        // ─── استيراد جماعي ───
        const arr=JSON.parse(clean);
        if(!Array.isArray(arr)||arr.length===0) throw new Error("المصفوفة فارغة");
        arr.forEach((item,i)=>{
          if(!item.slides||!Array.isArray(item.slides)||item.slides.length===0)
            throw new Error("المقطع "+(i+1)+" لا يحتوي على شرائح");
          item.slides.forEach((s,j)=>{
            if(!s.title) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها عنوان");
            if(!Array.isArray(s.points)) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها نقاط");
          });
        });
        setBulkClips(arr);
        setJsonText("");
        setMode("bulk");
      } else {
        // ─── مقطع واحد ───
        const start=clean.indexOf("{");
        const end=clean.lastIndexOf("}");
        if(start===-1||end===-1) throw new Error("تنسيق JSON غير صحيح");
        const parsed=JSON.parse(clean.substring(start,end+1));
        if(!parsed.slides||!Array.isArray(parsed.slides)||parsed.slides.length===0)
          throw new Error("الـ JSON لا يحتوي على شرائح");
        parsed.slides.forEach((s,i)=>{
          if(!s.title) throw new Error("الشريحة "+(i+1)+" ليس فيها عنوان");
          if(!Array.isArray(s.points)) throw new Error("الشريحة "+(i+1)+" ليس فيها نقاط");
        });
        setSlides(parsed.slides);
        setClipTitle(parsed.title||"شرائح مستوردة");
        setCurSlide(0);
        setJsonText("");
        setMode("result");
      }
    }catch(e){
      setJsonErr("خطأ: "+e.message);
    }
  };

  // ─── حفظ جماعي ───────────────────────────────────────────
  const [bulkClips,setBulkClips]=useState([]);
  const [bulkSubj,setBulkSubj]=useState("الرياضيات");
  const [bulkStage,setBulkStage]=useState("الابتدائية");
  const [bulkGrade,setBulkGrade]=useState("الأول");
  const [bulkTopic,setBulkTopic]=useState("");
  const [bulkStartNum,setBulkStartNum]=useState(1);
  const [bulkSaving,setBulkSaving]=useState(false);
  const [bulkProgress,setBulkProgress]=useState(0);
  // تعبئة تلقائية للفصل ورقم بداية المقاطع كلما تغيّرت المادة/المرحلة/الصف (تبقى قابلة للتعديل يدوياً)
  useEffect(()=>{
    const auto=getAutoFill(bulkSubj,bulkStage,bulkGrade);
    setBulkTopic(auto.topic);
    setBulkStartNum(auto.nextNum);
  },[bulkSubj,bulkStage,bulkGrade]);

  const saveBulk=async()=>{
    if(!bulkClips.length) return;
    setBulkSaving(true);
    setBulkProgress(0);
    try{
      for(let i=0;i<bulkClips.length;i++){
        const c=bulkClips[i];
        await addDoc(collection(db,"clips"),{
          title:c.title||"مقطع "+(i+1),
          subject:bulkSubj,
          stage:bulkStage,
          grade:bulkGrade,
          topic:bulkTopic,
          slides:c.slides,
          theme:slidesTheme,
          type:"شرائح AI",
          bg:"linear-gradient(135deg,#1e1b4b,#312e81)",
          num:Number(bulkStartNum)+i,
          createdAt:serverTimestamp()
        });
        setBulkProgress(i+1);
      }
      onSaveClip({title:"جماعي"});
      showMsg("✅ تم حفظ "+bulkClips.length+" مقطع بنجاح!");
      setBulkClips([]);
      setMode("menu");
    }catch(e){
      showMsg("فشل الحفظ: "+e.message);
    }
    setBulkSaving(false);
  };

  const ts=THEME_STYLES[slidesTheme]||THEME_STYLES["أزرق متدرج"];
  const countBtns=<div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>{[4,6,8,10,12].map(n=><button key={n} onClick={()=>setCount(n)} style={{flex:1,padding:"9px",borderRadius:"10px",border:"none",backgroundColor:slidesCount===n?"#7c3aed":"#27272a",color:slidesCount===n?"#fff":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>{n}</button>)}</div>;
  const back=<button onClick={()=>setMode("menu")} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"13px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"4px"}}>← رجوع</button>;

  if(mode==="menu") return <div>
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"16px",padding:"24px",textAlign:"center",marginBottom:"16px"}}>
      <Sparkles size={36} color="#c4b5fd" style={{margin:"0 auto 8px"}}/>
      <div style={{fontSize:"18px",fontWeight:"bold",color:"#c4b5fd",marginBottom:"4px"}}>استوديو الشرائح الذكي</div>
      <div style={{fontSize:"13px",color:"#8b8ba0"}}>مدعوم بـ Google Gemini AI</div>
    </div>
    <div style={{...C.twoCol,marginBottom:"10px"}}>
      <div onClick={()=>setMode("image")} style={{backgroundColor:"rgba(88,28,135,0.25)",border:"1px solid rgba(139,92,246,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <Camera size={32} color="#a855f7" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#c4b5fd"}}>صوّر ورقة الكتاب</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يقرأها ويحوّلها</div>
      </div>
      <div onClick={()=>setMode("text")} style={{backgroundColor:"rgba(3,105,161,0.25)",border:"1px solid rgba(56,189,248,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <BookOpen size={32} color="#38bdf8" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8"}}>كتابة موضوع</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يبني الشرائح</div>
      </div>
    </div>
    {/* ─── خيار استيراد JSON ─── */}
    <div onClick={()=>{setJsonText("");setJsonErr("");setMode("json");}} style={{backgroundColor:"rgba(20,83,45,0.25)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:"16px",padding:"16px 14px",textAlign:"center",cursor:"pointer",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px"}}>
      <FileText size={28} color="#4ade80" style={{flexShrink:0}}/>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#4ade80"}}>استيراد شرائح JSON</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"3px"}}>الصق JSON جاهز من Claude مباشرة</div>
      </div>
    </div>
    <div style={{fontSize:"13px",color:"#38bdf8",fontWeight:"bold",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}><Layers size={14}/> الثيم</div>
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
      {THEMES.map(t=><button key={t.label} onClick={()=>setSlidesTheme(t.label)} style={{padding:"8px 14px",borderRadius:"10px",border:slidesTheme===t.label?"2px solid #38bdf8":"none",backgroundColor:t.color,color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>{t.label}</button>)}
    </div>
  </div>;

  if(mode==="json") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><FileText size={18} color="#4ade80"/> استيراد شرائح JSON</div>
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#4ade80"}}>
      الصق JSON مقطع واحد <strong style={{color:"#fff"}}>{"{ }"}</strong> أو عدة مقاطع دفعة واحدة <strong style={{color:"#fff"}}>{"[ ]"}</strong>
    </div>
    <textarea
      rows={10}
      value={jsonText}
      onChange={e=>{setJsonText(e.target.value);setJsonErr("");}}
      placeholder={'مقطع واحد: {"title":"...","slides":[...]}\nعدة مقاطع: [{"title":"...","slides":[...]},{"title":"...","slides":[...]}]'}
      style={{...C.input,resize:"none",fontFamily:"monospace",fontSize:"12px",direction:"ltr",textAlign:"left"}}
    />
    {jsonErr&&<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"10px"}}>⚠ {jsonErr}</div>}
    <button onClick={importFromJSON} disabled={!jsonText.trim()} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:jsonText.trim()?1:0.5,marginBottom:0}}>
      <FileText size={16}/> استيراد الشرائح
    </button>
  </div>;

  if(mode==="bulk") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
      <Layers size={18} color="#4ade80"/> استيراد جماعي — {bulkClips.length} مقطع
    </div>
    {/* قائمة المقاطع */}
    <div style={{marginBottom:"14px"}}>
      {bulkClips.map((c,i)=>(
        <div key={i} style={{...C.card,display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"bold",color:"#4ade80",flexShrink:0}}>{Number(bulkStartNum)+i}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{c.title||"مقطع "+(i+1)}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{c.slides?.length||0} شرائح</div>
          </div>
        </div>
      ))}
    </div>
    {/* إعدادات مشتركة */}
    <div style={{...C.card,border:"1px solid rgba(34,197,94,0.2)",marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",fontWeight:"bold",marginBottom:"10px"}}>إعدادات مشتركة لكل المقاطع</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
        <select value={bulkSubj} onChange={e=>setBulkSubj(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={bulkStage} onChange={e=>{setBulkStage(e.target.value);setBulkGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:"8px"}}>
        <select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {(GRADES[bulkStage]||[]).map(g=><option key={g}>{g}</option>)}
        </select>
      </div>
      <div style={{fontSize:"10px",color:"#71717a",margin:"8px 0 6px"}}>الفصل ورقم بداية المقاطع مُعبّآن تلقائياً حسب آخر مقطع محفوظ بنفس المادة/المرحلة/الصف — تقدر تعدّلهما يدوياً:</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
        <input value={bulkTopic} onChange={e=>setBulkTopic(e.target.value)} placeholder="الفصل" style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
        <input type="number" value={bulkStartNum} onChange={e=>setBulkStartNum(e.target.value)} placeholder="رقم أول مقطع" style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
      </div>
    </div>
    {/* شريط التقدم */}
    {bulkSaving&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px",textAlign:"center"}}>جارٍ الحفظ... {bulkProgress} / {bulkClips.length}</div>
      <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden"}}>
        <div style={{height:"100%",background:"linear-gradient(to right,#059669,#4ade80)",width:(bulkProgress/bulkClips.length*100)+"%",transition:"width 0.3s"}}/>
      </div>
    </div>}
    <button onClick={saveBulk} disabled={bulkSaving} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:bulkSaving?0.6:1,marginBottom:0}}>
      {bulkSaving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Layers size={16}/> حفظ {bulkClips.length} مقطع دفعة واحدة</>}
    </button>
  </div>;



  if(mode==="image") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><Camera size={18} color="#a855f7"/> صوّر ورقة الكتاب</div>
    <div style={{backgroundColor:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#c4b5fd"}}>
       صوّر صفحة الكتاب أو الورقة — Groq سيقرأها ويحوّلها لشرائح تعليمية
    </div>
    <div style={{marginBottom:"12px"}}>
      {imgPreview&&<img src={imgPreview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
      <label style={{display:"block",width:"100%",padding:"14px",backgroundColor:"rgba(139,92,246,0.08)",border:"2px dashed rgba(139,92,246,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
        <Camera size={26} color="#a855f7" style={{margin:"0 auto 6px"}}/>
        <div style={{fontSize:"13px",color:"#a855f7",fontWeight:"bold"}}>{imgPreview?"تغيير الصورة":"صوّر صفحة الكتاب أو اختر من المعرض"}</div>
        <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
          const file=e.target.files[0]; if(!file) return;
          const reader=new FileReader();
          reader.onload=(ev)=>{
            const img=new Image();
            img.onload=()=>{
              const MAX=800;
              let w=img.width, h=img.height;
              if(w>MAX||h>MAX){
                if(w>h){h=Math.round(h*MAX/w);w=MAX;}
                else{w=Math.round(w*MAX/h);h=MAX;}
              }
              const canvas=document.createElement("canvas");
              canvas.width=w; canvas.height=h;
              const ctx=canvas.getContext("2d");
              ctx.drawImage(img,0,0,w,h);
              const compressed=canvas.toDataURL("image/jpeg",0.5);
              setImgPreview(compressed);
              setImgB64(compressed.split(",")[1]);
            };
            img.src=ev.target.result;
          };
          reader.readAsDataURL(file);
        }}/>
      </label>
    </div>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#a855f7"/><div style={{marginTop:"10px",fontSize:"14px",color:"#a855f7",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button disabled={!imgB64} onClick={()=>generate(true)} style={{...C.purpleBtn,opacity:imgB64?1:0.5}}> Groq يقرأ الورقة ويبني الشرائح</button>}
  </div>;

  if(mode==="text") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><BookOpen size={18} color="#38bdf8"/> كتابة موضوع</div>
    <label style={C.label}> موضوع الشرائح</label>
    <textarea rows={3} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="مثال: الجهاز التنفسي في جسم الإنسان&#10;أو: قوانين نيوتن الثلاثة&#10;أو: الكسور العشرية وعمليات الجمع والطرح" style={{...C.input,resize:"none"}}/>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner/><div style={{marginTop:"10px",fontSize:"14px",color:"#38bdf8",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button onClick={()=>generate(false)} disabled={!topic.trim()} style={{...C.purpleBtn,opacity:topic.trim()?1:0.5}}> Gemini يبني الشرائح الآن</button>}
  </div>;

  if(mode==="result"){const sl=slides[curSlide]||{}; return <div style={{paddingBottom:"80px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      {back}
      <span dir="ltr" style={{color:"#a1a1aa",fontSize:"12px"}}>{curSlide+1} / {slides.length}</span>
    </div>
    <div style={{background:ts.bg,borderRadius:"20px",padding:"24px 18px",minHeight:"220px",marginBottom:"14px",border:"1px solid rgba(255,255,255,0.08)"}}>
      <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"4px 12px",display:"inline-block",marginBottom:"12px",border:"1px solid "+ts.accent+"44"}}><span style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>شريحة {curSlide+1}</span></div>
      <h3 style={{color:"#fff",fontSize:"17px",fontWeight:"bold",margin:"0 0 12px",lineHeight:"1.5"}}><MathText text={sl.title}/></h3>
      <ul style={{listStyle:"none",padding:0,margin:0}}>
        {(sl.points||[]).map((pt,i)=><li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"8px",color:"rgba(255,255,255,0.88)",fontSize:"13px",lineHeight:"1.6"}}><span style={{color:ts.accent,flexShrink:0}}>◆</span><MathText text={pt}/></li>)}
      </ul>
    </div>
    <div style={{display:"flex",gap:"5px",justifyContent:"center",marginBottom:"12px",flexWrap:"wrap"}}>
      {slides.map((_,i)=><div key={i} onClick={()=>setCurSlide(i)} style={{width:i===curSlide?"18px":"7px",height:"7px",borderRadius:"4px",backgroundColor:i===curSlide?ts.accent:"#3f3f46",cursor:"pointer",transition:"width 0.2s"}}/>)}
    </div>
    <div style={{display:"flex",gap:"10px",marginBottom:"12px"}}>
      <button disabled={curSlide===0} onClick={()=>setCurSlide(i=>i-1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===0?"#1c1c1e":"#27272a",color:curSlide===0?"#3f3f46":"#fff",cursor:curSlide===0?"not-allowed":"pointer",fontWeight:"bold"}}>◀ السابق</button>
      <button disabled={curSlide===slides.length-1} onClick={()=>setCurSlide(i=>i+1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===slides.length-1?"#1c1c1e":"#27272a",color:curSlide===slides.length-1?"#3f3f46":"#fff",cursor:curSlide===slides.length-1?"not-allowed":"pointer",fontWeight:"bold"}}>التالي ▶</button>
    </div>
    <div style={{...C.card,border:"1px solid rgba(56,189,248,0.15)"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"10px"}}> حفظ في Firebase</div>
      <input value={clipTitle} onChange={e=>setClipTitle(e.target.value)} placeholder="عنوان المقطع" style={{...C.input,marginBottom:"8px"}}/>
      <div style={{...C.twoCol,marginBottom:"8px"}}>
        <select value={clipSubj} onChange={e=>setClipSubj(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={clipStage} onChange={e=>{setClipStage(e.target.value);setClipGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div style={{marginBottom:"10px"}}>
        <select value={clipGrade} onChange={e=>setClipGrade(e.target.value)} style={{width:"100%",padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{(GRADES[clipStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
      </div>
      <div style={{...C.twoCol,marginBottom:"10px"}}>
        <input value={clipTopic} onChange={e=>setClipTopic(e.target.value)} placeholder="الفصل (تلقائي، قابل للتعديل)" style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}/>
        <input type="number" value={clipNum} onChange={e=>setClipNum(e.target.value)} placeholder="رقم المقطع" style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}/>
      </div>
      <button onClick={saveToFirestore} disabled={saving} style={{...C.primaryBtn,marginBottom:0,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الشرائح في Firebase</>}
      </button>
    </div>
  </div>;}
  return null;
}

// ─── ADMIN PDF TAB ───────────────────────────────────────
// ─── طلبات ملازم الأساتذة ────────────────────────────────
function TeacherPDFRequests() {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const unsub=onSnapshot(
      query(collection(db,"teacherPdfs"),orderBy("createdAt","desc")),
      snap=>{setRequests(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);}
    );
    return()=>unsub();
  },[]);

  const approve=async(req)=>{
    try{
      await addDoc(collection(db,"pdfs"),{
        name:req.name,subject:req.subject,stage:req.stage,grade:req.grade||"",
        url:req.url,watermark:req.watermark||"",teacherName:req.teacherName,
        uploadedBy:req.phone,approvedAt:serverTimestamp(),
      });
      await updateDoc(doc(db,"teacherPdfs",req.id),{status:"approved",approvedAt:serverTimestamp()});
      showMsg("✅ تمت الموافقة ونُشرت الملزمة");
    }catch(e){showMsg("فشل: "+e.message);}
  };

  const reject=async(req)=>{
    try{
      await updateDoc(doc(db,"teacherPdfs",req.id),{status:"rejected",rejectedAt:serverTimestamp()});
      // لو كانت الملزمة منشورة فعلاً (موافق عليها سابقاً)، نسحبها من القائمة المنشورة للطلاب
      if(req.status==="approved"){
        const snap=await getDocs(query(collection(db,"pdfs"),where("url","==",req.url)));
        for(const d of snap.docs){ await deleteDoc(doc(db,"pdfs",d.id)); }
      }
      showMsg("تم الرفض");
    }catch(e){showMsg("فشل: "+e.message);}
  };

  const deleteRequest=async(req)=>{
    try{
      await deleteDoc(doc(db,"teacherPdfs",req.id));
      showMsg("تم حذف الطلب");
    }catch(e){showMsg("فشل الحذف: "+e.message);}
  };

  const statusColor={"pending":"#fbbf24","approved":"#4ade80","rejected":"#f87171"};
  const statusLabel={"pending":"⏳ بانتظار المراجعة","approved":"✅ تمت الموافقة","rejected":"❌ مرفوض"};

  return <div>
    <div style={{...C.infoBanner,marginBottom:"14px"}}><BookOpen size={15}/> طلبات رفع الملازم من الأساتذة</div>
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :requests.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><BookOpen size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد طلبات بعد</div></div>
      :requests.map(r=>(
        <div key={r.id} style={{...C.card,border:`1px solid ${r.status==="pending"?"rgba(251,191,36,0.3)":r.status==="approved"?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`,marginBottom:"10px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
            <div>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{r.name}</div>
              <div style={{fontSize:"12px",color:"#71717a",marginTop:"2px"}}>{r.teacherName} • {r.subject} • {r.stage}{r.grade?" • الصف "+r.grade:""}</div>
            </div>
            <span style={{fontSize:"11px",fontWeight:"bold",color:statusColor[r.status]||"#fbbf24"}}>{statusLabel[r.status]||"⏳"}</span>
          </div>
          {r.watermark&&<div style={{fontSize:"11px",color:"#a855f7",marginBottom:"8px"}}>💧 علامة مائية: "{r.watermark}"</div>}
          <div style={{display:"flex",gap:"8px"}}>
            <a href={r.url} target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",background:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>معاينة 👁</a>
            {r.status!=="approved"&&<button onClick={()=>approve(r)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.1)",color:"#4ade80",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>موافقة ✅</button>}
            {r.status!=="rejected"&&<button onClick={()=>reject(r)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(248,113,113,0.3)",background:"rgba(248,113,113,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>رفض ❌</button>}
            <button onClick={()=>deleteRequest(r)} style={{padding:"8px 10px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#a1a1aa",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}><Trash2 size={13}/></button>
          </div>
        </div>
      ))
    }
  </div>;
}

// ─── نموذج رفع ملزمة (للأستاذ) ──────────────────────────
function UploadPDFModal({onClose, currentStudent}) {
  const [name,setName]=useState("");
  const [subject,setSubject]=useState("الرياضيات");
  const [stage,setStage]=useState("الابتدائية");
  const [grade,setGrade]=useState("الأول");
  const [url,setUrl]=useState("");
  const [watermark,setWatermark]=useState("");
  const [useWatermark,setUseWatermark]=useState(false);
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);

  const submit=async()=>{
    if(!name.trim()) return showMsg("أدخل اسم الملزمة");
    if(!url.trim()) return showMsg("أدخل رابط الملزمة");
    setSaving(true);
    try{
      await addDoc(collection(db,"teacherPdfs"),{
        name:name.trim(),subject,stage,grade,
        url:url.trim(),
        watermark:useWatermark?watermark.trim():"",
        teacherName:currentStudent?.name||"أستاذ",
        phone:currentStudent?.phone||"",
        status:"pending",
        createdAt:serverTimestamp(),
      });
      setDone(true);
    }catch(e){showMsg("فشل: "+e.message);}
    setSaving(false);
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.3)"}}>
    <MHead icon={<BookOpen size={20} color="#f97316"/>} title="رفع ملزمة" color="#f97316" onClose={onClose}/>

    {done?<div style={{textAlign:"center",padding:"24px"}}>
      <div style={{fontSize:"48px",marginBottom:"12px"}}>✅</div>
      <div style={{fontWeight:"bold",fontSize:"16px",color:"#4ade80",marginBottom:"8px"}}>تم إرسال الطلب!</div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"20px"}}>سيراجع المدير ملزمتك ويوافق عليها قريباً</div>
      <button onClick={onClose} style={{...C.primaryBtn,marginBottom:0}}>حسناً</button>
    </div>:<>
      <div style={{backgroundColor:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:"12px",padding:"10px 14px",marginBottom:"14px",fontSize:"12px",color:"#f97316"}}>
        📋 ستُنشر الملزمة للطلاب بعد مراجعة وموافقة المدير
      </div>

      <label style={C.label}>اسم الملزمة</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: ملزمة الكيمياء للسادس العلمي" style={C.input}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
        <div>
          <label style={C.label}>المادة</label>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={C.label}>المرحلة</label>
          <select value={stage} onChange={e=>{setStage(e.target.value);setGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={C.select}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <label style={C.label}>الصف</label>
      <select value={grade} onChange={e=>setGrade(e.target.value)} style={{...C.select,marginBottom:"12px"}}>
        {(GRADES[stage]||[]).map(g=><option key={g}>{g}</option>)}
      </select>

      <label style={C.label}>رابط الملزمة (PDF)</label>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={C.input} dir="ltr"/>

      {/* العلامة المائية */}
      <div style={{backgroundColor:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:useWatermark?"10px":"0"}}>
          <div>
            <div style={{fontWeight:"bold",fontSize:"13px",display:"flex",alignItems:"center",gap:"6px"}}>💧 علامة مائية</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>اسمك يظهر شفافاً على كل صفحة</div>
          </div>
          <button onClick={()=>setUseWatermark(w=>!w)} style={{padding:"6px 14px",borderRadius:"8px",border:`1px solid ${useWatermark?"rgba(168,85,247,0.4)":"rgba(255,255,255,0.1)"}`,background:useWatermark?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.03)",color:useWatermark?"#a855f7":"#71717a",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
            {useWatermark?"مفعّلة ✓":"تفعيل"}
          </button>
        </div>
        {useWatermark&&<input value={watermark} onChange={e=>setWatermark(e.target.value)} placeholder={`مثال: ${currentStudent?.name||"اسم الأستاذ"}`} style={C.input}/>}
      </div>

      <button onClick={submit} disabled={saving} style={{...C.primaryBtn,background:"linear-gradient(to left,#f97316,#fb923c)",marginBottom:0,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={16}/> جارٍ الإرسال...</>:<><BookOpen size={16}/> إرسال الطلب للمدير</>}
      </button>
    </>}
  </div></div>;
}

function AdminPDFTab() {
  const [pdfs,setPdfs]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [editingPdf,setEditingPdf]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [pdfName,setPdfName]=useState("");
  const [pdfSubject,setPdfSubject]=useState("الرياضيات");
  const [pdfStage,setPdfStage]=useState("الابتدائية");
  const [pdfGrade,setPdfGrade]=useState("الأول");
  const [pdfTeacher,setPdfTeacher]=useState("");
  const [pdfUrl,setPdfUrl]=useState("");
  const [pdfThumb,setPdfThumb]=useState(null);
  const [saving,setSaving]=useState(false);
  const [downloadEnabled,setDownloadEnabled]=useState(true);
  const [togglingDownload,setTogglingDownload]=useState(false);
  const [searchText,setSearchText]=useState("");

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"pdfs"),snap=>{
      setPdfs(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","pdfDownload"),snap=>{
      if(snap.exists()) setDownloadEnabled(snap.data().enabled!==false);
      else setDownloadEnabled(true);
    });
    return()=>unsub();
  },[]);

  const toggleDownload=async()=>{
    setTogglingDownload(true);
    try{
      await setDoc(doc(db,"settings","pdfDownload"),{enabled:!downloadEnabled,updatedAt:serverTimestamp()});
      setDownloadEnabled(e=>!e);
    }catch(e){showMsg("فشل: "+e.message);}
    setTogglingDownload(false);
  };

  const openEdit=(f)=>{
    setEditingPdf(f);
    setPdfName(f.name||"");
    setPdfSubject(f.subject||"الرياضيات");
    setPdfStage(f.stage||"الابتدائية");
    setPdfGrade(f.grade||(GRADES[f.stage||"الابتدائية"]||[])[0]||"الأول");
    setPdfTeacher(f.teacherName||"");
    setPdfUrl(f.url||"");
    setShowForm(true);
  };

  const doDelete=async(f)=>{
    try{ await deleteDoc(doc(db,"pdfs",f.id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل: "+e.message); }
    setConfirmDelete(null);
  };

  const savePDF=async()=>{
    if(!pdfName.trim()||!pdfUrl.trim()) return showMsg("أدخل الاسم والرابط");
    setSaving(true);
    try{
      if(editingPdf&&editingPdf.id){
        await updateDoc(doc(db,"pdfs",editingPdf.id),{name:pdfName,subject:pdfSubject,stage:pdfStage,grade:pdfGrade,teacherName:pdfTeacher.trim(),url:pdfUrl});
        showMsg("تم تعديل الملف");
      } else {
        await addDoc(collection(db,"pdfs"),{name:pdfName,subject:pdfSubject,stage:pdfStage,grade:pdfGrade,teacherName:pdfTeacher.trim(),url:pdfUrl,thumbUrl:pdfThumb,createdAt:serverTimestamp()});
        showMsg("تم حفظ الملف");
      }
      setShowForm(false);setEditingPdf(null);setPdfName("");setPdfUrl("");setPdfThumb(null);setPdfTeacher("");
    }catch(e){showMsg("فشل: "+e.message);}
    setSaving(false);
  };
  return <div>
    {/* زر تحكم التحميل */}
    <div style={{backgroundColor:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}><FileText size={16} color="#f97316"/> تحميل الملازم</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>{downloadEnabled?"مسموح — الطلاب المؤهلون يستطيعون التحميل":"موقوف — لا أحد يستطيع التحميل"}</div>
      </div>
      <button onClick={toggleDownload} disabled={togglingDownload} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:downloadEnabled?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)",color:downloadEnabled?"#f87171":"#4ade80",fontWeight:"bold",fontSize:"13px",cursor:"pointer",border:`1px solid ${downloadEnabled?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)"}`}}>
        {togglingDownload?"...":downloadEnabled?"⏸ إيقاف التحميل":"▶ السماح بالتحميل"}
      </button>
    </div>
    <div style={C.infoBanner}><FileText size={15}/> الملازم والبحوث المدفوعة — للطلاب المشتركين فقط</div>
    <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملف أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>
    {confirmDelete&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#f87171",fontWeight:"bold",marginBottom:"8px"}}>هل تريد حذف هذا الملف؟</div>
        <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
          <button onClick={()=>doDelete(confirmDelete)} style={{padding:"8px 20px",backgroundColor:"#ef4444",border:"none",borderRadius:"8px",color:"#fff",fontWeight:"bold",cursor:"pointer"}}>نعم</button>
          <button onClick={()=>setConfirmDelete(null)} style={{padding:"8px 20px",backgroundColor:"#27272a",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer"}}>لا</button>
        </div>
      </div>
    )}
    {pdfs.filter(f=>{
      if(!searchText.trim()) return true;
      const q=searchText.trim();
      return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
    }).map(f=>(
      <div key={f.id} style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
          {f.thumbUrl&&<img src={f.thumbUrl} alt="" style={{width:40,height:40,borderRadius:"8px",objectFit:"cover"}}/>}
          <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:"14px"}}>{f.name}</div><div style={{fontSize:"12px",color:"#71717a"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div></div>
          <a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 10px",color:"#f97316",fontSize:"12px",textDecoration:"none",fontWeight:"bold"}}>فتح</a>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>openEdit(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
          <button onClick={()=>setConfirmDelete(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حذف</button>
          <button onClick={()=>updateDoc(doc(db,"pdfs",f.id),{downloadBlocked:!f.downloadBlocked})} style={{flex:1,padding:"7px",borderRadius:"8px",border:`1px solid ${f.downloadBlocked?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,backgroundColor:f.downloadBlocked?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.08)",color:f.downloadBlocked?"#4ade80":"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
            {f.downloadBlocked?"▶ تفعيل":"⏸ إيقاف"}
          </button>
        </div>
      </div>
    ))}
    {!showForm?<button style={C.gradBtn} onClick={()=>{setEditingPdf(null);setPdfName("");setPdfUrl("");setPdfGrade((GRADES[pdfStage]||[])[0]||"الأول");setPdfTeacher("");setShowForm(true);}}><Plus size={18}/> إضافة ملف PDF جديد</button>
    :<div style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
      <div style={{color:"#f97316",fontWeight:"bold",fontSize:"14px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"6px"}}><FileText size={16}/> بيانات الملف الجديد</div>
      <label style={C.label}>اسم الملف</label>
      <input type="text" value={pdfName} onChange={e=>setPdfName(e.target.value)} placeholder="مثال: ملزمة الرياضيات الفصل الأول" style={C.input}/>
      <div style={C.twoCol}>
        <div><label style={C.label}>المادة</label><select value={pdfSubject} onChange={e=>setPdfSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={C.label}>المرحلة</label><select value={pdfStage} onChange={e=>{const s=e.target.value;setPdfStage(s);setPdfGrade((GRADES[s]||[])[0]||"الأول");}} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <label style={C.label}>الصف</label>
      <select value={pdfGrade} onChange={e=>setPdfGrade(e.target.value)} style={C.select}>{(GRADES[pdfStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
      <label style={C.label}> اسم الأستاذ (اختياري)</label>
      <input type="text" value={pdfTeacher} onChange={e=>setPdfTeacher(e.target.value)} placeholder="مثال: أ. محمد" style={C.input}/>
      <label style={C.label}> رابط PDF (Google Drive)</label>
      <input type="url" value={pdfUrl} onChange={e=>setPdfUrl(e.target.value)} placeholder="https://drive.google.com/file/..." style={C.input}/>
      <label style={C.label}> صورة مصغرة (اختياري)</label>
      <ImageUploader onUpload={url=>setPdfThumb(url)} onBase64={()=>{}} color="#f97316" label="اختر صورة للملف"/>
      <div style={C.saveRow}>
        <button style={C.cancelBtn} onClick={()=>{setShowForm(false);setEditingPdf(null);}}>إلغاء</button>
        <button disabled={saving} style={{...C.saveBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",opacity:saving?0.7:1}} onClick={savePDF}>
          {saving?<><Spinner size={15}/> جارٍ...</>:<><Save size={15}/> حفظ</>}
        </button>
      </div>
    </div>}
  </div>;
}

// ─── ADMIN WALLET TAB ────────────────────────────────────
function AdminWalletTab() {
  const [payments,setPayments]=useState([]);
  const [zaincash,setZaincash]=useState(ZAINCASH_NUM);
  const [editingNum,setEditingNum]=useState(false);
  const [newNum,setNewNum]=useState(ZAINCASH_NUM);
  useEffect(()=>{const unsub=onSnapshot(collection(db,"payments"),snap=>{setPayments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));});return()=>unsub();},[]);
  const totalReceived=payments.filter(p=>p.status==="approved").reduce((s,p)=>s+Number(p.amount||0),0);
  const pending=payments.filter(p=>p.status==="pending");
  const approvePayment=async(p)=>{
    let days=p.duration||30;
    let bonusApplied=0;
    try{
      // لو الطالب مسجّل بكود شراكة ولم يستلم الخصم بعد، نضيف الأيام المجانية على أول اشتراك فقط
      const studentSnap = await getDoc(doc(db,"students",p.studentPhone));
      if(studentSnap.exists()){
        const sd = studentSnap.data();
        if(sd.campaignCode && !sd.campaignBonusGiven && Number(sd.campaignBonusDays)>0){
          bonusApplied = Number(sd.campaignBonusDays);
          days += bonusApplied;
        }
      }
    }catch{}
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+days);
    try{
      await addDoc(collection(db,"subscriptions"),{studentPhone:p.studentPhone,studentName:p.studentName,subject:p.subject,stage:p.stage,grade:p.grade||"",duration:days,expiresAt:expiresAt.toISOString(),activatedAt:serverTimestamp()});
      if(bonusApplied>0){
        await updateDoc(doc(db,"students",p.studentPhone),{campaignBonusGiven:true});
      }
      await sendNotification({phone:p.studentPhone,title:" تم تفعيل اشتراكك!",body:"تم تفعيل اشتراكك في "+p.subject+" ("+p.stage+(p.grade?" - "+p.grade:"")+") لمدة "+days+" يوم"+(bonusApplied>0?" (تشمل "+bonusApplied+" يوم هدية ترحيبية 🎁)":"")+". ينتهي في "+expiresAt.toLocaleDateString("ar")});
      await addDoc(collection(db,"payments"),{...p,status:"approved",approvedAt:serverTimestamp()});
      showMsg(" تم تفعيل اشتراك "+p.subject+" لـ "+p.studentName+(bonusApplied>0?" (+"+bonusApplied+" يوم هدية)":""));
    }catch(e){showMsg("فشل: "+e.message);}
  };
  const rejectPayment=async(p)=>{
    const reason = window.prompt("سبب الرفض (اختياري، سيظهر للطالب):","");
    if(reason===null) return; // ألغى المدير العملية
    try{
      await addDoc(collection(db,"payments"),{...p,status:"rejected"});
      // إشعار الطالب بالرفض وسببه — بدل ما يبقى ينتظر بدون معرفة وش صار (كان يصير رفض بصمت سابقاً)
      await sendNotification({
        phone:p.studentPhone,
        title:"❌ تم رفض طلب اشتراكك",
        body:"تم رفض طلب اشتراكك في "+p.subject+" ("+p.stage+")"+(reason.trim()?" — السبب: "+reason.trim():"")+". تواصل مع المدير لمزيد من التفاصيل أو أعد المحاولة.",
      });
      showMsg("تم رفض الدفع وإشعار الطالب");
    }catch(e){showMsg("فشل: "+e.message);}
  };
  return <div>
    <div style={{background:"linear-gradient(135deg,#14532d,#15803d)",borderRadius:"16px",padding:"20px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.7)",marginBottom:"4px"}}>رقم زين كاش للاستلام</div>
      {editingNum?(
        <div style={{display:"flex",gap:"8px",justifyContent:"center",alignItems:"center"}}>
          <input value={newNum} onChange={e=>setNewNum(e.target.value)} style={{padding:"8px 12px",backgroundColor:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"8px",color:"#fff",fontSize:"16px",outline:"none",textAlign:"center",width:"170px"}}/>
          <button onClick={()=>{setZaincash(newNum);setEditingNum(false);}} style={{backgroundColor:"#4ade80",border:"none",borderRadius:"8px",padding:"8px 14px",color:"#000",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}}>حفظ</button>
        </div>
      ):(
        <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px",cursor:"pointer"}} onClick={()=>setEditingNum(true)}>{zaincash}</div>
      )}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"14px"}}>
      {[["✅",totalReceived.toLocaleString()+" د.ع","المستلم"],["⏳",pending.length,"معلقة"],["✔",payments.filter(p=>p.status==="approved").length,"مؤكدة"]].map(([icon,val,label])=>(
        <div key={label} style={C.statCard}><div style={{fontSize:"18px"}}>{icon}</div><div style={{fontSize:"14px",fontWeight:"bold",color:"#4ade80",margin:"2px 0"}}>{val}</div><div style={{fontSize:"10px",color:"#71717a"}}>{label}</div></div>
      ))}
    </div>
    {pending.length>0&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#fbbf24",marginBottom:"8px"}}> طلبات تحتاج موافقة ({pending.length})</div>
      {pending.map(p=>(
        <div key={p.id} style={{...C.card,border:"1px solid rgba(234,179,8,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div><div style={{fontWeight:"bold",fontSize:"14px"}}>{p.studentName}</div><div style={{fontSize:"12px",color:"#71717a"}}> {p.studentPhone}</div><div style={{fontSize:"12px",color:"#38bdf8"}}> {p.subject} — {p.stage}{p.grade?" — الصف "+p.grade:""}</div><div style={{fontSize:"12px",color:"#a855f7"}}> {p.durationLabel}</div><div style={{fontSize:"13px",color:"#4ade80",fontWeight:"bold"}}> {p.amount} د.ع</div></div>
            {p.receiptUrl&&<img src={p.receiptUrl} alt="إيصال" style={{width:65,height:65,borderRadius:"10px",objectFit:"cover",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}} onClick={()=>window.open(p.receiptUrl,"_blank")}/>}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>approvePayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",color:"#4ade80",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✅ قبول وتفعيل</button>
            <button onClick={()=>rejectPayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",color:"#f87171",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✗ رفض</button>
          </div>
        </div>
      ))}
    </div>}
    <div style={{fontSize:"13px",fontWeight:"bold",color:"#a1a1aa",marginBottom:"8px"}}> سجل المدفوعات</div>
    {payments.filter(p=>p.status!=="pending").slice(0,20).map(p=>(
      <div key={p.id} style={{...C.card,borderRight:`3px solid ${p.status==="approved"?"#4ade80":"#f87171"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{p.studentName}</div><div style={{fontSize:"11px",color:"#71717a"}}>{p.subject} • {p.stage}{p.grade?" • الصف "+p.grade:""}</div></div>
          <div style={{textAlign:"left"}}><div style={{fontWeight:"bold",fontSize:"13px",color:"#4ade80"}}>{p.amount} د.ع</div><div style={{fontSize:"11px",color:p.status==="approved"?"#4ade80":"#f87171"}}>{p.status==="approved"?" مقبول":" مرفوض"}</div></div>
        </div>
      </div>
    ))}
  </div>;
}

// ─── ADMIN CODES TAB (نظام أكواد التفعيل) ────────────────
function AdminCodesTab() {
  const [subject,setSubject]=useState(SUBJECTS[0]);
  const [stage,setStage]=useState(STAGES[0]);
  const [grade,setGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [duration,setDuration]=useState(DURATIONS[0]);
  const [generating,setGenerating]=useState(false);
  const [lastCode,setLastCode]=useState(null);
  const [codes,setCodes]=useState([]);
  const [copiedCode,setCopiedCode]=useState("");
  const [filterText,setFilterText]=useState("");
  const [prices,setPrices]=useState({});

  useEffect(()=>{
    // ✅ إصلاح: كانت هذه الشاشة تقرأ من doc(db,"settings","prices") وهو مستند
    // لا تكتب فيه شاشة "الأسعار" أي شيء (هي تكتب بمجموعة prices منفصلة)، فكانت
    // كل مادة تظهر دائماً "مجانية" هنا حتى لو محدد لها سعر فعلي بتبويب الأسعار.
    // الآن نقرأ من نفس المصدر الحقيقي (collection "prices") المستخدم في كل مكان آخر بالتطبيق.
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage&&data.value!==undefined){
          vals[data.subject+"__"+data.stage]=data.value;
        }
      });
      setPrices(vals);
    });
    return ()=>unsub();
  },[]);

  const selectionIsFree = isFreeSubject(prices,subject,stage);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"codes"),snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      setCodes(list);
    });
    return ()=>unsub();
  },[]);

  const onStageChange=(s)=>{ setStage(s); setGrade((GRADES[s]||[])[0]||""); };

  const generate=async()=>{
    if(selectionIsFree){ showMsg("هذه المادة مجانية حالياً، لا حاجة لتوليد كود"); return; }
    setGenerating(true);
    try{
      let code=""; let attempts=0; let free=false;
      // نتأكد أن الكود فريد فعلياً بقاعدة البيانات قبل اعتماده (مو فقط عشوائي)
      while(!free && attempts<8){
        code=generateRandomCode(7);
        const snap=await getDoc(doc(db,"codes",code));
        free=!snap.exists();
        attempts++;
      }
      if(!free){ showMsg("تعذّر توليد كود فريد، حاول مرة أخرى"); setGenerating(false); return; }
      await setDoc(doc(db,"codes",code),{
        code, subject, stage, grade,
        durationDays: duration.days, durationLabel: duration.label,
        used:false, usedBy:"", usedByName:"", usedAt:null,
        createdAt: serverTimestamp(),
      });
      setLastCode(code);
      showMsg("✅ تم توليد الكود بنجاح");
    }catch(e){ showMsg("فشل توليد الكود: "+e.message); }
    setGenerating(false);
  };

  const copyCode=(c)=>{
    try{ navigator.clipboard?.writeText(c); setCopiedCode(c); setTimeout(()=>setCopiedCode(""),1500); }catch{}
  };

  const removeCode=async(c)=>{
    try{ await deleteDoc(doc(db,"codes",c.id)); showMsg("تم حذف الكود"); }catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  const filtered=codes.filter(c=>!filterText || c.code.includes(filterText.toUpperCase()) || c.subject?.includes(filterText) || c.usedByName?.includes(filterText));
  const unusedCount=codes.filter(c=>!c.used).length;
  const usedCount=codes.filter(c=>c.used).length;

  return <div>
    {/* توليد كود جديد */}
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"16px",padding:"18px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <Key size={18} color="#c4b5fd"/>
        <span style={{fontSize:"14px",fontWeight:"bold",color:"#c4b5fd"}}>توليد كود اشتراك جديد</span>
      </div>
      <div style={C.twoCol}>
        <div>
          <label style={C.label}>المادة</label>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label style={C.label}>المرحلة</label>
          <select value={stage} onChange={e=>onStageChange(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
        </div>
      </div>
      <label style={C.label}>الصف</label>
      <select value={grade} onChange={e=>setGrade(e.target.value)} style={C.select}>{(GRADES[stage]||[]).map(g=><option key={g}>{g}</option>)}</select>

      {selectionIsFree&&(
        <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"10px",padding:"10px 12px",marginBottom:"14px",fontSize:"12px",color:"#fbbf24",display:"flex",alignItems:"center",gap:"6px"}}>
          ⚠ هذه المادة مجانية حالياً (سعرها 0 بتبويب الأسعار) — الطلاب أصلاً عندهم وصول كامل بدون كود
        </div>
      )}

      <label style={C.label}>مدة الاشتراك</label>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
        {DURATIONS.map(d=><button key={d.days} onClick={()=>setDuration(d)} style={{flex:1,padding:"9px 4px",borderRadius:"10px",border:"none",backgroundColor:duration.days===d.days?"#a855f7":"#27272a",color:"#fff",fontWeight:"bold",fontSize:"10px",cursor:"pointer"}}>{d.label}</button>)}
      </div>
      <button onClick={generate} disabled={generating||selectionIsFree} style={{...C.purpleBtn,opacity:(generating||selectionIsFree)?0.5:1}}>
        {generating?<><Spinner size={16}/> جارٍ التوليد...</>:<><Key size={16}/> توليد كود</>}
      </button>
      {lastCode&&(
        <div style={{marginTop:"14px",backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"12px",padding:"14px",textAlign:"center"}}>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>الكود الجديد — أرسله للطالب</div>
          <div style={{fontSize:"26px",fontWeight:"900",letterSpacing:"3px",color:"#fff",marginBottom:"10px",fontFamily:"monospace"}}>{lastCode}</div>
          <button onClick={()=>copyCode(lastCode)} style={{padding:"8px 18px",borderRadius:"10px",border:"none",backgroundColor:copiedCode===lastCode?"#4ade80":"#7c3aed",color:copiedCode===lastCode?"#000":"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}}>
            {copiedCode===lastCode?<><CheckCircle size={14}/> تم النسخ</>:<><Copy size={14}/> نسخ الكود</>}
          </button>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>{subject} • {stage} • {grade} • {duration.label}</div>
        </div>
      )}
    </div>

    {/* إحصائيات سريعة */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
      <div style={C.statCard}><div style={{fontSize:"18px",fontWeight:"bold",color:"#fbbf24"}}>{unusedCount}</div><div style={{fontSize:"10px",color:"#71717a"}}>أكواد غير مستخدمة</div></div>
      <div style={C.statCard}><div style={{fontSize:"18px",fontWeight:"bold",color:"#4ade80"}}>{usedCount}</div><div style={{fontSize:"10px",color:"#71717a"}}>أكواد مُستخدمة</div></div>
    </div>

    {/* قائمة الأكواد */}
    <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="ابحث بالكود أو المادة أو اسم الطالب..." style={{...C.input,marginBottom:"10px"}}/>
    {filtered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Key size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أكواد بعد</div></div>
      :filtered.map(c=>(
        <div key={c.id} style={{...C.card,border:c.used?"1px solid rgba(74,222,128,0.2)":"1px solid rgba(251,191,36,0.25)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
            <div style={{fontFamily:"monospace",fontSize:"16px",fontWeight:"900",letterSpacing:"2px"}}>{c.code}</div>
            <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"6px",fontWeight:"bold",backgroundColor:c.used?"rgba(74,222,128,0.15)":"rgba(251,191,36,0.15)",color:c.used?"#4ade80":"#fbbf24"}}>{c.used?"مُستخدم":"غير مستخدم"}</span>
          </div>
          <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"4px"}}>{c.subject} • {c.stage} • {c.grade} • {c.durationLabel}</div>
          {c.used
            ?<div style={{fontSize:"11px",color:"#71717a"}}>استخدمه: {c.usedByName||c.usedBy||"—"}</div>
            :<button onClick={()=>removeCode(c)} style={{marginTop:"6px",padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"11px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Trash2 size={12}/> حذف الكود</button>
          }
        </div>
      ))
    }
  </div>;
}

// ─── ADMIN PARTNERS TAB (أكواد شراكة للصفحات/المجموعات) ──
function AdminPartnersTab() {
  const [label,setLabel]=useState("");
  const [maxUses,setMaxUses]=useState(75);
  const [bonusDays,setBonusDays]=useState(15);
  const [durationDays,setDurationDays]=useState(30);
  const [generating,setGenerating]=useState(false);
  const [lastCode,setLastCode]=useState(null);
  const [campaigns,setCampaigns]=useState([]);
  const [copiedCode,setCopiedCode]=useState("");

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"campaignCodes"),snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      setCampaigns(list);
    });
    return ()=>unsub();
  },[]);

  const generate=async()=>{
    if(!label.trim()) return showMsg("أدخل اسم الصفحة/المجموعة الشريكة أولاً");
    setGenerating(true);
    try{
      let code=""; let attempts=0; let free=false;
      while(!free && attempts<8){
        code=generateRandomCode(7);
        const snap=await getDoc(doc(db,"campaignCodes",code));
        free=!snap.exists();
        attempts++;
      }
      if(!free){ showMsg("تعذّر توليد كود فريد، حاول مرة أخرى"); setGenerating(false); return; }
      const expiresAt=new Date();
      expiresAt.setDate(expiresAt.getDate()+Number(durationDays||30));
      await setDoc(doc(db,"campaignCodes",code),{
        code, label:label.trim(),
        maxUses:Number(maxUses)||50, usedCount:0,
        bonusDays:Number(bonusDays)||0,
        expiresAt: expiresAt.toISOString(),
        active:true,
        createdAt: serverTimestamp(),
      });
      setLastCode(code);
      setLabel("");
      showMsg("✅ تم توليد كود الشراكة بنجاح");
    }catch(e){ showMsg("فشل توليد الكود: "+e.message); }
    setGenerating(false);
  };

  const copyCode=(c)=>{
    try{ navigator.clipboard?.writeText(c); setCopiedCode(c); setTimeout(()=>setCopiedCode(""),1500); }catch{}
  };

  const toggleActive=async(camp)=>{
    try{ await updateDoc(doc(db,"campaignCodes",camp.id),{active:!camp.active}); }catch(e){ showMsg("فشل: "+e.message); }
  };

  const removeCampaign=async(camp)=>{
    try{ await deleteDoc(doc(db,"campaignCodes",camp.id)); showMsg("تم حذف كود الشراكة"); }catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  const isExpired=(camp)=> new Date(camp.expiresAt) < new Date();
  const isFull=(camp)=> (camp.usedCount||0) >= (camp.maxUses||0);

  return <div>
    <div style={{background:"linear-gradient(135deg,#0c4a6e,#0369a1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"16px",padding:"18px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <Share2 size={18} color="#7dd3fc"/>
        <span style={{fontSize:"14px",fontWeight:"bold",color:"#7dd3fc"}}>توليد كود شراكة جديد</span>
      </div>
      <label style={C.label}>اسم الصفحة/المجموعة الشريكة</label>
      <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="مثال: صفحة فيسبوك — ثانوية بغداد" style={{...C.input,marginBottom:"10px"}}/>
      <div style={C.twoCol}>
        <div>
          <label style={C.label}>سقف عدد الطلاب</label>
          <input type="number" value={maxUses} onChange={e=>setMaxUses(e.target.value)} style={{...C.input,marginBottom:"10px"}}/>
        </div>
        <div>
          <label style={C.label}>مدة الصلاحية (يوم)</label>
          <input type="number" value={durationDays} onChange={e=>setDurationDays(e.target.value)} style={{...C.input,marginBottom:"10px"}}/>
        </div>
      </div>
      <label style={C.label}>أيام مجانية إضافية للطالب الجديد (خصم)</label>
      <input type="number" value={bonusDays} onChange={e=>setBonusDays(e.target.value)} style={{...C.input,marginBottom:"12px"}}/>
      <button onClick={generate} disabled={generating} style={{...C.purpleBtn,background:"linear-gradient(to right,#0284c7,#38bdf8)",opacity:generating?0.7:1}}>
        {generating?<><Spinner size={16}/> جارٍ التوليد...</>:<><Share2 size={16}/> توليد كود الشراكة</>}
      </button>
      {lastCode&&(
        <div style={{marginTop:"14px",backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"12px",padding:"14px",textAlign:"center"}}>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>الكود الجديد — شاركه مع الصفحة</div>
          <div style={{fontSize:"26px",fontWeight:"900",letterSpacing:"3px",color:"#fff",marginBottom:"10px",fontFamily:"monospace"}}>{lastCode}</div>
          <button onClick={()=>copyCode(lastCode)} style={{padding:"8px 18px",borderRadius:"10px",border:"none",backgroundColor:copiedCode===lastCode?"#4ade80":"#0284c7",color:copiedCode===lastCode?"#000":"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}}>
            {copiedCode===lastCode?<><CheckCircle size={14}/> تم النسخ</>:<><Copy size={14}/> نسخ الكود</>}
          </button>
        </div>
      )}
    </div>

    <div style={{fontSize:"12px",color:"#71717a",marginBottom:"10px"}}>الأكواد الحالية ({campaigns.length})</div>
    {campaigns.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Share2 size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أكواد شراكة بعد</div></div>
      :campaigns.map(camp=>{
        const expired=isExpired(camp);
        const full=isFull(camp);
        const statusLabel = !camp.active?"موقوف يدوياً":expired?"منتهي الصلاحية":full?"وصل الحد الأقصى":"نشط";
        const statusColor = !camp.active||expired||full ? "#f87171" : "#4ade80";
        return (
          <div key={camp.id} style={{...C.card,border:`1px solid ${statusColor}33`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
              <div style={{fontWeight:"bold",fontSize:"13px"}}>{camp.label}</div>
              <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"6px",fontWeight:"bold",backgroundColor:statusColor+"22",color:statusColor}}>{statusLabel}</span>
            </div>
            <div style={{fontFamily:"monospace",fontSize:"15px",fontWeight:"900",letterSpacing:"1px",marginBottom:"6px"}}>{camp.code}</div>
            <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"8px"}}>
              الاستخدام: {camp.usedCount||0} / {camp.maxUses} • ينتهي: {new Date(camp.expiresAt).toLocaleDateString("ar")} • خصم: {camp.bonusDays} يوم
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>toggleActive(camp)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",backgroundColor:"rgba(255,255,255,0.04)",color:"#cbd5e1",fontSize:"11px",fontWeight:"bold",cursor:"pointer"}}>{camp.active?"إيقاف":"تفعيل"}</button>
              <button onClick={()=>removeCampaign(camp)} style={{padding:"7px 12px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"11px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Trash2 size={12}/></button>
            </div>
          </div>
        );
      })
    }
  </div>;
}

// ─── CONTENT EDITOR ──────────────────────────────────────
function ContentEditor() {
  const [clips, setClips] = useState([]);
  const [selClip, setSelClip] = useState(null);
  const [slides, setSlides] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  // ─── فلتر المادة والصف ───
  const [filterSubj, setFilterSubj] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const u = onSnapshot(collection(db, "clips"), snap => {
      setClips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => u();
  }, []);

  const openClip = (clip) => {
    setSelClip(clip);
    setSlides(clip.slides || []);
    setEditIdx(null);
    setShowAddSlide(false);
  };

  const saveSlides = async (newSlides) => {
    if (!selClip?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "clips", selClip.id), { slides: newSlides });
      setSlides(newSlides);
      setSelClip({ ...selClip, slides: newSlides });
      showMsg("تم حفظ التعديلات");
    } catch (e) { showMsg("فشل: " + e.message); }
    setSaving(false);
  };

  const openEdit = (idx) => {
    setEditIdx(idx);
    setEditTitle(slides[idx].title || "");
    setEditPoints((slides[idx].points || []).join("\n"));
    setShowAddSlide(false);
  };

  const saveEdit = async () => {
    const newSlides = [...slides];
    newSlides[editIdx] = {
      title: editTitle,
      points: editPoints.split("\n").filter(p => p.trim())
    };
    await saveSlides(newSlides);
    setEditIdx(null);
  };

  const deleteSlide = async (idx) => {
    const newSlides = slides.filter((_, i) => i !== idx);
    await saveSlides(newSlides);
    setConfirmDel(null);
  };

  const addSlide = async () => {
    if (!newTitle.trim()) { showMsg("ادخل عنوان الشريحة"); return; }
    const newSlides = [...slides, {
      title: newTitle,
      points: newPoints.split("\n").filter(p => p.trim())
    }];
    await saveSlides(newSlides);
    setNewTitle("");
    setNewPoints("");
    setShowAddSlide(false);
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const newSlides = [...slides];
    [newSlides[idx - 1], newSlides[idx]] = [newSlides[idx], newSlides[idx - 1]];
    await saveSlides(newSlides);
  };

  const moveDown = async (idx) => {
    if (idx === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[idx + 1], newSlides[idx]] = [newSlides[idx], newSlides[idx + 1]];
    await saveSlides(newSlides);
  };

  const allClips = clips.filter(c => c.slides && c.slides.length > 0);
  const regularClips = clips.filter(c => !c.slides || c.slides.length === 0);

  // تطبيق الفلتر
  const filteredAllClips = allClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  const filteredRegularClips = regularClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  if (!selClip) return (
    <div>
      {/* فلتر البحث */}
      <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:"14px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",color:"#38bdf8",fontWeight:"bold",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}><Search size={13}/> بحث وفلتر</div>
        {/* بحث نصي */}
        <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="ابحث عن اسم المقطع..." style={{...C.input,marginBottom:"8px",fontSize:"13px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
          <select value={filterSubj} onChange={e=>{setFilterSubj(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterSubj?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المواد</option>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterStage} onChange={e=>{setFilterStage(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterStage?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المراحل</option>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"8px"}}>
          <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterGrade?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل الصفوف</option>
            {(GRADES[filterStage]||["الأول","الثاني","الثالث","الرابع","الخامس","السادس"]).map(g=><option key={g}>{g}</option>)}
          </select>
          {(filterSubj||filterStage||filterGrade||filterText)&&<button onClick={()=>{setFilterSubj("");setFilterStage("");setFilterGrade("");setFilterText("");}} style={{padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",color:"#f87171",fontSize:"12px",cursor:"pointer"}}>مسح</button>}
        </div>
        {(filterSubj||filterStage||filterGrade||filterText)&&<div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>
          النتائج: {filteredAllClips.length+filteredRegularClips.length} مقطع
        </div>}
      </div>
      {filteredAllClips.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#a855f7", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={14} /> مقاطع الشرائح ({filteredAllClips.length})
          </div>
          {filteredAllClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }} onClick={() => openClip(clip)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.num?`#${clip.num} `:""}{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}{clip.grade?` - ${clip.grade}`:""} - {clip.slides.length} شريحة</div>
                </div>
                <div style={{ backgroundColor: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "8px", padding: "6px 12px", color: "#a855f7", fontSize: "12px", fontWeight: "bold" }}>تعديل</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredRegularClips.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Film size={14} /> مقاطع الفيديو ({filteredRegularClips.length})
          </div>
          {filteredRegularClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#52525b" }}>لا يحتوي شرائح</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {allClips.length === 0 && regularClips.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525b" }}>لا توجد مقاطع بعد</div>
      )}
    </div>
  );

  return (
    <div>
      <button onClick={() => { setSelClip(null); setEditIdx(null); }}
        style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
        رجوع للقائمة
      </button>
      <div style={{ ...C.card, border: "1px solid rgba(139,92,246,0.3)", marginBottom: "14px" }}>
        <div style={{ fontWeight: "bold", fontSize: "15px", color: "#a855f7", marginBottom: "4px" }}>{selClip.title}</div>
        <div style={{ fontSize: "12px", color: "#71717a" }}>{selClip.subject} - {selClip.stage} - {slides.length} شريحة</div>
      </div>
      {editIdx !== null ? (
        <div style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "10px" }}>تعديل الشريحة {editIdx + 1}</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={6} value={editPoints} onChange={e => setEditPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setEditIdx(null)} style={C.cancelBtn}>الغاء</button>
            <button onClick={saveEdit} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Spinner size={15}/> : <Save size={15}/>} حفظ
            </button>
          </div>
        </div>
      ) : showAddSlide ? (
        <div style={{ ...C.card, border: "1px solid rgba(34,197,94,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4ade80", marginBottom: "10px" }}>اضافة شريحة جديدة</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة الجديدة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={5} value={newPoints} onChange={e => setNewPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setShowAddSlide(false)} style={C.cancelBtn}>الغاء</button>
            <button onClick={addSlide} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {saving ? <Spinner size={15}/> : <Plus size={15}/>} اضافة
            </button>
          </div>
        </div>
      ) : (
        <>
          {confirmDel !== null && (
            <div style={C.confirmBox}>
              <div style={{ color: "#f87171", fontWeight: "bold", marginBottom: "8px" }}>هل تريد حذف الشريحة {confirmDel + 1}؟</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button onClick={() => deleteSlide(confirmDel)} style={{ padding: "8px 20px", backgroundColor: "#ef4444", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>نعم</button>
                <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 20px", backgroundColor: "#27272a", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer" }}>لا</button>
              </div>
            </div>
          )}
          {slides.map((sl, idx) => (
            <div key={idx} style={{ ...C.card, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "2px" }}>شريحة {idx + 1}</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "6px" }}><MathText text={sl.title}/></div>
                  {(sl.points || []).slice(0, 2).map((p, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "2px" }}>◆ <MathText text={p}/></div>
                  ))}
                  {(sl.points || []).length > 2 && (
                    <div style={{ fontSize: "11px", color: "#52525b" }}>+{sl.points.length - 2} نقاط اخرى</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginRight: "8px" }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === 0 ? "#1c1c1e" : "#27272a", color: idx === 0 ? "#3f3f46" : "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", fontSize: "12px" }}>↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === slides.length - 1} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === slides.length - 1 ? "#1c1c1e" : "#27272a", color: idx === slides.length - 1 ? "#3f3f46" : "#fff", cursor: idx === slides.length - 1 ? "not-allowed" : "pointer", fontSize: "12px" }}>↓</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => openEdit(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>تعديل</button>
                <button onClick={() => setConfirmDel(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>حذف</button>
              </div>
            </div>
          ))}
          <button onClick={() => setShowAddSlide(true)} style={{ ...C.gradBtn, background: "linear-gradient(to right,#059669,#4ade80)" }}>
            <Plus size={18}/> اضافة شريحة جديدة
          </button>
        </>
      )}
    </div>
  );
}

// ─── ADMIN CHANGE PASSWORD ───────────────────────────────
function AdminChangePasswordCard() {
  const [newPass,setNewPass]=useState("");
  const [confirmPass,setConfirmPass]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const change=async()=>{
    setErr("");
    if(newPass.length<6) return setErr("كلمة المرور يجب أن تكون 6 خانات على الأقل");
    if(newPass!==confirmPass) return setErr("كلمتا المرور غير متطابقتين");
    setSaving(true);
    try{
      await updatePassword(auth.currentUser,newPass);
      showMsg("تم تغيير كلمة المرور بنجاح");
      setNewPass(""); setConfirmPass("");
    }catch(e){
      if(e.code==="auth/requires-recent-login") setErr("لأمانك، سجّل الخروج وأعد تسجيل الدخول ثم حاول مرة أخرى");
      else setErr("فشل تغيير كلمة المرور: "+e.message);
    }
    setSaving(false);
  };
  return (
    <div style={C.card}>
      <span style={{color:"#ef4444",fontWeight:"bold",fontSize:"13px",display:"block",marginBottom:"10px"}}> تغيير كلمة المرور</span>
      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="كلمة المرور الجديدة" style={C.input}/>
      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" style={C.input}/>
      <ErrBox msg={err}/>
      <button onClick={change} disabled={saving} style={{...C.redBtn,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={15}/> جارٍ التغيير...</>:"تغيير كلمة المرور"}
      </button>
    </div>
  );
}

// ─── ADMIN PRICES TAB (حقيقي، يُحفظ في Firestore) ───────
// بطاقة تشخيص مزودي الذكاء الاصطناعي — تختبر الأربعة (Gemini, Groq, Cerebras, DeepSeek)
// بالتوازي بسؤال بسيط موحّد، وتعرض نتيجة كل وحد لحاله (نجاح/فشل مع رسالة الخطأ)
// بدل الاعتماد على callAI اللي تخلط الترتيب وتخفي الفشل خلف Fallback صامت.
function AIDiagnosticsCard() {
  const [results,setResults]=useState(null); // null = لسه ما اختبرنا
  const [testing,setTesting]=useState(false);

  const runTest=()=>{
    setTesting(true);
    const initial=AI_PROVIDERS.map(p=>({name:p.name,status:"جارٍ الاختبار..."}));
    setResults(initial);
    const testPrompt="أجب بكلمة واحدة فقط: تم";
    const TIMEOUT_MS=20000; // 20 ثانية — لو مزود تأخر أكثر من كذا نعتبره فشل بدل ما يعلّق باقي النتائج

    let doneCount=0;
    AI_PROVIDERS.forEach((p,idx)=>{
      const started=Date.now();
      const withTimeout=Promise.race([
        p.fn(testPrompt),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("انتهت المهلة (تأخر أكثر من 20 ثانية)")),TIMEOUT_MS))
      ]);
      withTimeout
        .then(()=>{
          setResults(prev=>{
            const next=[...prev];
            next[idx]={name:p.name,ok:true,ms:Date.now()-started};
            return next;
          });
        })
        .catch(e=>{
          setResults(prev=>{
            const next=[...prev];
            next[idx]={name:p.name,ok:false,ms:Date.now()-started,error:(e?.message||"خطأ غير معروف").slice(0,120)};
            return next;
          });
        })
        .finally(()=>{
          doneCount++;
          if(doneCount===AI_PROVIDERS.length) setTesting(false);
        });
    });
  };

  return (
    <div style={{backgroundColor:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
        <div style={{fontWeight:"bold",fontSize:"14px",display:"flex",alignItems:"center",gap:"6px"}}>
          <Bot size={16} color="#38bdf8"/> تشخيص المساعد الذكي
        </div>
        <button onClick={runTest} disabled={testing} style={{padding:"7px 16px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.35)",backgroundColor:"rgba(56,189,248,0.12)",color:"#38bdf8",fontWeight:"bold",fontSize:"12px",cursor:testing?"default":"pointer",opacity:testing?0.6:1}}>
          {testing?"جارٍ الاختبار...":"اختبار المزودين الأربعة"}
        </button>
      </div>
      <div style={{fontSize:"11px",color:"#71717a",marginBottom:results?"10px":0}}>يرسل سؤال تجريبي لكل مزود بشكل منفصل ومتزامن، ويعرض نجاح أو فشل كل واحد لحاله.</div>
      {results&&(
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          {results.map(r=>(
            <div key={r.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"rgba(0,0,0,0.25)",borderRadius:"8px",padding:"8px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"13px",fontWeight:"bold"}}>{r.name}</span>
                {r.ok===true&&<span style={{fontSize:"11px",color:"#71717a"}}>({r.ms}ms)</span>}
              </div>
              {r.ok===true?(
                <span style={{color:"#4ade80",fontSize:"12px",fontWeight:"bold"}}>✅ يعمل</span>
              ):r.ok===false?(
                <span title={r.error} style={{color:"#f87171",fontSize:"12px",fontWeight:"bold",maxWidth:"55%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>❌ {r.error}</span>
              ):(
                <span style={{color:"#a1a1aa",fontSize:"12px"}}>{r.status}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatToggleCard() {
  const [chatEnabled,setChatEnabled]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
    });
    return ()=>unsub();
  },[]);

  const toggle=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"settings","chat"),{enabled:!chatEnabled,updatedAt:serverTimestamp()});
      setChatEnabled(e=>!e);
    }catch(e){console.error(e);}
    setSaving(false);
  };

  return (
    <div style={{backgroundColor:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}>
          <MessageCircle size={16} color="#a855f7"/> غرفة النقاش
        </div>
        <div style={{fontSize:"12px",color:"#71717a"}}>{chatEnabled?"مفعّلة — الطلاب يستطيعون النقاش":"موقوفة — النقاش معطّل للطلاب"}</div>
      </div>
      <button onClick={toggle} disabled={saving} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:chatEnabled?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)",color:chatEnabled?"#f87171":"#4ade80",fontWeight:"bold",fontSize:"13px",cursor:"pointer",border:`1px solid ${chatEnabled?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)"}`}}>
        {saving?"...":chatEnabled?"⏸ إيقاف":"▶ تفعيل"}
      </button>
    </div>
  );
}

function FontSizeCard() {
  const [size,setSize]=useState("medium");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","display"),snap=>{
      if(snap.exists()) setSize(snap.data().fontSize||"medium");
    });
    return()=>unsub();
  },[]);

  const save=async(val)=>{
    setSaving(true);
    setSize(val);
    try{ await setDoc(doc(db,"settings","display"),{fontSize:val,updatedAt:serverTimestamp()},{merge:true}); }
    catch(e){ showMsg("فشل: "+e.message); }
    setSaving(false);
  };

  const sizes=[
    {key:"small",label:"صغير",desc:"مناسب للشاشات الصغيرة"},
    {key:"medium",label:"متوسط",desc:"الحجم الافتراضي"},
    {key:"large",label:"كبير",desc:"مناسب للقراءة المريحة"},
  ];

  return (
    <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>
        <span style={{fontSize:"16px"}}>Aa</span> حجم خط الشرائح
      </div>
      <div style={{display:"flex",gap:"8px"}}>
        {sizes.map(s=>(
          <button key={s.key} onClick={()=>save(s.key)} disabled={saving} style={{
            flex:1,padding:"10px 6px",borderRadius:"10px",border:`1px solid ${size===s.key?"rgba(56,189,248,0.6)":"rgba(255,255,255,0.08)"}`,
            backgroundColor:size===s.key?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.03)",
            color:size===s.key?"#38bdf8":"#71717a",
            fontSize:"13px",fontWeight:size===s.key?"700":"400",cursor:"pointer",
            transition:"all 0.2s",
          }}>
            <div style={{fontSize:s.key==="small"?"11px":s.key==="large"?"17px":"14px",marginBottom:"4px"}}>Aa</div>
            <div>{s.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// بطاقة رسم بياني بسيط (SVG مباشر، بدون أي مكتبة خارجية) لعرض تطوّر عدد الطلاب والإيرادات
// عبر الزمن، بالاعتماد على "لقطات" يومية تُجمَع تلقائياً بمجموعة "dailyStats" (راجع api/daily-snapshot.js)
function MiniLineChart({points, color, formatValue}) {
  if(points.length===0) return null;
  if(points.length===1){
    // نقطة وحدة بس — نعرضها كرقم بدل خط ما له معنى
    return <div style={{textAlign:"center",padding:"20px",color:"#71717a",fontSize:"12px"}}>يوم واحد بس مسجّل لحد الآن — الخط البياني بيظهر بعد يومين فأكثر</div>;
  }
  const W=280,H=90,pad=8;
  const vals=points.map(p=>p.value);
  const min=Math.min(...vals), max=Math.max(...vals);
  const range=(max-min)||1;
  const stepX=(W-pad*2)/(points.length-1);
  const coords=points.map((p,i)=>{
    const x=pad+i*stepX;
    const y=H-pad-((p.value-min)/range)*(H-pad*2);
    return {x,y,...p};
  });
  const pathD=coords.map((c,i)=>(i===0?"M":"L")+c.x.toFixed(1)+","+c.y.toFixed(1)).join(" ");
  const areaD=pathD+` L${coords[coords.length-1].x.toFixed(1)},${H-pad} L${coords[0].x.toFixed(1)},${H-pad} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"90px"}}>
        <path d={areaD} fill={color} opacity="0.12"/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="2"/>
        {coords.map((c,i)=>(
          <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={color}/>
        ))}
      </svg>
      <div dir="ltr" style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#52525b",marginTop:"2px"}}>
        <span>{points[0].date}</span>
        <span>{points[points.length-1].date}</span>
      </div>
    </div>
  );
}

function StatsChartCard() {
  const [dailyStats,setDailyStats]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const q=query(collection(db,"dailyStats"),orderBy("date","asc"),limit(90));
    const unsub=onSnapshot(q,snap=>{
      setDailyStats(snap.docs.map(d=>d.data()));
      setLoading(false);
    },()=>setLoading(false));
    return()=>unsub();
  },[]);

  const shortDate=(d)=>{ const parts=(d||"").split("-"); return parts.length===3?parts[2]+"/"+parts[1]:d; };

  const studentsPoints = dailyStats.map(s=>({date:shortDate(s.date),value:Number(s.totalStudents||0)}));
  const revenuePoints = dailyStats.map(s=>({date:shortDate(s.date),value:Number(s.totalRevenue||0)}));
  const newStudentsTotal = dailyStats.reduce((sum,s)=>sum+Number(s.newStudentsToday||0),0);

  return (
    <div style={{backgroundColor:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px",color:"#c084fc"}}>
        📈 تطوّر الأداء بمرور الوقت
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"16px"}}><Spinner color="#c084fc"/></div>
      ):dailyStats.length===0?(
        <div style={{textAlign:"center",padding:"16px",color:"#71717a",fontSize:"12px"}}>
          ما فيه بيانات تاريخية بعد. السجل اليومي يبدأ يتجمّع تلقائياً من اليوم اللي يُفعَّل فيه جدول Vercel Cron، وبعد يومين يبدأ يظهر رسم بياني هنا.
        </div>
      ):(
        <div>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>عدد الطلاب الكلي</div>
          <MiniLineChart points={studentsPoints} color="#a855f7"/>
          <div style={{fontSize:"11px",color:"#a1a1aa",margin:"14px 0 6px"}}>إجمالي الإيرادات المقبولة (د.ع)</div>
          <MiniLineChart points={revenuePoints} color="#4ade80"/>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"10px",textAlign:"center"}}>
            {newStudentsTotal} طالب جديد خلال آخر {dailyStats.length} يوم مسجَّل
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: تبويب "الاشتراكات" — نظرة شاملة على كل الاشتراكات النشطة ───
// يعرض: إجمالي المشتركين الفريدين، إجمالي عدد الاشتراكات (مادة) الفعّالة،
// ولكل طالب: قائمة المواد المشترك فيها وتاريخ انتهاء كل وحدة — مرتّبة بحيث
// أقرب اشتراك للانتهاء يظهر أولاً (يساعد المدير يتابع طلاب التجديد بسرعة)
function AdminSubscriptionsTab() {
  const [subs,setSubs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [search,setSearch]=useState("");
  const [sortBy,setSortBy]=useState("expiry"); // "expiry" | "subjectCount"

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"subscriptions"),
      snap=>{ setSubs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      error=>{ setErr("تعذّر تحميل الاشتراكات: "+error.message); setLoading(false); }
    );
    return ()=>unsub();
  },[]);

  // نجمّع الاشتراكات حسب الطالب، ونحتفظ فقط بالاشتراكات النشطة فعلياً (لم
  // تنتهِ صلاحيتها بعد) — لو الطالب عنده أكثر من سجل لنفس المادة (تجديد
  // سابق مثلاً)، نحتفظ بأبعد تاريخ انتهاء فقط لتلك المادة تحديداً
  const grouped = React.useMemo(()=>{
    const now = new Date();
    const byStudent = {}; // phone -> {name, phone, subjects:{subjectKey: expiresAt}}
    subs.forEach(s=>{
      const expiry = new Date(s.expiresAt);
      if(!(expiry>now)) return; // تجاهل أي اشتراك منتهي فعلاً
      const phone = s.studentPhone;
      if(!phone) return;
      if(!byStudent[phone]) byStudent[phone]={name:s.studentName||"—",phone,subjects:{}};
      // المفتاح يشمل الصف كذلك (بعد تفعيل تقييد الاشتراك بالصف) — وإلا لو كان
      // الطالب مشتركاً بنفس المادة/المرحلة لصفّين مختلفين، سيُدمَجان خطأً بسطر واحد
      // ويختفي أحدهما من عرض الأدمن
      const sKey = s.subject+"__"+s.stage+"__"+(s.grade||"");
      const existing = byStudent[phone].subjects[sKey];
      if(!existing || new Date(existing.expiresAt)<expiry){
        byStudent[phone].subjects[sKey]={subject:s.subject,stage:s.stage,grade:s.grade||"",expiresAt:s.expiresAt};
      }
    });
    let list = Object.values(byStudent).map(st=>{
      const subjectList = Object.values(st.subjects);
      const nearestExpiry = subjectList.reduce((min,sub)=>{
        const t = new Date(sub.expiresAt).getTime();
        return (min===null||t<min) ? t : min;
      },null);
      return {...st, subjectList, subjectCount:subjectList.length, nearestExpiry};
    });
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list = list.filter(st=>st.name.toLowerCase().includes(q)||st.phone.includes(q));
    }
    list.sort((a,b)=> sortBy==="expiry" ? a.nearestExpiry-b.nearestExpiry : b.subjectCount-a.subjectCount);
    return list;
  },[subs,search,sortBy]);

  const totalActiveSubscriptions = grouped.reduce((sum,st)=>sum+st.subjectCount,0);
  const daysLeftOf = (iso) => Math.max(0,Math.ceil((new Date(iso)-new Date())/86400000));

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;
  if(err) return <div style={{textAlign:"center",padding:"24px"}}><ClipboardList size={40} color="#f87171" style={{margin:"0 auto 10px"}}/><div style={{color:"#f87171",fontSize:"13px"}}>{err}</div></div>;

  return (
    <div>
      {/* إحصائيات إجمالية */}
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        <div style={{flex:1,...C.card,textAlign:"center"}}>
          <div style={{fontSize:"22px",fontWeight:"900",color:"#38bdf8"}}>{grouped.length}</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>طالب مشترك حالياً</div>
        </div>
        <div style={{flex:1,...C.card,textAlign:"center"}}>
          <div style={{fontSize:"22px",fontWeight:"900",color:"#4ade80"}}>{totalActiveSubscriptions}</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>اشتراك مادة نشط</div>
        </div>
      </div>

      {/* بحث + فرز */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." style={{...C.input,marginBottom:"8px"}}/>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
        <button onClick={()=>setSortBy("expiry")} style={{flex:1,padding:"7px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:"bold",backgroundColor:sortBy==="expiry"?"rgba(56,189,248,0.18)":"rgba(255,255,255,0.04)",color:sortBy==="expiry"?"#38bdf8":"#71717a"}}>⏰ الأقرب للانتهاء أولاً</button>
        <button onClick={()=>setSortBy("subjectCount")} style={{flex:1,padding:"7px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:"bold",backgroundColor:sortBy==="subjectCount"?"rgba(56,189,248,0.18)":"rgba(255,255,255,0.04)",color:sortBy==="subjectCount"?"#38bdf8":"#71717a"}}>📚 الأكثر مواد أولاً</button>
      </div>

      {grouped.length===0?(
        <div style={{textAlign:"center",padding:"30px",color:"#52525b"}}>
          <ClipboardList size={44} color="#3f3f46" style={{margin:"0 auto 10px"}}/>
          <div>{search.trim()?"لا توجد نتائج مطابقة":"لا يوجد طلاب مشتركين حالياً"}</div>
        </div>
      ):grouped.map(st=>(
        <div key={st.phone} style={{...C.card,marginBottom:"8px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
            <div>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{st.name}</div>
              <div dir="ltr" style={{fontSize:"11px",color:"#71717a",textAlign:"left"}}>{st.phone}</div>
            </div>
            <div style={{backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:"bold",color:"#38bdf8"}}>
              {st.subjectCount} مادة
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {st.subjectList.map((sub,i)=>{
              const days = daysLeftOf(sub.expiresAt);
              const urgent = days<=3;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",backgroundColor:urgent?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.03)",borderRadius:"8px",padding:"6px 10px"}}>
                  <span style={{fontSize:"12px",color:"#d4d4d8"}}>{sub.subject} <span style={{color:"#52525b"}}>• {sub.stage}{sub.grade?" • الصف "+sub.grade:""}</span></span>
                  <span style={{fontSize:"11px",fontWeight:"bold",color:urgent?"#f87171":"#a1a1aa"}}>
                    {urgent&&"⚠️ "}{days===0?"ينتهي اليوم":`${days} يوم متبقي`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAudioTab() {
  const [tracks,setTracks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState("");
  const [url,setUrl]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [confirmDeleteId,setConfirmDeleteId]=useState(null);
  // ─── رفع ملف صوتي مباشرة من الجهاز (بديل أسهل عن لصق رابط) ───
  const [uploading,setUploading]=useState(false);
  const [uploadPct,setUploadPct]=useState(0);
  const fileInputRef = useRef(null);
  const MAX_AUDIO_MB = 20; // حد أقصى معقول لملف نشيد/موسيقى (يتفادى رفع ملفات ضخمة بالغلط)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // يسمح باختيار نفس الملف مرة ثانية لاحقاً لو احتاج
    if(!file) return;
    setErr("");
    if(!file.type.startsWith("audio/")){ setErr("الملف المختار مو ملف صوتي — اختر MP3 أو صيغة صوت مشابهة"); return; }
    if(file.size > MAX_AUDIO_MB*1024*1024){ setErr("حجم الملف كبير جداً — الحد الأقصى "+MAX_AUDIO_MB+" ميجابايت"); return; }

    // اسم ملف فريد بالتخزين (وقت الرفع + الاسم الأصلي) لتفادي تعارض الأسماء
    const safeName = file.name.replace(/[^\w.\-]/g,"_");
    const path = "audioTracks/"+Date.now()+"_"+safeName;
    const fileRef = storageRef(storage, path);

    setUploading(true); setUploadPct(0);
    const task = uploadBytesResumable(fileRef, file);
    task.on("state_changed",
      snap=>{ setUploadPct(Math.round((snap.bytesTransferred/snap.totalBytes)*100)); },
      error=>{
        setUploading(false);
        setErr("فشل رفع الملف: "+error.message);
      },
      async()=>{
        try{
          const downloadUrl = await getDownloadURL(fileRef);
          setUrl(downloadUrl);
          // نقترح اسم تلقائي من اسم الملف لو الطالب ما كتب عنوان لسه (يقدر يعدّله)
          if(!title.trim()){ setTitle(file.name.replace(/\.[^.]+$/,"")); }
          showMsg("تم رفع الملف بنجاح — اضغط + إضافة لحفظه بالمكتبة");
        }catch(e){
          setErr("فشل الحصول على رابط الملف بعد الرفع: "+e.message);
        }
        setUploading(false);
      }
    );
  };

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"audioTracks"),
      snap=>{
        setTracks(snap.docs.map(d=>({id:d.id,...d.data()})));
        setLoading(false);
      },
      error=>{
        // لو فشل الاتصال (غالباً بسبب قواعد أمان Firestore ما تسمح بالوصول
        // لمجموعة audioTracks الجديدة)، نعرض الخطأ بوضوح بدل ما تبقى دائرة
        // التحميل معلّقة للأبد بصمت
        setErr("تعذّر تحميل الأناشيد: "+error.message);
        setLoading(false);
      }
    );
    return ()=>unsub();
  },[]);

  const addTrack=async()=>{
    setErr("");
    if(!title.trim()){ setErr("اكتب اسم النشيد أو المقطوعة"); return; }
    if(!url.trim()||!/^https?:\/\//i.test(url.trim())){ setErr("رابط الملف الصوتي غير صالح — لازم يبدأ بـ http:// أو https://"); return; }
    setSaving(true);
    try{
      await addDoc(collection(db,"audioTracks"),{title:title.trim(),url:url.trim(),createdAt:serverTimestamp()});
      setTitle(""); setUrl("");
      showMsg("تمت إضافة النشيد بنجاح");
    }catch(e){ setErr("فشل الإضافة: "+e.message); }
    setSaving(false);
  };

  const deleteTrack=async(id)=>{
    try{ await deleteDoc(doc(db,"audioTracks",id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل الحذف: "+e.message); }
    setConfirmDeleteId(null);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;

  if(err&&tracks.length===0&&!title&&!url){
    // خطأ بمرحلة التحميل الأولي (قبل ما المستخدم يكتب أي شي بالنموذج) — نعرضه
    // بشكل واضح بدل ما يظهر جوا النموذج فقط ويسهل تفويته
    return (
      <div style={{textAlign:"center",padding:"24px"}}>
        <Volume2 size={40} color="#f87171" style={{margin:"0 auto 10px"}}/>
        <div style={{color:"#f87171",fontSize:"13px",lineHeight:"1.7"}}>{err}</div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"8px"}}>غالباً السبب: قواعد أمان Firestore ما تسمح بالوصول لمجموعة "audioTracks" الجديدة — تأكد من إضافتها بقواعد الأمان بلوحة Firebase.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={C.infoBanner}>
        <Volume2 size={15}/> أضف روابط أناشيد أو موسيقى دراسة مباشرة (ملف MP3 برابط مباشر). تظهر للطالب داخل زر "مساعد" ليختار منها أثناء الدراسة.
        <br/>⚠️ استخدم مصادر مرخّصة فقط (مثل مكتبة يوتيوب الصوتية الرسمية — youtube.com/audiolibrary — أو مصادر Royalty-Free الأخرى)، تفادياً لأي مشكلة بحقوق النشر.
      </div>

      {/* نموذج الإضافة */}
      <div style={{backgroundColor:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"14px",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",marginBottom:"10px"}}>إضافة نشيد/موسيقى جديدة</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="اسم النشيد أو المقطوعة" style={{...C.input,marginBottom:"8px"}}/>

        {/* رفع مباشر من الجهاز — الطريقة الأسهل، يملأ خانة الرابط تلقائياً بعد الرفع */}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} style={{display:"none"}}/>
        <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
          style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px dashed rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.06)",color:"#38bdf8",fontSize:"13px",fontWeight:"bold",cursor:uploading?"default":"pointer",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
          <Volume2 size={15}/> {uploading?`جارٍ الرفع... ${uploadPct}%`:"رفع ملف صوتي من الجهاز"}
        </button>
        {uploading&&(
          <div style={{width:"100%",height:"5px",backgroundColor:"rgba(255,255,255,0.08)",borderRadius:"4px",overflow:"hidden",marginBottom:"8px"}}>
            <div style={{width:uploadPct+"%",height:"100%",backgroundColor:"#38bdf8",transition:"width 0.2s ease"}}/>
          </div>
        )}

        <div style={{fontSize:"11px",color:"#71717a",textAlign:"center",marginBottom:"8px"}}>— أو الصق رابط ملف صوتي مباشر —</div>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="رابط الملف الصوتي المباشر (MP3)" dir="ltr" style={{...C.input,marginBottom:"8px",textAlign:"left"}}/>
        <ErrBox msg={err}/>
        <button onClick={addTrack} disabled={saving||uploading} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"none",backgroundColor:"#38bdf8",color:"#000",fontWeight:"bold",fontSize:"13px",cursor:(saving||uploading)?"default":"pointer",opacity:(saving||uploading)?0.6:1}}>
          {saving?"جارٍ الإضافة...":"+ إضافة"}
        </button>
      </div>

      {/* القائمة الحالية */}
      <div style={{fontSize:"13px",fontWeight:"bold",marginBottom:"8px",color:"#a1a1aa"}}>الأناشيد الحالية ({tracks.length})</div>
      {tracks.length===0?(
        <div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Volume2 size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أناشيد مضافة بعد</div></div>
      ):tracks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:"10px",...C.card}}>
          <Volume2 size={16} color="#38bdf8" style={{flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
            <div dir="ltr" style={{fontSize:"10px",color:"#71717a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{t.url}</div>
          </div>
          {confirmDeleteId===t.id?(
            <div style={{display:"flex",gap:"4px",flexShrink:0}}>
              <button onClick={()=>deleteTrack(t.id)} style={{backgroundColor:"#ef4444",border:"none",borderRadius:"6px",padding:"5px 8px",color:"#fff",fontSize:"11px",cursor:"pointer"}}>تأكيد</button>
              <button onClick={()=>setConfirmDeleteId(null)} style={{backgroundColor:"rgba(255,255,255,0.1)",border:"none",borderRadius:"6px",padding:"5px 8px",color:"#fff",fontSize:"11px",cursor:"pointer"}}>إلغاء</button>
            </div>
          ):(
            <button onClick={()=>setConfirmDeleteId(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",flexShrink:0}}><Trash2 size={16}/></button>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminPricesTab() {
  const [prices,setPrices]=useState({}); // key: "subject__stage" -> price
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage) vals[data.subject+"__"+data.stage]=data.value||"";
      });
      setPrices(vals);
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const setPrice=(subj,stage,val)=>{
    const key=subj+"__"+stage;
    setPrices(p=>({...p,[key]:val}));
  };

  const savePrices=async()=>{
    setSaving(true);
    try{
      // نحفظ كل مادة+مرحلة كوثيقة منفصلة في مجموعة prices
      const saves=Object.entries(prices).map(([key,value])=>{
        const [subject,stage]=key.split("__");
        return setDoc(doc(db,"prices",key),{key,subject,stage,value,updatedAt:serverTimestamp()});
      });
      await Promise.all(saves);
      showMsg("تم حفظ الأسعار بنجاح");
    }catch(e){ showMsg("فشل حفظ الأسعار: "+e.message); }
    setSaving(false);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;

  return (
    <div>
      <div style={C.infoBanner}> حدد سعراً لكل مادة حسب المرحلة + سعر ملازم PDF</div>
      {PRICE_SUBJECTS.map(subj=>(
        <div key={subj}>
          <div style={{fontSize:"14px",color:"#38bdf8",textAlign:"center",margin:"14px 0 8px"}}> {subj}</div>
          {STAGES.map(stage=>{
            const key=subj+"__"+stage;
            return (
              <div key={stage} style={C.priceRow}>
                <span style={{fontSize:"14px",color:"#e4e4e7",minWidth:"60px"}}>{stage}</span>
                <div style={{display:"flex",alignItems:"center",gap:"6px",backgroundColor:"#09090b",padding:"6px 10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)",flex:1,margin:"0 10px"}}>
                  <input type="number" placeholder="0" value={prices[key]??""} onChange={e=>setPrice(subj,stage,e.target.value)} style={C.priceInput}/>
                </div>
                <span style={{color:"#71717a",fontSize:"12px"}}>د.ع</span>
              </div>
            );
          })}
        </div>
      ))}
      <button disabled={saving} style={{...C.gradBtn,marginTop:"16px",opacity:saving?0.7:1}} onClick={savePrices}>
        {saving?<><Spinner size={15}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الأسعار</>}
      </button>
    </div>
  );
}

// ─── ADMIN: بنك أسئلة الامتحانات (توليد بالذكاء الاصطناعي + مراجعة + نشر) ─
function AdminExamsTab() {
  const [clips,setClips]=useState([]);
  const [published,setPublished]=useState([]);
  const [subject,setSubject]=useState(SUBJECTS[0]);
  const [stage,setStage]=useState(STAGES[0]);
  const [grade,setGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [topic,setTopic]=useState("");
  const [count,setCount]=useState(20);
  const [generating,setGenerating]=useState(false);
  const [genProgress,setGenProgress]=useState(""); // نص تقدم التوليد عند تقسيمه لدفعات (أعداد كبيرة)
  const [genError,setGenError]=useState(""); // آخر رسالة خطأ تفصيلية (تُعرض ثابتة بالشاشة، لا تختفي مثل الـ Toast)
  const [drafts,setDrafts]=useState([]); // أسئلة مولّدة بانتظار المراجعة (لم تُنشر بعد)
  const [publishing,setPublishing]=useState(false);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"clips"),snap=>setClips(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,"examQuestions"),snap=>setPublished(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  },[]);

  // إعادة ضبط الصف تلقائياً عند تغيير المرحلة (لأن قائمة الصفوف تختلف باختلاف المرحلة)
  useEffect(()=>{ setGrade((GRADES[stage]||[])[0]||""); },[stage]);

  // نطابق الصف بنفس المرونة المستخدمة بباقي التطبيق: نقبل المقطع لو صفه مطابق أو لو ما حُدد له صف أصلاً
  const gradeMatches = (c)=> !grade || c.grade===grade || !c.grade;

  const topics = React.useMemo(()=>{
    const set=new Set();
    clips.forEach(c=>{ if(c.subject===subject&&c.stage===stage&&c.topic&&gradeMatches(c)) set.add(c.topic); });
    return [...set].sort();
  },[clips,subject,stage,grade]);
  useEffect(()=>{ setTopic(topics[0]||""); },[subject,stage,grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const topicPublished = published.filter(q=>q.subject===subject&&q.stage===stage&&q.topic===topic);

  // يجمع نصوص شرائح الفصل المختار لتُستخدم كمصدر يُغذّي به الذكاء الاصطناعي (أسئلة مبنية على المحتوى الفعلي وليست عشوائية)
  const buildGroundingText = ()=>{
    const topicClips = clips.filter(c=>c.subject===subject&&c.stage===stage&&c.topic===topic&&gradeMatches(c)&&Array.isArray(c.slides));
    const chunks=[];
    topicClips.forEach(c=>{
      (c.slides||[]).forEach(s=>{
        chunks.push("### "+(s.title||"")+"\n"+(s.points||[]).join("\n"));
      });
    });
    // نحدد طول النص المرسل للذكاء الاصطناعي تجنباً لتجاوز حد الطلب
    return chunks.join("\n\n").slice(0,12000);
  };

  // نطلب دفعة واحدة من الأسئلة (حد أقصى BATCH لضمان استجابة JSON كاملة وسليمة من النموذج)
  // يحاول استخراج مصفوفة الأسئلة من نص الرد بعدة طرق (النموذج أحياناً يغلّفها بكائن، أو يضيف نصاً حولها رغم التعليمات)
  // يصلح الـ backslashes الخام غير الصحيحة داخل نص JSON (مثل رموز LaTeX $\omega^{64}$ أو $\frac{1}{2}$)
  // مهم: نتعرف أولاً على أي تسلسل هروب صحيح أصلاً (\\ \" \n \uXXXX ...) ونتركه كما هو،
  // وأي "\" وحيدة متبقية (غير جزء من تسلسل صحيح) نضاعفها. هذا يمنع كسر "\\omega" الصحيحة أصلاً.
  const sanitizeJsonBackslashes = (s)=>{
    return s.replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g, (m)=> m.length>1 ? m : "\\\\");
  };
  // يزيل أحرف تحكم خام (سطر جديد/تاب حقيقي غير مهروب) قد يضيفها النموذج داخل النص، وهذي غير صالحة داخل نص JSON
  const squashRawControlChars = (s)=> s.replace(/[\r\n\t]+/g, " ");
  // يقسّم محتوى مصفوفة JSON إلى عناصرها top-level بحساب عمق الأقواس (يتجاهل الأقواس الموجودة داخل النصوص)
  // يُستخدم كخطة بديلة أخيرة: نحلّل كل سؤال لحاله، ونتجاهل السؤال الخربان فقط بدل رفض الدفعة كاملة
  const splitTopLevelObjects = (arrInner)=>{
    const items = [];
    let depth = 0, inStr = false, start = -1;
    for(let i=0;i<arrInner.length;i++){
      const ch = arrInner[i];
      if(inStr){
        if(ch === "\\"){ i++; continue; }
        if(ch === "\"") inStr = false;
        continue;
      }
      if(ch === "\""){ inStr = true; continue; }
      if(ch === "{"){ if(depth===0) start = i; depth++; continue; }
      if(ch === "}"){ depth--; if(depth===0 && start!==-1){ items.push(arrInner.slice(start,i+1)); start=-1; } continue; }
    }
    return items;
  };
  const extractQuestionsArray = (rawClean)=>{
    const fixed = sanitizeJsonBackslashes(squashRawControlChars(rawClean));
    const start = fixed.indexOf("[");
    const end = fixed.lastIndexOf("]");
    // المحاولة 1: تحليل المصفوفة كاملة دفعة واحدة (الحالة الشائعة والأسرع)
    if(start!==-1 && end!==-1 && end>start){
      try{
        const arr = JSON.parse(fixed.substring(start,end+1));
        if(Array.isArray(arr)) return arr;
      }catch{}
    }
    // المحاولة 2: النص كله كائن JSON صحيح، والمصفوفة بداخله بأي اسم حقل (questions/data/items/...)
    try{
      const obj = JSON.parse(fixed);
      if(Array.isArray(obj)) return obj;
      const firstArray = Object.values(obj).find(v=>Array.isArray(v));
      if(firstArray) return firstArray;
    }catch{}
    // المحاولة 3 (احتياطية): نحلّل كل سؤال بمصفوفة على حدة، ونحتفظ بالأسئلة السليمة فقط
    // بدل رفض الدفعة كاملة بسبب خطأ صياغة بسؤال واحد فقط
    if(start!==-1 && end!==-1 && end>start){
      const objTexts = splitTopLevelObjects(fixed.substring(start+1,end));
      const salvaged = [];
      for(const t of objTexts){
        try{ salvaged.push(JSON.parse(t)); }catch{ /* نتجاهل هذا السؤال فقط ونكمل الباقي */ }
      }
      if(salvaged.length>0) return salvaged;
    }
    throw new Error("لم يُرجع المساعد صيغة JSON يمكن قراءتها");
  };

  // يطبّع شكل السؤال المولّد (بعض النماذج تستخدم أسماء حقول مختلفة قليلاً رغم التعليمات الصريحة)
  const normalizeQuestion = (q)=>{
    const question = q.question ?? q.q ?? q.text ?? q.prompt ?? "";
    let options = q.options ?? q.choices ?? q.answers;
    if(options && !Array.isArray(options) && typeof options==="object") options = Object.values(options);
    let correctIndex = q.correctIndex ?? q.correct ?? q.correct_index ?? q.answerIndex ?? q.correctAnswer;
    if(typeof correctIndex==="string"){
      const letterMap={a:0,b:1,c:2,d:3,A:0,B:1,C:2,D:3};
      correctIndex = letterMap[correctIndex] ?? Number(correctIndex);
    }
    return { question, options, correctIndex };
  };

  // ننتظر المدة المطلوبة ثم نعيد المحاولة تلقائياً — بدل فشل فوري — عند الوصول لحد الاستخدام المؤقت بواجهة Groq
  const sleep = (ms)=> new Promise(resolve=>setTimeout(resolve,ms));
  // يستخرج عدد الثواني المقترح للانتظار من رسالة خطأ Groq، مثل: "Please try again in 10.315s"
  const parseRetrySeconds = (message)=>{
    const m = /try again in ([\d.]+)s/i.exec(message||"");
    return m ? Math.ceil(parseFloat(m[1])) : null;
  };
  const MAX_RATE_LIMIT_RETRIES = 2;

  const generateBatch = async(grounding, batchCount)=>{
    const prompt = "أنت معلّم متخصص. بناءً على المحتوى الدراسي التالي لمادة "+subject+" ("+stage+" — فصل: "+topic+"):\n\n"+grounding
      +"\n\nأنشئ بالضبط "+batchCount+" سؤال اختيار من متعدد (MCQ) مبنية حصراً على هذا المحتوى، بحيث كل سؤال له 4 خيارات وخيار واحد صحيح فقط. "
      +"إذا كان المحتوى يتضمن معادلات أو رموز كيميائية أو رياضية بصيغة $...$ فحافظ على نفس الصيغة داخل نص السؤال أو الخيارات. "
      +"نوّع بين أسئلة مفاهيمية وأسئلة حسابية (إن وُجدت مسائل بالمحتوى). اجعل الخيارات الخاطئة قريبة منطقياً من الصحيحة (أخطاء شائعة) وليست عشوائية بلا معنى.\n\n"
      +"مهم جداً بخصوص صيغة الرد: أجب بمصفوفة JSON فقط، بلا أي نص أو مقدمة أو شرح قبلها أو بعدها، وبلا أسوار markdown (```)، ابدأ ردك مباشرة بالحرف [ وأنهِه بالحرف ]. "
      +"قاعدة إلزامية للحفاظ على صحة JSON: أي رمز \\ داخل رموز LaTeX (مثل \\omega أو \\frac) يجب كتابته مضاعفاً \\\\ داخل نصوص JSON (مثال: اكتب \"$\\\\omega^{64}$\" وليس \"$\\omega^{64}$\")، وإلا يصبح الرد JSON غير صالح. "
      +"استخدم بالضبط أسماء الحقول التالية: \"question\" (نص)، \"options\" (مصفوفة من 4 نصوص بالضبط)، \"correctIndex\" (رقم صحيح من 0 إلى 3 يمثل فهرس الخيار الصحيح بالمصفوفة، حيث 0 هو الخيار الأول). "
      +"مثال دقيق لعنصر واحد صحيح الصيغة:\n"
      +'[{"question":"ما ناتج 2+2؟","options":["3","4","5","6"],"correctIndex":1}]';

    let raw;
    let rateLimitAttempt = 0;
    while(true){
      try{
        raw = await callAI(prompt);
        break;
      }catch(e){
        const isRateLimit = /rate limit/i.test(e.message||"");
        if(isRateLimit && rateLimitAttempt<MAX_RATE_LIMIT_RETRIES){
          const waitSec = parseRetrySeconds(e.message) || 15;
          setGenProgress("⏳ تم الوصول للحد الأقصى المؤقت لطلبات الذكاء الاصطناعي — إعادة المحاولة تلقائياً خلال "+waitSec+" ثانية...");
          await sleep((waitSec+1)*1000); // ثانية إضافية أمان فوق ما اقترحته Groq
          rateLimitAttempt++;
          continue;
        }
        throw e; // ليس تحديد معدل، أو استُنفدت محاولات الإعادة التلقائية
      }
    }

    const clean = raw.replace(/```json/gi,"").replace(/```/g,"").trim();
    let rawArray;
    try{
      rawArray = extractQuestionsArray(clean);
    }catch(e){
      // نرفق معاينة أطول من رد النموذج الفعلي هنا أيضاً (كانت غائبة سابقاً بهذا المسار تحديداً)
      throw new Error(e.message+" — معاينة رد المساعد: "+(clean?clean.slice(0,400):"(رد فارغ تماماً)"));
    }
    const normalized = rawArray.map(normalizeQuestion);
    const valid = normalized.filter(q=>q.question && Array.isArray(q.options) && q.options.length===4 && Number.isInteger(q.correctIndex) && q.correctIndex>=0 && q.correctIndex<=3);
    if(valid.length===0){
      // نعرض معاينة من رد النموذج الفعلي بدل رسالة عامة، عشان يكون سبب الفشل واضحاً وقابلاً للتشخيص
      throw new Error("لم يجتز أي سؤال التحقق من الصيغة. معاينة الرد: "+clean.slice(0,400));
    }
    return valid;
  };

  // العدد الأقصى لكل طلب واحد للذكاء الاصطناعي — أعداد كبيرة تُقسّم تلقائياً لعدة دفعات متتالية لضمان استجابة JSON سليمة وكاملة من النموذج في كل مرة، وتقليل احتمال تجاوز حد الاستخدام بالدقيقة الواحدة
  const AI_BATCH_SIZE = 12;

  const generate = async()=>{
    if(!topic){ showMsg("اختر فصلاً أولاً"); return; }
    const grounding = buildGroundingText();
    if(!grounding.trim()){ showMsg("لا يوجد محتوى (شرائح) لهذا الفصل بعد لبناء أسئلة منه"); return; }
    const total = Math.max(1, Number(count)||1);
    setGenerating(true);
    setGenError(""); // نمسح أي خطأ سابق ظاهر بالشاشة قبل محاولة جديدة
    let collected = [];
    let lastBatchError = ""; // نحتفظ بآخر رسالة خطأ فعلية (فيها معاينة رد النموذج) لعرضها لو فشلت كل الدفعات
    try{
      const batches = Math.ceil(total/AI_BATCH_SIZE);
      for(let b=0;b<batches;b++){
        const remaining = total - collected.length;
        const thisBatch = Math.min(AI_BATCH_SIZE, remaining);
        if(batches>1) setGenProgress("جارٍ توليد الدفعة "+(b+1)+" من "+batches+" ("+collected.length+"/"+total+" سؤال حتى الآن)...");
        else setGenProgress("جارٍ توليد "+thisBatch+" سؤال...");
        if(b>0) await sleep(2000); // فاصل زمني بسيط بين الدفعات لتقليل احتمال تجاوز حد الاستخدام بالدقيقة
        try{
          const valid = await generateBatch(grounding, thisBatch);
          collected = [...collected, ...valid];
        }catch(e){
          // لو فشلت دفعة واحدة (مثلاً استجابة ناقصة من النموذج) نكمل بقية الدفعات بدل إلغاء كل شيء
          lastBatchError = e.message;
          if(batches>1) showMsg("تنبيه: فشلت دفعة ("+(b+1)+"/"+batches+")، جارٍ متابعة الباقي...");
        }
      }
      if(collected.length===0) throw new Error(lastBatchError || "لم يتم توليد أي سؤال صالح");
      setDrafts(prev=>[...prev, ...collected.map(q=>({...q, _tempId:Math.random().toString(36).slice(2)}))]);
      showMsg("تم توليد "+collected.length+" من أصل "+total+" سؤال مطلوب — راجعها ثم انشرها");
    }catch(e){
      setGenError(e.message); // نعرضها بشكل ثابت بالشاشة (مو Toast يختفي) عشان تكون قابلة للقراءة كاملة
      showMsg("فشل التوليد — التفاصيل ظاهرة تحت الزر");
    }
    setGenProgress("");
    setGenerating(false);
  };

  const updateDraft = (tempId,field,value)=>{
    setDrafts(prev=>prev.map(d=>d._tempId===tempId?{...d,[field]:value}:d));
  };
  const updateDraftOption = (tempId,optIdx,value)=>{
    setDrafts(prev=>prev.map(d=>{
      if(d._tempId!==tempId) return d;
      const opts=[...d.options]; opts[optIdx]=value; return {...d,options:opts};
    }));
  };
  const removeDraft = (tempId)=> setDrafts(prev=>prev.filter(d=>d._tempId!==tempId));

  const publishAll = async()=>{
    if(drafts.length===0) return;
    setPublishing(true);
    try{
      for(const d of drafts){
        await addDoc(collection(db,"examQuestions"),{
          subject, stage, grade, topic,
          question:d.question, options:d.options, correctIndex:d.correctIndex,
          published:true, createdAt:serverTimestamp(),
        });
      }
      showMsg("✅ تم نشر "+drafts.length+" سؤال بنجاح");
      setDrafts([]);
    }catch(e){ showMsg("فشل النشر: "+e.message); }
    setPublishing(false);
  };

  const deletePublished = async(id)=>{
    if(!window.confirm("حذف هذا السؤال نهائياً؟")) return;
    try{ await deleteDoc(doc(db,"examQuestions",id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  // ─── إضافة سؤال يدوياً ───
  const [manualQ,setManualQ]=useState(""); const [manualOpts,setManualOpts]=useState(["","","",""]); const [manualCorrect,setManualCorrect]=useState(0); const [addingManual,setAddingManual]=useState(false);
  const addManual = async()=>{
    if(!topic){ showMsg("اختر فصلاً أولاً"); return; }
    if(!manualQ.trim()||manualOpts.some(o=>!o.trim())){ showMsg("أكمل نص السؤال وكل الخيارات الأربعة"); return; }
    setAddingManual(true);
    try{
      await addDoc(collection(db,"examQuestions"),{subject,stage,grade,topic,question:manualQ,options:manualOpts,correctIndex:manualCorrect,published:true,createdAt:serverTimestamp()});
      setManualQ(""); setManualOpts(["","","",""]); setManualCorrect(0);
      showMsg("✅ تمت إضافة السؤال");
    }catch(e){ showMsg("فشل: "+e.message); }
    setAddingManual(false);
  };

  return <div>
    <div style={C.infoBanner}><ClipboardList size={15}/> اختر الفصل ثم ولّد أسئلة بالذكاء الاصطناعي من محتوى شرائحه، راجعها، ثم انشرها ليراها الطلاب بامتحان الفصل.</div>

    <label style={C.label}>المادة</label>
    <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>
      {SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
    <label style={C.label}>المرحلة</label>
    <select value={stage} onChange={e=>setStage(e.target.value)} style={C.select}>
      {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
    <label style={C.label}>الصف</label>
    <select value={grade} onChange={e=>setGrade(e.target.value)} style={C.select}>
      {(GRADES[stage]||[]).map(g=><option key={g} value={g}>{g}</option>)}
    </select>
    <label style={C.label}>الفصل</label>
    {topics.length===0
      ?<div style={{...C.infoBanner,backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171"}}>لا توجد فصول (مقاطع فيها اسم فصل) لهذه المادة/المرحلة/الصف بعد</div>
      :<select value={topic} onChange={e=>setTopic(e.target.value)} style={C.select}>
        {topics.map(t=><option key={t} value={t}>{t}</option>)}
      </select>
    }

    {topic&&<div style={{fontSize:"12px",color:"#71717a",marginBottom:"14px"}}>📊 عدد الأسئلة المنشورة حالياً لهذا الفصل: <strong style={{color:"#c4b5fd"}}>{topicPublished.length}</strong></div>}

    <label style={C.label}>عدد الأسئلة المطلوب توليدها (بلا حد أقصى — يُقسَّم تلقائياً لدفعات إذا كان العدد كبيراً)</label>
    <input type="number" min={1} value={count} onChange={e=>setCount(Number(e.target.value)||1)} style={C.input}/>

    <button disabled={generating||!topic} onClick={generate} style={{...C.purpleBtn,opacity:(generating||!topic)?0.6:1,marginBottom:(genProgress||genError)?"8px":"18px"}}>
      {generating?<><Spinner size={16}/> جارٍ التوليد بالذكاء الاصطناعي...</>:<><Wand2 size={16}/> ولّد أسئلة بالذكاء الاصطناعي</>}
    </button>
    {genProgress&&<div style={{fontSize:"12px",color:"#c4b5fd",textAlign:"center",marginBottom:"18px"}}>{genProgress}</div>}
    {genError&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"4px"}}>
          <span style={{color:"#f87171",fontWeight:"bold",fontSize:"13px"}}>⚠️ فشل التوليد — تفاصيل الخطأ</span>
          <button onClick={()=>setGenError("")} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",flexShrink:0}}><X size={16}/></button>
        </div>
        <div style={{fontSize:"12px",color:"#fca5a5",lineHeight:"1.6",userSelect:"text",wordBreak:"break-word",maxHeight:"180px",overflowY:"auto"}}>{genError}</div>
      </div>
    )}

    {/* ─── مراجعة الأسئلة المولّدة قبل النشر ─── */}
    {drafts.length>0&&<div style={{marginBottom:"20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <span style={{fontWeight:"bold",fontSize:"14px",color:"#fbbf24"}}>📝 مراجعة قبل النشر ({drafts.length})</span>
        <button disabled={publishing} onClick={publishAll} style={{padding:"8px 16px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#059669,#34d399)",color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
          {publishing?"جارٍ النشر...":"✅ نشر الكل"}
        </button>
      </div>
      {drafts.map(d=>(
        <div key={d._tempId} style={{...C.card,border:"1px solid rgba(251,191,36,0.25)",marginBottom:"8px"}}>
          <textarea value={d.question} onChange={e=>updateDraft(d._tempId,"question",e.target.value)} style={{...C.input,minHeight:"50px",marginBottom:"4px",fontFamily:"inherit"}}/>
          {d.question&&<div style={{backgroundColor:"#09090b",borderRadius:"8px",padding:"8px 10px",marginBottom:"10px",border:"1px dashed rgba(255,255,255,0.1)"}}>
            <div style={{fontSize:"9px",color:"#52525b",marginBottom:"3px"}}>معاينة الشكل النهائي للطالب:</div>
            <MathText text={d.question} style={{fontSize:"13px",color:"#e4e4e7"}}/>
          </div>}
          {d.options.map((opt,i)=>(
            <div key={i} style={{marginBottom:"8px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <input type="radio" checked={d.correctIndex===i} onChange={()=>updateDraft(d._tempId,"correctIndex",i)}/>
                <span style={{fontSize:"11px",fontWeight:"bold",color:"#a1a1aa",width:"14px",flexShrink:0}}>{String.fromCharCode(65+i)}</span>
                <input value={opt} onChange={e=>updateDraftOption(d._tempId,i,e.target.value)} style={{...C.input,marginBottom:0,padding:"8px 10px",fontSize:"12px",flex:1,border:d.correctIndex===i?"1px solid rgba(34,197,94,0.5)":C.input.border}}/>
              </div>
              {opt&&<div style={{marginRight:"22px",marginTop:"3px"}}><MathText text={opt} style={{fontSize:"12px",color:"#a1a1aa"}}/></div>}
            </div>
          ))}
          <button onClick={()=>removeDraft(d._tempId)} style={{width:"100%",padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginTop:"4px"}}>🗑 حذف من المسودة</button>
        </div>
      ))}
    </div>}

    {/* ─── إضافة سؤال يدوياً ─── */}
    {topic&&<div style={{...C.card,border:"1px solid rgba(255,255,255,0.08)",marginBottom:"20px"}}>
      <div style={{fontWeight:"bold",fontSize:"13px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}><Pencil size={14}/> إضافة سؤال يدوياً</div>
      <textarea placeholder="نص السؤال..." value={manualQ} onChange={e=>setManualQ(e.target.value)} style={{...C.input,minHeight:"50px",fontFamily:"inherit"}}/>
      {manualOpts.map((opt,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
          <input type="radio" checked={manualCorrect===i} onChange={()=>setManualCorrect(i)}/>
          <span style={{fontSize:"11px",fontWeight:"bold",color:"#a1a1aa",width:"14px",flexShrink:0}}>{String.fromCharCode(65+i)}</span>
          <input placeholder={"الخيار "+(i+1)} value={opt} onChange={e=>{const n=[...manualOpts];n[i]=e.target.value;setManualOpts(n);}} style={{...C.input,marginBottom:0,padding:"8px 10px",fontSize:"12px",flex:1}}/>
        </div>
      ))}
      <button disabled={addingManual} onClick={addManual} style={{...C.blueBtn,marginTop:"6px",marginBottom:0,opacity:addingManual?0.6:1}}>{addingManual?"جارٍ الإضافة...":"➕ إضافة السؤال"}</button>
    </div>}

    {/* ─── الأسئلة المنشورة حالياً ─── */}
    {topic&&topicPublished.length>0&&<div>
      <div style={{fontWeight:"bold",fontSize:"14px",color:"#4ade80",marginBottom:"10px"}}>✅ الأسئلة المنشورة ({topicPublished.length})</div>
      {topicPublished.map((q,i)=>(
        <div key={q.id} style={{...C.card,border:"1px solid rgba(34,197,94,0.15)",marginBottom:"6px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px"}}>
            <MathText text={(i+1)+". "+q.question} style={{fontSize:"13px",color:"#fff",flex:1}}/>
            <button onClick={()=>deletePublished(q.id)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",flexShrink:0}}><Trash2 size={16}/></button>
          </div>
          <div style={{fontSize:"11px",color:"#4ade80",marginTop:"6px"}}>✓ {String.fromCharCode(65+(q.correctIndex||0))} — <MathText text={q.options?.[q.correctIndex]} style={{fontSize:"11px",color:"#4ade80"}}/></div>
        </div>
      ))}
    </div>}
  </div>;
}

// ─── MAIN APP ────────────────────────────────────────────
export default function App() {
  const appScrollRef = useRef(null); // مرجع لحاوية التمرير الرئيسية بالتطبيق كامل
  const savedAdminScrollRef = useRef(0); // نحفظ فيه موضع التمرير بقائمة المقاطع قبل فتح نموذج التعديل/الإضافة
  const [screen,setScreen]=useState("welcome");
  const [role,setRole]=useState("guest");
  const [currentStudent,setCurrentStudent]=useState(null);
  const [students,setStudents]=useState([]);
  const [clips,setClips]=useState([]);
  const [mySubscriptions,setMySubscriptions]=useState({});
  const [globalPrices,setGlobalPrices]=useState({});
  const [studentProgress,setStudentProgress]=useState({});
  const [watchedClipIds,setWatchedClipIds]=useState([]);
  const [certifiedTopics,setCertifiedTopics]=useState([]);
  // درجات امتحانات الفصول: { "مادة__مرحلة__فصل": {score:Number, passed:Boolean, attempts:Number, lastAttemptAt} }
  const [examScores,setExamScores]=useState({});
  // آخر وقت تحدّث فيه تقدّم الطالب عموماً (مو خاص بمقطع معيّن — البيانات
  // المخزّنة بـFirestore فيها وقت تحديث واحد للمستند كامل، مو لكل مقطع لحاله)
  const [progressUpdatedAt,setProgressUpdatedAt]=useState(null);
  // ─── مكتبة الأناشيد/الموسيقى الخلفية (اختيارية أثناء الدراسة) ───
  const [audioTracks,setAudioTracks]=useState([]); // القائمة الكاملة (يديرها المدير)
  const [currentTrack,setCurrentTrack]=useState(null); // المسار المُشغَّل حالياً (أو null)
  const [audioPlaying,setAudioPlaying]=useState(false);
  const [audioVolume,setAudioVolume]=useState(0.6); // 0 إلى 1 — نبدأ بمستوى متوسط افتراضياً
  const audioRef = useRef(null); // مرجع عنصر <audio> الفعلي، يبقى نفسه بغض النظر عن الشاشة/الشريحة الحالية
  const [newCertificate,setNewCertificate]=useState(null); // {subject,stage,topic,examScore}
  const [streak,setStreak]=useState({days:0,lastDate:null,newRecord:false});
  const [xp,setXp]=useState(0); // نقاط الخبرة — تُخزَّن بنفس مستند "progress" الموجود أصلاً (لا حاجة لقاعدة أمان جديدة)
  const [slideFontSize,setSlideFontSize]=useState("medium"); // small/medium/large

  useEffect(()=>{
    // استرجاع جلسة الطالب (تخزين محلي، لا صلاحيات حساسة ولا كلمة مرور)
    const session = loadSession();
    if(session?.role === "student" && session?.student?.phone && session.student.name && session.student.account){
      setCurrentStudent(session.student);
      setRole("student");
      setScreen("home");
      registerPushToken(session.student.phone);
      syncInstallAndLastSeen(session.student.phone);
    } else if(session && session.role !== "admin"){
      clearSession();
    }
    // استرجاع جلسة المدير عبر Firebase Auth الحقيقي فقط (لا يمكن تزويرها من المتصفح)
    const unsubAuth = onAuthStateChanged(auth, (user)=>{
      if(user){
        setCurrentStudent(null);
        setRole("admin");
        setScreen(s=>s==="welcome"?"admin":s);
        saveSession({name:"المدير",email:user.email||""},"admin");
      } else {
        // إذا لم يعد هناك مستخدم مسجل بـ Firebase، تأكد عدم بقاء صلاحيات مدير وهمية
        setRole(r=>{
          if(r==="admin"){ clearSession(); return "guest"; }
          return r;
        });
      }
    });
    return ()=>unsubAuth();
  },[]);

  const [regName,setRegName]=useState(""); const [regPhone,setRegPhone]=useState(""); const [regAccount,setRegAccount]=useState(""); const [regPass,setRegPass]=useState(""); const [regStage,setRegStage]=useState("الابتدائية"); const [regGrade,setRegGrade]=useState("الأول"); const [regAccountType,setRegAccountType]=useState("student"); const [regPartnerCode,setRegPartnerCode]=useState(""); const [regErr,setRegErr]=useState("");
  const [loginPhone,setLoginPhone]=useState(""); const [loginPass,setLoginPass]=useState(""); const [loginErr,setLoginErr]=useState("");

  const [adminTab,setAdminTab]=useState("clips"); const [showClipForm,setShowClipForm]=useState(false);
  const [editingClip,setEditingClip]=useState(null);
  const [confirmDeleteClip,setConfirmDeleteClip]=useState(null);
  const [resetPassResult,setResetPassResult]=useState(null); // {phone,name,newPass} — نتيجة آخر إعادة تعيين كلمة مرور طالب
  const [showInactive,setShowInactive]=useState(false); // إظهار/إخفاء قائمة الحسابات الخاملة بتبويب الطلاب
  const [cSearch,setCSearch]=useState("");
  const [cSubj,setCSubj]=useState("");
  const [cStage,setCStage]=useState("");
  const [cSort,setCSort]=useState("num"); // num | date
  const [cNeedsFixOnly,setCNeedsFixOnly]=useState(false); // فلتر: أظهر فقط المقاطع اللي عنوانها لسا مو رقم صفحة نظيف
  // نفس قائمة المقاطع المفلترة/المرتبة المعروضة بتبويب الإدارة — نحسبها هنا (مو فقط
  // داخل الـJSX) عشان نقدر نستخدمها بـ"saveClip" لمعرفة "المقطع التالي" بنفس القائمة بالضبط
  const adminFilteredClips = React.useMemo(()=>{
    return clips.filter(c=>{
      if(cSearch&&!c.title?.includes(cSearch)&&!c.subject?.includes(cSearch)) return false;
      if(cSubj&&c.subject!==cSubj) return false;
      if(cStage&&c.stage!==cStage) return false;
      if(cNeedsFixOnly&&looksLikePageTitle(c.title)) return false;
      return true;
    }).sort((a,b)=>{
      if(cSort==="num") return Number(a.num||0)-Number(b.num||0);
      return (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
    });
  },[clips,cSearch,cSubj,cStage,cSort,cNeedsFixOnly]);
  const [clipStage,setClipStage]=useState("الابتدائية"); const [clipGrade,setClipGrade]=useState("الأول");
  const [clipSubject,setClipSubject]=useState("الرياضيات");
  const [clipTopic,setClipTopic]=useState(""); // الفصل
  const [clipNum,setClipNum]=useState("01");
  // صورة صفحة الكتاب المرتبطة بهذا المقطع (اختيارية) — تُعرض للطالب بضغطة على
  // أيقونة صغيرة تحت شارة رقم الصفحة، مستقلة تماماً عن رقم الصفحة النصي نفسه
  const [clipPageImage,setClipPageImage]=useState(null);
  const [clipTitle,setClipTitle]=useState(""); const [clipTeacher,setClipTeacher]=useState("");
  const [clipPhone,setClipPhone]=useState("");
  const [clipVideoUrl,setClipVideoUrl]=useState(""); const [savingClip,setSavingClip]=useState(false);
  const [clipThumbUrl,setClipThumbUrl]=useState(null);
  const [slidesTheme,setSlidesTheme]=useState("أزرق متدرج");
  const [notifTitle,setNotifTitle]=useState(""); const [notifBody,setNotifBody]=useState(""); const [sendingNotif,setSendingNotif]=useState(false);
  const [notifTarget,setNotifTarget]=useState("all"); // "all" أو "single"
  const [notifStudent,setNotifStudent]=useState(null); // الطالب المحدد عند الإرسال الفردي
  const [notifSearch,setNotifSearch]=useState(""); // نص البحث عن الطالب

  const [videoIdx,setVideoIdx]=useState(0); const [playing,setPlaying]=useState(false);
  const [currentSlideIdx,setCurrentSlideIdx]=useState(0);
  // قراءة صوتية للشريحة الحالية بالشاشة الرئيسية — الزر يظهر فقط لو الجهاز/المتصفح
  // عنده صوت عربي فعلي مثبت (وإلا نتجاهل الميزة كاملة بدل قراءة غير مفهومة)
  const [hasArabicVoice,setHasArabicVoice]=useState(false);
  const [speakingSlide,setSpeakingSlide]=useState(false);
  useEffect(()=>{
    const check=()=>setHasArabicVoice(!!getArabicVoice());
    check();
    if("speechSynthesis" in window){
      window.speechSynthesis.onvoiceschanged = check;
      return ()=>{ if(window.speechSynthesis) window.speechSynthesis.onvoiceschanged=null; };
    }
  },[]);
  useEffect(()=>()=>stopSpeaking(),[]); // نوقف أي قراءة جارية عند مغادرة التطبيق/الشاشة
  useEffect(()=>{ stopSpeaking(); setSpeakingSlide(false); },[currentSlideIdx,videoIdx]); // نوقف القراءة عند تغيّر الشريحة/الفيديو
  const toggleSlideSpeak = () => {
    if(speakingSlide){ stopSpeaking(); setSpeakingSlide(false); return; }
    const sl = video.slides?.[currentSlideIdx];
    if(!sl) return;
    const text = sl.title+". "+(sl.points||[]).join(". ");
    const ok = speakText(text, ()=>setSpeakingSlide(false));
    setSpeakingSlide(ok);
  };
  const [saved,setSaved]=useState(false); const [showMore,setShowMore]=useState(false);
  const [modal,setModal]=useState(null);
  const [selectedSubject,setSelectedSubject]=useState(null); // {subject, stage} للتصفح بالتسلسل
  const [examInitial,setExamInitial]=useState(null); // {subject,stage,topic} — يُمرَّر لفتح امتحان فصل محدد مباشرة
  // يفتح نافذة الامتحان: بفصل محدد (من الشهادة أو زر السحب السريع)، أو بلا فصل محدد (يختار الطالب بنفسه)
  const openExam = (subject,stage,topic) => { setExamInitial(subject&&stage&&topic?{subject,stage,topic}:null); setModal("exam"); };
  const [tapCount,setTapCount]=useState(0); const [showAdminLogin,setShowAdminLogin]=useState(false);
  // ─── جولة الشرح التعريفية (Onboarding) ────────────────────
  // تُفتح تلقائياً أول مرة فقط (لطلاب فقط، مو للإدارة) — نتحقق من localStorage
  // مرة وحدة عند التحميل الأول، مو بكل إعادة عرض للمكوّن
  const [showOnboarding,setShowOnboarding]=useState(()=>{
    try{ return localStorage.getItem("edutok_onboarding_seen")!=="1"; }catch{ return false; }
  });
  const tapTimer=useRef(null); const touchStartY=useRef(null); const touchStartX=useRef(null);
  const clipEnterTimeRef=useRef(Date.now()); const clipMaxSlideRef=useRef(0);
  const MIN_WATCH_SECONDS=8; // حد أدنى من الثواني على المقطع حتى تُحتسب "مشاهدة حقيقية"
  const [myNotifications,setMyNotifications]=useState([]); // إشعارات الطالب الحالي (عامة + موجهة له)
  const [lastSeenNotifAt,setLastSeenNotifAt]=useState(()=>{
    try{ return Number(localStorage.getItem("edutok_last_seen_notif")||0); }catch{ return 0; }
  });

  // ─── زر تثبيت التطبيق (PWA Install Prompt) ───
  const [installEvent,setInstallEvent]=useState(null);
  const [isInstalled,setIsInstalled]=useState(false);
  useEffect(()=>{
    // لو التطبيق مفتوح أصلاً بوضع standalone (مثبّت مسبقاً)، ما نعرض الزر
    try{
      if(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
      if(window.navigator.standalone) setIsInstalled(true); // iOS Safari المثبّت
    }catch{}
    const onBeforeInstall=(e)=>{ e.preventDefault(); setInstallEvent(e); };
    const onInstalled=()=>{ setIsInstalled(true); setInstallEvent(null); showMsg("✅ تم تثبيت التطبيق بنجاح"); };
    window.addEventListener("beforeinstallprompt",onBeforeInstall);
    window.addEventListener("appinstalled",onInstalled);
    return ()=>{
      window.removeEventListener("beforeinstallprompt",onBeforeInstall);
      window.removeEventListener("appinstalled",onInstalled);
    };
  },[]);
  const handleInstallClick=async()=>{
    if(!installEvent){ showMsg("التثبيت غير متاح بهذا المتصفح حالياً"); return; }
    installEvent.prompt();
    try{ await installEvent.userChoice; }catch{}
    setInstallEvent(null);
  };

  // نُعيد موضع التمرير بقائمة المقاطع بلوحة الإدارة بعد الرجوع من نموذج
  // التعديل/الإضافة (بدل ما ترجع القائمة تلقائياً لأول عنصر في كل مرة)
  useEffect(()=>{
    if(!showClipForm){
      requestAnimationFrame(()=>{
        if(appScrollRef.current) appScrollRef.current.scrollTop = savedAdminScrollRef.current;
      });
    }
  },[showClipForm]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"students"),snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u2=onSnapshot(collection(db,"clips"),snap=>{setClips(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u3=onSnapshot(collection(db,"audioTracks"),snap=>{setAudioTracks(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return ()=>{u1();u2();u3();};
  },[]);

  useEffect(()=>{
    if(!currentStudent?.phone) return;
    const unsub=onSnapshot(collection(db,"subscriptions"),snap=>{
      const subs={};
      snap.docs.forEach(d=>{
        const s=d.data();
        if(s.studentPhone!==currentStudent.phone) return;
        // الاشتراكات القديمة (قبل تفعيل التقييد بالصف) لا تحمل حقل grade أصلاً —
        // subAccessKey تتعامل مع هذا تلقائياً (تعتبرها "بلا صف محدد")
        const key=subAccessKey(s.subject,s.stage,s.grade);
        // لو فيه أكثر من سجل اشتراك لنفس المادة/المرحلة/الصف (بسبب تجديد أو تفعيل كود)
        // نحتفظ بالسجل صاحب أبعد تاريخ انتهاء فقط
        const existing=subs[key];
        if(!existing || new Date(s.expiresAt) > new Date(existing.expiresAt)) subs[key]=s;
      });
      setMySubscriptions(subs);
    });
    return ()=>unsub();
  },[currentStudent]);

  // إشعارات الطالب: العامة (بدون targetPhone) + الموجهة له شخصياً
  useEffect(()=>{
    if(role!=="student"||!currentStudent?.phone){setMyNotifications([]);return;}
    const unsub=onSnapshot(collection(db,"notifications"),snap=>{
      const list=snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(n=>!n.targetPhone||n.targetPhone===currentStudent.phone)
        .sort((a,b)=>(b.sentAt?.seconds||0)-(a.sentAt?.seconds||0));
      setMyNotifications(list);
    });
    return ()=>unsub();
  },[role,currentStudent]);

  // الأسعار العامة — تُحمَّل لكل المستخدمين لتحديد ما هو مجاني وما يحتاج اشتراك
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage&&data.value!==undefined){
          vals[data.subject+"__"+data.stage]=data.value;
        }
      });
      setGlobalPrices(vals);
    });
    return ()=>unsub();
  },[]);

  // حجم الخط — يُقرأ من Firestore ويُطبق على كل الشرائح
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","display"),snap=>{
      if(snap.exists()) setSlideFontSize(snap.data().fontSize||"medium");
    });
    return ()=>unsub();
  },[]);

  // تقدم الطالب — يُحمَّل عند تسجيل الدخول
  useEffect(()=>{
    if(role!=="student"||!currentStudent?.phone){setStudentProgress({});setWatchedClipIds([]);setCertifiedTopics([]);setExamScores({});setXp(0);setProgressUpdatedAt(null);return;}
    const unsub=onSnapshot(doc(db,"progress",currentStudent.phone),snap=>{
      if(snap.exists()){
        const d=snap.data();
        setStudentProgress(d.progress||{});
        setWatchedClipIds(d.watchedClipIds||[]);
        setCertifiedTopics(d.certifiedTopics||[]);
        setExamScores(d.examScores||{});
        setXp(d.xp||0);
        setProgressUpdatedAt(d.updatedAt||null);
      } else {
        setStudentProgress({});setWatchedClipIds([]);setCertifiedTopics([]);setExamScores({});setXp(0);setProgressUpdatedAt(null);
      }
    });
    return ()=>unsub();
  },[role,currentStudent]);

  // يضيف نقاط خبرة بأمان عبر increment الذرّي (يتجنب أي تعارض لو صار أكثر من إضافة بنفس اللحظة)
  const awardXP = (amount) => {
    if(!currentStudent?.phone || role!=="student") return;
    setDoc(doc(db,"progress",currentStudent.phone),{xp:increment(amount)},{merge:true}).catch(()=>{});
  };

  // يشغّل صوت + رسالة احتفال تلقائياً عند عبور مستوى جديد (يقارن المستوى قبل/بعد كل تغيّر بـ xp)
  const prevLevelRef = useRef(null);
  useEffect(()=>{
    const level = Math.floor((xp||0)/100)+1;
    if(prevLevelRef.current!==null && level>prevLevelRef.current){
      playLevelUpSound();
      showMsg("🎉 مبروك! وصلت للمستوى "+level+"!");
    }
    prevLevelRef.current = level;
  },[xp]);

  // يُستدعى بعد كل محاولة امتحان (نجاح أو رسوب) لحفظ النتيجة في نفس مستند التقدم
  const saveExamResult = (subject,stage,topic,score,passed) => {
    if(!currentStudent?.phone) return;
    const tKey = topicKey(subject,stage,topic);
    const prevAttempts = examScores[tKey]?.attempts || 0;
    const updated = {
      ...examScores,
      [tKey]: { score, passed, attempts: prevAttempts+1, lastAttemptAt: new Date().toISOString() }
    };
    setExamScores(updated);
    setDoc(doc(db,"progress",currentStudent.phone),{examScores:updated,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
    // نقاط خبرة عند أول نجاح بهذا الفصل بالذات (مو كل محاولة، حتى لا يصير فيه تكرار غير عادل)
    if(passed && !examScores[tKey]?.passed) awardXP(50);
    // لو نجح ولديه شهادة معروضة حالياً لنفس الفصل، حدّثها لتُظهر الدرجة الجديدة فوراً
    if(passed) setNewCertificate(nc => (nc && nc.subject===subject && nc.stage===stage && nc.topic===topic) ? {...nc, examScore:updated[tKey]} : nc);
  };

  // ─── نظام Streak (مع تجميد اختياري: مرة واحدة بالشهر تحمي السلسلة لو فات يوم وحد بالغلط) ───
  useEffect(()=>{
    if(role!=="student"||!currentStudent?.phone) return;
    const updateStreak=async()=>{
      const ref=doc(db,"streaks",currentStudent.phone);
      const snap=await getDoc(ref);
      const today=new Date().toDateString();
      const thisMonth = new Date().getFullYear()+"-"+new Date().getMonth();
      if(!snap.exists()){
        // أول دخول
        await setDoc(ref,{days:1,lastDate:today,maxDays:1,freezesUsed:0,freezeMonth:thisMonth});
        setStreak({days:1,lastDate:today,newRecord:true});
        return;
      }
      const data=snap.data();
      if(data.lastDate===today){
        // دخل اليوم من قبل
        setStreak({days:data.days,lastDate:data.lastDate,newRecord:false,maxDays:data.maxDays});
        return;
      }
      const yesterday=new Date();
      yesterday.setDate(yesterday.getDate()-1);
      const isConsecutive=data.lastDate===yesterday.toDateString();

      // رصيد التجميد يتصفّر تلقائياً أول كل شهر جديد
      const freezesUsedThisMonth = data.freezeMonth===thisMonth ? (data.freezesUsed||0) : 0;
      const FREEZE_LIMIT = 1;
      let savedByFreeze = false;
      if(!isConsecutive && freezesUsedThisMonth<FREEZE_LIMIT){
        const twoDaysAgo=new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate()-2);
        // نسمح بالتجميد فقط لو فات "يوم واحد بالضبط" (مو أكثر) — يحمي السلسلة من انقطاع عرضي بسيط
        if(data.lastDate===twoDaysAgo.toDateString()) savedByFreeze = true;
      }

      const newDays=(isConsecutive||savedByFreeze)?data.days+1:1;
      const newMax=Math.max(newDays,data.maxDays||0);
      const isNewRecord=newDays>=(data.maxDays||0)&&newDays>1;
      const newFreezesUsed = savedByFreeze ? freezesUsedThisMonth+1 : freezesUsedThisMonth;
      await setDoc(ref,{days:newDays,lastDate:today,maxDays:newMax,freezesUsed:newFreezesUsed,freezeMonth:thisMonth},{merge:true});
      setStreak({days:newDays,lastDate:today,newRecord:isNewRecord,maxDays:newMax,savedByFreeze});
      if(savedByFreeze) showMsg("❄️ استخدمنا تجميد السلسلة تلقائياً — سلسلتك محفوظة!");
    };
    updateStreak().catch(()=>{});
  },[role,currentStudent]);

  useEffect(()=>{if(screen==="home")setPlaying(true);else setPlaying(false);},[screen]);
  useEffect(()=>{if(screen==="home")setPlaying(true);},[videoIdx]);

  // ─── قائمة الفيديوهات حسب حالة الطالب ──────────────────
  const allVideos = React.useMemo(()=>{
    const firebaseClips = [...clips];

    // لو اختار الطالب مادة → يرى مقاطعها بالتسلسل
    if(selectedSubject){
      // نحسب القائمة دائماً من "clips" الحالية (مو من نسخة مجمّدة) حتى تنعكس أي إضافة/حذف فوراً
      let filtered=firebaseClips.filter(c=>
        c.subject===selectedSubject.subject && c.stage===selectedSubject.stage &&
        (!selectedSubject.grade || c.grade===selectedSubject.grade || !c.grade) &&
        (!selectedSubject.topic || c.topic===selectedSubject.topic) &&
        // نستبعد أي مقطع ناقص البيانات (بلا عنوان) من واجهة الطالب — غالباً مسودة/تجربة
        // لم تُكمَّل بلوحة الإدارة، وعرضها للطالب يعني مقطع فارغ بلا معنى
        (role!=="student" || !!(c.title&&c.title.trim()))
      );

      // نحسب ترتيب الفصول حسب تسلسلها الفعلي بالمنهج (أصغر رقم مقطع بكل فصل) —
      // نفس الطريقة المستخدمة بقائمة اختيار الفصل — لنستخدمها بخيار "كل الفصول"
      const topicMinNum={};
      firebaseClips.forEach(c=>{
        if(c.subject===selectedSubject.subject && c.stage===selectedSubject.stage &&
           (!selectedSubject.grade || c.grade===selectedSubject.grade || !c.grade) && c.topic){
          const n=Number(c.num||0);
          if(!(c.topic in topicMinNum) || n<topicMinNum[c.topic]) topicMinNum[c.topic]=n;
        }
      });
      const orderedTopics=Object.keys(topicMinNum).sort((a,b)=>topicMinNum[a]-topicMinNum[b]);
      const topicRank={};
      orderedTopics.forEach((t,i)=>{topicRank[t]=i;});

      if(!selectedSubject.topic){
        // خيار "كل الفصول": يجب أن يعرض كل فصل كاملاً بالتسلسل ثم ينتقل للفصل التالي.
        // ملاحظة مهمة: أي مقطع بلا "فصل" محدد، أو باسم فصل لا يطابق أياً من الفصول
        // المعروفة (خطأ إملائي/مسافة زائدة عند الإدخال)، يجب ألا يُحسب ضمن الفصل الأول
        // (كان الكود سابقاً يضعه بالخطأ في نفس ترتيب الفصل الأول عبر ?? 0، فتظهر
        // مقاطع "غريبة" داخل قسم أول فصل بالتحديد) — لذلك نضعه في ترتيب مستقل بآخر القائمة
        const UNTAGGED_RANK = orderedTopics.length;
        filtered = filtered.sort((a,b)=>{
          const ra = (a.topic && a.topic in topicRank) ? topicRank[a.topic] : UNTAGGED_RANK;
          const rb = (b.topic && b.topic in topicRank) ? topicRank[b.topic] : UNTAGGED_RANK;
          if(ra!==rb) return ra-rb;
          return Number(a.num||0)-Number(b.num||0);
        });
      } else {
        // فصل محدد بالفعل → كل المقاطع من نفس الفصل، الترتيب برقم المقطع كافٍ
        filtered = filtered.sort((a,b)=>Number(a.num||0)-Number(b.num||0));
      }

      // عند اختيار "كل الفصول" (بدون تحديد فصل)، لازم نطبّق نفس قفل الامتحانات
      // المستخدم بشاشة اختيار الفصل — وإلا يصير فيه تعارض: فصل مقفول بقائمة الفصول
      // لكنه يظهر ويُشغَّل بحرية عبر خيار "كل الفصول"
      if(!selectedSubject.topic && role==="student"){
        const lockedTopics=new Set();
        orderedTopics.forEach((topic,i)=>{
          const prevTopic = i>0 ? orderedTopics[i-1] : null;
          const isLocked = prevTopic && !examScores?.[topicKey(selectedSubject.subject,selectedSubject.stage,prevTopic)]?.passed;
          if(isLocked) lockedTopics.add(topic);
        });
        if(lockedTopics.size>0){
          filtered = filtered.filter(c=>!c.topic || !lockedTopics.has(c.topic));
        }
      }

      if(selectedSubject.isFree===false && !hasAccess(mySubscriptions,globalPrices,selectedSubject.subject,selectedSubject.stage,selectedSubject.grade)){
        // مدفوعة وغير مشترك بها: أول 5 مقاطع بالتسلسل (معاينة)، والباقي عشوائي —
        // لكن **داخل كل فصل لوحده**، مو عشوائي عبر كل المادة دفعة وحدة. لو عمّمنا
        // العشوائية على كل شيء بعد أول 5 (زي الكود القديم)، بترجع نفس مشكلة تداخل
        // الفصول ببعضها. أما لو الطالب مشترك فعلاً بهذه المادة/المرحلة/الصف تحديداً،
        // فيرى كل شيء بالتسلسل الطبيعي (زي المواد المجانية بالضبط) — الدفع سبق واستحق
        // له كامل المحتوى مرتباً، والعشوائية هنا معاينة تسويقية فقط لغير المشتركين.
        const first5=filtered.slice(0,5);
        const restByTopic={};
        const restTopicOrder=[];
        filtered.slice(5).forEach(c=>{
          const key = (c.topic && c.topic in topicRank) ? c.topic : "__untagged__";
          if(!(key in restByTopic)){ restByTopic[key]=[]; restTopicOrder.push(key); }
          restByTopic[key].push(c);
        });
        const rest = restTopicOrder.flatMap(key=>restByTopic[key].sort(()=>Math.random()-0.5));
        return [...first5,...rest];
      }
      return filtered;
    }

    // مدير: يرى الكل مرتباً بالتسلسل (num) لكل مادة
    if(role==="admin"){
      return [...firebaseClips].sort((a,b)=>{
        const subjectCompare=(a.subject||"").localeCompare(b.subject||"","ar");
        if(subjectCompare!==0) return subjectCompare;
        return Number(a.num||0)-Number(b.num||0);
      });
    }

    // طالب: تقسيم المقاطع حسب سعر كل مادة + حالة اشتراكه الفعلية بها (وليس السعر فقط)
    const grouped={};
    firebaseClips.forEach(clip=>{
      const key=(clip.subject||"")+"__"+(clip.stage||"");
      if(!grouped[key]) grouped[key]=[];
      grouped[key].push(clip);
    });

    const orderedClips=[];   // مجانية، أو مدفوعة لكن الطالب مشترك بها فعلاً — بالتسلسل
    const randomClips=[];    // مدفوعة وغير مشترك بها — عشوائية (معاينة)

    Object.entries(grouped).forEach(([key,group])=>{
      const [subject,stage]=key.split("__");
      // نتحقق من كل مقطع على حدة (وليس مرة واحدة للمجموعة) لأن كل مقطع قد يحمل
      // صفاً مختلفاً ضمن نفس المادة/المرحلة، والاشتراك أصبح مقيّداً بالصف تحديداً
      group.forEach(clip=>{
        if(hasAccess(mySubscriptions,globalPrices,subject,stage,clip.grade)){
          orderedClips.push(clip);
        } else {
          randomClips.push(clip);
        }
      });
    });
    // نرتب كل مجموعة "بالتسلسل" حسب رقمها داخل مادتها (كانت المجموعة المجانية already
    // غير مرتبة صراحة سابقاً بهذا المسار العام، فنطبّق نفس الترتيب المتّبع بمسار الفصل أعلاه)
    orderedClips.sort((a,b)=>{
      const subjectCompare=(a.subject||"").localeCompare(b.subject||"","ar");
      if(subjectCompare!==0) return subjectCompare;
      return Number(a.num||0)-Number(b.num||0);
    });
    // نأخذ عشوائياً 10 فقط من كل مادة/مرحلة غير مشترك بها (معاينة)، بدل كل المقاطع
    const randomBySubject={};
    randomClips.forEach(c=>{
      const k=(c.subject||"")+"__"+(c.stage||"");
      if(!randomBySubject[k]) randomBySubject[k]=[];
      randomBySubject[k].push(c);
    });
    const randomLimited=Object.values(randomBySubject).flatMap(g=>[...g].sort(()=>Math.random()-0.5).slice(0,10));

    // المجانية/المشترك بها أولاً بالتسلسل، ثم غير المشترك بها عشوائياً
    return [...orderedClips, ...randomLimited.sort(()=>Math.random()-0.5)];

  },[clips, selectedSubject, role, globalPrices, examScores, mySubscriptions]);

  // placeholder فارغ لو ما فيه مقاطع
  const EMPTY_VIDEO = {id:"empty",title:"",teacher:"",subject:"",stage:"",bg:"linear-gradient(180deg,#0f172a,#1e1b4b)",videoUrl:"",slides:[]};
  const video = allVideos[videoIdx] || EMPTY_VIDEO;

  const handleLogoTap=()=>{setTapCount(c=>{const n=c+1;if(n>=10){setShowAdminLogin(true);clearTimeout(tapTimer.current);return 0;}clearTimeout(tapTimer.current);tapTimer.current=setTimeout(()=>setTapCount(0),4000);return n;});};

  // ─── مزامنة عنصر الصوت الفعلي مع الحالة ───────────────────
  // (1) لما يتغيّر المسار المختار، نحمّل رابطه الجديد بعنصر <audio> ونشغّله
  useEffect(()=>{
    const el = audioRef.current;
    if(!el) return;
    if(currentTrack?.url){
      if(el.src!==currentTrack.url){ el.src=currentTrack.url; }
      if(audioPlaying){
        el.play().catch(e=>{
          // نعرض السبب الحقيقي بدل ما يفضل الطالب يشوف "يشتغل" بصمت بدون صوت —
          // غالباً السبب رابط مو ملف صوتي مباشر (مثل رابط صفحة يوتيوب عادية
          // بدل رابط MP3 مباشر) أو الخادم يرفض الوصول (CORS)
          setAudioPlaying(false);
          showMsg("تعذّر تشغيل \""+currentTrack.title+"\": "+(e.message||"تأكد إن الرابط ملف صوتي مباشر (MP3) وليس رابط صفحة عادية"));
        });
      }
    } else {
      el.pause();
    }
  },[currentTrack]);
  // (2) تشغيل/إيقاف مؤقت (Play/Pause) دون تغيير المسار نفسه
  useEffect(()=>{
    const el = audioRef.current;
    if(!el||!currentTrack) return;
    if(audioPlaying){
      el.play().catch(e=>{
        setAudioPlaying(false);
        showMsg("تعذّر تشغيل \""+currentTrack.title+"\": "+(e.message||"تأكد إن الرابط ملف صوتي مباشر (MP3) وليس رابط صفحة عادية"));
      });
    }
    else el.pause();
  },[audioPlaying]);
  // (3) تحديث مستوى الصوت فوراً كل ما الطالب يحرّك شريط التحكم
  useEffect(()=>{
    const el = audioRef.current;
    if(el) el.volume = audioVolume;
  },[audioVolume]);
  const handleTouchStart=(e)=>{
    touchStartY.current=e.touches[0].clientY;
    touchStartX.current=e.touches[0].clientX;
  };
  const handleTouchEnd=(e)=>{
    if(touchStartY.current===null)return;
    const diffY=touchStartY.current-e.changedTouches[0].clientY;
    const diffX=touchStartX.current-(e.changedTouches[0].clientX||0);
    const absY=Math.abs(diffY);
    const absX=Math.abs(diffX);
    if(absY<40&&absX<40){touchStartY.current=null;return;}
    const currentVideo=allVideos[videoIdx];
    const isSlides=currentVideo?.type==="شرائح AI"&&currentVideo?.slides?.length>0;
    if(absX>absY&&isSlides){
      // سحب أفقي → تنقل بين الشرائح
      const total=currentVideo.slides.length;
      if(diffX>0) setCurrentSlideIdx(i=>Math.min(i+1,total-1));
      else setCurrentSlideIdx(i=>Math.max(i-1,0));
    } else if(absY>absX){
      // سحب عمودي → تنقل بين المقاطع (نتحقق أولاً من مشاهدة حقيقية للمقطع الحالي قبل مغادرته)
      markClipWatched(currentVideo);
      if(diffY>0) {const ni=Math.min(videoIdx+1,allVideos.length-1);setVideoIdx(ni);setCurrentSlideIdx(0);saveProgress(ni);}
      else {const ni=Math.max(videoIdx-1,0);setVideoIdx(ni);setCurrentSlideIdx(0);saveProgress(ni);}
    }
    touchStartY.current=null;
  };
  const handleTouchMove=(e)=>{
    if(e.touches[0].clientY > touchStartY.current && window.scrollY === 0){
      e.preventDefault();
    }
  };

  // ─── إعادة تعيين كلمة مرور طالب (بديل "نسيت كلمة المرور" — الطالب ما عنده بريد إلكتروني للاستعادة الذاتية) ───
  // المدير مسجّل دخوله فعلياً بصلاحيات موثوقة (Firebase Auth)، فحساب الهاش هنا بجهة العميل مقبول أمنياً
  // (بعكس تسجيل الدخول/التسجيل العاديين اللي انتقلا للسيرفر لأنهما يشتغلان بدون أي مصادقة مسبقة)
  const resetStudentPassword = async(s)=>{
    if(!window.confirm(`إعادة تعيين كلمة مرور ${s.name}؟ سيتم توليد كلمة مرور جديدة عشوائية وإلغاء القديمة.`)) return;
    const newPass = generateRandomCode(8);
    try{
      const {hash,salt} = await hashPassword(newPass);
      // بيانات الدخول محفوظة بمستند فرعي مغلق منفصل (students/{phone}/private/auth) — راجع قواعد Firestore
      await setDoc(doc(db,"students",s.phone,"private","auth"),{passHash:hash,passSalt:salt});
      setResetPassResult({phone:s.phone,name:s.name,newPass});
      showMsg("✅ تم تعيين كلمة مرور جديدة — أرسلها للطالب يدوياً");
    }catch(e){ showMsg("فشل: "+e.message); }
  };

  // ─── ملاحظة أمان: التسجيل والدخول أصبحا يمرّان عبر السيرفر (api/register.js و api/login.js) ───
  // بدل قراءة/مقارنة كلمة المرور المُشفّرة (hash/salt) مباشرة من المتصفح، وهذا يمنع أي محاولة
  // لقراءة أو تخمين الهاش لو كانت صلاحيات القراءة بقاعدة البيانات غير محكمة تماماً.
  const doRegister=async()=>{
    if(!regName.trim())return setRegErr("الرجاء إدخال الاسم");
    if(!regPhone.trim())return setRegErr("الرجاء إدخال رقم الموبايل");
    if(!regAccount.trim())return setRegErr("الرجاء إدخال اسم الحساب");
    if(!regPass.trim())return setRegErr("الرجاء إدخال كلمة المرور");
    try{
      const res = await fetch("/api/register",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name:regName.trim(), phone:regPhone.trim(), account:regAccount.trim(), password:regPass.trim(),
          stage:regStage, grade:regGrade, accountType:regAccountType, partnerCode:regPartnerCode.trim(),
        })
      });
      let d;
      try{ d = await res.json(); }
      catch{ return setRegErr("تعذّر الاتصال بالخادم (رمز "+res.status+")"); }
      if(!d.ok) return setRegErr(d.error||"فشل التسجيل");
      const s = d.student;
      setCurrentStudent(s);setRole("student");setScreen("home");saveSession(s,"student");
      registerPushToken(s.phone);
      syncInstallAndLastSeen(s.phone);
      setRegName("");setRegPhone("");setRegAccount("");setRegPass("");setRegStage("الابتدائية");setRegGrade("الأول");setRegAccountType("student");setRegPartnerCode("");setRegErr("");
    }
    catch(e){setRegErr("فشل التسجيل: "+e.message);}
  };

  const doLogin=async()=>{
    if(!loginPhone.trim()||!loginPass.trim())return setLoginErr("أدخل رقم الموبايل وكلمة المرور");
    try{
      const res = await fetch("/api/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ phone:loginPhone.trim(), password:loginPass.trim() })
      });
      let d;
      try{ d = await res.json(); }
      catch{ return setLoginErr("تعذّر الاتصال بالخادم (رمز "+res.status+")"); }
      if(!d.ok) return setLoginErr(d.error||"فشل تسجيل الدخول");
      const s = d.student;
      setCurrentStudent(s);setRole("student");setScreen("home");saveSession(s,"student");
      registerPushToken(s.phone);
      syncInstallAndLastSeen(s.phone);
      setLoginPhone("");setLoginPass("");setLoginErr("");
    }catch(e){ setLoginErr("فشل تسجيل الدخول: "+e.message); }
  };

  // حساب الرقم التلقائي للمقطع الجديد
  // يحسب رقم المقطع التالي، ويجلب آخر فصل/معلم/موبايل مستخدَمة لنفس المادة+المرحلة+الصف
  // (نفس الفكرة المستخدمة باستوديو الشرائح) — تُستخدم فقط عند إضافة مقطع جديد، وتبقى كل الحقول قابلة للتعديل يدوياً
  const getAutoFillClip = (subject, stage, grade) => {
    const similar = clips.filter(c=>
      c.subject===subject && c.stage===stage && (!grade||c.grade===grade)
    );
    if(similar.length===0) return {num:"01", topic:"", teacher:"", phone:""};
    let maxNum=-1, last=null;
    similar.forEach(c=>{
      const n=Number(c.num||0);
      if(n>=maxNum){ maxNum=n; last=c; }
    });
    return {
      num: String((maxNum>=0?maxNum:0)+1).padStart(2,"0"),
      topic: last?.topic || "",
      teacher: last?.teacher || "",
      phone: last?.phone || "",
    };
  };
  // يطبّق التعبئة التلقائية على كل الحقول دفعة واحدة (تُستدعى عند تغيير المرحلة/الصف/المادة أو فتح نموذج مقطع جديد)
  const applyAutoFillClip = (subject, stage, grade) => {
    const a = getAutoFillClip(subject, stage, grade);
    setClipNum(a.num);
    setClipTopic(a.topic);
    setClipTeacher(a.teacher);
    setClipPhone(a.phone);
  };

  const openEditClip=(clip)=>{
    // نحفظ موضع التمرير فقط لو كانت القائمة هي المعروضة فعلاً حالياً (أول مرة
    // ندخل التعديل قادمين منها) — لو استُدعيت هذي الدالة وإحنا أصلاً بنموذج
    // مفتوح (زي حالة "حفظ والتالي")، ما نلمس القيمة المحفوظة حتى ما تنكسر
    if(!showClipForm) savedAdminScrollRef.current = appScrollRef.current?.scrollTop || 0;
    setEditingClip(clip);
    setClipTitle(clip.title||"");
    setClipTeacher(clip.teacher||"");
    setClipPhone(clip.phone||"");
    setClipStage(clip.stage||"الابتدائية");
    setClipGrade(clip.grade||"الأول");
    setClipSubject(clip.subject||"الرياضيات");
    setClipTopic(clip.topic||"");
    setClipPageImage(clip.pageImage||null);
    setClipNum(clip.num||"01");
    setClipVideoUrl(clip.videoUrl||"");
    setClipThumbUrl(clip.thumbUrl||null);
    setShowClipForm(true);
  };

  const resetClipForm=()=>{
    setEditingClip(null);
    setClipTitle("");setClipTeacher("");setClipVideoUrl("");
    setClipPhone("");
    setClipThumbUrl(null);setClipNum("01");
    setClipStage("الابتدائية");setClipGrade("الأول");
    setClipSubject("الرياضيات");
    setClipTopic("");
    setClipPageImage(null);
    setShowClipForm(false);
  };

  const saveClip=async(goToNext)=>{
    if(!clipTitle.trim())return showMsg("أدخل عنوان المقطع");
    setSavingClip(true);
    try{
      // نعتبر العنوان "رقم صفحة" فقط لو كان رقماً صرفاً أو مدى أرقام ("102" أو
      // "120-121") — أما لو كان نصاً عادياً (خصوصاً بمقطع قديم بصيغة عنوان
      // مختلفة زي "المقطع 13 - الصفحة 102")، لا نستبدل به رقم الصفحة المحفوظ
      // أصلاً حتى لا نكسر البحث بالصفحة لذاك المقطع تحديداً
      const data={
        title:clipTitle,stage:clipStage,grade:clipGrade,subject:clipSubject,
        topic:clipTopic,page: looksLikePageTitle(clipTitle) ? clipTitle.trim() : (editingClip?.page||clipTitle),
        pageImage:clipPageImage,num:clipNum,teacher:clipTeacher,phone:clipPhone,
        videoUrl:clipVideoUrl,thumbUrl:clipThumbUrl,
        bg:"linear-gradient(180deg,#0f172a,#1e1b4b)"
      };
      const wasEditingId = editingClip?.id;
      if(wasEditingId){
        await updateDoc(doc(db,"clips",wasEditingId),data);
        showMsg(" تم تعديل المقطع!");
      } else {
        await addDoc(collection(db,"clips"),{...data,createdAt:serverTimestamp()});
        showMsg(" تم حفظ المقطع وسيظهر في الشاشة الرئيسية!");
      }
      // "حفظ والتالي": ننتقل مباشرة لتعديل المقطع التالي بنفس القائمة المعروضة
      // (بنفس الفلتر/الترتيب الحاليين) بدل الرجوع لقائمة الكل من جديد — مفيد
      // لمراجعة/تصحيح مقاطع كثيرة بالتتابع بدون التنقل يدوياً بين كل واحد والثاني
      if(goToNext && wasEditingId){
        const idx = adminFilteredClips.findIndex(c=>c.id===wasEditingId);
        const next = idx>=0 ? adminFilteredClips[idx+1] : null;
        if(next){ openEditClip(next); setSavingClip(false); return; }
        else showMsg(" تم تعديل المقطع! (كان آخر واحد بالقائمة)");
      }
      resetClipForm();
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSavingClip(false);
  };

  const sendNotif=async()=>{
    if(!notifTitle.trim()||!notifBody.trim())return showMsg("أدخل العنوان والنص");
    if(notifTarget==="single"&&!notifStudent)return showMsg("اختر الطالب الذي تريد إرسال الإشعار له");
    setSendingNotif(true);
    try{
      if(notifTarget==="single"){
        await sendNotification({phone:notifStudent.phone,title:notifTitle,body:notifBody});
        showMsg(" تم إرسال الإشعار إلى "+notifStudent.name);
      }else{
        await sendNotification({phone:null,title:notifTitle,body:notifBody});
        showMsg(" تم إرسال الإشعار لـ "+students.length+" طالب!");
      }
      setNotifTitle("");setNotifBody("");setNotifStudent(null);setNotifSearch("");setNotifTarget("all");
    }
    catch(e){showMsg("فشل: "+e.message);}
    setSendingNotif(false);
  };

  const applyTemplate=(t)=>{const T={expire:["تنبيه انتهاء الاشتراك","عزيزي الطالب، يرجى تجديد اشتراكك."],new_video:["تم رفع درس جديد! ","قام الأستاذ برفع مقطع تعليمي جديد الآن."],remind:["حان وقت المذاكرة ","ادخل وراجع دروسك ربع ساعة."],offer:["خصم 50% لفترة محدودة ","اشترك الآن بنصف السعر."]};setNotifTitle(T[t][0]);setNotifBody(T[t][1]);};

  const closeModal=()=>setModal(null);

  // إعادة ضبط تتبّع المشاهدة كل ما تغيّر المقطع الحالي
  useEffect(()=>{
    clipEnterTimeRef.current = Date.now();
    clipMaxSlideRef.current = 0;
  },[videoIdx]);
  // تحديث أقصى شريحة فرعية وصلها الطالب داخل نفس المقطع
  useEffect(()=>{
    if(currentSlideIdx>clipMaxSlideRef.current) clipMaxSlideRef.current=currentSlideIdx;
  },[currentSlideIdx]);

  // حفظ تقدم الطالب عند مشاهدة مقطع من مادة مشترك بها + تتبع المقاطع المشاهدة لأجل الشهادات
  const saveProgress = (idx) => {
    const v = allVideos[idx];
    if(!v||!currentStudent?.phone||role!=="student") return;
    if(!isSubscribed(mySubscriptions,v.subject,v.stage,v.grade)) return;
    const key = subKey(v.subject,v.stage);
    const newProgress = {...studentProgress,[key]:idx};
    setStudentProgress(newProgress);
    setDoc(doc(db,"progress",currentStudent.phone),{progress:newProgress,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
  };

  // يُستدعى على المقطع "المُغادَر" فقط (مو المقطع الجديد)، ويتحقق فعلياً إنه شوهد بشكل حقيقي:
  // (1) بقي عليه مدة كافية، و(2) شاف كل الشرائح الفرعية بداخله (لو كان مقطع "شرائح AI" متعدد الشرائح)
  const markClipWatched = (v) => {
    if(!v||!currentStudent?.phone||role!=="student") return;
    if(!isSubscribed(mySubscriptions,v.subject,v.stage,v.grade)) return;

    const elapsedSeconds = (Date.now()-clipEnterTimeRef.current)/1000;
    const isSlidesClip = v.type==="شرائح AI" && v.slides?.length>0;
    const totalSubSlides = isSlidesClip ? v.slides.length : 1;
    const sawAllSubSlides = !isSlidesClip || clipMaxSlideRef.current >= totalSubSlides-1;
    const qualifies = elapsedSeconds >= MIN_WATCH_SECONDS && sawAllSubSlides;
    if(!qualifies) return; // سحب سريع بدون قراءة فعلية → لا تُحتسب

    const newWatched = watchedClipIds.includes(v.id) ? watchedClipIds : [...watchedClipIds, v.id];
    if(newWatched!==watchedClipIds){ setWatchedClipIds(newWatched); awardXP(10); }

    let newCertified = certifiedTopics;
    // نتحقق فقط للمقاطع اللي فيها "فصل" محدد (بدون فصل ما نقدر نحدد "فصل مكتمل")
    if(v.topic){
      const tKey = topicKey(v.subject,v.stage,v.topic);
      const topicClips = clips.filter(c=>c.subject===v.subject && c.stage===v.stage && c.topic===v.topic);
      // نسمح بفتح امتحان الفصل حتى لو فوّت الطالب مقاطع، بحد أقصى MAX_SKIPPED_CLIPS
      // مقاطع مفوّتة — بدل اشتراط مشاهدة كل مقطع بدون استثناء
      const watchedCount = topicClips.filter(c=>newWatched.includes(c.id)).length;
      const missingCount = topicClips.length - watchedCount;
      const allWatched = topicClips.length>0 && missingCount<=MAX_SKIPPED_CLIPS;
      if(allWatched && !certifiedTopics.includes(tKey)){
        newCertified = [...certifiedTopics, tKey];
        setCertifiedTopics(newCertified);
        // تظهر الشهادة فوراً عند إتمام المشاهدة، لكن درجة الامتحان تبقى فارغة حتى ينجح الطالب بامتحان الفصل
        setNewCertificate({subject:v.subject, stage:v.stage, topic:v.topic, examScore:examScores[tKey]||null});
      }
    }

    setDoc(doc(db,"progress",currentStudent.phone),{watchedClipIds:newWatched,certifiedTopics:newCertified,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
  };
  const showNav=screen!=="welcome"&&screen!=="login"&&screen!=="register";
  // للـ PDF: مجاني لو سعر "ملازم PDF" = 0، أو لو الطالب مشترك بأي مادة
  const isPDFFree = isFreeSubject(globalPrices,"ملازم PDF","عام");
  const isSubbed = isPDFFree || Object.values(mySubscriptions).some(s=>new Date(s.expiresAt)>new Date());

  // عدد الإشعارات غير المقروءة (بناءً على آخر وقت فتح الطالب للقائمة)
  const unreadNotifCount=myNotifications.filter(n=>(n.sentAt?.seconds||0)*1000>lastSeenNotifAt).length;
  const openNotifications=()=>{
    setModal("notifications");
    const now=Date.now();
    setLastSeenNotifAt(now);
    try{ localStorage.setItem("edutok_last_seen_notif", String(now)); }catch{}
  };

  return (
    <div style={C.app} ref={appScrollRef}>
      {/* حركة شعار التطبيق — عائمة خفيفة بميلان بسيط، عمداً دائمة بجذر
          التطبيق (مو داخل مشغّل الشرائح) عشان تشتغل بكل الشاشات وليس فقط
          شاشة الفيديو الرئيسية */}
      <style>{`
        @keyframes logoFloat{
          0%,100%{ transform:translateY(0) rotate(0deg); }
          50%{ transform:translateY(-3px) rotate(4deg); }
        }
        .app-logo-img{ animation: logoFloat 3s ease-in-out infinite; }
      `}</style>

      {/* عنصر الصوت الفعلي — مخفي، ثابت بجذر التطبيق عشان يستمر التشغيل بغض
          النظر عن الشاشة أو الشريحة الحالية، ولا يُعاد تركيبه (remount) عند
          أي تنقّل بالتطبيق */}
      <audio ref={audioRef} onEnded={()=>setAudioPlaying(false)}
        onError={()=>{
          if(currentTrack){
            setAudioPlaying(false);
            showMsg("تعذّر تحميل \""+currentTrack.title+"\" — تأكد الرابط صحيح ويشير لملف MP3 مباشر");
          }
        }}
        style={{display:"none"}}/>

      {/* HEADER */}
      {showNav&&screen!=="home"&&(
        <div style={C.header}>
          <div style={C.logoRow} onClick={handleLogoTap}>
            <img src={LOGO} alt="logo" className="app-logo-img" style={{width:28,height:28}}/>
            <div><span style={{fontSize:"20px",fontWeight:"900",color:"#38bdf8"}}>EduTok</span><span style={{fontSize:"10px",color:"#71717a",display:"block"}}>التعلم بطريقة ممتعة</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            {!isInstalled&&installEvent&&(
              <button onClick={handleInstallClick} style={{background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.35)",borderRadius:"20px",padding:"6px 12px",color:"#38bdf8",fontSize:"11px",fontWeight:"bold",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}>
                <Plus size={13}/> تثبيت
              </button>
            )}
          </div>
        </div>
      )}

      {/* WELCOME */}
      {screen==="welcome"&&(
        <div style={C.welcomeWrap}>
          <img src={LOGO} alt="EduTok" style={{width:120,height:120,marginBottom:16}}/>
          <h1 style={C.welcomeTitle}>EduTok</h1>
          <p style={{color:"#a1a1aa",fontSize:"14px",marginBottom:"16px"}}> التعلم بطريقة ممتعة</p>
          {!isInstalled&&installEvent&&(
            <button onClick={handleInstallClick} style={{...C.gradBtn,maxWidth:"280px",background:"linear-gradient(to right,#0ea5e9,#38bdf8)"}}>
              <Plus size={18}/> تثبيت التطبيق على الجهاز
            </button>
          )}
          <div style={{height:"16px"}}/>
          <button style={C.primaryBtn} onClick={()=>setScreen("register")}>إنشاء حساب جديد</button>
          <button style={C.secondaryBtn} onClick={()=>{setLoginPhone("");setLoginPass("");setLoginErr("");setScreen("login");}}>لدي حساب — تسجيل الدخول</button>
        </div>
      )}

      {/* REGISTER */}
      {screen==="register"&&(
        <div style={{padding:"32px 24px"}}>
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"48px"}}>📝</span><h2 style={{fontSize:"22px",fontWeight:"bold",margin:"8px 0 4px"}}>إنشاء حساب جديد</h2></div>
          <label style={C.label}> الاسم الكامل</label><input type="text" placeholder="مثال: أحمد محمد" value={regName} onChange={e=>{setRegName(e.target.value);setRegErr("");}} style={C.input}/>

          {/* نوع الحساب */}
          <label style={C.label}> نوع الحساب</label>
          <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
            {[{key:"student",label:"👨‍🎓 طالب"},{key:"teacher",label:"👨‍🏫 أستاذ"}].map(t=>(
              <button key={t.key} onClick={()=>setRegAccountType(t.key)} type="button" style={{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${regAccountType===t.key?"rgba(56,189,248,0.6)":"rgba(255,255,255,0.08)"}`,background:regAccountType===t.key?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.03)",color:regAccountType===t.key?"#38bdf8":"#71717a",fontSize:"13px",fontWeight:regAccountType===t.key?"700":"400",cursor:"pointer"}}>
                {t.label}
              </button>
            ))}
          </div>

          <label style={C.label}> رقم الموبايل</label><input type="text" placeholder="07XX XXX XXXX" value={regPhone} onChange={e=>{setRegPhone(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> اسم الحساب</label><input type="text" placeholder="مثال: ahmed2025" value={regAccount} onChange={e=>{setRegAccount(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> كود شراكة (اختياري)</label><input type="text" placeholder="لو وصلك من صفحة/مجموعة شريكة" value={regPartnerCode} onChange={e=>{setRegPartnerCode(e.target.value.toUpperCase());setRegErr("");}} style={C.input}/>
          <label style={C.label}> المرحلة الدراسية</label>
          <select value={regStage} onChange={e=>{setRegStage(e.target.value);setRegGrade((GRADES[e.target.value]||[])[0]||"الأول");setRegErr("");}} style={C.select}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <label style={C.label}> الصف الدراسي</label>
          <select value={regGrade} onChange={e=>{setRegGrade(e.target.value);setRegErr("");}} style={C.select}>
            {(GRADES[regStage]||["الأول","الثاني","الثالث","الرابع","الخامس","السادس"]).map(g=><option key={g}>{g}</option>)}
          </select>
          <label style={C.label}> كلمة المرور</label><input type="password" placeholder="كلمة المرور" value={regPass} onChange={e=>{setRegPass(e.target.value);setRegErr("");}} style={C.input}/>
          <ErrBox msg={regErr}/>
          <button style={C.primaryBtn} onClick={doRegister}>إنشاء الحساب والدخول ←</button>
          <div style={{textAlign:"center",marginTop:"10px"}}><span style={{color:"#a1a1aa",fontSize:"13px"}}>لدي حساب؟ </span><span style={{color:"#38bdf8",cursor:"pointer",fontWeight:"bold",fontSize:"13px"}} onClick={()=>{setLoginPhone("");setLoginPass("");setLoginErr("");setScreen("login");}}>تسجيل الدخول</span></div>
          <div style={{textAlign:"center",marginTop:"8px"}}><span style={{color:"#52525b",cursor:"pointer",fontSize:"12px"}} onClick={()=>setScreen("welcome")}>← رجوع</span></div>
        </div>
      )}

      {/* LOGIN */}
      {screen==="login"&&(
        <div style={{padding:"40px 24px"}}>
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"55px"}}>🔐</span><h2 style={{fontSize:"24px",fontWeight:"bold",margin:"8px 0"}}>تسجيل الدخول</h2></div>
          <div style={{...C.infoBanner,marginBottom:"16px"}}> للطلاب المسجلين فقط</div>
          <label style={C.label}> رقم الموبايل</label><input type="text" placeholder="07XX XXX XXXX" value={loginPhone} onChange={e=>{setLoginPhone(e.target.value);setLoginErr("");}} style={C.input}/>
          <label style={C.label}> كلمة المرور</label><input type="password" placeholder="كلمة المرور" value={loginPass} onChange={e=>{setLoginPass(e.target.value);setLoginErr("");}} style={C.input} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          <ErrBox msg={loginErr}/>
          <button style={C.primaryBtn} onClick={doLogin}>دخول ←</button>
          <div style={{textAlign:"center",marginTop:"10px"}}><span style={{color:"#a1a1aa",fontSize:"13px"}}>ليس لديك حساب؟ </span><span style={{color:"#38bdf8",cursor:"pointer",fontWeight:"bold",fontSize:"13px"}} onClick={()=>{setRegName("");setRegPhone("");setRegAccount("");setRegPass("");setRegErr("");setScreen("register");}}>سجل الآن</span></div>
          <div style={{textAlign:"center",marginTop:"8px"}}><span style={{color:"#52525b",cursor:"pointer",fontSize:"12px"}} onClick={()=>setScreen("welcome")}>← رجوع</span></div>
        </div>
      )}

      {/* HOME */}
      {screen==="home"&&(
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} style={{...C.fullScreenWrap,userSelect:"none",overscrollBehavior:"none"}}>

          {/* خلفية/مشغل الفيديو يغطي الشاشة كاملة */}
          <div style={{position:"absolute",inset:0,background:video.bg||"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
            <div style={{position:"absolute",top:"60px",bottom:"80px",left:"80px",right:0,zIndex:4,cursor:"pointer"}} onClick={()=>setPlaying(p=>!p)}/>
            <VideoPlayer video={video} playing={playing} onClick={()=>setPlaying(p=>!p)}
              canAccess={role!=="student"||!video.subject||hasAccess(mySubscriptions,globalPrices,video.subject,video.stage,video.grade)}
              onSubscribe={()=>setModal("description")}
              externalSlideIdx={currentSlideIdx}
              onExternalSlideChange={setCurrentSlideIdx}
              fontSize={slideFontSize}
            />
          </div>

          {/* هيدر عائم شفاف */}
          <div style={C.fullHeader}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
              <div style={C.logoRow} onClick={handleLogoTap}>
                <img src={LOGO} alt="logo" className="app-logo-img" style={{width:26,height:26}}/>
                <span style={{fontSize:"18px",fontWeight:"900",color:"#fff"}}>EduTok</span>
              </div>
              {video.grade&&(
                <div style={{display:"flex",alignItems:"center",gap:"4px",background:"linear-gradient(135deg,#f59e0b,#d97706)",borderRadius:"20px",padding:"3px 10px 3px 8px",boxShadow:"0 2px 10px rgba(245,158,11,0.4)",marginTop:"6px",animation:"gradeBadgeIn 0.5s ease-out both"}}>
                  <GraduationCap size={11} color="#fff" strokeWidth={2.5}/>
                  <span style={{color:"#fff",fontSize:"11px",fontWeight:"900",letterSpacing:"0.3px"}}>الصف {video.grade}</span>
                </div>
              )}
              {/* المرحلة الدراسية — تحت شارة الصف مباشرة، بنفس السطر لوحدها */}
              {video.stage&&(
                <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.1)",borderRadius:"20px",padding:"3px 10px",marginTop:"4px"}}>
                  <span style={{color:"rgba(255,255,255,0.85)",fontSize:"10px",fontWeight:"bold"}}>{video.stage}</span>
                </div>
              )}
            </div>
          </div>

          {/* ملاحظة: تم حذف مؤشر وضع تصفح المادة العلوي بناءً على طلب المستخدم
              (كان يظهر كشارة "المادة • المرحلة" مع زر إغلاق أعلى وسط الشاشة
              ويتداخل بصرياً مع عداد الشرائح واسم الفصل) */}

          {/* الشريط الجانبي العائم */}
          <div style={C.sidebar}>
            {[
              [<Bot size={18} color="#fff"/>,"مساعد",()=>{setModal("ai");setPlaying(false);},false],
              [<MessageCircle size={18} color="#fff"/>,"نقاش",()=>setModal("chat"),false],
              [<Save size={18} color="#fff"/>,"PDF",()=>{setModal("pdf");setPlaying(false);},false],
              [<BookOpen size={18} color="#fff"/>,"تصفح وبحث",()=>{setModal("browsesearch");setPlaying(false);},false],
            ].map(([icon,label,fn,active],i)=>(
              <button key={i} style={C.sideBtn(active)} onClick={fn}>{icon}<span style={C.sideTxt(active)}>{label}</span></button>
            ))}
            {role==="student"&&(
              <button style={C.sideBtn(false)} onClick={()=>{setPlaying(false);openExam(video.subject,video.stage,video.topic);}}>
                <GraduationCap size={18} color="#fff"/><span style={C.sideTxt(false)}>امتحان</span>
              </button>
            )}
            {/* تقدّمي بالفصل الحالي — متاح دائماً بغض النظر عن حالة الاشتراك، حتى يعرف
                الطالب بوضوح كم مقطع باقي عليه قبل ما يُقفل امتحان الفصل */}
            {role==="student"&&video.topic&&(
              <button style={C.sideBtn(false)} onClick={()=>{setPlaying(false);setModal("description");}}>
                <ClipboardList size={18} color="#fff"/><span style={C.sideTxt(false)}>تقدّمي</span>
              </button>
            )}
            {role==="student"&&(
              <button style={{...C.sideBtn(false),position:"relative"}} onClick={openNotifications}>
                <Bell size={18} color="#fff"/>
                <span style={C.sideTxt(false)}>الإشعارات</span>
                {unreadNotifCount>0&&<span style={{position:"absolute",top:"-2px",right:"-2px",backgroundColor:"#ef4444",color:"#fff",borderRadius:"9px",minWidth:"16px",height:"16px",fontSize:"9px",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{unreadNotifCount>9?"9+":unreadNotifCount}</span>}
              </button>
            )}
            {/* قراءة صوتية للشريحة — تظهر فقط لو الجهاز يدعم صوتاً عربياً فعلياً */}
            {hasArabicVoice&&video.slides?.length>0&&(
              <button style={C.sideBtn(false)} onClick={toggleSlideSpeak}>
                <Volume2 size={18} color={speakingSlide?"#38bdf8":"#fff"}/>
                <span style={C.sideTxt(false)}>{speakingSlide?"إيقاف":"استماع"}</span>
              </button>
            )}
            <button style={C.sideBtn(false)} onClick={()=>setShowMore(m=>!m)}><MoreHorizontal size={18} color="#fff"/><span style={C.sideTxt(false)}>المزيد</span></button>
          </div>

          {/* قائمة "المزيد" */}
          {showMore&&<div style={C.moreMenu}>
            {[[<Camera size={22} color="#fff"/>,"حل ذكي","solve"],[<FileText size={22} color="#fff"/>,"تفاصيل الاشتراك","description"]].map(([icon,label,key])=>(
              <button key={key} style={C.moreItem} onClick={()=>{setModal(key);setShowMore(false);}}>{icon}<span style={{fontSize:"11px",marginTop:"4px"}}>{label}</span></button>
            ))}
            {currentStudent?.accountType==="teacher"&&(
              <button style={C.moreItem} onClick={()=>{setModal("uploadpdf");setShowMore(false);}}>
                <BookOpen size={22} color="#f97316"/><span style={{fontSize:"11px",marginTop:"4px",color:"#f97316"}}>رفع ملزمة</span>
              </button>
            )}
          </div>}

          {/* شريط تنقل عائم أسفل الشاشة */}
          {showNav&&(
            <div style={C.floatingNav}>
              {role==="admin"&&<button style={C.navItem(false)} onClick={()=>setScreen("admin")}><Settings size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>إدارة</span></button>}
              <button style={C.navItem(false)} onClick={()=>setScreen("account")}><User size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>حسابي</span></button>
              <button style={C.navItem(true)} onClick={()=>setScreen("home")}><Home size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>الرئيسية</span></button>
            </div>
          )}
        </div>
      )}

      {/* ADMIN */}
      {screen==="admin"&&(
        <div>
          <div style={C.tabsGrid}>
            {ADMIN_TABS.map(({key,label,Icon})=><button key={key} style={C.tab(adminTab===key)} onClick={()=>{setAdminTab(key);setShowClipForm(false);}}><Icon size={11}/>{label}</button>)}
          </div>
          <div style={C.section}>
            {adminTab==="clips"&&!showClipForm&&(
              <div>
                {confirmDeleteClip&&(
                  <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
                    <div style={{color:"#f87171",fontWeight:"bold",marginBottom:"8px"}}>هل تريد حذف "{confirmDeleteClip.title}"؟</div>
                    <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
                      <button onClick={()=>{
                        if(confirmDeleteClip.id) deleteDoc(doc(db,"clips",confirmDeleteClip.id)).then(()=>showMsg("تم الحذف")).catch(e=>showMsg("فشل: "+e.message));
                        setConfirmDeleteClip(null);
                      }} style={{padding:"8px 20px",backgroundColor:"#ef4444",border:"none",borderRadius:"8px",color:"#fff",fontWeight:"bold",cursor:"pointer"}}>نعم، احذف</button>
                      <button onClick={()=>setConfirmDeleteClip(null)} style={{padding:"8px 20px",backgroundColor:"#27272a",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer"}}>إلغاء</button>
                    </div>
                  </div>
                )}

                {/* بحث وفلتر المقاطع */}
                {(()=>{
                  const needsFixCount = clips.filter(c=>!looksLikePageTitle(c.title)).length;
                  const filtered = adminFilteredClips;
                  return <>
                    {needsFixCount>0&&(
                      <div style={{backgroundColor:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:"12px",padding:"10px 12px",marginBottom:"12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                        <span style={{fontSize:"12px",color:"#fbbf24"}}>⚠️ {needsFixCount} مقطع عنوانه لسا مو رقم صفحة نظيف (لن يُحدَّث رقم صفحته تلقائياً)</span>
                        <button onClick={()=>setCNeedsFixOnly(v=>!v)} style={{flexShrink:0,padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(251,191,36,0.4)",backgroundColor:cNeedsFixOnly?"rgba(251,191,36,0.2)":"transparent",color:"#fbbf24",fontSize:"11px",fontWeight:"bold",cursor:"pointer"}}>
                          {cNeedsFixOnly?"إظهار الكل":"عرضها فقط"}
                        </button>
                      </div>
                    )}
                    <div style={{backgroundColor:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:"14px",padding:"12px",marginBottom:"12px"}}>
                      <input value={cSearch} onChange={e=>setCSearch(e.target.value)} placeholder="ابحث عن مقطع..." style={{...C.input,marginBottom:"8px",fontSize:"13px"}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                        <select value={cSubj} onChange={e=>setCSubj(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:cSubj?"#fff":"#71717a",fontSize:"12px"}}>
                          <option value="">كل المواد</option>
                          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                        </select>
                        <select value={cStage} onChange={e=>setCStage(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:cStage?"#fff":"#71717a",fontSize:"12px"}}>
                          <option value="">كل المراحل</option>
                          {STAGES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      {(cSearch||cSubj||cStage||cNeedsFixOnly)&&<div style={{fontSize:"11px",color:"#71717a",marginTop:"6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span>{filtered.length} نتيجة</span>
                        <button onClick={()=>{setCSearch("");setCSubj("");setCStage("");setCNeedsFixOnly(false);}} style={{background:"none",border:"none",color:"#f87171",fontSize:"11px",cursor:"pointer"}}>مسح ✕</button>
                      </div>}
                    </div>

                    {/* أزرار الترتيب */}
                    <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
                      <button onClick={()=>setCSort("num")} style={{flex:1,padding:"8px",borderRadius:"10px",border:`1px solid ${cSort==="num"?"rgba(56,189,248,0.5)":"rgba(255,255,255,0.08)"}`,background:cSort==="num"?"rgba(56,189,248,0.12)":"rgba(255,255,255,0.03)",color:cSort==="num"?"#38bdf8":"#71717a",fontSize:"12px",fontWeight:cSort==="num"?"700":"400",cursor:"pointer"}}>
                        🔢 رقم المقطع
                      </button>
                      <button onClick={()=>setCSort("date")} style={{flex:1,padding:"8px",borderRadius:"10px",border:`1px solid ${cSort==="date"?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.08)"}`,background:cSort==="date"?"rgba(168,85,247,0.12)":"rgba(255,255,255,0.03)",color:cSort==="date"?"#a855f7":"#71717a",fontSize:"12px",fontWeight:cSort==="date"?"700":"400",cursor:"pointer"}}>
                        🕐 تاريخ الإضافة
                      </button>
                    </div>
                    {filtered.map((clip,i)=>{
                      const needsFix = !looksLikePageTitle(clip.title);
                      return (
                      <div key={clip.id||i} style={{...C.card,border:needsFix?"1px solid rgba(251,191,36,0.35)":"1px solid rgba(139,92,246,0.2)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                          {clip.thumbUrl?<img src={clip.thumbUrl} alt="" style={{width:44,height:44,borderRadius:"8px",objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:"8px",background:clip.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center"}}><Film size={20} color="#fff"/></div>}
                          <div style={{flex:1}}>
                            <div style={{fontWeight:"bold",fontSize:"14px"}}>{clip.num?`#${clip.num} `:""}{clip.title}</div>
                            <div style={{fontSize:"12px",color:"#71717a"}}>{clip.subject} • {clip.stage}{clip.grade?` • ${clip.grade}`:""} • {clip.type||"معلم"}</div>
                          </div>
                        </div>
                        {needsFix&&<div style={{fontSize:"11px",color:"#fbbf24",marginBottom:"8px"}}>⚠️ العنوان مو رقم صفحة نظيف — رقم صفحته الحالي: {clip.page||"(غير محدد)"}</div>}
                        {clip.videoUrl&&<div style={{fontSize:"11px",color:"#34d399",marginBottom:"8px"}}>✅ {getYoutubeId(clip.videoUrl)?"يوتيوب":"فيديو مباشر"}</div>}
                        {clip.slides&&<div style={{fontSize:"11px",color:"#a855f7",marginBottom:"8px"}}> {clip.slides.length} شريحة</div>}
                        <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
                          <button onClick={()=>openEditClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
                          <button onClick={()=>setConfirmDeleteClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حذف</button>
                        </div>
                      </div>
                      );
                    })}
                    {filtered.length===0&&clips.length>0&&<div style={{textAlign:"center",padding:"20px",color:"#52525b"}}><Search size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد نتائج</div></div>}
                  </>;
                })()}

                <div style={{textAlign:"center",padding:"16px 0 10px"}}>
                  {clips.length===0&&<><Film size={48} color="#3f3f46" style={{margin:"0 auto 12px"}}/><p style={{color:"#71717a",fontSize:"14px",margin:"0 0 16px"}}>لا توجد مقاطع بعد</p></>}
                  <button style={C.gradBtn} onClick={()=>{
                    savedAdminScrollRef.current = appScrollRef.current?.scrollTop || 0;
                    setEditingClip(null);
                    applyAutoFillClip(clipSubject,clipStage,clipGrade);
                    setShowClipForm(true);
                  }}><Plus size={18}/> إضافة مقطع جديد</button>
                </div>
              </div>
            )}
            {adminTab==="clips"&&showClipForm&&(
              <div>
                <div style={{...C.infoBanner,marginBottom:"12px"}}><Film size={16}/><span style={{fontWeight:"bold"}}>{editingClip?"تعديل المقطع":"بيانات المقطع الجديد"}</span></div>
                <button style={{width:"100%",padding:"11px",backgroundColor:"#27272a",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px",fontSize:"13px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} onClick={resetClipForm}><X size={14}/> إغلاق</button>
                <div style={C.twoCol}>
                  <div><label style={C.label}>المرحلة</label><select style={C.select} value={clipStage} onChange={e=>{const s=e.target.value;const g=(GRADES[s]||[])[0]||"";setClipStage(s);setClipGrade(g);if(!editingClip)applyAutoFillClip(clipSubject,s,g);}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label style={C.label}>الصف</label><select style={C.select} value={clipGrade} onChange={e=>{const g=e.target.value;setClipGrade(g);if(!editingClip)applyAutoFillClip(clipSubject,clipStage,g);}}>{(GRADES[clipStage]||[]).map(g=><option key={g}>{g}</option>)}</select></div>
                </div>
                <div>
                  <label style={C.label}>المادة</label><select style={C.select} value={clipSubject} onChange={e=>{const subj=e.target.value;setClipSubject(subj);if(!editingClip)applyAutoFillClip(subj,clipStage,clipGrade);}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
                </div>
                <div><label style={C.label}>رقم المقطع</label><input type="text" value={clipNum} onChange={e=>setClipNum(e.target.value)} style={C.input} placeholder="01"/></div>
                <label style={C.label}>صورة صفحة الكتاب (اختياري)</label>
                {clipPageImage
                  ? <div style={{position:"relative",marginBottom:"14px"}}>
                      <img src={clipPageImage} alt="صفحة الكتاب" style={{width:"100%",maxHeight:"180px",objectFit:"contain",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.1)",backgroundColor:"#000"}}/>
                      <button onClick={()=>setClipPageImage(null)} style={{position:"absolute",top:"8px",left:"8px",background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#f87171"}}><X size={15}/></button>
                    </div>
                  : <ImageUploader onUpload={url=>setClipPageImage(url)} onBase64={()=>{}} color="#38bdf8" label="ارفع صورة صفحة الكتاب"/>
                }
                {/* العنوان هنا هو نفسه رقم الصفحة (مثلاً "102") — بلا داعٍ لحقل "رقم
                    الصفحة" منفصل يكرر نفس الرقم. القيمة تُحفظ تلقائياً كـ"رقم صفحة"
                    بالخلفية حتى تستمر ميزة "بحث دقيق بالصفحة" وشارة الصفحة تعمل بلا تغيير */}
                <label style={C.label}>العنوان (رقم الصفحة)</label><input type="text" value={clipTitle} onChange={e=>setClipTitle(e.target.value)} placeholder="مثال: 102" style={C.input}/>
                <label style={C.label}>الفصل (اختياري)</label><input type="text" value={clipTopic} onChange={e=>setClipTopic(e.target.value)} placeholder="مثال: الخلية، المعادلات التربيعية..." style={C.input}/>
                <div style={C.twoCol}>
                  <div><label style={C.label}>المعلم</label><input type="text" value={clipTeacher} onChange={e=>setClipTeacher(e.target.value)} placeholder="أ. محمد" style={C.input}/></div>
                  <div><label style={C.label}>الموبايل</label><input type="text" value={clipPhone} onChange={e=>setClipPhone(e.target.value)} placeholder="07XX..." style={C.input}/></div>
                </div>
                <label style={C.label}> صورة مصغرة</label>
                <ImageUploader onUpload={url=>setClipThumbUrl(url)} onBase64={()=>{}} color="#a855f7" label="اختر صورة مصغرة للمقطع"/>
                <label style={C.label}> رابط الفيديو</label>
                <div style={{...C.infoBanner,marginBottom:"10px",fontSize:"12px"}}>✅ يدعم روابط يوتيوب ورفع الفيديو المباشر</div>
                <input type="text" placeholder="https://youtube.com/watch?v=... أو رابط مباشر" value={clipVideoUrl} onChange={e=>setClipVideoUrl(e.target.value)} style={C.input}/>
                <div style={C.saveRow}>
                  <button style={C.cancelBtn} onClick={resetClipForm}>إلغاء</button>
                  <button disabled={savingClip} style={{...C.saveBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",opacity:savingClip?0.7:1}} onClick={()=>saveClip(false)}>
                    {savingClip?<><Spinner size={15}/> جارٍ الحفظ...</>:<><Save size={15}/> {editingClip?"حفظ التعديلات":"حفظ وعرض"}</>}
                  </button>
                </div>
                {/* أثناء التعديل فقط (مو الإضافة الجديدة): زر إضافي ينتقل مباشرة
                    لتعديل المقطع التالي بنفس القائمة المعروضة — مفيد لمراجعة عدة
                    مقاطع متتالية بسرعة (مثلاً تصحيح عناوين قديمة) بدون الرجوع للقائمة كل مرة */}
                {editingClip&&(
                  <button disabled={savingClip} style={{width:"100%",marginTop:"8px",padding:"10px",borderRadius:"10px",border:"1px solid rgba(52,211,153,0.35)",backgroundColor:"rgba(52,211,153,0.08)",color:"#34d399",fontSize:"13px",fontWeight:"bold",cursor:"pointer",opacity:savingClip?0.7:1}} onClick={()=>saveClip(true)}>
                    حفظ والانتقال للمقطع التالي ←
                  </button>
                )}
              </div>
            )}
            {adminTab==="slides"&&<SlidesStudio slidesTheme={slidesTheme} setSlidesTheme={setSlidesTheme} onSaveClip={clip=>setClips(p=>[...p,clip])} clips={clips}/>}
            {adminTab==="editor"&&<ContentEditor/>}
            {adminTab==="exams"&&<AdminExamsTab/>}
            {adminTab==="pdf"&&<AdminPDFTab/>}
            {adminTab==="teacherpdf"&&<TeacherPDFRequests/>}
            {adminTab==="wallet"&&<AdminWalletTab/>}
            {adminTab==="codes"&&<AdminCodesTab/>}
            {adminTab==="partners"&&<AdminPartnersTab/>}
            {adminTab==="students"&&(
              <div>
                <div style={{...C.infoBanner,justifyContent:"space-between"}}>
                  <span>إجمالي المسجلين</span>
                  <strong style={{fontSize:"18px"}}>{students.length}</strong>
                </div>

                {/* إحصائية تثبيت التطبيق — تعتمد على حدث "appinstalled" المدعوم بأندرويد/كروم؛
                    آيفون/سفاري لا يرسل أي إشارة مكافئة (قيد من نظام آبل نفسه)، فالرقم هنا تقريبي ولصالح أندرويد فقط */}
                {(()=>{
                  const installedCount = students.filter(s=>s.appInstalled).length;
                  const now = Date.now();
                  const THIRTY_DAYS = 30*24*60*60*1000;
                  const getLastActivityMs = (s) => {
                    const ls = s.lastSeenAt?.toDate ? s.lastSeenAt.toDate().getTime() : null;
                    const cr = s.createdAt?.toDate ? s.createdAt.toDate().getTime() : null;
                    return ls || cr || 0;
                  };
                  const inactiveStudents = students.filter(s=>{
                    const t = getLastActivityMs(s);
                    return t>0 && (now-t)>THIRTY_DAYS;
                  }).sort((a,b)=>getLastActivityMs(a)-getLastActivityMs(b));
                  return <>
                    <div style={{...C.infoBanner,justifyContent:"space-between",marginTop:"8px"}}>
                      <span>📲 ثبّتوا التطبيق (أندرويد فقط)</span>
                      <strong style={{fontSize:"18px"}}>{installedCount} / {students.length}</strong>
                    </div>
                    <button onClick={()=>setShowInactive(v=>!v)} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(234,179,8,0.3)",backgroundColor:"rgba(234,179,8,0.08)",color:"#fbbf24",fontSize:"12.5px",fontWeight:"bold",cursor:"pointer",marginTop:"8px",marginBottom:"14px"}}>
                      🕓 {showInactive?"إخفاء":"عرض"} الحسابات الخاملة (لم تُفتح منذ 30+ يوم) — {inactiveStudents.length}
                    </button>
                    {showInactive&&(
                      <div style={{marginBottom:"14px"}}>
                        {inactiveStudents.length===0
                          ?<div style={{textAlign:"center",padding:"14px",color:"#52525b",fontSize:"12px"}}>لا توجد حسابات خاملة حالياً 🎉</div>
                          :inactiveStudents.map(s=>{
                            const t=getLastActivityMs(s);
                            const days=Math.floor((now-t)/(24*60*60*1000));
                            return <div key={s.phone} style={{...C.card,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",border:"1px solid rgba(234,179,8,0.15)"}}>
                              <div>
                                <div style={{fontWeight:"bold",fontSize:"13px"}}>{s.name}</div>
                                <div style={{fontSize:"11px",color:"#71717a"}}>{s.phone} • آخر ظهور منذ {days} يوم تقريباً</div>
                              </div>
                              <button onClick={async()=>{
                                if(window.confirm(`حذف حساب ${s.name} الخامل نهائياً؟ لا يمكن التراجع!`)){
                                  await deleteDoc(doc(db,"students",s.phone));
                                  showMsg("تم حذف الحساب الخامل 🗑");
                                }
                              }} style={{padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"11px",fontWeight:"bold",cursor:"pointer",flexShrink:0}}>🗑 حذف</button>
                            </div>;
                          })
                        }
                      </div>
                    )}
                  </>;
                })()}

                {/* نتيجة آخر إعادة تعيين كلمة مرور — تظهر مرة واحدة عشان المدير ينسخها ويرسلها للطالب يدوياً */}
                {resetPassResult&&(
                  <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.35)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                      <span style={{fontSize:"12px",color:"#fbbf24",fontWeight:"bold"}}>🔑 كلمة مرور جديدة لـ {resetPassResult.name}</span>
                      <button onClick={()=>setResetPassResult(null)} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer"}}><X size={16}/></button>
                    </div>
                    <div style={{fontSize:"22px",fontWeight:"900",letterSpacing:"3px",color:"#fff",fontFamily:"monospace",marginBottom:"10px"}}>{resetPassResult.newPass}</div>
                    <button onClick={()=>{try{navigator.clipboard?.writeText(resetPassResult.newPass);showMsg("تم النسخ");}catch{}}} style={{padding:"7px 16px",borderRadius:"8px",border:"none",backgroundColor:"#eab308",color:"#000",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}}><Copy size={13}/> نسخ</button>
                    <div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>أرسلها للطالب على رقمه ({resetPassResult.phone}) — كلمته القديمة لم تعد تعمل</div>
                  </div>
                )}

                {/* بحث */}
                <input
                  placeholder="ابحث باسم أو رقم هاتف أو حساب..."
                  style={{...C.input,marginBottom:"10px"}}
                  onChange={e=>{
                    const q=e.target.value.toLowerCase();
                    document.querySelectorAll("[data-student]").forEach(el=>{
                      el.style.display=el.dataset.student.includes(q)?"":"none";
                    });
                  }}
                />

                {students.length===0
                  ?<div style={{textAlign:"center",padding:"40px 20px"}}>
                    <Users size={64} color="#3b82f6" style={{opacity:0.4,margin:"0 auto 12px"}}/>
                    <span style={{fontSize:"15px",color:"#52525b"}}>لا يوجد مسجلون بعد</span>
                  </div>
                  :students.map((s,i)=>(
                    <div key={i} data-student={`${s.name} ${s.phone} ${s.account}`.toLowerCase()} style={{...C.card,border:`1px solid ${s.banned?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.06)"}`,marginBottom:"8px",background:s.banned?"rgba(239,68,68,0.05)":"#141417"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                        <div style={{width:42,height:42,borderRadius:"50%",background:s.accountType==="teacher"?"linear-gradient(135deg,#f97316,#fbbf24)":"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",flexShrink:0}}>
                          <User size={20} color="#fff"/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:"bold",fontSize:"14px",display:"flex",alignItems:"center",gap:"6px"}}>
                            {s.name}
                            <span style={{fontSize:"10px",padding:"2px 6px",borderRadius:"4px",background:s.accountType==="teacher"?"rgba(249,115,22,0.15)":"rgba(56,189,248,0.1)",color:s.accountType==="teacher"?"#fb923c":"#38bdf8"}}>
                              {s.accountType==="teacher"?"👨‍🏫 أستاذ":"👨‍🎓 طالب"}
                            </span>
                          </div>
                          <div style={{color:"#38bdf8",fontSize:"12px"}}>@{s.account}</div>
                          <div style={{color:"#71717a",fontSize:"12px"}}>{s.phone} • {s.stage}{s.grade?" • الصف "+s.grade:""}</div>
                        </div>
                        {s.banned
                          ?<span style={{fontSize:"11px",color:"#f87171",fontWeight:"bold"}}>🚫 محظور</span>
                          :<span style={{fontSize:"11px",color:"#4ade80",fontWeight:"bold"}}>✅ نشط</span>
                        }
                      </div>
                      <div style={{display:"flex",gap:"8px"}}>
                        <button onClick={async()=>{
                          if(window.confirm(`${s.banned?"رفع الحظر عن":"حظر"} ${s.name}؟`)){
                            await updateDoc(doc(db,"students",s.phone),{banned:!s.banned});
                            showMsg(s.banned?"تم رفع الحظر ✅":"تم الحظر 🚫");
                          }
                        }} style={{flex:1,padding:"7px",borderRadius:"8px",border:`1px solid ${s.banned?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,background:s.banned?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.08)",color:s.banned?"#4ade80":"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                          {s.banned?"✅ رفع الحظر":"🚫 حظر"}
                        </button>
                        <button onClick={()=>resetStudentPassword(s)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(234,179,8,0.35)",background:"rgba(234,179,8,0.1)",color:"#fbbf24",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                          🔑 إعادة تعيين كلمة المرور
                        </button>
                        <button onClick={async()=>{
                          if(window.confirm(`حذف حساب ${s.name} نهائياً؟ لا يمكن التراجع!`)){
                            await deleteDoc(doc(db,"students",s.phone));
                            showMsg("تم حذف الحساب نهائياً 🗑");
                          }
                        }} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                          🗑 حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
            {adminTab==="subscriptions"&&<AdminSubscriptionsTab/>}
            {adminTab==="prices"&&<AdminPricesTab/>}
            {adminTab==="audio"&&<AdminAudioTab/>}
            {adminTab==="notifications"&&(
              <div>
                <div style={C.infoBanner}><Bell size={15}/> اختر إرسال الإشعار لجميع الطلاب أو لطالب محدد فقط.</div>

                {/* اختيار نوع الإرسال */}
                <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
                  <button
                    onClick={()=>{setNotifTarget("all");setNotifStudent(null);setNotifSearch("");}}
                    style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:notifTarget==="all"?"#38bdf8":"#27272a",color:notifTarget==="all"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>
                    جميع الطلاب
                  </button>
                  <button
                    onClick={()=>setNotifTarget("single")}
                    style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:notifTarget==="single"?"#38bdf8":"#27272a",color:notifTarget==="single"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>
                    طالب محدد
                  </button>
                </div>

                {/* بحث واختيار طالب محدد */}
                {notifTarget==="single"&&(
                  <div style={{marginBottom:"14px"}}>
                    {notifStudent?(
                      <div style={{...C.card,border:"1px solid rgba(56,189,248,0.3)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:"bold",fontSize:"14px"}}>{notifStudent.name}</div>
                          <div style={{fontSize:"12px",color:"#71717a"}}>@{notifStudent.account} • {notifStudent.phone}</div>
                        </div>
                        <button onClick={()=>{setNotifStudent(null);setNotifSearch("");}} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"12px",fontWeight:"bold"}}>تغيير</button>
                      </div>
                    ):(
                      <>
                        <input
                          type="text"
                          value={notifSearch}
                          onChange={e=>setNotifSearch(e.target.value)}
                          placeholder="ابحث بالاسم أو رقم الموبايل..."
                          style={C.input}
                        />
                        <div style={{maxHeight:"220px",overflowY:"auto"}}>
                          {students
                            .filter(s=>!notifSearch.trim()||s.name?.includes(notifSearch)||s.phone?.includes(notifSearch)||s.account?.includes(notifSearch))
                            .map((s,i)=>(
                              <div key={i} onClick={()=>{setNotifStudent(s);setNotifSearch("");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"10px"}}>
                                <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",flexShrink:0}}>
                                  <User size={16} color="#fff"/>
                                </div>
                                <div>
                                  <div style={{fontWeight:"bold",fontSize:"13px"}}>{s.name}</div>
                                  <div style={{fontSize:"11px",color:"#71717a"}}>@{s.account} • {s.phone}</div>
                                </div>
                              </div>
                            ))}
                          {students.filter(s=>!notifSearch.trim()||s.name?.includes(notifSearch)||s.phone?.includes(notifSearch)||s.account?.includes(notifSearch)).length===0&&(
                            <div style={{textAlign:"center",padding:"16px",color:"#52525b",fontSize:"13px"}}>لا يوجد طالب مطابق</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px"}}>
                  {[["expire","انتهاء الاشتراك"],["new_video","مقطع جديد"],["remind","تذكير"],["offer","عرض خاص"]].map(([k,l])=><div key={k} onClick={()=>applyTemplate(k)} style={{...C.card,cursor:"pointer",textAlign:"center",padding:"12px",marginBottom:0}}>{l}</div>)}
                </div>
                <label style={C.label}>عنوان الإشعار</label><input type="text" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="العنوان" style={C.input}/>
                <label style={C.label}>نص الإشعار</label><textarea rows={3} value={notifBody} onChange={e=>setNotifBody(e.target.value)} style={{...C.input,resize:"none"}}/>
                <button disabled={sendingNotif||(notifTarget==="single"&&!notifStudent)} style={{...C.gradBtn,opacity:(sendingNotif||(notifTarget==="single"&&!notifStudent))?0.5:1}} onClick={sendNotif}>
                  {sendingNotif
                    ?<><Spinner size={16}/> جارٍ الإرسال...</>
                    :notifTarget==="single"
                      ?<><Bell size={16}/> إرسال إلى {notifStudent?notifStudent.name:"الطالب المحدد"}</>
                      :<><Bell size={16}/> إرسال لجميع الطلاب ({students.length})</>
                  }
                </button>
              </div>
            )}
            {adminTab==="settings"&&(
              <div>
                <div style={{backgroundColor:"#141417",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
                  <span style={{color:"#eab308",fontWeight:"bold",fontSize:"14px",display:"block",marginBottom:"12px"}}> بيانات المدير</span>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span dir="ltr" style={{fontWeight:"bold"}}>{auth.currentUser?.email||"—"}</span><span style={{color:"#a1a1aa"}}> البريد الإلكتروني</span></div>
                </div>
                <AdminChangePasswordCard/>
                {/* تشخيص مزودي الذكاء الاصطناعي الأربعة */}
                <AIDiagnosticsCard/>
                {/* تحكم النقاش */}
                <ChatToggleCard/>
                {/* حجم الخط */}
                <FontSizeCard/>
                <div style={{color:"#a855f7",fontWeight:"bold",fontSize:"14px",margin:"16px 0 8px"}}> إحصائيات</div>
                <div style={C.statsGrid}>
                  {[["🎬",clips.length,"المقاطع"],["👥",students.length,"الطلاب"],["▶",clips.filter(c=>c.videoUrl).length,"مع فيديو"],["💰","—","الأرباح"]].map(([icon,num,label])=>(
                    <div key={label} style={C.statCard}><span style={{fontSize:"22px"}}>{icon}</span><div style={{fontSize:"22px",fontWeight:"bold",color:"#a855f7",margin:"4px 0"}}>{num}</div><span style={{fontSize:"11px",color:"#71717a"}}>{label}</span></div>
                  ))}
                </div>
                <div style={{marginTop:"14px"}}><StatsChartCard/></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACCOUNT */}
      {screen==="account"&&(
        <div style={{padding:"40px 20px",textAlign:"center"}}>
          <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",margin:"0 auto 16px"}}>
            {role==="admin"?<GraduationCap size={40} color="#fff"/>:<User size={40} color="#fff"/>}
          </div>
          {role==="admin"?(
            <>
              <h3 style={{fontSize:"18px",fontWeight:"bold",color:"#eab308"}}>المدير</h3>
              <p dir="ltr" style={{color:"#71717a",fontSize:"13px",marginBottom:"20px"}}> {auth.currentUser?.email||""}</p>
              <div style={{backgroundColor:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"24px"}}>
                <span style={{color:"#eab308",fontSize:"13px"}}> صلاحيات المدير مفعّلة</span>
              </div>
            </>
          ):currentStudent?(
            <>
              <h3 style={{fontSize:"20px",fontWeight:"bold"}}>{currentStudent.name}</h3>
              <p dir="ltr" style={{color:"#38bdf8",fontSize:"13px",marginBottom:"4px"}}>@{currentStudent.account}</p>
              <p dir="ltr" style={{color:"#71717a",fontSize:"13px",marginBottom:"16px"}}> {currentStudent.phone}</p>

              {/* ─── بطاقة Streak ─── */}
              <div style={{
                width:"100%",
                background:streak.days>=7?"linear-gradient(135deg,rgba(251,146,60,0.2),rgba(239,68,68,0.15))":"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(56,189,248,0.1))",
                border:`1px solid ${streak.days>=7?"rgba(251,146,60,0.4)":"rgba(99,102,241,0.3)"}`,
                borderRadius:"20px",padding:"20px",marginBottom:"20px",
                position:"relative",overflow:"hidden",
              }}>
                {/* خلفية ديكورية */}
                <div style={{position:"absolute",top:"-20px",right:"-20px",fontSize:"80px",opacity:0.08,pointerEvents:"none"}}>🔥</div>

                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <div style={{
                      fontSize:"36px",
                      filter:streak.days>=7?"drop-shadow(0 0 8px rgba(251,146,60,0.8))":"drop-shadow(0 0 6px rgba(99,102,241,0.6))",
                    }}>
                      {streak.days===0?"💤":streak.days<3?"⚡":streak.days<7?"🔥":streak.days<30?"🌟":"👑"}
                    </div>
                    <div>
                      <div style={{
                        fontSize:"32px",fontWeight:"900",
                        background:streak.days>=7?"linear-gradient(135deg,#fb923c,#ef4444)":"linear-gradient(135deg,#818cf8,#38bdf8)",
                        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                        lineHeight:1,
                      }}>{streak.days}</div>
                      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",marginTop:"2px"}}>
                        {streak.days===1?"يوم متتالي":"يوم متتالٍ"}
                      </div>
                    </div>
                  </div>
                  {streak.maxDays>0&&<div style={{textAlign:"left"}}>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.35)"}}>أعلى سجل</div>
                    <div style={{fontSize:"18px",fontWeight:"bold",color:"#fbbf24"}}>🏆 {streak.maxDays}</div>
                  </div>}
                </div>

                {/* رسالة تحفيزية */}
                <div style={{
                  fontSize:"13px",fontWeight:"600",
                  color:streak.days>=7?"#fb923c":"rgba(255,255,255,0.75)",
                  padding:"8px 12px",
                  background:"rgba(0,0,0,0.2)",
                  borderRadius:"10px",
                  textAlign:"center",
                }}>
                  {streak.days===0&&"ابدأ رحلتك اليوم! أول خطوة هي الأصعب 💪"}
                  {streak.days===1&&"أحسنت! ابدأت رحلتك، واصل غداً 🚀"}
                  {streak.days===2&&"يومان متتاليان! أنت على المسار الصحيح ⚡"}
                  {streak.days===3&&"3 أيام! الاستمرارية هي سر النجاح 🔥"}
                  {streak.days>=4&&streak.days<7&&`${streak.days} أيام! لا تكسر السلسلة الآن 💎`}
                  {streak.days===7&&"أسبوع كامل! أنت مثال يُحتذى به 🌟"}
                  {streak.days>7&&streak.days<30&&`${streak.days} يوماً! أنت من أفضل الطلاب 🏆`}
                  {streak.days>=30&&`${streak.days} يوماً! أسطورة حقيقية 👑`}
                </div>

                {/* شريط الأيام */}
                <div style={{display:"flex",gap:"4px",marginTop:"12px",justifyContent:"center"}}>
                  {[1,2,3,4,5,6,7].map(d=>(
                    <div key={d} style={{
                      width:"32px",height:"32px",borderRadius:"8px",
                      background:d<=streak.days%7||streak.days>=7?"linear-gradient(135deg,#f97316,#ef4444)":"rgba(255,255,255,0.06)",
                      border:`1px solid ${d<=streak.days%7||streak.days>=7?"rgba(249,115,22,0.5)":"rgba(255,255,255,0.08)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:"14px",
                    }}>
                      {d<=streak.days%7||streak.days>=7?"🔥":""}
                    </div>
                  ))}
                </div>
                {streak.newRecord&&<div style={{textAlign:"center",marginTop:"8px",fontSize:"12px",color:"#fbbf24",fontWeight:"bold"}}>🎉 رقم قياسي جديد!</div>}
              </div>

              {/* ─── بطاقة المستوى ونقاط الخبرة + رفيق النمو ─── */}
              {(()=>{
                const level = Math.floor((xp||0)/100)+1;
                const xpIntoLevel = (xp||0)%100;
                const mascot = getMascot(level);
                return (
                  <div style={{
                    width:"100%",
                    background:"linear-gradient(135deg,rgba(168,85,247,0.15),rgba(56,189,248,0.1))",
                    border:"1px solid rgba(168,85,247,0.3)",
                    borderRadius:"20px",padding:"20px",marginBottom:"20px",
                    position:"relative",overflow:"hidden",
                  }}>
                    <div style={{position:"absolute",top:"-16px",left:"-16px",fontSize:"70px",opacity:0.08,pointerEvents:"none"}}>{mascot.emoji}</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                        <div style={{fontSize:"36px",filter:"drop-shadow(0 0 6px rgba(168,85,247,0.6))"}}>{mascot.emoji}</div>
                        <div>
                          <div style={{
                            fontSize:"24px",fontWeight:"900",
                            background:"linear-gradient(135deg,#a855f7,#38bdf8)",
                            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,
                          }}>المستوى {level}</div>
                          <div style={{fontSize:"11px",color:"rgba(255,255,255,0.5)",marginTop:"2px"}}>{mascot.label} • {xp||0} نقطة خبرة</div>
                        </div>
                      </div>
                    </div>
                    <div style={{width:"100%",height:"10px",background:"rgba(255,255,255,0.08)",borderRadius:"6px",overflow:"hidden"}}>
                      <div style={{width:xpIntoLevel+"%",height:"100%",background:"linear-gradient(90deg,#a855f7,#38bdf8)",borderRadius:"6px",transition:"width 0.4s"}}/>
                    </div>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",marginTop:"6px",textAlign:"center"}}>{100-xpIntoLevel} نقطة للمستوى التالي</div>
                  </div>
                );
              })()}
              {Object.keys(mySubscriptions).length>0&&(
                <div style={{textAlign:"right",marginBottom:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}> اشتراكاتي:</div>
                  {Object.entries(mySubscriptions).map(([key,sub])=>{
                    const parts=key.split("__");
                    const d=daysLeft(mySubscriptions,parts[0],parts[1],parts[2]);
                    // حساب نسبة التقدم
                    const subClips=clips.filter(c=>c.subject===sub.subject&&c.stage===sub.stage);
                    const lastIdx=studentProgress[key];
                    const progress=subClips.length>0&&lastIdx!==undefined?Math.round(((lastIdx+1)/subClips.length)*100):0;
                    return <div key={key} style={{...C.card,border:"1px solid rgba(56,189,248,0.15)",marginBottom:"8px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                        <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{sub.subject}</div><div style={{fontSize:"11px",color:"#71717a"}}>{sub.stage}{sub.grade?" — الصف "+sub.grade:""}</div></div>
                        <div style={{textAlign:"left"}}>
                          <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
                          <div style={{fontSize:"10px",color:"#52525b"}}>ينتهي {new Date(sub.expiresAt).toLocaleDateString("ar")}</div>
                        </div>
                      </div>
                      {/* شريط التقدم */}
                      {subClips.length>0&&<>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                          <span style={{fontSize:"11px",color:"#71717a"}}>
                            {lastIdx!==undefined?`مقطع ${lastIdx+1} من ${subClips.length}`:"لم تبدأ بعد"}
                          </span>
                          <span style={{fontSize:"11px",fontWeight:"bold",color:progress===100?"#4ade80":"#38bdf8"}}>{progress}%</span>
                        </div>
                        <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden"}}>
                          <div style={{height:"100%",width:progress+"%",background:progress===100?"linear-gradient(to left,#4ade80,#22c55e)":"linear-gradient(to left,#6366f1,#38bdf8)",borderRadius:"3px",transition:"width 0.4s ease"}}/>
                        </div>
                      </>}
                    </div>;
                  })}
                </div>
              )}
              <button style={{...C.primaryBtn,marginBottom:"10px",background:"linear-gradient(to right,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} onClick={()=>openExam()}><ClipboardList size={16}/> امتحانات الفصول</button>
              <button style={{...C.primaryBtn,marginBottom:"10px"}} onClick={()=>setModal("wallet")}> اشترك أو جدد اشتراك</button>
              <a href="https://t.me/edutok_sub_bot" target="_blank" rel="noreferrer" style={{...C.secondaryBtn,marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",textDecoration:"none",borderColor:"rgba(56,189,248,0.4)",color:"#7dd3fc"}}>📱 اشترك عبر بوت تيليجرام</a>
              <button style={{...C.secondaryBtn,marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} onClick={()=>setModal("code")}><Key size={16}/> لدي كود تفعيل</button>
              <button style={{...C.secondaryBtn,marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",borderColor:"rgba(168,85,247,0.4)",color:"#c4b5fd"}} onClick={()=>setModal("partnercode")}><Users size={16}/> كود شراكة</button>
            </>
          ):null}
          <button style={C.redBtn} onClick={()=>{if(role==="admin") signOut(auth).catch(()=>{});setRole("guest");setCurrentStudent(null);clearSession();setScreen("welcome");}}>تسجيل الخروج</button>
        </div>
      )}

      {/* BOTTOM NAV */}
      {showNav&&screen!=="home"&&(
        <div style={C.bottomNav}>
          {role==="admin"&&<button style={C.navItem(screen==="admin")} onClick={()=>setScreen("admin")}><Settings size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>إدارة</span></button>}
          <button style={C.navItem(screen==="account")} onClick={()=>setScreen("account")}><User size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>حسابي</span></button>
          <button style={C.navItem(screen==="home")} onClick={()=>setScreen("home")}><Home size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>الرئيسية</span></button>
        </div>
      )}

      {/* MODALS */}
      {modal==="ai"     &&<AIModal      onClose={closeModal} video={video} currentSlide={video.slides?.[currentSlideIdx]} audioTracks={audioTracks} currentTrack={currentTrack} setCurrentTrack={setCurrentTrack} audioPlaying={audioPlaying} setAudioPlaying={setAudioPlaying} audioVolume={audioVolume} setAudioVolume={setAudioVolume} onOpenOnboarding={()=>setModal("onboarding")}/>}
      {modal==="share"  &&<ShareModal   onClose={closeModal} video={video}/>}
      {modal==="chat"   &&<ChatModal    onClose={closeModal} currentStudent={currentStudent} role={role} subject={video?.subject}/>}
      {/* ✅ التعديل: إضافة onWallet لفتح نافذة زين كاش من داخل نافذة PDF */}
      {modal==="pdf"    &&<PDFModal     onClose={closeModal} studentStage={currentStudent?.stage} studentGrade={currentStudent?.grade} globalPrices={globalPrices} mySubscriptions={mySubscriptions} isAdmin={role==="admin"} onWallet={()=>setModal("wallet")}/>}
      {modal==="solve"  &&<SolveModal   onClose={closeModal} video={video}/>}
      {modal==="browsesearch" &&<BrowseSearchModal onClose={closeModal} clips={clips} globalPrices={globalPrices} role={role} examScores={examScores} allVideos={allVideos} onSelectVideo={(idx)=>{setVideoIdx(idx);setCurrentSlideIdx(0);setModal(null);setScreen("home");}} onBrowse={(subject,stage,grade,topic,isFree)=>{
        setSelectedSubject({subject,stage,grade,topic,isFree});
        setVideoIdx(0);
        setCurrentSlideIdx(0);
        setScreen("home");
      }}/>}
      {modal==="uploadpdf"&&<UploadPDFModal onClose={closeModal} currentStudent={currentStudent}/>}
      {modal==="saved"  &&<SavedModal   onClose={closeModal} saved={saved} video={video}/>}
      {modal==="notifications" &&<NotificationsModal onClose={closeModal} notifications={myNotifications}/>}
      {modal==="description" &&<VideoDescriptionModal onClose={closeModal} video={video} role={role} mySubscriptions={mySubscriptions} globalPrices={globalPrices} onOpenWallet={()=>setModal("wallet")} onOpenCode={()=>setModal("code")} onSelectSubject={(subject,stage)=>{setSelectedSubject({subject,stage});const key=subKey(subject,stage);setVideoIdx(studentProgress[key]||0);setCurrentSlideIdx(0);}} videoIdx={videoIdx} totalVideos={allVideos.length} clips={clips} watchedClipIds={watchedClipIds} examScores={examScores} progressUpdatedAt={progressUpdatedAt} allVideos={allVideos} studentProgress={studentProgress} onJumpToVideo={(idx)=>{setVideoIdx(idx);setCurrentSlideIdx(0);}}/>}
      {modal==="wallet" &&<WalletModal  onClose={closeModal} student={currentStudent} subscriptions={mySubscriptions}/>}
      {modal==="code"   &&<CodeModal    onClose={closeModal} student={currentStudent} mySubscriptions={mySubscriptions}/>}
      {modal==="partnercode" &&<PartnerCodeModal onClose={closeModal} student={currentStudent} onRedirectToCode={()=>setModal("code")}/>}
      {role==="student"&&screen==="home"&&showOnboarding&&<OnboardingModal onClose={()=>setShowOnboarding(false)}/>}
      {modal==="onboarding"&&<OnboardingModal onClose={closeModal}/>}
      {newCertificate   &&<CertificateModal onClose={()=>setNewCertificate(null)} student={currentStudent} cert={newCertificate} onStartExam={(subject,stage,topic)=>{setNewCertificate(null);openExam(subject,stage,topic);}}/>}
      {modal==="exam"   &&<ExamModal onClose={()=>{closeModal();setExamInitial(null);}} initial={examInitial} currentStudent={currentStudent} mySubscriptions={mySubscriptions} globalPrices={globalPrices} clips={clips} examScores={examScores} onResult={saveExamResult}/>}
      {showAdminLogin   &&<AdminLoginModal onClose={()=>setShowAdminLogin(false)} onSuccess={()=>{setRole("admin");setScreen("admin");saveSession({name:"المدير",email:auth.currentUser?.email||""},"admin");setShowAdminLogin(false);}}/> }
      <Toast/>
    </div>
  );
}
