// api/cerebras.js
// دالة سيرفر (Vercel Serverless Function) تتصل فعلياً بـ Cerebras API.
// تطابق تماماً نفس شكل الطلب/الرد المستخدم مع /api/groq و/api/gemini، عشان الواجهة
// الأمامية تقدر تستخدمها كبديل مباشر بدون أي تعديل بمنطقها.
//
// الطلب المتوقع (POST، JSON):
//   { prompt: string, imageBase64?: string|null, imageMime?: string }
//
// الرد:
//   نجاح  → { text: "..." }
//   فشل   → { error: "..." }   (مع رمز حالة HTTP مناسب)
//
// ─── الإعداد المطلوب على Vercel ───────────────────────────
// أضف متغير بيئة (Environment Variable) باسم CEREBRAS_API_KEY وقيمته مفتاح
// Cerebras API (من لوحة cloud.cerebras.ai)، لكل من: Production, Preview,
// Development — ثم أعد نشر المشروع (Redeploy) عشان يُقرأ المتغير.
//
// ⚠️ ملاحظة مهمة: نماذج Cerebras الحالية نصّية فقط (لا تدعم تحليل الصور/OCR).
// لو وصلت صورة بالطلب (imageBase64) سنتجاهلها ونستخدم النص فقط، عشان الطلب
// ما يفشل — بدل ما نرجّع خطأ يوقف الواجهة الأمامية عن العمل.
// ────────────────────────────────────────────────────────

// اسم النموذج — يمكن تغييره لاحقاً بسهولة من هنا فقط
const CEREBRAS_MODEL = "llama-3.3-70b";
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة (POST فقط)" });
    return;
  }

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح Cerebras API غير مُعرَّف بإعدادات السيرفر (CEREBRAS_API_KEY)" });
    return;
  }

  const { prompt, imageBase64 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  // تنبيه صامت بالسجل (log) لو وصلت صورة، عشان يظهر بسجلات Vercel عند التشخيص
  if (imageBase64) {
    console.warn("api/cerebras: تم تجاهل صورة مرفقة — نماذج Cerebras الحالية لا تدعم الصور");
  }

  try {
    const cerebrasRes = await fetch(CEREBRAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await cerebrasRes.json();

    if (!cerebrasRes.ok || data.error) {
      const msg = data?.error?.message || data?.message || "خطأ غير معروف من Cerebras API (رمز " + cerebrasRes.status + ")";
      res.status(cerebrasRes.status || 502).json({ error: msg });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      res.status(200).json({ error: "رد Cerebras فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ Cerebras API: " + e.message });
  }
}
