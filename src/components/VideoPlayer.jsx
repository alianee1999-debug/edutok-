// ─── components/VideoPlayer.jsx ─────────────────────────
// عارض المقاطع بكل أنواعه: شرائح AI متحركة، يوتيوب، فيديو مباشر، Zoho Show،
// بالإضافة لطبقة "صورة صفحة الكتاب" (PageImageOverlay) المشتركة بين كل الأنواع.
import React, { useState, useEffect, useRef } from "react";
import { BookOpen, X, Play } from "lucide-react";
import { THEME_STYLES } from "../constants";
import { getYoutubeId } from "../helpers";
import { MathText } from "./Shared";

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
@keyframes pageBadgeIn{from{opacity:0;transform:scale(0.6) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes gradeBadgeIn{from{opacity:0;transform:scale(0.6) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
`;

const AnimatedSlides = ({video, playing, onClick, ts, slideIdx, setSlideIdx, fontSize="medium"}) => {
  const [visible, setVisible] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  // يتحكم بعرض/إخفاء صورة صفحة الكتاب بملء الشاشة (زر 📖 تحت شارة رقم الصفحة)
  const [showPageImage, setShowPageImage] = useState(false);
  useEffect(()=>{ setShowPageImage(false); }, [video.id]);
  const DURATION = 5000;
  const TRANSITION = 450;
  const touchX = useRef(null);

  // أحجام الخط حسب الإعداد
  const fontSizes = {
    small:  {title:"15px", point:"11px"},
    medium: {title:"18px", point:"13px"},
    large:  {title:"22px", point:"16px"},
  };
  const fs = fontSizes[fontSize] || fontSizes.medium;

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

      {/* عداد الشرائح — أعلى وسط الشاشة تماماً، بعيد عن شعار التطبيق تفادياً
          لأي تصادم بصري معه، وثابت بنفس ارتفاع الهيدر العلوي.
          اسم الفصل يظهر تحته مباشرة بنفس المحاذاة (منتصف أعلى الشاشة) */}
      <div style={{position:"absolute",top:"12px",left:"50%",transform:"translateX(-50%)",zIndex:6,display:"flex",flexDirection:"column",alignItems:"center",gap:"5px"}}>
        <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"3px 12px",border:`1px solid ${ts.accent}44`}}>
          <span dir="ltr" style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>{slideIdx+1} / {total}</span>
        </div>
        {video.topic&&(
          <div style={{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px",maxWidth:"220px"}}>
            <span style={{color:"rgba(255,255,255,0.75)",fontSize:"10px",fontWeight:"bold",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>{video.topic}</span>
          </div>
        )}
      </div>

      {/* شارة المادة والصفحة — ثابتة بموضع مطلق بنفس ارتفاع الهيدر العلوي (الشعار
          وشارة الصف)، عمداً منفصلة عن محتوى الشريحة المتحرك بالـfade، عشان تبقى
          بنفس المستوى الأفقي دايماً بغض النظر عن طول نص أي شريحة */}
      <div style={{position:"absolute",top:"12px",left:"18px",zIndex:6,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"5px"}}>
        <div style={{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"8px",padding:"3px 10px"}}>
          <span style={{color:"rgba(255,255,255,0.6)",fontSize:"10px"}}>{video.subject}</span>
        </div>
        {video.page&&(
          <div style={{display:"flex",alignItems:"center",gap:"4px",background:`linear-gradient(135deg,${ts.accent},${ts.accent}99)`,borderRadius:"20px",padding:"3px 10px 3px 8px",boxShadow:`0 2px 10px ${ts.accent}66`,animation:"pageBadgeIn 0.4s ease-out both"}}>
            <BookOpen size={11} color="#fff" strokeWidth={2.5}/>
            <span style={{color:"#fff",fontSize:"11px",fontWeight:"900",letterSpacing:"0.3px"}}>صفحة {video.page}</span>
          </div>
        )}
        {video.pageImage&&(
          <button onClick={()=>setShowPageImage(true)} title="عرض صفحة الكتاب" style={{display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:`1px solid ${ts.accent}55`,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(4px)",cursor:"pointer",padding:0,animation:"pageBadgeIn 0.5s ease-out both"}}>
            <span style={{fontSize:"15px",lineHeight:1}}>📖</span>
          </button>
        )}
      </div>

      {/* عرض صورة صفحة الكتاب بملء الشاشة — تُفتح بالضغط على أيقونة 📖 أعلاه */}
      {showPageImage&&video.pageImage&&(
        <div onClick={()=>setShowPageImage(false)} style={{position:"fixed",inset:0,zIndex:200,backgroundColor:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",animation:"pageBadgeIn 0.25s ease-out both"}}>
          <button onClick={()=>setShowPageImage(false)} style={{position:"absolute",top:"18px",left:"18px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:"38px",height:"38px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
            <X size={20}/>
          </button>
          <img src={video.pageImage} alt="صفحة الكتاب" onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:"8px"}}/>
        </div>
      )}
      <div key={animKey} style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",justifyContent:"flex-start",padding:"82px 18px 80px",animation:`${visible?"slideFadeIn":"slideFadeOut"} ${TRANSITION}ms ease forwards`}}>

        {/* أيقونة */}
        <div style={{textAlign:"center",marginBottom:"10px",animation:"iconSpin 0.6s cubic-bezier(0.34,1.56,0.64,1) both"}}>
          <span style={{fontSize:"28px",filter:`drop-shadow(0 0 8px ${ts.accent})`}}>◆</span>
        </div>

        {/* عنوان مع توهج وخط */}
        <div style={{textAlign:"center",marginBottom:"18px"}}>
          <h3 style={{color:"#fff",fontSize:fs.title,fontWeight:"900",margin:"0 0 6px",lineHeight:1.4,animation:"titleReveal 0.5s ease-out both",transformOrigin:"center",textShadow:`0 0 20px ${ts.accent}88`}}>
            <MathText text={sl.title}/>
          </h3>
          <div style={{height:"2px",background:`linear-gradient(to left,transparent,${ts.accent},transparent)`,animation:"underlineDraw 0.5s 0.2s ease-out both",width:"0%"}}/>
        </div>

        {/* النقاط */}
        <ul style={{listStyle:"none",padding:0,margin:0}}>
          {(sl.points||[]).map((pt,i)=>(
            <li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"10px",animation:`pointUp 0.4s ${0.3+i*0.15}s ease-out both`,opacity:0}}>
              <span style={{color:ts.accent,flexShrink:0,marginTop:"2px",fontSize:"12px",filter:`drop-shadow(0 0 4px ${ts.accent})`}}>◆</span>
              <span style={{color:"rgba(255,255,255,0.9)",fontSize:fs.point,lineHeight:1.6}}><MathText text={pt}/></span>
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

// ✅ إصلاح: زر "📖 صورة صفحة الكتاب" وعارضها كانا مبرمجين فقط داخل مكوّن
// AnimatedSlides (نوع "شرائح AI")، فأي مقطع من نوع آخر (يوتيوب، فيديو مباشر،
// Zoho Show) كانت صورة صفحة الكتاب المرفوعة له تُحفظ بقاعدة البيانات لكن لا
// تظهر أبداً بالشاشة الرئيسية. هذا العنصر المشترك يعرض شارة رقم الصفحة + زر
// فتح الصورة + عارض ملء الشاشة، ويُستخدم الآن مع كل أنواع المقاطع وليس الشرائح فقط.
const PageImageOverlay = ({video, accent="#38bdf8"}) => {
  const [show, setShow] = useState(false);
  useEffect(()=>{ setShow(false); }, [video.id]);
  if(!video.page && !video.pageImage) return null;
  return (
    <>
      <div style={{position:"absolute",top:"12px",left:"18px",zIndex:6,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"5px"}}>
        {video.page&&(
          <div style={{display:"flex",alignItems:"center",gap:"4px",background:`linear-gradient(135deg,${accent},${accent}99)`,borderRadius:"20px",padding:"3px 10px 3px 8px",boxShadow:`0 2px 10px ${accent}66`}}>
            <BookOpen size={11} color="#fff" strokeWidth={2.5}/>
            <span style={{color:"#fff",fontSize:"11px",fontWeight:"900",letterSpacing:"0.3px"}}>صفحة {video.page}</span>
          </div>
        )}
        {video.pageImage&&(
          <button onClick={()=>setShow(true)} title="عرض صفحة الكتاب" style={{display:"flex",alignItems:"center",justifyContent:"center",width:"30px",height:"30px",borderRadius:"50%",border:`1px solid ${accent}55`,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(4px)",cursor:"pointer",padding:0}}>
            <span style={{fontSize:"15px",lineHeight:1}}>📖</span>
          </button>
        )}
      </div>
      {show&&video.pageImage&&(
        <div onClick={()=>setShow(false)} style={{position:"fixed",inset:0,zIndex:200,backgroundColor:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <button onClick={()=>setShow(false)} style={{position:"absolute",top:"18px",left:"18px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:"38px",height:"38px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
            <X size={20}/>
          </button>
          <img src={video.pageImage} alt="صفحة الكتاب" onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:"8px"}}/>
        </div>
      )}
    </>
  );
};

const VideoPlayer = ({video, playing, onClick, canAccess=true, onSubscribe, externalSlideIdx, onExternalSlideChange, fontSize="medium"}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef(null);

  // استخدم الـ slideIdx الخارجي لو موجود
  const activeIdx = externalSlideIdx!==undefined ? externalSlideIdx : slideIdx;
  const setActiveIdx = onExternalSlideChange || setSlideIdx;

  useEffect(()=>{
    if(video.type==="شرائح AI" && video.slides?.length && playing && canAccess){
      // ✅ تعديل: كانت المدة 5 ثواني بين كل شريحة والتالية، أصبحت 8 ثواني بناءً على الطلب
      slideTimer.current = setInterval(()=>{
        setActiveIdx(i=> i < video.slides.length-1 ? i+1 : 0);
      }, 8000);
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
          {video.grade&&<div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)"}}>الصف {video.grade}</div>}
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
    return <AnimatedSlides video={video} playing={playing} onClick={onClick} ts={ts} slideIdx={activeIdx} setSlideIdx={setActiveIdx} fontSize={fontSize}/>;
  }

  // ─── Zoho Show (لا يدعم iframe — نعرض زر فتح خارجي) ────
  if(video.videoUrl && video.videoUrl.includes("zoho.com/show")){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"16px",padding:"24px",background:"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
        <PageImageOverlay video={video}/>
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

  // ✅ إضافة: "رابط خارجي فقط" — يُفحص قبل التضمين التلقائي لليوتيوب، لأن
  // المدير قد يحدده صراحة (video.linkType==="external") لأسباب قانونية
  // (محتوى مو ملكه، محاضرة أستاذ خارجي) أو تقنية (روابط Google Drive/Docs/
  // Slides لا تدعم التضمين بداخل تطبيق ثاني أصلاً — تُرفض بإعداد أمان من
  // جوجل نفسها بغض النظر عن أي محاولة). بهذي الحالة، لا نضمّن المحتوى إطلاقاً،
  // فقط نعرض زر واضح يفتحه بتبويب/تطبيق منفصل.
  if(video.videoUrl && video.linkType==="external"){
    return (
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"16px",padding:"24px",background:"linear-gradient(180deg,#0f172a,#1e1b4b)"}}>
        <PageImageOverlay video={video}/>
        <div style={{fontSize:"40px"}}>🔗</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"15px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}}>{video.title}</div>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",marginBottom:"16px"}}>هذا المحتوى يُفتح بمصدره الأصلي خارج التطبيق</div>
        </div>
        <a href={video.videoUrl} target="_blank" rel="noreferrer" style={{padding:"12px 24px",borderRadius:"12px",background:"linear-gradient(135deg,#0ea5e9,#2563eb)",color:"#fff",fontWeight:"bold",fontSize:"14px",textDecoration:"none",display:"flex",alignItems:"center",gap:"8px"}}>
          🔗 فتح المحتوى الأصلي
        </a>
      </div>
    );
  }

  const ytId = getYoutubeId(video.videoUrl);
  if(ytId) return (
    <div style={{position:"absolute",inset:0,zIndex:2}}>
      <PageImageOverlay video={video}/>
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?autoplay=${playing?1:0}&mute=0&controls=1&rel=0`}
        style={{width:"100%",height:"100%",border:"none"}}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
  if(video.videoUrl) return (
    <div style={{position:"absolute",inset:0,zIndex:2}}>
      <PageImageOverlay video={video}/>
      <video
        src={video.videoUrl}
        autoPlay={playing} loop muted playsInline
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
      />
    </div>
  );
  return (
    <>
      <PageImageOverlay video={video}/>
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

export { AnimatedSlides, PageImageOverlay, VideoPlayer };
