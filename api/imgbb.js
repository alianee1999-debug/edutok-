export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) {
    return res.status(500).json({ error: "IMGBB_API_KEY غير مضبوط على السيرفر" });
  }

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 مطلوب" });
    }

    const form = new URLSearchParams();
    form.append("image", imageBase64);
    form.append("key", IMGBB_API_KEY);

    const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const data = await imgbbRes.json();

    if (!data.success) {
      return res.status(502).json({ error: "فشل رفع الصورة إلى ImgBB" });
    }

    return res.status(200).json({
      url: data.data.url,
      base64: data.data.image?.base64 || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "خطأ غير متوقع بالسيرفر" });
  }
}
