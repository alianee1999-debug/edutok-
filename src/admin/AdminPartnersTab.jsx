// ─── admin/AdminPartnersTab.jsx ──────────────────────────
// أكواد شراكة جماعية للصفحات/المجموعات (أيام هدية للطلاب الجدد عبر الكود،
// بسقف استخدام ومدة صلاحية)، مع تفعيل/إيقاف/حذف كل كود.
import React, { useState, useEffect } from "react";
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Share2, CheckCircle, Copy, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { generateRandomCode } from "../helpers";
import { showMsg } from "../toast";
import { Spinner } from "../components/Shared";

function AdminPartnersTab() {
  const [label,setLabel]=useState("");
  const [maxUses,setMaxUses]=useState(75);
  const [bonusDays,setBonusDays]=useState(15);
  const [durationDays,setDurationDays]=useState(30);
  const [generating,setGenerating]=useState(false);
  const [lastCode,setLastCode]=useState(null);
  const [campaigns,setCampaigns]=useState([]);
  const [copiedCode,setCopiedCode]=useState("");

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"campaignCodes"),snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      setCampaigns(list);
    });
    return ()=>unsub();
  },[]);

  const generate=async()=>{
    if(!label.trim()) return showMsg("أدخل اسم الصفحة/المجموعة الشريكة أولاً");
    setGenerating(true);
    try{
      let code=""; let attempts=0; let free=false;
      while(!free && attempts<8){
        code=generateRandomCode(7);
        const snap=await getDoc(doc(db,"campaignCodes",code));
        free=!snap.exists();
        attempts++;
      }
      if(!free){ showMsg("تعذّر توليد كود فريد، حاول مرة أخرى"); setGenerating(false); return; }
      const expiresAt=new Date();
      expiresAt.setDate(expiresAt.getDate()+Number(durationDays||30));
      await setDoc(doc(db,"campaignCodes",code),{
        code, label:label.trim(),
        maxUses:Number(maxUses)||50, usedCount:0,
        bonusDays:Number(bonusDays)||0,
        expiresAt: expiresAt.toISOString(),
        active:true,
        createdAt: serverTimestamp(),
      });
      setLastCode(code);
      setLabel("");
      showMsg("✅ تم توليد كود الشراكة بنجاح");
    }catch(e){ showMsg("فشل توليد الكود: "+e.message); }
    setGenerating(false);
  };

  const copyCode=(c)=>{
    try{ navigator.clipboard?.writeText(c); setCopiedCode(c); setTimeout(()=>setCopiedCode(""),1500); }catch{}
  };

  const toggleActive=async(camp)=>{
    try{ await updateDoc(doc(db,"campaignCodes",camp.id),{active:!camp.active}); }catch(e){ showMsg("فشل: "+e.message); }
  };

  const removeCampaign=async(camp)=>{
    try{ await deleteDoc(doc(db,"campaignCodes",camp.id)); showMsg("تم حذف كود الشراكة"); }catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  const isExpired=(camp)=> new Date(camp.expiresAt) < new Date();
  const isFull=(camp)=> (camp.usedCount||0) >= (camp.maxUses||0);

  return <div>
    <div style={{background:"linear-gradient(135deg,#0c4a6e,#0369a1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"16px",padding:"18px",marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <Share2 size={18} color="#7dd3fc"/>
        <span style={{fontSize:"14px",fontWeight:"bold",color:"#7dd3fc"}}>توليد كود شراكة جديد</span>
      </div>
      <label style={C.label}>اسم الصفحة/المجموعة الشريكة</label>
      <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="مثال: صفحة فيسبوك — ثانوية بغداد" style={{...C.input,marginBottom:"10px"}}/>
      <div style={C.twoCol}>
        <div>
          <label style={C.label}>سقف عدد الطلاب</label>
          <input type="number" value={maxUses} onChange={e=>setMaxUses(e.target.value)} style={{...C.input,marginBottom:"10px"}}/>
        </div>
        <div>
          <label style={C.label}>مدة الصلاحية (يوم)</label>
          <input type="number" value={durationDays} onChange={e=>setDurationDays(e.target.value)} style={{...C.input,marginBottom:"10px"}}/>
        </div>
      </div>
      <label style={C.label}>أيام مجانية إضافية للطالب الجديد (خصم)</label>
      <input type="number" value={bonusDays} onChange={e=>setBonusDays(e.target.value)} style={{...C.input,marginBottom:"12px"}}/>
      <button onClick={generate} disabled={generating} style={{...C.purpleBtn,background:"linear-gradient(to right,#0284c7,#38bdf8)",opacity:generating?0.7:1}}>
        {generating?<><Spinner size={16}/> جارٍ التوليد...</>:<><Share2 size={16}/> توليد كود الشراكة</>}
      </button>
      {lastCode&&(
        <div style={{marginTop:"14px",backgroundColor:"rgba(0,0,0,0.3)",borderRadius:"12px",padding:"14px",textAlign:"center"}}>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>الكود الجديد — شاركه مع الصفحة</div>
          <div style={{fontSize:"26px",fontWeight:"900",letterSpacing:"3px",color:"#fff",marginBottom:"10px",fontFamily:"monospace"}}>{lastCode}</div>
          <button onClick={()=>copyCode(lastCode)} style={{padding:"8px 18px",borderRadius:"10px",border:"none",backgroundColor:copiedCode===lastCode?"#4ade80":"#0284c7",color:copiedCode===lastCode?"#000":"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"6px"}}>
            {copiedCode===lastCode?<><CheckCircle size={14}/> تم النسخ</>:<><Copy size={14}/> نسخ الكود</>}
          </button>
        </div>
      )}
    </div>

    <div style={{fontSize:"12px",color:"#71717a",marginBottom:"10px"}}>الأكواد الحالية ({campaigns.length})</div>
    {campaigns.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Share2 size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أكواد شراكة بعد</div></div>
      :campaigns.map(camp=>{
        const expired=isExpired(camp);
        const full=isFull(camp);
        const statusLabel = !camp.active?"موقوف يدوياً":expired?"منتهي الصلاحية":full?"وصل الحد الأقصى":"نشط";
        const statusColor = !camp.active||expired||full ? "#f87171" : "#4ade80";
        return (
          <div key={camp.id} style={{...C.card,border:`1px solid ${statusColor}33`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
              <div style={{fontWeight:"bold",fontSize:"13px"}}>{camp.label}</div>
              <span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"6px",fontWeight:"bold",backgroundColor:statusColor+"22",color:statusColor}}>{statusLabel}</span>
            </div>
            <div style={{fontFamily:"monospace",fontSize:"15px",fontWeight:"900",letterSpacing:"1px",marginBottom:"6px"}}>{camp.code}</div>
            <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"8px"}}>
              الاستخدام: {camp.usedCount||0} / {camp.maxUses} • ينتهي: {new Date(camp.expiresAt).toLocaleDateString("ar")} • خصم: {camp.bonusDays} يوم
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>toggleActive(camp)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",backgroundColor:"rgba(255,255,255,0.04)",color:"#cbd5e1",fontSize:"11px",fontWeight:"bold",cursor:"pointer"}}>{camp.active?"إيقاف":"تفعيل"}</button>
              <button onClick={()=>removeCampaign(camp)} style={{padding:"7px 12px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"11px",fontWeight:"bold",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}><Trash2 size={12}/></button>
            </div>
          </div>
        );
      })
    }
  </div>;
}

export { AdminPartnersTab };
