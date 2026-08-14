// api/migrate-passwords.js
// ─────────────────────────────────────────────────────────
// سكربت ترحيل يعمل مرة واحدة فقط: ينقل passHash/passSalt لكل طالب موجود مسبقاً
// من مستند الطالب الرئيسي (المكان القديم، المكشوف علناً بقواعد Firestore الحالية)
// إلى المستند الفرعي الآمن الجديد (students/{phone}/private/auth)، ثم يحذفها
// من المستند الرئيسي حتى لا تبقى مكشوفة بعد نشر القواعد الجديدة.
//
// محمي بمفتاح سري (MIGRATE_SECRET) حتى لا يقدر أي شخص يشغّله غيرك.
// يُستخدم مرة واحدة فقط ثم يُفضّل حذف هذا الملف من المشروع بعدها.
//
// طريقة التشغيل: افتح بالمتصفح
//   https://اسم-موقعك.vercel.app/api/migrate-passwords?key=المفتاح_السري
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
  const key = (req.query && req.query.key) || "";
  if (!process.env.MIGRATE_SECRET || key !== process.env.MIGRATE_SECRET) {
    res.status(403).json({ error: "غير مصرّح — مفتاح غير صحيح" });
    return;
  }

  try {
    const snap = await db.collection("students").get();
    let migrated = 0;
    let alreadyDone = 0;
    let skippedNoPassword = 0;
    const errors = [];

    for (const docSnap of snap.docs) {
      const phone = docSnap.id;
      const data = docSnap.data();

      try {
        const authRef = db.collection("students").doc(phone).collection("private").doc("auth");
        const authSnap = await authRef.get();

        if (authSnap.exists) {
          // تم ترحيله مسبقاً (أو حساب جديد اتسجل بالطريقة الجديدة أصلاً) — لا داعي لأي شيء
          alreadyDone++;
          // مع ذلك، لو المستند الرئيسي لسه فيه hash/salt قديمة، ننظفها احتياطاً
          if (data.passHash || data.passSalt) {
            await docSnap.ref.update({
              passHash: admin.firestore.FieldValue.delete(),
              passSalt: admin.firestore.FieldValue.delete(),
            });
          }
          continue;
        }

        if (!data.passHash || !data.passSalt) {
          // حساب بدون كلمة مرور مسجّلة أصلاً (حالة نادرة/بيانات غير مكتملة) — نتجاوزه
          skippedNoPassword++;
          continue;
        }

        // النقل الفعلي: كتابة بالمكان الجديد، ثم حذف من المكان القديم
        await authRef.set({ passHash: data.passHash, passSalt: data.passSalt });
        await docSnap.ref.update({
          passHash: admin.firestore.FieldValue.delete(),
          passSalt: admin.firestore.FieldValue.delete(),
        });
        migrated++;
      } catch (e) {
        errors.push({ phone, error: e.message });
      }
    }

    res.status(200).json({
      ok: true,
      totalStudents: snap.size,
      migratedNow: migrated,
      alreadyMigratedOrNew: alreadyDone,
      skippedNoPassword,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: "فشل الترحيل: " + e.message });
  }
};
