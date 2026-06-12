import React, { useState } from "react";

// تعريف الستايلات الموحدة للتطبيق
const styles = {
  container: { backgroundColor: "#09090b", minHeight: "100vh", color: "#fff", padding: "20px", position: "relative" },
  
  // شريط التنقل العلوي
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  
  // الأزرار الجانبية (تم نقلها لليسار)
  sidebar: {
    position: "absolute",
    top: "120px",
    left: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    zIndex: 10,
  },
  sidebarCircle: { width: "45px", height: "45px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", border: "1px solid #3f3f46", cursor: "pointer" },
  
  // تبويبات الإدارة
  topTabsScroll: { display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px" },
  topTabButton: { padding: "8px 16px", borderRadius: "20px", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" },
  adminInfoBox: { backgroundColor: "#18181b", padding: "20px", borderRadius: "20px", border: "1px solid #27272a" },
  inputFieldBlock: { width: "100%", padding: "12px", borderRadius: "12px", background: "#27272a", border: "1px solid #3f3f46", color: "#fff", marginBottom: "10px" },
  blueActionButton: { backgroundColor: "#3b82f6", color: "#fff", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", width: "100%" }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("home"); // يمكنك تغييرها لـ "admin" للدخول للوحة الإدارة
  const [adminTab, setAdminTab] = useState("slides");

  return (
    <div style={styles.container}>
      
      {/* الشاشة الرئيسية تحتوي على الأزرار الجانبية في اليسار */}
      {currentScreen === "home" && (
        <div style={styles.sidebar}>
          <button style={styles.sidebarCircle}>📌</button>
          <button style={styles.sidebarCircle}>📤</button>
          <button style={styles.sidebarCircle}>🤖</button>
          <button style={styles.sidebarCircle} onClick={() => setCurrentScreen("admin")}>⚙️</button>
        </div>
      )}

      {/* لوحة الإدارة */}
      {currentScreen === "admin" && (
        <div>
          <button onClick={() => setCurrentScreen("home")} style={{marginBottom: "15px"}}>← عودة للرئيسية</button>
          <div style={styles.topTabsScroll}>
            <button onClick={() => setAdminTab("slides")} style={{...styles.topTabButton, backgroundColor: adminTab === "slides" ? "#f97316" : "#27272a"}}>✨ الشرائح</button>
            <button onClick={() => setAdminTab("videos")} style={{...styles.topTabButton, backgroundColor: adminTab === "videos" ? "#f97316" : "#27272a"}}>🎬 المقاطع</button>
            <button onClick={() => setAdminTab("prices")} style={{...styles.topTabButton, backgroundColor: adminTab === "prices" ? "#f97316" : "#27272a"}}>💰 الأسعار</button>
          </div>

          <div style={styles.adminInfoBox}>
            {adminTab === "slides" && (
              <div>
                <h3>✨ استوديو الشرائح الذكي</h3>
                <textarea style={styles.inputFieldBlock} placeholder="اكتب موضوع الشرائح..." />
                <button style={styles.blueActionButton}>إنشاء الشرائح بالذكاء الاصطناعي</button>
              </div>
            )}

            {adminTab === "videos" && (
              <div>
                <h3>📋 بيانات المقطع</h3>
                <input type="text" style={styles.inputFieldBlock} placeholder="عنوان المقطع" />
                <button style={styles.blueActionButton}>حفظ المقطع</button>
              </div>
            )}

            {adminTab === "prices" && (
              <div>
                <h3>💰 أسعار المنهج العراقي</h3>
                {[
                  { subject: "الرياضيات 📐", stages: ["ابتدائي", "متوسط", "إعدادي"] },
                  { subject: "الكيمياء 🧪", stages: ["متوسط", "إعدادي"] },
                  { subject: "الفيزياء 🔋", stages: ["متوسط", "إعدادي"] },
                  { subject: "اللغة العربية 📚", stages: ["ابتدائي", "متوسط", "إعدادي"] }
                ].map((item, idx) => (
                  <div key={idx} style={{marginBottom: "15px"}}>
                    <h4 style={{color: "#38bdf8", margin: "5px 0"}}>{item.subject}</h4>
                    {item.stages.map(stage => (
                      <div key={stage} style={{display: "flex", gap: "10px", alignItems: "center", marginBottom: "5px"}}>
                        <span style={{width: "80px"}}>{stage}:</span>
                        <input type="number" style={{...styles.inputFieldBlock, marginBottom: 0}} placeholder="0 د.ع" />
                      </div>
                    ))}
                  </div>
                ))}
                <button style={styles.blueActionButton}>حفظ كافة الأسعار</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
