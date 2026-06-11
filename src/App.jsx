import React, { useState } from "react";

// === كائن الستايلات الشامل والمطابق للتصميم بدقة 100% ===
const styles = {
  container: {
    width: "100%",
    maxWidth: "420px",
    minHeight: "100vh",
    backgroundColor: "#09090b", 
    color: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    direction: "rtl",
    margin: "0 auto",
    paddingBottom: "80px", 
    position: "relative",
    boxSizing: "border-box",
    overflowX: "hidden"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)"
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer"
  },
  logoText: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#38bdf8"
  },
  logoSubtext: {
    fontSize: "10px",
    color: "#a1a1aa",
    display: "block"
  },
  topTabsScroll: {
    display: "flex",
    gap: "8px",
    padding: "12px 16px",
    overflowX: "auto",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    scrollbarWidth: "none"
  },
  topTabButton: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap",
    color: "#fff",
    transition: "all 0.2s"
  },
  videoWrapper: {
    position: "relative",
    width: "calc(100% - 32px)",
    height: "520px",
    margin: "16px auto",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, #111827 0%, #030712 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  playButtonCenter: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    fontSize: "28px",
    zIndex: 5
  },
  sidebarActions: {
    position: "absolute",
    right: "16px",
    top: "12%",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    zIndex: 10
  },
  sidebarCircle: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    color: "#fff",
    padding: 0
  },
  sidebarCircleText: {
    fontSize: "10px",
    color: "#cbd5e1",
    marginTop: "2px"
  },
  moreMenuHorizontal: {
    position: "absolute",
    bottom: "20px",
    left: "16px",
    right: "16px",
    backgroundColor: "rgba(24, 24, 27, 0.95)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    padding: "16px 12px",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.7)",
    backdropFilter: "blur(12px)"
  },
  moreMenuItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#fff",
    padding: "4px 8px"
  },
  videoInfoContainer: {
    padding: "0 20px",
    marginTop: "12px"
  },
  videoTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px"
  },
  videoTitleText: {
    fontSize: "20px",
    fontWeight: "bold",
    margin: 0
  },
  badgeTeacher: {
    backgroundColor: "rgba(14, 116, 144, 0.3)",
    border: "1px solid #0e7490",
    color: "#22d3ee",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "11px"
  },
  badgeTime: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#d1d5db",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "11px"
  },
  contentSection: {
    padding: "16px"
  },
  sectionMainTitle: {
    fontSize: "15px",
    color: "#38bdf8",
    textAlign: "center",
    margin: "16px 0 12px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px"
  },
  priceRowCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
    padding: "12px 16px",
    borderRadius: "14px",
    marginBottom: "10px",
    border: "1px solid rgba(255,255,255,0.03)"
  },
  priceLabel: {
    fontSize: "14px",
    color: "#e4e4e7"
  },
  priceInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#09090b",
    padding: "6px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    width: "55%"
  },
  priceInput: {
    width: "100%",
    background: "none",
    border: "none",
    color: "#fff",
    textAlign: "center",
    fontSize: "14px",
    outline: "none"
  },
  currencyText: {
    color: "#71717a",
    fontSize: "12px"
  },
  alertBanner: {
    backgroundColor: "rgba(8, 47, 73, 0.4)",
    border: "1px solid #0369a1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "13px",
    color: "#38bdf8",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  gridTemplates: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "20px"
  },
  templateCard: {
    backgroundColor: "#18181b",
    padding: "14px",
    borderRadius: "12px",
    textAlign: "center",
    fontSize: "13px",
    color: "#e4e4e7",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.03)"
  },
  formLabel: {
    display: "block",
    fontSize: "13px",
    color: "#a1a1aa",
    marginBottom: "6px",
    marginRight: "4px"
  },
  inputFieldBlock: {
    width: "100%",
    padding: "12px 14px",
    backgroundColor: "#18181b",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    marginBottom: "16px",
    boxSizing: "border-box",
    outline: "none"
  },
  largeGradientBtn: {
    width: "100%",
    padding: "15px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(to right, #f97316, #ef4444)", 
    color: "#fff",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px"
  },
  adminInfoBox: {
    backgroundColor: "#141417", 
    border: "1px solid rgba(234, 179, 8, 0.2)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "20px"
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px"
  },
  blueActionButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "20px"
  },
  redActionButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "20px"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "10px"
  },
  statCard: {
    backgroundColor: "#18181b",
    padding: "16px 12px",
    borderRadius: "14px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.02)"
  },
  statNumber: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#a855f7", 
    margin: "4px 0"
  },
  bottomNavbar: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: "420px",
    height: "64px",
    backgroundColor: "#09090b",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 100,
    boxSizing: "border-box"
  },
  navItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: "4px"
  },
  navIcon: {
    fontSize: "18px",
    marginBottom: "2px"
  },
  navText: {
    fontSize: "11px",
    fontWeight: "bold"
  },
  welcomeContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    minHeight: "85vh"
  },
  welcomeTitle: {
    fontSize: "36px",
    fontWeight: "900",
    background: "linear-gradient(to right, #38bdf8, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: "12px 0 4px 0"
  },
  primaryBtn: {
    width: "100%",
    padding: "15px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(to right, #0ea5e9, #a855f7)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "12px"
  },
  secondaryBtn: {
    width: "100%",
    padding: "15px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "#18181b",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer"
  },
  customPopupOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
    padding: "20px"
  },
  customPopupBox: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    width: "100%",
    maxWidth: "340px",
    color: "#000000",
    textAlign: "center",
    boxShadow: "0 20px 45px rgba(0,0,0,0.4)"
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("welcome");
  const [adminTab, setAdminTab] = useState("prices");
  
  // حالات تفاعلية للتحكم بواجهة المقطع والخيارات
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showVercelPopup, setShowVercelPopup] = useState(false);

  // إدارة نصوص الإشعارات المخصصة والقوالب الجاهزة
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");

  const applyTemplate = (type) => {
    if (type === "expire") {
      setNotifTitle("تنبيه انتهاء الاشتراك");
      setNotifBody("عزيزي الطالب، يرجى تجديد اشتراكك لضمان استمرار مراجعة الدروس.");
    } else if (type === "new_video") {
      setNotifTitle("تم رفع درس جديد سينال إعجابك!");
      setNotifBody("قام الأستاذ برفع مقطع تعليمي جديد في مادة الرياضيات الآن.");
    } else if (type === "remind") {
      setNotifTitle("حان وقت المذاكرة اليومية 📖");
      setNotifBody("لا تؤجل عمل اليوم إلى الغد، ادخل وراجع دروس ربع ساعة الآن.");
    } else if (type === "offer") {
      setNotifTitle("خصم خاص 50% لفترة محدودة");
      setNotifBody("اشترك الآن في باقة الفصل الدراسي الثاني بنصف السعر الثابت.");
    }
  };

  const handleVideoCenterClick = () => {
    setIsVideoPlaying(!isVideoPlaying);
    setShowVercelPopup(true);
  };

  return (
    <div style={styles.container}>
      
      {/* هيدر التطبيق العلوي - يختفي في بوابات التسجيل والترحيب لشاشة كاملة */}
      {currentScreen !== "welcome" && currentScreen !== "login" && (
        <div style={styles.header}>
          <div style={styles.logoContainer} onClick={() => setCurrentScreen("home")}>
            <img src="https://cdn-icons-png.flaticon.com/512/3429/3429159.png" alt="logo" style={{width: "28px", height: "28px"}} />
            <div>
              <span style={styles.logoText}>EduTok</span>
              <span style={styles.logoSubtext}>التعلم بطريقة ممتعة</span>
            </div>
          </div>
          <button 
            style={{
              background: "linear-gradient(to right, #f97316, #ef4444)",
              color: "#fff", border: "none", padding: "6px 14px", borderRadius: "20px", 
              fontSize: "12px", fontWeight: "bold", cursor: "pointer"
            }}
            onClick={() => setCurrentScreen("admin")}
          >
            ⚙️ إدارة
          </button>
        </div>
      )}

      {/* ==================== 1. شاشة الترحيب والفتح ==================== */}
      {currentScreen === "welcome" && (
        <div style={styles.welcomeContainer}>
          <img src="https://cdn-icons-png.flaticon.com/512/3429/3429159.png" alt="EduTok App" style={{width: "120px", height: "120px", marginBottom: "16px"}} />
          <h1 style={styles.welcomeTitle}>EduTok</h1>
          <p style={{color: "#a1a1aa", fontSize: "14px", marginBottom: "32px"}}>التعلم بطريقة ممتعة 🎓</p>
          
          <button style={styles.primaryBtn} onClick={() => setCurrentScreen("home")}>
            إنشاء حساب جديد
          </button>
          <button style={styles.secondaryBtn} onClick={() => setCurrentScreen("login")}>
            لدي حساب – تسجيل الدخول
          </button>
        </div>
      )}

      {/* ==================== 2. شاشة تسجيل الدخول ==================== */}
      {currentScreen === "login" && (
        <div style={{padding: "40px 24px"}}>
          <div style={{textAlign: "center", marginBottom: "32px"}}>
            <span style={{fontSize: "55px"}}>🔐</span>
            <h2 style={{fontSize: "24px", fontWeight: "bold", margin: "8px 0"}}>تسجيل الدخول</h2>
          </div>

          <label style={styles.formLabel}>رقم الهاتف</label>
          <input type="text" placeholder="07XX XXX XXXX" style={styles.inputFieldBlock} />

          <label style={styles.formLabel}>كلمة المرور</label>
          <input type="password" placeholder="كلمة المرور" style={styles.inputFieldBlock} />

          <button style={styles.primaryBtn} onClick={() => setCurrentScreen("home")}>
            دخول ←
          </button>

          <div style={{textAlign: "center", marginTop: "16px"}}>
            <span style={{color: "#a1a1aa", fontSize: "13px"}}>ليس لديك حساب؟ </span>
            <span style={{color: "#38bdf8", cursor: "pointer", fontWeight: "bold", fontSize: "13px"}} onClick={() => setCurrentScreen("welcome")}>سجل الآن</span>
          </div>

          {/* زر وصول سريع ومباشر للوحة تحكم المدير للأدمن */}
          <div 
            style={{
              marginTop: "30px", border: "1px dashed rgba(234, 179, 8, 0.35)", borderRadius: "14px", 
              padding: "12px", textAlign: "center", cursor: "pointer", backgroundColor: "rgba(234, 179, 8, 0.02)"
            }}
            onClick={() => setCurrentScreen("admin")}
          >
            <span style={{color: "#eab308", fontWeight: "bold", fontSize: "13px"}}>👑 لوحة تحكم المدير</span>
            <p style={{color: "#71717a", fontSize: "11px", margin: "4px 0 0 0"}}>الدخول السريع بحساب الإدارة العام للفحص</p>
          </div>
        </div>
      )}

      {/* ==================== 3. الواجهة الرئيسية (أسلوب تيك توك) ==================== */}
      {currentScreen === "home" && (
        <div>
          <div style={styles.videoWrapper}>
            
            {/* الأزرار العمودية الجانبية الحقيقية والذكية */}
            <div style={styles.sidebarActions}>
              <button 
                style={{
                  ...styles.sidebarCircle, 
                  backgroundColor: isSaved ? "rgba(34, 211, 238, 0.25)" : "rgba(15, 23, 42, 0.75)",
                  border: isSaved ? "1px solid #22d3ee" : "1px solid rgba(255, 255, 255, 0.1)"
                }} 
                onClick={() => setIsSaved(!isSaved)}
              >
                <span style={{fontSize:"16px", color: isSaved ? "#22d3ee" : "#fff"}}>📌</span>
                <span style={{...styles.sidebarCircleText, color: isSaved ? "#22d3ee" : "#cbd5e1"}}>
                  {isSaved ? "محفوظ" : "حفظ"}
                </span>
              </button>

              <button style={styles.sidebarCircle} onClick={() => alert("📥 تم نسخ رابط مشاركة المقطع التعليمي!")}>
                <span style={{fontSize:"16px"}}>📥</span>
                <span style={styles.sidebarCircleText}>مشاركة</span>
              </button>

              <button style={styles.sidebarCircle} onClick={() => alert("🤖 أهلاً بك! أنا مساعدك الذكي، اسألني أي سؤال حول محتوى هذا الدرس الدراسي.")}>
                <span style={{fontSize:"16px"}}>🤖</span>
                <span style={styles.sidebarCircleText}>مساعد</span>
              </button>

              <button style={styles.sidebarCircle} onClick={() => alert("💬 تم فتح غرف النقاش الجماعية لطلاب الصف لمراسلة بعضهم والمذاكرة معاً.")}>
                <span style={{fontSize:"16px"}}>💬</span>
                <span style={styles.sidebarCircleText}>طالب</span>
              </button>

              <button style={styles.sidebarCircle} onClick={() => setShowMoreMenu(!showMoreMenu)}>
                <span style={{fontSize:"14px", fontWeight: "bold"}}>•••</span>
                <span style={styles.sidebarCircleText}>المزيد</span>
              </button>
            </div>

            {/* الزر الزجاجي للتشغيل المركزي */}
            <div style={styles.playButtonCenter} onClick={handleVideoCenterClick}>
              {isVideoPlaying ? "⏸️" : "▶️"}
            </div>

            {/* القائمة الأفقية المنبثقة عند النقر على (المزيد •••) */}
            {showMoreMenu && (
              <div style={styles.moreMenuHorizontal}>
                <button style={styles.moreMenuItem} onClick={() => { alert("📄 فتح شاشة الملازم وتحميل الأبحاث وكتب الـ PDF المرفقة."); setShowMoreMenu(false); }}>
                  <span style={{fontSize: "22px"}}>📄</span>
                  <span style={{fontSize: "11px", marginTop: "4px"}}>الملفات PDF</span>
                </button>
                <button style={styles.moreMenuItem} onClick={() => { alert("📷 تشغيل الكاميرا لحل الأسئلة بالذكاء الاصطناعي فوراً."); setShowMoreMenu(false); }}>
                  <span style={{fontSize: "22px"}}>📷</span>
                  <span style={{fontSize: "11px", marginTop: "4px"}}>كاميرا الحل</span>
                </button>
                <button style={styles.moreMenuItem} onClick={() => { alert("🔍 فتح محرك البحث المتقدم عن المقاطع التعليمية."); setShowMoreMenu(false); }}>
                  <span style={{fontSize: "22px"}}>🔍</span>
                  <span style={{fontSize: "11px", marginTop: "4px"}}>البحث</span>
                </button>
                <button style={styles.moreMenuItem} onClick={() => { alert("📌 الانتقال لجميع عناصر المحفوظات والمفضلة لديك."); setShowMoreMenu(false); }}>
                  <span style={{fontSize: "22px"}}>📌</span>
                  <span style={{fontSize: "11px", marginTop: "4px"}}>المحفوظات</span>
                </button>
              </div>
            )}
          </div>

          {/* معلومات وبيانات الفيديو الإيضاحية الأسفل */}
          <div style={styles.videoInfoContainer}>
            <div style={styles.videoTitleRow}>
              <h2 style={styles.videoTitleText}>مقدمة في الجبر</h2>
              <span style={styles.badgeTeacher}>معلم</span>
              <span style={styles.badgeTime}>2:30 ⏱️</span>
            </div>
            <p style={{fontSize: "13px", color: "#cbd5e1", margin: 0, display: "flex", alignItems: "center", gap: "6px"}}>
              <span>👨‍🏫</span> أ. أحمد • الرياضيات • الابتدائية / الرابع
            </p>
          </div>
        </div>
      )}

      {/* ==================== 4. لوحة تحكم الإدارة الكاملة ==================== */}
      {currentScreen === "admin" && (
        <div>
          {/* شريط تبويبات السكرول العلوي للأدمن */}
          <div style={styles.topTabsScroll}>
            <button style={{...styles.topTabButton, backgroundColor: adminTab === "prices" ? "#f97316" : "#27272a"}} onClick={() => setAdminTab("prices")}>💰 الأسعار</button>
            <button style={{...styles.topTabButton, backgroundColor: adminTab === "notifications" ? "#f97316" : "#27272a"}} onClick={() => setAdminTab("notifications")}>🔔 إشعارات</button>
            <button style={{...styles.topTabButton, backgroundColor: adminTab === "settings" ? "#f97316" : "#27272a"}} onClick={() => setAdminTab("settings")}>⚙️ الإعدادات</button>
          </div>

          <div style={styles.contentSection}>
            
            {/* أ. تبويب جداول الأسعار حسب المراحل والمواد */}
            {adminTab === "prices" && (
              <div>
                <div style={styles.sectionMainTitle}>📚 العلوم</div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>متوسطة</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>إعدادية</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>

                <div style={{...styles.sectionMainTitle, marginTop: "20px"}}>📚 اللغة العربية</div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>متوسطة</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>إعدادية</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
              </div>
            )}

            {/* ب. تبويب بث الإشعارات المباشر والقوالب التلقائية */}
            {adminTab === "notifications" && (
              <div>
                <div style={styles.alertBanner}>
                  <span>🔔</span> الإشعارات تُرسل لجميع الطلاب المسجلين في التطبيق فوريًا.
                </div>
                
                <span style={styles.formLabel}>قوالب جاهزة</span>
                <div style={styles.gridTemplates}>
                  <div style={styles.templateCard} onClick={() => applyTemplate("expire")}>انتهاء الاشتراك</div>
                  <div style={styles.templateCard} onClick={() => applyTemplate("new_video")}>مقطع جديد</div>
                  <div style={styles.templateCard} onClick={() => applyTemplate("remind")}>تذكير بالدراسة</div>
                  <div style={styles.templateCard} onClick={() => applyTemplate("offer")}>عرض خاص</div>
                </div>

                <label style={styles.formLabel}>عنوان الإشعار</label>
                <input 
                  type="text" 
                  placeholder="مثال: انتهاء اشتراك الرياضيات" 
                  value={notifTitle} 
                  onChange={(e) => setNotifTitle(e.target.value)} 
                  style={styles.inputFieldBlock} 
                />

                <label style={styles.formLabel}>نص الإشعار</label>
                <textarea 
                  rows="3" 
                  placeholder="اكتب نص الإشعار هنا..." 
                  value={notifBody} 
                  onChange={(e) => setNotifBody(e.target.value)} 
                  style={styles.inputFieldBlock}
                ></textarea>

                <button style={styles.largeGradientBtn} onClick={() => alert(`🚀 تم بث الإشعار بنجاح لجميع الأجهزة والطلاب!`)}>
                  🔔 إرسال الإشعار لجميع الطلاب
                </button>
              </div>
            )}

            {/* ج. تبويب الإعدادات المتقدمة والإحصائيات */}
            {adminTab === "settings" && (
              <div>
                <div style={styles.adminInfoBox}>
                  <span style={{color: "#eab308", fontWeight: "bold", fontSize: "14px", display: "block", marginBottom: "12px"}}>👑 بيانات المدير الحالية</span>
                  <div style={styles.infoRow}>
                    <span style={{color: "#a1a1aa"}}>📱 رقم الهاتف:</span>
                    <span style={{fontWeight: "bold", letterSpacing: "1px"}}>07700000000</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={{color: "#a1a1aa"}}>🔑 كلمة المرور:</span>
                    <span style={{letterSpacing: "2px"}}>••••••••</span>
                  </div>
                </div>

                <span style={{...styles.formLabel, color: "#38bdf8", fontWeight: "bold"}}>📱 تغيير رقم الهاتف</span>
                <input type="text" placeholder="07XX XXX XXXX" style={styles.inputFieldBlock} />
                <button style={styles.blueActionButton} onClick={() => alert("💾 تم تحديث رقم هاتف المدير وحفظه.")}>تغيير رقم الهاتف</button>

                <span style={{...styles.formLabel, color: "#ef4444", fontWeight: "bold"}}>🔑 تغيير كلمة المرور</span>
                <input type="password" placeholder="كلمة المرور الجديدة" style={styles.inputFieldBlock} />
                <button style={styles.redActionButton} onClick={() => alert("🔐 تم تشفير وتغيير كلمة المرور بنجاح.")}>تغيير كلمة المرور</button>

                {/* مربعات الإحصائيات الأربعة الرسومية المطابقة للصور */}
                <div style={{marginTop: "24px"}}>
                  <span style={{fontSize: "14px", color: "#a855f7", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px"}}>
                    📊 إحصائيات المنصة
                  </span>
                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🎬</span>
                      <div style={styles.statNumber}>5</div>
                      <span style={{fontSize: "11px", color: "#71717a"}}>المقاطع</span>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🔐</span>
                      <div style={styles.statNumber}>2</div>
                      <span style={{fontSize: "11px", color: "#71717a"}}>المدفوعة</span>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🔓</span>
                      <div style={styles.statNumber}>3</div>
                      <span style={{fontSize: "11px", color: "#71717a"}}>المجانية</span>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>💰</span>
                      <div style={styles.statNumber}>٠</div>
                      <span style={{fontSize: "11px", color: "#71717a"}}>الأرباح د.ع</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 5. شاشة ملف الطالب الشخصي ==================== */}
      {currentScreen === "account" && (
        <div style={{padding: "40px 20px", textAlign: "center"}}>
          <div style={{width: "90px", height: "90px", borderRadius: "50%", backgroundColor: "#27272a", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 16px auto", fontSize: "45px"}}>
            👤
          </div>
          <h3 style={{fontSize: "18px", fontWeight: "bold"}}>ملف الطالب الشخصي</h3>
          <p style={{color: "#a1a1aa", fontSize: "13px", marginBottom: "32px"}}>مرحباً بك في واجهة حسابك الطلابي لمتابعة الاشتراكات</p>
          <button style={styles.redActionButton} onClick={() => setCurrentScreen("welcome")}>
            تسجيل الخروج
          </button>
        </div>
      )}

      {/* === شريط التنقل السفلي الثابت للواجهات الداخلية === */}
      {currentScreen !== "welcome" && currentScreen !== "login" && (
        <div style={styles.bottomNavbar}>
          <button style={{...styles.navItem, color: currentScreen === "admin" ? "#38bdf8" : "#71717a"}} onClick={() => setCurrentScreen("admin")}>
            <span style={styles.navIcon}>⚙️</span>
            <span style={styles.navText}>إدارة</span>
          </button>
          <button style={{...styles.navItem, color: currentScreen === "account" ? "#38bdf8" : "#71717a"}} onClick={() => setCurrentScreen("account")}>
            <span style={styles.navIcon}>👤</span>
            <span style={styles.navText}>حسابي</span>
          </button>
          <button style={{...styles.navItem, color: currentScreen === "home" ? "#38bdf8" : "#71717a"}} onClick={() => setCurrentScreen("home")}>
            <span style={styles.navIcon}>🏠</span>
            <span style={styles.navText}>الرئيسية</span>
          </button>
        </div>
      )}

      {/* ==================== النافذة المنبثقة المتطابقة والمطابقة لمتصفح Vercel ==================== */}
      {showVercelPopup && (
        <div style={styles.customPopupOverlay}>
          <div style={styles.customPopupBox}>
            <h3 style={{margin: "0 0 12px 0", fontSize: "17px", fontWeight: "bold"}}>يعرض موقع edutok-neon.vercel.app</h3>
            <p style={{fontSize: "14px", color: "#4b5563", lineHeight: "1.6", margin: "0 0 24px 0"}}>
              🎯 تم تشغيل أو إيقاف مقطع الفيديو التعليمي بنجاح!
            </p>
            <div style={{textAlign: "left"}}>
              <span 
                style={{color: "#2563eb", fontWeight: "bold", cursor: "pointer", fontSize: "15px", padding: "4px 8px"}} 
                onClick={() => setShowVercelPopup(false)}
              >
                حسنًا
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
