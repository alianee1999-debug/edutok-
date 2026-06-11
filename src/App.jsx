import React, { useState, useRef, useEffect } from "react";
import { 
  subscribeToVideos, 
  saveVideoToDB, 
  subscribeToStudents, 
  saveStudentToDB 
} from "./firebase";

export default function EduTokApp() {
  // الحالات البرمجية لإدارة التطبيق
  const [videos, setVideos] = useState([]);
  const [students, setStudents] = useState([]);
  const [currentTab, setCurrentTab] = useState("videos"); // "videos" أو "dashboard"
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [activeSection, setActiveSection] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");

  // حالات المدخلات في لوحة التحكم
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSection, setVideoSection] = useState("الفصل الأول: الكيمياء الحرارية");
  const [isLocked, setIsLocked] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [activationCode, setActivationCode] = useState("");

  const videoRef = useRef(null);

  // جلب البيانات الحية
  useEffect(() => {
    const unsubscribeVideos = subscribeToVideos((data) => {
      setVideos(data || []);
    });
    const unsubscribeStudents = subscribeToStudents((data) => {
      setStudents(data || []);
    });
    return () => {
      unsubscribeVideos();
      unsubscribeStudents();
    };
  }, []);

  // إضافة فيديو جديد
  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!videoTitle || !videoUrl) return alert("يرجى ملء جميع حقول الفيديو!");
    
    await saveVideoToDB({
      id: Date.now().toString(),
      title: videoTitle,
      url: videoUrl,
      section: videoSection,
      isLocked: isLocked,
      likes: 0,
      views: 0,
      createdAt: new Date().toLocaleDateString("ar-IQ")
    });

    setVideoTitle("");
    setVideoUrl("");
    alert("تم نشر الفيديو التعليمي بنجاح في المنصة! 🚀");
  };

  // تفعيل مشترك جديد
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!studentName || !studentPhone) return alert("يرجى إدخال اسم ورقم الطالب!");
    
    const generatedCode = "EDU-" + Math.floor(100000 + Math.random() * 900000).toString();
    
    await saveStudentToDB({
      id: Date.now().toString(),
      name: studentName,
      phone: studentPhone,
      code: generatedCode,
      isActivated: true,
      createdAt: new Date().toLocaleDateString("ar-IQ")
    });

    setActivationCode(generatedCode);
    setStudentName("");
    setStudentPhone("");
    alert(`تم تفعيل الطالب بنجاح! كود التفعيل: ${generatedCode}`);
  };

  // تصفية الفيديوهات حسب الفصل
  const filteredVideos = videos.filter(video => {
    const matchesSection = activeSection === "الكل" || video.section === activeSection;
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesSearch;
  });

  return (
    <div style={{
      backgroundColor: "#0b0b0c",
      color: "#f8f9fa",
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      direction: "rtl"
    }}>
      {/* الشريط العلوي الثابت */}
      <nav style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 20px",
        backgroundColor: "#161618",
        borderBottom: "1px solid #242426",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>📚</span>
          <div>
            <h1 style={{ fontSize: "18px", margin: 0, fontWeight: "bold", color: "#ffffff" }}>MicroDarss</h1>
            <small style={{ color: "#22c55e", fontSize: "11px" }}>منصة إديوتوك التعليمية</small>
          </div>
        </div>
        
        <button 
          onClick={() => setCurrentTab(currentTab === "videos" ? "dashboard" : "videos")}
          style={{
            backgroundColor: currentTab === "videos" ? "#2563eb" : "#dc2626",
            color: "#fff",
            border: "none",
            padding: "8px 18px",
            borderRadius: "25px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            transition: "all 0.2s"
          }}
        >
          {currentTab === "videos" ? "لوحة المدرس ⚙️" : "عرض المنصة 📱"}
        </button>
      </nav>

      {/* محتوى التبويبات */}
      <div style={{ padding: "15px", maxWidth: "650px", margin: "0 auto" }}>
        
        {currentTab === "videos" ? (
          /* واجهة عرض الفيديوهات (التيك توك التعليمي) */
          <div>
            {/* شريط الفصول والبحث */}
            <div style={{ marginBottom: "15px" }}>
              <input 
                type="text" 
                placeholder="🔍 ابحث عن درس (مثال: انثالبي التفاعل)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #242426",
                  backgroundColor: "#161618", color: "#fff", marginBottom: "10px", boxSizing: "border-box"
                }}
              />
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" }}>
                {["الكل", "الفصل الأول: الكيمياء الحرارية", "الفصل الثاني: الاتزان الكيميائي", "الفصل الثالث: الاتزان الأيوني"].map(sec => (
                  <button
                    key={sec}
                    onClick={() => { setActiveSection(sec); setCurrentVideoIndex(0); }}
                    style={{
                      padding: "6px 14px", borderRadius: "20px", border: "none", whiteSpace: "nowrap",
                      backgroundColor: activeSection === sec ? "#ffffff" : "#161618",
                      color: activeSection === sec ? "#000000" : "#a1a1aa",
                      fontWeight: "500", fontSize: "13px", cursor: "pointer"
                    }}
                  >
                    {sec === "الكل" ? "كل الفصول" : sec.split(":")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* مشغل الفيديوهات الذكي */}
            {filteredVideos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "#71717a" }}>
                <span style={{ fontSize: "40px" }}>📭</span>
                <p style={{ marginTop: "10px" }}>لا توجد دروس مرفوعة في هذا القسم حالياً.</p>
              </div>
            ) : (
              <div style={{
                backgroundColor: "#000000", borderRadius: "16px", overflow: "hidden",
                boxShadow: "0 10px 30px rgba(0,0,0,0.7)", border: "1px solid #1c1c1e"
              }}>
                <div style={{ padding: "12px", backgroundColor: "#161618", fontSize: "13px", color: "#e4e4e7", display: "flex", justifyContent: "space-between" }}>
                  <span>{filteredVideos[currentVideoIndex]?.section}</span>
                  <span style={{ color: "#22c55e" }}>تيك توك تعليمي 🎬</span>
                </div>

                <div style={{ position: "relative", backgroundColor: "#050505" }}>
                  <video 
                    ref={videoRef}
                    src={filteredVideos[currentVideoIndex]?.url} 
                    controls
                    autoPlay
                    style={{ width: "100%", maxHeight: "60vh", display: "block", margin: "0 auto" }}
                  />
                  {filteredVideos[currentVideoIndex]?.isLocked && (
                    <div style={{
                      position: "absolute", top: "15px", left: "15px", backgroundColor: "#dc2626",
                      color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold"
                    }}>
                      🔒 خاص بالمشتركين
                    </div>
                  )}
                </div>

                <div style={{ padding: "20px", backgroundColor: "#161618" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#ffffff" }}>{filteredVideos[currentVideoIndex]?.title}</h3>
                  <small style={{ color: "#a1a1aa" }}>تاريخ النشر: {filteredVideos[currentVideoIndex]?.createdAt || "اليوم"}</small>
                </div>

                {/* أزرار التنقل السلس */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px", backgroundColor: "#0f0f11", borderTop: "1px solid #1c1c1e"
                }}>
                  <button 
                    disabled={currentVideoIndex === 0}
                    onClick={() => setCurrentVideoIndex(prev => prev - 1)}
                    style={{
                      opacity: currentVideoIndex === 0 ? 0.4 : 1, backgroundColor: "#242426",
                      color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer"
                    }}
                  >
                    ⏮️ الدرس السابق
                  </button>
                  <span style={{ fontSize: "14px", color: "#a1a1aa" }}>
                    {currentVideoIndex + 1} من {filteredVideos.length}
                  </span>
                  <button 
                    disabled={currentVideoIndex === filteredVideos.length - 1}
                    onClick={() => setCurrentVideoIndex(prev => prev + 1)}
                    style={{
                      opacity: currentVideoIndex === filteredVideos.length - 1 ? 0.4 : 1, backgroundColor: "#242426",
                      color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer"
                    }}
                  >
                    الدرس التالي ⏭️
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* واجهة لوحة التحكم (إدارة الأستاذ للمنصة التعليمية) */
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* نموذج رفع فيديو */}
            <section style={{ backgroundColor: "#161618", padding: "20px", borderRadius: "14px", border: "1px solid #242426" }}>
              <h2 style={{ fontSize: "16px", marginTop: 0, marginBottom: "15px", color: "#3b82f6", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>➕</span> إضافة فيديو ومقطع تعليمي جديد
              </h2>
              <form onSubmit={handleAddVideo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>عنوان المقطع التعليمي:</label>
                  <input 
                    type="text" 
                    placeholder="مثال: شرح قانون هيس بطريقة مبسطة" 
                    value={videoTitle} 
                    onChange={(e) => setVideoTitle(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #242426", backgroundColor: "#242426", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>رابط الفيديو (Direct URL / MP4):</label>
                  <input 
                    type="text" 
                    placeholder="https://example.com/video.mp4" 
                    value={videoUrl} 
                    onChange={(e) => setVideoUrl(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #242426", backgroundColor: "#242426", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>الفصل الدراسي المعني:</label>
                  <select 
                    value={videoSection} 
                    onChange={(e) => setVideoSection(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #242426", backgroundColor: "#242426", color: "#fff", boxSizing: "border-box" }}
                  >
                    <option>الفصل الأول: الكيمياء الحرارية</option>
                    <option>الفصل الثاني: الاتزان الكيميائي</option>
                    <option>الفصل الثالث: الاتزان الأيوني</option>
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", marginTop: "5px" }}>
                  <input type="checkbox" checked={isLocked} onChange={(e) => setIsLocked(e.target.checked)} style={{ width: "16px", height: "16px" }} />
                  <span>قفل المقطع (متاح فقط للطلاب المشتركين برمز تفعيل)</span>
                </label>
                <button type="submit" style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer", marginTop: "5px" }}>
                  نشر الدرس فوراً في المنصة 🚀
                </button>
              </form>
            </section>

            {/* نموذج تفعيل الطلاب والاشتراكات */}
            <section style={{ backgroundColor: "#161618", padding: "20px", borderRadius: "14px", border: "1px solid #242426" }}>
              <h2 style={{ fontSize: "16px", marginTop: 0, marginBottom: "15px", color: "#eab308", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔑</span> نظام تفعيل اشتراكات الطلاب الكودية
              </h2>
              <form onSubmit={handleAddStudent} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>اسم الطالب الثلاثي:</label>
                  <input 
                    type="text" 
                    placeholder="مثال: محمد علي حسن" 
                    value={studentName} 
                    onChange={(e) => setStudentName(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #242426", backgroundColor: "#242426", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>رقم هاتف الطالب أو ولي الأمر:</label>
                  <input 
                    type="tel" 
                    placeholder="077xxxxxxxx" 
                    value={studentPhone} 
                    onChange={(e) => setStudentPhone(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #242426", backgroundColor: "#242426", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <button type="submit" style={{ backgroundColor: "#eab308", color: "#000", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer", marginTop: "5px" }}>
                  توليد رمز اشتراك جديد وعمل كود 🎟️
                </button>
              </form>

              {activationCode && (
                <div style={{ marginTop: "15px", padding: "12px", backgroundColor: "#1c1917", border: "1px dashed #eab308", borderRadius: "8px", textAlign: "center" }}>
                  <small style={{ color: "#a1a1aa", display: "block", marginBottom: "4px" }}>الرمز الجاهز للإرسال للطالب:</small>
                  <strong style={{ fontSize: "20px", color: "#eab308", letterSpacing: "1px" }}>{activationCode}</strong>
                </div>
              )}
            </section>

            {/* قائمة الطلاب المفعلين */}
            <section style={{ backgroundColor: "#161618", padding: "20px", borderRadius: "14px", border: "1px solid #242426" }}>
              <h3 style={{ fontSize: "14px", marginTop: 0, marginBottom: "10px", color: "#a1a1aa" }}>📊 قائمة المشتركين النشطين حالياً ({students.length})</h3>
              {students.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#71717a" }}>لا يوجد طلاب مفعلين بعد.</p>
              ) : (
                <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {students.map(st => (
                    <div key={st.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#242426", borderRadius: "6px", fontSize: "13px" }}>
                      <span>{st.name} ({st.phone})</span>
                      <span style={{ color: "#22c55e", fontWeight: "500" }}>{st.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
