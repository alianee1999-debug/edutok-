import { useState, useRef, useEffect } from "react"
import { 
  subscribeToVideos, 
  saveVideoToDB, 
  subscribeToStudents, 
  saveStudentToDB 
} from "./firebase"

export default function EduTokApp() {
  // --- الحالات والبيانات الحركية المتكاملة ---
  const [videos, setVideos] = useState([])
  const [students, setStudents] = useState([])
  const [currentTab, setCurrentTab] = useState("videos") // "videos" أو "dashboard"
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  
  // حالات إدخال البيانات للوحة التحكم
  const [videoTitle, setVideoTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [videoSection, setVideoSection] = useState("الفصل الأول: الكيمياء الحرارية")
  const [isLocked, setIsLocked] = useState(false)
  const [studentName, setStudentName] = useState("")
  const [studentPhone, setStudentPhone] = useState("")

  const videoRef = useRef(null)

  // --- جلب البيانات الحية من الفايربيز عند تشغيل التطبيق ---
  useEffect(() => {
    const unsubscribeVideos = subscribeToVideos((data) => {
      setVideos(data || [])
    })
    const unsubscribeStudents = subscribeToStudents((data) => {
      setStudents(data || [])
    })

    return () => {
      unsubscribeVideos()
      unsubscribeStudents()
    }
  }, [])

  // --- دوال التحكم والإضافة ---
  const handleAddVideo = async (e) => {
    e.preventDefault()
    if (!videoTitle || !videoUrl) return alert("الرجاء ملء كافة الحقول!")
    
    await saveVideoToDB({
      title: videoTitle,
      url: videoUrl,
      section: videoSection,
      isLocked: isLocked,
      createdAt: new Date().toISOString()
    })

    setVideoTitle("")
    setVideoUrl("")
    alert("تمت إضافة الفيديو التعليمي بنجاح! 🎉")
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!studentName || !studentPhone) return alert("الرجاء ملء حقول الطالب!")

    await saveStudentToDB({
      name: studentName,
      phone: studentPhone,
      isActivated: true,
      createdAt: new Date().toISOString()
    })

    setStudentName("")
    setStudentPhone("")
    alert("تم تفعيل حساب الطالب بنجاح! ✅")
  }

  // --- واجهة العرض والتصميم المرئي ---
  return (
    <div style={{
      backgroundColor: "#121212",
      color: "#ffffff",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      direction: "rtl",
      paddingBottom: "80px"
    }}>
      
      {/* شريط التنقل العلوي */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 20px",
        backgroundColor: "#1e1e1e",
        borderBottom: "1px solid #333"
      }}>
        <h1 style={{ fontSize: "20px", margin: 0 }}>📚 MicroDarss - إديوتوك</h1>
        <button 
          onClick={() => setCurrentTab(currentTab === "videos" ? "dashboard" : "videos")}
          style={{
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "20px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {currentTab === "videos" ? "لوحة التحكم ⚙️" : "عرض الفيديوهات 📱"}
        </button>
      </header>

      {/* المحتوى الرئيسي بناءً على التبويب النشط */}
      <main style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        
        {currentTab === "videos" ? (
          /* واجهة الفيديوهات القصيرة (أسلوب تيك توك التعليمي) */
          <div>
            {videos.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", marginTop: "50px" }}>لا توجد فيديوهات مرفوعة حالياً. أضف بعض الفيديوهات من لوحة التحكم!</p>
            ) : (
              <div style={{
                backgroundColor: "#000",
                borderRadius: "15px",
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}>
                <div style={{ padding: "10px", backgroundColor: "#222", fontSize: "14px", textAlign: "center" }}>
                  {videos[currentVideoIndex]?.section}
                </div>
                
                <video 
                  ref={videoRef}
                  src={videos[currentVideoIndex]?.url} 
                  controls
                  autoPlay
                  style={{ width: "100%", maxHeight: "70vh", display: "block" }}
                />

                <div style={{ padding: "15px", backgroundColor: "rgba(0,0,0,0.7)" }}>
                  <h3 style={{ margin: "0 0 10px 0" }}>{videos[currentVideoIndex]?.title}</h3>
                  {videos[currentVideoIndex]?.isLocked && (
                    <span style={{ backgroundColor: "#dc3545", padding: "3px 8px", borderRadius: "5px", fontSize: "12px" }}>🔒 مقيد للمشتركين</span>
                  )}
                </div>

                {/* أزرار التنقل بين الفيديوهات */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", backgroundColor: "#111" }}>
                  <button 
                    disabled={currentVideoIndex === 0}
                    onClick={() => setCurrentVideoIndex(prev => prev - 1)}
                    style={{ opacity: currentVideoIndex === 0 ? 0.5 : 1, backgroundColor: "#333", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "5px" }}
                  >
                    ⏮️ السابق
                  </button>
                  <span>{currentVideoIndex + 1} من {videos.length}</span>
                  <button 
                    disabled={currentVideoIndex === videos.length - 1}
                    onClick={() => setCurrentVideoIndex(prev => prev + 1)}
                    style={{ opacity: currentVideoIndex === videos.length - 1 ? 0.5 : 1, backgroundColor: "#333", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "5px" }}
                  >
                    التالي ⏭️
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* واجهة لوحة التحكم (إدارة المدرس) */
          <div style={{ spaceY: "20px" }}>
            
            {/* نموذج إضافة فيديو جديد */}
            <section style={{ backgroundColor: "#1e1e1e", padding: "20px", borderRadius: "10px", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", marginTop: 0, color: "#007bff" }}>➕ إضافة فيديو تعليمي جديد</h2>
              <form onSubmit={handleAddVideo} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input 
                  type="text" 
                  placeholder="عنوان الفيديو (مثال: حساب انثالبي التفاعل)" 
                  value={videoTitle} 
                  onChange={(e) => setVideoTitle(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#2b2b2b", color: "#fff" }}
                />
                <input 
                  type="text" 
                  placeholder="رابط الفيديو (URL)" 
                  value={videoUrl} 
                  onChange={(e) => setVideoUrl(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#2b2b2b", color: "#fff" }}
                />
                <select 
                  value={videoSection} 
                  onChange={(e) => setVideoSection(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#2b2b2b", color: "#fff" }}
                >
                  <option>الفصل الأول: الكيمياء الحرارية</option>
                  <option>الفصل الثاني: الاتزان الكيميائي</option>
                  <option>الفصل الثالث: الاتزان الأيوني</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={isLocked} 
                    onChange={(e) => setIsLocked(e.target.checked)} 
                  />
                  قفل الفيديو (للمشتركين فقط)
                </label>
                <button type="submit" style={{ backgroundColor: "#28a745", color: "#fff", border: "none", padding: "10px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>
                  حفظ الفيديو ونشره تيك توك 🚀
                </button>
              </form>
            </section>

            {/* نموذج تفعيل الطلاب والاشتراكات */}
            <section style={{ backgroundColor: "#1e1e1e", padding: "20px", borderRadius: "10px" }}>
              <h2 style={{ fontSize: "18px", marginTop: 0, color: "#ffc107" }}>🔑 تفعيل اشتراكات الطلاب</h2>
              <form onSubmit={handleAddStudent} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input 
                  type="text" 
                  placeholder="اسم الطالب الثلاثي" 
                  value={studentName} 
                  onChange={(e) => setStudentName(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#2b2b2b", color: "#fff" }}
                />
                <input 
                  type="tel" 
                  placeholder="رقم هاتف الطالب أو ولي الأمر" 
                  value={studentPhone} 
                  onChange={(e) => setStudentPhone(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#2b2b2b", color: "#fff" }}
                />
                <button type="submit" style={{ backgroundColor: "#ffc107", color: "#000", border: "none", padding: "10px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>
                  توليد كود التفعيل والحفظ 🎟️
                </button>
              </form>
            </section>

          </div>
        )}
      </main>
    </div>
  )
}
