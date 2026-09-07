// ─── helpers.js ─────────────────────────────────────────
// دوال مساعدة عامة: مفاتيح الاشتراك، التحقق من الصلاحية، نظام الأكواد،
// حفظ/تحميل الجلسة، تشفير كلمة المرور، ومساعد يوتيوب. لا تعتمد على أي
// حالة React، فقط دوال نقية (pure) أو تتعامل مع localStorage/crypto.

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

export {
  subKey, subAccessKey, topicKey, looksLikePageTitle, MAX_SKIPPED_CLIPS,
  isSubscribed, daysLeft, isFreeSubject, hasAccess,
  CODE_VALIDITY_DAYS, CODE_CHARS, generateRandomCode, computeExtendedExpiry,
  defaultCampaignExpiry,
  saveSession, loadSession, clearSession,
  bufferToHex, randomSalt, sha256Hex, hashPassword, verifyPassword,
  getYoutubeId,
};
