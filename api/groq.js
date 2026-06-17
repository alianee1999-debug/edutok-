// api/groq.js
// هذا الملف يعمل فقط على سيرفر Vercel (Serverless Function)
// المفتاح هنا يُقرأ من Environment Variable ولا يظهر أبداً للمتصفح

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  // نسمح فقط بطلبات POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY غير مضبوط على السيرفر" });
  }

  try {
    const { prompt, imageBase64, imageMime } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt مطلوب" });
    }

    let body;
    if (imageBase64) {
      body = {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${imageMime || "image/jpeg"};base64,${imageBase64}` } },
              { type: "text", text: prompt }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      };
    } else {
      body = {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      };
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY
      },
      body: JSON.stringify(body)
    });

    const data = await groqRes.json();

    if (data.error) {
      return res.status(502).json({ error: data.error.message || "خطأ من Groq" });
    }

    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "خطأ غير متوقع بالسيرفر" });
  }
}
