// ─── App.jsx ──────────────────────────────────────────────
// المكوّن الرئيسي (Orchestrator) للتطبيق كامل. بقي مكوّناً واحداً متماسكاً
// عمداً (بدل تقسيمه لعدة "أنصاف مكونات") لأن حالته (عشرات useState) مترابطة
// بعمق بين كل الشاشات — أي تقسيم إضافي كان سيتطلب تمرير عشرات الخصائص
// (Props Drilling) بمخاطرة أعلى بكثير من الفائدة. بدلاً من ذلك، كل الأجزاء
// القابلة للعزل الحقيقي (نوافذ، مكونات إدارة، أدوات مساعدة) استُخرجت فعلياً
// لملفات مستقلة (راجع src/), وهذا الملف الآن يستوردها بدل تعريفها محلياً —
// فانخفض حجمه من ~6964 سطر (الملف الأصلي بالكامل) إلى ~1750 سطر فقط.
import React, { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc,
  setDoc, getDoc, doc, query, where, increment
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  Bell, BookOpen, Bot, Camera, ClipboardList, Copy, FileText, Film,
  GraduationCap, Home, Key, MessageCircle, MoreHorizontal, Plus, Save,
  Search, Settings, User, Users, X
} from "lucide-react";

import { db, auth, storage, sendNotification, registerPushToken, syncInstallAndLastSeen } from "./firebase";
import { LOGO, SUBJECTS, STAGES, GRADES, ADMIN_TABS } from "./constants";
import {
  subKey, subAccessKey, topicKey, looksLikePageTitle, MAX_SKIPPED_CLIPS,
  isSubscribed, daysLeft, isFreeSubject, hasAccess, generateRandomCode,
  saveSession, loadSession, clearSession, hashPassword, getYoutubeId,
} from "./helpers";
import { callAI } from "./ai";
import { stopSpeaking, getArabicVoice, speakText, playLevelUpSound, getMascot } from "./audioUtils";
import { C } from "./styles";
import { showMsg, Toast } from "./toast";

import { Spinner, ErrBox, ImageUploader } from "./components/Shared";
import { VideoPlayer } from "./components/VideoPlayer";

import { AIModal } from "./modals/AIModal";
import { ChatModal } from "./modals/ChatModal";
import { PDFModal } from "./modals/PDFModal";
import { SolveModal } from "./modals/SolveModal";
import { BrowseSearchModal, NotificationsModal } from "./modals/BrowseSearchModal";
import { VideoDescriptionModal } from "./modals/VideoDescriptionModal";
import { SubscriptionDetailsModal } from "./modals/SubscriptionDetailsModal";
import { AdminLoginModal, ForgotPasswordModal } from "./modals/AuthModals";
import { WalletModal, CodeModal, PartnerCodeModal } from "./modals/SubscriptionModals";
import { OnboardingModal, CertificateModal } from "./modals/OnboardingCertModals";
import { ExamModal } from "./modals/ExamModal";

import { SlidesStudio } from "./admin/SlidesStudio";
import { TeacherPDFRequests, UploadPDFModal } from "./admin/TeacherPDF";
import { AdminPDFTab } from "./admin/AdminPDFTab";
import { AdminWalletTab } from "./admin/AdminWalletTab";
import { AdminCodesTab } from "./admin/AdminCodesTab";
import { AdminPartnersTab } from "./admin/AdminPartnersTab";
import { ContentEditor } from "./admin/ContentEditor";
import { AdminChangePasswordCard, AIDiagnosticsCard, ChatToggleCard, FontSizeCard } from "./admin/AdminSettingsCards";
import { StatsChartCard } from "./admin/StatsChart";
import { AdminSubscriptionsTab } from "./admin/AdminSubscriptionsTab";
import { AdminAudioTab } from "./admin/AdminAudioTab";
import { AdminPricesTab } from "./admin/AdminPricesTab";
import { AdminExamsTab } from "./admin/AdminExamsTab";

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
  const [pwResetRequests,setPwResetRequests]=useState([]); // طلبات "نسيت كلمة المرور" المعلّقة من الطلاب
  const [showInactive,setShowInactive]=useState(false); // إظهار/إخفاء قائمة الحسابات الخاملة بتبويب الطلاب
  // ✅ تحسين أداء: كانت قائمة الطلاب بالإدارة تُعرض كاملة دفعة واحدة مهما كان
  // عددهم (كل الأسماء تظهر فجأة سوية)، وهذا يسبب بطء وإرباك بصري مع كثرة
  // الطلاب. الآن نعرض 20 فقط في البداية، مع زر "تحميل المزيد" يضيف 20 إضافية
  // في كل ضغطة، وإذا كان الطالب يبحث نعرض كل النتائج المطابقة بلا حد (البحث
  // له الأولوية على التقسيم، حتى لا يفوّت المدير أي نتيجة).
  const [studentsRenderLimit,setStudentsRenderLimit]=useState(20);
  const [studentSearchQuery,setStudentSearchQuery]=useState("");
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
  const [showMore,setShowMore]=useState(false);
  const [modal,setModal]=useState(null);
  const [selectedSubject,setSelectedSubject]=useState(null); // {subject, stage} للتصفح بالتسلسل
  const [examInitial,setExamInitial]=useState(null); // {subject,stage,topic} — يُمرَّر لفتح امتحان فصل محدد مباشرة
  // يفتح نافذة الامتحان: بفصل محدد (من الشهادة أو زر السحب السريع)، أو بلا فصل محدد (يختار الطالب بنفسه)
  const openExam = (subject,stage,topic) => { setExamInitial(subject&&stage&&topic?{subject,stage,topic}:null); setModal("exam"); };
  const [tapCount,setTapCount]=useState(0); const [showAdminLogin,setShowAdminLogin]=useState(false);
  const [showForgotPassword,setShowForgotPassword]=useState(false);
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
    const u4=onSnapshot(
      query(collection(db,"passwordResetRequests"),where("status","==","pending")),
      snap=>{
        const list=snap.docs.map(d=>({id:d.id,...d.data()}));
        list.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)); // الأقدم أولاً
        setPwResetRequests(list);
      }
    );
    return ()=>{u1();u2();u3();u4();};
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
  const resetStudentPassword = async(s,requestId)=>{
    if(!window.confirm(`إعادة تعيين كلمة مرور ${s.name}؟ سيتم توليد كلمة مرور جديدة عشوائية وإلغاء القديمة.`)) return;
    const newPass = generateRandomCode(8);
    try{
      const {hash,salt} = await hashPassword(newPass);
      // بيانات الدخول محفوظة بمستند فرعي مغلق منفصل (students/{phone}/private/auth) — راجع قواعد Firestore
      await setDoc(doc(db,"students",s.phone,"private","auth"),{passHash:hash,passSalt:salt});
      // لو الإجراء جاء من طلب "نسيت كلمة المرور" معلّق، نغلقه حتى يختفي من قائمة الانتظار
      if(requestId){
        try{ await updateDoc(doc(db,"passwordResetRequests",requestId),{status:"resolved",resolvedAt:serverTimestamp()}); }catch{}
      }
      setResetPassResult({phone:s.phone,name:s.name,newPass});
      showMsg("✅ تم تعيين كلمة مرور جديدة — أرسلها للطالب يدوياً");
    }catch(e){ showMsg("فشل: "+e.message); }
  };

  // لو الطلب مش فعلاً لطالب حقيقي (أو الإدارة قررت عدم التعامل معه)، يمكن تجاهله
  // بدل تركه معلّقاً للأبد بقائمة الانتظار
  const dismissPwResetRequest = async(reqId)=>{
    try{ await updateDoc(doc(db,"passwordResetRequests",reqId),{status:"dismissed",resolvedAt:serverTimestamp()}); }
    catch(e){ showMsg("فشل: "+e.message); }
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

  // ✅ إصلاح: زر الرجوع بالموبايل (سواء الزر الفعلي أو إيماءة الرجوع) كان
  // يخرج من التطبيق مباشرة بدل ما يرجع خطوة وحدة للخلف — لأن أي نافذة مفتوحة
  // (مثل "نقاش"، "المحفظة"، "تفاصيل الاشتراك"، إلخ) أو حتى شاشة "حسابي"/"إدارة"
  // ما كانت تُسجَّل بتاريخ المتصفح (history)، فزر رجوع النظام يعتبر إنه ما فيه
  // شيء يرجع له داخل التطبيق ويطلع منه مباشرة. الحل: نسجّل خطوة بالتاريخ كل ما
  // تُفتح نافذة/قائمة/شاشة غير الرئيسية، ونعترض ضغطة الرجوع (popstate) لنغلق
  // أقرب طبقة مفتوحة بدل الخروج الكامل من التطبيق.
  const anyLayerOpenRef = useRef(false);
  useEffect(()=>{
    const layerOpen = !!modal || showMore || (screen!=="home" && screen!=="welcome" && screen!=="login");
    if(layerOpen && !anyLayerOpenRef.current){
      window.history.pushState({appLayer:true},"");
    }
    anyLayerOpenRef.current = layerOpen;
  },[modal, showMore, screen]);

  useEffect(()=>{
    const onPopState = () => {
      if(modal){ setModal(null); return; }
      if(showMore){ setShowMore(false); return; }
      if(screen!=="home" && screen!=="welcome" && screen!=="login"){ setScreen("home"); return; }
      // ما فيه أي طبقة مفتوحة داخل التطبيق — نسمح بالسلوك الافتراضي (الخروج)
    };
    window.addEventListener("popstate", onPopState);
    return ()=>window.removeEventListener("popstate", onPopState);
  },[modal, showMore, screen]);

  // إعادة ضبط تتبّع المشاهدة كل ما تغيّر المقطع الحالي
  useEffect(()=>{
    clipEnterTimeRef.current = Date.now();
    clipMaxSlideRef.current = 0;
  },[videoIdx]);
  // تحديث أقصى شريحة فرعية وصلها الطالب داخل نفس المقطع
  useEffect(()=>{
    if(currentSlideIdx>clipMaxSlideRef.current) clipMaxSlideRef.current=currentSlideIdx;
  },[currentSlideIdx]);

  // حفظ تقدم الطالب عند مشاهدة مقطع من مادة مشترك بها أو مجانية + تتبع المقاطع المشاهدة لأجل الشهادات
  // ✅ إصلاح: كان الشرط يستخدم isSubscribed (يتطلب اشتراكاً مدفوعاً فعلياً)، فكان تقدّم
  // الطلاب بالمواد المجانية لا يُسجَّل أبداً (يبقى 0/39 للأبد ويظل امتحان الفصل مقفولاً
  // بشكل دائم مهما شاهد الطالب). الآن نستخدم hasAccess التي تشمل المواد المجانية أيضاً.
  const saveProgress = (idx) => {
    const v = allVideos[idx];
    if(!v||!currentStudent?.phone||role!=="student") return;
    if(!hasAccess(mySubscriptions,globalPrices,v.subject,v.stage,v.grade)) return;
    const key = subKey(v.subject,v.stage);
    const newProgress = {...studentProgress,[key]:idx};
    setStudentProgress(newProgress);
    setDoc(doc(db,"progress",currentStudent.phone),{progress:newProgress,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});
  };

  // يُستدعى على المقطع "المُغادَر" فقط (مو المقطع الجديد)، ويتحقق فعلياً إنه شوهد بشكل حقيقي:
  // (1) بقي عليه مدة كافية، و(2) شاف كل الشرائح الفرعية بداخله (لو كان مقطع "شرائح AI" متعدد الشرائح)
  // ✅ إصلاح: نفس المشكلة أعلاه — استخدام hasAccess بدل isSubscribed حتى تُحتسب مشاهدات
  // المواد المجانية أيضاً، وتُفتح امتحانات فصولها بشكل طبيعي.
  const markClipWatched = (v) => {
    if(!v||!currentStudent?.phone||role!=="student") return;
    if(!hasAccess(mySubscriptions,globalPrices,v.subject,v.stage,v.grade)) return;

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
          <div style={{textAlign:"center",marginTop:"4px"}}><span style={{color:"#38bdf8",cursor:"pointer",fontSize:"12.5px"}} onClick={()=>setShowForgotPassword(true)}>نسيت كلمة المرور؟</span></div>
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

          {/* قائمة "المزيد" — "تفاصيل الاشتراك" هنا أصبحت الآن شاشة مستقلة تماماً
              عن تقدّم أي مقطع (اشتراكاتي + المحفظة + الكود + بوت تيليجرام)،
              فتظهر دائماً بلا أي شرط، ولا تكرار وظيفي مع زر "تقدّمي" بالشريط
              الجانبي (ذاك مختص فقط بتقدّم الفصل الحالي) */}
          {showMore&&<div style={C.moreMenu}>
            {[[<Camera size={22} color="#fff"/>,"حل ذكي","solve"],[<FileText size={22} color="#fff"/>,"تفاصيل الاشتراك","subscriptiondetails"]].map(([icon,label,key])=>(
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
                          {/* ✅ إصلاح: كانت المعاينة تعرض من clip.thumbUrl (حقل "الصورة المصغرة" اللي
                              حذفنا رفعها من النموذج)، فمقاطع قديمة عندها thumbUrl محفوظ من زمان تضل تظهر
                              بهذه القائمة حتى بعد حذف "صورة صفحة الكتاب" لأن الحذف ما يمسّ thumbUrl إطلاقاً.
                              الآن نعرض من pageImage — وهو المصدر الوحيد المتبقي والمتزامن فعلياً مع زر
                              الحذف وزر 📖 بالشاشة الرئيسية. */}
                          {clip.pageImage?<img src={clip.pageImage} alt="" style={{width:44,height:44,borderRadius:"8px",objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:"8px",background:clip.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center"}}><Film size={20} color="#fff"/></div>}
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

                {/* طلبات "نسيت كلمة المرور" المعلّقة — كل طلب يُربط تلقائياً بحساب الطالب
                    الحقيقي (بحث برقم الموبايل)، وزر واحد يستدعي نفس أداة إعادة التعيين
                    الموجودة أصلاً بهذه الشاشة، ثم يُغلق الطلب تلقائياً بعد النجاح */}
                {pwResetRequests.length>0&&(
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}>🔔 طلبات استعادة كلمة المرور ({pwResetRequests.length})</div>
                    {pwResetRequests.map(r=>{
                      const matchedStudent = students.find(s=>s.phone===r.phone);
                      return (
                        <div key={r.id} style={{...C.card,border:"1px solid rgba(56,189,248,0.3)",marginBottom:"8px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                            <div>
                              <div style={{fontWeight:"bold",fontSize:"13px"}}>{r.studentName||matchedStudent?.name||"—"}</div>
                              <div dir="ltr" style={{fontSize:"11px",color:"#71717a",textAlign:"left"}}>{r.phone}</div>
                            </div>
                            {!matchedStudent&&<span style={{fontSize:"10px",color:"#f87171",fontWeight:"bold"}}>⚠️ الحساب غير موجود حالياً</span>}
                          </div>
                          <div style={{display:"flex",gap:"8px"}}>
                            <button
                              disabled={!matchedStudent}
                              onClick={()=>resetStudentPassword(matchedStudent,r.id)}
                              style={{flex:2,padding:"8px",borderRadius:"8px",border:"1px solid rgba(234,179,8,0.35)",background:matchedStudent?"rgba(234,179,8,0.1)":"rgba(255,255,255,0.03)",color:matchedStudent?"#fbbf24":"#52525b",fontSize:"12px",fontWeight:"bold",cursor:matchedStudent?"pointer":"not-allowed"}}>
                              🔑 إعادة تعيين الآن
                            </button>
                            <button onClick={()=>dismissPwResetRequest(r.id)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:"#71717a",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                              تجاهل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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

                {/* بحث — البحث له الأولوية المطلقة على التقسيم: أي نص مكتوب هنا
                    يعرض كل النتائج المطابقة فوراً بلا حد أقصى */}
                <input
                  placeholder="ابحث باسم أو رقم هاتف أو حساب..."
                  style={{...C.input,marginBottom:"10px"}}
                  value={studentSearchQuery}
                  onChange={e=>setStudentSearchQuery(e.target.value)}
                />

                {(()=>{
                  const q = studentSearchQuery.trim().toLowerCase();
                  const isSearching = q.length>0;
                  const matched = isSearching
                    ? students.filter(s=>`${s.name} ${s.phone} ${s.account}`.toLowerCase().includes(q))
                    : students;
                  const visible = isSearching ? matched : matched.slice(0,studentsRenderLimit);
                  const hasMore = !isSearching && matched.length>visible.length;

                  if(students.length===0) return (
                    <div style={{textAlign:"center",padding:"40px 20px"}}>
                      <Users size={64} color="#3b82f6" style={{opacity:0.4,margin:"0 auto 12px"}}/>
                      <span style={{fontSize:"15px",color:"#52525b"}}>لا يوجد مسجلون بعد</span>
                    </div>
                  );

                  if(isSearching && matched.length===0) return (
                    <div style={{textAlign:"center",padding:"24px",color:"#52525b",fontSize:"13px"}}>لا نتائج مطابقة لـ«{studentSearchQuery}»</div>
                  );

                  return <>
                    {visible.map((s,i)=>(
                    <div key={i} style={{...C.card,border:`1px solid ${s.banned?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.06)"}`,marginBottom:"8px",background:s.banned?"rgba(239,68,68,0.05)":"#141417"}}>
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
                  ))}
                    {hasMore&&(
                      <button onClick={()=>setStudentsRenderLimit(l=>l+20)} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"1px dashed rgba(56,189,248,0.35)",backgroundColor:"rgba(56,189,248,0.06)",color:"#38bdf8",fontSize:"13px",fontWeight:"bold",cursor:"pointer",marginTop:"4px"}}>
                        تحميل 20 طالب إضافي ({matched.length-visible.length} متبقي)
                      </button>
                    )}
                  </>;
                })()}
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
      {modal==="notifications" &&<NotificationsModal onClose={closeModal} notifications={myNotifications}/>}
      {modal==="description" &&<VideoDescriptionModal onClose={closeModal} video={video} role={role} videoIdx={videoIdx} totalVideos={allVideos.length} clips={clips} watchedClipIds={watchedClipIds} examScores={examScores} allVideos={allVideos} onJumpToVideo={(idx)=>{setVideoIdx(idx);setCurrentSlideIdx(0);}}/>}
      {modal==="subscriptiondetails" &&<SubscriptionDetailsModal onClose={closeModal} mySubscriptions={mySubscriptions} globalPrices={globalPrices} student={currentStudent} clips={clips} studentProgress={studentProgress} progressUpdatedAt={progressUpdatedAt} onOpenWallet={()=>setModal("wallet")} onOpenCode={()=>setModal("code")} onOpenPartnerCode={()=>setModal("partnercode")} onSelectSubject={(subject,stage)=>{setSelectedSubject({subject,stage});const key=subKey(subject,stage);setVideoIdx(studentProgress[key]||0);setCurrentSlideIdx(0);}}/>}
      {modal==="wallet" &&<WalletModal  onClose={closeModal} student={currentStudent} subscriptions={mySubscriptions}/>}
      {modal==="code"   &&<CodeModal    onClose={closeModal} student={currentStudent} mySubscriptions={mySubscriptions} onRedirectToPartnerCode={()=>setModal("partnercode")}/>}
      {modal==="partnercode" &&<PartnerCodeModal onClose={closeModal} student={currentStudent} onRedirectToCode={()=>setModal("code")}/>}
      {role==="student"&&screen==="home"&&showOnboarding&&<OnboardingModal onClose={()=>setShowOnboarding(false)}/>}
      {modal==="onboarding"&&<OnboardingModal onClose={closeModal}/>}
      {newCertificate   &&<CertificateModal onClose={()=>setNewCertificate(null)} student={currentStudent} cert={newCertificate} onStartExam={(subject,stage,topic)=>{setNewCertificate(null);openExam(subject,stage,topic);}}/>}
      {modal==="exam"   &&<ExamModal onClose={()=>{closeModal();setExamInitial(null);}} initial={examInitial} currentStudent={currentStudent} mySubscriptions={mySubscriptions} globalPrices={globalPrices} clips={clips} examScores={examScores} onResult={saveExamResult}/>}
      {showAdminLogin   &&<AdminLoginModal onClose={()=>setShowAdminLogin(false)} onSuccess={()=>{setRole("admin");setScreen("admin");saveSession({name:"المدير",email:auth.currentUser?.email||""},"admin");setShowAdminLogin(false);}}/> }
      {showForgotPassword &&<ForgotPasswordModal onClose={()=>setShowForgotPassword(false)}/>}
      <Toast/>
    </div>
  );
}
