// api/notify.js
// ─────────────────────────────────────────────────────────
// البوابة الوحيدة لإنشاء أي إشعار بالتطبيق. تسوي شيئين معاً:
// 1) تسجّل الإشعار بمجموعة "notifications" (زي ما كان يصير سابقاً من المتصفح مباشرة،
//    بس الآن عبر Admin SDK حتى نقدر نغلق صلاحية الكتابة المباشرة من العميل بقواعد Firestore)
// 2) ترسل Push حقيقي (FCM) لكل الأجهزة المسجّلة للطالب (أو لكل الطلاب لو بث جماعي)
//
// body: { phone: "07xxxxxxxxx" | null (null = بث لكل الطلاب), title, body }
//
// ملاحظة مؤقتة للتشخيص: أضفنا console.log/console.error بنقاط حرجة، بالإضافة
// لحقل "debug" داخل الاستجابة نفسها (JSON) — عشان تقدر تشوف وش صار فوراً
// حتى لو تبويب Logs بفيرسل ما يعرض شي أو يتأخر. تقدر تحذف هذا لاحقاً بعد
// ما تتأكد إن كل شي يشتغل تمام.
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
    console.log("NOTIFY INIT: admin.initializeApp نجحت");
  } catch (e) {
    initError = e.message;
    console.error("NOTIFY INIT ERROR:", e.message);
  }
}
const db = admin.apps.length ? admin.firestore() : null;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "الطريقة غير مسموحة" });
    return;
  }

  // لو فشلت التهيئة من الأساس (مثلاً مفتاح خاطئ)، نرجع الخطأ فوراً وبوضوح
  if (initError) {
    console.error("NOTIFY: رفض الطلب بسبب فشل التهيئة:", initError);
    res.status(500).json({ error: "فشل تهيئة Firebase Admin: " + initError });
    return;
  }

  try {
    const { phone, title, body } = req.body || {};
    const titleTrim = String(title || "").trim().slice(0, 200);
    const bodyTrim = String(body || "").trim().slice(0, 1000);

    console.log("NOTIFY REQUEST:", JSON.stringify({ phone, titleTrim, bodyTrim }));

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
    let studentFound = null; // للتشخيص: هل لقينا مستند الطالب أصلاً

    if (phone) {
      const phoneKey = String(phone).trim().replace(/\s+/g, "");
      notifDoc.targetPhone = phoneKey;
      notifDoc.sentTo = 1;
      sentTo = 1;

      const snap = await db.collection("students").doc(phoneKey).get();
      studentFound = snap.exists;
      console.log("NOTIFY STUDENT LOOKUP:", phoneKey, "exists:", snap.exists);

      if (snap.exists) {
        tokens = snap.data().fcmTokens || [];
        tokens.forEach((t) => (tokenOwner[t] = phoneKey));
        console.log("NOTIFY TOKENS FOUND:", tokens.length);
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
      console.log("NOTIFY BROADCAST TOKENS FOUND:", tokens.length, "students:", sentTo);
    }

    // 1) تسجيل الإشعار (يظهر بجرس الإشعارات داخل التطبيق كما كان سابقاً)
    await db.collection("notifications").add(notifDoc);

    // 2) إرسال Push فعلي لكل توكن مسجّل (FCM تدعم حتى 500 توكن بكل استدعاء)، مرة واحدة فقط لكل توكن
    let pushSent = 0;
    let pushErrors = []; // للتشخيص: أول خطأ لكل نوع، بدون تكرار كل التفاصيل
    const badTokensByPhone = {}; // phone -> [tokens فاسدة تُحذف]

    if (tokens.length > 0) {
      const chunks = [];
      for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

      for (const chunk of chunks) {
        const resp = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title: titleTrim, body: bodyTrim },
          // إعدادات ويب صريحة تزيد احتمال العرض الفعلي على الجهاز، خصوصاً بأنظمة
          // توفير الطاقة العدوانية (مثل MIUI/شاومي) اللي قد تؤخّر أو تتجاهل الإشعارات
          // منخفضة الأولوية بصمت — "high" تطلب تسليم فوري بدل ما تُجدوَل لاحقاً
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title: titleTrim,
              body: bodyTrim,
              icon: "/logo192.png",
              // renotify+tag يمنعان تكدّس إشعارات قديمة بصمت لو النظام أجّل عرضها
              tag: "edutok-notification",
              renotify: true,
              requireInteraction: false,
            },
            fcmOptions: {
              link: "/",
            },
          },
        });
        pushSent += resp.successCount;
        console.log("NOTIFY FCM RESULT:", "success:", resp.successCount, "failure:", resp.failureCount);

        resp.responses.forEach((r, i) => {
          if (!r.success) {
            const code = r.error?.code || "";
            const msg = r.error?.message || "";
            console.error("NOTIFY FCM ERROR:", code, msg);
            pushErrors.push({ code, message: msg });
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
    } else {
      console.warn("NOTIFY: لا توجد توكنات مسجّلة — لن يُرسل أي Push فعلي.");
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

    console.log("NOTIFY RESULT:", JSON.stringify({ ok: true, sentTo, pushSent, tokensFound: tokens.length }));

    res.status(200).json({
      ok: true,
      sentTo,
      pushSent,
      // معلومات تشخيصية مؤقتة — تقدر تحذفها لاحقاً
      debug: {
        studentFound,
        tokensFound: tokens.length,
        pushErrors: pushErrors.slice(0, 5), // أول 5 أخطاء بس حتى ما تكبر الاستجابة
      },
    });
  } catch (e) {
    console.error("NOTIFY ERROR:", e.message, e.stack);
    res.status(500).json({ error: "فشل الإرسال: " + e.message });
  }
};
