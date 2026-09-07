// ─── constants.js ───────────────────────────────────────
// ثوابت التطبيق العامة: المواد، المراحل، الصفوف، الثيمات، خطوات الشرح
// التعريفي، وتبويبات لوحة الإدارة. لا يوجد أي منطق هنا، فقط بيانات ثابتة.
import { Share2, Bot, MessageCircle, MoreHorizontal, FileText, Camera, Search, Settings, User, Home, Bell, DollarSign, Users, Layers, Film, Sparkles, X, Save, BookOpen, GraduationCap, Plus, Play, Pause, Loader, Key, Copy, CheckCircle, Trash2, ClipboardList, Lock, Wand2, Pencil, Volume2, Square } from "lucide-react";

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

export { ZAINCASH_NUM, LOGO, SUBJECTS, STAGES, GRADES, CLIP_TYPES, PRICE_SUBJECTS, THEMES, THEME_STYLES, DURATIONS, ONBOARDING_STEPS, ADMIN_TABS, SAMPLE_VIDEOS };
