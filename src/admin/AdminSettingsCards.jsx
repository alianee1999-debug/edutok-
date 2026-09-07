// ─── admin/AdminSettingsCards.jsx ────────────────────────
// بطاقات إعدادات صغيرة ومستقلة عن بعضها بتبويب "الإعدادات": تغيير كلمة مرور
// المدير، تشخيص مزودي الذكاء الاصطناعي، تفعيل/إيقاف غرفة النقاش، وحجم الخط.
import React, { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Bot, MessageCircle } from "lucide-react";
import { auth, db } from "../firebase";
import { C } from "../styles";
import { AI_PROVIDERS } from "../ai";
import { showMsg } from "../toast";
import { Spinner, ErrBox } from "../components/Shared";

function AdminChangePasswordCard() {
  const [newPass,setNewPass]=useState("");
  const [confirmPass,setConfirmPass]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const change=async()=>{
    setErr("");
    if(newPass.length<6) return setErr("كلمة المرور يجب أن تكون 6 خانات على الأقل");
    if(newPass!==confirmPass) return setErr("كلمتا المرور غير متطابقتين");
    setSaving(true);
    try{
      await updatePassword(auth.currentUser,newPass);
      showMsg("تم تغيير كلمة المرور بنجاح");
      setNewPass(""); setConfirmPass("");
    }catch(e){
      if(e.code==="auth/requires-recent-login") setErr("لأمانك، سجّل الخروج وأعد تسجيل الدخول ثم حاول مرة أخرى");
      else setErr("فشل تغيير كلمة المرور: "+e.message);
    }
    setSaving(false);
  };
  return (
    <div style={C.card}>
      <span style={{color:"#ef4444",fontWeight:"bold",fontSize:"13px",display:"block",marginBottom:"10px"}}> تغيير كلمة المرور</span>
      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="كلمة المرور الجديدة" style={C.input}/>
      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" style={C.input}/>
      <ErrBox msg={err}/>
      <button onClick={change} disabled={saving} style={{...C.redBtn,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={15}/> جارٍ التغيير...</>:"تغيير كلمة المرور"}
      </button>
    </div>
  );
}

// ─── ADMIN PRICES TAB (حقيقي، يُحفظ في Firestore) ───────
// بطاقة تشخيص مزودي الذكاء الاصطناعي — تختبر الأربعة (Gemini, Groq, Cerebras, DeepSeek)
// بالتوازي بسؤال بسيط موحّد، وتعرض نتيجة كل وحد لحاله (نجاح/فشل مع رسالة الخطأ)
// بدل الاعتماد على callAI اللي تخلط الترتيب وتخفي الفشل خلف Fallback صامت.
function AIDiagnosticsCard() {
  const [results,setResults]=useState(null); // null = لسه ما اختبرنا
  const [testing,setTesting]=useState(false);

  const runTest=()=>{
    setTesting(true);
    const initial=AI_PROVIDERS.map(p=>({name:p.name,status:"جارٍ الاختبار..."}));
    setResults(initial);
    const testPrompt="أجب بكلمة واحدة فقط: تم";
    const TIMEOUT_MS=20000; // 20 ثانية — لو مزود تأخر أكثر من كذا نعتبره فشل بدل ما يعلّق باقي النتائج

    let doneCount=0;
    AI_PROVIDERS.forEach((p,idx)=>{
      const started=Date.now();
      const withTimeout=Promise.race([
        p.fn(testPrompt),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("انتهت المهلة (تأخر أكثر من 20 ثانية)")),TIMEOUT_MS))
      ]);
      withTimeout
        .then(()=>{
          setResults(prev=>{
            const next=[...prev];
            next[idx]={name:p.name,ok:true,ms:Date.now()-started};
            return next;
          });
        })
        .catch(e=>{
          setResults(prev=>{
            const next=[...prev];
            next[idx]={name:p.name,ok:false,ms:Date.now()-started,error:(e?.message||"خطأ غير معروف").slice(0,120)};
            return next;
          });
        })
        .finally(()=>{
          doneCount++;
          if(doneCount===AI_PROVIDERS.length) setTesting(false);
        });
    });
  };

  return (
    <div style={{backgroundColor:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
        <div style={{fontWeight:"bold",fontSize:"14px",display:"flex",alignItems:"center",gap:"6px"}}>
          <Bot size={16} color="#38bdf8"/> تشخيص المساعد الذكي
        </div>
        <button onClick={runTest} disabled={testing} style={{padding:"7px 16px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.35)",backgroundColor:"rgba(56,189,248,0.12)",color:"#38bdf8",fontWeight:"bold",fontSize:"12px",cursor:testing?"default":"pointer",opacity:testing?0.6:1}}>
          {testing?"جارٍ الاختبار...":"اختبار المزودين الأربعة"}
        </button>
      </div>
      <div style={{fontSize:"11px",color:"#71717a",marginBottom:results?"10px":0}}>يرسل سؤال تجريبي لكل مزود بشكل منفصل ومتزامن، ويعرض نجاح أو فشل كل واحد لحاله.</div>
      {results&&(
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          {results.map(r=>(
            <div key={r.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"rgba(0,0,0,0.25)",borderRadius:"8px",padding:"8px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"13px",fontWeight:"bold"}}>{r.name}</span>
                {r.ok===true&&<span style={{fontSize:"11px",color:"#71717a"}}>({r.ms}ms)</span>}
              </div>
              {r.ok===true?(
                <span style={{color:"#4ade80",fontSize:"12px",fontWeight:"bold"}}>✅ يعمل</span>
              ):r.ok===false?(
                <span title={r.error} style={{color:"#f87171",fontSize:"12px",fontWeight:"bold",maxWidth:"55%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>❌ {r.error}</span>
              ):(
                <span style={{color:"#a1a1aa",fontSize:"12px"}}>{r.status}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatToggleCard() {
  const [chatEnabled,setChatEnabled]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
    });
    return ()=>unsub();
  },[]);

  const toggle=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"settings","chat"),{enabled:!chatEnabled,updatedAt:serverTimestamp()});
      setChatEnabled(e=>!e);
    }catch(e){console.error(e);}
    setSaving(false);
  };

  return (
    <div style={{backgroundColor:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}>
          <MessageCircle size={16} color="#a855f7"/> غرفة النقاش
        </div>
        <div style={{fontSize:"12px",color:"#71717a"}}>{chatEnabled?"مفعّلة — الطلاب يستطيعون النقاش":"موقوفة — النقاش معطّل للطلاب"}</div>
      </div>
      <button onClick={toggle} disabled={saving} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:chatEnabled?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)",color:chatEnabled?"#f87171":"#4ade80",fontWeight:"bold",fontSize:"13px",cursor:"pointer",border:`1px solid ${chatEnabled?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)"}`}}>
        {saving?"...":chatEnabled?"⏸ إيقاف":"▶ تفعيل"}
      </button>
    </div>
  );
}

function FontSizeCard() {
  const [size,setSize]=useState("medium");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","display"),snap=>{
      if(snap.exists()) setSize(snap.data().fontSize||"medium");
    });
    return()=>unsub();
  },[]);

  const save=async(val)=>{
    setSaving(true);
    setSize(val);
    try{ await setDoc(doc(db,"settings","display"),{fontSize:val,updatedAt:serverTimestamp()},{merge:true}); }
    catch(e){ showMsg("فشل: "+e.message); }
    setSaving(false);
  };

  const sizes=[
    {key:"small",label:"صغير",desc:"مناسب للشاشات الصغيرة"},
    {key:"medium",label:"متوسط",desc:"الحجم الافتراضي"},
    {key:"large",label:"كبير",desc:"مناسب للقراءة المريحة"},
  ];

  return (
    <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>
        <span style={{fontSize:"16px"}}>Aa</span> حجم خط الشرائح
      </div>
      <div style={{display:"flex",gap:"8px"}}>
        {sizes.map(s=>(
          <button key={s.key} onClick={()=>save(s.key)} disabled={saving} style={{
            flex:1,padding:"10px 6px",borderRadius:"10px",border:`1px solid ${size===s.key?"rgba(56,189,248,0.6)":"rgba(255,255,255,0.08)"}`,
            backgroundColor:size===s.key?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.03)",
            color:size===s.key?"#38bdf8":"#71717a",
            fontSize:"13px",fontWeight:size===s.key?"700":"400",cursor:"pointer",
            transition:"all 0.2s",
          }}>
            <div style={{fontSize:s.key==="small"?"11px":s.key==="large"?"17px":"14px",marginBottom:"4px"}}>Aa</div>
            <div>{s.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { AdminChangePasswordCard, AIDiagnosticsCard, ChatToggleCard, FontSizeCard };
