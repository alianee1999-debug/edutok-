// ─── components/ExplainBackModal.jsx ────────────────────
// ميزة "اشرحلي بكلامك" (أسلوب فاينمان): بدل ما الذكاء الاصطناعي يشرح للطالب،
// الطالب يشرح فهمه بكلامه، والذكاء الاصطناعي يحلل الفجوات ويرد بسؤال توجيهي
// واحد يشجعه يكتشفها بنفسه — بدون تصحيح مباشر وبدون تصنيف صح/خطأ ثنائي.
//
// ─── وضعان مختلفان حسب المادة ───────────────────────────
// 1) مواد نظرية (افتراضي): نص أو صوت لوصف الفهم بجُمَل — كما كان.
// 2) مواد فيها مسائل (رياضيات/فيزياء/كيمياء): الصوت هو المصدر الأساسي دائماً
//    (الطالب يشرح خطوات حله وهو يشاور على ورقته)، لأن خط الطالب غالباً غير
//    واضح بما يكفي ليكون مصدراً موثوقاً وحده. صورة ورقة الحل اختيارية تماماً
//    وتُستخدم فقط كمرجع بصري ثانوي يساعد الذكاء الاصطناعي يتأكد من رقم أو
//    رمز معيّن ذكره الطالب صوتياً — لا نطلب منه "قراءة" الصورة كمصدر أساسي.
//
// تصميم التغذية الراجعة (مهم، مو تفصيل عرضي):
//  - فهم كامل → احتفال هادئ (توهج ذهبي)، مختلف بصرياً عن كونفيتي سؤال الشريحة
//  - فهم جزئي (الحالة الأشيع) → لا احتفال ولا رمز خطأ، فقط سؤال فضولي واحد
//  - نهاية الحلقة (٣ محاولات كحد أقصى) → ملخص إيجابي: إبراز المُغطّى أولاً،
//    والباقي كـ"نقاط للمراجعة" لا كفشل
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Send, Mic, Square, Camera } from "lucide-react";
import { callAI } from "../ai";

const MAX_ATTEMPTS = 3;
const PROBLEM_SUBJECTS = ["الرياضيات", "الفيزياء", "الكيمياء"];

// ─── التعرّف على الصوت المدمج بالمتصفح (Web Speech API) ─────────────
const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

const TEXTAREA_STYLE = {
  width:"100%",boxSizing:"border-box",padding:"12px",backgroundColor:"#09090b",
  border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",color:"#fff",
  fontSize:"13px",resize:"none",marginBottom:"12px",fontFamily:"inherit",
};

const buildExplainPrompt = (clipTitle, slidesText, transcript, latestReply, isProblemSubject, hasImage) => {
  const transcriptText = transcript.map(t =>
    t.role==="ai" ? `أنت سألت: "${t.text}"` : `الطالب أجاب: "${t.text}"`
  ).join("\n");

  if(isProblemSubject){
    return `أنت مساعد تعليمي لمادة تحتوي على مسائل وحلول (رياضيات/فيزياء/كيمياء). طالب شرح خطوات حل مسألة متعلقة بموضوع "${clipTitle}" بصوته وهو يشاور على ورقة حله (النص أدناه مُفرَّغ من كلامه الصوتي).

طريقة الحل الصحيحة (من شرائح المقطع):
${slidesText}

${transcriptText ? "سجل المحادثة حتى الآن:\n"+transcriptText+"\n" : ""}
شرح الطالب لخطوات حله (مُفرَّغ من الصوت): "${latestReply}"
${hasImage ? "\nمرفق أيضاً صورة لورقة حل الطالب — هذي مرجع بصري ثانوي فقط، استخدمها فقط لو ساعدتك تتأكد من رقم أو رمز محدد ذكره بصوته. لو الخط غير واضح أو الصورة غامضة، لا تحاول تخمين منها إطلاقاً، واعتمد فقط على الشرح الصوتي المكتوب أعلاه." : ""}

مهمتك:
1. حدد الخطوات الصحيحة اللي ذكرها الطالب بشرحه (المنهجية والمفهوم المستخدم بكل خطوة، لا الأرقام فقط).
2. حدد الخطوات الأساسية بطريقة الحل اللي لم يذكرها إطلاقاً أو تخطّاها.
3. لو فيه خطأ بمنهجية الحل (طريقة أو مفهوم خاطئ، لا مجرد خطأ حسابي بسيط بالأرقام)، اذكره بإيجاز ولطف شديد (وإلا اجعلها null).
4. لو فيه خطوة ناقصة أو خطأ بالمنهجية: اطرح سؤالاً توجيهياً واحداً بسيطاً يشجّعه يكتشف الخطوة الناقصة بنفسه، مثل "طيب، بعد ما توصلت لهالخطوة، وش المفروض تسوي بعدها؟" — بدون إعطاء الحل مباشرة.
5. لو غطى خطوات الحل الأساسية صح، اعتبره فهماً كاملاً (complete:true) ولا حاجة لسؤال.

أجب بـ JSON فقط بلا أي نص خارجه بهذا الشكل بالضبط:
{"covered":["خطوة1"],"missing":["خطوة2"],"wrongNote":null,"followUpQuestion":null,"complete":false}`;
  }

  return `أنت مساعد تعليمي. طالب يشرح فهمه لموضوع "${clipTitle}" بكلامه الخاصة (أسلوب فاينمان — الطالب يشرح كأنه يعلّم شخصاً لا يعرف عن الموضوع شيئاً).

محتوى الموضوع الصحيح (من شرائح المقطع):
${slidesText}

${transcriptText ? "سجل المحادثة حتى الآن:\n"+transcriptText+"\n" : ""}
آخر شرح من الطالب: "${latestReply}"

مهمتك:
1. حدد النقاط الأساسية اللي غطاها الطالب بشكل صحيح (بالنظر لكل السجل مجتمعاً، لا آخر رد فقط).
2. حدد النقاط الأساسية اللي لم يُذكر أي منها إطلاقاً حتى الآن.
3. لو فيه معلومة خاطئة صراحة بشرحه، اذكرها بإيجاز ولطف شديد (وإلا اجعلها null).
4. لو فيه نقاط ناقصة أو خطأ: اطرح سؤالاً توجيهياً واحداً بسيطاً وودوداً يشجّع الطالب يكتشف الفجوة بنفسه، بأسلوب فضولي لا تصحيحي، وبدون ما تعطيه الإجابة مباشرة أو تقول له "خطأ".
5. لو غطى كل النقاط الأساسية بدون أخطاء واضحة، اعتبره فهماً كاملاً (complete:true) ولا حاجة لسؤال (followUpQuestion:null).

أجب بـ JSON فقط بلا أي نص خارجه بهذا الشكل بالضبط:
{"covered":["نقطة1","نقطة2"],"missing":["نقطة3"],"wrongNote":null,"followUpQuestion":null,"complete":false}`;
};

const parseExplainResponse = (raw) => {
  const clean = raw.replace(/```json/g,"").replace(/```/g,"").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if(start===-1||end===-1) throw new Error("رد غير صالح من المساعد الذكي");
  const fixed = clean.substring(start,end+1).replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
  const parsed = JSON.parse(fixed);
  return {
    covered: Array.isArray(parsed.covered) ? parsed.covered : [],
    missing: Array.isArray(parsed.missing) ? parsed.missing : [],
    wrongNote: parsed.wrongNote || null,
    followUpQuestion: parsed.followUpQuestion || null,
    complete: !!parsed.complete,
  };
};

const ExplainBackModal = ({ video, onClose }) => {
  const clipTitle = video.title || "هذا الموضوع";
  const slidesText = (video.slides||[])
    .map(s => "- "+(s.title||"")+": "+((s.points||[]).join("، ")))
    .join("\n");
  const isProblemSubject = PROBLEM_SUBJECTS.includes(video.subject);

  // intro → loading → followup (يتكرر) → complete | wrapup
  const [stage, setStage] = useState("intro");
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState([]); // [{role:'ai'|'student', text}]
  const [attempts, setAttempts] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(!isProblemSubject);

  // ─── صورة ورقة الحل (اختياري، مواد المسائل فقط) ─────────
  const [imgB64, setImgB64] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const handleImageUpload = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w=img.width, h=img.height;
        if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;} else {w=Math.round(w*MAX/h);h=MAX;} }
        const canvas=document.createElement("canvas");
        canvas.width=w; canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const compressed=canvas.toDataURL("image/jpeg",0.6);
        setImgPreview(compressed);
        setImgB64(compressed.split(",")[1]);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const removeImage = () => { setImgB64(null); setImgPreview(null); };

  // ─── التسجيل الصوتي ───────────────────────────────────
  const SpeechRecognitionCtor = getSpeechRecognition();
  const speechSupported = !!SpeechRecognitionCtor;
  const [listening, setListening] = useState(false);
  const [micErr, setMicErr] = useState("");
  const recognitionRef = useRef(null);
  const micBaseText = useRef("");
  const micFinalText = useRef("");

  useEffect(()=>()=>{ recognitionRef.current?.stop(); }, []); // نوقف التسجيل لو أُغلقت النافذة فجأة

  const startListening = () => {
    if(!speechSupported || listening) return;
    setMicErr("");
    micBaseText.current = input.trim() ? input.trim()+" " : "";
    micFinalText.current = "";
    const recog = new SpeechRecognitionCtor();
    recog.lang = "ar-SA";
    recog.interimResults = true;
    recog.continuous = true;
    recog.onresult = (e) => {
      let interim = "";
      for(let i=e.resultIndex; i<e.results.length; i++){
        const t = e.results[i][0].transcript;
        if(e.results[i].isFinal) micFinalText.current += t+" ";
        else interim += t;
      }
      setInput((micBaseText.current + micFinalText.current + interim).trim());
    };
    recog.onerror = (e) => {
      setMicErr(e.error==="not-allowed" ? "يرجى السماح باستخدام الميكروفون من إعدادات المتصفح" : "تعذّر التعرف على الصوت، جرّب مرة ثانية أو اكتب");
      setListening(false);
    };
    recog.onend = () => setListening(false);
    recognitionRef.current = recog;
    try{ recog.start(); setListening(true); }
    catch{ setMicErr("تعذّر بدء التسجيل"); }
  };
  const stopListening = () => { recognitionRef.current?.stop(); setListening(false); };

  const submit = async () => {
    if(!input.trim()) return;
    if(listening) stopListening();
    const myReply = input.trim();
    const myImg = imgB64;
    setInput("");
    removeImage();
    setErrMsg("");
    setStage("loading");
    try{
      const prompt = buildExplainPrompt(clipTitle, slidesText, transcript, myReply, isProblemSubject, !!myImg);
      const raw = await callAI(prompt, myImg, "image/jpeg");
      const result = parseExplainResponse(raw);
      const newAttempts = attempts+1;
      const newTranscript = [...transcript, {role:"student", text:myReply}];
      setAttempts(newAttempts);
      setLastResult(result);

      if(result.complete){
        setTranscript(newTranscript);
        setStage("complete");
      } else if(newAttempts>=MAX_ATTEMPTS || !result.followUpQuestion){
        setTranscript(newTranscript);
        setStage("wrapup");
      } else {
        setTranscript([...newTranscript, {role:"ai", text:result.followUpQuestion}]);
        setStage("followup");
      }
    }catch(e){
      setErrMsg("تعذّر تحليل الشرح: "+e.message+". حاول أرسله مرة ثانية.");
      setStage(transcript.length===0 ? "intro" : "followup");
      setInput(myReply); // نرجّع نص الطالب بدل ما يضيع لو فشل الاتصال
    }
  };

  // ─── منطقة الإدخال المشتركة (صوت/نص/صورة) — تُستخدم بمرحلتي البداية والمتابعة ───
  const renderInputArea = (placeholder) => (
    <div>
      {isProblemSubject ? (
        <>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:"12px"}}>
            {speechSupported ? (
              <>
                <button
                  type="button"
                  onClick={listening?stopListening:startListening}
                  style={{
                    width:"72px",height:"72px",borderRadius:"50%",border:"none",
                    background: listening ? "linear-gradient(135deg,#ef4444,#f87171)" : "linear-gradient(135deg,#4f46e5,#818cf8)",
                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                    animation: listening ? "micPulseRing 1.6s ease-out infinite" : "micIdleGlow 2.6s ease-in-out infinite",
                    marginBottom:"10px",
                  }}
                >
                  {listening ? <Square size={26} color="#fff"/> : <Mic size={28} color="#fff"/>}
                </button>
                <div style={{fontSize:"12px",fontWeight:"bold",color: listening?"#f87171":"#a5b4fc",textAlign:"center",lineHeight:1.6}}>
                  {listening ? "🔴 يسجل الآن... اضغط للإيقاف" : "اضغط وابدأ اشرح خطوات حلك بصوتك"}
                </div>
              </>
            ):(
              <div style={{fontSize:"12px",color:"#f87171",textAlign:"center"}}>التسجيل الصوتي غير مدعوم بمتصفحك — اكتب حلك بالأسفل</div>
            )}
          </div>
          {micErr&&<div style={{fontSize:"11px",color:"#f87171",marginBottom:"10px",textAlign:"center"}}>{micErr}</div>}

          {input.trim() && (
            <div style={{backgroundColor:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 12px",marginBottom:"10px",fontSize:"12px",color:"#d4d4d8",lineHeight:1.6}}>
              {input}
            </div>
          )}

          {speechSupported && (
            <button type="button" onClick={()=>setShowTextFallback(s=>!s)} style={{display:"block",margin:"0 auto 10px",background:"none",border:"none",color:"#818cf8",fontSize:"11px",fontWeight:"bold",cursor:"pointer",textDecoration:"underline"}}>
              {showTextFallback ? "إخفاء الكتابة" : "✏️ عدّل أو اكتب يدويًا بدل الصوت"}
            </button>
          )}
          {showTextFallback && (
            <textarea rows={4} value={input} onChange={e=>setInput(e.target.value)} placeholder={placeholder} style={TEXTAREA_STYLE}/>
          )}

          <div style={{marginBottom:"4px"}}>
            {imgPreview ? (
              <div style={{position:"relative",display:"inline-block"}}>
                <img src={imgPreview} alt="صورة ورقة الحل" style={{maxWidth:"100%",maxHeight:"120px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.15)",display:"block"}}/>
                <button type="button" onClick={removeImage} style={{position:"absolute",top:"-8px",left:"-8px",width:"24px",height:"24px",borderRadius:"50%",border:"none",backgroundColor:"#ef4444",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  <X size={13}/>
                </button>
              </div>
            ):(
              <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"10px",border:"1.5px dashed rgba(129,140,248,0.4)",borderRadius:"10px",cursor:"pointer",fontSize:"11px",color:"#a5b4fc"}}>
                <Camera size={14}/> أضف صورة ورقة الحل (اختياري)
                <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
              </label>
            )}
          </div>
        </>
      ) : (
        <>
          {speechSupported && (
            <>
              <button
                type="button"
                onClick={listening?stopListening:startListening}
                style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  width:"100%",padding:"10px",borderRadius:"10px",
                  border: listening ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(129,140,248,0.35)",
                  backgroundColor: listening ? "rgba(239,68,68,0.12)" : "rgba(129,140,248,0.1)",
                  color: listening ? "#f87171" : "#a5b4fc",
                  fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginBottom:"10px",
                  animation: listening ? "micPulseRing 1.6s ease-out infinite" : "none",
                }}
              >
                {listening ? <><Square size={13}/> إيقاف التسجيل — تحدّث الآن</> : <><Mic size={13}/> أو سجّل صوتك</>}
              </button>
              {micErr&&<div style={{fontSize:"11px",color:"#f87171",marginBottom:"8px",textAlign:"center"}}>{micErr}</div>}
            </>
          )}
          <textarea rows={5} value={input} onChange={e=>setInput(e.target.value)} placeholder={placeholder} style={TEXTAREA_STYLE}/>
        </>
      )}
    </div>
  );

  const attemptBadge = (stage==="intro"||stage==="followup"||stage==="loading") && (
    <div style={{position:"absolute",top:"14px",right:"16px",fontSize:"10px",fontWeight:"bold",color:"#818cf8",backgroundColor:"rgba(129,140,248,0.12)",border:"1px solid rgba(129,140,248,0.25)",borderRadius:"20px",padding:"3px 10px"}}>
      المحاولة {Math.min(attempts+1,MAX_ATTEMPTS)} من {MAX_ATTEMPTS}
    </div>
  );

  return createPortal(
    <div
      onClick={e=>e.stopPropagation()}
      onTouchStart={e=>e.stopPropagation()}
      onTouchEnd={e=>e.stopPropagation()}
      style={{position:"fixed",inset:0,zIndex:9999,backgroundColor:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}
    >
      <style>{`
        @keyframes micPulseRing{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}70%{box-shadow:0 0 0 18px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
        @keyframes micIdleGlow{0%,100%{box-shadow:0 0 0 0 rgba(129,140,248,0.35)}50%{box-shadow:0 0 0 10px rgba(129,140,248,0)}}
        @keyframes explainModalIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes explainThinking2{0%,100%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.08) rotate(-4deg)}75%{transform:scale(1.08) rotate(4deg)}}
        @keyframes explainGloryGlow2{0%,100%{filter:drop-shadow(0 0 10px rgba(250,204,21,0.5))}50%{filter:drop-shadow(0 0 18px rgba(250,204,21,0.9))}}
      `}</style>
      <div style={{position:"relative",width:"100%",maxWidth:"380px",maxHeight:"85vh",overflowY:"auto",background:"linear-gradient(160deg,#1e1b4b,#0c0c14)",border:"1px solid rgba(129,140,248,0.35)",borderRadius:"20px",padding:"22px 18px",animation:"explainModalIn 0.25s ease-out both"}}>
        <button onClick={onClose} style={{position:"absolute",top:"10px",left:"10px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"50%",width:"30px",height:"30px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
          <X size={16}/>
        </button>
        {attemptBadge}

        <div style={{textAlign:"center",marginBottom:"16px",paddingTop:"6px"}}>
          <div style={{fontSize:"30px",marginBottom:"6px"}}>{isProblemSubject?"🧮":"🧠"}</div>
          <div style={{fontSize:"14px",fontWeight:"bold",color:"#c4b5fd"}}>{isProblemSubject?"اشرح حل المسألة":"اشرحلي بكلامك"}</div>
        </div>

        {stage==="intro"&&(
          <>
            <div style={{fontSize:"13px",color:"#d4d4d8",lineHeight:1.7,marginBottom:"16px",textAlign:"center"}}>
              {isProblemSubject
                ? <>حل مسألة على ورقتك، وأنت تشاور عليها اشرحلي خطوة خطوة كيف وصلت للحل — بموضوع <strong style={{color:"#fff"}}>{clipTitle}</strong></>
                : <>تخيل إني ما أعرف شيء عن <strong style={{color:"#fff"}}>{clipTitle}</strong> — اشرحلي الفكرة بكلامك الخاصة</>
              }
            </div>
            {errMsg&&<div style={{fontSize:"12px",color:"#f87171",marginBottom:"10px",textAlign:"center"}}>{errMsg}</div>}
            {renderInputArea(isProblemSubject?"اكتب خطوات حلك هنا...":"اكتب شرحك هنا...")}
            <button onClick={submit} disabled={!input.trim()} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(to right,#4f46e5,#818cf8)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:input.trim()?"pointer":"default",opacity:input.trim()?1:0.5,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"4px"}}>
              <Send size={14}/> {isProblemSubject?"أرسل حلي":"أرسل شرحي"}
            </button>
          </>
        )}

        {stage==="loading"&&(
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:"28px",marginBottom:"10px",animation:"explainThinking2 1.4s ease-in-out infinite",display:"inline-block"}}>{isProblemSubject?"🧮":"🧠"}</div>
            <div style={{fontSize:"13px",color:"#a5b4fc"}}>{isProblemSubject?"يفحص خطوات حلك...":"يفكر بشرحك..."}</div>
          </div>
        )}

        {stage==="followup"&&(
          <>
            {errMsg&&<div style={{fontSize:"12px",color:"#f87171",marginBottom:"10px",textAlign:"center"}}>{errMsg}</div>}
            <div style={{backgroundColor:"rgba(129,140,248,0.1)",border:"1px solid rgba(129,140,248,0.3)",borderRadius:"12px",padding:"12px 14px",marginBottom:"14px"}}>
              <div style={{fontSize:"11px",color:"#a5b4fc",fontWeight:"bold",marginBottom:"4px"}}>🤔 سؤال بسيط</div>
              <div style={{fontSize:"13px",color:"#e4e4e7",lineHeight:1.6}}>{lastResult?.followUpQuestion}</div>
            </div>
            {renderInputArea("اكتب ردّك...")}
            <button onClick={submit} disabled={!input.trim()} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(to right,#4f46e5,#818cf8)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:input.trim()?"pointer":"default",opacity:input.trim()?1:0.5,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"4px"}}>
              <Send size={14}/> أرسل
            </button>
          </>
        )}

        {stage==="complete"&&(
          <div style={{textAlign:"center",padding:"14px 0"}}>
            <div style={{fontSize:"40px",marginBottom:"10px",filter:"drop-shadow(0 0 12px rgba(250,204,21,0.6))",animation:"explainGloryGlow2 1.8s ease-in-out infinite"}}>{isProblemSubject?"🧮✨":"🧠✨"}</div>
            <div style={{fontSize:"15px",fontWeight:"bold",color:"#4ade80",marginBottom:"6px"}}>{isProblemSubject?"حل ممتاز! 🌟":"فهمك ممتاز! 🌟"}</div>
            <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"18px"}}>{isProblemSubject?"غطّيت كل خطوات الحل الأساسية لموضوع ":"غطّيت كل الأفكار الأساسية لموضوع "}{clipTitle}</div>
            <button onClick={onClose} style={{padding:"10px 24px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#059669,#4ade80)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>تمام</button>
          </div>
        )}

        {stage==="wrapup"&&(
          <div style={{padding:"6px 0"}}>
            <div style={{textAlign:"center",fontSize:"14px",fontWeight:"bold",color:"#e4e4e7",marginBottom:"14px"}}>👏 {isProblemSubject?"محاولة رائعة!":"شرح جميل!"}</div>
            {lastResult?.covered?.length>0&&(
              <div style={{marginBottom:"12px"}}>
                <div style={{fontSize:"11px",color:"#4ade80",fontWeight:"bold",marginBottom:"6px"}}>غطّيتها ممتاز:</div>
                {lastResult.covered.map((c,i)=><div key={i} style={{fontSize:"12px",color:"#d4d4d8",marginBottom:"3px"}}>✔ {c}</div>)}
              </div>
            )}
            {lastResult?.missing?.length>0&&(
              <div>
                <div style={{fontSize:"11px",color:"#facc15",fontWeight:"bold",marginBottom:"6px"}}>{isProblemSubject?"خطوات تستاهل مراجعة سريعة:":"نقاط تستاهل مراجعة سريعة:"}</div>
                {lastResult.missing.map((m,i)=><div key={i} style={{fontSize:"12px",color:"#d4d4d8",marginBottom:"3px"}}>💭 {m}</div>)}
              </div>
            )}
            <button onClick={onClose} style={{width:"100%",marginTop:"16px",padding:"10px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#4f46e5,#818cf8)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>تمام</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export { ExplainBackModal };
