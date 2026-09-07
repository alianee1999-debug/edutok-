// ─── components/Shared.jsx ──────────────────────────────
// مكونات صغيرة مشتركة تُستخدم بعدة أماكن بالتطبيق: أيقونة تحميل دوّارة،
// رأس نافذة منبثقة موحّد، صندوق خطأ، تلميح أول استخدام، عرض نص رياضي (KaTeX)،
// ورافع صور (يضغط الصورة اختيارياً ثم يرفعها لـ ImgBB).
import React, { useState } from "react";
import { X, Loader, Camera } from "lucide-react";
import katex from "katex";
import { uploadToImgBB } from "../ai";
import { showMsg } from "../toast";

const Spinner = ({color="#38bdf8",size=24}) => (
  <div style={{display:"inline-block",animation:"spin 1s linear infinite"}}>
    <Loader size={size} color={color}/>
    <style dangerouslySetInnerHTML={{__html:"@keyframes spin{to{transform:rotate(360deg)}}"}}/>
  </div>
);
const MHead = ({icon,title,color,onClose,extra}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>{icon}<span style={{fontWeight:"bold",fontSize:"16px",color:color||"#fff"}}>{title}</span></div>
    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
      {extra}
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#71717a"}}><X size={20}/></button>
    </div>
  </div>
);
const ErrBox = ({msg}) => msg?<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"14px",textAlign:"center"}}>! {msg}</div>:null;

// طويل، توجيه لحظي بالضبط وقت الحاجة الحقيقية
const FirstUseTip = ({tipKey, text}) => {
  const storageKey = "edutok_tip_seen_"+tipKey;
  const [seen,setSeen]=useState(()=>{
    try{ return localStorage.getItem(storageKey)==="1"; }catch{ return true; } // بحال فشل التخزين، ما نزعج الطالب بتكرار التلميح
  });
  if(seen) return null;
  const dismiss=()=>{
    try{ localStorage.setItem(storageKey,"1"); }catch{}
    setSeen(true);
  };
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:"8px",backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"10px",padding:"10px 12px",marginBottom:"14px",animation:"pageBadgeIn 0.3s ease-out both"}}>
      <span style={{fontSize:"15px",flexShrink:0}}>💡</span>
      <div style={{flex:1,fontSize:"12px",color:"#bae6fd",lineHeight:"1.6"}}>{text}</div>
      <button onClick={dismiss} style={{background:"none",border:"none",color:"#7dd3fc",cursor:"pointer",flexShrink:0,padding:0}}><X size={14}/></button>
    </div>
  );
};

// ─── MATH TEXT (يعرض النصوص العادية + رموز KaTeX الموجودة بين $...$) ───
// مثال: "احسب $\\frac{5}{2}$ ثم بسّط الناتج" → يطبع النص عادي، ويرسم الكسر رياضياً
// mathHighlight: تفعيل اختياري لإطار ملوّن حول كل رمز/معادلة (يُستخدم بالمساعد الذكي لجعل الرموز أوضح وأجمل)
// يدعم: $...$  و  \(...\)  و  \[...\]  بالإضافة لـ **bold** (Markdown بسيط) —
// بعض المزودين (Cerebras/DeepSeek) لا يلتزمون دايماً بصيغة $...$ المطلوبة بالبرومبت
// ويرجعون بصيغتهم الافتراضية، فنجعل الواجهة نفسها تتعرف على كل الصيغ الشائعة بدل
// الاعتماد الكامل على انضباط النموذج.
const MathText = ({text,style,mathHighlight}) => {
  if(text===undefined||text===null||text==="") return null;
  let raw = String(text);
  // نوحّد كل صيغ LaTeX الشائعة إلى $...$ عشان نتعامل معها بمكان واحد فقط
  raw = raw
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => "$"+inner+"$") // \[ ... \] → $...$
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => "$"+inner+"$"); // \( ... \) → $...$

  // نقسم النص عند كل جزء محاط بـ $...$ (بدون شرطة مائلة قبل $) مع الاحتفاظ بالفواصل
  const mathParts = raw.split(/(\$[^$]+\$)/g);
  const hasMath = mathParts.some(p=>p.startsWith("$")&&p.endsWith("$")&&p.length>1);
  const hasBold = /\*\*[^*]+\*\*/.test(raw);
  if(!hasMath && !hasBold) return <span style={style}>{raw}</span>;

  // يقسم نص عادي (بلا لاتكس) على **bold** ويطبعه
  const renderPlain = (str, keyPrefix) => {
    const boldParts = str.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp,j)=>{
      if(bp.startsWith("**")&&bp.endsWith("**")&&bp.length>3){
        return <strong key={keyPrefix+"-b-"+j}>{bp.slice(2,-2)}</strong>;
      }
      return bp?<span key={keyPrefix+"-t-"+j}>{bp}</span>:null;
    });
  };

  return (
    <span style={{...style,unicodeBidi:"plaintext"}}>
      {mathParts.map((part,i)=>{
        if(part.startsWith("$")&&part.endsWith("$")&&part.length>1){
          const latex=part.slice(1,-1);
          let html;
          try{ html=katex.renderToString(latex,{throwOnError:false,displayMode:false}); }
          catch{ return <span key={i}>{part}</span>; }
          return <span key={i} dir="ltr" style={mathHighlight?{
              unicodeBidi:"isolate",display:"inline-block",verticalAlign:"middle",
              background:"linear-gradient(135deg,rgba(56,189,248,0.14),rgba(168,85,247,0.14))",
              border:"1px solid rgba(56,189,248,0.25)",borderRadius:"8px",
              padding:"3px 8px",margin:"2px 3px",
            }:{unicodeBidi:"isolate",display:"inline-block",verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:html}}/>;
        }
        return part ? <React.Fragment key={i}>{renderPlain(part,i)}</React.Fragment> : null;
      })}
    </span>
  );
};

// ─── ضغط صورة بالمتصفح قبل الرفع (Canvas) ────────────────
const compressImage = (file, maxWidth = 1280, quality = 0.75) => new Promise((resolve, reject) => {
  const img = new Image();
  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; };
  reader.onerror = reject;
  img.onload = () => {
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("فشل ضغط الصورة")),
      "image/jpeg",
      quality
    );
  };
  img.onerror = reject;
  reader.readAsDataURL(file);
});

const ImageUploader = ({onUpload, onBase64, color="#34d399", label="اضغط لرفع صورة", compress=false}) => {
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  const handleFile=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    try{
      // نضغط الصورة فقط لو الاستخدام طلب ذلك صراحة (compress=true) — باقي
      // استخدامات هذا المكوّن (إيصالات، صور OCR) تبقى بدون أي تغيير
      const toUpload = compress ? await compressImage(file).catch(()=>file) : file;
      const result=await uploadToImgBB(toUpload);
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

export { Spinner, MHead, ErrBox, FirstUseTip, MathText, compressImage, ImageUploader };
