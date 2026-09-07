// ─── modals/AuthModals.jsx ───────────────────────────────
// نوافذ المصادقة: دخول المدير (Firebase Auth حقيقي)، ونسيت كلمة المرور
// للطلاب (يرسل طلب تُراجعه الإدارة يدوياً بتبويب "الطلاب").
import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { GraduationCap, Key } from "lucide-react";
import { auth } from "../firebase";
import { C } from "../styles";
import { Spinner, ErrBox } from "../components/Shared";

function AdminLoginModal({onClose,onSuccess}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  const login=async()=>{
    if(!email.trim()||!pass.trim()) return setErr("أدخل البريد الإلكتروني وكلمة المرور");
    setLoading(true); setErr("");
    try{
      await signInWithEmailAndPassword(auth,email.trim(),pass);
      onSuccess();
    }catch(e){
      if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found") setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      else if(e.code==="auth/too-many-requests") setErr("محاولات كثيرة فاشلة، حاول بعد قليل");
      else setErr("فشل تسجيل الدخول: "+e.message);
    }
    setLoading(false);
  };
  const sendReset=async()=>{
    if(!email.trim()) return setErr("أدخل البريد الإلكتروني أولاً لإرسال رابط الاستعادة");
    try{ await sendPasswordResetEmail(auth,email.trim()); setResetSent(true); setErr(""); }
    catch(e){ setErr("فشل إرسال رابط الاستعادة: "+e.message); }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(234,179,8,0.2)"}}>
    <div style={{textAlign:"center",marginBottom:"20px"}}>
      <GraduationCap size={40} color="#eab308" style={{margin:"0 auto 8px"}}/>
      <h3 style={{color:"#eab308",fontWeight:"bold",fontSize:"18px",margin:"0 0 4px"}}>دخول المدير</h3>
    </div>
    <label style={C.label}> البريد الإلكتروني</label>
    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");setResetSent(false);}} placeholder="admin@example.com" style={C.input}/>
    <label style={C.label}> كلمة المرور</label>
    <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} placeholder="كلمة المرور" style={C.input} onKeyDown={e=>e.key==="Enter"&&login()}/>
    <ErrBox msg={err}/>
    {resetSent&&<div style={{backgroundColor:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#4ade80",marginBottom:"14px",textAlign:"center"}}>تم إرسال رابط استعادة كلمة المرور إلى بريدك</div>}
    <button onClick={login} disabled={loading} style={{...C.gradBtn,background:"linear-gradient(to right,#eab308,#f97316)",opacity:loading?0.7:1}}>
      {loading?<><Spinner size={16}/> جارٍ تسجيل الدخول...</>:<>دخول لوحة الإدارة ←</>}
    </button>
    <button onClick={sendReset} style={{width:"100%",padding:"10px",backgroundColor:"transparent",color:"#38bdf8",border:"none",fontSize:"13px",cursor:"pointer",marginBottom:"8px"}}>نسيت كلمة المرور؟</button>
    <button onClick={onClose} style={{width:"100%",padding:"12px",backgroundColor:"transparent",color:"#71717a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",fontSize:"14px",cursor:"pointer"}}>إلغاء</button>
  </div></div>;
}

// ─── FORGOT PASSWORD MODAL (طلاب) ─────────────────────────
// الطالب ما عنده بريد إلكتروني ولا رقم يستقبل SMS فعلياً بهذا النظام، فبدل
// استعادة ذاتية فورية (زي المدير عبر البريد)، الطالب يرسل طلباً يظهر عند
// الإدارة بتبويب "الطلاب"، والإدارة تستخدم أداة "إعادة تعيين كلمة المرور"
// الموجودة أصلاً هناك وترسل الكلمة الجديدة للطالب يدوياً (واتساب/اتصال).
function ForgotPasswordModal({onClose}) {
  const [phone,setPhone]=useState("");
  const [sending,setSending]=useState(false);
  const [err,setErr]=useState("");
  const [sent,setSent]=useState(false);
  const [alreadyPending,setAlreadyPending]=useState(false);

  const submit=async()=>{
    if(!phone.trim()) return setErr("أدخل رقم الموبايل المسجّل به حسابك");
    setErr(""); setSending(true);
    try{
      const res=await fetch("/api/request-password-reset",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ phone: phone.trim() })
      });
      let d;
      try{ d = await res.json(); }
      catch{ setErr("تعذّر الاتصال بالخادم (رمز "+res.status+")"); setSending(false); return; }
      if(!d.ok){ setErr(d.error||"فشل إرسال طلب الاستعادة"); setSending(false); return; }
      setAlreadyPending(!!d.alreadyPending);
      setSent(true);
    }catch(e){
      setErr("حدث خطأ: "+e.message);
    }
    setSending(false);
  };

  if(sent) return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"48px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"16px",marginBottom:"8px"}}>
      {alreadyPending?"طلبك مسجّل بالفعل":"تم إرسال طلبك"}
    </div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>
      {alreadyPending
        ?"عندك طلب استعادة كلمة مرور قيد المراجعة أصلاً — الإدارة هتتواصل معك قريباً بكلمة مرور جديدة."
        :"الإدارة راح تراجع طلبك وترسلك كلمة مرور جديدة على نفس رقمك قريباً."}
    </div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,maxWidth:"340px",border:"1px solid rgba(56,189,248,0.25)"}}>
    <div style={{textAlign:"center",marginBottom:"18px"}}>
      <Key size={36} color="#38bdf8" style={{margin:"0 auto 8px"}}/>
      <h3 style={{color:"#38bdf8",fontWeight:"bold",fontSize:"17px",margin:"0 0 4px"}}>نسيت كلمة المرور؟</h3>
      <div style={{color:"#71717a",fontSize:"12px"}}>أدخل رقم موبايلك المسجّل به حسابك، وراح تصلك كلمة مرور جديدة من الإدارة قريباً.</div>
    </div>
    <label style={C.label}> رقم الموبايل</label>
    <input
      type="text"
      value={phone}
      onChange={e=>{setPhone(e.target.value);setErr("");}}
      onKeyDown={e=>e.key==="Enter"&&submit()}
      placeholder="07XX XXX XXXX"
      style={C.input}
    />
    <ErrBox msg={err}/>
    {sending
      ?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#38bdf8"/></div>
      :<button onClick={submit} disabled={!phone.trim()} style={{...C.primaryBtn,opacity:phone.trim()?1:0.5}}>إرسال طلب الاستعادة</button>
    }
    <button onClick={onClose} style={{width:"100%",padding:"10px",backgroundColor:"transparent",color:"#71717a",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",fontSize:"13px",cursor:"pointer",marginTop:"4px"}}>إلغاء</button>
  </div></div>;
}

export { AdminLoginModal, ForgotPasswordModal };
