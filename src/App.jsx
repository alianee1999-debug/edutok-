import React, { useState } from "react";

export default function App() {
  // الحالات البرمجية للتنقل والواجهات
  const [isLoggedIn, setIsLoggedIn] = useState(true); // مفعّل افتراضياً للمعاينة المباشرة
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState("إدارة"); // تبويب الإدارة نشط بحسب الصور
  const [adminSubTab, setAdminSubTab] = useState("الأسعار"); // المقاطع، شرائح، الطلاب، الأسعار، إشعارات، الإعدادات
  
  // حالات نموذج إضافة مقطع فيديو
  const [stage, setStage] = useState("الابتدائية");
  const [grade, setGrade] = useState("الأول");
  const [subject, setSubject] = useState("الرياضيات");
  const [semester, setSemester] = useState("الأول");
  const [videoType, setVideoType] = useState("معلم 👨‍🏫");
  const [videoNumber, setVideoNumber] = useState("01");
  const [videoTitle, setVideoTitle] = useState("");
  const [teacherName, setTeacherName] = useState("أ. محمد");
  const [videoUrl, setVideoUrl] = useState("");

  // حالات لوحة استوديو الشرائح
  const [slideTopic, setSlideTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [slideTheme, setSlideTheme] = useState("أزرق متدرج");

  // حالات واجهة الإشعارات الجديدة (بناءً على الصور)
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");

  // حالات واجهة الأسعار (بناءً على الصور)
  const [prices, setPrices] = useState({
    math_sub: "", math_mid: "", math_high: "",
    science_sub: "", science_mid: "", science_high: "",
    arabic_sub: "", arabic_mid: "", arabic_high: ""
  });

  // حالات واجهة الإعدادات (بناءً على الصور)
  const [adminPhone, setAdminPhone] = useState("07700000000");
  const [adminPassword, setAdminPassword] = useState("••••••••");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handlePriceChange = (field, value) => {
    setPrices(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectTemplate = (title, body) => {
    setNotificationTitle(title);
    setNotificationBody(body);
  };

  // واجهة الترحيب والبدء
  if (!isLoggedIn && !showRegister) {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeBox}>
          <div style={styles.logoContainer}><span style={{ fontSize: "64px" }}>📚</span></div>
          <h1 style={styles.brandName}>EduTok</h1>
          <p style={styles.brandSubtitle}>التعلم بطريقة ممتعة 🎓</p>
          <button style={styles.primaryButton} onClick={() => setShowRegister(true)}>إنشاء حساب جديد</button>
          <button style={styles.secondaryButton} onClick={() => setIsLoggedIn(true)}>لدي حساب – تسجيل الدخول</button>
        </div>
      </div>
    );
  }

  // واجهة تسجيل الدخول
  if (!isLoggedIn && showRegister) {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeBox}>
          <span style={{ fontSize: "50px" }}>🔐</span>
          <h2 style={styles.pageTitle}>تسجيل الدخول</h2>
          <form onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>رقم الهاتف</label>
              <input type="text" placeholder="07XX XXX XXXX" style={styles.input} required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>كلمة المرور</label>
              <input type="password" placeholder="كلمة المرور" style={styles.input} required />
            </div>
            <button type="submit" style={styles.primaryButton}>دخول ←</button>
          </form>
          <p style={styles.switchText}>ليس لديك حساب؟ <span style={styles.link} onClick={() => setShowRegister(false)}>سجل الآن</span></p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={styles.mainContent}>
        
        {/* 1. تبويب الرئيسية */}
        {activeTab === "الرئيسية" && (
          <div style={styles.videoTabContainer}>
            <div style={styles.topHeader}>
              <button style={styles.orangeAdminBadge} onClick={() => setActiveTab("إدارة")}>⚙️ إدارة</button>
              <div style={styles.topBrandBox}>
                <h2 style={styles.topBrandText}>EduTok</h2>
                <small style={styles.topBrandSub}>التعلم بطريقة ممتعة</small>
              </div>
              <span style={{ fontSize: "24px" }}>📚</span>
            </div>
            <div style={styles.videoPlayerCard}>
              <div style={styles.videoPlaceholder}>
                <div style={styles.playButtonOutline}><span style={{ fontSize: "30px", color: "#fff", marginRight: "-4px" }}>▶</span></div>
                <div style={styles.sideButtonsContainer}>
                  <div style={styles.sideButton}><span>📌</span><small style={styles.sideButtonText}>حفظ</small></div>
                  <div style={styles.sideButton}><span>📤</span><small style={styles.sideButtonText}>مشاركة</small></div>
                  <div style={styles.sideButton}><span>🤖</span><small style={styles.sideButtonText}>مساعد</small></div>
                </div>
                <div style={styles.videoDetailsOverlay}>
                  <h3 style={styles.videoTitleText}>مقدمة في الجبر</h3>
                  <p style={styles.videoMetaText}>👨‍🏫 أ. أحمد • الرياضيات • الرابع</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. تبويب حسابي */}
        {activeTab === "حسابي" && (
          <div style={styles.tabContentContainer}>
            <h2 style={styles.sectionTitle}>الملف الشخصي</h2>
            <div style={styles.card}>
              <div style={styles.avatarPlaceholder}>👤</div>
              <h3 style={{ textAlign: "center", margin: "10px 0", color: "#fff" }}>طالب تجريبي</h3>
              <p style={{ textAlign: "center", color: "#a1a1aa" }}>07700000000</p>
            </div>
          </div>
        )}

        {/* 3. تبويب لوحة الإدارة */}
        {activeTab === "إدارة" && (
          <div style={styles.tabContentContainer}>
            <div style={styles.adminHeader}>
              <button style={styles.orangeAdminBadge}>⚙️ إدارة</button>
              <div style={styles.topBrandBox}>
                <h2 style={styles.topBrandText}>EduTok</h2>
                <small style={styles.topBrandSub}>التعلم بطريقة ممتعة</small>
              </div>
              <span style={{ fontSize: "24px" }}>📚</span>
            </div>

            {/* أزرار التحكم العلوية الفرعية */}
            <div style={styles.adminGridNav}>
              <button onClick={() => setAdminSubTab("المقاطع")} style={{...styles.gridButton, background: adminSubTab === "المقاطع" ? "linear-gradient(to right, #f97316, #ef4444)" : "#1e1e20"}}>🎬 المقاطع</button>
              <button onClick={() => setAdminSubTab("شرائح")} style={{...styles.gridButton, background: adminSubTab === "شرائح" ? "linear-gradient(to right, #ec4899, #f43f5e)" : "#1e1e20"}}>✨ شرائح</button>
              <button onClick={() => setAdminSubTab("الطلاب")} style={{...styles.gridButton, background: adminSubTab === "الطلاب" ? "linear-gradient(to right, #3b82f6, #06b6d4)" : "#1e1e20"}}>👥 الطلاب</button>
              <button onClick={() => setAdminSubTab("الأسعار")} style={{...styles.gridButton, background: adminSubTab === "الأسعار" ? "linear-gradient(to right, #eab308, #f97316)" : "#1e1e20"}}>💰 الأسعار</button>
              <button onClick={() => setAdminSubTab("إشعارات")} style={{...styles.gridButton, background: adminSubTab === "إشعارات" ? "linear-gradient(to right, #f97316, #ef4444)" : "#1e1e20"}}>🔔 إشعارات</button>
              <button onClick={() => setAdminSubTab("الإعدادات")} style={{...styles.gridButton, background: adminSubTab === "الإعدادات" ? "linear-gradient(to right, #f97316, #ef4444)" : "#1e1e20"}}>⚙️ الإعدادات</button>
            </div>

            {/* أ) واجهة إدارة المقاطع */}
            {adminSubTab === "المقاطع" && (
              <div style={styles.adminFormCard}>
                <h3 style={styles.formSectionTitle}>📋 بيانات المقطع</h3>
                <div style={styles.row}>
                  <div style={styles.flexItem}>
                    <label style={styles.fieldLabel}>المرحلة</label>
                    <select value={stage} onChange={(e) => setStage(e.target.value)} style={styles.select}>
                      <option>الابتدائية</option><option>المتوسطة</option><option>الإعدادية</option>
                    </select>
                  </div>
                </div>
                <div style={styles.inputGroupFull}>
                  <label style={styles.fieldLabel}>العنوان</label>
                  <input type="text" placeholder="عنوان المقطع" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} style={styles.adminInput} />
                </div>
                <button style={styles.saveBtn}>✓ حفظ المقطع</button>
              </div>
            )}

            {/* ب) واجهة استوديو الشرائح */}
            {adminSubTab === "شرائح" && (
              <div style={styles.adminFormCard}>
                <div style={styles.slideStudioBanner}>
                  <h3 style={{ color: "#ec4899", margin: 0 }}>استوديو الشرائح الذكي</h3>
                </div>
                <textarea placeholder="موضوع الشرائح..." value={slideTopic} onChange={(e) => setSlideTopic(e.target.value)} style={{...styles.adminInput, marginTop: "15px", height: "80px"}} />
                <button style={{...styles.saveBtn, background: "linear-gradient(to right, #ec4899, #f43f5e)", marginTop: "10px"}}>✨ توليد</button>
              </div>
            )}

            {/* ج) واجهة إدارة الطلاب */}
            {adminSubTab === "الطلاب" && (
              <div style={styles.adminFormCard}>
                <h3 style={styles.formSectionTitle}>👥 الطلاب النشطين</h3>
                <p style={{ color: "#a1a1aa" }}>قائمة الطلاب والاشتراكات الحالية تظهر هنا.</p>
              </div>
            )}

            {/* د) واجهة الأسعار الجديدة (تطابق الصورة 1 تماماً) */}
            {adminSubTab === "الأسعار" && (
              <div style={styles.adminFormCard}>
                {/* قسم الرياضيات */}
                <div style={styles.subjectDivider}>📚 الرياضيات</div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.math_sub} onChange={(e) => handlePriceChange('math_sub', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>متوسطة</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.math_mid} onChange={(e) => handlePriceChange('math_mid', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>إعدادية</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.math_high} onChange={(e) => handlePriceChange('math_high', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>

                {/* قسم العلوم */}
                <div style={styles.subjectDivider}>📚 العلوم</div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.science_sub} onChange={(e) => handlePriceChange('science_sub', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>متوسطة</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.science_mid} onChange={(e) => handlePriceChange('science_mid', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>إعدادية</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.science_high} onChange={(e) => handlePriceChange('science_high', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>

                {/* قسم اللغة العربية */}
                <div style={styles.subjectDivider}>📚 اللغة العربية</div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>ابتدائي</span>
                  <div style={styles.priceInputWrapper}>
                    <input type="text" value={prices.arabic_sub} onChange={(e) => handlePriceChange('arabic_sub', e.target.value)} style={styles.priceInput} placeholder="•" />
                    <span style={styles.currencyLabel}>د.ع</span>
                  </div>
                </div>
              </div>
            )}

            {/* هـ) واجهة الإشعارات (تطابق الصورتين 2 و 3 تماماً) */}
            {adminSubTab === "إشعارات" && (
              <div style={styles.adminFormCard}>
                <div style={styles.notificationAlert}>
                  🔔 الإشعارات تُرسل لجميع الطلاب المسجلين في التطبيق
                </div>
                
                <label style={styles.fieldLabel}>قوالب جاهزة</label>
                <div style={styles.gridTemplates}>
                  <button onClick={() => handleSelectTemplate("انتهى الاشتراك", "عزيزي الطالب، نود إعلامك بأن اشتراكك قد شارف على الانتهاء...")} style={styles.templateBtn}>انتهاء الاشتراك</button>
                  <button onClick={() => handleSelectTemplate("مقطع جديد واصلك", "تم إضافة درس جديد وممتع في قائمة دروسك، تفقده الآن!")} style={styles.templateBtn}>مقطع جديد</button>
                  <button onClick={() => handleSelectTemplate("تذكير بالدراسة اليومية", "حان وقت التعلم اليومي! خصص 10 دقائق من وقتك الآن.")} style={styles.templateBtn}>تذكير بالدراسة</button>
                  <button onClick={() => handleSelectTemplate("عرض خاص ومميز", "احصل على خصم لفترة محدودة عند تجديد الاشتراك الفصلي!")} style={styles.templateBtn}>عرض خاص</button>
                </div>

                <div style={{ marginTop: "15px" }}>
                  <label style={styles.fieldLabel}>عنوان الإشعار</label>
                  <input 
                    type="text" 
                    placeholder="مثال: انتهاء اشتراك الرياضيات" 
                    value={notificationTitle} 
                    onChange={(e) => setNotificationTitle(e.target.value)} 
                    style={styles.adminInput} 
                  />
                </div>

                <div style={{ marginTop: "15px" }}>
                  <label style={styles.fieldLabel}>نص الإشعار</label>
                  <textarea 
                    placeholder="اكتب نص الإشعار هنا..." 
                    value={notificationBody} 
                    onChange={(e) => setNotificationBody(e.target.value)} 
                    style={{...styles.adminInput, height: "100px", resize: "none"}} 
                  />
                </div>

                <button style={styles.sendNotificationBtn} onClick={() => alert('تم إرسال الإشعار بنجاح!')}>
                  🔔 إرسال الإشعار لجميع الطلاب
                </button>
              </div>
            )}

            {/* و) واجهة الإعدادات والإحصائيات (تطابق الصورتين 4 و 5 تماماً) */}
            {adminSubTab === "الإعدادات" && (
              <div style={styles.adminFormCard}>
                <div style={styles.adminInfoBox}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#eab308" }}>👑 بيانات المدير الحالية</h4>
                  <div style={styles.infoRow}><span>📱 رقم الهاتف:</span> <strong>{adminPhone}</strong></div>
                  <div style={styles.infoRow}><span>🔑 كلمة المرور:</span> <strong>{adminPassword}</strong></div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <label style={{...styles.fieldLabel, color: "#06b6d4"}}>📱 تغيير رقم الهاتف</label>
                  <input type="text" placeholder="07XX XXX XXXX" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={styles.adminInput} />
                  <button style={{...styles.actionBtn, backgroundColor: "#06b6d4"}} onClick={() => { if(newPhone) { setAdminPhone(newPhone); setNewPhone(""); alert('تم تغيير الرقم بنجاح'); } }}>تغيير رقم الهاتف</button>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <label style={{...styles.fieldLabel, color: "#ef4444"}}>🔑 تغيير كلمة المرور</label>
                  <input type="password" placeholder="كلمة المرور الجديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={styles.adminInput} />
                  <button style={{...styles.actionBtn, backgroundColor: "#ef4444"}} onClick={() => { if(newPassword) { setAdminPassword("••••••••"); setNewPassword(""); alert('تم تغيير كلمة المرور بنجاح'); } }}>تغيير كلمة المرور</button>
                </div>

                {/* قسم الإحصائيات أسفل الإعدادات بحسب صورة 5 */}
                <div style={styles.subjectDivider}>📊 إحصائيات</div>
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <span style={{ fontSize: "24px" }}>🎬</span>
                    <h2 style={styles.statNumber}>5</h2>
                    <small style={styles.statLabel}>المقاطع</small>
                  </div>
                  <div style={styles.statCard}>
                    <span style={{ fontSize: "24px" }}>🔒</span>
                    <h2 style={styles.statNumber}>2</h2>
                    <small style={styles.statLabel}>المدفوعة</small>
                  </div>
                  <div style={styles.statCard}>
                    <span style={{ fontSize: "24px" }}>💰</span>
                    <h2 style={styles.statNumber}>0</h2>
                    <small style={styles.statLabel}>الأرباح</small>
                  </div>
                  <div style={styles.statCard}>
                    <span style={{ fontSize: "24px" }}>🔓</span>
                    <h2 style={styles.statNumber}>3</h2>
                    <small style={styles.statLabel}>المجانية</small>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* شريط التنقل السفلي الثابت */}
      <div style={styles.bottomNav}>
        <button onClick={() => setActiveTab("إدارة")} style={{...styles.navItem, color: activeTab === "إدارة" ? "#3b82f6" : "#a1a1aa"}}>
          <span style={{ fontSize: "22px" }}>⚙️</span>
          <small style={{ marginTop: "4px", fontWeight: activeTab === "إدارة" ? "bold" : "normal" }}>إدارة</small>
        </button>
        <button onClick={() => setActiveTab("حسابي")} style={{...styles.navItem, color: activeTab === "حسابي" ? "#3b82f6" : "#a1a1aa"}}>
          <span style={{ fontSize: "22px" }}>👤</span>
          <small style={{ marginTop: "4px" }}>حسابي</small>
        </button>
        <button onClick={() => setActiveTab("الرئيسية")} style={{...styles.navItem, color: activeTab === "الرئيسية" ? "#3b82f6" : "#a1a1aa"}}>
          <span style={{ fontSize: "22px" }}>🏠</span>
          <small style={{ marginTop: "4px" }}>الرئيسية</small>
        </button>
      </div>
    </div>
  );
}

// كائن الستايل المحدّث ليتطابق مع مظهر الصور بدقة عالية
const styles = {
  container: {
    display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh",
    backgroundColor: "#09090b", fontFamily: "system-ui, sans-serif", direction: "rtl", padding: "20px"
  },
  welcomeBox: {
    backgroundColor: "#18181b", padding: "40px 30px", borderRadius: "24px", width: "100%", maxWidth: "400px",
    textAlign: "center", border: "1px solid #27272a"
  },
  logoContainer: {
    width: "100px", height: "100px", backgroundColor: "#27272a", borderRadius: "50%",
    display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 20px auto"
  },
  brandName: { fontSize: "32px", color: "#fff", margin: "0 0 5px 0" },
  brandSubtitle: { color: "#a1a1aa", fontSize: "15px", margin: "0 0 30px 0" },
  primaryButton: {
    width: "100%", padding: "14px", borderRadius: "14px", border: "none",
    background: "linear-gradient(to right, #f97316, #ef4444)", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginBottom: "12px"
  },
  secondaryButton: {
    width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #3f3f46", backgroundColor: "transparent", color: "#e4e4e7", cursor: "pointer"
  },
  pageTitle: { color: "#fff", fontSize: "22px", marginBottom: "20px" },
  form: { textAlign: "right" },
  inputGroup: { marginBottom: "15px" },
  label: { display: "block", color: "#d4d4d8", fontSize: "14px", marginBottom: "6px" },
  input: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #3f3f46", backgroundColor: "#27272a", color: "#fff", boxSizing: "border-box", textAlign: "right" },
  switchText: { color: "#a1a1aa", fontSize: "14px", marginTop: "20px" },
  link: { color: "#f97316", cursor: "pointer", fontWeight: "bold" },
  
  appContainer: { backgroundColor: "#09090b", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", direction: "rtl" },
  mainContent: { flex: 1, paddingBottom: "90px", display: "flex", flexDirection: "column", alignItems: "center" },
  
  // الهيدر والتبويبات الفرعية المتطابقة مع الهوية البصرية بالصور
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "480px", padding: "10px 20px", boxSizing: "border-box" },
  topBrandBox: { textAlign: "center" },
  topBrandText: { color: "#06b6d4", margin: 0, fontSize: "22px", fontWeight: "bold" },
  topBrandSub: { color: "#71717a", fontSize: "11px" },
  orangeAdminBadge: { background: "linear-gradient(to right, #f97316, #ef4444)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" },
  
  adminGridNav: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", maxWidth: "450px", padding: "0 10px", marginBottom: "15px", boxSizing: "border-box" },
  gridButton: { color: "#fff", border: "none", padding: "12px 5px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" },
  adminFormCard: { backgroundColor: "#121214", borderRadius: "20px", padding: "20px", width: "100%", maxWidth: "430px", border: "1px solid #222", boxSizing: "border-box" },
  formSectionTitle: { color: "#fff", borderBottom: "1px solid #222", paddingBottom: "8px", marginBottom: "15px", fontSize: "16px" },
  
  // ستايل واجهة الأسعار (صورة 1)
  subjectDivider: { color: "#06b6d4", textAlign: "center", fontSize: "16px", fontWeight: "bold", margin: "20px 0 15px 0", borderTop: "1px dashed #27272a", paddingTop: "15px" },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#18181b", padding: "10px 15px", borderRadius: "14px", marginBottom: "10px", border: "1px solid #27272a" },
  priceLabel: { color: "#a1a1aa", fontSize: "14px" },
  priceInputWrapper: { display: "flex", alignItems: "center", backgroundColor: "#27272a", borderRadius: "10px", padding: "2px 10px", width: "120px", border: "1px solid #3f3f46" },
  priceInput: { background: "transparent", border: "none", color: "#fff", width: "100%", textAlign: "center", fontSize: "14px", outline: "none" },
  currencyLabel: { color: "#71717a", fontSize: "12px", marginRight: "5px" },

  // ستايل واجهة الإشعارات (صورة 2 و 3)
  notificationAlert: { backgroundColor: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.2)", color: "#a1a1aa", padding: "12px", borderRadius: "12px", fontSize: "13px", textAlign: "center", marginBottom: "15px" },
  gridTemplates: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" },
  templateBtn: { backgroundColor: "#18181b", border: "1px solid #27272a", color: "#fff", padding: "12px", borderRadius: "12px", cursor: "pointer", fontSize: "13px" },
  sendNotificationBtn: { width: "100%", padding: "15px", borderRadius: "14px", border: "none", background: "linear-gradient(to right, #f97316, #ef4444)", color: "#fff", fontSize: "15px", fontWeight: "bold", cursor: "pointer", marginTop: "15px" },

  // ستايل واجهة الإعدادات والإحصائيات (صورة 4 و 5)
  adminInfoBox: { backgroundColor: "#1c1917", border: "1px solid #78350f", borderRadius: "14px", padding: "15px", color: "#fff" },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "6px" },
  actionBtn: { width: "100%", padding: "12px", border: "none", borderRadius: "12px", color: "#fff", fontWeight: "bold", cursor: "pointer", marginTop: "8px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" },
  statCard: { backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "14px", padding: "15px", textAlign: "center" },
  statNumber: { color: "#a855f7", margin: "5px 0", fontSize: "24px" },
  statLabel: { color: "#71717a", fontSize: "12px" },

  // العناصر العامة والمقاطع والناف بار
  adminInput: { width: "100%", padding: "12px", borderRadius: "10px", backgroundColor: "#18181b", color: "#fff", border: "1px solid #27272a", boxSizing: "border-box" },
  row: { display: "flex", gap: "10px", marginBottom: "12px" },
  flexItem: { flex: 1 },
  fieldLabel: { display: "block", color: "#fff", fontSize: "14px", marginBottom: "8px" },
  select: { width: "100%", padding: "10px", borderRadius: "8px", backgroundColor: "#27272a", color: "#fff", border: "1px solid #3f3f46" },
  saveBtn: { width: "100%", padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#22c55e", color: "#fff", fontWeight: "bold", cursor: "pointer" },
  
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "75px", backgroundColor: "#09090b", borderTop: "1px solid #1c1c1e", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 100 },
  navItem: { background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", fontSize: "12px" },
  
  videoTabContainer: { width: "100%", maxWidth: "450px", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" },
  topHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px" },
  topBrandText: { color: "#fff", margin: 0, fontSize: "20px" },
  videoPlayerCard: { flex: 1, margin: "10px", borderRadius: "20px", overflow: "hidden", position: "relative" },
  videoPlaceholder: { width: "100%", height: "100%", background: "linear-gradient(45deg, #111, #222)", display: "flex", justifyContent: "center", alignItems: "center" },
  playButtonOutline: { width: "65px", height: "65px", borderRadius: "50%", backgroundColor: "rgba(249, 115, 22, 0.8)", display: "flex", justifyContent: "center", alignItems: "center" },
  sideButtonsContainer: { position: "absolute", left: "15px", bottom: "100px", display: "flex", flexDirection: "column", gap: "15px" },
  sideButton: { display: "flex", flexDirection: "column", alignItems: "center", color: "#fff" },
  sideButtonText: { fontSize: "11px", marginTop: "4px" },
  videoDetailsOverlay: { position: "absolute", bottom: 0, right: 0, left: 0, padding: "20px", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" },
  videoTitleText: { color: "#fff", margin: "0 0 5px 0" },
  videoMetaText: { color: "#d4d4d8", margin: 0, fontSize: "13px" }
};
