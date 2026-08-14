// api/register.js
// ─────────────────────────────────────────────────────────
// تسجيل حساب طالب جديد بالكامل من طرف السيرفر.
// السبب: عملية التسجيل القديمة كانت تتحقق من "هل رقم الموبايل مسجّل مسبقاً" بقراءة مباشرة
// من المتصفح (getDoc على مجموعة students)، وهذا يفترض أن قراءة هذه المجموعة مفتوحة —
// وهو نفس الثغرة اللي كانت تسمح بقراءة hash/salt أي طالب. نقل هذا الفحص هنا يعني إمكانية
// إغلاق صلاحية قراءة مجموعة "students" بالكامل من قواعد أمان Firestore دون كسر التسجيل.
//
// نفس متغيرات البيئة المستخدمة في api/login.js
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

const randomSaltHex = () => crypto.randomBytes(16).toString("hex");
const sha256Hex = (text) => crypto.createHash("sha256").update(text).digest("hex");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة" });
    return;
  }

  try {
    const { name, phone, account, password, stage, grade, accountType, partnerCode } = req.body || {};

    if (!name?.trim() || !phone?.trim() || !account?.trim() || !password?.trim()) {
      res.status(400).json({ error: "أكمل كل الحقول المطلوبة" });
      return;
    }

    const phoneKey = String(phone).trim().replace(/\s+/g, "");
    const ref = db.collection("students").doc(phoneKey);
    const existing = await ref.get();
    if (existing.exists) {
      res.status(200).json({ ok: false, error: "رقم الموبايل مسجل مسبقاً" });
      return;
    }

    // التحقق من كود الشراكة (اختياري) قبل إنشاء الحساب
    let campaignInfo = null;
    const code = String(partnerCode || "").trim().toUpperCase();
    if (code) {
      const campRef = db.collection("campaignCodes").doc(code);
      const campSnap = await campRef.get();
      if (!campSnap.exists) {
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
      if ((camp.usedCount || 0) >= (camp.maxUses || 0)) {
        res.status(200).json({ ok: false, error: "وصل كود الشراكة للحد الأقصى من الطلاب" });
        return;
      }
      campaignInfo = { code, bonusDays: Number(camp.bonusDays || 0), usedCount: Number(camp.usedCount || 0) };
    }

    const salt = randomSaltHex();
    const hash = sha256Hex(salt + ":" + password.trim());

    const stored = {
      name: name.trim(),
      phone: phoneKey,
      account: account.trim(),
      stage: stage || "الابتدائية",
      grade: grade || "الأول",
      accountType: accountType || "student",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (campaignInfo) {
      stored.campaignCode = campaignInfo.code;
      stored.campaignBonusDays = campaignInfo.bonusDays;
      stored.campaignBonusGiven = false;
    }

    await ref.set(stored);
    // بيانات الدخول (hash/salt) تُخزَّن بمستند فرعي منفصل مغلق بالكامل بقواعد Firestore
    // (students/{phone}/private/auth)، بدل حفظها بنفس مستند الطالب الرئيسي المقروء علناً
    await ref.collection("private").doc("auth").set({ passHash: hash, passSalt: salt });

    if (campaignInfo) {
      try {
        await db.collection("campaignCodes").doc(campaignInfo.code).update({ usedCount: campaignInfo.usedCount + 1 });
      } catch {}
    }

    res.status(200).json({
      ok: true,
      student: {
        name: stored.name,
        phone: stored.phone,
        account: stored.account,
        stage: stored.stage,
        grade: stored.grade,
        accountType: stored.accountType,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "فشل التسجيل: " + e.message });
  }
};
