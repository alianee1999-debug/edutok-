import React, { useState } from "react";

// === كائن الستايلات الشامل والمطابق للصور بدقة عالية ===
const styles = {
  container: {
    width: "100%",
    maxWidth: "420px",
    minHeight: "100vh",
    backgroundColor: "#09090b", // اللون الأسود الداكن جداً كما في الصور
    color: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    direction: "rtl",
    margin: "0 auto",
    paddingBottom: "80px", // مساحة لشريط التنقل السفلي
    position: "relative",
    boxSizing: "border-box"
  },
  // الهيدر العلوي الثابت الصغير للتطبيق
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
    gap: "8px"
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
  // شريط التبويب العلوي داخل قسم الإدارة
  topTabsContainer: {
    display: "flex",
    gap: "8px",
    padding: "12px 16px",
    overflowX: "auto",
    borderBottom: "1px solid rgba(255,255,255,0.05)"
  },
  topTabButton: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#fff"
  },
  
  // === ستايلات الواجهة الرئيسية (واجهة عرض الفيديو - تيك توك التعليمي) ===
  videoWrapper: {
    position: "relative",
    width: "calc(100% - 32px)",
    height: "500px",
    margin: "16px auto",
    borderRadius: "24px",
    border: "2px solid #1e293b",
    background: "linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  playButtonCenter: {
    width: "90px",
    height: "90px",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    border: "2px solid rgba(255, 255, 255, 0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(0,0,0,0.4)"
  },
  playIconInner: {
    width: "0",
    height: "0",
    borderTop: "15px solid transparent",
    borderBottom: "15px solid transparent",
    borderLeft: "25px solid #fff",
    marginRight: "-8px"
  },
  // القائمة الجانبية العائمة المستديرة
  sidebarActions: {
    position: "absolute",
    left: "16px",
    top: "15%",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    zIndex: 10
  },
  sidebarCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer"
  },
  sidebarCircleText: {
    fontSize: "9px",
    color: "#a1a1aa",
    marginTop: "2px"
  },
  // معلومات الفيديو بالأسفل
  videoInfoContainer: {
    padding: "0 24px",
    marginTop: "-10px"
  },
  videoTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    marginBottom: "6px"
  },
  videoTitleText: {
    fontSize: "22px",
    fontWeight: "bold",
    margin: 0
  },
  badgeTeacher: {
    backgroundColor: "rgba(14, 116, 144, 0.4)",
    border: "1px solid #0e7490",
    color: "#22d3ee",
    padding: "2px 10px",
    borderRadius: "8px",
    fontSize: "12px"
  },
  badgeTime: {
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#a1a1aa",
    padding: "2px 8px",
    borderRadius: "8px",
    fontSize: "12px"
  },
  teacherDetailText: {
    fontSize: "14px",
    color: "#cbd5e1",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },

  // === ستايلات لوحة الإدارة ===
  contentSection: {
    padding: "16px"
  },
  sectionMainTitle: {
    fontSize: "16px",
    color: "#38bdf8",
    textAlign: "center",
    margin: "20px 0 15px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    paddingBottom: "8px"
  },
  priceRowCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
    padding: "12px 16px",
    borderRadius: "16px",
    marginBottom: "10px",
    border: "1px solid rgba(255,255,255,0.02)"
  },
  priceLabel: {
    fontSize: "15px",
    color: "#e4e4e7"
  },
  priceInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#09090b",
    padding: "6px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    width: "60%"
  },
  priceInput: {
    width: "100%",
    background: "none",
    border: "none",
    color: "#fff",
    textAlign: "center",
    fontSize: "15px",
    outline: "none"
  },
  currencyText: {
    color: "#71717a",
    fontSize: "13px"
  },

  // واجهة الإشعارات
  alertBanner: {
    backgroundColor: "rgba(8, 47, 73, 0.5)",
    border: "1px solid #0369a1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "13px",
    color: "#38bdf8",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  gridTemplates: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "25px"
  },
  templateCard: {
    backgroundColor: "#18181b",
    padding: "16px",
    borderRadius: "14px",
    textAlign: "center",
    fontSize: "14px",
    color: "#e4e4e7",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.03)"
  },
  formLabel: {
    display: "block",
    fontSize: "14px",
    color: "#a1a1aa",
    marginBottom: "8px",
    marginRight: "4px"
  },
  inputFieldBlock: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#18181b",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    marginBottom: "20px",
    boxSizing: "border-box"
  },
  largeGradientBtn: {
    width: "100%",
    padding: "16px",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(to right, #f97316, #ef4444)", // تدرج برتقالي أحمر ناري كما بالصورة
    color: "#fff",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px"
  },

  // واجهة إعدادات المدير
  adminInfoBox: {
    backgroundColor: "#1c1917", // البني الداكن جداً المطابق تماماً
    border: "1px dashed rgba(234, 179, 8, 0.4)",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "24px"
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px"
  },
  blueActionButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "24px"
  },
  redActionButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "24px"
  },

  // واجهة الإحصائيات بالأسفل
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "12px"
  },
  statCard: {
    backgroundColor: "#18181b",
    padding: "20px 12px",
    borderRadius: "16px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.03)"
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: "900",
    color: "#a855f7", // البنفسجي الجميل للأرقام
    margin: "8px 0 4px 0"
  },

  // === شطار التنقل السفلي الثابت (الأساسي للتطبيق) ===
  bottomNavbar: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: "420px",
    height: "68px",
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
    padding: "4px 12px"
  },
  navIcon: {
    fontSize: "20px",
    marginBottom: "3px"
  },
  navText: {
    fontSize: "12px",
    fontWeight: "bold"
  }
};

export default function App() {
  // شريط التنقل السفلي: 'home' أو 'account' أو 'admin'
  const [currentScreen, setCurrentScreen] = useState("home");
  
  // شريط التنقل العلوي داخل لوحة الإدارة: 'prices' أو 'notifications' || 'settings'
  const [adminTab, setAdminTab] = useState("prices");

  return (
    <div style={styles.container}>
      
      {/* الهيدر العلوي المشترك للتطبيق */}
      <div style={styles.header}>
        <div style={styles.logoContainer}>
          <span style={{ fontSize: "24px" }}>📚</span>
          <div>
            <span style={styles.logoText}>EduTok</span>
            <span style={styles.logoSubtext}>التعلم بطريقة ممتعة</span>
          </div>
        </div>
        <button 
          style={{
            backgroundColor: "#f97316", 
            color: "#fff", 
            border: "none", 
            padding: "6px 14px", 
            borderRadius: "20px", 
            fontSize: "12px", 
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
          onClick={() => setCurrentScreen("admin")}
        >
          ⚙️ إدارة
        </button>
      </div>

      {/* ==================== 1. الشاشة الرئيسية لـ المقطع (Home) ==================== */}
      {currentScreen === "home" && (
        <div>
          {/* حاوية وعارض المقطع */}
          <div style={styles.videoWrapper}>
            {/* القائمة الجانبية المستديرة العائمة */}
            <div style={styles.sidebarActions}>
              <div style={styles.sidebarCircle}><span style={{fontSize:"18px"}}>📌</span><span style={styles.sidebarCircleText}>حفظ</span></div>
              <div style={styles.sidebarCircle}><span style={{fontSize:"18px"}}>📥</span><span style={styles.sidebarCircleText}>مشاركة</span></div>
              <div style={styles.sidebarCircle}><span style={{fontSize:"18px"}}>🤖</span><span style={styles.sidebarCircleText}>مساعد</span></div>
              <div style={styles.sidebarCircle}><span style={{fontSize:"18px"}}>💬</span><span style={styles.sidebarCircleText}>طالب</span></div>
              <div style={styles.sidebarCircle}><span style={{fontSize:"16px"}}>•••</span><span style={styles.sidebarCircleText}>المزيد</span></div>
            </div>

            {/* زر تشغيل الفيديو المجسم */}
            <div style={styles.playButtonCenter}>
              <div style={{color: "#fff", fontWeight: "900", fontSize: "24px"}}>1234</div>
            </div>
          </div>

          {/* تفاصيل المقطع بالأسفل */}
          <div style={styles.videoInfoContainer}>
            <div style={styles.videoTitleRow}>
              <h2 style={styles.videoTitleText}>مقدمة في الجبر</h2>
              <span style={styles.badgeTeacher}>معلم</span>
              <span style={styles.badgeTime}>2:30 ⏱️</span>
            </div>
            <p style={styles.teacherDetailText}>
              <span>👨‍🏫</span> أ. أحمد • الرياضيات • الابتدائية / الرابع
            </p>
          </div>
        </div>
      )}

      {/* ==================== 2. لوحة الإدارة الشاملة (Admin) ==================== */}
      {currentScreen === "admin" && (
        <div>
          {/* التبويبات العلوية للإدارة */}
          <div style={styles.topTabsContainer}>
            <button 
              style={{...styles.topTabButton, backgroundColor: adminTab === "prices" ? "#f97316" : "#27272a"}}
              onClick={() => setAdminTab("prices")}
            >
              💰 الأسعار
            </button>
            <button 
              style={{...styles.topTabButton, backgroundColor: adminTab === "notifications" ? "#f97316" : "#27272a"}}
              onClick={() => setAdminTab("notifications")}
            >
              🔔 إشعارات
            </button>
            <button 
              style={{...styles.topTabButton, backgroundColor: adminTab === "settings" ? "#f97316" : "#27272a"}}
              onClick={() => setAdminTab("settings")}
            >
              ⚙️ الإعدادات
            </button>
            <button style={{...styles.topTabButton, backgroundColor: "#27272a"}}>✨ شرائح</button>
            <button style={{...styles.topTabButton, backgroundColor: "#27272a"}}>🎬 المقاطع</button>
          </div>

          <div style={styles.contentSection}>
            
            {/* تبويب الأسعار المخصصة للمواد والمراحل */}
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

                <div style={styles.sectionMainTitle}>📚 اللغة العربية</div>
                <div style={styles.priceRowCard}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" placeholder="حدد السعر" style={styles.priceInput} />
                    <span style={styles.currencyText}>د.ع</span>
                  </div>
                </div>
              </div>
            )}

            {/* تبويب الإشعارات وإرسال الرسائل */}
            {adminTab === "notifications" && (
              <div>
                <div style={styles.alertBanner}>
                  <span>🔔</span> الإشعارات تُرسل لجميع الطلاب المسجلين في التطبيق.
                </div>
                
                <div style={{fontSize: "14px", color: "#a1a1aa", marginBottom: "10px"}}>قوالب جاهزة</div>
                <div style={styles.gridTemplates}>
                  <div style={styles.templateCard}>انتهاء الاشتراك</div>
                  <div style={styles.templateCard}>مقطع جديد</div>
                  <div style={styles.templateCard}>تذكر بالدراسة</div>
                  <div style={styles.templateCard}>عرض خاص</div>
                </div>

                <label style={styles.formLabel}>عنوان الإشعار</label>
                <input type="text" placeholder="مثال: انتهاء اشتراك الرياضيات" style={styles.inputFieldBlock} />

                <label style={styles.formLabel}>نص الإشعار</label>
                <textarea rows="3" placeholder="اكتب نص الإشعار هنا..." style={styles.inputFieldBlock}></textarea>

                <button style={styles.largeGradientBtn}>
                  🔔 إرسال الإشعار لجميع الطلاب
                </button>
              </div>
            )}

            {/* تبويب إعدادات المدير الحالية وتحديث الأمان */}
            {adminTab === "settings" && (
              <div>
                <div style={styles.adminInfoBox}>
                  <div style={{color: "#eab308", fontWeight: "bold", fontSize: "15px", marginBottom: "12px"}}>👑 بيانات المدير الحالية</div>
                  <div style={styles.infoRow}>
                    <span style={{color: "#a1a1aa"}}>📱 رقم الهاتف:</span>
                    <span style={{fontWeight: "bold", letterSpacing: "1px"}}>07700000000</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={{color: "#a1a1aa"}}>🔑 كلمة المرور:</span>
                    <span style={{letterSpacing: "2px"}}>••••••••</span>
                  </div>
                </div>

                <div style={{borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "15px"}}>
                  <label style={styles.formLabel}>📱 تغيير رقم الهاتف</label>
                  <input type="text" placeholder="07XX XXX XXXX" style={styles.inputFieldBlock} />
                  <button style={styles.blueActionButton}>تغيير رقم الهاتف</button>

                  <label style={styles.formLabel}>🔑 تغيير كلمة المرور</label>
                  <input type="password" placeholder="كلمة المرور الجديدة" style={styles.inputFieldBlock} />
                  <button style={styles.redActionButton}>تغيير كلمة المرور</button>
                </div>

                {/* قسم الإحصائيات الفورية الملحق بالأسفل */}
                <div style={{marginTop: "30px"}}>
                  <div style={{fontSize: "16px", color: "#fff", display: "flex", alignItems: "center", gap: "6px"}}>📊 إحصائيات المنصة</div>
                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🎬</span>
                      <div style={styles.statNumber}>5</div>
                      <div style={{fontSize: "12px", color: "#a1a1aa"}}>المقاطع</div>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🔐</span>
                      <div style={styles.statNumber}>2</div>
                      <div style={{fontSize: "12px", color: "#a1a1aa"}}>المدفوعة</div>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>🔓</span>
                      <div style={styles.statNumber}>3</div>
                      <div style={{fontSize: "12px", color: "#a1a1aa"}}>غير المدفوعة</div>
                    </div>
                    <div style={styles.statCard}>
                      <span style={{fontSize: "20px"}}>💰</span>
                      <div style={{...styles.statNumber, color: "#22d3ee"}}>٠</div>
                      <div style={{fontSize: "12px", color: "#a1a1aa"}}>الأرباح</div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== 3. شاشة حسابي الاحتياطية (Account) ==================== */}
      {currentScreen === "account" && (
        <div style={{padding: "40px 20px", textAlign: "center"}}>
          <span style={{fontSize: "60px"}}>👤</span>
          <h3>ملف الطالب الشخصي</h3>
          <p style={{color: "#a1a1aa", fontSize: "14px"}}>هنا يتم عرض تفاصيل اشتراكات ومراحل الطالب الدراسية.</p>
        </div>
      )}

      {/* === شريط التنقل السفلي الثابت للتحكم بكامل التطبيق === */}
      <div style={styles.bottomNavbar}>
        <button 
          style={{...styles.navItem, color: currentScreen === "admin" ? "#38bdf8" : "#71717a"}} 
          onClick={() => setCurrentScreen("admin")}
        >
          <span style={styles.navIcon}>⚙️</span>
          <span style={styles.navText}>إدارة</span>
        </button>
        
        <button 
          style={{...styles.navItem, color: currentScreen === "account" ? "#38bdf8" : "#71717a"}} 
          onClick={() => setCurrentScreen("account")}
        >
          <span style={styles.navIcon}>👤</span>
          <span style={styles.navText}>حسابي</span>
        </button>

        <button 
          style={{...styles.navItem, color: currentScreen === "home" ? "#38bdf8" : "#71717a"}} 
          onClick={() => setCurrentScreen("home")}
        >
          <span style={styles.navIcon}>🏠</span>
          <span style={styles.navText}>الرئيسية</span>
        </button>
      </div>

    </div>
  );
}
