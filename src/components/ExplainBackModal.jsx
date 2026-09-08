// ─── components/ExplainBackModal.jsx ────────────────────
// ميزة "اشرحلي بكلامك" (أسلوب فاينمان): بدل ما الذكاء الاصطناعي يشرح للطالب،
// الطالب يشرح فهمه بكلامه، والذكاء الاصطناعي يحلل الفجوات ويرد بسؤال توجيهي
// واحد يشجعه يكتشفها بنفسه — بدون تصحيح مباشر وبدون تصنيف صح/خطأ ثنائي.
//
// تصميم التغذية الراجعة (مهم، مو تفصيل عرضي):
//  - فهم كامل → احتفال هادئ (توهج ذهبي)، مختلف بصرياً عن كونفيتي سؤال الشريحة
//  - فهم جزئي (الحالة الأشيع) → لا احتفال ولا رمز خطأ، فقط سؤال فضولي واحد
//  - نهاية الحلقة (٣ محاولات كحد أقصى) → ملخص إيجابي: إبراز المُغطّى أولاً،
//    والباقي كـ"نقاط للمراجعة" لا كفشل
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Send, Mic, Square } from "lucide-react";
import { callAI } from "../ai";

const MAX_ATTEMPTS = 3;

// ─── التعرّف على الصوت المدمج بالمتصفح (Web Speech API) ─────────────
// نحوّل كلام الطالب لنص مباشرة بالجهاز نفسه، بدون رفع أي ملف صوتي أو تكلفة
// إضافية — يعمل بأغلب متصفحات أندرويد الحديثة. لو غير مدعوم، الزر ما يظهر
// والطالب يكتب عادي بدون أي كسر بالتجربة.
const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

const buildExplainPrompt = (clipTitle, slidesText, transcript, latestReply) => {
  const transcriptText = transcript.map(t =>
    t.role==="ai" ? `أنت سألت: "${t.text}"` : `الطالب أجاب: "${t.text}"`
  ).join("\n");
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

  // intro → loading → followup (يتكرر) → complete | wrapup
  const [stage, setStage] = useState("intro");
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState([]); // [{role:'ai'|'student', text}]
  const [attempts, setAttempts] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  // ─── التسجيل الصوتي (اختياري) ───────────────────────────
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

  const MicRow = () => !speechSupported ? null : (
    <>
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
          width:"100%",padding:"10px",borderRadius:"10px",
          border: listening ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(129,140,248,0.35)",
          backgroundColor: listening ? "rgba(239,68,68,0.12)" : "rgba(129,140,248,0.1)",
          color: listening ? "#f87171" : "#a5b4fc",
          fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginBottom:"10px",
          animation: listening ? "explainIconGlow 1.4s ease-in-out infinite" : "none",
        }}
      >
        {listening ? <><Square size={13}/> إيقاف التسجيل — تحدّث الآن</> : <><Mic size={13}/> أو سجّل صوتك</>}
      </button>
      {micErr&&<div style={{fontSize:"11px",color:"#f87171",marginBottom:"8px",textAlign:"center"}}>{micErr}</div>}
    </>
  );

  const submit = async () => {
    if(!input.trim()) return;
    if(listening) stopListening();
    const myReply = input.trim();
    setInput("");
    setErrMsg("");
    setStage("loading");
    try{
      const prompt = buildExplainPrompt(clipTitle, slidesText, transcript, myReply);
      const raw = await callAI(prompt);
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

  return createPortal(
    <div
      onClick={e=>e.stopPropagation()}
      onTouchStart={e=>e.stopPropagation()}
      onTouchEnd={e=>e.stopPropagation()}
      style={{position:"fixed",inset:0,zIndex:9999,backgroundColor:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}
    >
      <div style={{position:"relative",width:"100%",maxWidth:"380px",maxHeight:"85vh",overflowY:"auto",background:"linear-gradient(160deg,#1e1b4b,#0c0c14)",border:"1px solid rgba(129,140,248,0.35)",borderRadius:"20px",padding:"22px 18px",animation:"quizModalIn 0.25s ease-out both"}}>
        <button onClick={onClose} style={{position:"absolute",top:"10px",left:"10px",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"50%",width:"30px",height:"30px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",zIndex:1}}>
          <X size={16}/>
        </button>

        <div style={{textAlign:"center",marginBottom:"14px"}}>
          <div style={{fontSize:"30px",marginBottom:"6px"}}>🧠</div>
          <div style={{fontSize:"14px",fontWeight:"bold",color:"#c4b5fd"}}>اشرحلي بكلامك</div>
        </div>

        {stage==="intro"&&(
          <>
            <div style={{fontSize:"13px",color:"#d4d4d8",lineHeight:1.7,marginBottom:"14px",textAlign:"center"}}>
              تخيل إني ما أعرف شيء عن <strong style={{color:"#fff"}}>{clipTitle}</strong> — اشرحلي الفكرة بكلامك الخاصة
            </div>
            {errMsg&&<div style={{fontSize:"12px",color:"#f87171",marginBottom:"10px",textAlign:"center"}}>{errMsg}</div>}
            <MicRow/>
            <textarea rows={5} value={input} onChange={e=>setInput(e.target.value)} placeholder="اكتب شرحك هنا..." style={{width:"100%",boxSizing:"border-box",padding:"12px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",color:"#fff",fontSize:"13px",resize:"none",marginBottom:"12px",fontFamily:"inherit"}}/>
            <button onClick={submit} disabled={!input.trim()} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(to right,#4f46e5,#818cf8)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:input.trim()?"pointer":"default",opacity:input.trim()?1:0.5,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
              <Send size={14}/> أرسل شرحي
            </button>
          </>
        )}

        {stage==="loading"&&(
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:"28px",marginBottom:"10px",animation:"explainThinking 1.4s ease-in-out infinite",display:"inline-block"}}>🧠</div>
            <div style={{fontSize:"13px",color:"#a5b4fc"}}>يفكر بشرحك...</div>
          </div>
        )}

        {stage==="followup"&&(
          <>
            {errMsg&&<div style={{fontSize:"12px",color:"#f87171",marginBottom:"10px",textAlign:"center"}}>{errMsg}</div>}
            <div style={{backgroundColor:"rgba(129,140,248,0.1)",border:"1px solid rgba(129,140,248,0.3)",borderRadius:"12px",padding:"12px 14px",marginBottom:"14px"}}>
              <div style={{fontSize:"11px",color:"#a5b4fc",fontWeight:"bold",marginBottom:"4px"}}>🤔 سؤال بسيط</div>
              <div style={{fontSize:"13px",color:"#e4e4e7",lineHeight:1.6}}>{lastResult?.followUpQuestion}</div>
            </div>
            <MicRow/>
            <textarea rows={4} value={input} onChange={e=>setInput(e.target.value)} placeholder="اكتب ردّك..." style={{width:"100%",boxSizing:"border-box",padding:"12px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",color:"#fff",fontSize:"13px",resize:"none",marginBottom:"12px",fontFamily:"inherit"}}/>
            <button onClick={submit} disabled={!input.trim()} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(to right,#4f46e5,#818cf8)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:input.trim()?"pointer":"default",opacity:input.trim()?1:0.5,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
              <Send size={14}/> أرسل
            </button>
          </>
        )}

        {stage==="complete"&&(
          <div style={{textAlign:"center",padding:"14px 0"}}>
            <div style={{fontSize:"40px",marginBottom:"10px",filter:"drop-shadow(0 0 12px rgba(250,204,21,0.6))",animation:"explainGloryGlow 1.8s ease-in-out infinite"}}>🧠✨</div>
            <div style={{fontSize:"15px",fontWeight:"bold",color:"#4ade80",marginBottom:"6px"}}>فهمك ممتاز! 🌟</div>
            <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"18px"}}>غطّيت كل الأفكار الأساسية لموضوع {clipTitle}</div>
            <button onClick={onClose} style={{padding:"10px 24px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#059669,#4ade80)",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>تمام</button>
          </div>
        )}

        {stage==="wrapup"&&(
          <div style={{padding:"6px 0"}}>
            <div style={{textAlign:"center",fontSize:"14px",fontWeight:"bold",color:"#e4e4e7",marginBottom:"14px"}}>👏 شرح جميل!</div>
            {lastResult?.covered?.length>0&&(
              <div style={{marginBottom:"12px"}}>
                <div style={{fontSize:"11px",color:"#4ade80",fontWeight:"bold",marginBottom:"6px"}}>غطّيتها ممتاز:</div>
                {lastResult.covered.map((c,i)=><div key={i} style={{fontSize:"12px",color:"#d4d4d8",marginBottom:"3px"}}>✔ {c}</div>)}
              </div>
            )}
            {lastResult?.missing?.length>0&&(
              <div>
                <div style={{fontSize:"11px",color:"#facc15",fontWeight:"bold",marginBottom:"6px"}}>نقاط تستاهل مراجعة سريعة:</div>
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
