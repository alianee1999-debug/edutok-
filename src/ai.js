// ─── ai.js ──────────────────────────────────────────────
// استدعاءات مزودي الذكاء الاصطناعي (Gemini, Groq, OpenRouter, NVIDIA) عبر
// نقطة نهاية موحّدة بالسيرفر (/api/ai) — المفاتيح غير مكشوفة بالمتصفح إطلاقاً.
// + رفع الصور عبر ImgBB (أيضاً عبر السيرفر /api/imgbb).

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
    res = await fetchWithTimeout("/api/ai", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ provider:"groq", prompt, imageBase64, imageMime })
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
    res = await fetchWithTimeout("/api/ai", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ provider:"gemini", prompt, imageBase64, imageMime })
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
// api/ai.js — قسم OpenRouter)
const callOpenRouter = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/ai", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ provider:"openrouter", prompt, imageBase64, imageMime })
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
// (راجع api/ai.js — قسم NVIDIA)
const callNvidia = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  let res;
  try{
    res = await fetchWithTimeout("/api/ai", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ provider:"nvidia", prompt, imageBase64, imageMime })
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
  // المؤهّلون يختلفون حسب نوع السؤال: كل المزودين الأربعة للنص، لكن فقط
  // من يدعم الرؤية (Gemini, Groq) لو مرفق صورة — هذا التمييز وحده يبقى كما هو
  const eligible = imageBase64 ? AI_PROVIDERS.filter(p=>p.supportsImage) : AI_PROVIDERS;
  const order = shuffleProviders(eligible);

  // ── نفس الأسلوب التتابعي لكل من النص والصورة (مزود واحد بالمرة) ────────
  // لكل سؤال نصي أيضاً — لا نطلق الأربعة مزودين بالتوازي بنفس اللحظة، لأن ذلك
  // كان يستهلك حصة الاستخدام اليومية المجانية من الأربعة معاً على كل سؤال
  // واحد فقط (حتى لو استُخدم رد واحد منهم)، فتنفد الحصص المجانية أسرع بكثير
  // من اللازم. الآن كل سؤال يستهلك من مزود واحد فقط (اللي نجح)، وننتقل تلقائياً
  // للمزود التالي بالترتيب فقط عند فشل أو تأخر المزود الحالي أكثر من اللازم.
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

export {
  fetchWithTimeout,
  callGroq, callGemini, callOpenRouter, callNvidia,
  AI_PROVIDERS, isQuotaOrOverloadError, shuffleProviders, callAI,
  fileToBase64, uploadToImgBB,
};
