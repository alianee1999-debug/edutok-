// ─── modals/OnboardingCertModals.jsx ─────────────────────
// جولة الشرح التعريفي (4 خطوات، تظهر أول مرة)، وشهادة إتمام الفصل (قابلة
// للمشاركة، وتفتح امتحان الفصل مباشرة لو لم يُجتَز بعد).
import React, { useState } from "react";
import { Share2, ClipboardList } from "lucide-react";
import { C } from "../styles";
import { ONBOARDING_STEPS } from "../constants";

function OnboardingModal({onClose}) {
  const [step,setStep]=useState(0);
  const isLast = step===ONBOARDING_STEPS.length-1;
  const s = ONBOARDING_STEPS[step];

  const finish=()=>{
    try{ localStorage.setItem("edutok_onboarding_seen","1"); }catch{}
    onClose();
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.25)",textAlign:"center"}}>
    <button onClick={finish} style={{position:"absolute",top:"14px",left:"14px",background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"12px"}}>تخطي</button>

    <div style={{fontSize:"64px",margin:"18px 0 10px"}}>{s.emoji}</div>
    <div style={{fontSize:"18px",fontWeight:"bold",color:"#fff",marginBottom:"10px"}}>{s.title}</div>
    <div style={{fontSize:"14px",color:"#a1a1aa",lineHeight:"1.8",marginBottom:"22px",padding:"0 6px"}}>{s.desc}</div>

    {/* نقاط التقدّم */}
    <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"22px"}}>
      {ONBOARDING_STEPS.map((_,i)=>(
        <div key={i} style={{width:i===step?"20px":"6px",height:"6px",borderRadius:"3px",backgroundColor:i===step?"#38bdf8":"rgba(255,255,255,0.15)",transition:"all 0.25s ease"}}/>
      ))}
    </div>

    <div style={{display:"flex",gap:"8px"}}>
      {step>0&&(
        <button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"12px",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.15)",backgroundColor:"transparent",color:"#d4d4d8",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>السابق</button>
      )}
      <button onClick={()=>isLast?finish():setStep(s=>s+1)} style={{flex:2,padding:"12px",borderRadius:"12px",border:"none",background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#000",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>
        {isLast?"ابدأ الآن 🚀":"التالي"}
      </button>
    </div>
  </div></div>;
}

// ─── CERTIFICATE MODAL (شهادة إتمام فصل — قابلة للمشاركة) ─
// cert: {subject,stage,topic,examScore}  حيث examScore = {score,passed,attempts} أو null (لم يُمتحن بعد)
function CertificateModal({onClose,student,cert,onStartExam}) {
  const [copied,setCopied]=useState(false);
  const dateStr = new Date().toLocaleDateString("ar",{year:"numeric",month:"long",day:"numeric"});
  const passed = cert.examScore?.passed;
  const attempted = !!cert.examScore;
  const shareText = "🎓 أنهيت فصل \""+cert.topic+"\" في مادة "+cert.subject+" ("+cert.stage+") على تطبيق EduTok!"
    +(passed?"\nبنسبة نجاح "+cert.examScore.score+"% بامتحان الفصل! 💯":"")
    +"\nتاريخ الإنجاز: "+dateStr;

  const share=async()=>{
    try{
      if(navigator.share){ await navigator.share({title:"شهادة إتمام",text:shareText}); return; }
    }catch{}
    try{ await navigator.clipboard?.writeText(shareText); setCopied(true); setTimeout(()=>setCopied(false),2000); }catch{}
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(251,191,36,0.35)",textAlign:"center"}}>
    <div style={{background:"linear-gradient(135deg,#78350f,#b45309)",borderRadius:"18px",padding:"28px 20px",marginBottom:"16px",border:"1px solid rgba(251,191,36,0.4)"}}>
      <div style={{fontSize:"46px",marginBottom:"8px"}}>🎓</div>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.7)",marginBottom:"4px"}}>شهادة إتمام فصل</div>
      <div style={{fontSize:"19px",fontWeight:"900",color:"#fde68a",marginBottom:"10px"}}>{cert.topic}</div>
      <div style={{height:"1px",background:"rgba(255,255,255,0.2)",margin:"10px 0"}}/>
      <div style={{fontSize:"14px",fontWeight:"bold",color:"#fff",marginBottom:"2px"}}>{student?.name}</div>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.6)"}}>{cert.subject} • {cert.stage}</div>
      <div style={{fontSize:"11px",color:"rgba(255,255,255,0.45)",marginTop:"8px"}}>{dateStr}</div>
    </div>

    {/* حالة امتحان الفصل — النجاح شرط لفتح الفصل التالي */}
    {passed
      ?<div style={{backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{fontSize:"22px",marginBottom:"2px"}}>{cert.examScore.score>=80?"🏅":"✅"}</div>
        <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"14px"}}>اجتزت امتحان الفصل بنسبة {cert.examScore.score}%</div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"2px"}}>الفصل التالي متاح الآن</div>
      </div>
      :<div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{fontSize:"22px",marginBottom:"2px"}}>{attempted?"❌":"🔒"}</div>
        <div style={{color:"#f87171",fontWeight:"bold",fontSize:"14px"}}>
          {attempted?"لم تجتز بعد — آخر نتيجة "+cert.examScore.score+"%":"درجة امتحان الفصل: لم تُحدد بعد"}
        </div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"2px"}}>يجب تحقيق 60% على الأقل لفتح الفصل التالي</div>
      </div>
    }

    {!passed&&onStartExam&&(
      <button onClick={()=>onStartExam(cert.subject,cert.stage,cert.topic)} style={{...C.primaryBtn,background:"linear-gradient(to right,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <ClipboardList size={16}/> {attempted?"أعد المحاولة":"ابدأ امتحان الفصل الآن"}
      </button>
    )}
    <div style={{fontSize:"13px",color:"#a1a1aa",marginBottom:"16px"}}>🎉 مبروك! أنهيت مشاهدة هذا الفصل بالكامل</div>
    <button onClick={share} style={{...C.primaryBtn,background:"linear-gradient(to right,#d97706,#fbbf24)"}}>
      {copied?"✅ تم نسخ النص":<><Share2 size={16}/> شارك إنجازك</>}
    </button>
    <button onClick={onClose} style={C.secondaryBtn}>إغلاق</button>
  </div></div>;
}

export { OnboardingModal, CertificateModal };
