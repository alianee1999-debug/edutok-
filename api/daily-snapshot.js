// api/daily-snapshot.js
// ─────────────────────────────────────────────────────────
// يأخذ "لقطة" يومية من أهم الأرقام (عدد الطلاب، الطلاب الجدد، الاشتراكات الفعّالة،
// الإيرادات المقبولة) ويخزّنها بمستند بتاريخ اليوم داخل مجموعة "dailyStats".
// بمرور الأيام تتجمّع سلسلة تواريخ تصير قابلة للعرض كرسم بياني بلوحة الإدارة.
//
// يُشغَّل تلقائياً مرة كل يوم عبر Vercel Cron Jobs (راجع vercel.json)،
// ومحمي كمان بمفتاح سري لمنع أي تشغيل غير مصرّح به من خارج Vercel.
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
  // Vercel Cron يرسل هيدر "authorization: Bearer <CRON_SECRET>" تلقائياً،
  // ونسمح كمان بتشغيل يدوي عبر ?key= لأغراض الاختبار
  const authHeader = req.headers.authorization || "";
  const keyParam = (req.query && req.query.key) || "";
  const validCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = process.env.MIGRATE_SECRET && keyParam === process.env.MIGRATE_SECRET;

  if (!validCron && !validManual) {
    res.status(403).json({ error: "غير مصرّح" });
    return;
  }

  try {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // إجمالي الطلاب
    const studentsSnap = await db.collection("students").get();
    const totalStudents = studentsSnap.size;

    // الطلاب الجدد اليوم (حسب createdAt)
    let newStudentsToday = 0;
    studentsSnap.forEach((d) => {
      const created = d.data().createdAt;
      if (created && created.toDate && created.toDate() >= startOfDay) newStudentsToday++;
    });

    // الاشتراكات الفعّالة الآن (لم تنتهِ صلاحيتها بعد)
    const subsSnap = await db.collection("subscriptions").get();
    let activeSubscriptions = 0;
    subsSnap.forEach((d) => {
      const exp = d.data().expiresAt;
      if (exp && new Date(exp) > now) activeSubscriptions++;
    });

    // إجمالي الإيرادات المقبولة (تراكمي منذ البداية، وليس يومي فقط)
    const paymentsSnap = await db.collection("payments").where("status", "==", "approved").get();
    let totalRevenue = 0;
    paymentsSnap.forEach((d) => {
      totalRevenue += Number(d.data().amount || 0);
    });

    const snapshot = {
      date: todayKey,
      totalStudents,
      newStudentsToday,
      activeSubscriptions,
      totalRevenue,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("dailyStats").doc(todayKey).set(snapshot);

    res.status(200).json({ ok: true, snapshot });
  } catch (e) {
    res.status(500).json({ error: "فشل أخذ اللقطة اليومية: " + e.message });
  }
};
