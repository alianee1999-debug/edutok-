// ─── modals/SolveModal.jsx ───────────────────────────────
// حل الأسئلة الذكي (نصي أو بالصورة عبر OCR) — يستخدم callAI مباشرة.
import React, { useState } from "react";
import { Camera, Bot } from "lucide-react";
import { C } from "../styles";
import { callAI } from "../ai";
import { Spinner, MHead, MathText } from "../components/Shared";

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

  const KATEX_RULE = " قاعدة إلزامية بصيغة الكتابة: أي رمز أو معادلة رياضية يجب إحاطتها بعلامتي $ من الطرفين وكتابتها بصيغة LaTeX (مثال: $x^2$ للأس، $\\frac{1}{2}$ للكسر، $\\sqrt{x}$ للجذر). أي معادلة أو رمز كيميائي يجب كتابته داخل $\\ce{...}$ (مثال: $\\ce{H2O}$). لا تكتب أي رمز رياضي أو كيميائي كنص عادي خارج هذه العلامات. ممنوع استخدام صيغة \\[ ... \\] أو \\( ... \\) نهائياً تحت أي ظرف — استخدم $...$ فقط دائماً.";

  const solve=async()=>{
    setLoading(true); setAns("");
    try{
      let r;
      if(tab==="text"){
        r=await callAI("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". السؤال: "+q+". حله خطوة بخطوة بالعربية."+KATEX_RULE);
      } else {
        if(!imgB64){setAns("يرجى رفع صورة أولاً.");setLoading(false);return;}
        r=await callAI("أنت مساعد تعليمي. الطالب يدرس "+video.subject+". انظر للصورة وحل هذا السؤال خطوة بخطوة بالعربية."+KATEX_RULE,imgB64);
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
    {ans&&<div style={{backgroundColor:"#09090b",borderRadius:"12px",padding:"14px",fontSize:"14px",color:"#e4e4e7",lineHeight:"1.8",marginBottom:"14px",border:"1px solid rgba(52,211,153,0.15)",whiteSpace:"pre-wrap",maxHeight:"240px",overflowY:"auto"}}><div style={{color:"#34d399",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}> الحل:</div><MathText text={ans}/></div>}
    {loading&&<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#34d399"/><div style={{marginTop:"8px",fontSize:"13px",color:"#34d399"}}>جارٍ الحل...</div></div>}
    {!ans&&!loading&&<button onClick={solve} disabled={!canSolve} style={{...C.purpleBtn,background:canSolve?"linear-gradient(to right,#059669,#34d399)":"#27272a",opacity:canSolve?1:0.5}}><Bot size={16}/> حل السؤال بالذكاء الاصطناعي</button>}
    {ans&&<div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setAns("");setQ("");setImgB64(null);setImgPreview(null);}} style={C.cancelBtn}>سؤال جديد</button><button onClick={onClose} style={C.saveBtn}>إغلاق </button></div>}
  </div></div>;
}

export { SolveModal };
