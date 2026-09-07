// ─── admin/AdminCodesTab.jsx ─────────────────────────────
// توليد أكواد تفعيل اشتراك (يمنع التوليد للمواد المجانية)، وعرض/بحث/حذف
// الأكواد الموجودة. يقرأ الأسعار من نفس مصدر تبويب "الأسعار" الحقيقي.
import React, { useState, useEffect } from "react";
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Key, CheckCircle, Copy, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES, DURATIONS } from "../constants";
import { isFreeSubject, generateRandomCode } from "../helpers";
import { showMsg } from "../toast";
import { Spinner } from "../components/Shared";

function AdminCodesTab() {
  const [subject,setSubject]=useState(SUBJECTS[0]);
  const [stage,setStage]=useState(STAGES[0]);
  const [grade,setGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [duration,setDuration]=useState(DURATIONS[0]);
  const [generating,setGenerating]=useState(false);
  const [lastCode,setLastCode]=useState(null);
  const [codes,setCodes]=useState([]);
  const [copiedCode,setCopiedCode]=useState("");
  const [filterText,setFilterText]=useState("");
  const [prices,setPrices]=useState({});

  useEffect(()=>{
    // ✅ إصلاح: كانت هذه الشاشة تقرأ من doc(db,"settings","prices") وهو مستند
    // لا تكتب فيه شاشة "الأسعار" أي شيء (هي تكتب بمجموعة prices منفصلة)، فكانت
    // كل مادة تظهر دائماً "مجانية" هنا حتى لو محدد لها سعر فعلي بتبويب الأسعار.
    // الآن نقرأ من نفس المصدر الحقيقي (collection "prices") المستخدم في كل مكان آخر بالتطبيق.
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage&&data.value!==undefined){
          vals[data.subject+"__"+data.stage]=data.value;
        }
      });
      setPrices(vals);
    });
    return ()=>unsub();
  },[]);

  const selectionIsFree = isFreeSubject(prices,subject,stage);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"codes"),snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      setCodes(list);
    });
    return ()=>unsub();
  },[]);

  const onStageChange=(s)=>{ setStage(s); setGrade((GRADES[s]||[])[0]||""); };

  const generate=async()=>{
    if(selectionIsFree){ showMsg("هذه المادة مجانية حالياً، لا حاجة لتوليد كود"); return; }
    setGenerating(true);
    try{
      let code=""; let attempts=0; let free=false;
      // نتأكد أن الكود فريد فعلياً بقاعدة البيانات قبل اعتماده (مو فقط عشوائي)
      while(!free && attempts<8){
        code=generateRandomCode(7);
        const snap=await getDoc(doc(db,"codes",code));
        free=!snap.exists();
        attempts++;
      }
      if(!free){ showMsg("تعذّر توليد كود فريد، حاول مرة أخرى"); setGenerating(false); return; }
      await setDoc(doc(db,"codes",code),{
        code, subject, stage, grade,
        durationDays: duration.days, durationLabel: duration.label,
        used:false, usedBy:"", usedByName:"", usedAt:null,
        createdAt: serverTimestamp(),
      });
      setLastCode(code);
      showMsg("✅ تم توليد الكود بنجاح");
    }catch(e){ showMsg("فشل توليد الكود: "+e.message); }
    setGenerating(false);
  };

  const copyCode=(c)=>{
    try{ navigator.clipboard?.writeText(c); setCopiedCode(c); setTimeout(()=>setCopiedCode(""),1500); }catch{}
  };

  const removeCode=async(c)=>{
    try{ await deleteDoc(doc(db,"codes",c.id)); showMsg("تم حذف الكود"); }catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  const filtered=codes.filter(c=>!filterText || c.code.includes(filterText.toUpperCase()) || c.subject?.includes(filterText) || c.usedByName?.includes(filterText));
  const unusedCount=codes.filter(c=>!c.used).length;
  const usedCount=codes.filter(c=>c.used).length;

  return <div>
    {/* توليد كود جديد */}
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"16px",padding:"18px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <Key size={18} color="#c4b5fd"/>
        <span style={{fontSize:"14px",fontWeight:"bold",color:"#c4b5fd"}}>توليد كود اشتراك جديد</span>
      </div>
      <div style={C.twoCol}>
        <div>
          <label style={C.label}>المادة</label>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label style={C.label}>المرحلة</label>
          <select value={stage} onChange={e=>onStageChange(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
        </div>
      </div>
      <label style={C.label}>الصف</label>
      <select value={grade} onChange={e=>setGrade(e.target.value)} style={C.select}>{(GRADES[stage]||[]).map(g=><option key={g}>{g}</option>)}</select>

      {selectionIsFree&&(
        <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"10px",padding:"10px 12px",marginBottom:"14px",fontSize:"12px",color:"#fbbf24",display:"flex",alignItems:"center",gap:"6px"}}>
          ⚠ هذه المادة مجانية حالياً (سعرها 0 بتبويب الأسعار) — الطلاب أصلاً عندهم وصول كامل بدون كود
        </div>
      )}

      <label style={C.label}>مدة الاشتراك</label>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
        {DURATIONS.map(d=><button key={d.days} onClick={()=>setDuration(d)} style={{flex:1,padding:"9px 4px",borderRadius:"10px",border:"none",backgroundColor:duration.days===d.days?"#a855f7":"#27272a",color:"#fff",fontWeight:"bold",fontSize:"10px",cursor:"pointer"}}>{d.label}</button>)}
      </div>
      <button onClick={generate} disabled={generating||selectionIsFree} style={{...C.purpleBtn,opacity:(generating||selectionIsFree)?0.5:1}}>
        {generating?<><Spinner size={16}/> جارٍ التوليد...</>:<><Key size={16}/> توليد كود</>}
      </button>
      {lastCode&&(
        <div style={{marginTop:"14px",backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"12px",padding:"14px",textAlign:"center"}}>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>الكود الجديد — أرسله للطالب</div>
          <div style={{fontSize:"26px",fontWeight:"900",letterSpacing:"3px",color:"#fff",marginBottom:"10px",fontFamily:"monospace"}}>{lastCode}</div>
          <button onClick={()=>copyCode(lastCode)} style={{padding:"8px 18px",borderRadius:"10px",border:"none",backgroundColor:copiedCode===lastCode?"#4ade80":"#7c3aed",color:copiedCode===lastCode?"#000":"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}}>
            {copiedCode===lastCode?<><CheckCircle size={14}/> تم النسخ</>:<><Copy size={14}/> نسخ الكود</>}
          </button>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>{subject} • {stage} • {grade} • {duration.label}</div>
        </div>
      )}
    </div>

    {/* إحصائيات سريعة */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
      <div style={C.statCard}><div style={{fontSize:"18px",fontWeight:"bold",color:"#fbbf24"}}>{unusedCount}</div><div style={{fontSize:"10px",color:"#71717a"}}>أكواد غير مستخدمة</div></div>
      <div style={C.statCard}><div style={{fontSize:"18px",fontWeight:"bold",color:"#4ade80"}}>{usedCount}</div><div style={{fontSize:"10px",color:"#71717a"}}>أكواد مُستخدمة</div></div>
    </div>

    {/* قائمة الأكواد */}
    <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="ابحث بالكود أو المادة أو اسم الطالب..." style={{...C.input,marginBottom:"10px"}}/>
    {filtered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Key size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أكواد بعد</div></div>
      :filtered.map(c=>(
        <div key={c.id} style={{...C.card,border:c.used?"1px solid rgba(74,222,128,0.2)":"1px solid rgba(251,191,36,0.25)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
            <div style={{fontFamily:"monospace",fontSize:"16px",fontWeight:"900",letterSpacing:"2px"}}>{c.code}</div>
            <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"6px",fontWeight:"bold",backgroundColor:c.used?"rgba(74,222,128,0.15)":"rgba(251,191,36,0.15)",color:c.used?"#4ade80":"#fbbf24"}}>{c.used?"مُستخدم":"غير مستخدم"}</span>
          </div>
          <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"4px"}}>{c.subject} • {c.stage} • {c.grade} • {c.durationLabel}</div>
          {c.used
            ?<div style={{fontSize:"11px",color:"#71717a"}}>استخدمه: {c.usedByName||c.usedBy||"—"}</div>
            :<button onClick={()=>removeCode(c)} style={{marginTop:"6px",padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"11px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Trash2 size={12}/> حذف الكود</button>
          }
        </div>
      ))
    }
  </div>;
}

export { AdminCodesTab };
