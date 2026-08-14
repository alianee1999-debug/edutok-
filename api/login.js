// api/login.js
// ─────────────────────────────────────────────────────────
// نقطة تحقق آمنة من تسجيل دخول الطالب — تعمل بالكامل على السيرفر.
// السبب: كلمة المرور المُشفّرة (hash + salt) لم تعد تُقرأ أو تُقارَن من داخل المتصفح إطلاقاً،
// فحتى لو كانت صلاحيات قراءة Firestore غير محكمة، ما فيه طريقة يقدر فيها أي شخص
// يسحب الـ hash/salt الخاص بطالب معيّن عبر هذا المسار.
//
// يستخدم Firebase Admin SDK (صلاحيات كاملة من السيرفر، غير خاضع لقواعد أمان Firestore).
//
// متغيرات البيئة المطلوبة (تُضاف بإعدادات الاستضافة، مثال Vercel):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (انسخها من ملف Service Account JSON، مع الحفاظ على \n كما هي)
// ─────────────────────────────────────────────────────────

const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

const sha256Hex = (text) => crypto.createHash("sha256").update(text).digest("hex");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة" });
    return;
  }

  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      res.status(400).json({ error: "أدخل رقم الموبايل وكلمة المرور" });
      return;
    }

    const phoneKey = String(phone).trim().replace(/\s+/g, "");
    const ref = db.collection("students").doc(phoneKey);
    const snap = await ref.get();

    if (!snap.exists) {
      res.status(200).json({ ok: false, error: "رقم الموبايل غير مسجل" });
      return;
    }

    const data = snap.data();

    if (data.banned) {
      res.status(200).json({ ok: false, error: "🚫 هذا الحساب محظور. تواصل مع المدير" });
      return;
    }

    if (!data.passHash || !data.passSalt) {
      res.status(200).json({ ok: false, error: "الحساب غير مكتمل، تواصل مع المدير" });
      return;
    }

    const candidate = sha256Hex(data.passSalt + ":" + String(password).trim());
    if (candidate !== data.passHash) {
      res.status(200).json({ ok: false, error: "كلمة المرور غير صحيحة" });
      return;
    }

    // نجاح — نُرجع فقط البيانات غير الحساسة اللازمة لجلسة الطالب (بدون hash/salt إطلاقاً)
    res.status(200).json({
      ok: true,
      student: {
        name: data.name || "",
        phone: data.phone || phoneKey,
        account: data.account || "",
        stage: data.stage || "الابتدائية",
        grade: data.grade || "الأول",
        accountType: data.accountType || "student",
      },
    });
  } catch (e) {
    res.status(500).json({ error: "فشل تسجيل الدخول: " + e.message });
  }
};
