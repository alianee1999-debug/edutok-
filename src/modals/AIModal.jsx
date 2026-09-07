// ─── modals/AIModal.jsx ──────────────────────────────────
// "زكي" — المساعد التعليمي الذكي، بالإضافة للوحة الأناشيد/الموسيقى المصاحبة.
import React, { useState, useEffect, useRef } from "react";
import { Bot, Volume2, Sparkles, Play, Pause, X, Square } from "lucide-react";
import { C } from "../styles";
import { callAI } from "../ai";
import { stopSpeaking, speakText } from "../audioUtils";
import { Spinner, MHead, FirstUseTip, MathText } from "../components/Shared";

function AIModal({onClose,video,currentSlide,audioTracks,currentTrack,setCurrentTrack,audioPlaying,setAudioPlaying,audioVolume,setAudioVolume,onOpenOnboarding}) {
  const [showAudioPanel,setShowAudioPanel]=useState(false);
  const [q,setQ]=useState("");
  const [messages,setMessages]=useState([]); // [{role:"user"|"assistant", text}] — ذاكرة المحادثة الكاملة بالجلسة
  const [loading,setLoading]=useState(false);
  const [mode,setMode]=useState("full"); // "full" = حل كامل دفعة وحدة | "step" = خطوة بخطوة تفاعلي
  const [speakingIdx,setSpeakingIdx]=useState(null);
  const bottomRef = useRef(null);
  // ─── حماية بسيطة من إرسال أسئلة متلاحقة بسرعة ───────────
  // الأسئلة النصية تُرسل بالتوازي لأربعة مزودين مجانيين بنفس اللحظة، فطالب واحد
  // يرسل أسئلة متتالية بسرعة (بقصد أو غلط) يقدر يستنزف حصتهم اليومية بسرعة
  // ويأثر على باقي الطلاب. هذا تبريد بسيط من طرف الواجهة (مو حل شامل مضمون
  // 100%، بس يمنع الإرسال العشوائي السريع بأقل جهد ممكن)
  const AI_COOLDOWN_SECONDS = 4;
  const [cooldown,setCooldown]=useState(0);
  useEffect(()=>{
    if(cooldown<=0) return;
    const t=setTimeout(()=>setCooldown(c=>c-1),1000);
    return ()=>clearTimeout(t);
  },[cooldown]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);
  useEffect(()=>()=>stopSpeaking(),[]); // نوقف أي قراءة صوتية جارية عند إغلاق النافذة

  // نبني وصف دقيق لمحتوى الشريحة الحالية (العنوان + كل النقاط) حتى يجيب زكي بناءً على ما يراه الطالب فعلاً، مو بس اسم الدرس العام
  const slideContext = currentSlide
    ? "عنوان الشريحة الحالية: "+currentSlide.title+"\nمحتوى الشريحة (بالضبط كما يراه الطالب الآن):\n- "+(currentSlide.points||[]).join("\n- ")
    : "";

  const toggleSpeak = (idx, text) => {
    if(speakingIdx===idx){ stopSpeaking(); setSpeakingIdx(null); return; }
    const ok = speakText(text, ()=>setSpeakingIdx(null));
    setSpeakingIdx(ok?idx:null);
  };

  const ask=async(customQ, isContinue)=>{
    const question = customQ || q;
    if(!question.trim())return;
    if(cooldown>0)return; // تجاهل أي محاولة إرسال أثناء فترة التبريد
    stopSpeaking(); setSpeakingIdx(null);
    setCooldown(AI_COOLDOWN_SECONDS);
    const newUserMsg = {role:"user", text:isContinue?"(تابع الخطوة التالية)":question};
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setQ(""); setLoading(true);
    try{
      // نبني تاريخ المحادثة كسياق نصي (ذاكرة المحادثة) لأن الاتصال بالمساعد أحادي الطلب أساساً
      const historyText = messages.length>0
        ? "\n\nسياق المحادثة السابقة بهذي الجلسة (اعتمد عليه، ولا تكرر نفس الشرح إذا الطالب يبني على سؤال سابق):\n"
          + messages.map(m=>(m.role==="user"?"❯ الطالب: ":"❯ زكي: ")+m.text).join("\n")
        : "";
      const stepRule = mode==="step"
        ? "\n\nمهم جداً — وضع \"خطوة بخطوة\" مفعّل: اشرح خطوة واحدة فقط ثم توقف، واختم كلامك بجملة تشجيعية تدعو الطالب يجرب يكمل بنفسه أو يضغط زر \"الخطوة التالية\". لا تعطِ الحل الكامل دفعة وحدة."
        : "\n\nأعطِ الحل أو الشرح كاملاً ومباشرة (وضع الحل الكامل مفعّل).";
      const prompt = "أنت \"زكي\"، مساعد تعليمي ذكي وودود جداً يتكلم بالعربية الفصحى البسيطة، متخصص بمساعدة الطلاب. الطالب يشاهد درس \""+video.title+"\" في مادة "+video.subject+".\n"
        + slideContext + historyText + "\n\n"
        + "سؤال الطالب الآن: "+question+"\n\n"
        + "مهم جداً: أجب بالاعتماد على محتوى الشريحة أعلاه بالضبط (نفس الرموز والخطوات المذكورة فيها)، وليس بشرح عام عن الموضوع. "
        + "اشرح بوضوح: وضّح كل خطوة وسبب استخدامها، اربطها بالمحتوى المعروض، وإن أمكن أضف مثالاً إضافياً بسيطاً يوضح نفس الفكرة."
        + stepRule + "\n\n"
        + "قاعدة إلزامية بصيغة الكتابة: أي رمز أو معادلة رياضية يجب إحاطتها بعلامتي $ من الطرفين وكتابتها بصيغة LaTeX (مثال: $x^2$ للأس، $\\frac{1}{2}$ للكسر، $\\sqrt{x}$ للجذر). أي معادلة أو رمز كيميائي يجب كتابته داخل $\\ce{...}$ (مثال: $\\ce{H2O}$، $\\ce{N2 + 3H2 <=> 2NH3}$). لا تكتب أي رمز رياضي أو كيميائي كنص عادي خارج هذه العلامات. ممنوع استخدام صيغة \\[ ... \\] أو \\( ... \\) نهائياً تحت أي ظرف — استخدم $...$ فقط دائماً.";
      const r=await callAI(prompt);
      setMessages(cur=>[...cur, {role:"assistant", text:r||"لم أتمكن من الإجابة."}]);
    }catch(e){
      // isError + lastQuestion: تُستخدم بزر "حاول مرة أخرى" أسفل الرسالة — نعيد
      // نفس السؤال، وبما إن callAI تخلط ترتيب المزودين عشوائياً بكل استدعاء،
      // إعادة المحاولة غالباً تجرب مزوداً مختلفاً تلقائياً بدون أي تعقيد إضافي
      setMessages(cur=>[...cur, {role:"assistant", text:"حدث خطأ: "+e.message, isError:true, lastQuestion:question}]);
    }
    setLoading(false);
  };

  const lastIsAssistant = messages.length>0 && messages[messages.length-1].role==="assistant";

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)",display:"flex",flexDirection:"column"}}>
    <MHead icon={<Bot size={20} color="#38bdf8"/>} title="زكي 🤖 مساعدك التعليمي" color="#38bdf8" onClose={onClose}
      extra={
        <button onClick={()=>setShowAudioPanel(v=>!v)} title="أناشيد وموسيقى دراسة" style={{background:showAudioPanel?"rgba(56,189,248,0.15)":"none",border:"none",borderRadius:"8px",padding:"5px",cursor:"pointer",color:currentTrack?"#38bdf8":"#71717a",display:"flex",alignItems:"center"}}>
          <Volume2 size={19}/>
        </button>
      }/>

    {/* زر كبير بلون جذاب لإعادة فتح جولة الشرح التعريفية بأي وقت */}
    {onOpenOnboarding&&(
      <button onClick={onOpenOnboarding} style={{width:"100%",padding:"14px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)",backgroundSize:"200% 200%",color:"#fff",fontSize:"14px",fontWeight:"900",cursor:"pointer",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",boxShadow:"0 4px 16px rgba(236,72,153,0.35)"}}>
        <Sparkles size={18}/> كيف يعمل التطبيق؟ 🎯
      </button>
    )}

    <FirstUseTip tipKey="ai_audio_feature" text="🎵 يقدر تشغّل أناشيد وموسيقى دراسة أثناء تصفّح الدروس — اضغط أيقونة السماعة 🔊 أعلى النافذة."/>

    {/* لوحة الأناشيد/الموسيقى — اختيارية بالكامل، تظهر فقط لما الطالب يضغط
        أيقونة السماعة أعلى النافذة. التشغيل نفسه عالمي (يستمر حتى بعد إغلاق
        هذي النافذة، تديره عناصر <audio> وMini Player بجذر التطبيق) */}
    {showAudioPanel&&(
      <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"12px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}>🎵 أناشيد وموسيقى دراسة (اختياري)</div>
        {audioTracks?.length>0?(
          <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"160px",overflowY:"auto"}}>
            {audioTracks.map(t=>{
              const isActive = currentTrack?.id===t.id;
              return (
                <button key={t.id} onClick={()=>{
                    if(isActive){ setAudioPlaying(p=>!p); }
                    else { setCurrentTrack(t); setAudioPlaying(true); }
                  }}
                  style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"8px",border:`1px solid ${isActive?"#38bdf8":"rgba(255,255,255,0.08)"}`,backgroundColor:isActive?"rgba(56,189,248,0.12)":"rgba(0,0,0,0.2)",color:isActive?"#38bdf8":"#d4d4d8",fontSize:"12px",cursor:"pointer",textAlign:"right"}}>
                  {isActive&&audioPlaying?<Pause size={14} fill="currentColor"/>:<Play size={14} fill="currentColor"/>}
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                </button>
              );
            })}
          </div>
        ):(
          <div style={{fontSize:"12px",color:"#71717a",textAlign:"center",padding:"8px"}}>لا توجد أناشيد مضافة حالياً</div>
        )}
        {currentTrack&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"10px",paddingTop:"10px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <Volume2 size={14} color="#71717a"/>
            <input type="range" min="0" max="1" step="0.05" value={audioVolume}
              onChange={e=>setAudioVolume(Number(e.target.value))}
              style={{flex:1,height:"3px",accentColor:"#38bdf8",cursor:"pointer"}}/>
            <button onClick={()=>{setAudioPlaying(false);setCurrentTrack(null);}} title="إيقاف النشيد نهائياً" style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",flexShrink:0,display:"flex"}}>
              <X size={16}/>
            </button>
          </div>
        )}
      </div>
    )}

    <div style={{...C.infoBanner,marginBottom:"12px"}}> اسألني عن درس: <strong>{video.title}</strong></div>

    {/* اختيار أسلوب الحل — اختياري بالكامل، يبقى محفوظاً طول الجلسة لين يغيّره الطالب */}
    <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
      <button onClick={()=>setMode("full")} style={{flex:1,padding:"9px",borderRadius:"10px",border:`1px solid ${mode==="full"?"#38bdf8":"rgba(255,255,255,0.1)"}`,backgroundColor:mode==="full"?"rgba(56,189,248,0.15)":"transparent",color:mode==="full"?"#38bdf8":"#a1a1aa",fontSize:"12.5px",fontWeight:"bold",cursor:"pointer"}}>🎯 حل كامل</button>
      <button onClick={()=>setMode("step")} style={{flex:1,padding:"9px",borderRadius:"10px",border:`1px solid ${mode==="step"?"#a855f7":"rgba(255,255,255,0.1)"}`,backgroundColor:mode==="step"?"rgba(168,85,247,0.15)":"transparent",color:mode==="step"?"#c084fc":"#a1a1aa",fontSize:"12.5px",fontWeight:"bold",cursor:"pointer"}}>🪜 خطوة بخطوة</button>
    </div>

    {messages.length===0&&!loading&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
      <button onClick={()=>ask("اشرحلي هذي الشريحة بالتفصيل الكامل خطوة بخطوة")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>📖 اشرح بالتفصيل</button>
      <button onClick={()=>ask("لم أفهم هذي الفكرة، اشرحها بطريقة أبسط مع مثال جديد مختلف")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>🐣 أبسط مع مثال</button>
      <button onClick={()=>ask("ليش نستخدم هذي الخطوة أو القاعدة بالذات هنا؟")} style={{padding:"8px 12px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>🤔 ليش هالخطوة؟</button>
    </div>}

    {messages.length>0&&<div style={{maxHeight:"46vh",overflowY:"auto",marginBottom:"12px",paddingLeft:"2px"}}>
      {messages.map((m,i)=>(
        m.role==="user"?(
          <div key={i} style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}>
            <div style={{maxWidth:"85%",backgroundColor:"rgba(56,189,248,0.15)",border:"1px solid rgba(56,189,248,0.25)",borderRadius:"14px 14px 4px 14px",padding:"10px 14px",fontSize:"15.5px",lineHeight:"1.7",color:"#e0f2fe"}}>{m.text}</div>
          </div>
        ):(
          <div key={i} style={{marginBottom:"14px"}}>
            <div style={{backgroundColor:"#09090b",borderRadius:"14px 14px 14px 4px",padding:"14px",border:"1px solid rgba(56,189,248,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div style={{color:"#38bdf8",fontSize:"12px",fontWeight:"bold"}}>🤖 زكي</div>
                <button onClick={()=>toggleSpeak(i,m.text)} title="استمع للشرح" style={{background:"none",border:"none",cursor:"pointer",color:speakingIdx===i?"#a855f7":"#71717a",display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",padding:"2px 4px"}}>
                  {speakingIdx===i?<><Square size={14}/> إيقاف</>:<><Volume2 size={14}/> استمع</>}
                </button>
              </div>
              <div style={{fontSize:"16.5px",color:"#e4e4e7",lineHeight:"1.85",whiteSpace:"pre-wrap"}}><MathText text={m.text} mathHighlight/></div>
              {m.isError&&(
                <button
                  onClick={()=>ask(m.lastQuestion)}
                  disabled={loading}
                  style={{marginTop:"10px",width:"100%",padding:"9px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.35)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"13px",fontWeight:"bold",cursor:loading?"default":"pointer",opacity:loading?0.6:1}}
                >
                  🔄 حاول مرة أخرى
                </button>
              )}
            </div>
          </div>
        )
      ))}
      <div ref={bottomRef}/>
    </div>}

    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner/><div style={{marginTop:"8px",fontSize:"13px",color:"#38bdf8"}}>زكي يفكّر...</div></div>}

    {!loading&&mode==="step"&&lastIsAssistant&&(
      <button onClick={()=>ask(messages[messages.length-2]?.text||"تابع من نفس الموضوع", true)} style={{...C.secondaryBtn,marginBottom:"10px",border:"1px solid rgba(168,85,247,0.35)",color:"#c084fc",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>⏭ الخطوة التالية</button>
    )}

    <textarea rows={3} value={q} onChange={e=>setQ(e.target.value)} placeholder="اكتب سؤالك هنا..." style={{...C.input,resize:"none",marginBottom:"10px",fontSize:"15.5px"}}/>
    <button onClick={()=>ask()} disabled={loading||!q.trim()||cooldown>0} style={{...C.primaryBtn,opacity:(q.trim()&&cooldown===0)?1:0.5,marginBottom:0}}>
      <Bot size={16}/> {cooldown>0?`انتظر ${cooldown} ثانية...`:"أرسل السؤال"}
    </button>
  </div></div>;
}

export { AIModal };
