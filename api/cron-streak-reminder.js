// api/cron-streak-reminder.js
// ─────────────────────────────────────────────────────────
// مهمة مجدولة يومية (Vercel Cron) — تفحص كل الطلاب اللي عندهم سلسلة نشطة
// (streaks/{phone})، ولسه ما زاروا التطبيق اليوم، وسلسلتهم بخطر الانكسار
// تحديداً اليوم (يعني آخر زيارة كانت بالضبط بالأمس، بتوقيت بغداد) — وترسلهم
// تذكير Push حقيقي قبل ما يفوتهم اليوم وتنكسر سلسلتهم.
//
// عمداً ما نذكّر كل الطلاب المنقطعين لأيام (لتفادي إزعاج متكرر لطالب ترك
// التطبيق من زمان) — بس اللي على وشك يخسرون سلسلة كانت نشطة فعلاً بالأمس.
//
// آلية الحماية من التشغيل العشوائي: Vercel Cron يرسل هيدر Authorization
// بقيمة CRON_SECRET (لازم تضيفه كمتغير بيئة بنفس الاسم) — أي طلب بدونه يُرفض،
// عشان محد يقدر يستدعي هذا المسار يدوياً ويبعث إشعارات مزعجة لكل الطلاب.
//
// نفس متغيرات Firebase Admin المستخدمة في api/notify.js و api/register.js
// ─────────────────────────────────────────────────────────

const admin = require("firebase-admin");

let initError = null;
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  } catch (e) {
    initError = e.message;
  }
}
const db = admin.apps.length ? admin.firestore() : null;

// يحسب نص التاريخ "اليوم" و"الأمس" بتوقيت بغداد (UTC+3، بدون توقيت صيفي) —
// بنفس صيغة toDateString() اللي يستخدمها المتصفح عند الطالب (مثال: "Wed Aug 21 2026")
// عشان تتطابق المقارنة تماماً مع القيم المخزّنة من طرف العميل
const baghdadDateString = (offsetDays = 0) => {
  const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;
  const d = new Date(Date.now() + BAGHDAD_OFFSET_MS + offsetDays * 86400000);
  return d.toDateString();
};

module.exports = async (req, res) => {
  // حماية: يقبل فقط الطلبات القادمة من Vercel Cron (تحمل السر الصحيح بالهيدر)
  const authHeader = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || authHeader !== "Bearer " + process.env.CRON_SECRET) {
    res.status(401).json({ error: "غير مصرّح" });
    return;
  }

  if (initError) {
    res.status(500).json({ error: "فشل تهيئة Firebase Admin: " + initError });
    return;
  }

  try {
    const todayStr = baghdadDateString(0);
    const yesterdayStr = baghdadDateString(-1);

    // نجيب كل الطلاب اللي آخر زيارة لهم كانت بالضبط بالأمس — يعني بخطر
    // الانكسار اليوم تحديداً لو ما زاروا التطبيق. (ملاحظة: كل سجل بمجموعة
    // "streaks" يبدأ بـdays=1 ولا ينزل تحته أبداً بتصميم نظام السلسلة، فما
    // نحتاج فلتر إضافي على "days" — هذا يبقي الاستعلام بسيط وبدون حاجة لأي
    // فهرس مركّب (Composite Index) إضافي بـFirestore)
    const streaksSnap = await db.collection("streaks")
      .where("lastDate", "==", yesterdayStr)
      .get();

    if (streaksSnap.empty) {
      res.status(200).json({ ok: true, atRisk: 0, pushSent: 0, message: "لا يوجد طلاب بخطر الانكسار اليوم" });
      return;
    }

    const atRiskPhones = streaksSnap.docs.map((d) => d.id);

    // نجيب توكنات الإشعارات لكل طالب بخطر (دفعات من 30 بحد أقصى — قيد Firestore على عبارة "in")
    let tokens = [];
    let tokenOwner = {};
    for (let i = 0; i < atRiskPhones.length; i += 30) {
      const batch = atRiskPhones.slice(i, i + 30);
      const studentsSnap = await db.collection("students").where(admin.firestore.FieldPath.documentId(), "in", batch).get();
      studentsSnap.forEach((d) => {
        const t = d.data().fcmTokens || [];
        t.forEach((tok) => (tokenOwner[tok] = d.id));
        tokens.push(...t);
      });
    }

    const title = "🔥 سلسلتك بخطر!";
    const body = "ما فتحت التطبيق اليوم بعد — افتحه الآن قبل منتصف الليل عشان ما تنكسر سلسلتك المتتالية!";

    let pushSent = 0;
    const badTokensByPhone = {};

    if (tokens.length > 0) {
      const chunks = [];
      for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

      for (const chunk of chunks) {
        const resp = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title, body,
              icon: "/logo192.png",
              tag: "edutok-streak-reminder",
              renotify: true,
              requireInteraction: false,
            },
            fcmOptions: { link: "/" },
          },
        });
        pushSent += resp.successCount;

        resp.responses.forEach((r, i) => {
          if (!r.success) {
            const code = r.error?.code || "";
            if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
              const badToken = chunk[i];
              const owner = tokenOwner[badToken];
              if (owner) {
                (badTokensByPhone[owner] ||= []).push(badToken);
              }
            }
          }
        });
      }
    }

    // تنظيف التوكنات الفاسدة (best-effort، بنفس أسلوب notify.js)
    const cleanupEntries = Object.entries(badTokensByPhone);
    if (cleanupEntries.length > 0) {
      try {
        await Promise.all(
          cleanupEntries.map(([ownerPhone, badTokens]) =>
            db.collection("students").doc(ownerPhone).update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...badTokens),
            })
          )
        );
      } catch {}
    }

    res.status(200).json({
      ok: true,
      atRisk: atRiskPhones.length,
      tokensFound: tokens.length,
      pushSent,
      todayStr, yesterdayStr, // للتشخيص فقط
    });
  } catch (e) {
    res.status(500).json({ error: "فشل تنفيذ المهمة: " + e.message });
  }
};
