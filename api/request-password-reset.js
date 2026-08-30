// api/request-password-reset.js
// ─────────────────────────────────────────────────────────
// يسمح لطالب نسي كلمة مروره بإرسال طلب استعادة من داخل شاشة تسجيل الدخول،
// بدل ما يضطر يتواصل مع الإدارة بطريقة خارج التطبيق (واتساب شخصي، إلخ).
//
// لماذا مسار سيرفر منفصل (مو كتابة مباشرة من المتصفح): نفس سبب باقي ملفات
// api/*.js بهذا المشروع — قواعد أمان Firestore الحالية لا تسمح لأي زائر غير
// مسجَّل دخوله بالكتابة الحرة بقاعدة البيانات (وإلا صار بالإمكان إغراق قاعدة
// البيانات بمستندات وهمية). السيرفر هنا يتحقق أولاً أن رقم الموبايل ينتمي فعلاً
// لحساب طالب موجود قبل إنشاء أي طلب، بصلاحيات Admin SDK.
//
// نفس متغيرات البيئة المستخدمة في api/register.js و api/login.js و api/redeem-partner-code.js
// ─────────────────────────────────────────────────────────

const admin = require("firebase-admin");

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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة" });
    return;
  }

  try {
    const { phone } = req.body || {};

    if (!phone?.trim()) {
      res.status(400).json({ error: "أدخل رقم الموبايل أولاً" });
      return;
    }

    const phoneKey = String(phone).trim().replace(/\s+/g, "");
    const studentRef = db.collection("students").doc(phoneKey);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      // رسالة واضحة بدل رسالة غامضة — هذا لا يشكّل خطراً أمنياً هنا لأن التطبيق
      // أصلاً يكشف نفس المعلومة وقت التسجيل ("رقم الموبايل مسجل مسبقاً")
      res.status(200).json({ ok: false, error: "لا يوجد حساب مسجّل بهذا الرقم" });
      return;
    }
    const student = studentSnap.data();

    // نمنع تكرار الطلبات: لو فيه طلب قيد الانتظار فعلاً لنفس الرقم، لا ننشئ طلباً
    // جديداً (يمنع إغراق لوحة الإدارة بنفس الطلب لو الطالب ضغط الزر أكثر من مرة)
    const existingPending = await db.collection("passwordResetRequests")
      .where("phone", "==", phoneKey)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingPending.empty) {
      res.status(200).json({ ok: true, alreadyPending: true });
      return;
    }

    await db.collection("passwordResetRequests").add({
      phone: phoneKey,
      studentName: student.name || "",
      studentAccount: student.account || "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true, alreadyPending: false });
  } catch (e) {
    res.status(500).json({ error: "فشل إرسال طلب الاستعادة: " + e.message });
  }
};
