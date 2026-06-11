import { useState, useRef, useEffect } from "react";

// ── Constants ──────────────────────────────────────────
const ADMIN_PHONE = "07700000000";
const ADMIN_PASS_DEFAULT = "admin2024";
const adminCreds = { phone: ADMIN_PHONE, password: ADMIN_PASS_DEFAULT };
const GEMINI_API_KEY = "AQ.Ab8RN6Krr0o35IydNnhagoU3nDTx20szBvwmERf2nn_Xpo-IOw";
const GRADES = {
  الابتدائية: ["الأول","الثاني","الثالث","الرابع","الخامس","السادس"],
  المتوسطة: ["الأول","الثاني","الثالث"],
  الإعدادية: ["الأول","الثاني","الثالث"],
};
const STAGES = Object.keys(GRADES);
const SUBJECTS = ["الرياضيات","العلوم","اللغة العربية","التاريخ","الجغرافية","الفيزياء","الكيمياء","الأحياء","اللغة الإنجليزية","التربية الإسلامية"];

// ✅ FIX 1: All videos set to locked:false
const INIT_VIDEOS = [
  {id:1,title:"مقدمة في الجبر",teacher:"أ. أحمد",subject:"الرياضيات",stage:"الابتدائية",grade:"الرابع",type:"teacher",duration:"2:30",price:2500,locked:false,thumbnail:"🔢",videoUrl:null},
  {id:2,title:"الكسور والأعداد",teacher:"ذكاء اصطناعي",subject:"الرياضيات",stage:"الابتدائية",grade:"الرابع",type:"ai",duration:"1:45",price:0,locked:false,thumbnail:"🤖",videoUrl:null},
  {id:3,title:"الحركة والقوة",teacher:"أ. سارة",subject:"العلوم",stage:"الابتدائية",grade:"الرابع",type:"teacher",duration:"3:10",price:3000,locked:false,thumbnail:"⚡",videoUrl:null},
  {id:4,title:"النظام الشمسي",teacher:"رسوم متحركة",subject:"العلوم",stage:"الابتدائية",grade:"الرابع",type:"animation",duration:"2:00",price:1500,locked:false,thumbnail:"🪐",videoUrl:null},
  {id:5,title:"قواعد النحو",teacher:"أ. فاطمة",subject:"اللغة العربية",stage:"الابتدائية",grade:"الرابع",type:"teacher",duration:"2:50",price:2000,locked:false,thumbnail:"📝",videoUrl:null},
];

// ── Helpers ────────────────────────────────────────────
const getStudents = () => { try { return JSON.parse(localStorage.getItem("edutok_students")||"[]"); } catch { return []; } };
const saveStudents = (list) => { try { localStorage.setItem("edutok_students", JSON.stringify(list)); } catch {} };
const typeColor = (t) => t==="teacher"?"#00d4ff":t==="ai"?"#a855f7":"#f59e0b";
const typeLabel = (t) => t==="teacher"?"معلم":t==="ai"?"ذكاء اصطناعي":"رسوم متحركة";

// ── CSS ────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo','Segoe UI',sans-serif;background:#0a0a0f;color:#fff;direction:rtl;overflow:hidden}
input,select,button,textarea{font-family:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:4px}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
`;

// ── Button component ───────────────────────────────────
const Btn = ({onClick,children,style,disabled}) => (
  <button onClick={onClick} disabled={disabled}
    style={{cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",border:"none",...style}}>
    {children}
  </button>
);

// ── Notification ───────────────────────────────────────
function Notif({msg,type}) {
  return (
    <div style={{
      position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
      background:type==="error"?"#ef4444":"#22c55e",color:"#fff",
      padding:"10px 22px",borderRadius:20,fontWeight:700,fontSize:14,
      zIndex:9999,animation:"slideUp 0.3s ease",whiteSpace:"nowrap",
      boxShadow:"0 4px 20px rgba(0,0,0,0.4)"
    }}>{msg}</div>
  );
}

// ══════════════════════════════════════════════════════
// AUTH SCREEN
// ══════════════════════════════════════════════════════
function AuthScreen({onLogin}) {
  const [mode, setMode] = useState("welcome");
  const [form, setForm] = useState({name:"",phone:"",password:"",stage:"الابتدائية",grade:"الأول"});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const inp = {
    width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:14,padding:"13px 16px",color:"#fff",fontSize:15,outline:"none",
    marginBottom:12,direction:"rtl",display:"block"
  };
  const sel = {...inp, background:"#13131e"};

  const doRegister = async () => {
    setErr("");
    if (!form.name.trim()) return setErr("أدخل اسمك الكامل");
    if (form.phone.length < 10) return setErr("رقم الهاتف غير صحيح");
    if (form.password.length < 6) return setErr("كلمة المرور 6 أحرف على الأقل");
    const list = getStudents();
    if (list.find(s => s.phone===form.phone)) return setErr("هذا الرقم مسجل مسبقاً");
    setBusy(true);
    await new Promise(r=>setTimeout(r,600));
    const student = {id:Date.now(),name:form.name,phone:form.phone,password:form.password,
      stage:form.stage,grade:form.grade,joinDate:new Date().toLocaleDateString("ar"),isAdmin:false};
    saveStudents([...list,student]);
    setBusy(false);
    onLogin(student);
  };

  const doLogin = async () => {
    setErr("");
    if (form.phone.length<10) return setErr("أدخل رقم الهاتف");
    if (!form.password) return setErr("أدخل كلمة المرور");
    setBusy(true);
    await new Promise(r=>setTimeout(r,500));
    if (form.phone===adminCreds.phone && form.password===adminCreds.password) {
      setBusy(false);
      onLogin({id:0,name:"المدير",phone:form.phone,stage:"—",grade:"—",joinDate:"—",isAdmin:true});
      return;
    }
    const student = getStudents().find(s=>s.phone===form.phone&&s.password===form.password);
    setBusy(false);
    if (student) onLogin(student);
    else setErr("رقم الهاتف أو كلمة المرور غير صحيحة");
  };

  if (mode==="welcome") return (
    <div style={{width:"100vw",height:"100vh",background:"#0a0a0f",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Cairo',sans-serif"}}>
      <style>{G}</style>
      <div style={{fontSize:72,marginBottom:16}}>📚</div>
      <div style={{fontSize:32,fontWeight:900,background:"linear-gradient(90deg,#00d4ff,#a855f7)",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:6}}>EduTok</div>
      <div style={{fontSize:14,color:"#888",marginBottom:40}}>التعلم بطريقة ممتعة 🎓</div>
      <Btn onClick={()=>setMode("register")} style={{width:"100%",maxWidth:340,background:"linear-gradient(135deg,#00d4ff,#a855f7)",
        borderRadius:16,padding:"15px 0",color:"#fff",fontWeight:700,fontSize:16,marginBottom:12}}>
        إنشاء حساب جديد
      </Btn>
      <Btn onClick={()=>setMode("login")} style={{width:"100%",maxWidth:340,background:"rgba(255,255,255,0.06)",
        border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:"14px 0",color:"#aaa",fontSize:15}}>
        لدي حساب — تسجيل الدخول
      </Btn>
    </div>
  );

  if (mode==="register") return (
    <div style={{width:"100vw",height:"100vh",background:"#0a0a0f",overflowY:"auto",
      fontFamily:"'Cairo',sans-serif",padding:"40px 24px"}}>
      <style>{G}</style>
      <div style={{maxWidth:400,margin:"0 auto"}}>
        <Btn onClick={()=>setMode("welcome")} style={{background:"transparent",color:"#888",fontSize:13,marginBottom:20}}>← رجوع</Btn>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:8}}>🎓</div>
          <div style={{fontSize:22,fontWeight:800}}>إنشاء حساب</div>
        </div>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>الاسم الكامل</div>
        <input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="مثال: أحمد محمد" />
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>رقم الهاتف</div>
        <input style={{...inp,textAlign:"center"}} type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="07XX XXX XXXX" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>المرحلة</div>
            <select style={sel} value={form.stage} onChange={e=>setForm(p=>({...p,stage:e.target.value,grade:GRADES[e.target.value][0]}))}>
              {STAGES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>الصف</div>
            <select style={sel} value={form.grade} onChange={e=>setForm(p=>({...p,grade:e.target.value}))}>
              {GRADES[form.stage].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>كلمة المرور</div>
        <input style={inp} type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="6 أحرف على الأقل" />
        {err && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,
          padding:"8px 12px",color:"#ef4444",fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
        <Btn onClick={doRegister} disabled={busy} style={{width:"100%",background:busy?"rgba(0,212,255,0.3)":"linear-gradient(135deg,#00d4ff,#a855f7)",
          borderRadius:14,padding:"14px 0",color:"#fff",fontWeight:700,fontSize:15,marginBottom:14}}>
          {busy?"⏳ جاري التسجيل...":"إنشاء الحساب ✓"}
        </Btn>
        <div style={{textAlign:"center",fontSize:13,color:"#888"}}>
          لديك حساب؟{" "}
          <span onClick={()=>{setMode("login");setErr("");}} style={{color:"#00d4ff",cursor:"pointer",fontWeight:700}}>سجل دخول</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{width:"100vw",height:"100vh",background:"#0a0a0f",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:"'Cairo',sans-serif",padding:24}}>
      <style>{G}</style>
      <div style={{width:"100%",maxWidth:400}}>
        <Btn onClick={()=>setMode("welcome")} style={{background:"transparent",color:"#888",fontSize:13,marginBottom:20}}>← رجوع</Btn>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:8}}>🔐</div>
          <div style={{fontSize:22,fontWeight:800}}>تسجيل الدخول</div>
        </div>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>رقم الهاتف</div>
        <input style={{...inp,textAlign:"center"}} type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="07XX XXX XXXX" />
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:600}}>كلمة المرور</div>
        <input style={inp} type="password" value={form.password}
          onChange={e=>setForm(p=>({...p,password:e.target.value}))}
          onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="كلمة المرور" />
        {err && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,
          padding:"8px 12px",color:"#ef4444",fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
        <Btn onClick={doLogin} disabled={busy} style={{width:"100%",background:busy?"rgba(0,212,255,0.3)":"linear-gradient(135deg,#00d4ff,#a855f7)",
          borderRadius:14,padding:"14px 0",color:"#fff",fontWeight:700,fontSize:15,marginBottom:14}}>
          {busy?"⏳ جاري الدخول...":"دخول ←"}
        </Btn>
        <div style={{textAlign:"center",fontSize:13,color:"#888",marginBottom:16}}>
          ليس لديك حساب؟{" "}
          <span onClick={()=>{setMode("register");setErr("");}} style={{color:"#00d4ff",cursor:"pointer",fontWeight:700}}>سجل الآن</span>
        </div>
        <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,
          padding:"10px 14px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,marginBottom:3}}>👑 دخول المدير</div>
          <div style={{fontSize:11,color:"#888"}}>استخدم رقم هاتف المدير وكلمة المرور الخاصة</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════
export default function EduTok() {
  const [student, setStudent] = useState(null);
  const handleLogin = (s) => setStudent(s);
  const handleLogout = () => setStudent(null);
  if (!student) return <AuthScreen onLogin={handleLogin} />;
  return <App student={student} onLogout={handleLogout} />;
}

// ══════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════
function App({student, onLogout}) {
  const isAdmin = !!student.isAdmin;
  const [tab, setTab] = useState("home");
  const [videos, setVideos] = useState(INIT_VIDEOS);
  const [vidIdx, setVidIdx] = useState(0);
  const [saved, setSaved] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [wallet, setWallet] = useState({balance:0,txs:[]});
  const [adminWallet, setAdminWallet] = useState({balance:0,txs:[]});
  const [filtered, setFiltered] = useState(null);
  const [classFilter, setClassFilter] = useState(null);
  const [notif, setNotif] = useState(null);
  const [modal, setModal] = useState(null);
  const [slideVideo, setSlideVideo] = useState(null);

  const initPrices = Object.fromEntries(
    SUBJECTS.flatMap(s=>STAGES.map(st=>[s+"_"+st,{price:0,locked:false}]))
  );
  const [prices, setPrices] = useState(() => {
    try {
      const saved = localStorage.getItem("edutok_prices");
      return saved ? {...initPrices, ...JSON.parse(saved)} : initPrices;
    } catch { return initPrices; }
  });
  const [adminPass, setAdminPass] = useState(ADMIN_PASS_DEFAULT);
  const [adminPhone, setAdminPhone] = useState(ADMIN_PHONE);
  const [adminTab, setAdminTab] = useState("videos");
  const [notifications, setNotifications] = useState([]);
  const [showNotifBell, setShowNotifBell] = useState(false);

  const displayVideos = filtered || videos;
  const currentVideo = displayVideos[vidIdx] || displayVideos[0];

  const showNotif = (msg, type="success") => {
    setNotif({msg,type});
    setTimeout(()=>setNotif(null), 3000);
  };

  // ✅ FIX 2: isUnlocked — if price is 0 always show as unlocked
  const isUnlocked = (v) => {
    if (v.price === 0) return true;
    if (!v.locked) return true;
    return unlocked.includes(v.subject+"_"+v.stage);
  };

  const onVideoTap = (v) => {
    if (!isUnlocked(v)) { setModal({type:"pay",data:v}); return; }
    if (v.slides?.length > 0) { setSlideVideo(v); return; }
  };

  const payFromWallet = (v) => {
    if (wallet.balance < v.price) return false;
    const key = v.subject+"_"+v.stage;
    setWallet(w=>({balance:w.balance-v.price,txs:[{id:Date.now(),label:`اشتراك ${v.subject}`,amount:-v.price,date:new Date().toLocaleDateString("ar")},...w.txs]}));
    setAdminWallet(w=>({balance:w.balance+v.price,txs:[{id:Date.now(),label:`${v.subject} / ${student.name}`,amount:v.price,date:new Date().toLocaleDateString("ar")},...w.txs]}));
    setUnlocked(u=>[...u,key]);
    return true;
  };

  const topUp = (amount) => {
    setWallet(w=>({balance:w.balance+amount,txs:[{id:Date.now(),label:"شحن زين كاش",amount,date:new Date().toLocaleDateString("ar")},...w.txs]}));
    showNotif(`تم شحن ${amount.toLocaleString()} د.ع ✓`);
  };

  const sendNotification = (title, body) => {
    const n = {id:Date.now(),title,body,date:new Date().toLocaleDateString("ar"),read:false};
    setNotifications(prev=>[n,...prev]);
    try {
      const stored = JSON.parse(localStorage.getItem("edutok_notifs")||"[]");
      localStorage.setItem("edutok_notifs", JSON.stringify([n,...stored].slice(0,50)));
    } catch {}
  };

  useEffect(()=>{
    try {
      const stored = JSON.parse(localStorage.getItem("edutok_notifs")||"[]");
      if (stored.length) setNotifications(stored);
    } catch {}
  },[]);

  const updatePrice = (key, field, val) => {
    setPrices(p => {
      const updated = {...p, [key]: {...p[key], [field]: val}};
      try { localStorage.setItem("edutok_prices", JSON.stringify(updated)); } catch {}
      return updated;
    });
    const [subj, stg] = key.split("_");
    if (field === "price") setVideos(vs => vs.map(v => v.subject===subj && v.stage===stg ? {...v, price: parseInt(val)||0} : v));
    if (field === "locked") setVideos(vs => vs.map(v => v.subject===subj && v.stage===stg ? {...v, locked: val} : v));
  };

  const closeModal = () => setModal(null);

  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",
      background:"#0a0a0f",color:"#fff",fontFamily:"'Cairo',sans-serif",direction:"rtl",overflow:"hidden",position:"relative"}}>
      <style>{G}</style>
      {notif && <Notif msg={notif.msg} type={notif.type} />}

      {/* Header */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,
        background:"linear-gradient(180deg,rgba(0,0,0,0.9) 0%,transparent 100%)",
        padding:"14px 18px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#00d4ff,#a855f7)",
            borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📚</div>
          <div>
            <div style={{fontSize:17,fontWeight:900,background:"linear-gradient(90deg,#00d4ff,#a855f7)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>EduTok</div>
            <div style={{fontSize:9,color:"#666"}}>التعلم بطريقة ممتعة</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {classFilter && (
            <Btn onClick={()=>{setClassFilter(null);setFiltered(null);setVidIdx(0);}}
              style={{background:"rgba(0,212,255,0.15)",borderRadius:16,padding:"4px 10px",color:"#00d4ff",fontSize:11}}>
              ✕ {classFilter}
            </Btn>
          )}
          {!isAdmin && (
            <>
              <Btn onClick={()=>setShowNotifBell(true)}
                style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:16,padding:"5px 10px",color:"#fff",fontSize:16,position:"relative"}}>
                🔔
                {notifications.some(n=>!n.read) && (
                  <div style={{position:"absolute",top:-3,right:-3,width:10,height:10,
                    background:"#ef4444",borderRadius:"50%",border:"2px solid #0a0a0f"}} />
                )}
              </Btn>
              <Btn onClick={()=>setModal({type:"wallet"})}
                style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",
                  borderRadius:16,padding:"5px 12px",color:"#22c55e",fontSize:11,fontWeight:700}}>
                💰 {wallet.balance.toLocaleString()} د.ع
              </Btn>
            </>
          )}
          {isAdmin && (
            <Btn onClick={()=>setTab("admin")}
              style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:16,
                padding:"6px 14px",color:"#fff",fontSize:12,fontWeight:700}}>
              ⚙️ إدارة
            </Btn>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{flex:1,overflow:"hidden",marginBottom:56}}>
        {tab==="home" && (
          <VideoFeed videos={displayVideos} idx={vidIdx} setIdx={setVidIdx}
            saved={saved} setSaved={setSaved} isUnlocked={isUnlocked}
            onTap={onVideoTap}
            onAI={()=>setModal({type:"ai"})}
            onChat={()=>setModal({type:"chat"})}
            onShare={(v)=>setModal({type:"share",data:v})}
            onMenu={(type)=>{
              if(type==="camera") setModal({type:"camera"});
              else if(type==="class") setModal({type:"class"});
              else if(type==="search") setTab("search");
              else if(type==="pdf") setModal({type:"pdf"});
            }}
          />
        )}
        {tab==="search" && <SearchTab videos={videos} onTap={onVideoTap} isUnlocked={isUnlocked} onBack={()=>setTab("home")} />}
        {tab==="profile" && <ProfileTab student={student} isAdmin={isAdmin} saved={saved} unlocked={unlocked} onLogout={onLogout} wallet={wallet} adminWallet={adminWallet} onTopUp={topUp} showNotif={showNotif} />}
        {tab==="admin" && isAdmin && (
          <AdminTab videos={videos} setVideos={setVideos} prices={prices} updatePrice={updatePrice}
            adminWallet={adminWallet} adminPass={adminPass} setAdminPass={setAdminPass}
            adminPhone={adminPhone} setAdminPhone={setAdminPhone}
            adminTab={adminTab} setAdminTab={setAdminTab} showNotif={showNotif}
            sendNotification={sendNotification}
            onPublish={(newVideo)=>{
              setFiltered(null); setClassFilter(null);
              setVidIdx(0); setTab("home");
            }} />
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:56,
        background:"rgba(10,10,15,0.98)",borderTop:"1px solid rgba(255,255,255,0.08)",
        display:"flex",alignItems:"center",justifyContent:"space-around",zIndex:50}}>
        {(isAdmin
          ? [{id:"home",icon:"🏠",label:"الرئيسية"},{id:"profile",icon:"👤",label:"حسابي"},{id:"admin",icon:"⚙️",label:"إدارة"}]
          : [{id:"home",icon:"🏠",label:"الرئيسية"},{id:"profile",icon:"👤",label:"حسابي"}]
        ).map(item=>(
          <Btn key={item.id} onClick={()=>setTab(item.id)}
            style={{background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",
              gap:2,padding:"6px 20px",color:tab===item.id?"#00d4ff":"#666"}}>
            <span style={{fontSize:20}}>{item.icon}</span>
            <span style={{fontSize:9,fontWeight:600}}>{item.label}</span>
          </Btn>
        ))}
      </div>

      {/* Modals */}
      {slideVideo && (
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"#0a0a0f"}}>
          <SlidePlayer video={slideVideo} isUnlocked={isUnlocked}
            onTap={(v)=>{setSlideVideo(null); setModal({type:"pay",data:v});}}
            onClose={()=>setSlideVideo(null)} />
        </div>
      )}
      {modal?.type==="pay" && <PayModal v={modal.data} wallet={wallet} onPay={payFromWallet} onTopUp={topUp} onClose={closeModal} showNotif={showNotif} />}
      {showNotifBell && <NotifModal notifications={notifications} setNotifications={setNotifications} onClose={()=>setShowNotifBell(false)} />}
      {modal?.type==="wallet" && <WalletModal wallet={wallet} adminWallet={adminWallet} isAdmin={isAdmin} onTopUp={topUp} onClose={closeModal} showNotif={showNotif} />}
      {modal?.type==="ai" && <AIModal onClose={closeModal} />}
      {modal?.type==="chat" && <ChatModal onClose={closeModal} />}
      {modal?.type==="camera" && <CameraModal onClose={closeModal} />}
      {modal?.type==="pdf" && <PDFModal onClose={closeModal} />}
      {modal?.type==="share" && <ShareModal v={modal.data} onClose={closeModal} />}
      {modal?.type==="class" && (
        <ClassModal onClose={closeModal} videos={videos}
          onFilter={(label,vids)=>{setClassFilter(label);setFiltered(vids);setVidIdx(0);setTab("home");closeModal();}} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// VIDEO FEED
// ══════════════════════════════════════════════════════
function VideoFeed({videos,idx,setIdx,saved,setSaved,isUnlocked,onTap,onAI,onChat,onShare,onMenu}) {
  const ref = useRef(null);
  const startY = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const v = videos[idx];

  useEffect(()=>{
    const el = ref.current;
    if (!el) return;
    const ts = e=>{ startY.current=e.touches[0].clientY; };
    const te = e=>{
      const d = startY.current - e.changedTouches[0].clientY;
      if (Math.abs(d)>50) {
        setMenuOpen(false);
        if (d>0 && idx<videos.length-1) setIdx(i=>i+1);
        else if (d<0 && idx>0) setIdx(i=>i-1);
      }
    };
    const wh = e=>{
      setMenuOpen(false);
      if (e.deltaY>30 && idx<videos.length-1) setIdx(i=>i+1);
      else if (e.deltaY<-30 && idx>0) setIdx(i=>i-1);
    };
    el.addEventListener("touchstart",ts,{passive:true});
    el.addEventListener("touchend",te,{passive:true});
    el.addEventListener("wheel",wh,{passive:true});
    return ()=>{ el.removeEventListener("touchstart",ts); el.removeEventListener("touchend",te); el.removeEventListener("wheel",wh); };
  },[idx,videos.length]);

  if (!v) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#888"}}>لا توجد مقاطع</div>;

  const isSaved = saved.includes(v.id);
  const unlocked = isUnlocked(v);

  return (
    <div ref={ref} style={{height:"100%",position:"relative",overflow:"hidden",
      background:`linear-gradient(135deg,${typeColor(v.type)}18,#0a0a0f 60%)`}}>

      {/* Video card */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:"82%",maxWidth:360,aspectRatio:"9/16",maxHeight:"76vh",
          background:"rgba(255,255,255,0.04)",border:`1px solid ${typeColor(v.type)}44`,
          borderRadius:22,position:"relative",overflow:"hidden",
          boxShadow:`0 0 50px ${typeColor(v.type)}18`,
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>

          {v.videoUrl ? (
            <video src={v.videoUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
              controls={unlocked} playsInline loop={!unlocked} />
          ) : (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
              <div style={{fontSize:v.slides?.length>0?60:80}}>{v.thumbnail}</div>
              {v.slides?.length>0 && (
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"3px 10px"}}>
                  ✨ {v.slides.length} شريحة تعليمية
                </div>
              )}
            </div>
          )}

          {/* Lock overlay */}
          {!unlocked && (
            <div onClick={()=>onTap(v)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(4px)"}}>
              <div style={{fontSize:44,marginBottom:8}}>🔒</div>
              <div style={{fontSize:13,color:"#ccc",marginBottom:6}}>اشتراك في مادة</div>
              <div style={{fontSize:24,fontWeight:900,color:"#f59e0b"}}>{v.price.toLocaleString()} د.ع</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:8,background:"rgba(245,158,11,0.15)",borderRadius:10,padding:"4px 14px"}}>
                اضغط للاشتراك في {v.subject}
              </div>
            </div>
          )}

          {/* Play btn */}
          {unlocked && !v.videoUrl && (
            <div onClick={()=>onTap(v)}
              style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <div style={{width:64,height:64,
                background: v.slides?.length>0 ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.15)",
                borderRadius:"50%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                border: v.slides?.length>0 ? "2px solid #a855f7" : "2px solid rgba(255,255,255,0.3)",
                backdropFilter:"blur(10px)",gap:2}}>
                <span style={{fontSize:v.slides?.length>0?20:24,marginRight:v.slides?.length>0?0:-3}}>
                  {v.slides?.length>0?"✨":"▶"}
                </span>
                {v.slides?.length>0 && <span style={{fontSize:8,color:"#a855f7",fontWeight:700}}>شرائح</span>}
              </div>
            </div>
          )}

          {/* Badges */}
          <div style={{position:"absolute",bottom:10,left:10,display:"flex",gap:6}}>
            <span style={{background:"rgba(0,0,0,0.6)",borderRadius:8,padding:"2px 8px",fontSize:11,color:"#ccc"}}>⏱ {v.duration}</span>
            <span style={{background:typeColor(v.type)+"33",border:`1px solid ${typeColor(v.type)}`,
              borderRadius:8,padding:"2px 8px",fontSize:11,color:typeColor(v.type),fontWeight:600}}>{typeLabel(v.type)}</span>
          </div>

          {/* Progress dots */}
          <div style={{position:"absolute",bottom:10,right:10,display:"flex",gap:3}}>
            {videos.map((_,i)=>(
              <div key={i} onClick={()=>setIdx(i)} style={{width:i===idx?18:5,height:5,
                background:i===idx?"#00d4ff":"rgba(255,255,255,0.3)",borderRadius:3,cursor:"pointer",transition:"all 0.3s"}} />
            ))}
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,
        background:"linear-gradient(transparent,rgba(0,0,0,0.92))",padding:"36px 18px 18px",pointerEvents:"none"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>{v.title}</div>
        <div style={{fontSize:12,color:"#aaa"}}>👨‍🏫 {v.teacher} • {v.subject} • {v.stage} / {v.grade}</div>
      </div>

      {/* ✅ FIX 3: Side buttons — organized with proper spacing and positioning */}
      <div style={{
        position:"absolute",
        left:10,
        top:"50%",
        transform:"translateY(-50%)",
        display:"flex",
        flexDirection:"column",
        gap:10,
        zIndex:10,
      }}>
        {[
          {icon:"📌",label:isSaved?"محفوظ":"حفظ",active:isSaved,color:"#f59e0b",
            action:()=>setSaved(s=>isSaved?s.filter(x=>x!==v.id):[...s,v.id])},
          {icon:"📤",label:"مشاركة",color:"#00d4ff",action:()=>onShare(v)},
          {icon:"🤖",label:"مساعد",color:"#a855f7",action:onAI},
          {icon:"💬",label:"طالب",color:"#22c55e",action:onChat},
          {icon:"⋯",label:"المزيد",color:"#fff",action:()=>setMenuOpen(o=>!o),active:menuOpen},
        ].map((b,i)=>(
          <Btn key={i} onClick={b.action} style={{
            background: b.active ? `rgba(0,0,0,0.8)` : "rgba(0,0,0,0.55)",
            borderRadius:14,
            width:46,
            height:52,
            display:"flex",
            flexDirection:"column",
            alignItems:"center",
            justifyContent:"center",
            gap:3,
            backdropFilter:"blur(10px)",
            border: b.active ? `1.5px solid ${b.color}` : "1px solid rgba(255,255,255,0.08)",
            boxShadow: b.active ? `0 0 14px ${b.color}60` : "none",
            transition:"all 0.2s",
          }}>
            <span style={{fontSize:19}}>{b.icon}</span>
            <span style={{fontSize:8,color:b.active?b.color:"#aaa",fontWeight:700,letterSpacing:0.3}}>{b.label}</span>
          </Btn>
        ))}
      </div>

      {/* Quick menu */}
      {menuOpen && (
        <div style={{position:"absolute",inset:0,zIndex:50}} onClick={()=>setMenuOpen(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}} />
          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:0,left:0,right:0,
            background:"linear-gradient(180deg,#16161f,#0e0e16)",borderRadius:"24px 24px 0 0",
            padding:"12px 20px 32px",border:"1px solid rgba(255,255,255,0.08)",
            animation:"slideUp 0.3s ease"}}>
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.2)",margin:"0 auto 18px"}} />
            <div style={{fontSize:12,color:"#888",textAlign:"center",marginBottom:16,fontWeight:600}}>⚡ الوصول السريع</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[
                {emoji:"📷",label:"حل سؤال",color:"#f59e0b",type:"camera"},
                {emoji:"🏫",label:"صفي",color:"#00d4ff",type:"class"},
                {emoji:"🔍",label:"البحث",color:"#22c55e",type:"search"},
                {emoji:"📄",label:"PDF",color:"#ef4444",type:"pdf"},
              ].map((item,i)=>(
                <Btn key={i} onClick={()=>{setMenuOpen(false);onMenu(item.type);}}
                  style={{background:item.color+"12",border:`1.5px solid ${item.color}44`,borderRadius:16,
                    padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                  <div style={{width:40,height:40,borderRadius:12,background:item.color+"20",
                    border:`1.5px solid ${item.color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                    {item.emoji}
                  </div>
                  <span style={{fontSize:10,color:item.color,fontWeight:700}}>{item.label}</span>
                </Btn>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SEARCH TAB
// ══════════════════════════════════════════════════════
function SearchTab({videos,onTap,isUnlocked,onBack}) {
  const [q,setQ] = useState("");
  const list = videos.filter(v=>v.title.includes(q)||v.subject.includes(q)||v.teacher.includes(q));
  return (
    <div style={{height:"100%",overflow:"auto",padding:"78px 14px 14px"}}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <Btn onClick={onBack} style={{background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"8px 14px",color:"#888",fontSize:13}}>← رجوع</Btn>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن درس، مادة، معلم..."
          style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:12,padding:"9px 14px",color:"#fff",fontSize:14,outline:"none",direction:"rtl"}} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {list.map(v=>(
          <div key={v.id} onClick={()=>onTap(v)}
            style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${typeColor(v.type)}33`,
              borderRadius:14,padding:12,cursor:"pointer"}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:8}}>{v.thumbnail}</div>
            <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{v.title}</div>
            <div style={{fontSize:10,color:"#888"}}>{v.subject} • {v.stage}</div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
              <span style={{fontSize:10,color:typeColor(v.type)}}>{typeLabel(v.type)}</span>
              {!isUnlocked(v) && <span style={{fontSize:10,color:"#f59e0b"}}>🔒 {v.price.toLocaleString()}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════════════════
function ProfileTab({student,isAdmin,saved,unlocked,onLogout,wallet,adminWallet,onTopUp,showNotif}) {
  const [confirm,setConfirm] = useState(false);
  const [tab,setTab] = useState("info");

  const tabBtn = (id,label,color) => (
    <Btn onClick={()=>setTab(id)} style={{flex:1,
      background:tab===id?`linear-gradient(135deg,${color},${color}cc)`:"rgba(255,255,255,0.05)",
      borderRadius:10,padding:"9px 4px",color:tab===id?"#fff":"#888",fontSize:12,fontWeight:700}}>
      {label}
    </Btn>
  );

  return (
    <div style={{height:"100%",overflow:"auto",padding:"78px 16px 20px"}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{width:76,height:76,background:"linear-gradient(135deg,#00d4ff,#a855f7)",
          borderRadius:"50%",margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:32,boxShadow:"0 0 28px rgba(0,212,255,0.3)"}}>
          {student.name?.[0]||"👤"}
        </div>
        <div style={{fontSize:19,fontWeight:800}}>{student.name}</div>
        <div style={{fontSize:12,color:"#888",marginTop:2}}>{student.phone}</div>
        {isAdmin && <div style={{background:"#f59e0b22",color:"#f59e0b",borderRadius:20,
          padding:"3px 14px",display:"inline-block",marginTop:6,fontSize:11,fontWeight:700}}>👑 مدير النظام</div>}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:4}}>
        {tabBtn("info","📋 بياناتي","#00d4ff")}
        {tabBtn("zain","📱 زين كاش","#22c55e")}
      </div>

      {tab==="info" && (
        <>
          <div style={{background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",
            borderRadius:14,padding:14,marginBottom:14}}>
            {[["المرحلة",student.stage],["الصف",student.grade],["انضم",student.joinDate||"—"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",
                padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:13,color:"#888"}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[["المحفوظات",saved.length,"📌","#f59e0b"],["المشتريات",unlocked.length,"🔓","#22c55e"]].map(([l,n,ic,c])=>(
              <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:14,textAlign:"center",border:`1px solid ${c}22`}}>
                <div style={{fontSize:22}}>{ic}</div>
                <div style={{fontSize:22,fontWeight:800,color:c}}>{n}</div>
                <div style={{fontSize:11,color:"#888"}}>{l}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==="zain" && (
        <ZainCashCard
          wallet={isAdmin ? adminWallet : wallet}
          isAdmin={isAdmin}
          phone={student.phone}
          onTopUp={onTopUp}
          showNotif={showNotif}
        />
      )}

      <div style={{marginTop:8}}>
        {!confirm ? (
          <Btn onClick={()=>setConfirm(true)} style={{width:"100%",background:"rgba(239,68,68,0.08)",
            border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:13,color:"#ef4444",fontWeight:700,fontSize:14}}>
            🚪 تسجيل الخروج
          </Btn>
        ) : (
          <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:14,padding:16}}>
            <div style={{fontSize:14,textAlign:"center",marginBottom:12}}>هل تريد تسجيل الخروج؟</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={onLogout} style={{flex:1,background:"#ef4444",borderRadius:10,padding:10,color:"#fff",fontWeight:700}}>نعم</Btn>
              <Btn onClick={()=>setConfirm(false)} style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:10,color:"#888"}}>إلغاء</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Zain Cash Card ──
function ZainCashCard({wallet,isAdmin,phone,onTopUp,showNotif}) {
  const [amount,setAmount] = useState("");
  const [busy,setBusy] = useState(false);
  const [step,setStep] = useState("main");

  const doTopUp = async () => {
    const a = parseInt(amount);
    if (!a||a<1000) return showNotif("أدخل مبلغاً (1000 د.ع على الأقل)","error");
    setBusy(true);
    await new Promise(r=>setTimeout(r,1800));
    onTopUp(a);
    setBusy(false);
    setStep("done");
    setTimeout(()=>setStep("main"),2000);
    setAmount("");
  };

  if (step==="done") return (
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:60,marginBottom:10}}>✅</div>
      <div style={{fontSize:16,fontWeight:700,color:"#22c55e"}}>تم الشحن بنجاح!</div>
    </div>
  );

  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${isAdmin?"#f59e0b,#d97706":"#22c55e,#16a34a"})`,
        borderRadius:20,padding:22,marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:100,opacity:0.08}}>📱</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:4}}>
          {isAdmin?"محفظة المدير — زين كاش":"محفظة الطالب — زين كاش"}
        </div>
        <div style={{fontSize:34,fontWeight:900,color:"#fff",marginBottom:2}}>{wallet.balance.toLocaleString()}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>دينار عراقي</div>
        <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,0.7)",direction:"ltr",letterSpacing:2}}>
          📱 {phone}
        </div>
        <div style={{position:"absolute",bottom:14,left:16,fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:700}}>
          Zain Cash
        </div>
      </div>

      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:14,marginBottom:14,
        display:"flex",alignItems:"center",gap:12,border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:32}}>📱</div>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>Zain Cash</div>
          <div style={{fontSize:11,color:"#888"}}>بوابة الدفع الرسمية للتطبيق</div>
        </div>
        <div style={{marginRight:"auto",background:"#22c55e22",border:"1px solid #22c55e44",
          borderRadius:8,padding:"3px 10px",fontSize:10,color:"#22c55e",fontWeight:700}}>متصل</div>
      </div>

      <div style={{fontSize:12,color:"#888",marginBottom:8,fontWeight:700}}>
        📋 سجل العمليات ({wallet.txs.length})
      </div>
      <div style={{maxHeight:180,overflow:"auto",marginBottom:14}}>
        {wallet.txs.length===0
          ? <div style={{textAlign:"center",color:"#555",padding:16,fontSize:13}}>📭 لا توجد عمليات</div>
          : wallet.txs.map(tx=>(
            <div key={tx.id} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"9px 12px",
              marginBottom:6,display:"flex",alignItems:"center",gap:10,
              border:`1px solid ${tx.amount>0?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"}`}}>
              <span style={{fontSize:16}}>{tx.amount>0?"⬆️":"⬇️"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700}}>{tx.label}</div>
                <div style={{fontSize:10,color:"#666"}}>{tx.date}</div>
              </div>
              <div style={{fontWeight:800,fontSize:13,color:tx.amount>0?"#22c55e":"#ef4444"}}>
                {tx.amount>0?"+":""}{tx.amount.toLocaleString()}
              </div>
            </div>
          ))
        }
      </div>

      {!isAdmin && (
        step==="main" ? (
          <Btn onClick={()=>setStep("topup")} style={{width:"100%",
            background:"linear-gradient(135deg,#22c55e,#16a34a)",
            borderRadius:14,padding:13,color:"#fff",fontWeight:700,fontSize:14}}>
            + شحن المحفظة عبر زين كاش
          </Btn>
        ) : (
          <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:14,padding:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#22c55e",marginBottom:10}}>شحن المحفظة</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[5000,10000,25000,50000].map(a=>(
                <Btn key={a} onClick={()=>setAmount(String(a))}
                  style={{background:amount==a?"linear-gradient(135deg,#22c55e,#16a34a)":"rgba(255,255,255,0.05)",
                    border:`1px solid ${amount==a?"#22c55e":"rgba(255,255,255,0.1)"}`,
                    borderRadius:10,padding:10,color:amount==a?"#fff":"#aaa",fontWeight:700,fontSize:13}}>
                  {a.toLocaleString()}
                </Btn>
              ))}
            </div>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
              placeholder="أو أدخل مبلغاً مخصصاً (د.ع)"
              style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:14,display:"block",marginBottom:10}} />
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={doTopUp} disabled={busy} style={{flex:1,
                background:busy?"rgba(34,197,94,0.3)":"linear-gradient(135deg,#22c55e,#16a34a)",
                borderRadius:12,padding:12,color:"#fff",fontWeight:700,fontSize:14}}>
                {busy?"⏳ جاري الشحن...":"📱 شحن الآن"}
              </Btn>
              <Btn onClick={()=>setStep("main")} style={{background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"12px 16px",color:"#888"}}>✕</Btn>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ADMIN SLIDES TAB
// ══════════════════════════════════════════════════════
const SLIDE_THEMES = [
  {id:"gradient-blue", label:"أزرق متدرج", bg:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)", accent:"#00d4ff"},
  {id:"gradient-purple", label:"بنفسجي", bg:"linear-gradient(135deg,#1a0533,#4a1266,#0d001a)", accent:"#a855f7"},
  {id:"gradient-green", label:"أخضر", bg:"linear-gradient(135deg,#0a2e0a,#1a5c1a,#0d1f0d)", accent:"#22c55e"},
  {id:"gradient-orange", label:"برتقالي", bg:"linear-gradient(135deg,#2e1a00,#5c3a00,#1f1000)", accent:"#f59e0b"},
  {id:"dark", label:"داكن", bg:"linear-gradient(135deg,#0a0a0f,#111118)", accent:"#fff"},
];

const SLIDE_ICONS = ["🔢","⚗️","🧬","🌍","⚡","📐","🔭","🧪","📊","🌊","🔬","💡","🧲","🌱","☀️","🪐","🔥","❄️","💎","🎯"];

function AdminSlidesTab({videos, setVideos, prices, showNotif, onPublish}) {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [theme, setTheme] = useState(SLIDE_THEMES[0]);
  const [slides, setSlides] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [mode, setMode] = useState("generate");
  const [publishForm, setPublishForm] = useState({
    subject: SUBJECTS[0], stage: "الابتدائية", grade: "الأول",
    semester: "الأول", videoNumber: "", teacher: "شرائح تعليمية"
  });

  const generateSlides = async () => {
    if (!topic.trim()) return showNotif("أدخل موضوع الشرائح","error");
    setGenerating(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:2000,
          system:`أنت مصمم شرائح تعليمية خبير. أنشئ شرائح تعليمية مبتكرة وجميلة باللغة العربية.
رد بـ JSON فقط بدون أي نص آخر بهذا الشكل:
{"slides":[{"title":"عنوان الشريحة","content":"شرح مختصر وواضح (جملة أو جملتان)","emoji":"رمز مناسب","points":["نقطة 1","نقطة 2","نقطة 3"],"duration":5}]}
اجعل كل شريحة مثيرة للاهتمام مع معلومة مميزة.`,
          messages:[{role:"user", content:`أنشئ ${slideCount} شرائح تعليمية عن: ${topic}`}]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setSlides(parsed.slides.map((s,i)=>({...s, id:Date.now()+i, icon: s.emoji || SLIDE_ICONS[i%SLIDE_ICONS.length]})));
      setMode("edit");
      showNotif(`تم إنشاء ${parsed.slides.length} شريحة ✓`);
    } catch(e) {
      showNotif("حدث خطأ في إنشاء الشرائح","error");
    }
    setGenerating(false);
  };

  const updateSlide = (idx, field, val) => {
    setSlides(prev => prev.map((s,i) => i===idx ? {...s,[field]:val} : s));
  };

  const moveSlide = (idx, dir) => {
    const newSlides = [...slides];
    const target = idx + dir;
    if (target < 0 || target >= newSlides.length) return;
    [newSlides[idx], newSlides[target]] = [newSlides[target], newSlides[idx]];
    setSlides(newSlides);
  };

  const deleteSlide = (idx) => {
    setSlides(prev => prev.filter((_,i) => i!==idx));
    showNotif("تم حذف الشريحة");
  };

  const publishSlides = () => {
    if (!publishForm.videoNumber.trim()) return showNotif("أدخل رقم المقطع","error");
    const key = publishForm.subject+"_"+publishForm.stage;
    const p = prices[key]||{price:0,locked:false};
    const newVideo = {
      id: Date.now(),
      title: topic,
      teacher: publishForm.teacher,
      subject: publishForm.subject,
      stage: publishForm.stage,
      grade: publishForm.grade,
      semester: publishForm.semester,
      type: "animation",
      videoNumber: publishForm.videoNumber,
      duration: slides.reduce((a,s)=>a+(s.duration||5),0)+"s",
      price: p.price,
      locked: p.locked,
      thumbnail: slides[0]?.icon || "📚",
      videoUrl: null,
      slides: slides,
      theme: theme.id,
    };
    setVideos(vs=>[...vs, newVideo]);
    setMode("generate");
    setSlides([]);
    setTopic("");
    showNotif("تم نشر الشرائح على التطبيق ✓");
    if (onPublish) onPublish(newVideo);
  };

  const inp = {width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,direction:"rtl",display:"block"};
  const sel = {...inp,background:"#13131e"};

  if (mode==="generate") return (
    <div>
      <div style={{background:"linear-gradient(135deg,rgba(168,85,247,0.1),rgba(0,212,255,0.1))",border:"1px solid rgba(168,85,247,0.2)",borderRadius:16,padding:16,marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>✨</div>
        <div style={{fontSize:15,fontWeight:700,color:"#a855f7",marginBottom:4}}>استوديو الشرائح الذكي</div>
        <div style={{fontSize:12,color:"#888"}}>اكتب أي موضوع وسأنشئ لك شرائح تعليمية جميلة</div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>🎯 موضوع الشرائح</div>
        <textarea value={topic} onChange={e=>setTopic(e.target.value)}
          placeholder="مثال: الجهاز التنفسي عند الإنسان..."
          style={{...inp,height:80,resize:"none"}} />
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>📊 عدد الشرائح: {slideCount}</div>
        <div style={{display:"flex",gap:8}}>
          {[4,6,8,10,12].map(n=>(
            <button key={n} onClick={()=>setSlideCount(n)}
              style={{flex:1,background:slideCount===n?"linear-gradient(135deg,#a855f7,#7c3aed)":"rgba(255,255,255,0.05)",
                border:`1px solid ${slideCount===n?"#a855f7":"rgba(255,255,255,0.1)"}`,
                borderRadius:10,padding:"8px 0",color:slideCount===n?"#fff":"#aaa",
                fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>🎨 الثيم</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {SLIDE_THEMES.map(t=>(
            <button key={t.id} onClick={()=>setTheme(t)}
              style={{background:t.bg,border:`2px solid ${theme.id===t.id?t.accent:"transparent"}`,
                borderRadius:10,padding:"6px 12px",color:t.accent,fontSize:11,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={generateSlides} disabled={generating}
        style={{width:"100%",background:generating?"rgba(168,85,247,0.3)":"linear-gradient(135deg,#a855f7,#7c3aed)",
          border:"none",borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:15,
          cursor:generating?"not-allowed":"pointer",fontFamily:"inherit"}}>
        {generating?"⏳ جاري إنشاء الشرائح...":"✨ إنشاء الشرائح بالذكاء الاصطناعي"}
      </button>
    </div>
  );

  if (mode==="edit") return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setMode("preview")}
          style={{flex:1,background:"linear-gradient(135deg,#00d4ff,#0ea5e9)",border:"none",borderRadius:12,padding:10,color:"#fff",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          👁 معاينة
        </button>
        <button onClick={()=>setMode("generate")}
          style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:10,color:"#888",fontFamily:"inherit",cursor:"pointer"}}>
          ← إعادة إنشاء
        </button>
      </div>
      <div style={{fontSize:12,color:"#a855f7",marginBottom:10,fontWeight:700}}>
        📝 تعديل الشرائح ({slides.length} شريحة)
      </div>
      {slides.map((slide,idx)=>(
        <div key={slide.id} style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:12,marginBottom:10,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:20}}>{slide.icon}</span>
              <span style={{fontSize:12,color:"#a855f7",fontWeight:700}}>شريحة {idx+1}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>moveSlide(idx,-1)} disabled={idx===0}
                style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,width:28,height:28,color:"#888",cursor:"pointer",fontSize:14}}>↑</button>
              <button onClick={()=>moveSlide(idx,1)} disabled={idx===slides.length-1}
                style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,width:28,height:28,color:"#888",cursor:"pointer",fontSize:14}}>↓</button>
              <button onClick={()=>deleteSlide(idx)}
                style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,width:28,height:28,color:"#ef4444",cursor:"pointer",fontSize:14}}>🗑</button>
            </div>
          </div>
          {editIdx===idx ? (
            <div>
              <input value={slide.icon} onChange={e=>updateSlide(idx,"icon",e.target.value)} style={{...inp,textAlign:"center",fontSize:22,marginBottom:8}} />
              <input value={slide.title} onChange={e=>updateSlide(idx,"title",e.target.value)} style={{...inp,marginBottom:8}} />
              <textarea value={slide.content} onChange={e=>updateSlide(idx,"content",e.target.value)} style={{...inp,height:60,resize:"none",marginBottom:8}} />
              <input value={(slide.points||[]).join("،")}
                onChange={e=>updateSlide(idx,"points",e.target.value.split("،").map(p=>p.trim()).filter(Boolean))}
                style={{...inp,marginBottom:8}} />
              <button onClick={()=>setEditIdx(null)}
                style={{width:"100%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:10,padding:9,color:"#fff",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                ✓ حفظ
              </button>
            </div>
          ) : (
            <div>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{slide.title}</div>
              <div style={{fontSize:11,color:"#888",marginBottom:6}}>{slide.content}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                {(slide.points||[]).map((p,i)=>(
                  <span key={i} style={{background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10,color:"#a855f7"}}>• {p}</span>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,color:"#666"}}>⏱ {slide.duration||5} ثانية</span>
                <button onClick={()=>setEditIdx(idx)}
                  style={{background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:8,padding:"4px 12px",color:"#00d4ff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  ✏️ تعديل
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={()=>setMode("publish")}
        style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>
        🚀 نشر على التطبيق
      </button>
    </div>
  );

  if (mode==="preview") {
    const slide = slides[previewIdx];
    return (
      <div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={()=>setMode("edit")}
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:10,color:"#888",fontFamily:"inherit",cursor:"pointer"}}>
            ← تعديل
          </button>
          <button onClick={()=>setMode("publish")}
            style={{flex:1,background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:12,padding:10,color:"#fff",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            🚀 نشر
          </button>
        </div>
        <div style={{borderRadius:20,overflow:"hidden",marginBottom:12,background:theme.bg,minHeight:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",border:`1px solid ${theme.accent}33`}}>
          <div style={{fontSize:52,marginBottom:12}}>{slide?.icon}</div>
          <div style={{fontSize:18,fontWeight:800,color:theme.accent,marginBottom:8,textAlign:"center"}}>{slide?.title}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",textAlign:"center",lineHeight:1.7,marginBottom:12}}>{slide?.content}</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,width:"100%"}}>
            {(slide?.points||[]).map((p,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 12px"}}>
                <span style={{color:theme.accent,fontSize:14}}>◆</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.85)"}}>{p}</span>
              </div>
            ))}
          </div>
          <div style={{position:"absolute",bottom:10,left:12,fontSize:10,color:"rgba(255,255,255,0.4)"}}>{previewIdx+1} / {slides.length}</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>setPreviewIdx(i=>Math.max(0,i-1))} disabled={previewIdx===0}
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"none",borderRadius:12,padding:10,color:"#aaa",cursor:"pointer",fontFamily:"inherit",fontSize:16}}>← السابقة</button>
          <button onClick={()=>setPreviewIdx(i=>Math.min(slides.length-1,i+1))} disabled={previewIdx===slides.length-1}
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"none",borderRadius:12,padding:10,color:"#aaa",cursor:"pointer",fontFamily:"inherit",fontSize:16}}>التالية →</button>
        </div>
        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
          {slides.map((_,i)=>(
            <div key={i} onClick={()=>setPreviewIdx(i)}
              style={{width:i===previewIdx?20:6,height:6,borderRadius:3,background:i===previewIdx?theme.accent:"rgba(255,255,255,0.2)",cursor:"pointer",transition:"all 0.3s"}} />
          ))}
        </div>
      </div>
    );
  }

  if (mode==="publish") return (
    <div>
      <button onClick={()=>setMode("edit")}
        style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"8px 16px",color:"#888",fontFamily:"inherit",cursor:"pointer",marginBottom:14}}>
        ← رجوع للتعديل
      </button>
      <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:10}}>📍 اختر موقع الشرائح</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>المرحلة</div>
            <select value={publishForm.stage} onChange={e=>setPublishForm(p=>({...p,stage:e.target.value,grade:GRADES[e.target.value][0]}))} style={sel}>
              {STAGES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>الصف</div>
            <select value={publishForm.grade} onChange={e=>setPublishForm(p=>({...p,grade:e.target.value}))} style={sel}>
              {GRADES[publishForm.stage].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>المادة</div>
            <select value={publishForm.subject} onChange={e=>setPublishForm(p=>({...p,subject:e.target.value}))} style={sel}>
              {SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>الفصل</div>
            <select value={publishForm.semester} onChange={e=>setPublishForm(p=>({...p,semester:e.target.value}))} style={sel}>
              {["الأول","الثاني"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>رقم المقطع</div>
            <input value={publishForm.videoNumber} onChange={e=>setPublishForm(p=>({...p,videoNumber:e.target.value}))} placeholder="01" style={inp} />
          </div>
          <div>
            <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>اسم المصدر</div>
            <input value={publishForm.teacher} onChange={e=>setPublishForm(p=>({...p,teacher:e.target.value}))} placeholder="شرائح تعليمية" style={inp} />
          </div>
        </div>
      </div>
      <button onClick={publishSlides}
        style={{width:"100%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
        ✅ نشر الشرائح على التطبيق
      </button>
    </div>
  );

  return null;
}

// ══════════════════════════════════════════════════════
// ADMIN NOTIFICATIONS TAB
// ══════════════════════════════════════════════════════
function AdminNotifTab({showNotif, sendNotification}) {
  const [ntitle, setNtitle] = useState("");
  const [nbody, setNbody] = useState("");
  const [nsent, setNsent] = useState(false);

  const templates = [
    {t:"انتهاء الاشتراك", b:"انتهت مدة اشتراكك في إحدى المواد. جدد اشتراكك للاستمرار في المشاهدة."},
    {t:"مقطع جديد",       b:"تم إضافة مقطع تعليمي جديد في مادتك. شاهده الآن!"},
    {t:"تذكير بالدراسة",  b:"لا تنسَ مراجعة دروسك اليوم. الاستمرارية مفتاح النجاح 📚"},
    {t:"عرض خاص",         b:"استمتع بعرض خاص على الاشتراك في مواد جديدة. لفترة محدودة!"},
  ];

  const storedNotifs = (() => {
    try { return JSON.parse(localStorage.getItem("edutok_notifs")||"[]"); } catch { return []; }
  })();

  const doSend = () => {
    if (!ntitle.trim()) return showNotif("أدخل عنوان الإشعار","error");
    if (!nbody.trim())  return showNotif("أدخل نص الإشعار","error");
    sendNotification(ntitle.trim(), nbody.trim());
    setNsent(true);
    setTimeout(()=>{ setNsent(false); setNtitle(""); setNbody(""); }, 3000);
    showNotif("تم إرسال الإشعار ✓");
  };

  return (
    <div>
      <div style={{background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",
        borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#888"}}>
        🔔 الإشعارات تُرسل لجميع الطلاب المسجلين في التطبيق
      </div>
      <div style={{fontSize:11,color:"#888",marginBottom:8,fontWeight:700}}>قوالب جاهزة</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {templates.map((t,i)=>(
          <Btn key={i} onClick={()=>{ setNtitle(t.t); setNbody(t.b); }}
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:10,padding:"9px 8px",color:"#ccc",fontSize:11,fontWeight:600,textAlign:"right"}}>
            {t.t}
          </Btn>
        ))}
      </div>
      <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>عنوان الإشعار</div>
      <input value={ntitle} onChange={e=>setNtitle(e.target.value)} placeholder="مثال: انتهاء اشتراك الرياضيات"
        style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,direction:"rtl",display:"block",marginBottom:10}} />
      <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>نص الإشعار</div>
      <textarea value={nbody} onChange={e=>setNbody(e.target.value)} placeholder="اكتب نص الإشعار هنا..."
        style={{width:"100%",height:80,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,direction:"rtl",
          resize:"none",display:"block",marginBottom:12}} />
      {nsent ? (
        <div style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",
          borderRadius:12,padding:14,textAlign:"center",color:"#22c55e",fontWeight:700,fontSize:14}}>
          ✓ تم إرسال الإشعار لجميع الطلاب!
        </div>
      ) : (
        <Btn onClick={doSend}
          style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",
            borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:14}}>
          🔔 إرسال الإشعار لجميع الطلاب
        </Btn>
      )}
      {storedNotifs.length > 0 && (
        <div style={{marginTop:18}}>
          <div style={{fontSize:11,color:"#888",marginBottom:8,fontWeight:700}}>الإشعارات المرسلة ({storedNotifs.length})</div>
          {storedNotifs.slice(0,6).map((n,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"9px 12px",marginBottom:6,border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:2}}>{n.title}</div>
              <div style={{fontSize:11,color:"#888"}}>{n.body}</div>
              <div style={{fontSize:10,color:"#555",marginTop:4}}>{n.date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ADMIN TAB
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// PRICES TAB
// ══════════════════════════════════════════════════════
function PricesTab({prices, updatePrice, showNotif}) {
  const [pSubject, setPSubject] = useState(SUBJECTS[0]);
  const [pStage, setPStage] = useState(STAGES[0]);
  const [pPrice, setPPrice] = useState("");
  const [saved, setSaved] = useState(false);

  const key = pSubject+"_"+pStage;
  const currentPrice = prices[key]?.price ?? 0;

  const handleSave = () => {
    const val = parseInt(pPrice);
    if (isNaN(val) || val < 0) return showNotif("أدخل سعراً صحيحاً","error");
    updatePrice(key, "price", val);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
    showNotif("تم حفظ السعر ✓");
    setPPrice("");
  };

  const sel2 = {width:"100%",background:"#13131e",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:14,direction:"rtl",display:"block",fontFamily:"inherit"};

  return (
    <div>
      <div style={{background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:12,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#888"}}>
        💡 اختر المادة والمرحلة ثم أدخل السعر واضغط حفظ
      </div>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>📚 المادة</div>
        <select value={pSubject} onChange={e=>setPSubject(e.target.value)} style={sel2}>
          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>🏫 المرحلة</div>
        <select value={pStage} onChange={e=>setPStage(e.target.value)} style={sel2}>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"#888"}}>السعر الحالي</span>
        <span style={{fontSize:15,fontWeight:800,color:currentPrice===0?"#22c55e":"#f59e0b"}}>
          {currentPrice===0?"مجاني":currentPrice.toLocaleString()+" د.ع"}
        </span>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:"#888",marginBottom:6,fontWeight:700}}>💰 السعر الجديد (د.ع)</div>
        <input
          type="number"
          value={pPrice}
          onChange={e=>setPPrice(e.target.value)}
          placeholder="مثال: 5000"
          style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:16,display:"block",textAlign:"center",outline:"none",fontFamily:"inherit"}}
        />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginTop:10}}>
          {[0,2500,5000,10000].map(a=>(
            <Btn key={a} onClick={()=>setPPrice(String(a))}
              style={{background:pPrice==a?"linear-gradient(135deg,#00d4ff,#a855f7)":"rgba(255,255,255,0.05)",
                border:`1px solid ${pPrice==a?"#00d4ff":"rgba(255,255,255,0.1)"}`,
                borderRadius:10,padding:"8px 4px",color:pPrice==a?"#fff":"#aaa",fontWeight:700,fontSize:12}}>
              {a===0?"مجاني":a.toLocaleString()}
            </Btn>
          ))}
        </div>
      </div>

      <Btn onClick={handleSave}
        style={{width:"100%",background:saved?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#f59e0b,#d97706)",
          borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:15}}>
        {saved?"✓ تم الحفظ!":"💾 حفظ السعر"}
      </Btn>
    </div>
  );
}

function AdminTab({videos,setVideos,prices,updatePrice,adminWallet,adminPass,setAdminPass,adminPhone,setAdminPhone,adminTab,setAdminTab,showNotif,sendNotification,onPublish}) {
  const [showAdd,setShowAdd] = useState(false);
  const [form,setForm] = useState({title:"",teacher:"",subject:SUBJECTS[0],stage:"الابتدائية",grade:"الأول",semester:"الأول",type:"teacher",videoNumber:"",duration:"2:00",thumbnail:"📚",videoUrl:null,videoName:""});
  const [studioMode,setStudioMode] = useState("choose");
  const [recording,setRecording] = useState(false);
  const [camStream,setCamStream] = useState(null);
  const fileRef = useRef(null);
  const vidRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const [newPass,setNewPass] = useState("");
  const [newPhone,setNewPhone] = useState("");

  const addVideo = () => {
    if (!form.title.trim()) return showNotif("أدخل عنوان المقطع","error");
    if (!form.videoNumber.trim()) return showNotif("أدخل رقم المقطع","error");
    const key = form.subject+"_"+form.stage;
    const p = prices[key]||{price:0,locked:false};
    setVideos(vs=>[...vs,{...form,id:Date.now(),price:p.price,locked:p.locked}]);
    setForm({title:"",teacher:"",subject:SUBJECTS[0],stage:"الابتدائية",grade:"الأول",semester:"الأول",type:"teacher",videoNumber:"",duration:"2:00",thumbnail:"📚",videoUrl:null,videoName:""});
    setStudioMode("choose");
    setShowAdd(false);
    showNotif("تم إضافة المقطع ✓");
  };

  const pickFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return showNotif("اختر ملف فيديو","error");
    const url = URL.createObjectURL(file);
    const tmp = document.createElement("video");
    tmp.src = url;
    tmp.onloadedmetadata = () => {
      const sec = Math.round(tmp.duration);
      setForm(f=>({...f,videoUrl:url,videoName:file.name,duration:`${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,"0")}`}));
    };
    setStudioMode("preview");
    showNotif("تم اختيار الفيديو ✓");
  };

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:true});
      setCamStream(s);
      if (vidRef.current) vidRef.current.srcObject = s;
      setStudioMode("camera");
    } catch { showNotif("تعذّر الوصول للكاميرا","error"); }
  };

  const startRec = () => {
    if (!camStream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(camStream,{mimeType:"video/webm"});
    mr.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current,{type:"video/webm"});
      const url = URL.createObjectURL(blob);
      setForm(f=>({...f,videoUrl:url,videoName:"تسجيل.webm"}));
      stopCam();
      setStudioMode("preview");
      showNotif("تم التسجيل ✓");
    };
    mrRef.current = mr;
    mr.start();
    setRecording(true);
  };

  const stopRec = () => { mrRef.current?.stop(); setRecording(false); };
  const stopCam = () => { camStream?.getTracks().forEach(t=>t.stop()); setCamStream(null); if(vidRef.current) vidRef.current.srcObject=null; };

  const inp = {width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,direction:"rtl",display:"block",marginBottom:0};
  const sel = {...inp,background:"#13131e"};
  const lbl = {fontSize:11,color:"#888",marginBottom:5,display:"block",fontWeight:600};

  const tabs = [["videos","🎬 المقاطع"],["slides","✨ شرائح"],["students","👥 الطلاب"],["prices","💰 الأسعار"],["notifs","🔔 إشعارات"],["settings","⚙️ الإعدادات"]];

  return (
    <div style={{height:"100%",overflow:"auto",padding:"78px 14px 14px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:16}}>
        {tabs.map(([id,label])=>(
          <Btn key={id} onClick={()=>setAdminTab(id)}
            style={{background:adminTab===id?"linear-gradient(135deg,#f59e0b,#ef4444)":"rgba(255,255,255,0.06)",
              borderRadius:12,padding:"7px 6px",color:"#fff",fontSize:11,fontWeight:600,
              textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {label}
          </Btn>
        ))}
      </div>

      {adminTab==="videos" && (
        <div>
          <Btn onClick={()=>setShowAdd(v=>!v)}
            style={{width:"100%",background:showAdd?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#00d4ff,#a855f7)",
              borderRadius:14,padding:14,color:"#fff",fontWeight:700,fontSize:14,marginBottom:14}}>
            {showAdd?"✕ إغلاق النموذج":"+ إضافة مقطع جديد"}
          </Btn>
          {showAdd && (
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:16,padding:16,marginBottom:14,border:"1px solid rgba(0,212,255,0.2)"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#00d4ff",marginBottom:14}}>📋 بيانات المقطع</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>المرحلة</label>
                  <select style={sel} value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value,grade:GRADES[e.target.value][0]}))}>
                    {STAGES.map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div><label style={lbl}>الصف</label>
                  <select style={sel} value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))}>
                    {GRADES[form.stage].map(g=><option key={g}>{g}</option>)}
                  </select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>المادة</label>
                  <select style={sel} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
                    {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div><label style={lbl}>الفصل</label>
                  <select style={sel} value={form.semester} onChange={e=>setForm(f=>({...f,semester:e.target.value}))}>
                    {["الأول","الثاني"].map(s=><option key={s}>{s}</option>)}
                  </select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>نوع المقطع</label>
                  <select style={sel} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option value="teacher">👨‍🏫 معلم</option>
                    <option value="ai">🤖 ذكاء اصطناعي</option>
                    <option value="animation">🎨 رسوم متحركة</option>
                  </select></div>
                <div><label style={lbl}>رقم المقطع</label>
                  <input style={inp} value={form.videoNumber} onChange={e=>setForm(f=>({...f,videoNumber:e.target.value}))} placeholder="01" /></div>
              </div>
              <div style={{marginBottom:10}}><label style={lbl}>العنوان</label>
                <input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="عنوان المقطع" /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={lbl}>المعلم</label>
                  <input style={inp} value={form.teacher} onChange={e=>setForm(f=>({...f,teacher:e.target.value}))} placeholder="أ. محمد" /></div>
                <div><label style={lbl}>الرمز</label>
                  <input style={{...inp,fontSize:20,textAlign:"center"}} value={form.thumbnail} onChange={e=>setForm(f=>({...f,thumbnail:e.target.value}))} placeholder="📚" /></div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={lbl}>🎬 الفيديو</label>
                <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#f59e0b"}}>
                  💡 في التطبيق المنشور يعمل رفع الفيديو والكاميرا بشكل كامل
                </div>
                {studioMode==="choose" && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <label style={{background:"rgba(0,212,255,0.08)",border:"1.5px solid rgba(0,212,255,0.3)",borderRadius:12,padding:"14px 8px",color:"#00d4ff",fontWeight:700,fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
                      <span style={{fontSize:26}}>📁</span>اختر من الجهاز
                      <input type="file" accept="video/*" style={{display:"none"}} onChange={pickFile} />
                    </label>
                    <Btn onClick={startCam} style={{background:"rgba(168,85,247,0.08)",border:"1.5px solid rgba(168,85,247,0.3)",borderRadius:12,padding:"14px 8px",color:"#a855f7",fontWeight:700,fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                      <span style={{fontSize:26}}>🎥</span>سجّل من الكاميرا
                    </Btn>
                    <div style={{gridColumn:"span 2"}}>
                      <div style={{fontSize:11,color:"#888",marginBottom:5,fontWeight:600}}>أو أدخل رابط فيديو مباشر</div>
                      <div style={{display:"flex",gap:8}}>
                        <input id="video-url-input" placeholder="https://example.com/video.mp4"
                          style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:12,direction:"ltr"}} />
                        <Btn onClick={()=>{
                          const url = document.getElementById("video-url-input").value.trim();
                          if(!url) return showNotif("أدخل رابط الفيديو","error");
                          setForm(f=>({...f,videoUrl:url,videoName:url.split("/").pop()||"فيديو"}));
                          setStudioMode("preview");
                          showNotif("تم إضافة الرابط ✓");
                        }} style={{background:"linear-gradient(135deg,#00d4ff,#a855f7)",borderRadius:10,padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                          إضافة ▶
                        </Btn>
                      </div>
                    </div>
                  </div>
                )}
                {studioMode==="camera" && (
                  <div style={{background:"#000",borderRadius:12,overflow:"hidden",position:"relative"}}>
                    <video ref={vidRef} autoPlay muted playsInline style={{width:"100%",maxHeight:200,display:"block",objectFit:"cover"}} />
                    <div style={{position:"absolute",bottom:8,left:0,right:0,display:"flex",justifyContent:"center",gap:12}}>
                      {!recording ? (
                        <Btn onClick={startRec} style={{background:"#ef4444",border:"3px solid #fff",borderRadius:"50%",width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:18,height:18,borderRadius:"50%",background:"#fff"}} />
                        </Btn>
                      ) : (
                        <Btn onClick={stopRec} style={{background:"#ef4444",border:"3px solid #fff",borderRadius:"50%",width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1s infinite"}}>
                          <div style={{width:16,height:16,borderRadius:3,background:"#fff"}} />
                        </Btn>
                      )}
                      <Btn onClick={()=>{stopCam();setStudioMode("choose");}} style={{background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"50%",width:42,height:42,color:"#fff",fontSize:16}}>✕</Btn>
                    </div>
                    {recording && <div style={{position:"absolute",top:8,right:8,background:"#ef4444",borderRadius:8,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700}}>⏺ جاري التسجيل</div>}
                  </div>
                )}
                {studioMode==="preview" && form.videoUrl && (
                  <div>
                    <video src={form.videoUrl} controls style={{width:"100%",borderRadius:10,maxHeight:180,background:"#000",display:"block",marginBottom:6}} onError={()=>showNotif("تعذّر تشغيل الفيديو","error")} />
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>✓ {form.videoName}</span>
                      <Btn onClick={()=>{if(form.videoUrl&&form.videoUrl.startsWith("blob:"))URL.revokeObjectURL(form.videoUrl);setForm(f=>({...f,videoUrl:null,videoName:""}));setStudioMode("choose");}} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"4px 10px",color:"#ef4444",fontSize:11}}>حذف</Btn>
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={addVideo} style={{flex:1,background:"linear-gradient(135deg,#00d4ff,#a855f7)",borderRadius:12,padding:12,color:"#fff",fontWeight:700,fontSize:14}}>✓ حفظ</Btn>
                <Btn onClick={()=>{setShowAdd(false);setStudioMode("choose");}} style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:12,color:"#888"}}>إلغاء</Btn>
              </div>
            </div>
          )}
          {videos.map(v=>(
            <div key={v.id} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:12,marginBottom:8,display:"flex",gap:10,alignItems:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
              <span style={{fontSize:26}}>{v.thumbnail}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>#{v.videoNumber} {v.title}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.stage} • {v.grade} • {v.subject}</div>
                <div style={{fontSize:10,color:"#666"}}>{typeLabel(v.type)} • {v.teacher||"—"} • ⏱{v.duration}</div>
              </div>
              <Btn onClick={()=>setVideos(vs=>vs.filter(x=>x.id!==v.id))} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"6px 10px",color:"#ef4444"}}>🗑</Btn>
            </div>
          ))}
        </div>
      )}

      {adminTab==="students" && (()=>{
        const list = getStudents();
        return (
          <div>
            <div style={{fontSize:13,color:"#888",marginBottom:12,background:"rgba(0,212,255,0.06)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(0,212,255,0.15)"}}>
              إجمالي الطلاب: <strong style={{color:"#00d4ff"}}>{list.length}</strong>
            </div>
            {list.length===0 ? (
              <div style={{textAlign:"center",color:"#555",padding:40}}>
                <div style={{fontSize:40,marginBottom:8}}>👤</div>
                <div>لا يوجد طلاب مسجلون بعد</div>
              </div>
            ) : list.map((s,i)=>(
              <div key={s.id||i} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:12,marginBottom:8,display:"flex",gap:10,alignItems:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{width:40,height:40,background:"linear-gradient(135deg,#00d4ff,#a855f7)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,flexShrink:0}}>{s.name?.[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{s.name}</div>
                  <div style={{fontSize:11,color:"#888"}}>📱 {s.phone}</div>
                  <div style={{fontSize:10,color:"#666"}}>🏫 {s.stage} • {s.grade} • انضم: {s.joinDate}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {adminTab==="prices" && <PricesTab prices={prices} updatePrice={updatePrice} showNotif={showNotif} />}

      {adminTab==="slides" && <AdminSlidesTab videos={videos} setVideos={setVideos} prices={prices} showNotif={showNotif} onPublish={onPublish} />}
      {adminTab==="notifs" && <AdminNotifTab showNotif={showNotif} sendNotification={sendNotification} />}

      {adminTab==="settings" && (
        <div>
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:14,padding:14,marginBottom:14}}>
            <div style={{fontSize:12,color:"#f59e0b",fontWeight:700,marginBottom:8}}>👑 بيانات المدير الحالية</div>
            {[["📱 رقم الهاتف",adminPhone],["🔑 كلمة المرور","••••••••"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span style={{color:"#888"}}>{l}</span>
                <span style={{fontWeight:700,direction:"ltr"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#00d4ff",marginBottom:10}}>📱 تغيير رقم الهاتف</div>
            <input style={{...inp,marginBottom:10,display:"block"}} type="tel" value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="07XX XXX XXXX" />
            <Btn onClick={()=>{if(newPhone.length<10)return showNotif("رقم غير صحيح","error");adminCreds.phone=newPhone;setAdminPhone(newPhone);setNewPhone("");showNotif("تم تغيير رقم الهاتف ✓");}}
              style={{width:"100%",background:"linear-gradient(135deg,#00d4ff,#0ea5e9)",borderRadius:12,padding:11,color:"#fff",fontWeight:700}}>
              تغيير رقم الهاتف
            </Btn>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#ef4444",marginBottom:10}}>🔑 تغيير كلمة المرور</div>
            <input style={{...inp,marginBottom:10,display:"block"}} type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="كلمة المرور الجديدة" />
            <Btn onClick={()=>{if(newPass.length<6)return showNotif("كلمة المرور قصيرة","error");adminCreds.password=newPass;setAdminPass(newPass);setNewPass("");showNotif("تم تغيير كلمة المرور ✓");}}
              style={{width:"100%",background:"linear-gradient(135deg,#ef4444,#dc2626)",borderRadius:12,padding:11,color:"#fff",fontWeight:700}}>
              تغيير كلمة المرور
            </Btn>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#a855f7",marginBottom:10}}>📊 إحصائيات</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["🎬",videos.length,"المقاطع"],["🔒",videos.filter(v=>v.locked).length,"المدفوعة"],
                ["🔓",videos.filter(v=>!v.locked).length,"المجانية"],["💰",adminWallet.balance.toLocaleString(),"د.ع المستلمة"]
              ].map(([ic,n,l])=>(
                <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:22}}>{ic}</div>
                  <div style={{fontSize:20,fontWeight:700,color:"#a855f7"}}>{n}</div>
                  <div style={{fontSize:11,color:"#888"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SLIDE PLAYER
// ══════════════════════════════════════════════════════
function SlidePlayer({video, isUnlocked, onTap, onClose}) {
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState("idle");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const startY = useRef(null);
  const timerRef = useRef(null);
  const progRef = useRef(null);
  const slides = video.slides || [];
  const slide = slides[idx];
  const theme = SLIDE_THEMES.find(t=>t.id===video.theme) || SLIDE_THEMES[0];
  const unlocked = isUnlocked(video);

  useEffect(()=>{
    const el = document.getElementById("slide-player-wrap");
    if (!el) return;
    const ts = e=>{ startY.current=e.touches[0].clientY; };
    const te = e=>{
      const d = startY.current - e.changedTouches[0].clientY;
      if (Math.abs(d)>50) {
        if (d>0 && idx<slides.length-1) goTo(idx+1,"up");
        else if (d<0 && idx>0) goTo(idx-1,"down");
      }
    };
    el.addEventListener("touchstart",ts,{passive:true});
    el.addEventListener("touchend",te,{passive:true});
    return ()=>{ el.removeEventListener("touchstart",ts); el.removeEventListener("touchend",te); };
  },[idx,slides.length]);

  useEffect(()=>{
    clearTimeout(timerRef.current);
    clearInterval(progRef.current);
    setProgress(0);
    if (!playing || !unlocked) return;
    const dur = (slide?.duration||6)*1000;
    const start = Date.now();
    progRef.current = setInterval(()=>{
      const p = Math.min(((Date.now()-start)/dur)*100,100);
      setProgress(p);
    },50);
    timerRef.current = setTimeout(()=>{
      if (idx<slides.length-1) goTo(idx+1,"up");
      else { setPlaying(false); setProgress(0); }
    },dur);
    return ()=>{ clearTimeout(timerRef.current); clearInterval(progRef.current); };
  },[playing,idx]);

  const goTo = (next,dir)=>{
    setPlaying(false);
    setProgress(0);
    setAnim(dir);
    setTimeout(()=>{ setIdx(next); setAnim("idle"); },280);
  };

  if (!slide) return null;
  const ty = anim==="up"?"-100%":anim==="down"?"100%":"0%";

  return (
    <div id="slide-player-wrap" style={{position:"absolute",inset:0,overflow:"hidden",background:"#000"}}>
      <div style={{position:"absolute",inset:0,background:theme.bg,transform:`translateY(${ty})`,transition:"transform 0.28s cubic-bezier(0.4,0,0.2,1)",display:"flex",flexDirection:"column"}}>
        <div style={{position:"absolute",top:-80,right:-80,width:260,height:260,borderRadius:"50%",background:theme.accent+"0e",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:180,height:180,borderRadius:"50%",background:theme.accent+"09",pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"54px 18px 10px",background:"linear-gradient(rgba(0,0,0,0.5),transparent)",flexShrink:0}}>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <div style={{fontSize:12,fontWeight:800,color:theme.accent}}>{video.subject} • {video.stage} • {video.grade}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>الفصل {video.semester} • مقطع {video.videoNumber}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{background:"rgba(0,0,0,0.4)",borderRadius:10,padding:"3px 10px",fontSize:11,color:"rgba(255,255,255,0.5)"}}>{idx+1} / {slides.length}</div>
            {onClose && <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:"50%",width:32,height:32,color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>}
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 22px",overflow:"hidden"}}>
          <div style={{fontSize:64,lineHeight:1,marginBottom:14,filter:`drop-shadow(0 0 22px ${theme.accent}aa)`}}>{slide.icon}</div>
          <div style={{fontSize:20,fontWeight:900,color:theme.accent,textAlign:"center",marginBottom:10,lineHeight:1.3}}>{slide.title}</div>
          <div style={{fontSize:12.5,color:"rgba(255,255,255,0.78)",textAlign:"center",lineHeight:1.85,marginBottom:14,maxWidth:340}}>{slide.content}</div>
          {slide.formula && (
            <div style={{background:theme.accent+"1a",border:`2px solid ${theme.accent}55`,borderRadius:14,padding:"10px 24px",fontSize:16,fontWeight:900,color:theme.accent,fontFamily:"monospace",letterSpacing:1.5,marginBottom:14,direction:"ltr",textAlign:"center",boxShadow:`0 0 18px ${theme.accent}22`}}>{slide.formula}</div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:7,width:"100%",maxWidth:360}}>
            {(slide.points||[]).slice(0,3).map((p,i)=>(
              <div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",background:"rgba(255,255,255,0.07)",border:`1px solid ${theme.accent}18`,borderRadius:11,padding:"8px 12px"}}>
                <span style={{color:theme.accent,fontSize:13,flexShrink:0,marginTop:2}}>◆</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.87)",lineHeight:1.6}}>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{height:2,background:"rgba(255,255,255,0.1)",flexShrink:0}}>
          <div style={{height:"100%",background:theme.accent,width:`${playing?progress:((idx+1)/slides.length*100)}%`,transition:playing?"none":"width 0.3s"}}/>
        </div>
        {unlocked && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 24px 28px",background:"linear-gradient(transparent,rgba(0,0,0,0.6))",flexShrink:0}}>
            <button onClick={()=>goTo(idx-1,"down")} disabled={idx===0}
              style={{background:"rgba(255,255,255,0.08)",border:`1px solid ${idx===0?"rgba(255,255,255,0.08)":theme.accent+"44"}`,borderRadius:14,padding:"9px 18px",color:idx===0?"#444":theme.accent,fontSize:13,fontWeight:700,cursor:idx===0?"not-allowed":"pointer",fontFamily:"inherit"}}>← السابقة</button>
            <button onClick={()=>setPlaying(p=>!p)}
              style={{background:playing?theme.accent:"transparent",border:`2px solid ${theme.accent}`,borderRadius:"50%",width:50,height:50,color:playing?"#000":theme.accent,cursor:"pointer",fontSize:20,fontWeight:700,fontFamily:"inherit",boxShadow:playing?`0 0 20px ${theme.accent}66`:"none",transition:"all 0.2s"}}>
              {playing?"⏸":"▶"}
            </button>
            <button onClick={()=>goTo(idx+1,"up")} disabled={idx===slides.length-1}
              style={{background:"rgba(255,255,255,0.08)",border:`1px solid ${idx===slides.length-1?"rgba(255,255,255,0.08)":theme.accent+"44"}`,borderRadius:14,padding:"9px 18px",color:idx===slides.length-1?"#444":theme.accent,fontSize:13,fontWeight:700,cursor:idx===slides.length-1?"not-allowed":"pointer",fontFamily:"inherit"}}>التالية →</button>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"center",gap:5,paddingBottom:unlocked?0:16,flexShrink:0}}>
          {slides.map((_,i)=>(
            <div key={i} onClick={()=>goTo(i,i>idx?"up":"down")} style={{width:i===idx?20:6,height:6,borderRadius:3,background:i===idx?theme.accent:"rgba(255,255,255,0.2)",cursor:"pointer",transition:"all 0.3s"}}/>
          ))}
        </div>
        {!unlocked && (
          <div onClick={()=>onTap(video)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(6px)"}}>
            <div style={{fontSize:48,marginBottom:10}}>🔒</div>
            <div style={{fontSize:14,color:"#ccc",marginBottom:6}}>اشتراك في مادة</div>
            <div style={{fontSize:26,fontWeight:900,color:"#f59e0b"}}>{video.price.toLocaleString()} د.ع</div>
            <div style={{fontSize:11,color:"#aaa",background:"rgba(245,158,11,0.15)",borderRadius:10,padding:"4px 14px",marginTop:8}}>اضغط للاشتراك</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════
function BottomSheet({title,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)"}} onClick={onClose} />
