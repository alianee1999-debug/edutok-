import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc, doc } from "firebase/firestore";
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

// ─── KEYS & CONSTANTS ───────────────────────────────────
const GROQ_KEY = "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";
const IMGBB_KEY    = "92c2c743edc0ac25a6e50a247f811b95";
const ADMIN_PHONE  = "07700000000";
const ADMIN_PASS   = "admin123";
const ZAINCASH_NUM = "07700000000";
const LOGO         = "https://cdn-icons-png.flaticon.com/512/8841/8841503.png";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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
  {key:"pdf",           label:"PDF",        Icon:FileText},
  {key:"wallet",        label:"المحفظة",   Icon:DollarSign},
  {key:"students",      label:"الطلاب",    Icon:Users},
  {key:"prices",        label:"الأسعار",   Icon:Bell},
  {key:"notifications", label:"إشعارات",   Icon:Bell},
  {key:"settings",      label:"الإعدادات", Icon:Settings},
];
const SAMPLE_VIDEOS = [
  {id:"s1",title:"مقدمة في الجبر",teacher:"أ. أحمد",subject:"الرياضيات",stage:"الابتدائية",duration:"2:30",bg:"linear-gradient(180deg,#0f172a,#1e1b4b)",videoUrl:"",youtubeId:""},
  {id:"s2",title:"قوانين نيوتن",teacher:"أ. سارة",subject:"الفيزياء",stage:"الإعدادية",duration:"3:15",bg:"linear-gradient(180deg,#042f2e,#0d3b2e)",videoUrl:"",youtubeId:""},
  {id:"s3",title:"الجهاز التنفسي",teacher:"أ. خالد",subject:"الأحياء",stage:"المتوسطة",duration:"4:00",bg:"linear-gradient(180deg,#1a1a2e,#16213e)",videoUrl:"",youtubeId:""},
];

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

// ─── PREVENT PULL TO REFRESH (only on home video screen) ─
// We handle this via CSS overscroll-behavior instead of JS
// to avoid blocking scroll in admin pages

// ─── YOUTUBE HELPER ─────────────────────────────────────
const getYoutubeId = (url) => {
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
};

// ─── GROQ AI ────────────────────────────────────────────
const callGroq = async (prompt, imageBase64=null, imageMime="image/jpeg") => {
  // For text only - use fast llama model
  if (!imageBase64) {
    const res = await fetch(GROQ_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
      body: JSON.stringify({
        model:"llama-3.3-70b-versatile",
        messages:[{role:"user", content: prompt}],
        temperature:0.7,
        max_tokens:2000
      })
    });
    const d = await res.json();
    if(d.error) throw new Error(d.error.message||"Groq error");
    return d.choices?.[0]?.message?.content || "";
  }
  // For images - use llama-4-scout vision model
  const res = await fetch(GROQ_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
    body: JSON.stringify({
      model:"meta-llama/llama-4-scout-17b-16e-instruct",
      messages:[{role:"user", content:[
        {type:"image_url", image_url:{url:`data:${imageMime};base64,${imageBase64}`}},
        {type:"text", text: prompt}
      ]}],
      temperature:0.7,
      max_tokens:2000
    })
  });
  const d = await res.json();
  if(d.error) throw new Error(d.error.message||"Groq vision error");
  return d.choices?.[0]?.message?.content || "";
};
const callGemini = callGroq;

// ─── IMGBB UPLOAD ────────────────────────────────────────
const uploadToImgBB = async (file) => {
  const form = new FormData();
  form.append("image", file);
  form.append("key", IMGBB_KEY);
  const res = await fetch("https://api.imgbb.com/1/upload",{method:"POST",body:form});
  const d = await res.json();
  if(d.success) return {url:d.data.url, base64:d.data.image?.base64||null};
  throw new Error("فشل رفع الصورة");
};

// ─── STYLES ─────────────────────────────────────────────
const C = {
  app:{width:"100%",maxWidth:"420px",minHeight:"100vh",backgroundColor:"#09090b",color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif",direction:"rtl",margin:"0 auto",paddingBottom:"72px",boxSizing:"border-box",overflowX:"hidden",position:"relative"},
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
  sidebar:{position:"absolute",left:"16px",top:"8%",display:"flex",flexDirection:"column",gap:"14px",zIndex:15},
  sideBtn:(a)=>({width:"50px",height:"50px",borderRadius:"50%",backgroundColor:a?"rgba(34,211,238,0.2)":"rgba(15,23,42,0.75)",border:a?"1px solid #22d3ee":"1px solid rgba(255,255,255,0.1)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",cursor:"pointer",color:"#fff",gap:"1px"}),
  sideTxt:(a)=>({fontSize:"10px",color:a?"#22d3ee":"#cbd5e1"}),
  moreMenu:{position:"absolute",bottom:"20px",left:"16px",right:"16px",backgroundColor:"rgba(24,24,27,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px",padding:"14px 12px",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:30,backdropFilter:"blur(12px)"},
  moreItem:{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:"#fff",padding:"4px 8px"},
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
const VideoPlayer = ({video, playing, onClick}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef(null);

  // Auto-advance slides when playing
  useEffect(()=>{
    if(video.type==="شرائح AI" && video.slides?.length && playing){
      slideTimer.current = setInterval(()=>{
        setSlideIdx(i=> i < video.slides.length-1 ? i+1 : 0);
      }, 4000);
    }
    return ()=>clearInterval(slideTimer.current);
  },[playing, video]);

  // Slides player
  if(video.type==="شرائح AI" && video.slides?.length){
    const ts = THEME_STYLES[video.theme] || THEME_STYLES["أزرق متدرج"];
    const sl = video.slides[slideIdx] || {};
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,background:ts.bg,display:"flex",flexDirection:"column",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}} onClick={onClick}>
        {/* Slide counter */}
        <div style={{position:"absolute",top:"12px",left:"16px",backgroundColor:ts.card,borderRadius:"8px",padding:"3px 10px",border:"1px solid "+ts.accent+"44"}}>
          <span style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>{slideIdx+1} / {video.slides.length}</span>
        </div>
        {/* Subject badge */}
        <div style={{position:"absolute",top:"12px",right:"16px",backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px"}}>
          <span style={{color:"rgba(255,255,255,0.7)",fontSize:"10px"}}>{video.subject}</span>
        </div>
        {/* Slide content */}
        <div style={{marginTop:"32px"}}>
          <h3 style={{color:"#fff",fontSize:"18px",fontWeight:"bold",marginBottom:"16px",lineHeight:"1.5",textAlign:"center"}}>{sl.title}</h3>
          <ul style={{listStyle:"none",padding:0,margin:0}}>
            {(sl.points||[]).map((pt,i)=>(
              <li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",color:"rgba(255,255,255,0.9)",fontSize:"13px",lineHeight:"1.6"}}>
                <span style={{color:ts.accent,flexShrink:0,fontSize:"16px"}}>◆</span>{pt}
              </li>
            ))}
          </ul>
        </div>
        {/* Progress dots */}
        <div style={{display:"flex",gap:"5px",justifyContent:"center",marginTop:"16px",flexWrap:"wrap"}}>
          {video.slides.map((_,i)=>(
            <div key={i} onClick={e=>{e.stopPropagation();setSlideIdx(i);}} style={{width:i===slideIdx?"18px":"7px",height:"7px",borderRadius:"4px",backgroundColor:i===slideIdx?ts.accent:"rgba(255,255,255,0.3)",cursor:"pointer",transition:"width 0.2s"}}/>
          ))}
        </div>
        {/* Nav buttons */}
        <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
          <button disabled={slideIdx===0} onClick={e=>{e.stopPropagation();setSlideIdx(i=>i-1);}} style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",backgroundColor:slideIdx===0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.15)",color:slideIdx===0?"rgba(255,255,255,0.3)":"#fff",cursor:slideIdx===0?"not-allowed":"pointer",fontWeight:"bold",fontSize:"13px"}}>◀ السابق</button>
          <button
            disabled={slideIdx===video.slides.length-1}
            onClick={e=>{e.stopPropagation();setSlideIdx(i=>i+1);}}
            style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",
              backgroundColor:slideIdx===video.slides.length-1?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.15)",
              color:slideIdx===video.slides.length-1?"rgba(255,255,255,0.3)":"#fff",
              cursor:slideIdx===video.slides.length-1?"not-allowed":"pointer",
              fontWeight:"bold",fontSize:"13px"}}>
            التالي
          </button>
        </div>
        {/* Play indicator */}
        {playing&&<div style={{position:"absolute",bottom:"12px",right:"12px",fontSize:"10px",color:ts.accent}}>▶ تشغيل تلقائي</div>}
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
  // No video — show thumbnail or gradient bg
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
function ChatModal({onClose}) {
  const [msg,setMsg]=useState("");
  const [msgs,setMsgs]=useState([{text:"هل شرح الأستاذ واضح؟",from:"other",name:"أحمد"},{text:"نعم ممتاز ",from:"me"}]);
  const send=()=>{if(!msg.trim())return;setMsgs(p=>[...p,{text:msg,from:"me"}]);setMsg("");};
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.2)"}}>
    <MHead icon={<MessageCircle size={20} color="#a855f7"/>} title="غرفة النقاش" color="#a855f7" onClose={onClose}/>
    <div style={{backgroundColor:"#09090b",borderRadius:"12px",padding:"12px",marginBottom:"12px",maxHeight:"200px",overflowY:"auto"}}>
      {msgs.map((m,i)=>(
        <div key={i} style={{display:"flex",gap:"8px",marginBottom:"10px",justifyContent:m.from==="me"?"flex-end":"flex-start"}}>
          {m.from!=="me"&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><User size={14} color="#fff"/></div>}
          <div style={{backgroundColor:m.from==="me"?"rgba(168,85,247,0.2)":"#1c1c1e",borderRadius:"10px",padding:"8px 12px",maxWidth:"70%"}}>
            {m.name&&<div style={{fontSize:"10px",color:"#71717a",marginBottom:"2px"}}>{m.name}</div>}
            <div style={{fontSize:"13px"}}>{m.text}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{display:"flex",gap:"8px"}}>
      <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="اكتب رسالتك..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
      <button onClick={send} style={{padding:"10px 14px",backgroundColor:"#a855f7",border:"none",borderRadius:"10px",color:"#fff",cursor:"pointer",fontWeight:"bold"}}>إرسال</button>
    </div>
  </div></div>;
}

// ─── PDF MODAL ───────────────────────────────────────────
function PDFModal({onClose,isSubbed}) {
  const [files,setFiles]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"pdfs"),snap=>{setFiles(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    return ()=>unsub();
  },[]);
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    {!isSubbed&&(
      <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"4px"}}>محتوى مدفوع</div>
        <div style={{color:"#71717a",fontSize:"12px",marginBottom:"10px"}}>اشترك للوصول لجميع الملازم</div>
        <button onClick={onClose} style={{backgroundColor:"#f97316",border:"none",borderRadius:"10px",padding:"8px 20px",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>اشترك الآن عبر زين كاش</button>
      </div>
    )}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :files.length===0?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد ملفات بعد</div></div>
    :files.map(f=>(
      <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",...C.card}}>
        <div><div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div><div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}</div></div>
        {isSubbed?<a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 12px",color:"#f97316",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none"}}>تحميل</a>
        :<button onClick={onClose} style={{backgroundColor:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"8px",padding:"6px 12px",color:"#fbbf24",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}> اشترك</button>}
      </div>
    ))}
  </div></div>;
}

// ─── SOLVE MODAL (with FileReader + Groq Vision) ─────────
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
function SearchModal({onClose,allVideos}) {
  const [q,setQ]=useState("");
  const filtered=allVideos.filter(v=>!q||v.title?.includes(q)||v.subject?.includes(q));
  return <div style={C.overlay}><div style={C.modalBox}>
    <MHead icon={<Search size={20} color="#38bdf8"/>} title="البحث في المقاطع" onClose={onClose}/>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن درس أو مادة..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
    </div>
    {filtered.map((v,i)=>(
      <div key={i} onClick={onClose} style={{display:"flex",alignItems:"center",gap:"10px",...C.card,cursor:"pointer"}}>
        <div style={{width:36,height:36,borderRadius:"8px",background:v.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v.thumbUrl?<img src={v.thumbUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"8px"}}/>:<Film size={16} color="#fff"/>}</div>
        <div><div style={{fontSize:"13px",fontWeight:"bold"}}>{v.title}</div><div style={{fontSize:"11px",color:"#71717a"}}>{v.subject} • {v.stage}</div></div>
      </div>
    ))}
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

// ─── ADMIN LOGIN MODAL ───────────────────────────────────
function AdminLoginModal({onClose,onSuccess}) {
  const [phone,setPhone]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const login=()=>{if(phone===ADMIN_PHONE&&pass===ADMIN_PASS)onSuccess();else setErr("رقم الهاتف أو كلمة المرور غير صحيحة");};
  return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(234,179,8,0.2)"}}>
    <div style={{textAlign:"center",marginBottom:"20px"}}>
      <GraduationCap size={40} color="#eab308" style={{margin:"0 auto 8px"}}/>
      <h3 style={{color:"#eab308",fontWeight:"bold",fontSize:"18px",margin:"0 0 4px"}}>دخول المدير</h3>
    </div>
    <label style={C.label}> رقم الهاتف</label>
    <input type="text" value={phone} onChange={e=>{setPhone(e.target.value);setErr("");}} placeholder="07XX XXX XXXX" style={C.input}/>
    <label style={C.label}> كلمة المرور</label>
    <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} placeholder="كلمة المرور" style={C.input} onKeyDown={e=>e.key==="Enter"&&login()}/>
    <ErrBox msg={err}/>
    <button onClick={login} style={{...C.gradBtn,background:"linear-gradient(to right,#eab308,#f97316)"}}>دخول لوحة الإدارة ←</button>
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
    <div style={{fontSize:"56px",marginBottom:"12px"}}>OK</div>
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
    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="أدخل المبلغ" style={C.input}/>
    <label style={C.label}> إيصال التحويل</label>
    <ImageUploader onUpload={url=>setReceipt(url)} onBase64={()=>{}} color="#4ade80" label="صوّر إيصال زين كاش"/>
    {sending?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#4ade80"/></div>
    :<button onClick={sendPayment} style={{...C.primaryBtn,background:"linear-gradient(to right,#15803d,#4ade80)",marginBottom:0}}>إرسال طلب الاشتراك للمدير</button>}
  </div></div>;
}

// ─── SLIDES STUDIO (with Gemini) ─────────────────────────
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
  const [saving,setSaving]=useState(false);
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
      await addDoc(collection(db,"clips"),{title:clipTitle,subject:clipSubj,stage:clipStage,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)",createdAt:serverTimestamp()});
      onSaveClip({title:clipTitle,subject:clipSubj,stage:clipStage,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)"});
      showMsg(" تم حفظ الشرائح في Firebase!");
      setMode("menu");
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSaving(false);
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
    <div style={{...C.twoCol,marginBottom:"16px"}}>
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
    <div style={{fontSize:"13px",color:"#38bdf8",fontWeight:"bold",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}><Layers size={14}/> الثيم</div>
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
      {THEMES.map(t=><button key={t.label} onClick={()=>setSlidesTheme(t.label)} style={{padding:"8px 14px",borderRadius:"10px",border:slidesTheme===t.label?"2px solid #38bdf8":"none",backgroundColor:t.color,color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>{t.label}</button>)}
    </div>
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
          reader.onload=(ev)=>{const full=ev.target.result;setImgPreview(full);setImgB64(full.split(",")[1]);};
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

  if(mode==="result"){const sl=slides[curSlide]||{}; return <div>
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
      <div style={{...C.twoCol,marginBottom:"10px"}}>
        <select value={clipSubj} onChange={e=>setClipSubj(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={clipStage} onChange={e=>setClipStage(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
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
      {[["",totalReceived.toLocaleString()+" د.ع","المستلم"],["⏳",pending.length,"معلقة"],["",payments.filter(p=>p.status==="approved").length,"مؤكدة"]].map(([icon,val,label])=>(
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
            <button onClick={()=>approvePayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",color:"#4ade80",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>OK قبول وتفعيل</button>
            <button onClick={()=>rejectPayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",color:"#f87171",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>X رفض</button>
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

// ─── MAIN APP ────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("welcome");
  const [role,setRole]=useState("guest");
  const [currentStudent,setCurrentStudent]=useState(null);
  const [students,setStudents]=useState([]);
  const [clips,setClips]=useState([]);
  const [mySubscriptions,setMySubscriptions]=useState({});

  // Load saved session on startup - only if student has valid data
  useEffect(()=>{
    const session = loadSession();
    if(session?.student?.phone && session?.student?.pass && session?.role){
      // Verify session is valid (has required fields)
      if(session.role === "admin" || (session.student.name && session.student.account)){
        setCurrentStudent(session.student);
        setRole(session.role);
        setScreen("home");
      } else {
        clearSession();
      }
    }
  },[]);

  const [regName,setRegName]=useState(""); const [regPhone,setRegPhone]=useState(""); const [regAccount,setRegAccount]=useState(""); const [regPass,setRegPass]=useState(""); const [regErr,setRegErr]=useState("");
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

  const [videoIdx,setVideoIdx]=useState(0); const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState(false); const [showMore,setShowMore]=useState(false);
  const [modal,setModal]=useState(null);
  const [tapCount,setTapCount]=useState(0); const [showAdminLogin,setShowAdminLogin]=useState(false);
  const tapTimer=useRef(null); const touchStartY=useRef(null);

  // Firebase listeners
  useEffect(()=>{
    const u1=onSnapshot(collection(db,"students"),snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u2=onSnapshot(collection(db,"clips"),snap=>{setClips(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return ()=>{u1();u2();};
  },[]);

  // Load subscriptions for current student
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

  // Check subscription expiry notifications
  useEffect(()=>{
    if(!currentStudent||!Object.keys(mySubscriptions).length) return;
    Object.entries(mySubscriptions).forEach(([key,sub])=>{
      const d=daysLeft(mySubscriptions,key.split("__")[0],key.split("__")[1]);
      if(d===3||d===1) {
        // Could add push notification here
        console.log("اشتراك "+sub.subject+" ينتهي خلال "+d+" يوم");
      }
    });
  },[mySubscriptions]);

  useEffect(()=>{if(screen==="home")setPlaying(true);else setPlaying(false);},[screen]);
  useEffect(()=>{if(screen==="home")setPlaying(true);},[videoIdx]);

  // All videos: Firebase clips first, then samples
  const allVideos=[...clips,...SAMPLE_VIDEOS];
  const video=allVideos[videoIdx]||SAMPLE_VIDEOS[0];

  const handleLogoTap=()=>{setTapCount(c=>{const n=c+1;if(n>=6){setShowAdminLogin(true);clearTimeout(tapTimer.current);return 0;}clearTimeout(tapTimer.current);tapTimer.current=setTimeout(()=>setTapCount(0),2000);return n;});};
  const handleTouchStart=(e)=>{
    touchStartY.current=e.touches[0].clientY;
  };
  const handleTouchEnd=(e)=>{
    if(touchStartY.current===null)return;
    const diff=touchStartY.current-e.changedTouches[0].clientY;
    if(Math.abs(diff)<50){touchStartY.current=null;return;}
    if(diff>0)setVideoIdx(i=>Math.min(i+1,allVideos.length-1));
    else setVideoIdx(i=>Math.max(i-1,0));
    touchStartY.current=null;
  };
  const handleTouchMove=(e)=>{
    // Prevent pull-to-refresh on home screen only when at top
    if(e.touches[0].clientY > touchStartY.current && window.scrollY === 0){
      e.preventDefault();
    }
  };

  const doRegister=async()=>{
    if(!regName.trim())return setRegErr("الرجاء إدخال الاسم");
    if(!regPhone.trim())return setRegErr("الرجاء إدخال رقم الموبايل");
    if(!regAccount.trim())return setRegErr("الرجاء إدخال اسم الحساب");
    if(!regPass.trim())return setRegErr("الرجاء إدخال كلمة المرور");
    if(students.find(s=>s.phone===regPhone.trim()))return setRegErr("رقم الموبايل مسجل مسبقاً");
    try{const s={name:regName.trim(),phone:regPhone.trim(),account:regAccount.trim(),pass:regPass.trim(),createdAt:serverTimestamp()};await addDoc(collection(db,"students"),s);setCurrentStudent(s);setRole("student");setScreen("home");saveSession(s,"student");setRegName("");setRegPhone("");setRegAccount("");setRegPass("");setRegErr("");}
    catch(e){setRegErr("فشل التسجيل: "+e.message);}
  };

  const doLogin=()=>{
    if(!loginPhone.trim()||!loginPass.trim())return setLoginErr("أدخل رقم الموبايل وكلمة المرور");
    const found=students.find(s=>s.phone===loginPhone.trim()&&s.pass===loginPass.trim());
    if(found){setCurrentStudent(found);setRole("student");setScreen("home");saveSession(found,"student");setLoginPhone("");setLoginPass("");setLoginErr("");}
    else{const ex=students.find(s=>s.phone===loginPhone.trim());setLoginErr(ex?"كلمة المرور غير صحيحة":"رقم الموبايل غير مسجل");}
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
        // Edit mode
        await updateDoc(doc(db,"clips",editingClip.id),data);
        showMsg(" تم تعديل المقطع!");
      } else {
        // Add mode
        await addDoc(collection(db,"clips"),{...data,createdAt:serverTimestamp()});
        showMsg(" تم حفظ المقطع وسيظهر في الشاشة الرئيسية!");
      }
      resetClipForm();
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSavingClip(false);
  };

  const sendNotif=async()=>{
    if(!notifTitle.trim()||!notifBody.trim())return showMsg("أدخل العنوان والنص");
    setSendingNotif(true);
    try{await addDoc(collection(db,"notifications"),{title:notifTitle,body:notifBody,sentAt:serverTimestamp(),sentTo:students.length});showMsg(" تم إرسال الإشعار لـ "+students.length+" طالب!");setNotifTitle("");setNotifBody("");}
    catch(e){showMsg("فشل: "+e.message);}
    setSendingNotif(false);
  };

  const applyTemplate=(t)=>{const T={expire:["تنبيه انتهاء الاشتراك","عزيزي الطالب، يرجى تجديد اشتراكك."],new_video:["تم رفع درس جديد! ","قام الأستاذ برفع مقطع تعليمي جديد الآن."],remind:["حان وقت المذاكرة ","ادخل وراجع دروسك ربع ساعة."],offer:["خصم 50% لفترة محدودة ","اشترك الآن بنصف السعر."]};setNotifTitle(T[t][0]);setNotifBody(T[t][1]);};

  const closeModal=()=>setModal(null);
  const showNav=screen!=="welcome"&&screen!=="login"&&screen!=="register";
  const isSubbed=Object.values(mySubscriptions).some(s=>new Date(s.expiresAt)>new Date());

  return (
    <div style={C.app}>

      {/* HEADER */}
      {showNav&&(
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
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"48px"}}></span><h2 style={{fontSize:"22px",fontWeight:"bold",margin:"8px 0 4px"}}>إنشاء حساب جديد</h2></div>
          <label style={C.label}> الاسم الكامل</label><input type="text" placeholder="مثال: أحمد محمد" value={regName} onChange={e=>{setRegName(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> رقم الموبايل</label><input type="text" placeholder="07XX XXX XXXX" value={regPhone} onChange={e=>{setRegPhone(e.target.value);setRegErr("");}} style={C.input}/>
          <label style={C.label}> اسم الحساب</label><input type="text" placeholder="مثال: ahmed2025" value={regAccount} onChange={e=>{setRegAccount(e.target.value);setRegErr("");}} style={C.input}/>
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
          <div style={{textAlign:"center",marginBottom:"24px"}}><span style={{fontSize:"55px"}}></span><h2 style={{fontSize:"24px",fontWeight:"bold",margin:"8px 0"}}>تسجيل الدخول</h2></div>
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
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} style={{userSelect:"none",overscrollBehavior:"none"}}>
          <div style={{...C.videoWrap,background:video.bg||"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
            {/* Tap overlay — only right side so sidebar works */}
            <div style={{position:"absolute",top:0,bottom:0,left:"80px",right:0,zIndex:4,cursor:"pointer"}} onClick={()=>setPlaying(p=>!p)}/>
            {/* Swipe arrows */}
            {videoIdx>0&&<div style={{position:"absolute",top:"10px",left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,0.4)",zIndex:6}}><ChevronUp size={22}/></div>}
            {videoIdx<allVideos.length-1&&<div style={{position:"absolute",bottom:"80px",left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,0.4)",zIndex:6}}><ChevronDown size={22}/></div>}
            {/* Video player */}
            <VideoPlayer video={video} playing={playing} onClick={()=>setPlaying(p=>!p)}/>
            {/* Sidebar */}
            <div style={C.sidebar}>
              {[
                [<Bookmark size={18} color={saved?"#22d3ee":"#fff"} fill={saved?"#22d3ee":"none"}/>,saved?"محفوظ":"حفظ",()=>setSaved(s=>!s),saved],
                [<Share2 size={18} color="#fff"/>,"مشاركة",()=>setModal("share"),false],
                [<Bot size={18} color="#fff"/>,"مساعد",()=>{setModal("ai");setPlaying(false);},false],
                [<MessageCircle size={18} color="#fff"/>,"نقاش",()=>setModal("chat"),false],
                [<MoreHorizontal size={18} color="#fff"/>,"المزيد",()=>setShowMore(m=>!m),false],
              ].map(([icon,label,fn,active],i)=>(
                <button key={i} style={C.sideBtn(active)} onClick={fn}>{icon}<span style={C.sideTxt(active)}>{label}</span></button>
              ))}
            </div>
            {/* Progress dots */}
            <div style={{position:"absolute",top:"12px",right:"16px",display:"flex",flexDirection:"column",gap:"4px",zIndex:6}}>
              {allVideos.slice(0,8).map((_,i)=><div key={i} style={{width:"3px",height:i===videoIdx?"20px":"8px",borderRadius:"3px",backgroundColor:i===videoIdx?"#38bdf8":"rgba(255,255,255,0.25)",transition:"height 0.2s"}}/>)}
            </div>
            {/* More menu */}
            {showMore&&<div style={C.moreMenu}>
              {[[<FileText size={22} color="#fff"/>,"PDF","pdf"],[<Camera size={22} color="#fff"/>,"حل ذكي","solve"],[<Search size={22} color="#fff"/>,"البحث","search"],[<DollarSign size={22} color="#fff"/>,"زين كاش","wallet"]].map(([icon,label,key])=>(
                <button key={key} style={C.moreItem} onClick={()=>{setModal(key);setShowMore(false);}}>{icon}<span style={{fontSize:"11px",marginTop:"4px"}}>{label}</span></button>
              ))}
            </div>}
          </div>
          {/* Video info */}
          <div style={{padding:"0 20px",marginTop:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
              <h2 style={{fontSize:"18px",fontWeight:"bold",margin:0}}>{video.title}</h2>
              <span style={{backgroundColor:"rgba(14,116,144,0.3)",border:"1px solid #0e7490",color:"#22d3ee",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.type||"معلم"}</span>
              {video.duration&&<span style={{backgroundColor:"rgba(255,255,255,0.08)",color:"#d1d5db",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.duration} </span>}
            </div>
            <p style={{fontSize:"13px",color:"#cbd5e1",margin:"0 0 8px"}}>‍ {video.teacher} • {video.subject} • {video.stage}</p>
            {/* Subscription status */}
            {role==="student"&&video.subject&&(()=>{
              const d=daysLeft(mySubscriptions,video.subject,video.stage);
              const sub=isSubscribed(mySubscriptions,video.subject,video.stage);
              if(sub&&d<=3) return (
                <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"10px",padding:"8px 12px",fontSize:"12px",color:"#fbbf24",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>اشتراك {video.subject} ينتهي خلال {d} يوم</span>
                  <button onClick={()=>setModal("wallet")} style={{backgroundColor:"#f97316",border:"none",borderRadius:"6px",padding:"4px 10px",color:"#fff",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}}>جدد</button>
                </div>
              );
              if(!sub) return (
                <div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"8px 12px",fontSize:"12px",color:"#f87171",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>اشترك للوصول لمحتوى {video.subject}</span>
                  <button onClick={()=>setModal("wallet")} style={{backgroundColor:"#ef4444",border:"none",borderRadius:"6px",padding:"4px 10px",color:"#fff",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}}>اشترك</button>
                </div>
              );
              return null;
            })()}
            <div style={{display:"flex",gap:"6px",marginTop:"10px",justifyContent:"center"}}>
              {allVideos.slice(0,8).map((_,i)=><div key={i} onClick={()=>setVideoIdx(i)} style={{width:i===videoIdx?"20px":"6px",height:"6px",borderRadius:"3px",backgroundColor:i===videoIdx?"#38bdf8":"#3f3f46",cursor:"pointer",transition:"width 0.2s"}}/>)}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN */}
      {screen==="admin"&&(
        <div>
          <div style={C.tabsGrid}>
            {ADMIN_TABS.map(({key,label,Icon})=><button key={key} style={C.tab(adminTab===key)} onClick={()=>{setAdminTab(key);setShowClipForm(false);}}><Icon size={11}/>{label}</button>)}
          </div>
          <div style={C.section}>
            {/* CLIPS TAB */}
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
                {clips.map((clip,i)=>(
                  <div key={i} style={{...C.card,border:"1px solid rgba(139,92,246,0.2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                      {clip.thumbUrl?<img src={clip.thumbUrl} alt="" style={{width:44,height:44,borderRadius:"8px",objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:"8px",background:clip.bg||"linear-gradient(135deg,#1e1b4b,#312e81)",display:"flex",alignItems:"center",justifyContent:"center"}}><Film size={20} color="#fff"/></div>}
                      <div style={{flex:1}}>
                        <div style={{fontWeight:"bold",fontSize:"14px"}}>{clip.title}</div>
                        <div style={{fontSize:"12px",color:"#71717a"}}>{clip.subject} • {clip.stage} • {clip.type||"معلم"}</div>
                      </div>
                    </div>
                    {clip.videoUrl&&<div style={{fontSize:"11px",color:"#34d399",marginBottom:"8px"}}>OK {getYoutubeId(clip.videoUrl)?"يوتيوب":"فيديو مباشر"}</div>}
                    {clip.slides&&<div style={{fontSize:"11px",color:"#a855f7",marginBottom:"8px"}}> {clip.slides.length} شريحة</div>}
                    <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
                      <button onClick={()=>openEditClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                         تعديل
                      </button>
                      <button onClick={()=>setConfirmDeleteClip(clip)} style={{flex:1,padding:"8px",borderRadius:"10px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
                         حذف
                      </button>
                    </div>
                  </div>
                ))}
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
                <div style={{...C.infoBanner,marginBottom:"10px",fontSize:"12px"}}>OK يدعم روابط يوتيوب ورفع الفيديو المباشر</div>
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
            {adminTab==="prices"&&(
              <div>
                <div style={C.infoBanner}> حدد سعراً لكل مادة حسب المرحلة + سعر ملازم PDF</div>
                {PRICE_SUBJECTS.map(subj=>(
                  <div key={subj}>
                    <div style={{fontSize:"14px",color:"#38bdf8",textAlign:"center",margin:"14px 0 8px"}}> {subj}</div>
                    {STAGES.map(stage=>(
                      <div key={stage} style={C.priceRow}>
                        <span style={{fontSize:"14px",color:"#e4e4e7",minWidth:"60px"}}>{stage}</span>
                        <div style={{display:"flex",alignItems:"center",gap:"6px",backgroundColor:"#09090b",padding:"6px 10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)",flex:1,margin:"0 10px"}}>
                          <input type="number" placeholder="0" style={C.priceInput}/>
                        </div>
                        <span style={{color:"#71717a",fontSize:"12px"}}>د.ع</span>
                      </div>
                    ))}
                  </div>
                ))}
                <button style={{...C.gradBtn,marginTop:"16px"}} onClick={()=>showMsg("تم حفظ الأسعار!")}><Save size={16}/> حفظ الأسعار</button>
              </div>
            )}
            {adminTab==="notifications"&&(
              <div>
                <div style={C.infoBanner}><Bell size={15}/> الإشعارات تُرسل لـ {students.length} طالب.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px"}}>
                  {[["expire","انتهاء الاشتراك"],["new_video","مقطع جديد"],["remind","تذكير"],["offer","عرض خاص"]].map(([k,l])=><div key={k} onClick={()=>applyTemplate(k)} style={{...C.card,cursor:"pointer",textAlign:"center",padding:"12px",marginBottom:0}}>{l}</div>)}
                </div>
                <label style={C.label}>عنوان الإشعار</label><input type="text" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="العنوان" style={C.input}/>
                <label style={C.label}>نص الإشعار</label><textarea rows={3} value={notifBody} onChange={e=>setNotifBody(e.target.value)} style={{...C.input,resize:"none"}}/>
                <button disabled={sendingNotif} style={{...C.gradBtn,opacity:sendingNotif?0.7:1}} onClick={sendNotif}>
                  {sendingNotif?<><Spinner size={16}/> جارٍ الإرسال...</>:<><Bell size={16}/> إرسال لجميع الطلاب ({students.length})</>}
                </button>
              </div>
            )}
            {adminTab==="settings"&&(
              <div>
                <div style={{backgroundColor:"#141417",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
                  <span style={{color:"#eab308",fontWeight:"bold",fontSize:"14px",display:"block",marginBottom:"12px"}}> بيانات المدير</span>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{fontWeight:"bold"}}>{ADMIN_PHONE}</span><span style={{color:"#a1a1aa"}}> الهاتف</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{letterSpacing:"2px"}}>••••••••</span><span style={{color:"#a1a1aa"}}> المرور</span></div>
                </div>
                <div style={C.card}><span style={{color:"#38bdf8",fontWeight:"bold",fontSize:"13px",display:"block",marginBottom:"10px"}}> تغيير رقم الهاتف</span><input type="text" placeholder="07XX XXX XXXX" style={C.input}/><button style={C.blueBtn} onClick={()=>showMsg("تم!")}>تغيير</button></div>
                <div style={{...C.card,marginTop:"10px"}}><span style={{color:"#ef4444",fontWeight:"bold",fontSize:"13px",display:"block",marginBottom:"10px"}}> تغيير كلمة المرور</span><input type="password" placeholder="كلمة المرور الجديدة" style={C.input}/><button style={C.redBtn} onClick={()=>showMsg("تم!")}>تغيير</button></div>
                <div style={{color:"#a855f7",fontWeight:"bold",fontSize:"14px",margin:"16px 0 8px"}}> إحصائيات</div>
                <div style={C.statsGrid}>
                  {[["",clips.length,"المقاطع"],["",students.length,"الطلاب"],["",clips.filter(c=>c.videoUrl).length,"مع فيديو"],["","—","الأرباح"]].map(([icon,num,label])=>(
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
            {role==="admin"?<GraduationCap size={40} color="#fff"/>:<User size={4
