// api/deepseek.js
// دالة سيرفر (Vercel Serverless Function) تتصل فعلياً بـ DeepSeek API.
// تطابق تماماً نفس شكل الطلب/الرد المستخدم مع باقي المزودين، عشان الواجهة
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
// أضف متغير بيئة (Environment Variable) باسم DEEPSEEK_API_KEY وقيمته مفتاح
// DeepSeek API (من لوحة platform.deepseek.com)، لكل من: Production, Preview,
// Development — ثم أعد نشر المشروع (Redeploy) عشان يُقرأ المتغير.
//
// ⚠️ ملاحظتان مهمتان:
// 1) نماذج DeepSeek الحالية عبر الـ API نصّية فقط (لا تدعم تحليل الصور/OCR).
//    لو وصلت صورة بالطلب (imageBase64) سنتجاهلها ونستخدم النص فقط.
// 2) DeepSeek تستخدم نظام تسعير/حصة "وقت ذروة - خارج الذروة" (Peak/Off-Peak)
//    حسب توقيت UTC، لذا استجابة الحصة المجانية قد تختلف حسب وقت اليوم.
// ────────────────────────────────────────────────────────

const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح DeepSeek API غير مُعرَّف بإعدادات السيرفر (DEEPSEEK_API_KEY)" });
    return;
  }

  const { prompt, imageBase64 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  if (imageBase64) {
    console.warn("api/deepseek: تم تجاهل صورة مرفقة — نماذج DeepSeek الحالية عبر الـ API لا تدعم الصور");
  }

  try {
    const deepseekRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await deepseekRes.json();

    if (!deepseekRes.ok || data.error) {
      const msg = data?.error?.message || data?.message || "خطأ غير معروف من DeepSeek API (رمز " + deepseekRes.status + ")";
      res.status(deepseekRes.status || 502).json({ error: msg });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      res.status(200).json({ error: "رد DeepSeek فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ DeepSeek API: " + e.message });
  }
}
