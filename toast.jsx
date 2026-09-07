// ─── toast.js ───────────────────────────────────────────
// نظام رسائل منبثقة (Toast) بسيط بنمط singleton — أي مكان بالتطبيق يقدر يستدعي
// showMsg("...") لعرض رسالة عائمة لثوانٍ معدودة، بدون الحاجة يمرر state يدوياً
// عبر كل شجرة المكونات. مكوّن <Toast/> يُوضع مرة وحدة بأعلى شجرة التطبيق.
import { useState } from "react";

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

export { showMsg, Toast };
