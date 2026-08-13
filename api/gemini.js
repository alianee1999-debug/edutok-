// api/gemini.js
// دالة سيرفر (Vercel Serverless Function) تتصل فعلياً بـ Google Gemini API.
// تطابق تماماً نفس شكل الطلب/الرد المستخدم مع /api/groq، عشان الواجهة الأمامية
// تقدر تستخدمها كبديل مباشر بدون أي تعديل بمنطقها.
//
// الطلب المتوقع (POST، JSON):
//   { prompt: string, imageBase64?: string|null, imageMime?: string }
//
// الرد:
//   نجاح  → { text: "..." }
//   فشل   → { error: "..." }   (مع رمز حالة HTTP مناسب)
//
// ─── الإعداد المطلوب على Vercel ───────────────────────────
// أضف متغير بيئة (Environment Variable) باسم GEMINI_API_KEY وقيمته مفتاح
// Gemini API (نفسه الظاهر بلوحة Google AI Studio)، لكل من: Production,
// Preview, Development — ثم أعد نشر المشروع (Redeploy) عشان يُقرأ المتغير.
// ────────────────────────────────────────────────────────

// اسم النموذج — يمكن تغييره لاحقاً بسهولة من هنا فقط لو احتجت نموذج مختلف
// ملاحظة: "gemini-2.0-flash" ثم "gemini-2.5-flash" تم إيقافهما تباعاً من Google (Google تسحب
// إصدارات Gemini القديمة بسرعة). لتفادي تكرار هذه المشكلة، نستخدم الاسم المستعار (alias)
// "gemini-flash-latest" الذي يشير دائماً لأحدث إصدار Flash مستقر متاح — يتحدّث تلقائياً
// من طرف Google نفسها مع كل إصدار جديد (بإشعار مسبق أسبوعين لأي تغيير جذري بالسلوك)
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// نسمح بحجم أكبر قليلاً للجسم (body) عشان الصور المرفوعة (OCR) ما تنرفض بسبب الحجم
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// نمدّد المهلة الزمنية المسموحة لهذه الدالة إلى أقصى حد متاح بالخطة المجانية (Hobby) لـ Vercel.
// بدون هذا، توليد دفعة أسئلة (خصوصاً بمحتوى رياضي/كيميائي معقّد) قد يستغرق أكثر من المهلة
// الافتراضية القصيرة، فتقطع Vercel الاتصال وترجّع صفحة خطأ عامة (500) بدل رد JSON صحيح.
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة (POST فقط)" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // خطأ إعداد بالسيرفر (مفتاح ناقص) — لازم يظهر واضح للمدير عشان يعرف السبب فوراً
    res.status(500).json({ error: "مفتاح Gemini API غير مُعرَّف بإعدادات السيرفر (GEMINI_API_KEY)" });
    return;
  }

  const { prompt, imageBase64, imageMime } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  // بناء أجزاء الرسالة: نص دائماً، وصورة اختيارية (Gemini يدعم النصوص والصور معاً بنفس الطلب)
  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: imageMime || "image/jpeg",
        data: imageBase64,
      },
    });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      // Google يرجّع الخطأ بصيغة { error: { message, status, code } }
      const msg = data?.error?.message || "خطأ غير معروف من Gemini API (رمز " + geminiRes.status + ")";
      res.status(geminiRes.status).json({ error: msg });
      return;
    }

    const candidate = data?.candidates?.[0];

    // حالة الحجب الأمني (Safety) — Gemini يرجّع candidate بدون نص فعلي أحياناً
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "RECITATION") {
      res.status(200).json({ error: "تم حجب الرد بسبب سياسات المحتوى لدى Gemini (finishReason: " + candidate.finishReason + ")" });
      return;
    }

    const text = candidate?.content?.parts?.map(p => p.text || "").join("") || "";
    if (!text) {
      res.status(200).json({ error: "رد Gemini فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ Gemini API: " + e.message });
  }
}
