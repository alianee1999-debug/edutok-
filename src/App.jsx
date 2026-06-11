import React, { useState } from "react";

// كائن الستايل الجديد المحدث بالكامل ليتطابق مع الصور
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#09090b", // خلفية داكنة جداً (Deep Black)
    fontFamily: "system-ui, sans-serif",
    direction: "rtl", // لتفعيل التنسيق العربي
    padding: "20px"
  },
  welcomeBox: {
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
    color: "#fff" // لون النص الافتراضي أبيض
  },
  // ستايل الكتب المجسمة
  booksIconContainer: {
    marginBottom: "20px"
  },
  booksIcon: {
    fontSize: "90px" // حجم كبير وواضح
  },
  // اسم التطبيق بالألوان
  brandNameWelcome: {
    fontSize: "48px", // حجم كبير
    color: "#fff",
    margin: "0 0 10px 0",
    fontWeight: "900" // خط سميك جداً
  },
  // الشعار العربي مع القبعة
  brandSubtitleWelcome: {
    color: "#a1a1aa",
    fontSize: "16px",
    margin: "0 0 45px 0"
  },
  
  // ستايل أزرار واجهة الترحيب
  // الزر العريض المتدرج
  primaryGradientButton: {
    width: "100%",
    padding: "16px",
    borderRadius: "16px", // زوايا دائرية
    border: "none",
    background: "linear-gradient(to right, #22d3ee, #a855f7)", // تدرج من الأزرق السماوي للبنفسجي
    color: "#fff",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer",
    marginBottom: "15px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  // الزر الرمادي الشفاف مع البرواز
  secondaryOutlineButton: {
    width: "100%",
    padding: "16px",
    borderRadius: "16px",
    border: "2px solid #27272a", // برواز رمادي
    backgroundColor: "rgba(39, 39, 42, 0.4)", // خلفية رمادية شفافة
    color: "#e4e4e7",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer"
  },

  // === ستايلات واجهة تسجيل الدخول ===
  // أيقونة القفل والمفتاح
  lockIcon: {
    fontSize: "60px",
    marginBottom: "15px"
  },
  loginTitle: {
    fontSize: "30px",
    fontWeight: "800",
    marginBottom: "40px"
  },
  // حقول الإدخال الرمادية الأنيقة
  inputGroup: {
    marginBottom: "20px",
    textAlign: "right"
  },
  inputLabel: {
    display: "block",
    color: "#a1a1aa", // رمادي باهت
    fontSize: "14px",
    marginBottom: "8px"
  },
  stylishInput: {
    width: "100%",
    padding: "15px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.05)", // برواز شفاف جداً
    backgroundColor: "#18181b", // رمادي داكن (Jet Black)
    color: "#fff",
    boxSizing: "border-box",
    textAlign: "center", // جعل نص الـ Placeholder في المنتصف
    fontSize: "15px"
  },
  // زر الدخول المتدرج مع السهم
  loginGradientButton: {
    width: "100%",
    padding: "16px",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(to right, #22d3ee, #a855f7)",
    color: "#fff",
    fontSize: "18px",
    fontWeight: "800",
    cursor: "pointer",
    margin: "15px 0 25px 0",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  // رابط التسجيل الأزرق
  registerLink: {
    color: "#a1a1aa",
    fontSize: "14px",
    textAlign: "center"
  },
  registerAction: {
    color: "#38bdf8", // أزرق سماوي
    cursor: "pointer",
    fontWeight: "bold",
    marginRight: "5px"
  },
  // برواز دخول المدير
  adminLoginBoxWelcome: {
    marginTop: "40px",
    padding: "20px",
    borderRadius: "16px",
    backgroundColor: "#1c1917", // خلفية بنية داكنة جداً
    fontSize: "14px",
    border: "1px dashed rgba(234, 179, 8, 0.5)", // برواز متقطع ذهبي باهت
    color: "#d1d1d6"
  }
};

export default function App() {
  // الحالات البرمجية للتنقل (الحالات حقيقية للتنقل بين الواجهات)
  const [isLoggedIn, setIsLoggedIn] = useState(false); // هل المستخدم مسجل؟
  const [showRegister, setShowRegister] = useState(false); // هل نعرض واجهة تسجيل الدخول؟

  // محاكاة تسجيل الدخول بنجاح
  const handleLoginSuccess = (e) => {
    e.preventDefault();
    setIsLoggedIn(true);
  };

  // واجهة الترحيب والبدء (صفحة الدخول الأولى) - مطابقة للصورة الأولى
  if (!isLoggedIn && !showRegister) {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeBox}>
          {/* الكتب المجسمة */}
          <div style={styles.booksIconContainer}>
            <span style={styles.booksIcon}>📚</span>
          </div>
          
          {/* اسم التطبيق وشعاره */}
          <h1 style={styles.brandNameWelcome}>EduTok</h1>
          <p style={styles.brandSubtitleWelcome}>التعلم بطريقة ممتعة 🎓</p>
          
          {/* أزرار التنقل */}
          <button style={styles.primaryGradientButton} onClick={() => setShowRegister(true)}>
            إنشاء حساب جديد
          </button>
          <button style={styles.secondaryOutlineButton} onClick={() => setShowRegister(true)}>
            لدي حساب – تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // واجهة تسجيل الدخول - مطابقة للصورة الثانية والملحقة بها
  if (!isLoggedIn && showRegister) {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeBox}>
          {/* القفل والمفتاح */}
          <div style={styles.lockIcon}>🔐</div>
          <h2 style={styles.loginTitle}>تسجيل الدخول</h2>
          
          {/* نموذج تسجيل الدخول */}
          <form onSubmit={handleLoginSuccess}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>رقم الهاتف</label>
              <input type="text" placeholder="07XX XXX XXXX" style={styles.stylishInput} required />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>كلمة المرور</label>
              <input type="password" placeholder="كلمة المرور" style={styles.stylishInput} required />
            </div>
            
            {/* زر الدخول المتدرج مع السهم */}
            <button type="submit" style={styles.loginGradientButton}>دخول ←</button>
          </form>
          
          {/* رابط التسجيل الأزرق */}
          <p style={styles.registerLink}>
            ليس لديك حساب؟ <span style={styles.registerAction} onClick={() => setShowRegister(false)}>سجل الآن</span>
          </p>
          
          {/* برواز دخول المدير المدمج من الصور الأصلية */}
          <div style={styles.adminLoginBoxWelcome}>
            <span style={{ color: "#eab308", fontWeight: "bold" }}>👑 دخول المدير</span>
            <small style={{ color: "#a1a1aa", display: "block", marginTop: "5px" }}>
              استخدم رقم هاتف المدير وكلمة المرور الخاصة به
            </small>
          </div>
        </div>
      </div>
    );
  }

  // الواجهة الرئيسية للتطبيق (تظهر فقط عند تسجيل الدخول بنجاح)
  return (
    <div style={styles.container}>
      <div style={{...styles.welcomeBox, backgroundColor: "#18181b", padding: "40px", borderRadius: "20px", border: "1px solid #27272a"}}>
        <span style={{ fontSize: "50px" }}>✅</span>
        <h1 style={{color: "#38bdf8"}}>مبروك!</h1>
        <p style={{color: "#fff"}}>لقد قمت بتسجيل الدخول بنجاح إلى EduTok 🚀</p>
        <p style={{color: "#a1a1aa", fontSize: "14px", marginTop: "20px"}}>هنا ستظهر صفحة الفيديوهات والدروس.</p>
        <button style={{...styles.loginGradientButton, marginTop: "30px", fontSize: "16px"}} onClick={() => setIsLoggedIn(false)}>
          تسجيل الخروج (للمعاينة)
        </button>
      </div>
    </div>
  );
}
