// api/notify.js
// ─────────────────────────────────────────────────────────
// البوابة الوحيدة لإنشاء أي إشعار بالتطبيق. تسوي شيئين معاً:
// 1) تسجّل الإشعار بمجموعة "notifications" (زي ما كان يصير سابقاً من المتصفح مباشرة،
//    بس الآن عبر Admin SDK حتى نقدر نغلق صلاحية الكتابة المباشرة من العميل بقواعد Firestore)
// 2) ترسل Push حقيقي (FCM) لكل الأجهزة المسجّلة للطالب (أو لكل الطلاب لو بث جماعي)
//
// body: { phone: "07xxxxxxxxx" | null (null = بث لكل الطلاب), title, body }
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
    const { phone, title, body } = req.body || {};
    const titleTrim = String(title || "").trim().slice(0, 200);
    const bodyTrim = String(body || "").trim().slice(0, 1000);

    if (!titleTrim || !bodyTrim) {
      res.status(400).json({ error: "العنوان والنص مطلوبان" });
      return;
    }

    const notifDoc = {
      title: titleTrim,
      body: bodyTrim,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let tokens = [];
    let tokenOwner = {}; // token -> phone (يُستخدم عند البث الجماعي لتنظيف التوكنات الفاسدة لكل طالب)
    let sentTo = 0;

    if (phone) {
      const phoneKey = String(phone).trim().replace(/\s+/g, "");
      notifDoc.targetPhone = phoneKey;
      notifDoc.sentTo = 1;
      sentTo = 1;

      const snap = await db.collection("students").doc(phoneKey).get();
      if (snap.exists) {
        tokens = snap.data().fcmTokens || [];
        tokens.forEach((t) => (tokenOwner[t] = phoneKey));
      }
    } else {
      // بث جماعي لكل الطلاب
      const studentsSnap = await db.collection("students").get();
      sentTo = studentsSnap.size;
      notifDoc.sentTo = sentTo;
      studentsSnap.forEach((d) => {
        const t = d.data().fcmTokens || [];
        t.forEach((tok) => (tokenOwner[tok] = d.id));
        tokens.push(...t);
      });
    }

    // 1) تسجيل الإشعار (يظهر بجرس الإشعارات داخل التطبيق كما كان سابقاً)
    await db.collection("notifications").add(notifDoc);

    // 2) إرسال Push فعلي لكل توكن مسجّل (FCM تدعم حتى 500 توكن بكل استدعاء)، مرة واحدة فقط لكل توكن
    let pushSent = 0;
    const badTokensByPhone = {}; // phone -> [tokens فاسدة تُحذف]

    if (tokens.length > 0) {
      const chunks = [];
      for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

      for (const chunk of chunks) {
        const resp = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title: titleTrim, body: bodyTrim },
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

    // تنظيف التوكنات الفاسدة/المنتهية من حسابات أصحابها (best-effort، لا نفشل الطلب بسبب فشل التنظيف)
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

    res.status(200).json({ ok: true, sentTo, pushSent });
  } catch (e) {
    res.status(500).json({ error: "فشل الإرسال: " + e.message });
  }
};
