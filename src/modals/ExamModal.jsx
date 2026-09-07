// ─── modals/ExamModal.jsx ────────────────────────────────
// امتحان فصل — اختيار مادة/مرحلة/صف/فصل (أو فتح مباشر على فصل محدد)، تحميل
// بنك الأسئلة، إجراء الامتحان سؤالاً بسؤال، وعرض النتيجة النهائية.
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ClipboardList, BookOpen } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { STAGES, GRADES } from "../constants";
import { hasAccess, topicKey } from "../helpers";
import { showMsg } from "../toast";
import { playCorrectSound, playWrongSound, playFanfareSound } from "../audioUtils";
import { Spinner, MHead, MathText } from "../components/Shared";

const EXAM_PASS_THRESHOLD = 60; // نسبة النجاح المطلوبة (%)
const EXAM_MAX_QUESTIONS = 30;  // أقصى عدد أسئلة تُعرض بالمحاولة الواحدة (تُسحب عشوائياً من بنك الأسئلة)

const shuffleArray = (arr) => {
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};

function ExamModal({onClose, initial, currentStudent, mySubscriptions, globalPrices, clips, examScores, onResult}) {
  // step: "picker" (اختيار مادة/مرحلة/فصل) → "loading" → "empty" (لا أسئلة) → "quiz" → "result"
  const [step,setStep]=useState(initial?"loading":"picker");
  const [pickStage,setPickStage]=useState(initial?.stage||"");
  const [pickGrade,setPickGrade]=useState("");
  const [pickSubject,setPickSubject]=useState(initial?.subject||"");
  const [pickTopic,setPickTopic]=useState(initial?.topic||"");
  const [pickerSub,setPickerSub]=useState(initial?"topic":"stage"); // مرحلة فرعية بداخل خطوة "picker": stage → grade → subject → topic

  const [questions,setQuestions]=useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [answers,setAnswers]=useState([]); // فهرس الخيار المختار لكل سؤال، بنفس ترتيب questions
  const [result,setResult]=useState(null); // {score, correct, total, passed}

  const availableStages = STAGES;
  // نطابق الصف بنفس المرونة المعتمدة بباقي التطبيق: نقبل المقطع لو صفه مطابق أو لو ما حُدد له صف أصلاً
  const availableSubjects = React.useMemo(()=>{
    if(!pickStage) return [];
    const subjs = new Set();
    clips.forEach(c=>{ if(c.stage===pickStage && (!pickGrade||c.grade===pickGrade||!c.grade) && c.topic) subjs.add(c.subject); });
    return [...subjs].filter(s=>hasAccess(mySubscriptions,globalPrices,s,pickStage,pickGrade)).sort();
  },[clips,pickStage,pickGrade,mySubscriptions,globalPrices]);
  const availableTopics = React.useMemo(()=>{
    if(!pickStage||!pickSubject) return [];
    const topicMinNum={};
    clips.forEach(c=>{
      if(c.stage===pickStage&&c.subject===pickSubject&&(!pickGrade||c.grade===pickGrade||!c.grade)&&c.topic){
        const n=Number(c.num||0);
        if(!(c.topic in topicMinNum)||n<topicMinNum[c.topic]) topicMinNum[c.topic]=n;
      }
    });
    return Object.keys(topicMinNum).sort((a,b)=>topicMinNum[a]-topicMinNum[b]);
  },[clips,pickStage,pickSubject,pickGrade]);

  const loadQuestions = async(subject,stage,topic)=>{
    setStep("loading");
    try{
      const snap = await getDocs(query(collection(db,"examQuestions"),
        where("subject","==",subject), where("stage","==",stage), where("topic","==",topic), where("published","==",true)));
      const bank = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(bank.length===0){ setStep("empty"); return; }
      const picked = shuffleArray(bank).slice(0,EXAM_MAX_QUESTIONS);
      setQuestions(picked);
      setAnswers(new Array(picked.length).fill(null));
      setQIdx(0);
      setResult(null);
      setStep("quiz");
    }catch(e){
      showMsg("تعذّر تحميل أسئلة الامتحان: "+e.message);
      setStep("empty");
    }
  };

  useEffect(()=>{
    if(initial?.subject && initial?.stage && initial?.topic) loadQuestions(initial.subject,initial.stage,initial.topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const selectAnswer = (optIdx)=>{
    const next=[...answers]; next[qIdx]=optIdx; setAnswers(next);
    if(optIdx===questions[qIdx]?.correctIndex) playCorrectSound(); else playWrongSound();
  };
  const goNext = ()=>{
    if(qIdx<questions.length-1){ setQIdx(qIdx+1); return; }
    finishExam();
  };
  const goPrev = ()=>{ if(qIdx>0) setQIdx(qIdx-1); };
  const finishExam = ()=>{
    let correct=0;
    questions.forEach((q,i)=>{ if(answers[i]===q.correctIndex) correct++; });
    const total=questions.length;
    const score=Math.round((correct/total)*100);
    const passed=score>=EXAM_PASS_THRESHOLD;
    if(passed) playFanfareSound(); else playWrongSound();
    setResult({score,correct,total,passed});
    setStep("result");
    onResult && onResult(pickSubject||initial?.subject, pickStage||initial?.stage, pickTopic||initial?.topic, score, passed);
  };
  const retry = ()=>{
    const subject=pickSubject||initial?.subject, stage=pickStage||initial?.stage, topic=pickTopic||initial?.topic;
    loadQuestions(subject,stage,topic);
  };

  const q = questions[qIdx];
  const stageEmoji={"الابتدائية":"🏫","المتوسطة":"📚","الإعدادية":"🎓"};

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.3)"}}>
    <MHead icon={<ClipboardList size={20} color="#c4b5fd"/>} title="امتحان الفصل" color="#c4b5fd" onClose={onClose}/>

    {/* ─── خطوة الاختيار: المرحلة ─── */}
    {step==="picker"&&pickerSub==="stage"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المرحلة الدراسية</div>
      {availableStages.map(s=>(
        <div key={s} onClick={()=>{setPickStage(s);setPickGrade("");setPickerSub("grade");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
          <span style={{fontSize:"28px"}}>{stageEmoji[s]||"📖"}</span>
          <div style={{flex:1,fontWeight:"bold",fontSize:"15px"}}>{s}</div>
          <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* ─── خطوة الاختيار: الصف ─── */}
    {step==="picker"&&pickerSub==="grade"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{pickStage}</span>
      </div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الصف الدراسي</div>
      {(GRADES[pickStage]||[]).map((g,i)=>(
        <div key={g} onClick={()=>{setPickGrade(g);setPickerSub("subject");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
          <div style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"17px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,fontWeight:"bold",fontSize:"15px"}}>الصف {g}</div>
          <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* ─── خطوة الاختيار: المادة ─── */}
    {step==="picker"&&pickerSub==="subject"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px",flexWrap:"wrap"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("grade")}>{pickStage}</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>الصف {pickGrade}</span>
      </div>
      {availableSubjects.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b",fontSize:"13px"}}>لا توجد مواد متاحة لك بهذه المرحلة/الصف</div>
        :availableSubjects.map(subj=>(
          <div key={subj} onClick={()=>{setPickSubject(subj);setPickerSub("topic");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
            <div style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><BookOpen size={18} color="#fff"/></div>
            <div style={{flex:1,fontWeight:"bold",fontSize:"14px"}}>{subj}</div>
            <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
          </div>
        ))
      }
    </div>}

    {/* ─── خطوة الاختيار: الفصل ─── */}
    {step==="picker"&&pickerSub==="topic"&&<div>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px",fontSize:"12px",flexWrap:"wrap"}}>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("stage")}>المراحل</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("grade")}>{pickStage}</span>
        <span style={{color:"#52525b"}}>←</span>
        <span style={{color:"#c4b5fd",cursor:"pointer"}} onClick={()=>setPickerSub("subject")}>الصف {pickGrade}</span>
        <span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{pickSubject}</span>
      </div>
      {availableTopics.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b",fontSize:"13px"}}>لا توجد فصول محددة لهذه المادة بعد</div>
        :availableTopics.map((topic,i)=>{
          const tKey=topicKey(pickSubject,pickStage,topic);
          const sc=examScores?.[tKey];
          return <div key={topic} onClick={()=>{setPickTopic(topic);loadQuestions(pickSubject,pickStage,topic);}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(168,85,247,0.2)"}}>
            <div style={{width:"40px",height:"40px",borderRadius:"12px",background:sc?.passed?"rgba(34,197,94,0.15)":"rgba(168,85,247,0.15)",border:`1px solid ${sc?.passed?"rgba(34,197,94,0.3)":"rgba(168,85,247,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"15px",fontWeight:"bold",color:sc?.passed?"#4ade80":"#c4b5fd"}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{topic}</div>
              <div style={{fontSize:"11px",color:sc?.passed?"#4ade80":"#71717a"}}>{sc?(sc.passed?"✅ ناجح — "+sc.score+"%":"❌ آخر نتيجة "+sc.score+"%"):"لم يُمتحن بعد"}</div>
            </div>
            <span style={{color:"#c4b5fd",fontSize:"18px"}}>←</span>
          </div>;
        })
      }
    </div>}

    {/* ─── تحميل الأسئلة ─── */}
    {step==="loading"&&<div style={{textAlign:"center",padding:"40px 0"}}>
      <Spinner color="#c4b5fd" size={32}/>
      <div style={{marginTop:"10px",fontSize:"13px",color:"#a1a1aa"}}>جارٍ تحضير أسئلة الامتحان...</div>
    </div>}

    {/* ─── لا توجد أسئلة ─── */}
    {step==="empty"&&<div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontSize:"40px",marginBottom:"10px"}}>📭</div>
      <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"6px"}}>لا توجد أسئلة لهذا الفصل بعد</div>
      <div style={{color:"#71717a",fontSize:"12px",marginBottom:"16px"}}>لم يقم المدير بإضافة بنك أسئلة لهذا الفصل حتى الآن</div>
      <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
    </div>}

    {/* ─── الامتحان (سؤال واحد بالشاشة) ─── */}
    {step==="quiz"&&q&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <span style={{fontSize:"12px",color:"#a1a1aa"}}>سؤال {qIdx+1} من {questions.length}</span>
        <span style={{fontSize:"12px",color:"#c4b5fd",fontWeight:"bold"}}>{Math.round(((qIdx+1)/questions.length)*100)}%</span>
      </div>
      <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden",marginBottom:"18px"}}>
        <div style={{height:"100%",width:((qIdx+1)/questions.length*100)+"%",background:"linear-gradient(to left,#7c3aed,#c4b5fd)",borderRadius:"3px",transition:"width 0.3s ease"}}/>
      </div>

      <div style={{...C.card,border:"1px solid rgba(168,85,247,0.2)",marginBottom:"14px"}}>
        <MathText text={q.question} style={{fontSize:"15px",fontWeight:"bold",color:"#fff",lineHeight:"1.6"}}/>
      </div>

      {(q.options||[]).map((opt,i)=>{
        const isSelected = answers[qIdx]===i;
        const letter = String.fromCharCode(65+i); // A, B, C, D
        return <div key={i} onClick={()=>selectAnswer(i)} style={{
          ...C.card, cursor:"pointer", marginBottom:"8px", display:"flex", alignItems:"center", gap:"10px",
          border: isSelected?"1px solid #a855f7":"1px solid rgba(255,255,255,0.06)",
          background: isSelected?"rgba(168,85,247,0.15)":"#18181b",
        }}>
          <div style={{width:"26px",height:"26px",borderRadius:"50%",flexShrink:0,border:`2px solid ${isSelected?"#a855f7":"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"bold",color:isSelected?"#a855f7":"rgba(255,255,255,0.5)"}}>
            {letter}
          </div>
          <MathText text={opt} style={{fontSize:"13px",color:"#fff"}}/>
        </div>;
      })}

      <div style={{display:"flex",gap:"8px",marginTop:"16px"}}>
        {qIdx>0&&<button onClick={goPrev} style={{...C.cancelBtn,flex:1}}>السابق</button>}
        <button onClick={goNext} disabled={answers[qIdx]===null} style={{...C.saveBtn,flex:2,opacity:answers[qIdx]===null?0.5:1,background:qIdx===questions.length-1?"linear-gradient(to right,#7c3aed,#a855f7)":C.saveBtn.background}}>
          {qIdx===questions.length-1?"إنهاء الامتحان":"التالي"}
        </button>
      </div>
    </div>}

    {/* ─── النتيجة ─── */}
    {step==="result"&&result&&<div style={{textAlign:"center"}}>
      <div style={{fontSize:"52px",marginBottom:"8px"}}>{result.passed?(result.score>=80?"🏅":"✅"):"❌"}</div>
      <div style={{fontSize:"32px",fontWeight:"900",color:result.passed?"#4ade80":"#f87171",marginBottom:"4px"}}>{result.score}%</div>
      <div style={{fontSize:"13px",color:"#a1a1aa",marginBottom:"16px"}}>أجبت بشكل صحيح على {result.correct} من أصل {result.total} سؤال</div>
      {result.passed
        ?<div style={{...C.infoBanner,backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",color:"#4ade80",justifyContent:"center"}}>🎉 مبروك! اجتزت امتحان الفصل، الفصل التالي متاح الآن</div>
        :<div style={{...C.infoBanner,backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",justifyContent:"center"}}>لم تحقق نسبة النجاح المطلوبة ({EXAM_PASS_THRESHOLD}%) — راجع الفصل وحاول مرة أخرى</div>
      }
      {!result.passed&&<button onClick={retry} style={{...C.primaryBtn,background:"linear-gradient(to right,#7c3aed,#a855f7)"}}>🔄 إعادة المحاولة</button>}
      <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
    </div>}
  </div></div>;
}

export { ExamModal, EXAM_PASS_THRESHOLD, EXAM_MAX_QUESTIONS, shuffleArray };
