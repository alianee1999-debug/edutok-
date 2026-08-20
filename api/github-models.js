// api/github-models.js
// دالة سيرفر (Vercel Serverless Function) تتصل فعلياً بـ GitHub Models.
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
// أضف متغير بيئة (Environment Variable) باسم GITHUB_MODELS_TOKEN وقيمته
// Personal Access Token من حساب GitHub — مجاني بالكامل، بدون أي بطاقة بنكية:
//   1. سجّل دخول لحسابك على github.com (أو أنشئ حساب جديد بالإيميل، مجاني).
//   2. روح Settings → Developer settings → Personal access tokens →
//      Fine-grained tokens → Generate new token.
//   3. ما يحتاج أي صلاحيات (Scopes) خاصة لاستخدام GitHub Models — توكن عادي كافي.
//   4. انسخ التوكن (يبدأ بـ github_pat_ أو ghp_) والصقه هنا بـVercel.
// لكل من: Production, Preview, Development — ثم أعد نشر المشروع (Redeploy)
// عشان يُقرأ المتغير.
//
// ⚠️ ملاحظة مهمة: الموديل المستخدم هنا نصّي فقط (لا يدعم تحليل الصور/OCR).
// لو وصلت صورة بالطلب (imageBase64) سنتجاهلها ونستخدم النص فقط، عشان الطلب
// ما يفشل — بدل ما نرجّع خطأ يوقف الواجهة الأمامية عن العمل.
// ────────────────────────────────────────────────────────

// اسم النموذج — يمكن تغييره لاحقاً بسهولة من هنا فقط
const GITHUB_MODELS_MODEL = "openai/gpt-4.1-mini";
const GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions";

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

  const apiKey = process.env.GITHUB_MODELS_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح GitHub Models غير مُعرَّف بإعدادات السيرفر (GITHUB_MODELS_TOKEN)" });
    return;
  }

  const { prompt, imageBase64 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  // تنبيه صامت بالسجل (log) لو وصلت صورة، عشان يظهر بسجلات Vercel عند التشخيص
  if (imageBase64) {
    console.warn("api/github-models: تم تجاهل صورة مرفقة — الموديل النصي الحالي لا يدعم الصور");
  }

  try {
    const ghRes = await fetch(GITHUB_MODELS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: GITHUB_MODELS_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await ghRes.json();

    if (!ghRes.ok || data.error) {
      const msg = data?.error?.message || data?.message || "خطأ غير معروف من GitHub Models API (رمز " + ghRes.status + ")";
      res.status(ghRes.status || 502).json({ error: msg });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      res.status(200).json({ error: "رد GitHub Models فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ GitHub Models API: " + e.message });
  }
}
