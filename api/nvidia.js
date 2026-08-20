// api/nvidia.js
// دالة سيرفر (Vercel Serverless Function) تتصل فعلياً بـ NVIDIA NIM (build.nvidia.com).
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
// أضف متغير بيئة (Environment Variable) باسم NVIDIA_API_KEY وقيمته مفتاح
// NVIDIA NIM (من لوحة build.nvidia.com → افتح أي موديل → Get API Key، المفتاح
// يبدأ بـ nvapi-) — مجاني بالكامل، بدون بطاقة بنكية — لكل من: Production,
// Preview, Development — ثم أعد نشر المشروع (Redeploy) عشان يُقرأ المتغير.
//
// ⚠️ ملاحظة مهمة: الموديل المستخدم هنا نصّي فقط (لا يدعم تحليل الصور/OCR).
// لو وصلت صورة بالطلب (imageBase64) سنتجاهلها ونستخدم النص فقط، عشان الطلب
// ما يفشل — بدل ما نرجّع خطأ يوقف الواجهة الأمامية عن العمل.
// ────────────────────────────────────────────────────────

// اسم النموذج — يمكن تغييره لاحقاً بسهولة من هنا فقط
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

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

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح NVIDIA API غير مُعرَّف بإعدادات السيرفر (NVIDIA_API_KEY)" });
    return;
  }

  const { prompt, imageBase64 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  // تنبيه صامت بالسجل (log) لو وصلت صورة، عشان يظهر بسجلات Vercel عند التشخيص
  if (imageBase64) {
    console.warn("api/nvidia: تم تجاهل صورة مرفقة — الموديل النصي الحالي لا يدعم الصور");
  }

  try {
    const nvidiaRes = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await nvidiaRes.json();

    if (!nvidiaRes.ok || data.error) {
      const msg = data?.error?.message || data?.message || "خطأ غير معروف من NVIDIA NIM API (رمز " + nvidiaRes.status + ")";
      res.status(nvidiaRes.status || 502).json({ error: msg });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      res.status(200).json({ error: "رد NVIDIA فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ NVIDIA NIM API: " + e.message });
  }
}
