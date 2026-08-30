// api/ai.js
// ─────────────────────────────────────────────────────────
// دالة سيرفر واحدة (Vercel Serverless Function) تجمع الأربعة مزودين
// (Gemini, Groq, OpenRouter, NVIDIA) بدل أربعة ملفات منفصلة.
//
// السبب: خطة Vercel Hobby (المجانية) تسمح بحد أقصى 12 Serverless Function
// لكل مشروع. كل ملف داخل مجلد api/ يُحسب كدالة منفصلة، وأي زيادة عن 12 تفشل
// عملية النشر بالكامل برسالة "No more than 12 Serverless Functions...".
// دمج المزودين الأربعة (اللي بيعملوا نفس الوظيفة تماماً — استقبال سؤال ورد
// نصي) بملف واحد يقلل العدد فعلياً بثلاثة، بدون أي تغيير بالسلوك الفعلي.
//
// الطلب المتوقع (POST، JSON):
//   { provider: "gemini"|"groq"|"openrouter"|"nvidia", prompt: string, imageBase64?: string|null, imageMime?: string }
//
// الرد: نفس شكل الرد القديم بالضبط لكل مزود — { text: "..." } أو { error: "..." }
// حتى لا يحتاج أي تعديل بمنطق التحقق من الأخطاء بالواجهة الأمامية.
//
// ─── الإعداد المطلوب على Vercel (بدون تغيير) ───────────────
// نفس متغيرات البيئة الأربعة القديمة بالضبط، لكل من Production/Preview/Development:
//   GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY
// ────────────────────────────────────────────────────────

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
export const maxDuration = 60;

// ─── Gemini ──────────────────────────────────────────────
// "gemini-flash-latest" يشير دائماً لأحدث إصدار Flash مستقر — يتحدّث تلقائياً
// من Google نفسها، يتفادى مشكلة تقاعد الإصدارات المسمّاة (حصل مرتين سابقاً)
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt, imageBase64, imageMime, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح Gemini API غير مُعرَّف بإعدادات السيرفر (GEMINI_API_KEY)" });
    return;
  }

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMime || "image/jpeg", data: imageBase64 } });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || "خطأ غير معروف من Gemini API (رمز " + geminiRes.status + ")";
      res.status(geminiRes.status).json({ error: msg });
      return;
    }

    const candidate = data?.candidates?.[0];
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

// ─── Groq ────────────────────────────────────────────────
async function callGroq(prompt, imageBase64, imageMime, res) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY غير مضبوط على السيرفر" });
    return;
  }

  let body;
  if (imageBase64) {
    // الصور: نموذج Llama 4 Scout يدعم الرؤية (Vision)
    body = {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${imageMime || "image/jpeg"};base64,${imageBase64}` } },
            { type: "text", text: prompt },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };
  } else {
    body = {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    };
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify(body),
    });

    const data = await groqRes.json();

    if (data.error) {
      res.status(502).json({ error: data.error.message || "خطأ من Groq" });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message || "خطأ غير متوقع بالسيرفر" });
  }
}

// ─── OpenRouter ──────────────────────────────────────────
// "openrouter/free" موجّه تلقائي يختار أسرع موديل مجاني متاح بكل طلب
const OPENROUTER_MODEL = "openrouter/free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(prompt, imageBase64, res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح OpenRouter API غير مُعرَّف بإعدادات السيرفر (OPENROUTER_API_KEY)" });
    return;
  }

  // الموديل نصّي فقط — أي صورة مرفقة تُتجاهل بدل ما يفشل الطلب كله
  if (imageBase64) {
    console.warn("api/ai (openrouter): تم تجاهل صورة مرفقة — الموديل النصي الحالي لا يدعم الصور");
  }

  try {
    const orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await orRes.json();

    if (!orRes.ok || data.error) {
      const msg = data?.error?.message || data?.message || "خطأ غير معروف من OpenRouter API (رمز " + orRes.status + ")";
      res.status(orRes.status || 502).json({ error: msg });
      return;
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      res.status(200).json({ error: "رد OpenRouter فارغ أو بصيغة غير متوقعة" });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بـ OpenRouter API: " + e.message });
  }
}

// ─── NVIDIA NIM ──────────────────────────────────────────
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function callNvidia(prompt, imageBase64, res) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح NVIDIA API غير مُعرَّف بإعدادات السيرفر (NVIDIA_API_KEY)" });
    return;
  }

  // الموديل نصّي فقط — أي صورة مرفقة تُتجاهل بدل ما يفشل الطلب كله
  if (imageBase64) {
    console.warn("api/ai (nvidia): تم تجاهل صورة مرفقة — الموديل النصي الحالي لا يدعم الصور");
  }

  try {
    const nvidiaRes = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
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

// ─── نقطة الدخول الموحّدة ────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة (POST فقط)" });
    return;
  }

  const { provider, prompt, imageBase64, imageMime } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "نص الطلب (prompt) مفقود أو غير صالح" });
    return;
  }

  switch (provider) {
    case "gemini":
      return callGemini(prompt, imageBase64, imageMime, res);
    case "groq":
      return callGroq(prompt, imageBase64, imageMime, res);
    case "openrouter":
      return callOpenRouter(prompt, imageBase64, res);
    case "nvidia":
      return callNvidia(prompt, imageBase64, res);
    default:
      res.status(400).json({ error: "قيمة provider غير معروفة أو مفقودة — استخدم gemini أو groq أو openrouter أو nvidia" });
  }
}
