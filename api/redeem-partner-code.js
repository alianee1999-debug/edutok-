// api/redeem-partner-code.js
// ─────────────────────────────────────────────────────────
// يسمح لطالب مسجَّل مسبقاً بإضافة كود شراكة لاحقاً (بعد إنشاء الحساب)، بعكس
// المسار القديم اللي كان كود الشراكة يُدخَل فقط وقت التسجيل الأول.
//
// السبب في وجود هذا كمسار سيرفر منفصل (مو كتابة مباشرة من المتصفح): قواعد أمان
// Firestore الحالية (students/{phone}) تمنع الطالب من تعديل حقلي campaignCode
// و campaignBonusDays على حسابه مباشرة — تسمح فقط بتحديث حقول محددة (fcmTokens،
// campaignBonusGiven، lastSeenAt، appInstalled) كل وحد لحاله. هذا القيد مقصود
// أصلاً لمنع أي طالب يضيف لنفسه مكافأة بدون التحقق من كود شراكة حقيقي وفعّال.
// فالمسار الوحيد الآمن هو نفس أسلوب api/register.js: تحقّق وكتابة من طرف
// السيرفر بصلاحيات Admin SDK، تتجاوز قيود المتصفح بأمان لأنها تتحقق من الكود
// فعلياً قبل أي كتابة.
//
// نفس متغيرات البيئة المستخدمة في api/register.js و api/login.js
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
    const { phone, code } = req.body || {};

    if (!phone?.trim() || !code?.trim()) {
      res.status(400).json({ error: "أدخل الكود أولاً" });
      return;
    }

    const phoneKey = String(phone).trim().replace(/\s+/g, "");
    const studentRef = db.collection("students").doc(phoneKey);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      res.status(200).json({ ok: false, error: "الحساب غير موجود، سجّل الدخول مرة أخرى" });
      return;
    }
    const student = studentSnap.data();

    // كود شراكة واحد فقط لكل طالب طوال عمر الحساب — يمنع الجمع بين أكثر من
    // كود أو إعادة استخدام كود ثانٍ بعد ما استفاد من الأول
    if (student.campaignCode) {
      res.status(200).json({ ok: false, error: "لديك كود شراكة مسجّل مسبقاً بحسابك" });
      return;
    }

    const codeKey = String(code).trim().toUpperCase();
    const campRef = db.collection("campaignCodes").doc(codeKey);
    const campSnap = await campRef.get();
    if (!campSnap.exists) {
      // تحقق إضافي: هل هذا فعلياً كود اشتراك عادي (تفعيل مادة) كتبه الطالب
      // بالغلط بخانة كود الشراكة؟ نميّز الحالة بوضوح بدل رسالة "غير صحيح" مبهمة
      const subCodeSnap = await db.collection("codes").doc(codeKey).get();
      if (subCodeSnap.exists) {
        res.status(200).json({
          ok: false,
          wrongType: "subscription",
          error: "هذا كود تفعيل اشتراك عادي، مو كود شراكة — فعّله من «لدي كود تفعيل» بدل هنا",
        });
        return;
      }
      res.status(200).json({ ok: false, error: "كود الشراكة غير صحيح" });
      return;
    }
    const camp = campSnap.data();
    if (!camp.active) {
      res.status(200).json({ ok: false, error: "كود الشراكة موقوف حالياً" });
      return;
    }
    if (new Date(camp.expiresAt) < new Date()) {
      res.status(200).json({ ok: false, error: "انتهت صلاحية كود الشراكة" });
      return;
    }
    const usedCount = Number(camp.usedCount || 0);
    if (usedCount >= Number(camp.maxUses || 0)) {
      res.status(200).json({ ok: false, error: "وصل كود الشراكة للحد الأقصى من الطلاب" });
      return;
    }

    const bonusDays = Number(camp.bonusDays || 0);
    await studentRef.update({
      campaignCode: codeKey,
      campaignBonusDays: bonusDays,
      campaignBonusGiven: false,
    });

    try {
      await campRef.update({ usedCount: usedCount + 1 });
    } catch {}

    res.status(200).json({ ok: true, bonusDays });
  } catch (e) {
    res.status(500).json({ error: "فشل تفعيل كود الشراكة: " + e.message });
  }
};
