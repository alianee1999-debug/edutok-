import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc, setDoc, getDoc, doc, query, orderBy } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { Bookmark, Share2, Bot, MessageCircle, MoreHorizontal, FileText, Camera, Search, ChevronUp, ChevronDown, Settings, User, Home, Bell, DollarSign, Users, Layers, Film, Sparkles, X, Save, BookOpen, GraduationCap, Plus, Play, Pause, Loader } from "lucide-react";

// ─── FIREBASE ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:"AIzaSyA1mskTWMsVV9dpO3I7hVxZx9LUtbzNjuo",
  authDomain:"edutok-a48f9.firebaseapp.com",
  projectId:"edutok-a48f9",
  storageBucket:"edutok-a48f9.firebasestorage.app",
  messagingSenderId:"742519479032",
  appId:"1:742519479032:web:0d0606bcaf75c95a51f90d"
};
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// ─── PWA SERVICE WORKER ──────────────────────────────────
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("/sw.js")
      .then(()=>console.log("SW registered"))
      .catch(()=>console.log("SW registration failed"));
  });
}

// ─── KEYS & CONSTANTS ───────────────────────────────────
// ✅ تم نقل مفتاح Groq إلى السيرفر (api/groq.js) ولا يظهر هنا بعد الآن
// ✅ تم نقل مفتاح ImgBB إلى السيرفر (api/imgbb.js) ولا يظهر هنا بعد الآن
// ✅ تم استبدال بيانات المدير الثابتة بـ Firebase Authentication الحقيقي
const ZAINCASH_NUM = "07700000000";
const LOGO         = "https://cdn-icons-png.flaticon.com/512/8841/8841503.png";

const SUBJECTS     = ["الرياضيات","العلوم","اللغة العربية","اللغة الإنجليزية","الفيزياء","الكيمياء","الأحياء","التربية الإسلامية","التاريخ"];
const STAGES       = ["الابتدائية","المتوسطة","الإعدادية"];
const GRADES       = {"الابتدائية":["الأول","الثاني","الثالث","الرابع","الخامس","السادس"],"المتوسطة":["الأول","الثاني","الثالث"],"الإعدادية":["الأول","الثاني","الثالث"]};
const SEMESTERS    = ["الأول","الثاني","الثالث"];
const CLIP_TYPES   = ["معلم","طالب","مراجعة","اختبار"];
const PRICE_SUBJECTS = ["الرياضيات","العلوم","اللغة العربية","اللغة الإنجليزية","الفيزياء","الكيمياء","الأحياء","التربية الإسلامية","ملازم PDF"];
const THEMES       = [{label:"برتقالي",color:"#b45309"},{label:"أخضر",color:"#166534"},{label:"بنفسجي",color:"#5b21b6"},{label:"أزرق متدرج",color:"#0c4a6e"},{label:"داكن",color:"#27272a"}];
const THEME_STYLES = {
  "برتقالي"    :{bg:"linear-gradient(135deg,#7c2d12,#c2410c)",accent:"#fb923c",card:"rgba(194,65,12,0.25)"},
  "أخضر"       :{bg:"linear-gradient(135deg,#14532d,#15803d)",accent:"#4ade80",card:"rgba(21,128,61,0.25)"},
  "بنفسجي"     :{bg:"linear-gradient(135deg,#4c1d95,#6d28d9)",accent:"#c4b5fd",card:"rgba(109,40,217,0.25)"},
  "أزرق متدرج":{bg:"linear-gradient(135deg,#0c4a6e,#0369a1)",accent:"#38bdf8",card:"rgba(3,105,161,0.25)"},
  "داكن"       :{bg:"linear-gradient(135deg,#09090b,#18181b)",accent:"#a1a1aa",card:"rgba(255,255,255,0.06)"},
};
const DURATIONS    = [{label:"شهري — 30 يوم",days:30},{label:"فصلي — 90 يوم",days:90},{label:"سنوي — 365 يوم",days:365}];
const ADMIN_TABS   = [
  {key:"clips",         label:"المقاطع",   Icon:Film},
  {key:"slides",        label:"شرائح",     Icon:Layers},
  {key:"animation",     label:"أنيميشن",   Icon:Sparkles},
  {key:"editor",        label:"تعديل",     Icon:Save},
  {key:"pdf",           label:"PDF",        Icon:FileText},
  {key:"wallet",        label:"المحفظة",   Icon:DollarSign},
  {key:"students",      label:"الطلاب",    Icon:Users},
  {key:"prices",        label:"الأسعار",   Icon:Bell},
  {key:"notifications", label:"إشعارات",   Icon:Bell},
  {key:"settings",      label:"الإعدادات", Icon:Settings},
];
const SAMPLE_VIDEOS = [];

// ─── SUBSCRIPTION HELPERS ───────────────────────────────
const subKey = (subject,stage) => subject+"__"+stage;
const isSubscribed = (subs,subject,stage) => {
  if(!subs||!subject||!stage) return false;
  const s=subs[subKey(subject,stage)];
  return s && new Date(s.expiresAt)>new Date();
};
const daysLeft = (subs,subject,stage) => {
  if(!subs||!subject||!stage) return 0;
  const s=subs[subKey(subject,stage)];
  if(!s) return 0;
  return Math.max(0,Math.ceil((new Date(s.expiresAt)-new Date())/86400000));
};
// هل المادة مجانية؟ (سعرها = 0 أو غير محدد)
const isFreeSubject = (prices,subject,stage) => {
  if(!prices||!subject||!stage) return true; // لو الأسعار ما حُملت بعد، نفترض مجاني
  const key = subject+"__"+stage;
  const p = prices[key];
  return !p || Number(p)===0;
};
// هل الطالب يملك صلاحية الوصول؟ (مشترك أو المادة مجانية)
const hasAccess = (subs,prices,subject,stage) => {
  return isFreeSubject(prices,subject,stage) || isSubscribed(subs,subject,stage);
};

// ─── SESSION PERSISTENCE ─────────────────────────────────
const saveSession = (student, role) => {
  try { localStorage.setItem("edutok_session", JSON.stringify({student, role})); } catch{}
};
const loadSession = () => {
  try { return JSON.parse(localStorage.getItem("edutok_session")||"null"); } catch{ return null; }
};
const clearSession = () => {
  try { localStorage.removeItem("edutok_session"); } catch{}
};

// ─── PASSWORD HASHING (SHA-256 + ملح عشوائي لكل طالب) ───
const bufferToHex = (buf) => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
const randomSalt = () => bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
};
// يولّد {hash, salt} من كلمة مرور خام، لتخزينها في Firestore بدل النص الواضح
const hashPassword = async (plainPass) => {
  const salt = randomSalt();
  const hash = await sha256Hex(salt + ":" + plainPass);
  return { hash, salt };
};
// يتحقق من تطابق كلمة مرور خام مع hash/salt مخزّنين مسبقاً
const verifyPassword = async (plainPass, hash, salt) => {
  if(!hash || !salt) return false;
  const candidate = await sha256Hex(salt + ":" + plainPass);
  return candidate === hash;
};

// ─── YOUTUBE HELPER ─────────────────────────────────────
const getYoutubeId = (url) => {
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|m\.youtube\.com\/watch\?v=)([^&\n?#]+)/);
  return m ? m[1] : null;
};

// ─── GROQ AI (عبر السيرفر، المفتاح غير مكشوف بالمتصفح) ──
const callGroq = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  const res = await fetch("/api/groq", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt, imageBase64, imageMime })
  });
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.error) throw new Error(d.error||"خطأ بالاتصال بالمساعد الذكي");
  return d.text || "";
};
const callGemini = callGroq;


// ─── IMGBB UPLOAD (عبر السيرفر، المفتاح غير مكشوف) ─────
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(",")[1]); // إزالة data:...;base64,
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const uploadToImgBB = async (file) => {
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/imgbb", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ imageBase64: base64 })
  });
  let d;
  try{ d = await res.json(); }
  catch{
    if(res.status===413) throw new Error("الصورة كبيرة جداً، حاول بصورة أصغر أو أقل دقة");
    throw new Error("تعذّر الاتصال بالخادم (رمز "+res.status+")");
  }
  if(d.url) return {url:d.url, base64:d.base64||null};
  throw new Error(d.error||"فشل رفع الصورة");
};

// ─── STYLES ─────────────────────────────────────────────
const C = {
  app:{width:"100%",maxWidth:"420px",minHeight:"100vh",backgroundColor:"#09090b",color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif",direction:"rtl",margin:"0 auto",paddingBottom:"72px",boxSizing:"border-box",overflowX:"hidden",overflowY:"auto",position:"relative"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoRow:{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"},
  section:{padding:"16px"},
  twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  tabsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"6px",padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  tab:(a)=>({padding:"8px 4px",borderRadius:"10px",border:"none",fontSize:"10px",fontWeight:"bold",cursor:"pointer",backgroundColor:a?"#f97316":"#27272a",color:"#fff",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:"3px"}),
  label:{display:"block",fontSize:"13px",color:"#a1a1aa",marginBottom:"6px"},
  input:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none"},
  select:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none",appearance:"none"},
  gradBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#f97316,#ef4444)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px",marginBottom:"10px"},
  blueBtn:{width:"100%",padding:"14px",backgroundColor:"#0ea5e9",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  redBtn:{width:"100%",padding:"14px",backgroundColor:"#ef4444",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  purpleBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#7c3aed,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px"},
  primaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px"},
  secondaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.12)",backgroundColor:"#18181b",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer"},
  saveRow:{display:"flex",gap:"10px",marginTop:"8px"},
  cancelBtn:{flex:1,padding:"14px",backgroundColor:"#27272a",color:"#a1a1aa",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  saveBtn:{flex:1,padding:"14px",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  adminBtn:{background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"},
  infoBanner:{backgroundColor:"rgba(8,47,73,0.4)",border:"1px solid #0369a1",borderRadius:"12px",padding:"12px",fontSize:"13px",color:"#38bdf8",marginBottom:"16px",display:"flex",alignItems:"center",gap:"6px"},
  card:{backgroundColor:"#18181b",borderRadius:"14px",padding:"14px 16px",marginBottom:"10px",border:"1px solid rgba(255,255,255,0.04)"},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"64px",backgroundColor:"#09090b",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:100,boxSizing:"border-box"},
  navItem:(a)=>({display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:a?"#38bdf8":"#71717a",gap:"2px",padding:"4px"}),
  welcomeWrap:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",minHeight:"88vh"},
  welcomeTitle:{fontSize:"36px",fontWeight:"900",background:"linear-gradient(to right,#38bdf8,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:"12px 0 4px"},
  priceRow:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#18181b",padding:"10px 16px",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.04)"},
  priceInput:{width:"100%",background:"none",border:"none",color:"#fff",textAlign:"right",fontSize:"14px",outline:"none"},
  statsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"10px"},
  statCard:{backgroundColor:"#18181b",padding:"16px 12px",borderRadius:"14px",textAlign:"center",border:"1px solid rgba(255,255,255,0.03)"},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:200,padding:"16px"},
  modalBox:{backgroundColor:"#18181b",borderRadius:"24px",padding:"24px",width:"100%",maxWidth:"380px",maxHeight:"88vh",overflowY:"auto"},
  videoWrap:{position:"relative",width:"calc(100% - 32px)",height:"500px",margin:"16px auto",borderRadius:"24px",border:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"center",alignItems:"center",overflow:"hidden"},
  confirmBox:{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"},
  sidebar:{position:"absolute",left:"16px",top:0,bottom:0,display:"flex",flexDirection:"column",justifyContent:"space-evenly",alignItems:"center",zIndex:15},
  sideBtn:(a)=>({width:"50px",height:"50px",borderRadius:"50%",backgroundColor:a?"rgba(34,211,238,0.2)":"rgba(15,23,42,0.75)",border:a?"1px solid #22d3ee":"1px solid rgba(255,255,255,0.1)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",cursor:"pointer",color:"#fff",gap:"1px"}),
  sideTxt:(a)=>({fontSize:"10px",color:a?"#22d3ee":"#cbd5e1"}),
  moreMenu:{position:"absolute",bottom:"20px",left:"16px",right:"16px",backgroundColor:"rgba(24,24,27,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px",padding:"14px 12px",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:30,backdropFilter:"blur(12px)"},
  moreItem:{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:"#fff",padding:"4px 8px"},
  // ── وضع ملء الشاشة (الشاشة الرئيسية فقط) ──
  fullScreenWrap:{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"100vh",backgroundColor:"#000",overflow:"hidden",zIndex:1},
  fullHeader:{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",zIndex:20,background:"linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0))"},
  floatingNav:{position:"absolute",bottom:0,left:0,right:0,display:"flex",justifyContent:"space-around",alignItems:"center",padding:"10px 0 48px",zIndex:25,background:"linear-gradient(0deg,rgba(0,0,0,0.75),rgba(0,0,0,0))"},
};

// ─── SHARED COMPONENTS ──────────────────────────────────
const Spinner = ({color="#38bdf8",size=24}) => (
  <div style={{display:"inline-block",animation:"spin 1s linear infinite"}}>
    <Loader size={size} color={color}/>
    <style dangerouslySetInnerHTML={{__html:"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
  </div>
);
const MHead = ({icon,title,color,onClose}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>{icon}<span style={{fontWeight:"bold",fontSize:"16px",color:color||"#fff"}}>{title}</span></div>
    <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#71717a"}}><X size={20}/></button>
  </div>
);
const ErrBox = ({msg}) => msg?<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"14px",textAlign:"center"}}>! {msg}</div>:null;

// ─── TOAST NOTIFICATION ──────────────────────────────────
let _setToast = null;
const showMsg = (msg) => { if(_setToast) _setToast(msg); };
const Toast = () => {
  const [msg,setMsg] = useState("");
  _setToast = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3000); };
  if(!msg) return null;
  return (
    <div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",
      backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.15)",
      borderRadius:"12px",padding:"12px 20px",fontSize:"13px",color:"#fff",
      zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",maxWidth:"320px",
      textAlign:"center",direction:"rtl"}}>
      {msg}
    </div>
  );
};

// ─── IMAGE UPLOADER ──────────────────────────────────────
const ImageUploader = ({onUpload, onBase64, color="#34d399", label="اضغط لرفع صورة"}) => {
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  const handleFile=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    try{
      const result=await uploadToImgBB(file);
      setPreview(result.url);
      onUpload && onUpload(result.url);
      onBase64 && onBase64(result.base64);
    }catch{showMsg("فشل رفع الصورة، حاول مرة أخرى");}
    setUploading(false);
  };
  return (
    <div style={{marginBottom:"12px"}}>
      {preview&&<img src={preview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
      {uploading
        ?<div style={{textAlign:"center",padding:"16px",color}}><Spinner color={color}/><div style={{marginTop:"8px",fontSize:"12px"}}>جارٍ رفع الصورة...</div></div>
        :<label style={{display:"block",width:"100%",padding:"16px",backgroundColor:"rgba(52,211,153,0.08)",border:"2px dashed rgba(52,211,153,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
          <Camera size={28} color={color} style={{margin:"0 auto 6px"}}/>
          <div style={{fontSize:"13px",color,fontWeight:"bold"}}>{preview?"تغيير الصورة":label}</div>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"3px"}}>من الكاميرا أو معرض الصور</div>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
      }
    </div>
  );
};

// ─── VIDEO PLAYER ────────────────────────────────────────
const SLIDE_CSS = `
@keyframes slideGlowPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.15)}}
@keyframes slideFadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideFadeOut{from{opacity:1}to{opacity:0}}
@keyframes titleReveal{from{opacity:0;transform:scaleX(0.6)}to{opacity:1;transform:scaleX(1)}}
@keyframes underlineDraw{from{width:0}to{width:100%}}
@keyframes pointUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes iconSpin{from{opacity:0;transform:scale(0.3) rotate(-180deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
@keyframes particleFloat{0%{transform:translate(0,0) scale(1);opacity:0.7}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
@keyframes progressGrow{from{width:0}to{width:var(--pw)}}
@keyframes bgGlow{0%{transform:translate(0%,0%)}25%{transform:translate(30%,-20%)}50%{transform:translate(-10%,30%)}75%{transform:translate(-30%,10%)}100%{transform:translate(0%,0%)}}
`;

const AnimatedSlides = ({video, playing, onClick, ts, slideIdx, setSlideIdx}) => {
  const [visible, setVisible] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const DURATION = 5000;
  const TRANSITION = 450;
  const touchX = useRef(null);

  const goTo = (next) => {
    if(next<0||next>=video.slides.length) return;
    setVisible(false);
    setTimeout(()=>{ setSlideIdx(next); setAnimKey(k=>k+1); setVisible(true); }, TRANSITION);
  };

  // سحب جانبي لتغيير الشرائح
  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if(touchX.current===null) return;
    const diff = touchX.current - e.changedTouches[0].clientX;
    if(Math.abs(diff)>50){
      if(diff>0) goTo(slideIdx+1); // سحب يسار → التالي
      else goTo(slideIdx-1);       // سحب يمين → السابق
    }
    touchX.current=null;
  };

  const sl = video.slides[slideIdx] || {};
  const total = video.slides.length;
  const progressW = ((slideIdx+1)/total*100)+"%";

  // جسيمات عشوائية
  const particles = Array.from({length:8},(_,i)=>({
    id:i,
    top: Math.random()*100+"%",
    left: Math.random()*100+"%",
    tx: (Math.random()-0.5)*80+"px",
    ty: (Math.random()-0.5)*80+"px",
    size: 2+Math.random()*4,
    delay: Math.random()*2+"s",
    dur: 2+Math.random()*2+"s",
    color: ts.accent,
  }));

  return (
    <div style={{position:"absolute",inset:0,zIndex:2,background:ts.bg,overflow:"hidden",cursor:"pointer"}}
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={e=>{
        if(touchX.current!==null){
          const diffX=touchX.current-e.changedTouches[0].clientX;
          if(Math.abs(diffX)>50) e.stopPropagation();
        }
        handleTouchEnd(e);
      }}
    >
      <style>{SLIDE_CSS}</style>

      {/* خلفية توهج ضبابي متحرك */}
      <div style={{position:"absolute",width:"280px",height:"280px",borderRadius:"50%",background:`radial-gradient(circle,${ts.accent}30,transparent 70%)`,top:"-60px",right:"-60px",animation:"bgGlow 8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:"200px",height:"200px",borderRadius:"50%",background:`radial-gradient(circle,${ts.accent}20,transparent 70%)`,bottom:"-40px",left:"-40px",animation:"bgGlow 10s ease-in-out infinite reverse",pointerEvents:"none"}}/>

      {/* جسيمات */}
      {particles.map(p=>(
        <div key={p.id} style={{position:"absolute",top:p.top,left:p.left,width:p.size+"px",height:p.size+"px",borderRadius:"50%",backgroundColor:p.color,animation:`particleFloat ${p.dur} ${p.delay} ease-out infinite`,"--tx":p.tx,"--ty":p.ty,pointerEvents:"none",opacity:0.6}}/>
      ))}

      {/* محتوى الشريحة مع fade */}
      <div key={animKey} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",justifyContent:"flex-start",padding:"48px 18px 80px",animation:`${visible?"slideFadeIn":"slideFadeOut"} ${TRANSITION}ms ease forwards`}}>

        {/* رأس الشريحة */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"18px"}}>
          <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"3px 12px",border:`1px solid ${ts.accent}44`}}>
            <span style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>{slideIdx+1} / {total}</span>
          </div>
          <div style={{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px"}}>
            <span style={{color:"rgba(255,255,255,0.6)",fontSize:"10px"}}>{video.subject}</span>
          </div>
        </div>

        {/* أيقونة */}
        <div style={{textAlign:"center",marginBottom:"10px",animation:"iconSpin 0.6s cubic-bezier(0.34,1.56,0.64,1) both"}}>
          <span style={{fontSize:"28px",filter:`drop-shadow(0 0 8px ${ts.accent})`}}>◆</span>
        </div>

        {/* عنوان مع توهج وخط */}
        <div style={{textAlign:"center",marginBottom:"18px"}}>
          <h3 style={{color:"#fff",fontSize:"17px",fontWeight:"900",margin:"0 0 6px",lineHeight:1.4,animation:"titleReveal 0.5s ease-out both",transformOrigin:"center",textShadow:`0 0 20px ${ts.accent}88`}}>
            {sl.title}
          </h3>
          <div style={{height:"2px",background:`linear-gradient(to left,transparent,${ts.accent},transparent)`,animation:"underlineDraw 0.5s 0.2s ease-out both",width:"0%"}}/>
        </div>

        {/* النقاط */}
        <ul style={{listStyle:"none",padding:0,margin:0}}>
          {(sl.points||[]).map((pt,i)=>(
            <li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",animation:`pointUp 0.4s ${0.3+i*0.15}s ease-out both`,opacity:0}}>
              <span style={{color:ts.accent,flexShrink:0,marginTop:"2px",fontSize:"12px",filter:`drop-shadow(0 0 4px ${ts.accent})`}}>◆</span>
              <span style={{color:"rgba(255,255,255,0.9)",fontSize:"13px",lineHeight:1.6}}>{pt}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* شريط التقدم */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"3px",backgroundColor:"rgba(255,255,255,0.1)"}}>
        <div style={{height:"100%",background:`linear-gradient(to left,${ts.accent},${ts.accent}88)`,"--pw":progressW,animation:`progressGrow 0.5s ease-out both`,width:progressW,transition:"width 0.4s ease"}}/>
      </div>

      {/* نقاط التنقل */}
      <div style={{position:"absolute",top:"10px",left:"50%",transform:"translateX(-50%)",display:"flex",gap:"4px",zIndex:10}} onClick={e=>e.stopPropagation()}>
        {video.slides.map((_,i)=>(
          <div key={i} onClick={()=>goTo(i)} style={{width:i===slideIdx?"16px":"5px",height:"5px",borderRadius:"3px",backgroundColor:i===slideIdx?ts.accent:"rgba(255,255,255,0.25)",cursor:"pointer",transition:"all 0.3s ease"}}/>
        ))}
      </div>

      {playing&&<div style={{position:"absolute",top:"10px",right:"12px",fontSize:"9px",color:ts.accent,opacity:0.7}}>▶ تلقائي</div>}
    </div>
  );
};

const VideoPlayer = ({video, playing, onClick, canAccess=true, onSubscribe}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef(null);

  useEffect(()=>{
    if(video.type==="شرائح AI" && video.slides?.length && playing && canAccess){
      slideTimer.current = setInterval(()=>{
        setSlideIdx(i=> i < video.slides.length-1 ? i+1 : 0);
      }, 5000);
    }
    return ()=>clearInterval(slideTimer.current);
  },[playing, video, canAccess]);

  // شاشة الحجب للمحتوى المدفوع
  if(!canAccess){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,background:"linear-gradient(180deg,rgba(0,0,0,0.7),rgba(0,0,0,0.9))",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:"16px",padding:"24px"}}>
        {video.thumbUrl&&<img src={video.thumbUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.15,zIndex:-1}}/>}
        <div style={{width:"64px",height:"64px",borderRadius:"50%",backgroundColor:"rgba(239,68,68,0.2)",border:"2px solid rgba(239,68,68,0.5)",display:"flex",justifyContent:"center",alignItems:"center"}}>
          <span style={{fontSize:"28px"}}>🔒</span>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"16px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}}>{video.title}</div>
          <div style={{fontSize:"13px",color:"rgba(255,255,255,0.6)",marginBottom:"4px"}}>{video.subject} • {video.stage}</div>
          {video.grade&&<div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)"}}>الصف {video.grade} - الفصل {video.semester}</div>}
        </div>
        <button onClick={onSubscribe} style={{padding:"12px 28px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#ef4444,#f97316)",color:"#fff",fontSize:"14px",fontWeight:"bold",cursor:"pointer"}}>
          اشترك للوصول
        </button>
      </div>
    );
  }

  // ─── شرائح AI بأنيميشن ───────────────────────────────────
  if(video.type==="شرائح AI" && video.slides?.length){
    const ts = THEME_STYLES[video.theme] || THEME_STYLES["أزرق متدرج"];
    return <AnimatedSlides video={video} playing={playing} onClick={onClick} ts={ts} slideIdx={slideIdx} setSlideIdx={setSlideIdx}/>;
  }

  // ─── Zoho Show (لا يدعم iframe — نعرض زر فتح خارجي) ────
  if(video.videoUrl && video.videoUrl.includes("zoho.com/show")){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"16px",padding:"24px",background:"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
        <div style={{fontSize:"40px"}}>📊</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"15px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}}>{video.title}</div>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",marginBottom:"16px"}}>عرض تقديمي Zoho Show</div>
        </div>
        <a href={video.videoUrl} target="_blank" rel="noreferrer" style={{padding:"12px 24px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#2563eb)",color:"#fff",fontWeight:"bold",fontSize:"14px",textDecoration:"none",display:"flex",alignItems:"center",gap:"8px"}}>
          🔗 فتح العرض التقديمي
        </a>
      </div>
    );
  }

  const ytId = getYoutubeId(video.videoUrl);
  if(ytId) return (
    <div style={{position:"absolute",inset:0,zIndex:2}}>
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?autoplay=${playing?1:0}&mute=0&controls=1&rel=0`}
        style={{width:"100%",height:"100%",border:"none"}}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
  if(video.videoUrl) return (
    <video
      src={video.videoUrl}
      autoPlay={playing} loop muted playsInline
      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:2}}
    />
  );
  return (
    <>
      {video.thumbUrl&&<img src={video.thumbUrl} alt={video.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:1,opacity:0.6}}/>}
      {!playing&&(
        <div style={{position:"absolute",zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",gap:"8px",pointerEvents:"none"}}>
          <div style={{width:70,height:70,borderRadius:"50%",backgroundColor:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center"}}>
            <Play size={30} color="#fff" fill="#fff"/>
          </div>
          <span style={{color:"rgba(255,255,255,0.8)",fontSize:"12px"}}>اضغط للتشغيل</span>
        </div>
      )}
      {playing&&(
        <div style={{position:"absolute",bottom:"16px",right:"16px",display:"flex",alignItems:"flex-end",gap:"3px",zIndex:6,pointerEvents:"none"}}>
          {[1,2,3,4].map(i=><div key={i} style={{width:"3px",borderRadius:"2px",backgroundColor:"#38bdf8",animation:`eq${i} 0.8s ease-in-out infinite alternate`,height:(8+i*4)+"px",animationDelay:(i*0.15)+"s"}}/>)}
          <style dangerouslySetInnerHTML={{__html:"@keyframes eq1{to{height:16px}}@keyframes eq2{to{height:8px}}@keyframes eq3{to{height:20px}}@keyframes eq4{to{height:10px}}"}}/>
        </div>
      )}
    </>
  );
};

// ─── AI MODAL ────────────────────────────────────────────
function AIModal({onClose,video}) {
  const [q,setQ]=useState(""); const [ans,setAns]=useState(""); const [loading,setLoading]=useState(false);
  const ask=async()=>{
    if(!q.trim())return; setLoading(true); setAns("");
    try{
      const r=await callGemini("أنت مساعد تعليمي. الطالب يشاهد درس: "+video.title+" في مادة "+video.subject+". سؤاله: "+q+". أجب بإيجاز وبالعربية.");
      setAns(r||"لم أتمكن من الإجابة.");
    }catch(e){setAns("حدث خطأ: "+e.message);}
    setLoading(false);
  };
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)"}}>
    <MHead icon={<Bot size={20} color="#38bdf8"/>} title="المساعد الذكي" color="#38bdf8" onClose={onClose}/>
    <div style={{...C.infoBanner,marginBottom:"12px"}}> اسألني عن درس: <strong>{video.title}</strong></div>
    {ans&&<div style={{backgroundColor:"#09090b",borderRadius:"12px",padding:"14px",fontSize:"14px",color:"#e4e4e7",lineHeight:"1.7",marginBottom:"14px",border:"1px solid rgba(56,189,248,0.15)",whiteSpace:"pre-wrap"}}><div style={{color:"#38bdf8",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}> الإجابة:</div>{ans}</div>}
    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner/><div style={{marginTop:"8px",fontSize:"13px",color:"#38bdf8"}}>جارٍ البحث...</div></div>}
    <textarea rows={3} value={q} onChange={e=>setQ(e.target.value)} placeholder="اكتب سؤالك هنا..." style={{...C.input,resize:"none",marginBottom:"10px"}}/>
    <button onClick={ask} disabled={loading||!q.trim()} style={{...C.primaryBtn,opacity:q.trim()?1:0.5,marginBottom:0}}><Bot size={16}/> أرسل السؤال</button>
  </div></div>;
}

// ─── SHARE MODAL ─────────────────────────────────────────
function ShareModal({onClose,video}) {
  const link="https://edutok-neon.vercel.app/v/"+video.id;
  return <div style={C.overlay}><div style={C.modalBox}>
    <MHead icon={<Share2 size={20} color="#38bdf8"/>} title="مشاركة الدرس" onClose={onClose}/>
    <div style={{...C.card,marginBottom:"14px"}}><div style={{fontWeight:"bold",fontSize:"13px",marginBottom:"4px"}}>{video.title}</div><div style={{fontSize:"12px",color:"#71717a"}}>{link}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
      {[["واتساب","#25D366"],["تيليغرام","#229ED9"],["نسخ الرابط","#6366f1"],["المزيد","#f97316"]].map(([n,c])=>(
        <button key={n} onClick={()=>{if(n==="نسخ الرابط")navigator.clipboard?.writeText(link);onClose();}} style={{padding:"12px",borderRadius:"12px",border:"none",backgroundColor:c,color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>{n}</button>
      ))}
    </div>
  </div></div>;
}

// ─── CHAT MODAL ──────────────────────────────────────────
function ChatModal({onClose, currentStudent, role}) {
  const [msg,setMsg]=useState("");
  const [msgs,setMsgs]=useState([]);
  const [sending,setSending]=useState(false);
  const [chatEnabled,setChatEnabled]=useState(true);
  const bottomRef=useRef(null);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
      else setChatEnabled(true);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(
      query(collection(db,"chat"), orderBy("sentAt","asc")),
      snap=>{ setMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))); }
    );
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[msgs]);

  const send=async()=>{
    if(!msg.trim()||sending) return;
    setSending(true);
    try{
      const name = role==="admin" ? "المدير" : (currentStudent?.name||"طالب");
      const account = role==="admin" ? "admin" : (currentStudent?.account||"");
      await addDoc(collection(db,"chat"),{
        text:msg.trim(), name, account,
        from: role==="admin"?"admin":"student",
        sentAt:serverTimestamp()
      });
      setMsg("");
    }catch(e){console.error(e);}
    setSending(false);
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.2)",display:"flex",flexDirection:"column",maxHeight:"80vh"}}>
    <MHead icon={<MessageCircle size={20} color="#a855f7"/>} title="غرفة النقاش" color="#a855f7" onClose={onClose}/>

    {/* النقاش موقوف */}
    {!chatEnabled&&role!=="admin"&&(
      <div style={{textAlign:"center",padding:"24px",backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"12px",marginBottom:"12px"}}>
        <div style={{fontSize:"28px",marginBottom:"8px"}}>🔕</div>
        <div style={{fontWeight:"bold",color:"#f87171",marginBottom:"4px"}}>النقاش موقوف مؤقتاً</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>قام المدير بإيقاف غرفة النقاش</div>
      </div>
    )}

    <div style={{flex:1,backgroundColor:"#09090b",borderRadius:"12px",padding:"12px",marginBottom:"12px",overflowY:"auto",minHeight:"200px",maxHeight:"300px"}}>
      {msgs.length===0&&<div style={{textAlign:"center",color:"#52525b",fontSize:"13px",padding:"20px"}}>لا توجد رسائل بعد — كن أول من يكتب!</div>}
      {msgs.map((m,i)=>{
        const isMe = role==="admin" ? m.from==="admin" : m.account===currentStudent?.account;
        return (
          <div key={m.id||i} style={{display:"flex",gap:"8px",marginBottom:"10px",justifyContent:isMe?"flex-end":"flex-start"}}>
            {!isMe&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><User size={14} color="#fff"/></div>}
            <div style={{backgroundColor:isMe?"rgba(168,85,247,0.2)":m.from==="admin"?"rgba(251,191,36,0.1)":"#1c1c1e",borderRadius:"10px",padding:"8px 12px",maxWidth:"75%",border:m.from==="admin"?"1px solid rgba(251,191,36,0.3)":"none"}}>
              <div style={{fontSize:"10px",color:m.from==="admin"?"#fbbf24":"#71717a",marginBottom:"2px",fontWeight:"bold"}}>{m.name}{m.account&&m.from!=="admin"?" @"+m.account:""}</div>
              <div style={{fontSize:"13px",color:"#fff"}}>{m.text}</div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef}/>
    </div>

    {/* حقل الإرسال — يُعطَّل للطلاب لما النقاش موقوف */}
    {(chatEnabled||role==="admin")&&<div style={{display:"flex",gap:"8px"}}>
      <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="اكتب رسالتك..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
      <button onClick={send} disabled={sending||!msg.trim()} style={{padding:"10px 14px",backgroundColor:"#a855f7",border:"none",borderRadius:"10px",color:"#fff",cursor:"pointer",fontWeight:"bold",opacity:sending||!msg.trim()?0.5:1}}>إرسال</button>
    </div>}
  </div></div>;
}

// ─── PDF MODAL ───────────────────────────────────────────
function PDFModal({onClose, studentStage, globalPrices, mySubscriptions, onWallet, isAdmin}) {
  const [files,setFiles]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"pdfs"),snap=>{setFiles(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    return ()=>unsub();
  },[]);

  const goToWallet = () => { onWallet && onWallet(); };

  // المدير يرى كل شيء بدون قيود
  if(isAdmin) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :files.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد ملفات بعد</div></div>
      :files.map(f=>(
        <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",...C.card}}>
          <div><div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div><div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}</div></div>
          <a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 12px",color:"#f97316",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none"}}>تحميل</a>
        </div>
      ))
    }
  </div></div>;

  // الطالب: يرى ملازم مرحلته فقط، مع التحقق من الاشتراك والسعر
  const pdfFree = isFreeSubject(globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  const pdfAccess = pdfFree || hasAccess(mySubscriptions, globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  const myFiles = files.filter(f=>!f.stage||f.stage===studentStage);

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"10px",textAlign:"center"}}>
      المرحلة: <strong style={{color:"#f97316"}}>{studentStage}</strong>
    </div>
    {!pdfAccess&&(
      <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"4px"}}>محتوى مدفوع</div>
        <div style={{color:"#71717a",fontSize:"12px",marginBottom:"10px"}}>اشترك للوصول لملازم {studentStage}</div>
        <button onClick={goToWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"10px",padding:"8px 20px",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>اشترك الآن عبر زين كاش</button>
      </div>
    )}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :myFiles.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد ملازم لمرحلتك بعد</div></div>
      :myFiles.map(f=>(
        <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",...C.card}}>
          <div><div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div><div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}</div></div>
          {pdfAccess
            ?<a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 12px",color:"#f97316",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none"}}>تحميل</a>
            :<button onClick={goToWallet} style={{backgroundColor:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"8px",padding:"6px 12px",color:"#fbbf24",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>اشترك</button>
          }
        </div>
      ))
    }
  </div></div>;
}

// ─── SOLVE MODAL ─────────────────────────────────────────
function SolveModal({onClose,video}) {
  const [tab,setTab]=useState("text");
  const [q,setQ]=useState("");
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [ans,setAns]=useState("");
  const [loading,setLoading]=useState(false);

  const handleImageFile=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const full=ev.target.result;
      setImgPreview(full);
      setImgB64(full.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const solve=async()=>{
    setLoading(true); setAns("");
    try{
      let r;
      if(tab==="text"){
        r=await callGemini("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". السؤال: "+q+". حله خطوة بخطوة بالعربية.");
      } else {
        if(!imgB64){setAns("يرجى رفع صورة أولاً.");setLoading(false);return;}
        r=await callGemini("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". انظر للصورة وحل هذا السؤال خطوة بخطوة بالعربية.",imgB64);
      }
      setAns(r||"لم أتمكن من الإجابة.");
    }catch(e){setAns(" خطأ: "+e.message);}
    setLoading(false);
  };

  const canSolve=tab==="text"?q.trim():imgB64;
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(52,211,153,0.2)"}}>
    <MHead icon={<Camera size={20} color="#34d399"/>} title="حل الأسئلة الذكي" color="#34d399" onClose={onClose}/>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <button onClick={()=>setTab("text")} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:tab==="text"?"#34d399":"#27272a",color:tab==="text"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}> اكتب السؤال</button>
      <button onClick={()=>setTab("img")} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:tab==="img"?"#34d399":"#27272a",color:tab==="img"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}> صوّر السؤال</button>
    </div>
    {tab==="text"&&<textarea rows={4} value={q} onChange={e=>setQ(e.target.value)} placeholder="مثال: احسب مساحة مثلث قاعدته 6سم وارتفاعه 4سم" style={{...C.input,resize:"none"}}/>}
    {tab==="img"&&(
      <div style={{marginBottom:"12px"}}>
        {imgPreview&&<img src={imgPreview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
        <label style={{display:"block",width:"100%",padding:"14px",backgroundColor:"rgba(52,211,153,0.08)",border:"2px dashed rgba(52,211,153,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
          <Camera size={26} color="#34d399" style={{margin:"0 auto 6px"}}/>
          <div style={{fontSize:"13px",color:"#34d399",fontWeight:"bold"}}>{imgPreview?"تغيير الصورة":"صوّر السؤال أو اختره من المعرض"}</div>
          <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImageFile}/>
        </label>
      </div>
    )}
    {ans&&<div style={{backgroundColor:"#09090b",borderRadius:"12px",padding:"14px",fontSize:"14px",color:"#e4e4e7",lineHeight:"1.8",marginBottom:"14px",border:"1px solid rgba(52,211,153,0.15)",whiteSpace:"pre-wrap",maxHeight:"240px",overflowY:"auto"}}><div style={{color:"#34d399",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}> الحل:</div>{ans}</div>}
    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#34d399"/><div style={{marginTop:"8px",fontSize:"13px",color:"#34d399"}}>جارٍ الحل...</div></div>}
    {!ans&&!loading&&<button onClick={solve} disabled={!canSolve} style={{...C.purpleBtn,background:canSolve?"linear-gradient(to right,#059669,#34d399)":"#27272a",opacity:canSolve?1:0.5}}><Bot size={16}/> حل السؤال بالذكاء الاصطناعي</button>}
    {ans&&<div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setAns("");setQ("");setImgB64(null);setImgPreview(null);}} style={C.cancelBtn}>سؤال جديد</button><button onClick={onClose} style={C.saveBtn}>إغلاق </button></div>}
  </div></div>;
}

// ─── SEARCH MODAL ────────────────────────────────────────
function SearchModal({onClose,allVideos,onSelectVideo}) {
  const [q,setQ]=useState("");
  const filtered=allVideos.filter(v=>!q||(v.title?.includes(q)||v.subject?.includes(q)||v.teacher?.includes(q)||v.grade?.includes(q)));
  return <div style={C.overlay}><div style={C.modalBox}>
    <MHead icon={<Search size={20} color="#38bdf8"/>} title="البحث في المقاطع" onClose={onClose}/>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن درس أو مادة أو معلم..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
    </div>
    {q&&<div style={{fontSize:"11px",color:"#71717a",marginBottom:"8px"}}>{filtered.length} نتيجة</div>}
    {filtered.slice(0,20).map((v,i)=>(
      <div key={i} onClick={()=>{onSelectVideo(i,v);onClose();}} style={{display:"flex",alignItems:"center",gap:"10px",...C.card,cursor:"pointer",marginBottom:"6px"}}>
        <div style={{width:36,height:36,borderRadius:"8px",background:v.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {v.type==="شرائح AI"?<Layers size={16} color="#c4b5fd"/>:<Film size={16} color="#fff"/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.num?`#${v.num} `:""}{v.title}</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>{v.subject} • {v.stage}{v.grade?` • الصف ${v.grade}`:""}</div>
        </div>
        <div style={{fontSize:"10px",color:"#38bdf8",flexShrink:0}}>انتقال ←</div>
      </div>
    ))}
    {filtered.length===0&&q&&<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Search size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد نتائج لـ "{q}"</div></div>}
  </div></div>;
}

// ─── SAVED MODAL ─────────────────────────────────────────
function SavedModal({onClose,saved,video}) {
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,211,238,0.2)"}}>
    <MHead icon={<Bookmark size={20} color="#22d3ee"/>} title="المحفوظات" color="#22d3ee" onClose={onClose}/>
    {saved?<div style={{display:"flex",alignItems:"center",gap:"10px",...C.card,border:"1px solid rgba(34,211,238,0.2)"}}><Bookmark size={18} color="#22d3ee" fill="#22d3ee"/><div><div style={{fontSize:"13px",fontWeight:"bold"}}>{video.title}</div><div style={{fontSize:"11px",color:"#71717a"}}>{video.subject}</div></div></div>
    :<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Bookmark size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div style={{fontSize:"14px"}}>لا توجد مقاطع محفوظة بعد</div></div>}
  </div></div>;
}

// ─── NOTIFICATIONS MODAL (للطالب) ────────────────────────
function NotificationsModal({onClose,notifications}) {
  const formatTime=(ts)=>{
    if(!ts?.seconds) return "";
    try{ return new Date(ts.seconds*1000).toLocaleString("ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
    catch{ return ""; }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)"}}>
    <MHead icon={<Bell size={20} color="#38bdf8"/>} title="الإشعارات" color="#38bdf8" onClose={onClose}/>
    {notifications.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Bell size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div style={{fontSize:"14px"}}>لا توجد إشعارات حتى الآن</div></div>
      :notifications.map((n,i)=>(
        <div key={n.id||i} style={{...C.card,border:n.targetPhone?"1px solid rgba(168,85,247,0.25)":"1px solid rgba(56,189,248,0.15)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"4px"}}>
            <div style={{fontWeight:"bold",fontSize:"14px"}}>{n.title}</div>
            {n.targetPhone&&<span style={{backgroundColor:"rgba(168,85,247,0.15)",color:"#c4b5fd",fontSize:"10px",padding:"2px 8px",borderRadius:"6px",flexShrink:0}}>خاص بك</span>}
          </div>
          <div style={{fontSize:"13px",color:"#cbd5e1",lineHeight:"1.6",marginBottom:"6px"}}>{n.body}</div>
          <div style={{fontSize:"11px",color:"#52525b"}}>{formatTime(n.sentAt)}</div>
        </div>
      ))
    }
  </div></div>;
}

// ─── VIDEO DESCRIPTION MODAL (وضع ملء الشاشة) ────────────
function VideoDescriptionModal({onClose,video,role,mySubscriptions,globalPrices,onOpenWallet,onSelectSubject,videoIdx,totalVideos}) {
  const free = isFreeSubject(globalPrices,video.subject,video.stage);
  const sub = role==="student"&&video.subject ? hasAccess(mySubscriptions,globalPrices,video.subject,video.stage) : true;
  const d = role==="student"&&video.subject ? daysLeft(mySubscriptions,video.subject,video.stage) : 0;

  // المواد التي اشترك بها الطالب (نشطة فقط)
  const mySubjects = Object.entries(mySubscriptions)
    .filter(([,s])=>new Date(s.expiresAt)>new Date())
    .map(([key,s])=>({key, subject:s.subject, stage:s.stage}));

  // المواد المجانية (سعرها 0) تُضاف تلقائياً
  const freeSubjects = SUBJECTS
    .filter(subj=>STAGES.some(st=>isFreeSubject(globalPrices,subj,st)))
    .filter(subj=>!mySubjects.find(s=>s.subject===subj));

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(255,255,255,0.1)"}}>
    <MHead icon={<FileText size={20} color="#38bdf8"/>} title="وصف المقطع" color="#38bdf8" onClose={onClose}/>

    {/* رقم المقطع */}
    {totalVideos>0&&<div style={{textAlign:"center",marginBottom:"10px"}}>
      <span style={{backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"20px",padding:"4px 14px",fontSize:"12px",color:"#38bdf8",fontWeight:"bold"}}>
        {video.type==="شرائح AI"?"شريحة":"مقطع"} رقم {videoIdx+1}
      </span>
    </div>}

    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
      <h2 style={{fontSize:"17px",fontWeight:"bold",margin:0}}>{video.title}</h2>
      <span style={{backgroundColor:"rgba(14,116,144,0.3)",border:"1px solid #0e7490",color:"#22d3ee",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.type||"معلم"}</span>
      {video.duration&&<span style={{backgroundColor:"rgba(255,255,255,0.08)",color:"#d1d5db",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.duration}</span>}
    </div>
    <p style={{fontSize:"13px",color:"#cbd5e1",margin:"0 0 14px"}}>‍ {video.teacher} • {video.subject} • {video.stage}{video.grade?" - الصف "+video.grade:""}{video.semester?" - الفصل "+video.semester:""}</p>

    {/* حالة الاشتراك للمقطع الحالي */}
    {role==="student"&&video.subject&&(
      sub&&d>0?(
        <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:"#fbbf24",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <span>اشتراك {video.subject} ينتهي خلال {d} يوم</span>
          <button onClick={onOpenWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"6px",padding:"5px 12px",color:"#fff",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>جدد</button>
        </div>
      ):!sub?(
        <div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:"#f87171",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <span>اشترك للوصول لمحتوى {video.subject}</span>
          <button onClick={onOpenWallet} style={{backgroundColor:"#ef4444",border:"none",borderRadius:"6px",padding:"5px 12px",color:"#fff",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>اشترك</button>
        </div>
      ):null
    )}

    {/* السعر — يظهر فقط للطالب غير المشترك بمادة مدفوعة */}
    {role==="student"&&video.subject&&!sub&&!free&&(()=>{
      const priceKey = video.subject+"__"+video.stage;
      const price = globalPrices?.[priceKey];
      return price&&Number(price)>0?(
        <div style={{backgroundColor:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:"10px",padding:"10px 14px",marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:"11px",color:"#71717a",marginBottom:"2px"}}>سعر الاشتراك</div>
            <div style={{fontSize:"18px",fontWeight:"900",color:"#fbbf24"}}>{price} <span style={{fontSize:"12px",fontWeight:"normal"}}>د.ع شهرياً</span></div>
          </div>
          <button onClick={onOpenWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"10px",padding:"8px 16px",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>
            اشترك الآن
          </button>
        </div>
      ):null;
    })()}

    {/* قسم مادتي — للطلاب المشتركين فقط */}
    {role==="student"&&mySubjects.length>0&&(
      <div style={{marginTop:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}>
          <BookOpen size={13}/> مادتي — تصفح بالتسلسل
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {mySubjects.map(s=>(
            <button key={s.key} onClick={()=>{onSelectSubject(s.subject,s.stage);onClose();}}
              style={{padding:"7px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
              {s.subject}<span style={{fontSize:"10px",color:"#71717a",marginRight:"4px"}}>{s.stage}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </div></div>;
}


function AdminLoginModal({onClose,onSuccess}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  const login=async()=>{
    if(!email.trim()||!pass.trim()) return setErr("أدخل البريد الإلكتروني وكلمة المرور");
    setLoading(true); setErr("");
    try{
      await signInWithEmailAndPassword(auth,email.trim(),pass);
      onSuccess();
    }catch(e){
      if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found") setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      else if(e.code==="auth/too-many-requests") setErr("محاولات كثيرة فاشلة، حاول بعد قليل");
      else setErr("فشل تسجيل الدخول: "+e.message);
    }
    setLoading(false);
  };
  const sendReset=async()=>{
    if(!email.trim()) return setErr("أدخل البريد الإلكتروني أولاً لإرسال رابط الاستعادة");
    try{ await sendPasswordResetEmail(auth,email.trim()); setResetSent(true); setErr(""); }
    catch(e){ setErr("فشل إرسال رابط الاستعادة: "+e.message); }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(234,179,8,0.2)"}}>
    <div style={{textAlign:"center",marginBottom:"20px"}}>
      <GraduationCap size={40} color="#eab308" style={{margin:"0 auto 8px"}}/>
      <h3 style={{color:"#eab308",fontWeight:"bold",fontSize:"18px",margin:"0 0 4px"}}>دخول المدير</h3>
    </div>
    <label style={C.label}> البريد الإلكتروني</label>
    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");setResetSent(false);}} placeholder="admin@example.com" style={C.input}/>
    <label style={C.label}> كلمة المرور</label>
    <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} placeholder="كلمة المرور" style={C.input} onKeyDown={e=>e.key==="Enter"&&login()}/>
    <ErrBox msg={err}/>
    {resetSent&&<div style={{backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#4ade80",marginBottom:"14px",textAlign:"center"}}>تم إرسال رابط استعادة كلمة المرور إلى بريدك</div>}
    <button onClick={login} disabled={loading} style={{...C.gradBtn,background:"linear-gradient(to right,#eab308,#f97316)",opacity:loading?0.7:1}}>
      {loading?<><Spinner size={16}/> جارٍ تسجيل الدخول...</>:<>دخول لوحة الإدارة ←</>}
    </button>
    <button onClick={sendReset} style={{width:"100%",padding:"10px",backgroundColor:"transparent",color:"#38bdf8",border:"none",fontSize:"13px",cursor:"pointer",marginBottom:"8px"}}>نسيت كلمة المرور؟</button>
    <button onClick={onClose} style={{width:"100%",padding:"12px",backgroundColor:"transparent",color:"#71717a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",fontSize:"14px",cursor:"pointer"}}>إلغاء</button>
  </div></div>;
}

// ─── WALLET MODAL ────────────────────────────────────────
function WalletModal({onClose,student,subscriptions}) {
  const [selSubject,setSelSubject]=useState(SUBJECTS[0]);
  const [selStage,setSelStage]=useState(STAGES[0]);
  const [selDuration,setSelDuration]=useState(DURATIONS[0]);
  const [amount,setAmount]=useState("");
  const [receipt,setReceipt]=useState(null);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [prices,setPrices]=useState({});

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","prices"),snap=>{
      setPrices(snap.exists()?(snap.data().values||{}):{});
    });
    return ()=>unsub();
  },[]);

  const recommendedPrice = prices[selSubject+"__"+selStage];

  const sendPayment=async()=>{
    if(!amount.trim()) return showMsg("أدخل المبلغ المحوّل");
    setSending(true);
    try{
      await addDoc(collection(db,"payments"),{
        studentName:student?.name||"",studentPhone:student?.phone||"",studentId:student?.id||"",
        subject:selSubject,stage:selStage,duration:selDuration.days,durationLabel:selDuration.label,
        amount,receiptUrl:receipt||"",status:"pending",createdAt:serverTimestamp()
      });
      setSent(true);
    }catch(e){showMsg("حدث خطأ: "+e.message);}
    setSending(false);
  };

  if(sent) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم إرسال طلب الاشتراك!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"4px"}}>المادة: <strong style={{color:"#fff"}}>{selSubject} — {selStage}</strong></div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>سيتم تفعيل اشتراكك بعد مراجعة المدير</div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)"}}>
    <MHead icon={<DollarSign size={20} color="#4ade80"/>} title="محفظة زين كاش" color="#4ade80" onClose={onClose}/>
    {subscriptions&&Object.keys(subscriptions).length>0&&(
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"6px"}}>اشتراكاتي النشطة:</div>
        {Object.entries(subscriptions).map(([key,sub])=>{
          const d=daysLeft(subscriptions,key.split("__")[0],key.split("__")[1]);
          return <div key={key} style={{...C.card,marginBottom:"6px",border:"1px solid rgba(34,197,94,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:"bold",fontSize:"12px"}}>{sub.subject}</div><div style={{fontSize:"10px",color:"#71717a"}}>{sub.stage}</div></div>
              <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
            </div>
          </div>;
        })}
      </div>
    )}
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:"12px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"4px"}}>رقم زين كاش للمدير</div>
      <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px"}}>{ZAINCASH_NUM}</div>
      <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>حوّل المبلغ ثم أرسل الإيصال</div>
    </div>
    <label style={C.label}> المادة</label>
    <select value={selSubject} onChange={e=>setSelSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> المرحلة</label>
    <select value={selStage} onChange={e=>setSelStage(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> مدة الاشتراك</label>
    <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
      {DURATIONS.map(d=><button key={d.days} onClick={()=>setSelDuration(d)} style={{flex:1,padding:"9px 4px",borderRadius:"10px",border:"none",backgroundColor:selDuration.days===d.days?"#4ade80":"#27272a",color:selDuration.days===d.days?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"10px",cursor:"pointer"}}>{d.label}</button>)}
    </div>
    <label style={C.label}> المبلغ المحوّل (د.ع)</label>
    {recommendedPrice&&<div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px"}}>السعر المحدد لهذا الاشتراك: {recommendedPrice} د.ع</div>}
    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="أدخل المبلغ" style={C.input}/>
    <label style={C.label}> إيصال التحويل</label>
    <ImageUploader onUpload={url=>setReceipt(url)} onBase64={()=>{}} color="#4ade80" label="صوّر إيصال زين كاش"/>
    {sending?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#4ade80"/></div>
    :<button onClick={sendPayment} style={{...C.primaryBtn,background:"linear-gradient(to right,#15803d,#4ade80)",marginBottom:0}}>إرسال طلب الاشتراك للمدير</button>}
  </div></div>;
}

// ─── SLIDES STUDIO ───────────────────────────────────────
// ─── ANIMATION TAB ───────────────────────────────────────
const ANIM_CSS = `
@keyframes animFadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes animFadeOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-10px)}}
@keyframes animTitleIn{from{opacity:0;transform:scaleX(0.6)}to{opacity:1;transform:scaleX(1)}}
@keyframes animUnderline{from{width:0}to{width:100%}}
@keyframes animPointIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes animIconIn{from{opacity:0;transform:scale(0.2) rotate(-180deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
@keyframes animGlow{0%{transform:translate(0,0) scale(1)}25%{transform:translate(25%,-20%) scale(1.1)}50%{transform:translate(-15%,25%) scale(0.95)}75%{transform:translate(-25%,5%) scale(1.05)}100%{transform:translate(0,0) scale(1)}}
@keyframes animParticle{0%{transform:translate(0,0);opacity:0.8}100%{transform:translate(var(--ptx),var(--pty));opacity:0}}
@keyframes animRingRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes animBarDraw{from{transform:scaleX(0);transform-origin:right}to{transform:scaleX(1);transform-origin:right}}
@keyframes animPulse{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
`;

function AnimationTab({clips}) {
  const [selClip, setSelClip] = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  const slideClips = clips.filter(c=>c.type==="شرائح AI"&&c.slides?.length>0);

  useEffect(()=>{
    if(playing && selClip){
      timerRef.current = setInterval(()=>{
        setVisible(false);
        setTimeout(()=>{
          setSlideIdx(i=>{
            const next = i < selClip.slides.length-1 ? i+1 : 0;
            setAnimKey(k=>k+1);
            setVisible(true);
            return next;
          });
        }, 450);
      }, 5000);
    }
    return ()=>clearInterval(timerRef.current);
  },[playing, selClip]);

  const goTo = (next) => {
    setVisible(false);
    setTimeout(()=>{ setSlideIdx(next); setAnimKey(k=>k+1); setVisible(true); }, 450);
  };

  if(!selClip) return (
    <div style={{padding:"16px"}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:"16px",padding:"20px",textAlign:"center",marginBottom:"16px"}}>
        <Sparkles size={32} color="#c4b5fd" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"16px",fontWeight:"bold",color:"#c4b5fd",marginBottom:"4px"}}>معاينة الأنيميشن</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>اختر مقطع شرائح لمعاينته بالأنيميشن الكامل</div>
      </div>
      {slideClips.length===0
        ?<div style={{textAlign:"center",padding:"32px",color:"#52525b"}}>
          <Layers size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/>
          <div>لا توجد شرائح محفوظة بعد</div>
          <div style={{fontSize:"12px",color:"#71717a",marginTop:"4px"}}>أضف شرائح من تبويب "شرائح" أولاً</div>
        </div>
        :slideClips.map(c=>(
          <div key={c.id} onClick={()=>{setSelClip(c);setSlideIdx(0);setAnimKey(0);setVisible(true);setPlaying(false);}}
            style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px"}}>
            <div style={{width:"44px",height:"44px",borderRadius:"10px",background:c.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Sparkles size={18} color="#c4b5fd"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:"bold"}}>{c.title}</div>
              <div style={{fontSize:"11px",color:"#71717a"}}>{c.subject} • {c.stage} • {c.slides.length} شرائح</div>
            </div>
            <Play size={16} color="#38bdf8"/>
          </div>
        ))
      }
    </div>
  );

  const ts = THEME_STYLES[selClip.theme] || THEME_STYLES["أزرق متدرج"];
  const sl = selClip.slides[slideIdx] || {};
  const total = selClip.slides.length;
  const accent = ts.accent;

  // جسيمات
  const particles = Array.from({length:10},(_,i)=>({
    id:i, size:2+Math.random()*3,
    top:Math.random()*90+"%", left:Math.random()*90+"%",
    ptx:(Math.random()-0.5)*100+"px", pty:(Math.random()-0.5)*100+"px",
    delay:Math.random()*3+"s", dur:2.5+Math.random()*2+"s",
  }));

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <style>{ANIM_CSS}</style>

      {/* شريط علوي */}
      <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <button onClick={()=>{setSelClip(null);setPlaying(false);clearInterval(timerRef.current);}}
          style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"13px",padding:"4px 8px"}}>← رجوع</button>
        <div style={{flex:1,fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selClip.title}</div>
        <button onClick={()=>setPlaying(p=>!p)}
          style={{padding:"6px 14px",borderRadius:"10px",border:"none",background:playing?"rgba(239,68,68,0.2)":"rgba(56,189,248,0.15)",color:playing?"#f87171":"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
          {playing?"⏸ إيقاف":"▶ تلقائي"}
        </button>
      </div>

      {/* منطقة الأنيميشن */}
      <div style={{flex:1,position:"relative",background:ts.bg,overflow:"hidden",minHeight:"400px"}}>

        {/* توهج خلفي متحرك */}
        <div style={{position:"absolute",width:"260px",height:"260px",borderRadius:"50%",background:`radial-gradient(circle,${accent}28,transparent 70%)`,top:"-40px",right:"-40px",animation:"animGlow 8s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:"200px",height:"200px",borderRadius:"50%",background:`radial-gradient(circle,${accent}18,transparent 70%)`,bottom:"-30px",left:"-30px",animation:"animGlow 11s ease-in-out infinite reverse",pointerEvents:"none"}}/>

        {/* حلقات دائرية ديكورية */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"320px",height:"320px",borderRadius:"50%",border:`1px solid ${accent}18`,animation:"animRingRotate 20s linear infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"240px",height:"240px",borderRadius:"50%",border:`1px solid ${accent}10`,animation:"animRingRotate 14s linear infinite reverse",pointerEvents:"none"}}/>

        {/* جسيمات */}
        {particles.map(p=>(
          <div key={p.id} style={{position:"absolute",top:p.top,left:p.left,width:p.size+"px",height:p.size+"px",borderRadius:"50%",background:accent,opacity:0.5,animation:`animParticle ${p.dur} ${p.delay} ease-out infinite`,"--ptx":p.ptx,"--pty":p.pty,pointerEvents:"none"}}/>
        ))}

        {/* محتوى الشريحة */}
        <div key={animKey} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px 60px",animation:`${visible?"animFadeIn":"animFadeOut"} 0.45s ease forwards`}}>

          {/* أيقونة */}
          <div style={{marginBottom:"12px",animation:"animIconIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both"}}>
            <div style={{width:"52px",height:"52px",borderRadius:"50%",background:`${accent}22`,border:`2px solid ${accent}55`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 20px ${accent}44`}}>
              <span style={{fontSize:"22px",filter:`drop-shadow(0 0 6px ${accent})`}}>◆</span>
            </div>
          </div>

          {/* عنوان */}
          <div style={{textAlign:"center",marginBottom:"16px",width:"100%"}}>
            <h3 style={{color:"#fff",fontSize:"18px",fontWeight:"900",margin:"0 0 8px",lineHeight:1.4,animation:"animTitleIn 0.5s ease-out both",transformOrigin:"center",textShadow:`0 0 24px ${accent}88`}}>
              {sl.title}
            </h3>
            {/* خط يُرسم */}
            <div style={{height:"2px",background:`linear-gradient(to left,transparent,${accent},transparent)`,animation:"animUnderline 0.6s 0.2s ease-out both",width:"0%",margin:"0 auto",maxWidth:"200px"}}/>
          </div>

          {/* النقاط */}
          <div style={{width:"100%",maxWidth:"340px"}}>
            {(sl.points||[]).map((pt,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"10px",animation:`animPointIn 0.4s ${0.3+i*0.18}s ease-out both`,opacity:0}}>
                <span style={{color:accent,flexShrink:0,marginTop:"3px",fontSize:"13px",filter:`drop-shadow(0 0 4px ${accent})`,animation:"animPulse 2s ease-in-out infinite"}}>◆</span>
                <span style={{color:"rgba(255,255,255,0.9)",fontSize:"14px",lineHeight:1.65}}>{pt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* شريط تقدم */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"3px",background:"rgba(255,255,255,0.08)"}}>
          <div style={{height:"100%",background:`linear-gradient(to right,${accent},${accent}88)`,width:((slideIdx+1)/total*100)+"%",transition:"width 0.5s ease"}}/>
        </div>

        {/* عداد الشريحة */}
        <div style={{position:"absolute",top:"12px",right:"14px",background:`${accent}22`,border:`1px solid ${accent}44`,borderRadius:"8px",padding:"3px 10px"}}>
          <span style={{color:accent,fontSize:"11px",fontWeight:"bold"}}>{slideIdx+1} / {total}</span>
        </div>

        {/* نقاط التنقل */}
        <div style={{position:"absolute",bottom:"12px",left:"50%",transform:"translateX(-50%)",display:"flex",gap:"5px"}}>
          {selClip.slides.map((_,i)=>(
            <div key={i} onClick={()=>goTo(i)} style={{width:i===slideIdx?"18px":"6px",height:"6px",borderRadius:"3px",background:i===slideIdx?accent:"rgba(255,255,255,0.2)",cursor:"pointer",transition:"all 0.3s"}}/>
          ))}
        </div>
      </div>

      {/* أزرار التنقل */}
      <div style={{display:"flex",gap:"8px",padding:"12px 14px",background:"rgba(0,0,0,0.3)"}}>
        <button disabled={slideIdx===0} onClick={()=>goTo(slideIdx-1)}
          style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:slideIdx===0?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.1)",color:slideIdx===0?"rgba(255,255,255,0.2)":"#fff",cursor:slideIdx===0?"not-allowed":"pointer",fontWeight:"bold",fontSize:"13px"}}>◀ السابق</button>
        <button disabled={slideIdx===total-1} onClick={()=>goTo(slideIdx+1)}
          style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:slideIdx===total-1?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.1)",color:slideIdx===total-1?"rgba(255,255,255,0.2)":"#fff",cursor:slideIdx===total-1?"not-allowed":"pointer",fontWeight:"bold",fontSize:"13px"}}>التالي ▶</button>
      </div>
    </div>
  );
}

function SlidesStudio({slidesTheme,setSlidesTheme,onSaveClip}) {
  const [mode,setMode]=useState("menu");
  const [topic,setTopic]=useState("");
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [slidesCount,setCount]=useState(6);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [slides,setSlides]=useState([]);
  const [curSlide,setCurSlide]=useState(0);
  const [clipTitle,setClipTitle]=useState("");
  const [clipSubj,setClipSubj]=useState("الرياضيات");
  const [clipStage,setClipStage]=useState("الابتدائية");
  const [clipGrade,setClipGrade]=useState("الأول");
  const [clipSemester,setClipSemester]=useState("الأول");
  const [saving,setSaving]=useState(false);
  // ─── JSON Import ───
  const [jsonText,setJsonText]=useState("");
  const [jsonErr,setJsonErr]=useState("");
  const JSONSUFFIX=' أجب بـ JSON فقط بلا أي نص خارجه: {"title":"العنوان","slides":[{"title":"عنوان الشريحة","points":["نقطة 1","نقطة 2","نقطة 3"]}]}';

  const generate=async(fromImage)=>{
    setLoading(true);
    setLoadMsg(fromImage?" Gemini يقرأ الورقة...":" Gemini يبني الشرائح...");
    try{
      let raw;
      if(fromImage){
        if(!imgB64){showMsg("يرجى رفع صورة أولاً");setLoading(false);return;}
        raw=await callGemini("اقرأ هذه الورقة الدراسية وحوّل محتواها إلى "+slidesCount+" شرائح تعليمية."+JSONSUFFIX,imgB64);
      }else{
        if(!topic.trim()){showMsg("يرجى إدخال الموضوع");setLoading(false);return;}
        raw=await callGemini("أنشئ "+slidesCount+" شرائح تعليمية احترافية عن الموضوع التالي: "+topic+". اجعل كل شريحة تحتوي على 3-4 نقاط مفيدة وواضحة."+JSONSUFFIX);
      }
      const clean=raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const start=clean.indexOf("{");
      const end=clean.lastIndexOf("}");
      const parsed=JSON.parse(clean.substring(start,end+1));
      setSlides(parsed.slides||[]);
      setClipTitle(parsed.title||(fromImage?"شرائح من ورقة":topic));
      setCurSlide(0);
      setMode("result");
    }catch(e){
      showMsg("حدث خطأ: "+e.message+". حاول مرة أخرى.");
    }
    setLoading(false);
  };

  const saveToFirestore=async()=>{
    if(!clipTitle.trim()) return showMsg("أدخل عنوان المقطع");
    setSaving(true);
    try{
      await addDoc(collection(db,"clips"),{title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,semester:clipSemester,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)",createdAt:serverTimestamp()});
      onSaveClip({title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,semester:clipSemester,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)"});
      showMsg(" تم حفظ الشرائح في Firebase!");
      setMode("menu");
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSaving(false);
  };

  const importFromJSON=()=>{
    setJsonErr("");
    if(!jsonText.trim()) return setJsonErr("الصق كود JSON أولاً");
    try{
      const clean=jsonText.replace(/```json/g,"").replace(/```/g,"").trim();
      // تحقق: هل هو مصفوفة (استيراد جماعي) أم مقطع واحد؟
      const firstChar=clean[0];
      if(firstChar==="["){
        // ─── استيراد جماعي ───
        const arr=JSON.parse(clean);
        if(!Array.isArray(arr)||arr.length===0) throw new Error("المصفوفة فارغة");
        arr.forEach((item,i)=>{
          if(!item.slides||!Array.isArray(item.slides)||item.slides.length===0)
            throw new Error("المقطع "+(i+1)+" لا يحتوي على شرائح");
          item.slides.forEach((s,j)=>{
            if(!s.title) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها عنوان");
            if(!Array.isArray(s.points)) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها نقاط");
          });
        });
        setBulkClips(arr);
        setJsonText("");
        setMode("bulk");
      } else {
        // ─── مقطع واحد ───
        const start=clean.indexOf("{");
        const end=clean.lastIndexOf("}");
        if(start===-1||end===-1) throw new Error("تنسيق JSON غير صحيح");
        const parsed=JSON.parse(clean.substring(start,end+1));
        if(!parsed.slides||!Array.isArray(parsed.slides)||parsed.slides.length===0)
          throw new Error("الـ JSON لا يحتوي على شرائح");
        parsed.slides.forEach((s,i)=>{
          if(!s.title) throw new Error("الشريحة "+(i+1)+" ليس فيها عنوان");
          if(!Array.isArray(s.points)) throw new Error("الشريحة "+(i+1)+" ليس فيها نقاط");
        });
        setSlides(parsed.slides);
        setClipTitle(parsed.title||"شرائح مستوردة");
        setCurSlide(0);
        setJsonText("");
        setMode("result");
      }
    }catch(e){
      setJsonErr("خطأ: "+e.message);
    }
  };

  // ─── حفظ جماعي ───────────────────────────────────────────
  const [bulkClips,setBulkClips]=useState([]);
  const [bulkSubj,setBulkSubj]=useState("الرياضيات");
  const [bulkStage,setBulkStage]=useState("الابتدائية");
  const [bulkGrade,setBulkGrade]=useState("الأول");
  const [bulkSemester,setBulkSemester]=useState("الأول");
  const [bulkSaving,setBulkSaving]=useState(false);
  const [bulkProgress,setBulkProgress]=useState(0);

  const saveBulk=async()=>{
    if(!bulkClips.length) return;
    setBulkSaving(true);
    setBulkProgress(0);
    try{
      for(let i=0;i<bulkClips.length;i++){
        const c=bulkClips[i];
        await addDoc(collection(db,"clips"),{
          title:c.title||"مقطع "+(i+1),
          subject:bulkSubj,
          stage:bulkStage,
          grade:bulkGrade,
          semester:bulkSemester,
          slides:c.slides,
          theme:slidesTheme,
          type:"شرائح AI",
          bg:"linear-gradient(135deg,#1e1b4b,#312e81)",
          num:i+1,
          createdAt:serverTimestamp()
        });
        setBulkProgress(i+1);
      }
      onSaveClip({title:"جماعي"});
      showMsg("✅ تم حفظ "+bulkClips.length+" مقطع بنجاح!");
      setBulkClips([]);
      setMode("menu");
    }catch(e){
      showMsg("فشل الحفظ: "+e.message);
    }
    setBulkSaving(false);
  };

  const ts=THEME_STYLES[slidesTheme]||THEME_STYLES["أزرق متدرج"];
  const countBtns=<div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>{[4,6,8,10,12].map(n=><button key={n} onClick={()=>setCount(n)} style={{flex:1,padding:"9px",borderRadius:"10px",border:"none",backgroundColor:slidesCount===n?"#7c3aed":"#27272a",color:slidesCount===n?"#fff":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>{n}</button>)}</div>;
  const back=<button onClick={()=>setMode("menu")} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"13px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"4px"}}>← رجوع</button>;

  if(mode==="menu") return <div>
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"16px",padding:"24px",textAlign:"center",marginBottom:"16px"}}>
      <Sparkles size={36} color="#c4b5fd" style={{margin:"0 auto 8px"}}/>
      <div style={{fontSize:"18px",fontWeight:"bold",color:"#c4b5fd",marginBottom:"4px"}}>استوديو الشرائح الذكي</div>
      <div style={{fontSize:"13px",color:"#8b8ba0"}}>مدعوم بـ Google Gemini AI</div>
    </div>
    <div style={{...C.twoCol,marginBottom:"10px"}}>
      <div onClick={()=>setMode("image")} style={{backgroundColor:"rgba(88,28,135,0.25)",border:"1px solid rgba(139,92,246,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <Camera size={32} color="#a855f7" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#c4b5fd"}}>صوّر ورقة الكتاب</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يقرأها ويحوّلها</div>
      </div>
      <div onClick={()=>setMode("text")} style={{backgroundColor:"rgba(3,105,161,0.25)",border:"1px solid rgba(56,189,248,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <BookOpen size={32} color="#38bdf8" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8"}}>كتابة موضوع</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يبني الشرائح</div>
      </div>
    </div>
    {/* ─── خيار استيراد JSON ─── */}
    <div onClick={()=>{setJsonText("");setJsonErr("");setMode("json");}} style={{backgroundColor:"rgba(20,83,45,0.25)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:"16px",padding:"16px 14px",textAlign:"center",cursor:"pointer",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px"}}>
      <FileText size={28} color="#4ade80" style={{flexShrink:0}}/>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#4ade80"}}>استيراد شرائح JSON</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"3px"}}>الصق JSON جاهز من Claude مباشرة</div>
      </div>
    </div>
    <div style={{fontSize:"13px",color:"#38bdf8",fontWeight:"bold",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}><Layers size={14}/> الثيم</div>
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
      {THEMES.map(t=><button key={t.label} onClick={()=>setSlidesTheme(t.label)} style={{padding:"8px 14px",borderRadius:"10px",border:slidesTheme===t.label?"2px solid #38bdf8":"none",backgroundColor:t.color,color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>{t.label}</button>)}
    </div>
  </div>;

  if(mode==="json") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><FileText size={18} color="#4ade80"/> استيراد شرائح JSON</div>
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#4ade80"}}>
      الصق JSON مقطع واحد <strong style={{color:"#fff"}}>{"{ }"}</strong> أو عدة مقاطع دفعة واحدة <strong style={{color:"#fff"}}>{"[ ]"}</strong>
    </div>
    <textarea
      rows={10}
      value={jsonText}
      onChange={e=>{setJsonText(e.target.value);setJsonErr("");}}
      placeholder={'مقطع واحد: {"title":"...","slides":[...]}\nعدة مقاطع: [{"title":"...","slides":[...]},{"title":"...","slides":[...]}]'}
      style={{...C.input,resize:"none",fontFamily:"monospace",fontSize:"12px",direction:"ltr",textAlign:"left"}}
    />
    {jsonErr&&<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"10px"}}>⚠ {jsonErr}</div>}
    <button onClick={importFromJSON} disabled={!jsonText.trim()} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:jsonText.trim()?1:0.5,marginBottom:0}}>
      <FileText size={16}/> استيراد الشرائح
    </button>
  </div>;

  if(mode==="bulk") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
      <Layers size={18} color="#4ade80"/> استيراد جماعي — {bulkClips.length} مقطع
    </div>
    {/* قائمة المقاطع */}
    <div style={{marginBottom:"14px"}}>
      {bulkClips.map((c,i)=>(
        <div key={i} style={{...C.card,display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"bold",color:"#4ade80",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{c.title||"مقطع "+(i+1)}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{c.slides?.length||0} شرائح</div>
          </div>
        </div>
      ))}
    </div>
    {/* إعدادات مشتركة */}
    <div style={{...C.card,border:"1px solid rgba(34,197,94,0.2)",marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",fontWeight:"bold",marginBottom:"10px"}}>إعدادات مشتركة لكل المقاطع</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
        <select value={bulkSubj} onChange={e=>setBulkSubj(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={bulkStage} onChange={e=>{setBulkStage(e.target.value);setBulkGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
        <select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {(GRADES[bulkStage]||[]).map(g=><option key={g}>{g}</option>)}
        </select>
        <select value={bulkSemester} onChange={e=>setBulkSemester(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {SEMESTERS.map(s=><option key={s}>الفصل {s}</option>)}
        </select>
      </div>
    </div>
    {/* شريط التقدم */}
    {bulkSaving&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px",textAlign:"center"}}>جارٍ الحفظ... {bulkProgress} / {bulkClips.length}</div>
      <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden"}}>
        <div style={{height:"100%",background:"linear-gradient(to right,#059669,#4ade80)",width:(bulkProgress/bulkClips.length*100)+"%",transition:"width 0.3s"}}/>
      </div>
    </div>}
    <button onClick={saveBulk} disabled={bulkSaving} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:bulkSaving?0.6:1,marginBottom:0}}>
      {bulkSaving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Layers size={16}/> حفظ {bulkClips.length} مقطع دفعة واحدة</>}
    </button>
  </div>;



  if(mode==="image") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><Camera size={18} color="#a855f7"/> صوّر ورقة الكتاب</div>
    <div style={{backgroundColor:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#c4b5fd"}}>
       صوّر صفحة الكتاب أو الورقة — Groq سيقرأها ويحوّلها لشرائح تعليمية
    </div>
    <div style={{marginBottom:"12px"}}>
      {imgPreview&&<img src={imgPreview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
      <label style={{display:"block",width:"100%",padding:"14px",backgroundColor:"rgba(139,92,246,0.08)",border:"2px dashed rgba(139,92,246,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
        <Camera size={26} color="#a855f7" style={{margin:"0 auto 6px"}}/>
        <div style={{fontSize:"13px",color:"#a855f7",fontWeight:"bold"}}>{imgPreview?"تغيير الصورة":"صوّر صفحة الكتاب أو اختر من المعرض"}</div>
        <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
          const file=e.target.files[0]; if(!file) return;
          const reader=new FileReader();
          reader.onload=(ev)=>{
            const img=new Image();
            img.onload=()=>{
              const MAX=800;
              let w=img.width, h=img.height;
              if(w>MAX||h>MAX){
                if(w>h){h=Math.round(h*MAX/w);w=MAX;}
                else{w=Math.round(w*MAX/h);h=MAX;}
              }
              const canvas=document.createElement("canvas");
              canvas.width=w; canvas.height=h;
              const ctx=canvas.getContext("2d");
              ctx.drawImage(img,0,0,w,h);
              const compressed=canvas.toDataURL("image/jpeg",0.5);
              setImgPreview(compressed);
              setImgB64(compressed.split(",")[1]);
            };
            img.src=ev.target.result;
          };
          reader.readAsDataURL(file);
        }}/>
      </label>
    </div>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#a855f7"/><div style={{marginTop:"10px",fontSize:"14px",color:"#a855f7",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button disabled={!imgB64} onClick={()=>generate(true)} style={{...C.purpleBtn,opacity:imgB64?1:0.5}}> Groq يقرأ الورقة ويبني الشرائح</button>}
  </div>;

  if(mode==="text") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><BookOpen size={18} color="#38bdf8"/> كتابة موضوع</div>
    <label style={C.label}> موضوع الشرائح</label>
    <textarea rows={3} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="مثال: الجهاز التنفسي في جسم الإنسان&#10;أو: قوانين نيوتن الثلاثة&#10;أو: الكسور العشرية وعمليات الجمع والطرح" style={{...C.input,resize:"none"}}/>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner/><div style={{marginTop:"10px",fontSize:"14px",color:"#38bdf8",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button onClick={()=>generate(false)} disabled={!topic.trim()} style={{...C.purpleBtn,opacity:topic.trim()?1:0.5}}> Gemini يبني الشرائح الآن</button>}
  </div>;

  if(mode==="result"){const sl=slides[curSlide]||{}; return <div style={{paddingBottom:"80px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      {back}
      <span style={{color:"#a1a1aa",fontSize:"12px"}}>{curSlide+1} / {slides.length}</span>
    </div>
    <div style={{background:ts.bg,borderRadius:"20px",padding:"24px 18px",minHeight:"220px",marginBottom:"14px",border:"1px solid rgba(255,255,255,0.08)"}}>
      <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"4px 12px",display:"inline-block",marginBottom:"12px",border:"1px solid "+ts.accent+"44"}}><span style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>شريحة {curSlide+1}</span></div>
      <h3 style={{color:"#fff",fontSize:"17px",fontWeight:"bold",margin:"0 0 12px",lineHeight:"1.5"}}>{sl.title}</h3>
      <ul style={{listStyle:"none",padding:0,margin:0}}>
        {(sl.points||[]).map((pt,i)=><li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"8px",color:"rgba(255,255,255,0.88)",fontSize:"13px",lineHeight:"1.6"}}><span style={{color:ts.accent,flexShrink:0}}>◆</span>{pt}</li>)}
      </ul>
    </div>
    <div style={{display:"flex",gap:"5px",justifyContent:"center",marginBottom:"12px",flexWrap:"wrap"}}>
      {slides.map((_,i)=><div key={i} onClick={()=>setCurSlide(i)} style={{width:i===curSlide?"18px":"7px",height:"7px",borderRadius:"4px",backgroundColor:i===curSlide?ts.accent:"#3f3f46",cursor:"pointer",transition:"width 0.2s"}}/>)}
    </div>
    <div style={{display:"flex",gap:"10px",marginBottom:"12px"}}>
      <button disabled={curSlide===0} onClick={()=>setCurSlide(i=>i-1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===0?"#1c1c1e":"#27272a",color:curSlide===0?"#3f3f46":"#fff",cursor:curSlide===0?"not-allowed":"pointer",fontWeight:"bold"}}>◀ السابق</button>
      <button disabled={curSlide===slides.length-1} onClick={()=>setCurSlide(i=>i+1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===slides.length-1?"#1c1c1e":"#27272a",color:curSlide===slides.length-1?"#3f3f46":"#fff",cursor:curSlide===slides.length-1?"not-allowed":"pointer",fontWeight:"bold"}}>التالي ▶</button>
    </div>
    <div style={{...C.card,border:"1px solid rgba(56,189,248,0.15)"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"10px"}}> حفظ في Firebase</div>
      <input value={clipTitle} onChange={e=>setClipTitle(e.target.value)} placeholder="عنوان المقطع" style={{...C.input,marginBottom:"8px"}}/>
      <div style={{...C.twoCol,marginBottom:"8px"}}>
        <select value={clipSubj} onChange={e=>setClipSubj(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={clipStage} onChange={e=>{setClipStage(e.target.value);setClipGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div style={{...C.twoCol,marginBottom:"10px"}}>
        <select value={clipGrade} onChange={e=>setClipGrade(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{(GRADES[clipStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
        <select value={clipSemester} onChange={e=>setClipSemester(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{SEMESTERS.map(s=><option key={s}>الفصل {s}</option>)}</select>
      </div>
      <button onClick={saveToFirestore} disabled={saving} style={{...C.primaryBtn,marginBottom:0,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الشرائح في Firebase</>}
      </button>
    </div>
  </div>;}
  return null;
}

// ─── ADMIN PDF TAB ───────────────────────────────────────
function AdminPDFTab() {
  const [pdfs,setPdfs]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [editingPdf,setEditingPdf]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [pdfName,setPdfName]=useState("");
  const [pdfSubject,setPdfSubject]=useState("الرياضيات");
  const [pdfStage,setPdfStage]=useState("الابتدائية");
  const [pdfUrl,setPdfUrl]=useState("");
  const [pdfThumb,setPdfThumb]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"pdfs"),snap=>{
      setPdfs(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return()=>unsub();
  },[]);

  const openEdit=(f)=>{
    setEditingPdf(f);
    setPdfName(f.name||"");
    setPdfSubject(f.subject||"الرياضيات");
    setPdfStage(f.stage||"الابتدائية");
    setPdfUrl(f.url||"");
    setShowForm(true);
  };

  const doDelete=async(f)=>{
    try{ await deleteDoc(doc(db,"pdfs",f.id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل: "+e.message); }
    setConfirmDelete(null);
  };

  const savePDF=async()=>{
    if(!pdfName.trim()||!pdfUrl.trim()) return showMsg("أدخل الاسم والرابط");
    setSaving(true);
    try{
      if(editingPdf&&editingPdf.id){
        await updateDoc(doc(db,"pdfs",editingPdf.id),{name:pdfName,subject:pdfSubject,stage:pdfStage,url:pdfUrl});
        showMsg("تم تعديل الملف");
      } else {
        await addDoc(collection(db,"pdfs"),{name:pdfName,subject:pdfSubject,stage:pdfStage,url:pdfUrl,thumbUrl:pdfThumb,createdAt:serverTimestamp()});
        showMsg("تم حفظ الملف");
      }
      setShowForm(false);setEditingPdf(null);setPdfName("");setPdfUrl("");setPdfThumb(null);
    }catch(e){showMsg("فشل: "+e.message);}
    setSaving(false);
  };
  return <div>
    <div style={C.infoBanner}><FileText size={15}/> الملازم والبحوث المدفوعة — للطلاب المشتركين فقط</div>
    {confirmDelete&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#f87171",fontWeight:"bold",marginBottom:"8px"}}>هل تريد حذف هذا الملف؟</div>
        <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
          <button onClick={()=>doDelete(confirmDelete)} style={{padding:"8px 20px",backgroundColor:"#ef4444",border:"none",borderRadius:"8px",color:"#fff",fontWeight:"bold",cursor:"pointer"}}>نعم</button>
          <button onClick={()=>setConfirmDelete(null)} style={{padding:"8px 20px",backgroundColor:"#27272a",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer"}}>لا</button>
        </div>
      </div>
    )}
    {pdfs.map(f=>(
      <div key={f.id} style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
          {f.thumbUrl&&<img src={f.thumbUrl} alt="" style={{width:40,height:40,borderRadius:"8px",objectFit:"cover"}}/>}
          <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:"14px"}}>{f.name}</div><div style={{fontSize:"12px",color:"#71717a"}}>{f.subject} • {f.stage}</div></div>
          <a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 10px",color:"#f97316",fontSize:"12px",textDecoration:"none",fontWeight:"bold"}}>فتح</a>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>openEdit(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
          <button onClick={()=>setConfirmDelete(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حذف</button>
        </div>
      </div>
    ))}
    {!showForm?<button style={C.gradBtn} onClick={()=>{setEditingPdf(null);setPdfName("");setPdfUrl("");setShowForm(true);}}><Plus size={18}/> إضافة ملف PDF جديد</button>
    :<div style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
      <div style={{color:"#f97316",fontWeight:"bold",fontSize:"14px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"6px"}}><FileText size={16}/> بيانات الملف الجديد</div>
      <label style={C.label}>اسم الملف</label>
      <input type="text" value={pdfName} onChange={e=>setPdfName(e.target.value)} placeholder="مثال: ملزمة الرياضيات الفصل الأول" style={C.input}/>
      <div style={C.twoCol}>
        <div><label style={C.label}>المادة</label><select value={pdfSubject} onChange={e=>setPdfSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={C.label}>المرحلة</label><select value={pdfStage} onChange={e=>setPdfStage(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <label style={C.label}> رابط PDF (Google Drive)</label>
      <input type="url" value={pdfUrl} onChange={e=>setPdfUrl(e.target.value)} placeholder="https://drive.google.com/file/..." style={C.input}/>
      <label style={C.label}> صورة مصغرة (اختياري)</label>
      <ImageUploader onUpload={url=>setPdfThumb(url)} onBase64={()=>{}} color="#f97316" label="اختر صورة للملف"/>
      <div style={C.saveRow}>
        <button style={C.cancelBtn} onClick={()=>{setShowForm(false);setEditingPdf(null);}}>إلغاء</button>
        <button disabled={saving} style={{...C.saveBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",opacity:saving?0.7:1}} onClick={savePDF}>
          {saving?<><Spinner size={15}/> جارٍ...</>:<><Save size={15}/> حفظ</>}
        </button>
      </div>
    </div>}
  </div>;
}

// ─── ADMIN WALLET TAB ────────────────────────────────────
function AdminWalletTab() {
  const [payments,setPayments]=useState([]);
  const [zaincash,setZaincash]=useState(ZAINCASH_NUM);
  const [editingNum,setEditingNum]=useState(false);
  const [newNum,setNewNum]=useState(ZAINCASH_NUM);
  useEffect(()=>{const unsub=onSnapshot(collection(db,"payments"),snap=>{setPayments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));});return()=>unsub();},[]);
  const totalReceived=payments.filter(p=>p.status==="approved").reduce((s,p)=>s+Number(p.amount||0),0);
  const pending=payments.filter(p=>p.status==="pending");
  const approvePayment=async(p)=>{
    const days=p.duration||30;
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+days);
    try{
      await addDoc(collection(db,"subscriptions"),{studentPhone:p.studentPhone,studentName:p.studentName,subject:p.subject,stage:p.stage,duration:days,expiresAt:expiresAt.toISOString(),activatedAt:serverTimestamp()});
      await addDoc(collection(db,"notifications"),{title:" تم تفعيل اشتراكك!",body:"تم تفعيل اشتراكك في "+p.subject+" ("+p.stage+") لمدة "+days+" يوم. ينتهي في "+expiresAt.toLocaleDateString("ar"),targetPhone:p.studentPhone,sentAt:serverTimestamp()});
      await addDoc(collection(db,"payments"),{...p,status:"approved",approvedAt:serverTimestamp()});
      showMsg(" تم تفعيل اشتراك "+p.subject+" لـ "+p.studentName);
    }catch(e){showMsg("فشل: "+e.message);}
  };
  const rejectPayment=async(p)=>{
    try{await addDoc(collection(db,"payments"),{...p,status:"rejected"});showMsg("تم رفض الدفع");}catch(e){showMsg("فشل");}
  };
  return <div>
    <div style={{background:"linear-gradient(135deg,#14532d,#15803d)",borderRadius:"16px",padding:"20px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.7)",marginBottom:"4px"}}>رقم زين كاش للاستلام</div>
      {editingNum?(
        <div style={{display:"flex",gap:"8px",justifyContent:"center",alignItems:"center"}}>
          <input value={newNum} onChange={e=>setNewNum(e.target.value)} style={{padding:"8px 12px",backgroundColor:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"8px",color:"#fff",fontSize:"16px",outline:"none",textAlign:"center",width:"170px"}}/>
          <button onClick={()=>{setZaincash(newNum);setEditingNum(false);}} style={{backgroundColor:"#4ade80",border:"none",borderRadius:"8px",padding:"8px 14px",color:"#000",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}}>حفظ</button>
        </div>
      ):(
        <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px",cursor:"pointer"}} onClick={()=>setEditingNum(true)}>{zaincash}</div>
      )}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"14px"}}>
      {[["✅",totalReceived.toLocaleString()+" د.ع","المستلم"],["⏳",pending.length,"معلقة"],["✔",payments.filter(p=>p.status==="approved").length,"مؤكدة"]].map(([icon,val,label])=>(
        <div key={label} style={C.statCard}><div style={{fontSize:"18px"}}>{icon}</div><div style={{fontSize:"14px",fontWeight:"bold",color:"#4ade80",margin:"2px 0"}}>{val}</div><div style={{fontSize:"10px",color:"#71717a"}}>{label}</div></div>
      ))}
    </div>
    {pending.length>0&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#fbbf24",marginBottom:"8px"}}> طلبات تحتاج موافقة ({pending.length})</div>
      {pending.map(p=>(
        <div key={p.id} style={{...C.card,border:"1px solid rgba(234,179,8,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div><div style={{fontWeight:"bold",fontSize:"14px"}}>{p.studentName}</div><div style={{fontSize:"12px",color:"#71717a"}}> {p.studentPhone}</div><div style={{fontSize:"12px",color:"#38bdf8"}}> {p.subject} — {p.stage}</div><div style={{fontSize:"12px",color:"#a855f7"}}> {p.durationLabel}</div><div style={{fontSize:"13px",color:"#4ade80",fontWeight:"bold"}}> {p.amount} د.ع</div></div>
            {p.receiptUrl&&<img src={p.receiptUrl} alt="إيصال" style={{width:65,height:65,borderRadius:"10px",objectFit:"cover",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}} onClick={()=>window.open(p.receiptUrl,"_blank")}/>}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>approvePayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",color:"#4ade80",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✅ قبول وتفعيل</button>
            <button onClick={()=>rejectPayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",color:"#f87171",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✗ رفض</button>
          </div>
        </div>
      ))}
    </div>}
    <div style={{fontSize:"13px",fontWeight:"bold",color:"#a1a1aa",marginBottom:"8px"}}> سجل المدفوعات</div>
    {payments.filter(p=>p.status!=="pending").slice(0,20).map(p=>(
      <div key={p.id} style={{...C.card,borderRight:`3px solid ${p.status==="approved"?"#4ade80":"#f87171"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{p.studentName}</div><div style={{fontSize:"11px",color:"#71717a"}}>{p.subject} • {p.stage}</div></div>
          <div style={{textAlign:"left"}}><div style={{fontWeight:"bold",fontSize:"13px",color:"#4ade80"}}>{p.amount} د.ع</div><div style={{fontSize:"11px",color:p.status==="approved"?"#4ade80":"#f87171"}}>{p.status==="approved"?" مقبول":" مرفوض"}</div></div>
        </div>
      </div>
    ))}
  </div>;
}

// ─── CONTENT EDITOR ──────────────────────────────────────
function ContentEditor() {
  const [clips, setClips] = useState([]);
  const [selClip, setSelClip] = useState(null);
  const [slides, setSlides] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  // ─── فلتر المادة والصف ───
  const [filterSubj, setFilterSubj] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const u = onSnapshot(collection(db, "clips"), snap => {
      setClips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => u();
  }, []);

  const openClip = (clip) => {
    setSelClip(clip);
    setSlides(clip.slides || []);
    setEditIdx(null);
    setShowAddSlide(false);
  };

  const saveSlides = async (newSlides) => {
    if (!selClip?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "clips", selClip.id), { slides: newSlides });
      setSlides(newSlides);
      setSelClip({ ...selClip, slides: newSlides });
      showMsg("تم حفظ التعديلات");
    } catch (e) { showMsg("فشل: " + e.message); }
    setSaving(false);
  };

  const openEdit = (idx) => {
    setEditIdx(idx);
    setEditTitle(slides[idx].title || "");
    setEditPoints((slides[idx].points || []).join("\n"));
    setShowAddSlide(false);
  };

  const saveEdit = async () => {
    const newSlides = [...slides];
    newSlides[editIdx] = {
      title: editTitle,
      points: editPoints.split("\n").filter(p => p.trim())
    };
    await saveSlides(newSlides);
    setEditIdx(null);
  };

  const deleteSlide = async (idx) => {
    const newSlides = slides.filter((_, i) => i !== idx);
    await saveSlides(newSlides);
    setConfirmDel(null);
  };

  const addSlide = async () => {
    if (!newTitle.trim()) { showMsg("ادخل عنوان الشريحة"); return; }
    const newSlides = [...slides, {
      title: newTitle,
      points: newPoints.split("\n").filter(p => p.trim())
    }];
    await saveSlides(newSlides);
    setNewTitle("");
    setNewPoints("");
    setShowAddSlide(false);
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const newSlides = [...slides];
    [newSlides[idx - 1], newSlides[idx]] = [newSlides[idx], newSlides[idx - 1]];
    await saveSlides(newSlides);
  };

  const moveDown = async (idx) => {
    if (idx === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[idx + 1], newSlides[idx]] = [newSlides[idx], newSlides[idx + 1]];
    await saveSlides(newSlides);
  };

  const allClips = clips.filter(c => c.slides && c.slides.length > 0);
  const regularClips = clips.filter(c => !c.slides || c.slides.length === 0);

  // تطبيق الفلتر
  const filteredAllClips = allClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  const filteredRegularClips = regularClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  if (!selClip) return (
    <div>
      {/* فلتر البحث */}
      <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:"14px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",color:"#38bdf8",fontWeight:"bold",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}><Search size={13}/> بحث وفلتر</div>
        {/* بحث نصي */}
        <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="ابحث عن اسم المقطع..." style={{...C.input,marginBottom:"8px",fontSize:"13px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
          <select value={filterSubj} onChange={e=>{setFilterSubj(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterSubj?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المواد</option>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterStage} onChange={e=>{setFilterStage(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterStage?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المراحل</option>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"8px"}}>
          <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterGrade?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل الصفوف</option>
            {(GRADES[filterStage]||["الأول","الثاني","الثالث","الرابع","الخامس","السادس"]).map(g=><option key={g}>{g}</option>)}
          </select>
          {(filterSubj||filterStage||filterGrade||filterText)&&<button onClick={()=>{setFilterSubj("");setFilterStage("");setFilterGrade("");setFilterText("");}} style={{padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",color:"#f87171",fontSize:"12px",cursor:"pointer"}}>مسح</button>}
        </div>
        {(filterSubj||filterStage||filterGrade||filterText)&&<div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>
          النتائج: {filteredAllClips.length+filteredRegularClips.length} مقطع
        </div>}
      </div>
      {filteredAllClips.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#a855f7", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={14} /> مقاطع الشرائح ({filteredAllClips.length})
          </div>
          {filteredAllClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }} onClick={() => openClip(clip)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.num?`#${clip.num} `:""}{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}{clip.grade?` - ${clip.grade}`:""} - {clip.slides.length} شريحة</div>
                </div>
                <div style={{ backgroundColor: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "8px", padding: "6px 12px", color: "#a855f7", fontSize: "12px", fontWeight: "bold" }}>تعديل</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredRegularClips.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Film size={14} /> مقاطع الفيديو ({filteredRegularClips.length})
          </div>
          {filteredRegularClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#52525b" }}>لا يحتوي شرائح</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {allClips.length === 0 && regularClips.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525b" }}>لا توجد مقاطع بعد</div>
      )}
    </div>
  );

  return (
    <div>
      <button onClick={() => { setSelClip(null); setEditIdx(null); }}
        style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
        رجوع للقائمة
      </button>
      <div style={{ ...C.card, border: "1px solid rgba(139,92,246,0.3)", marginBottom: "14px" }}>
        <div style={{ fontWeight: "bold", fontSize: "15px", color: "#a855f7", marginBottom: "4px" }}>{selClip.title}</div>
        <div style={{ fontSize: "12px", color: "#71717a" }}>{selClip.subject} - {selClip.stage} - {slides.length} شريحة</div>
      </div>
      {editIdx !== null ? (
        <div style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "10px" }}>تعديل الشريحة {editIdx + 1}</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={6} value={editPoints} onChange={e => setEditPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setEditIdx(null)} style={C.cancelBtn}>الغاء</button>
            <button onClick={saveEdit} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Spinner size={15}/> : <Save size={15}/>} حفظ
            </button>
          </div>
        </div>
      ) : showAddSlide ? (
        <div style={{ ...C.card, border: "1px solid rgba(34,197,94,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4ade80", marginBottom: "10px" }}>اضافة شريحة جديدة</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة الجديدة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={5} value={newPoints} onChange={e => setNewPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setShowAddSlide(false)} style={C.cancelBtn}>الغاء</button>
            <button onClick={addSlide} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {saving ? <Spinner size={15}/> : <Plus size={15}/>} اضافة
            </button>
          </div>
        </div>
      ) : (
        <>
          {confirmDel !== null && (
            <div style={C.confirmBox}>
              <div style={{ color: "#f87171", fontWeight: "bold", marginBottom: "8px" }}>هل تريد حذف الشريحة {confirmDel + 1}؟</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button onClick={() => deleteSlide(confirmDel)} style={{ padding: "8px 20px", backgroundColor: "#ef4444", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>نعم</button>
                <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 20px", backgroundColor: "#27272a", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer" }}>لا</button>
              </div>
            </div>
          )}
          {slides.map((sl, idx) => (
            <div key={idx} style={{ ...C.card, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "2px" }}>شريحة {idx + 1}</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "6px" }}>{sl.title}</div>
                  {(sl.points || []).slice(0, 2).map((p, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "2px" }}>◆ {p}</div>
                  ))}
                  {(sl.points || []).length > 2 && (
                    <div style={{ fontSize: "11px", color: "#52525b" }}>+{sl.points.length - 2} نقاط اخرى</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginRight: "8px" }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === 0 ? "#1c1c1e" : "#27272a", color: idx === 0 ? "#3f3f46" : "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", fontSize: "12px" }}>↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === slides.length - 1} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === slides.length - 1 ? "#1c1c1e" : "#27272a", color: idx === slides.length - 1 ? "#3f3f46" : "#fff", cursor: idx === slides.length - 1 ? "not-allowed" : "pointer", fontSize: "12px" }}>↓</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => openEdit(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>تعديل</button>
                <button onClick={() => setConfirmDel(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>حذف</button>
              </div>
            </div>
          ))}
          <button onClick={() => setShowAddSlide(true)} style={{ ...C.gradBtn, background: "linear-gradient(to right,#059669,#4ade80)" }}>
            <Plus size={18}/> اضافة شريحة جديدة
          </button>
        </>
      )}
    </div>
  );
}

// ─── ADMIN CHANGE PASSWORD ───────────────────────────────
function AdminChangePasswordCard() {
  const [newPass,setNewPass]=useState("");
  const [confirmPass,setConfirmPass]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const change=async()=>{
    setErr("");
    if(newPass.length<6) return setErr("كلمة المرور يجب أن تكون 6 خانات على الأقل");
    if(newPass!==confirmPass) return setErr("كلمتا المرور غير متطابقتين");
    setSaving(true);
    try{
      await updatePassword(auth.currentUser,newPass);
      showMsg("تم تغيير كلمة المرور بنجاح");
      setNewPass(""); setConfirmPass("");
    }catch(e){
      if(e.code==="auth/requires-recent-login") setErr("لأمانك، سجّل الخروج وأعد تسجيل الدخول ثم حاول مرة أخرى");
      else setErr("فشل تغيير كلمة المرور: "+e.message);
    }
    setSaving(false);
  };
  return (
    <div style={C.card}>
      <span style={{color:"#ef4444",fontWeight:"bold",fontSize:"13px",display:"block",marginBottom:"10px"}}> تغيير كلمة المرور</span>
      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="كلمة المرور الجديدة" style={C.input}/>
      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" style={C.input}/>
      <ErrBox msg={err}/>
      <button onClick={change} disabled={saving} style={{...C.redBtn,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={15}/> جارٍ التغيير...</>:"تغيير كلمة المرور"}
      </button>
    </div>
  );
}

// ─── ADMIN PRICES TAB (حقيقي، يُحفظ في Firestore) ───────
function ChatToggleCard() {
  const [chatEnabled,setChatEnabled]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
    });
    return ()=>unsub();
  },[]);

  const toggle=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"settings","chat"),{enabled:!chatEnabled,updatedAt:serverTimestamp()});
      setChatEnabled(e=>!e);
    }catch(e){console.error(e);}
    setSaving(false);
  };

  return (
    <div style={{backgroundColor:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}>
          <MessageCircle size={16} color="#a855f7"/> غرفة النقاش
        </div>
        <div style={{fontSize:"12px",color:"#71717a"}}>{chatEnabled?"مفعّلة — الطلاب يستطيعون النقاش":"موقوفة — النقاش معطّل للطلاب"}</div>
      </div>
      <button onClick={toggle} disabled={saving} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:chatEnabled?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)",color:chatEnabled?"#f87171":"#4ade80",fontWeight:"bold",fontSize:"13px",cursor:"pointer",border:`1px solid ${chatEnabled?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)"}`}}>
        {saving?"...":chatEnabled?"⏸ إيقاف":"▶ تفعيل"}
      </button>
    </div>
  );
}

function AdminPricesTab() {
  const [prices,setPrices]=useState({}); // key: "subject__stage" -> price
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage) vals[data.subject+"__"+data.stage]=data.value||"";
      });
      setPrices(vals);
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const setPrice=(subj,stage,val)=>{
    const key=subj+"__"+stage;
    setPrices(p=>({...p,[key]:val}));
  };

  const savePrices=async()=>{
    setSaving(true);
    try{
      // نحفظ كل مادة+مرحلة كوثيقة منفصلة في مجموعة prices
      const saves=Object.entries(prices).map(([key,value])=>{
        const [subject,stage]=key.split("__");
        return setDoc(doc(db,"prices",key),{key,subject,stage,value,updatedAt:serverTimestamp()});
      });
      await Promise.all(saves);
      showMsg("تم حفظ الأسعار بنجاح");
    }catch(e){ showMsg("فشل حفظ الأسعار: "+e.message); }
    setSaving(false);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;

  return (
    <div>
      <div style={C.infoBanner}> حدد سعراً لكل مادة حسب المرحلة + سعر ملازم PDF</div>
      {PRICE_SUBJECTS.map(subj=>(
        <div key={subj}>
          <div style={{fontSize:"14px",color:"#38bdf8",textAlign:"center",margin:"14px 0 8px"}}> {subj}</div>
          {STAGES.map(stage=>{
            const key=subj+"__"+stage;
            return (
              <div key={stage} style={C.priceRow}>
                <span style={{fontSize:"14px",color:"#e4e4e7",minWidth:"60px"}}>{stage}</span>
                <div style={{display:"flex",alignItems:"center",gap:"6px",backgroundColor:"#09090b",padding:"6px 10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)",flex:1,margin:"0 10px"}}>
                  <input type="number" placeholder="0" value={prices[key]??""} onChange={e=>setPrice(subj,stage,e.target.value)} style={C.priceInput}/>
                </div>
                <span style={{color:"#71717a",fontSize:"12px"}}>د.ع</span>
              </div>
            );
          })}
        </div>
      ))}
      <button disabled={saving} style={{...C.gradBtn,marginTop:"16px",opacity:saving?0.7:1}} onClick={savePrices}>
        {saving?<><Spinner size={15}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الأسعار</>}
      </button>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("welcome");
  const [role,setRole]=useState("guest");
  const [currentStudent,setCurrentStudent]=useState(null);
  const [students,setStudents]=useState([]);
  const [clips,setClips]=useState([]);
  const [mySubscriptions,setMySubscriptions]=useState({});
  const [globalPrices,setGlobalPrices]=useState({});

  useEffect(()=>{
    // استرجاع جلسة الطالب (تخزين محلي، لا صلاحيات حساسة ولا كلمة مرور)
    const session = loadSession();
    if(session?.role === "student" && session?.student?.phone && session.student.name && session.student.account){
      setCurrentStudent(session.student);
      setRole("student");
      setScreen("home");
    } else if(session && session.role !== "admin"){
      clearSession();
    }
    // استرجاع جلسة المدير عبر Firebase Auth الحقيقي فقط (لا يمكن تزويرها من المتصفح)
    const unsubAuth = onAuthStateChanged(auth, (user)=>{
      if(user){
        setCurrentStudent(null);
        setRole("admin");
        setScreen(s=>s==="welcome"?"admin":s);
        saveSession({name:"المدير",email:user.email||""},"admin");
      } else {
        // إذا لم يعد هناك مستخدم مسجل بـ Firebase، تأكد عدم بقاء صلاحيات مدير وهمية
        setRole(r=>{
          if(r==="admin"){ clearSession(); return "guest"; }
          return r;
        });
      }
    });
    return ()=>unsubAuth();
  },[]);

  const [regName,setRegName]=useState(""); const [regPhone,setRegPhone]=useState(""); const [regAccount,setRegAccount]=useState(""); const [regPass,setRegPass]=useState(""); const [regStage,setRegStage]=useState("الابتدائية"); const [regErr,setRegErr]=useState("");
  const [loginPhone,setLoginPhone]=useState(""); const [loginPass,setLoginPass]=useState(""); const [loginErr,setLoginErr]=useState("");

  const [adminTab,setAdminTab]=useState("clips"); const [showClipForm,setShowClipForm]=useState(false);
  const [editingClip,setEditingClip]=useState(null);
  const [confirmDeleteClip,setConfirmDeleteClip]=useState(null);
  const [clipStage,setClipStage]=useState("الابتدائية"); const [clipGrade,setClipGrade]=useState("الأول");
  const [clipSubject,setClipSubject]=useState("الرياضيات"); const [clipSemester,setClipSemester]=useState("الأول");
  const [clipType,setClipType]=useState("معلم"); const [clipNum,setClipNum]=useState("01");
  const [clipTitle,setClipTitle]=useState(""); const [clipTeacher,setClipTeacher]=useState("");
  const [clipVideoUrl,setClipVideoUrl]=useState(""); const [savingClip,setSavingClip]=useState(false);
  const [clipThumbUrl,setClipThumbUrl]=useState(null);
  const [slidesTheme,setSlidesTheme]=useState("أزرق متدرج");
  const [notifTitle,setNotifTitle]=useState(""); const [notifBody,setNotifBody]=useState(""); const [sendingNotif,setSendingNotif]=useState(false);
  const [notifTarget,setNotifTarget]=useState("all"); // "all" أو "single"
  const [notifStudent,setNotifStudent]=useState(null); // الطالب المحدد عند الإرسال الفردي
  const [notifSearch,setNotifSearch]=useState(""); // نص البحث عن الطالب

  const [videoIdx,setVideoIdx]=useState(0); const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState(false); const [showMore,setShowMore]=useState(false);
  const [modal,setModal]=useState(null);
  const [selectedSubject,setSelectedSubject]=useState(null); // {subject, stage} للتصفح بالتسلسل
  const [tapCount,setTapCount]=useState(0); const [showAdminLogin,setShowAdminLogin]=useState(false);
  const tapTimer=useRef(null); const touchStartY=useRef(null); const touchStartX=useRef(null);
  const [myNotifications,setMyNotifications]=useState([]); // إشعارات الطالب الحالي (عامة + موجهة له)
  const [lastSeenNotifAt,setLastSeenNotifAt]=useState(()=>{
    try{ return Number(localStorage.getItem("edutok_last_seen_notif")||0); }catch{ return 0; }
  });

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"students"),snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u2=onSnapshot(collection(db,"clips"),snap=>{setClips(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return ()=>{u1();u2();};
  },[]);

  useEffect(()=>{
    if(!currentStudent?.phone) return;
    const unsub=onSnapshot(collection(db,"subscriptions"),snap=>{
      const subs={};
      snap.docs.forEach(d=>{
        const s=d.data();
        if(s.studentPhone===currentStudent.phone) subs[subKey(s.subject,s.stage)]=s;
      });
      setMySubscriptions(subs);
    });
    return ()=>unsub();
  },[currentStudent]);

  // إشعارات الطالب: العامة (بدون targetPhone) + الموجهة له شخصياً
  useEffect(()=>{
    if(role!=="student"||!currentStudent?.phone){setMyNotifications([]);return;}
    const unsub=onSnapshot(collection(db,"notifications"),snap=>{
      const list=snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(n=>!n.targetPhone||n.targetPhone===currentStudent.phone)
        .sort((a,b)=>(b.sentAt?.seconds||0)-(a.sentAt?.seconds||0));
      setMyNotifications(list);
    });
    return ()=>unsub();
  },[role,currentStudent]);

  // الأسعار العامة — تُحمَّل لكل المستخدمين لتحديد ما هو مجاني وما يحتاج اشتراك
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage&&data.value!==undefined){
          vals[data.subject+"__"+data.stage]=data.value;
        }
      });
      setGlobalPrices(vals);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{if(screen==="home")setPlaying(true);else setPlaying(false);},[screen]);
  useEffect(()=>{if(screen==="home")setPlaying(true);},[videoIdx]);

  // ─── قائمة الفيديوهات حسب حالة الطالب ──────────────────
  const allVideos = React.useMemo(()=>{
    const firebaseClips = [...clips];

    // لو اختار الطالب مادة → يرى مقاطعها بالتسلسل
    if(selectedSubject){
      return firebaseClips
        .filter(c=>c.subject===selectedSubject.subject && c.stage===selectedSubject.stage)
        .sort((a,b)=>Number(a.num||0)-Number(b.num||0));
    }

    // مدير: يرى الكل مرتباً بالتسلسل (num) لكل مادة
    if(role==="admin"){
      return [...firebaseClips].sort((a,b)=>{
        // رتب أولاً بالمادة ثم بالرقم
        const subjectCompare=(a.subject||"").localeCompare(b.subject||"","ar");
        if(subjectCompare!==0) return subjectCompare;
        return Number(a.num||0)-Number(b.num||0);
      });
    }

    // طالب: مقاطع المواد المشترك بها بالتسلسل أولاً، ثم الباقي عشوائي
    const grouped={};
    firebaseClips.forEach(clip=>{
      const key=(clip.subject||"")+"__"+(clip.stage||"");
      if(!grouped[key]) grouped[key]=[];
      grouped[key].push(clip);
    });

    const mixed=[];
    Object.values(grouped).forEach(group=>{
      const shuffled=[...group].sort(()=>Math.random()-0.5);
      mixed.push(...shuffled.slice(0,10));
    });

    return mixed.sort(()=>Math.random()-0.5);

  },[clips, selectedSubject, role]);

  // placeholder فارغ لو ما فيه مقاطع
  const EMPTY_VIDEO = {id:"empty",title:"",teacher:"",subject:"",stage:"",bg:"linear-gradient(180deg,#0f172a,#1e1b4b)",videoUrl:"",slides:[]};
  const video = allVideos[videoIdx] || EMPTY_VIDEO;

  const handleLogoTap=()=>{setTapCount(c=>{const n=c+1;if(n>=10){setShowAdminLogin(true);clearTimeout(tapTimer.current);return 0;}clearTimeout(tapTimer.current);tapTimer.current=setTimeout(()=>setTapCount(0),4000);return n;});};
  const handleTouchStart=(e)=>{
    touchStartY.current=e.touches[0].clientY;
    touchStartX.current=e.touches[0].clientX;
  };
  const handleTouchEnd=(e)=>{
    if(touchStartY.current===null)return;
    const diffY=touchStartY.current-e.changedTouches[0].clientY;
    const diffX=touchStartX.current-(e.changedTouches[0].clientX||0);
    // لو السحب أفقي أكثر من عمودي → تجاهل (للشرائح الجانبية)
    if(Math.abs(diffX)>Math.abs(diffY)){touchStartY.current=null;return;}
    if(Math.abs(diffY)<50){touchStartY.current=null;return;}
    if(diffY>0)setVideoIdx(i=>Math.min(i+1,allVideos.length-1));
    else setVideoIdx(i=>Math.max(i-1,0));
    touchStartY.current=null;
  };
  const handleTouchMove=(e)=>{
    if(e.touches[0].clientY > touchStartY.current && window.scrollY === 0){
      e.preventDefault();
    }
  };

  const doRegister=async()=>{
    if(!regName.trim())return setRegErr("الرجاء إدخال الاسم");
    if(!regPhone.trim())return setRegErr("الرجاء إدخال رقم الموبايل");
    if(!regAccount.trim())return setRegErr("الرجاء إدخال اسم الحساب");
    if(!regPass.trim())return setRegErr("الرجاء إدخال كلمة المرور");
    const phoneKey = regPhone.trim().replace(/\s+/g,"");
    try{
      const existing = await getDoc(doc(db,"students",phoneKey));
      if(existing.exists()) return setRegErr("رقم الموبايل مسجل مسبقاً");
      const {hash,salt} = await hashPassword(regPass.trim());
      const stored = {name:regName.trim(),phone:phoneKey,account:regAccount.trim(),stage:regStage,passHash:hash,passSalt:salt,createdAt:serverTimestamp()};
      await setDoc(doc(db,"students",phoneKey),stored);
      const s = {name:stored.name,phone:stored.phone,account:stored.account,stage:stored.stage};
      setCurrentStudent(s);setRole("student");setScreen("home");saveSession(s,"student");
      setRegName("");setRegPhone("");setRegAccount("");setRegPass("");setRegStage("الابتدائية");setRegErr("");
    }
    catch(e){setRegErr("فشل التسجيل: "+e.message);}
  };

  const doLogin=async()=>{
    if(!loginPhone.trim()||!loginPass.trim())return setLoginErr("أدخل رقم الموبايل وكلمة المرور");
    const phoneKey = loginPhone.trim().replace(/\s+/g,"");
    try{
      const snap = await getDoc(doc(db,"students",phoneKey));
      if(!snap.exists()) return setLoginErr("رقم الموبايل غير مسجل");
      const ex = snap.data();
      const ok = await verifyPassword(loginPass.trim(), ex.passHash, ex.passSalt);
      if(ok){
        const s = {name:ex.name,phone:ex.phone,account:ex.account,stage:ex.stage||"الابتدائية"};
        setCurrentStudent(s);setRole("student");setScreen("home");saveSession(s,"student");
        setLoginPhone("");setLoginPass("");setLoginErr("");
      } else {
        setLoginErr("كلمة المرور غير صحيحة");
      }
    }catch(e){ setLoginErr("فشل تسجيل الدخول: "+e.message); }
  };

  const openEditClip=(clip)=>{
    setEditingClip(clip);
    setClipTitle(clip.title||"");
    setClipTeacher(clip.teacher||"");
    setClipStage(clip.stage||"الابتدائية");
    setClipGrade(clip.grade||"الأول");
    setClipSubject(clip.subject||"الرياضيات");
    setClipSemester(clip.semester||"الأول");
    setClipType(clip.type||"معلم");
    setClipNum(clip.num||"01");
    setClipVideoUrl(clip.videoUrl||"");
    setClipThumbUrl(clip.thumbUrl||null);
    setShowClipForm(true);
  };

  const resetClipForm=()=>{
    setEditingClip(null);
    setClipTitle("");setClipTeacher("");setClipVideoUrl("");
    setClipThumbUrl(null);setClipNum("01");
    setClipStage("الابتدائية");setClipGrade("الأول");
    setClipSubject("الرياضيات");setClipSemester("الأول");
    setClipType("معلم");
    setShowClipForm(false);
  };

  const saveClip=async()=>{
    if(!clipTitle.trim())return showMsg("أدخل عنوان المقطع");
    setSavingClip(true);
    try{
      const data={
        title:clipTitle,stage:clipStage,grade:clipGrade,subject:clipSubject,
        semester:clipSemester,type:clipType,num:clipNum,teacher:clipTeacher,
        videoUrl:clipVideoUrl,thumbUrl:clipThumbUrl,
        bg:"linear-gradient(180deg,#0f172a,#1e1b4b)"
      };
      if(editingClip?.id){
        await updateDoc(doc(db,"clips",editingClip.id),data);
        showMsg(" تم تعديل المقطع!");
      } else {
        await addDoc(collection(db,"clips"),{...data,createdAt:serverTimestamp()});
        showMsg(" تم حفظ المقطع وسيظهر في الشاشة الرئيسية!");
      }
      resetClipForm();
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSavingClip(false);
  };

  const sendNotif=async()=>{
    if(!notifTitle.trim()||!notifBody.trim())return showMsg("أدخل العنوان والنص");
    if(notifTarget==="single"&&!notifStudent)return showMsg("اختر الطالب الذي تريد إرسال الإشعار له");
    setSendingNotif(true);
    try{
      if(notifTarget==="single"){
        await addDoc(collection(db,"notifications"),{
          title:notifTitle,body:notifBody,
          targetPhone:notifStudent.phone,
          sentAt:serverTimestamp(),sentTo:1
        });
        showMsg(" تم إرسال الإشعار إلى "+notifStudent.name);
      }else{
        await addDoc(collection(db,"notifications"),{
          title:notifTitle,body:notifBody,
          sentAt:serverTimestamp(),sentTo:students.length
        });
        showMsg(" تم إرسال الإشعار لـ "+students.length+" طالب!");
      }
      setNotifTitle("");setNotifBody("");setNotifStudent(null);setNotifSearch("");setNotifTarget("all");
    }
    catch(e){showMsg("فشل: "+e.message);}
    setSendingNotif(false);
  };

  const applyTemplate=(t)=>{const T={expire:["تنبيه انتهاء الاشتراك","عزيزي الطالب، يرجى تجديد اشتراكك."],new_video:["تم رفع درس جديد! ","قام الأستاذ برفع مقطع تعليمي جديد الآن."],remind:["حان وقت المذاكرة ","ادخل وراجع دروسك ربع ساعة."],offer:["خصم 50% لفترة محدودة ","اشترك الآن بنصف السعر."]};setNotifTitle(T[t][0]);setNotifBody(T[t][1]);};

  const closeModal=()=>setModal(null);
  const showNav=screen!=="welcome"&&screen!=="login"&&screen!=="register";
  // للـ PDF: مجاني لو سعر "ملازم PDF" = 0، أو لو الطالب مشترك بأي مادة
  const isPDFFree = isFreeSubject(globalPrices,"ملازم PDF","عام");
  const isSubbed = isPDFFree || Object.values(mySubscriptions).some(s=>new Date(s.expiresAt)>new Date());

  // عدد الإشعارات غير المقروءة (بناءً على آخر وقت فتح الطالب للقائمة)
  const unreadNotifCount=myNotifications.filter(n=>(n.sentAt?.seconds||0)*1000>lastSeenNotifAt).length;
  const openNotifications=()=>{
    setModal("notifications");
    const now=Date.now();
    setLastSeenNotifAt(now);
    try{ localStorage.setItem("edutok_last_seen_notif", String(now)); }catch{}
  };

  return (
    <div style={C.app}>

      {/* HEADER */}
      {showNav&&screen!=="home"&&(
        <div style={C.header}>
          <div style={C.logoRow} onClick={handleLogoTap}>
            <img src={LOGO} alt="logo" style={{width:28,height:28}}/>
            <div><span style={{fontSize:"20px",fontWeight:"900",color:"#38bdf8"}}>EduTok</span><span style={{fontSize:"10px",color:"#71717a",display:"block"}}>التعلم بطريقة ممتعة</span></div>
          </div>
          {role==="admin"&&<button style={C.adminBtn} onClick={()=>setScreen("admin")}><Settings size={13}/> إدارة</button>}
        </div>
      )}

      {/* WELCOME */}
      {screen==="welcome"&&(
        <div style={C.welcomeWrap}>
          <img src={LOGO} alt="EduTok" style={{width:120,height:120,marginBottom:16}}/>
          <h1 style={C.welcomeTitle}>EduTok</h1>
          <p style={{color:"#a1a1aa",fontSize:"14px",marginBottom:"32px"}}> التعلم بطريقة ممتعة</p>
          <button style={C.primaryBtn} onClick={()=>setScreen("register")}>إنشاء حساب جديد</button>
          <button style={C.secondaryBtn} onClick={()=>{setLoginPhone("");setLoginPass("");setLoginErr("");setScreen("login");}}>لدي حساب — تسجيل الدخول</button>
        </div>
      )}

      {/* REGISTER */}
      {screen==="register"&&(
        <div style={{padding:"32px 24px"}}>
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"48px"}}>📝</span><h2 style={{fontSize:"22px",fontWeight:"bold",margin:"8px 0 4px"}}>إنشاء حساب جديد</h2></div>
          <label style={C.label}> الاسم الكامل</label><input type="text" placeholder="مثال: أحمد محمد" value={regName} onChange={e=>{setRegName(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> رقم الموبايل</label><input type="text" placeholder="07XX XXX XXXX" value={regPhone} onChange={e=>{setRegPhone(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> اسم الحساب</label><input type="text" placeholder="مثال: ahmed2025" value={regAccount} onChange={e=>{setRegAccount(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> المرحلة الدراسية</label>
          <select value={regStage} onChange={e=>{setRegStage(e.target.value);setRegErr("");}} style={C.select}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <label style={C.label}> كلمة المرور</label><input type="password" placeholder="كلمة المرور" value={regPass} onChange={e=>{setRegPass(e.target.value);setRegErr("");}} style={C.input}/>
          <ErrBox msg={regErr}/>
          <button style={C.primaryBtn} onClick={doRegister}>إنشاء الحساب والدخول ←</button>
          <div style={{textAlign:"center",marginTop:"10px"}}><span style={{color:"#a1a1aa",fontSize:"13px"}}>لدي حساب؟ </span><span style={{color:"#38bdf8",cursor:"pointer",fontWeight:"bold",fontSize:"13px"}} onClick={()=>{setLoginPhone("");setLoginPass("");setLoginErr("");setScreen("login");}}>تسجيل الدخول</span></div>
          <div style={{textAlign:"center",marginTop:"8px"}}><span style={{color:"#52525b",cursor:"pointer",fontSize:"12px"}} onClick={()=>setScreen("welcome")}>← رجوع</span></div>
        </div>
      )}

      {/* LOGIN */}
      {screen==="login"&&(
        <div style={{padding:"40px 24px"}}>
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"55px"}}>🔐</span><h2 style={{fontSize:"24px",fontWeight:"bold",margin:"8px 0"}}>تسجيل الدخول</h2></div>
          <div style={{...C.infoBanner,marginBottom:"16px"}}> للطلاب المسجلين فقط</div>
          <label style={C.label}> رقم الموبايل</label><input type="text" placeholder="07XX XXX XXXX" value={loginPhone} onChange={e=>{setLoginPhone(e.target.value);setLoginErr("");}} style={C.input}/>
          <label style={C.label}> كلمة المرور</label><input type="password" placeholder="كلمة المرور" value={loginPass} onChange={e=>{setLoginPass(e.target.value);setLoginErr("");}} style={C.input} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          <ErrBox msg={loginErr}/>
          <button style={C.primaryBtn} onClick={doLogin}>دخول ←</button>
          <div style={{textAlign:"center",marginTop:"10px"}}><span style={{color:"#a1a1aa",fontSize:"13px"}}>ليس لديك حساب؟ </span><span style={{color:"#38bdf8",cursor:"pointer",fontWeight:"bold",fontSize:"13px"}} onClick={()=>{setRegName("");setRegPhone("");setRegAccount("");setRegPass("");setRegErr("");setScreen("register");}}>سجل الآن</span></div>
          <div style={{textAlign:"center",marginTop:"8px"}}><span style={{color:"#52525b",cursor:"pointer",fontSize:"12px"}} onClick={()=>setScreen("welcome")}>← رجوع</span></div>
        </div>
      )}

      {/* HOME */}
      {screen==="home"&&(
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} style={{...C.fullScreenWrap,userSelect:"none",overscrollBehavior:"none"}}>

          {/* خلفية/مشغل الفيديو يغطي الشاشة كاملة */}
          <div style={{position:"absolute",inset:0,background:video.bg||"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
            <div style={{position:"absolute",top:"60px",bottom:"80px",left:"80px",right:0,zIndex:4,cursor:"pointer"}} onClick={()=>setPlaying(p=>!p)}/>
            <VideoPlayer video={video} playing={playing} onClick={()=>setPlaying(p=>!p)}
              canAccess={role!=="student"||!video.subject||hasAccess(mySubscriptions,globalPrices,video.subject,video.stage)}
              onSubscribe={()=>setModal("description")}
            />
          </div>

          {/* هيدر عائم شفاف */}
          <div style={C.fullHeader}>
            <div style={C.logoRow} onClick={handleLogoTap}>
              <img src={LOGO} alt="logo" style={{width:26,height:26}}/>
              <span style={{fontSize:"18px",fontWeight:"900",color:"#fff"}}>EduTok</span>
            </div>
            {role==="admin"&&<button style={C.adminBtn} onClick={()=>setScreen("admin")}><Settings size={13}/> إدارة</button>}
          </div>

          {/* مؤشر وضع تصفح المادة */}
          {selectedSubject&&(
            <div style={{position:"absolute",top:"56px",left:"50%",transform:"translateX(-50%)",zIndex:20,display:"flex",alignItems:"center",gap:"6px",backgroundColor:"rgba(56,189,248,0.15)",border:"1px solid rgba(56,189,248,0.4)",borderRadius:"20px",padding:"5px 12px",backdropFilter:"blur(8px)"}}>
              <span style={{fontSize:"12px",color:"#38bdf8",fontWeight:"bold"}}>{selectedSubject.subject} • {selectedSubject.stage}</span>
              <button onClick={()=>{setSelectedSubject(null);setVideoIdx(0);}} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",padding:"0",display:"flex",alignItems:"center"}}>
                <X size={14}/>
              </button>
            </div>
          )}

          {/* الشريط الجانبي العائم */}
          <div style={C.sidebar}>
            {[
              [<Bot size={18} color="#fff"/>,"مساعد",()=>{setModal("ai");setPlaying(false);},false],
              [<MessageCircle size={18} color="#fff"/>,"نقاش",()=>setModal("chat"),false],
              [<FileText size={18} color="#fff"/>,"الوصف",()=>{setModal("description");setPlaying(false);},false],
            ].map(([icon,label,fn,active],i)=>(
              <button key={i} style={C.sideBtn(active)} onClick={fn}>{icon}<span style={C.sideTxt(active)}>{label}</span></button>
            ))}
            {role==="student"&&(
              <button style={{...C.sideBtn(false),position:"relative"}} onClick={openNotifications}>
                <Bell size={18} color="#fff"/>
                <span style={C.sideTxt(false)}>الإشعارات</span>
                {unreadNotifCount>0&&<span style={{position:"absolute",top:"-2px",right:"-2px",backgroundColor:"#ef4444",color:"#fff",borderRadius:"9px",minWidth:"16px",height:"16px",fontSize:"9px",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{unreadNotifCount>9?"9+":unreadNotifCount}</span>}
              </button>
            )}
            <button style={C.sideBtn(false)} onClick={()=>setShowMore(m=>!m)}><MoreHorizontal size={18} color="#fff"/><span style={C.sideTxt(false)}>المزيد</span></button>
          </div>

          {/* قائمة "المزيد" */}
          {showMore&&<div style={C.moreMenu}>
            {[[<FileText size={22} color="#fff"/>,"PDF","pdf"],[<Camera size={22} color="#fff"/>,"حل ذكي","solve"],[<Search size={22} color="#fff"/>,"البحث","search"],[<DollarSign size={22} color="#fff"/>,"زين كاش","wallet"]].map(([icon,label,key])=>(
              <button key={key} style={C.moreItem} onClick={()=>{setModal(key);setShowMore(false);}}>{icon}<span style={{fontSize:"11px",marginTop:"4px"}}>{label}</span></button>
            ))}
          </div>}

          {/* شريط تنقل عائم أسفل الشاشة */}
          {showNav&&(
            <div style={C.floatingNav}>
              {role==="admin"&&<button style={C.navItem(false)} onClick={()=>setScreen("admin")}><Settings size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>إدارة</span></button>}
              <button style={C.navItem(false)} onClick={()=>setScreen("account")}><User size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>حسابي</span></button>
              <button style={C.navItem(true)} onClick={()=>setScreen("home")}><Home size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>الرئيسية</span></button>
            </div>
          )}
        </div>
      )}

      {/* ADMIN */}
      {screen==="admin"&&(
        <div>
          <div style={C.tabsGrid}>
            {ADMIN_TABS.map(({key,label,Icon})=><button key={key} style={C.tab(adminTab===key)} onClick={()=>{setAdminTab(key);setShowClipForm(false);}}><Icon size={11}/>{label}</button>)}
          </div>
          <div style={C.section}>
            {adminTab==="clips"&&!showClipForm&&(
              <div>
                {confirmDeleteClip&&(
                  <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
                    <div style={{color:"#f87171",fontWeight:"bold",marginBottom:"8px"}}>هل تريد حذف "{confirmDeleteClip.title}"؟</div>
                    <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
                      <button onClick={()=>{
                        if(confirmDeleteClip.id) deleteDoc(doc(db,"clips",confirmDeleteClip.id)).then(()=>showMsg("تم الحذف")).catch(e=>showMsg("فشل: "+e.message));
                        setConfirmDeleteClip(null);
                      }} style={{padding:"8px 20px",backgroundColor:"#ef4444",border:"none",borderRadius:"8px",color:"#fff",fontWeight:"bold",cursor:"pointer"}}>نعم، احذف</button>
                      <button onClick={()=>setConfirmDeleteClip(null)} style={{padding:"8px 20px",backgroundColor:"#27272a",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer"}}>إلغاء</button>
                    </div>
                  </div>
                )}

                {/* بحث وفلتر المقاطع */}
                {(()=>{
                  const [cSearch,setCSearch]=React.useState("");
                  const [cSubj,setCSubj]=React.useState("");
                  const [cStage,setCStage]=React.useState("");
                  const filtered=clips.filter(c=>{
                    if(cSearch&&!c.title?.includes(cSearch)&&!c.subject?.includes(cSearch)) return false;
                    if(cSubj&&c.subject!==cSubj) return false;
                    if(cStage&&c.stage!==cStage) return false;
                    return true;
                  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));
                  return <>
                    <div style={{backgroundColor:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:"14px",padding:"12px",marginBottom:"12px"}}>
                      <input value={cSearch} onChange={e=>setCSearch(e.target.value)} placeholder="ابحث عن مقطع..." style={{...C.input,marginBottom:"8px",fontSize:"13px"}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                        <select value={cSubj} onChange={e=>setCSubj(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:cSubj?"#fff":"#71717a",fontSize:"12px"}}>
                          <option value="">كل المواد</option>
                          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                        </select>
                        <select value={cStage} onChange={e=>setCStage(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:cStage?"#fff":"#71717a",fontSize:"12px"}}>
                          <option value="">كل المراحل</option>
                          {STAGES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      {(cSearch||cSubj||cStage)&&<div style={{fontSize:"11px",color:"#71717a",marginTop:"6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span>{filtered.length} نتيجة</span>
                        <button onClick={()=>{setCSearch("");setCSubj("");setCStage("");}} style={{background:"none",border:"none",color:"#f87171",fontSize:"11px",cursor:"pointer"}}>مسح الفلتر ✕</button>
                      </div>}
                    </div>
                    {filtered.map((clip,i)=>(
                      <div key={i} style={{...C.card,border:"1px solid rgba(139,92,246,0.2)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                          {clip.thumbUrl?<img src={clip.thumbUrl} alt="" style={{width:44,height:44,borderRadius:"8px",objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:"8px",background:clip.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center"}}><Film size={20} color="#fff"/></div>}
                          <div style={{flex:1}}>
                            <div style={{fontWeight:"bold",fontSize:"14px"}}>{clip.num?`#${clip.num} `:""}{clip.title}</div>
                            <div style={{fontSize:"12px",color:"#71717a"}}>{clip.subject} • {clip.stage}{clip.grade?` • ${clip.grade}`:""} • {clip.type||"معلم"}</div>
                          </div>
                        </div>
                        {clip.videoUrl&&<div style={{fontSize:"11px",color:"#34d399",marginBottom:"8px"}}>✅ {getYoutubeId(clip.videoUrl)?"يوتيوب":"فيديو مباشر"}</div>}
                        {clip.slides&&<div style={{fontSize:"11px",color:"#a855f7",marginBottom:"8px"}}> {clip.slides.length} شريحة</div>}
                        <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
                          <button onClick={()=>openEditClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
                          <button onClick={()=>setConfirmDeleteClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حذف</button>
                        </div>
                      </div>
                    ))}
                    {filtered.length===0&&clips.length>0&&<div style={{textAlign:"center",padding:"20px",color:"#52525b"}}><Search size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد نتائج</div></div>}
                  </>;
                })()}

                <div style={{textAlign:"center",padding:"16px 0 10px"}}>
                  {clips.length===0&&<><Film size={48} color="#3f3f46" style={{margin:"0 auto 12px"}}/><p style={{color:"#71717a",fontSize:"14px",margin:"0 0 16px"}}>لا توجد مقاطع بعد</p></>}
                  <button style={C.gradBtn} onClick={()=>{setEditingClip(null);setShowClipForm(true);}}><Plus size={18}/> إضافة مقطع جديد</button>
                </div>
              </div>
            )}
            {adminTab==="clips"&&showClipForm&&(
              <div>
                <div style={{...C.infoBanner,marginBottom:"12px"}}><Film size={16}/><span style={{fontWeight:"bold"}}>{editingClip?"تعديل المقطع":"بيانات المقطع الجديد"}</span></div>
                <button style={{width:"100%",padding:"11px",backgroundColor:"#27272a",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px",fontSize:"13px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} onClick={resetClipForm}><X size={14}/> إغلاق</button>
                <div style={C.twoCol}>
                  <div><label style={C.label}>المرحلة</label><select style={C.select} value={clipStage} onChange={e=>{setClipStage(e.target.value);setClipGrade((GRADES[e.target.value]||[])[0]||"");}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label style={C.label}>الصف</label><select style={C.select} value={clipGrade} onChange={e=>setClipGrade(e.target.value)}>{(GRADES[clipStage]||[]).map(g=><option key={g}>{g}</option>)}</select></div>
                </div>
                <div style={C.twoCol}>
                  <div><label style={C.label}>المادة</label><select style={C.select} value={clipSubject} onChange={e=>setClipSubject(e.target.value)}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label style={C.label}>الفصل</label><select style={C.select} value={clipSemester} onChange={e=>setClipSemester(e.target.value)}>{SEMESTERS.map(s=><option key={s}>{s}</option>)}</select></div>
                </div>
                <div style={C.twoCol}>
                  <div><label style={C.label}>نوع المقطع</label><select style={C.select} value={clipType} onChange={e=>setClipType(e.target.value)}>{CLIP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                  <div><label style={C.label}>رقم المقطع</label><input type="text" value={clipNum} onChange={e=>setClipNum(e.target.value)} style={C.input} placeholder="01"/></div>
                </div>
                <label style={C.label}>العنوان</label><input type="text" value={clipTitle} onChange={e=>setClipTitle(e.target.value)} placeholder="عنوان المقطع" style={C.input}/>
                <div style={C.twoCol}>
                  <div><label style={C.label}>المعلم</label><input type="text" value={clipTeacher} onChange={e=>setClipTeacher(e.target.value)} placeholder="أ. محمد" style={C.input}/></div>
                  <div><label style={C.label}>الموبايل</label><input type="text" placeholder="07XX..." style={C.input}/></div>
                </div>
                <label style={C.label}> صورة مصغرة</label>
                <ImageUploader onUpload={url=>setClipThumbUrl(url)} onBase64={()=>{}} color="#a855f7" label="اختر صورة مصغرة للمقطع"/>
                <label style={C.label}> رابط الفيديو</label>
                <div style={{...C.infoBanner,marginBottom:"10px",fontSize:"12px"}}>✅ يدعم روابط يوتيوب ورفع الفيديو المباشر</div>
                <input type="text" placeholder="https://youtube.com/watch?v=... أو رابط مباشر" value={clipVideoUrl} onChange={e=>setClipVideoUrl(e.target.value)} style={C.input}/>
                <div style={C.saveRow}>
                  <button style={C.cancelBtn} onClick={resetClipForm}>إلغاء</button>
                  <button disabled={savingClip} style={{...C.saveBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",opacity:savingClip?0.7:1}} onClick={saveClip}>
                    {savingClip?<><Spinner size={15}/> جارٍ الحفظ...</>:<><Save size={15}/> {editingClip?"حفظ التعديلات":"حفظ وعرض"}</>}
                  </button>
                </div>
              </div>
            )}
            {adminTab==="slides"&&<SlidesStudio slidesTheme={slidesTheme} setSlidesTheme={setSlidesTheme} onSaveClip={clip=>setClips(p=>[...p,clip])}/>}
            {adminTab==="animation"&&<AnimationTab clips={clips}/>}
            {adminTab==="editor"&&<ContentEditor/>}
            {adminTab==="pdf"&&<AdminPDFTab/>}
            {adminTab==="wallet"&&<AdminWalletTab/>}
            {adminTab==="students"&&(
              <div>
                <div style={{...C.infoBanner,justifyContent:"space-between"}}><span>إجمالي الطلاب</span><strong style={{fontSize:"18px"}}>{students.length}</strong></div>
                {students.length===0?<div style={{textAlign:"center",padding:"40px 20px"}}><Users size={64} color="#3b82f6" style={{opacity:0.4,margin:"0 auto 12px"}}/><span style={{fontSize:"15px",color:"#52525b"}}>لا يوجد طلاب مسجلون بعد</span></div>
                :students.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:"10px",...C.card}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",flexShrink:0}}><User size={20} color="#fff"/></div>
                  <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:"14px"}}>{s.name}</div><div style={{color:"#38bdf8",fontSize:"12px"}}>@{s.account}</div><div style={{color:"#71717a",fontSize:"12px"}}> {s.phone}</div></div>
                  <div style={{backgroundColor:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"8px",padding:"4px 10px",fontSize:"11px",color:"#4ade80"}}>نشط</div>
                </div>)}
              </div>
            )}
            {adminTab==="prices"&&<AdminPricesTab/>}
            {adminTab==="notifications"&&(
              <div>
                <div style={C.infoBanner}><Bell size={15}/> اختر إرسال الإشعار لجميع الطلاب أو لطالب محدد فقط.</div>

                {/* اختيار نوع الإرسال */}
                <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
                  <button
                    onClick={()=>{setNotifTarget("all");setNotifStudent(null);setNotifSearch("");}}
                    style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:notifTarget==="all"?"#38bdf8":"#27272a",color:notifTarget==="all"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>
                    جميع الطلاب
                  </button>
                  <button
                    onClick={()=>setNotifTarget("single")}
                    style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",backgroundColor:notifTarget==="single"?"#38bdf8":"#27272a",color:notifTarget==="single"?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>
                    طالب محدد
                  </button>
                </div>

                {/* بحث واختيار طالب محدد */}
                {notifTarget==="single"&&(
                  <div style={{marginBottom:"14px"}}>
                    {notifStudent?(
                      <div style={{...C.card,border:"1px solid rgba(56,189,248,0.3)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:"bold",fontSize:"14px"}}>{notifStudent.name}</div>
                          <div style={{fontSize:"12px",color:"#71717a"}}>@{notifStudent.account} • {notifStudent.phone}</div>
                        </div>
                        <button onClick={()=>{setNotifStudent(null);setNotifSearch("");}} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"12px",fontWeight:"bold"}}>تغيير</button>
                      </div>
                    ):(
                      <>
                        <input
                          type="text"
                          value={notifSearch}
                          onChange={e=>setNotifSearch(e.target.value)}
                          placeholder="ابحث بالاسم أو رقم الموبايل..."
                          style={C.input}
                        />
                        <div style={{maxHeight:"220px",overflowY:"auto"}}>
                          {students
                            .filter(s=>!notifSearch.trim()||s.name?.includes(notifSearch)||s.phone?.includes(notifSearch)||s.account?.includes(notifSearch))
                            .map((s,i)=>(
                              <div key={i} onClick={()=>{setNotifStudent(s);setNotifSearch("");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"10px"}}>
                                <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",flexShrink:0}}>
                                  <User size={16} color="#fff"/>
                                </div>
                                <div>
                                  <div style={{fontWeight:"bold",fontSize:"13px"}}>{s.name}</div>
                                  <div style={{fontSize:"11px",color:"#71717a"}}>@{s.account} • {s.phone}</div>
                                </div>
                              </div>
                            ))}
                          {students.filter(s=>!notifSearch.trim()||s.name?.includes(notifSearch)||s.phone?.includes(notifSearch)||s.account?.includes(notifSearch)).length===0&&(
                            <div style={{textAlign:"center",padding:"16px",color:"#52525b",fontSize:"13px"}}>لا يوجد طالب مطابق</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px"}}>
                  {[["expire","انتهاء الاشتراك"],["new_video","مقطع جديد"],["remind","تذكير"],["offer","عرض خاص"]].map(([k,l])=><div key={k} onClick={()=>applyTemplate(k)} style={{...C.card,cursor:"pointer",textAlign:"center",padding:"12px",marginBottom:0}}>{l}</div>)}
                </div>
                <label style={C.label}>عنوان الإشعار</label><input type="text" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="العنوان" style={C.input}/>
                <label style={C.label}>نص الإشعار</label><textarea rows={3} value={notifBody} onChange={e=>setNotifBody(e.target.value)} style={{...C.input,resize:"none"}}/>
                <button disabled={sendingNotif||(notifTarget==="single"&&!notifStudent)} style={{...C.gradBtn,opacity:(sendingNotif||(notifTarget==="single"&&!notifStudent))?0.5:1}} onClick={sendNotif}>
                  {sendingNotif
                    ?<><Spinner size={16}/> جارٍ الإرسال...</>
                    :notifTarget==="single"
                      ?<><Bell size={16}/> إرسال إلى {notifStudent?notifStudent.name:"الطالب المحدد"}</>
                      :<><Bell size={16}/> إرسال لجميع الطلاب ({students.length})</>
                  }
                </button>
              </div>
            )}
            {adminTab==="settings"&&(
              <div>
                <div style={{backgroundColor:"#141417",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
                  <span style={{color:"#eab308",fontWeight:"bold",fontSize:"14px",display:"block",marginBottom:"12px"}}> بيانات المدير</span>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:"bold"}}>{auth.currentUser?.email||"—"}</span><span style={{color:"#a1a1aa"}}> البريد الإلكتروني</span></div>
                </div>
                <AdminChangePasswordCard/>
                {/* تحكم النقاش */}
                <ChatToggleCard/>
                <div style={{color:"#a855f7",fontWeight:"bold",fontSize:"14px",margin:"16px 0 8px"}}> إحصائيات</div>
                <div style={C.statsGrid}>
                  {[["🎬",clips.length,"المقاطع"],["👥",students.length,"الطلاب"],["▶",clips.filter(c=>c.videoUrl).length,"مع فيديو"],["💰","—","الأرباح"]].map(([icon,num,label])=>(
                    <div key={label} style={C.statCard}><span style={{fontSize:"22px"}}>{icon}</span><div style={{fontSize:"22px",fontWeight:"bold",color:"#a855f7",margin:"4px 0"}}>{num}</div><span style={{fontSize:"11px",color:"#71717a"}}>{label}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACCOUNT */}
      {screen==="account"&&(
        <div style={{padding:"40px 20px",textAlign:"center"}}>
          <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",justifyContent:"center",alignItems:"center",margin:"0 auto 16px"}}>
            {role==="admin"?<GraduationCap size={40} color="#fff"/>:<User size={40} color="#fff"/>}
          </div>
          {role==="admin"?(
            <>
              <h3 style={{fontSize:"18px",fontWeight:"bold",color:"#eab308"}}>المدير</h3>
              <p style={{color:"#71717a",fontSize:"13px",marginBottom:"20px"}}> {auth.currentUser?.email||""}</p>
              <div style={{backgroundColor:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"24px"}}>
                <span style={{color:"#eab308",fontSize:"13px"}}> صلاحيات المدير مفعّلة</span>
              </div>
            </>
          ):currentStudent?(
            <>
              <h3 style={{fontSize:"20px",fontWeight:"bold"}}>{currentStudent.name}</h3>
              <p style={{color:"#38bdf8",fontSize:"13px",marginBottom:"4px"}}>@{currentStudent.account}</p>
              <p style={{color:"#71717a",fontSize:"13px",marginBottom:"16px"}}> {currentStudent.phone}</p>
              {Object.keys(mySubscriptions).length>0&&(
                <div style={{textAlign:"right",marginBottom:"14px"}}>
                  <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}> اشتراكاتي:</div>
                  {Object.entries(mySubscriptions).map(([key,sub])=>{
                    const parts=key.split("__");
                    const d=daysLeft(mySubscriptions,parts[0],parts[1]);
                    return <div key={key} style={{...C.card,border:"1px solid rgba(56,189,248,0.15)",marginBottom:"6px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{sub.subject}</div><div style={{fontSize:"11px",color:"#71717a"}}>{sub.stage}</div></div>
                        <div style={{textAlign:"left"}}>
                          <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
                          <div style={{fontSize:"10px",color:"#52525b"}}>ينتهي {new Date(sub.expiresAt).toLocaleDateString("ar")}</div>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              )}
              <button style={{...C.primaryBtn,marginBottom:"10px"}} onClick={()=>setModal("wallet")}> اشترك أو جدد اشتراك</button>
            </>
          ):null}
          <button style={C.redBtn} onClick={()=>{if(role==="admin") signOut(auth).catch(()=>{});setRole("guest");setCurrentStudent(null);clearSession();setScreen("welcome");}}>تسجيل الخروج</button>
        </div>
      )}

      {/* BOTTOM NAV */}
      {showNav&&screen!=="home"&&(
        <div style={C.bottomNav}>
          {role==="admin"&&<button style={C.navItem(screen==="admin")} onClick={()=>setScreen("admin")}><Settings size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>إدارة</span></button>}
          <button style={C.navItem(screen==="account")} onClick={()=>setScreen("account")}><User size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>حسابي</span></button>
          <button style={C.navItem(screen==="home")} onClick={()=>setScreen("home")}><Home size={20}/><span style={{fontSize:"11px",fontWeight:"bold"}}>الرئيسية</span></button>
        </div>
      )}

      {/* MODALS */}
      {modal==="ai"     &&<AIModal      onClose={closeModal} video={video}/>}
      {modal==="share"  &&<ShareModal   onClose={closeModal} video={video}/>}
      {modal==="chat"   &&<ChatModal    onClose={closeModal} currentStudent={currentStudent} role={role}/>}
      {/* ✅ التعديل: إضافة onWallet لفتح نافذة زين كاش من داخل نافذة PDF */}
      {modal==="pdf"    &&<PDFModal     onClose={closeModal} studentStage={currentStudent?.stage} globalPrices={globalPrices} mySubscriptions={mySubscriptions} isAdmin={role==="admin"} onWallet={()=>setModal("wallet")}/>}
      {modal==="solve"  &&<SolveModal   onClose={closeModal} video={video}/>}
      {modal==="search" &&<SearchModal  onClose={closeModal} allVideos={allVideos}/>}
      {modal==="saved"  &&<SavedModal   onClose={closeModal} saved={saved} video={video}/>}
      {modal==="notifications" &&<NotificationsModal onClose={closeModal} notifications={myNotifications}/>}
      {modal==="description" &&<VideoDescriptionModal onClose={closeModal} video={video} role={role} mySubscriptions={mySubscriptions} globalPrices={globalPrices} onOpenWallet={()=>setModal("wallet")} onSelectSubject={(subject,stage)=>{setSelectedSubject({subject,stage});setVideoIdx(0);}} videoIdx={videoIdx} totalVideos={allVideos.length}/>}
      {modal==="wallet" &&<WalletModal  onClose={closeModal} student={currentStudent} subscriptions={mySubscriptions}/>}
      {showAdminLogin   &&<AdminLoginModal onClose={()=>setShowAdminLogin(false)} onSuccess={()=>{setRole("admin");setScreen("admin");saveSession({name:"المدير",email:auth.currentUser?.email||""},"admin");setShowAdminLogin(false);}}/> }
      <Toast/>
    </div>
  );
}
