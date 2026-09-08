// ─── components/VideoPlayer.jsx ─────────────────────────
// عارض المقاطع بكل أنواعه: شرائح AI متحركة، يوتيوب، فيديو مباشر، Zoho Show،
// بالإضافة لطبقة "صورة صفحة الكتاب" (PageImageOverlay) المشتركة بين كل الأنواع.
import React, { useState, useEffect, useRef } from "react";
import { BookOpen, X, Play } from "lucide-react";
import { THEME_STYLES } from "../constants";
import { getYoutubeId } from "../helpers";
import { MathText } from "./Shared";
import { playCorrectSound, playWrongSound } from "../audioUtils";

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
@keyframes quizIconWiggle{0%{transform:rotate(0deg) scale(1)}4%{transform:rotate(-14deg) scale(1.08)}8%{transform:rotate(12deg) scale(1.08)}12%{transform:rotate(-9deg) scale(1.05)}16%{transform:rotate(7deg) scale(1.03)}20%{transform:rotate(-4deg) scale(1.01)}24%{transform:rotate(0deg) scale(1)}100%{transform:rotate(0deg) scale(1)}}
@keyframes quizModalIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
@keyframes confettiFall{0%{transform:translateY(-16px) rotate(0deg);opacity:1}100%{transform:translateY(300px) rotate(400deg);opacity:0}}
@keyframes wrongShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes wrongIconPop{0%{transform:scale(0.4) rotate(-15deg);opacity:0}60%{transform:scale(1.15) rotate(8deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}
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

  // ─── سؤال الشريحة (اختياري) — رمز عائم قابل للسحب، يفتح نافذة سؤال سريع ───
  const containerRef = useRef(null);
  const [quizPos, setQuizPos] = useState(null); // {x,y}px بالنسبة للحاوية، null = الموضع الافتراضي (يمين/أسفل)
  const [dragging, setDragging] = useState(false);
  const dragInfo = useRef({offsetX:0,offsetY:0,startX:0,startY:0,moved:false});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSelected, setQuizSelected] = useState(null);
  const [confetti] = useState(()=>Array.from({length:24},(_,i)=>({
    id:i,
    left:(Math.random()*90+5)+"%",
    color:["#f43f5e","#facc15","#4ade80","#38bdf8","#a855f7","#fb923c"][i%6],
    delay:(Math.random()*0.35).toFixed(2)+"s",
    dur:(0.9+Math.random()*0.6).toFixed(2)+"s",
    size:6+Math.random()*5,
  })));
  useEffect(()=>{ setQuizPos(null); }, [video.id]); // نرجّع الرمز لموضعه الافتراضي عند تغيّر المقطع
  useEffect(()=>{ setShowQuiz(false); setQuizSelected(null); }, [slideIdx]); // نغلق نافذة السؤال عند تغيّر الشريحة (يبقى موضع الرمز محفوظاً)

  const QUIZ_ICON_SIZE = 34;
  // ─── فتح السؤال: onClick عادي (نفس آلية زر 📖 صورة الكتاب المضمونة الشغل) ───
  // ─── السحب: تتبّع لمس منفصل تمامًا، بلا أي علاقة بمنطق الفتح ───
  const justDraggedRef = useRef(false);
  const beginQuizDrag = (e) => {
    e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    const rect = containerRef.current.getBoundingClientRect();
    const btnRect = e.currentTarget.getBoundingClientRect();
    dragInfo.current = {
      offsetX: t.clientX - btnRect.left,
      offsetY: t.clientY - btnRect.top,
      startX: t.clientX, startY: t.clientY,
      moved: false,
    };
    setDragging(true);
  };
  const moveQuizTo = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const dx = clientX - dragInfo.current.startX;
    const dy = clientY - dragInfo.current.startY;
    if(Math.abs(dx)>8 || Math.abs(dy)>8){ dragInfo.current.moved = true; justDraggedRef.current = true; }
    let x = clientX - rect.left - dragInfo.current.offsetX;
    let y = clientY - rect.top - dragInfo.current.offsetY;
    x = Math.max(4, Math.min(x, rect.width - QUIZ_ICON_SIZE - 4));
    y = Math.max(4, Math.min(y, rect.height - QUIZ_ICON_SIZE - 4));
    setQuizPos({x,y});
  };
  const handleQuizTouchMove = (e) => {
    if(!dragging) return;
    e.stopPropagation();
    if(e.cancelable) e.preventDefault();
    const t = e.touches[0];
    moveQuizTo(t.clientX, t.clientY);
  };
  const endQuizDrag = (e) => {
    e.stopPropagation();
    setDragging(false);
  };
  // الفأرة (لاختبار سطح المكتب) — تحتاج مستمعين على المستند لأن مؤشر الفأرة
  // ممكن يطلع بره حدود الرمز أثناء السحب، بعكس اللمس اللي يبقى مربوط بنفس العنصر
  useEffect(()=>{
    if(!dragging) return;
    const onMove=(e)=>moveQuizTo(e.clientX, e.clientY);
    const onUp=()=>setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return ()=>{
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  },[dragging]);
  // فتح نافذة السؤال — onClick عادي مضمون الشغل، إلا إذا كانت آخر لمسة سحبًا فعليًا
  const handleQuizIconClick = (e) => {
    e.stopPropagation();
    if(justDraggedRef.current){ justDraggedRef.current=false; return; }
    setShowQuiz(true);
  };
  const handleQuizAnswer = (idx, correctIndex) => {
    if(quizSelected!==null) return;
    setQuizSelected(idx);
    if(idx===correctIndex) playCorrectSound(); else playWrongSound();
  };

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
    <div ref={containerRef} style={{position:"absolute",inset:0,zIndex:6,background:ts.bg,overflow:"hidden",cursor:"pointer"}}
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

      {/* ─── رمز سؤال الشريحة (اختياري) — يظهر فقط لو المدير حط سؤالاً لهذه
          الشريحة تحديداً. قابل للسحب بإصبع الطالب لأي مكان بالشاشة، وضغطة
          بسيطة بدون سحب تفتح نافذة السؤال. ─── */}
      {sl.question&&(
        <button
          onClick={handleQuizIconClick}
          onTouchStart={beginQuizDrag}
          onTouchMove={handleQuizTouchMove}
          onTouchEnd={endQuizDrag}
          onTouchCancel={endQuizDrag}
          onMouseDown={beginQuizDrag}
          title="سؤال سريع"
          style={{
            position:"absolute",
            ...(quizPos?{left:quizPos.x+"px",top:quizPos.y+"px"}:{right:"10px",bottom:"88px"}),
            zIndex:15,width:QUIZ_ICON_SIZE+"px",height:QUIZ_ICON_SIZE+"px",borderRadius:"50%",border:"none",
            background:"linear-gradient(135deg,#f59e0b,#facc15)",
            boxShadow: dragging?"0 0 0 4px rgba(250,204,21,0.35)":"0 2px 8px rgba(250,204,21,0.5)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"16px",cursor:"grab",touchAction:"none",userSelect:"none",padding:0,
            animation: dragging?"none":"quizIconWiggle 2s ease-in-out infinite",
          }}
        >💡</button>
      )}

      {/* ─── نافذة السؤال السريع ─── */}
      {showQuiz&&sl.question&&(
        <div
          onClick={e=>e.stopPropagation()}
          onTouchStart={e=>e.stopPropagation()}
          onTouchEnd={e=>e.stopPropagation()}
          style={{position:"fixed",inset:0,zIndex:300,backgroundColor:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}
        >
          <div style={{position:"relative",width:"100%",maxWidth:"360px",background:"linear-gradient(160deg,#18181b,#0c0c0e)",border:"1px solid rgba(250,204,21,0.3)",borderRadius:"20px",padding:"22px 18px",animation:"quizModalIn 0.25s ease-out both",overflow:"hidden"}}>
            {/* رذاذ ألوان عند الإجابة الصحيحة */}
            {quizSelected!==null&&quizSelected===sl.question.correctIndex&&(
              <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
                {confetti.map(p=>(
                  <div key={p.id} style={{position:"absolute",top:"-16px",left:p.left,width:p.size+"px",height:p.size+"px",backgroundColor:p.color,borderRadius:"2px",animation:`confettiFall ${p.dur} ${p.delay} ease-in forwards`}}/>
                ))}
              </div>
            )}
            <button onClick={()=>setShowQuiz(false)} style={{position:"absolute",top:"10px",left:"10px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"50%",width:"30px",height:"30px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
              <X size={16}/>
            </button>
            <div style={{textAlign:"center",marginBottom:"6px",fontSize:"11px",color:"#facc15",fontWeight:"bold"}}>💡 سؤال سريع</div>
            <div style={{textAlign:"center",fontSize:"15px",fontWeight:"bold",color:"#fff",marginBottom:"18px",lineHeight:1.6}}><MathText text={sl.question.q}/></div>
            <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
              {(sl.question.options||[]).map((opt,i)=>{
                const isSel = quizSelected===i;
                const isCorrectOpt = i===sl.question.correctIndex;
                let bg="rgba(255,255,255,0.06)", border="1px solid rgba(255,255,255,0.1)", color="#e4e4e7";
                if(quizSelected!==null){
                  if(isCorrectOpt){bg="rgba(34,197,94,0.18)";border="1px solid rgba(34,197,94,0.5)";color="#4ade80";}
                  else if(isSel){bg="rgba(239,68,68,0.18)";border="1px solid rgba(239,68,68,0.5)";color="#f87171";}
                }
                return (
                  <button key={i} disabled={quizSelected!==null} onClick={()=>handleQuizAnswer(i,sl.question.correctIndex)}
                    style={{padding:"12px 14px",borderRadius:"12px",background:bg,border,color,fontSize:"13px",fontWeight:"bold",textAlign:"right",cursor:quizSelected===null?"pointer":"default",
                      animation:(quizSelected!==null&&isSel&&!isCorrectOpt)?"wrongShake 0.4s ease-in-out":"none"}}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {quizSelected!==null&&(
              quizSelected===sl.question.correctIndex
                ?<div style={{textAlign:"center",marginTop:"14px",fontSize:"13px",fontWeight:"bold",color:"#4ade80"}}>🎉 إجابة صحيحة!</div>
                :<div style={{textAlign:"center",marginTop:"14px",fontSize:"22px",animation:"wrongIconPop 0.4s ease-out both"}}>😅</div>
            )}
          </div>
        </div>
      )}
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
