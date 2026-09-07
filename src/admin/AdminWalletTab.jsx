// ─── admin/AdminWalletTab.jsx ────────────────────────────
// إدارة محفظة زين كاش: رقم الاستلام، مراجعة طلبات الدفع المعلّقة (قبول
// وتفعيل الاشتراك تلقائياً، أو رفض مع سبب اختياري)، وسجل المدفوعات.
import React, { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, sendNotification } from "../firebase";
import { C } from "../styles";
import { ZAINCASH_NUM } from "../constants";
import { showMsg } from "../toast";

function AdminWalletTab() {
  const [payments,setPayments]=useState([]);
  const [zaincash,setZaincash]=useState(ZAINCASH_NUM);
  const [editingNum,setEditingNum]=useState(false);
  const [newNum,setNewNum]=useState(ZAINCASH_NUM);
  useEffect(()=>{const unsub=onSnapshot(collection(db,"payments"),snap=>{setPayments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));});return()=>unsub();},[]);
  const totalReceived=payments.filter(p=>p.status==="approved").reduce((s,p)=>s+Number(p.amount||0),0);
  const pending=payments.filter(p=>p.status==="pending");
  const approvePayment=async(p)=>{
    let days=p.duration||30;
    let bonusApplied=0;
    try{
      // لو الطالب مسجّل بكود شراكة ولم يستلم الخصم بعد، نضيف الأيام المجانية على أول اشتراك فقط
      const studentSnap = await getDoc(doc(db,"students",p.studentPhone));
      if(studentSnap.exists()){
        const sd = studentSnap.data();
        if(sd.campaignCode && !sd.campaignBonusGiven && Number(sd.campaignBonusDays)>0){
          bonusApplied = Number(sd.campaignBonusDays);
          days += bonusApplied;
        }
      }
    }catch{}
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+days);
    try{
      await addDoc(collection(db,"subscriptions"),{studentPhone:p.studentPhone,studentName:p.studentName,subject:p.subject,stage:p.stage,grade:p.grade||"",duration:days,expiresAt:expiresAt.toISOString(),activatedAt:serverTimestamp()});
      if(bonusApplied>0){
        await updateDoc(doc(db,"students",p.studentPhone),{campaignBonusGiven:true});
      }
      await sendNotification({phone:p.studentPhone,title:" تم تفعيل اشتراكك!",body:"تم تفعيل اشتراكك في "+p.subject+" ("+p.stage+(p.grade?" - "+p.grade:"")+") لمدة "+days+" يوم"+(bonusApplied>0?" (تشمل "+bonusApplied+" يوم هدية ترحيبية 🎁)":"")+". ينتهي في "+expiresAt.toLocaleDateString("ar")});
      await addDoc(collection(db,"payments"),{...p,status:"approved",approvedAt:serverTimestamp()});
      showMsg(" تم تفعيل اشتراك "+p.subject+" لـ "+p.studentName+(bonusApplied>0?" (+"+bonusApplied+" يوم هدية)":""));
    }catch(e){showMsg("فشل: "+e.message);}
  };
  const rejectPayment=async(p)=>{
    const reason = window.prompt("سبب الرفض (اختياري، سيظهر للطالب):","");
    if(reason===null) return; // ألغى المدير العملية
    try{
      await addDoc(collection(db,"payments"),{...p,status:"rejected"});
      // إشعار الطالب بالرفض وسببه — بدل ما يبقى ينتظر بدون معرفة وش صار (كان يصير رفض بصمت سابقاً)
      await sendNotification({
        phone:p.studentPhone,
        title:"❌ تم رفض طلب اشتراكك",
        body:"تم رفض طلب اشتراكك في "+p.subject+" ("+p.stage+")"+(reason.trim()?" — السبب: "+reason.trim():"")+". تواصل مع المدير لمزيد من التفاصيل أو أعد المحاولة.",
      });
      showMsg("تم رفض الدفع وإشعار الطالب");
    }catch(e){showMsg("فشل: "+e.message);}
  };
  return <div>
    <div style={{background:"linear-gradient(135deg,#14532d,#15803d)",borderRadius:"16px",padding:"20px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.7)",marginBottom:"4px"}}>رقم زين كاش للاستلام</div>
      {editingNum?(
        <div style={{display:"flex",gap:"8px",justifyContent:"center",alignItems:"center"}}>
          <input value={newNum} onChange={e=>setNewNum(e.target.value)} style={{padding:"8px 12px",backgroundColor:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"8px",color:"#fff",fontSize:"16px",outline:"none",textAlign:"center",width:"170px"}}/>
          <button onClick={()=>{setZaincash(newNum);setEditingNum(false);}} style={{backgroundColor:"#4ade80",border:"none",borderRadius:"8px",padding:"8px 14px",color:"#000",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}}>حفظ</button>
        </div>
      ):(
        <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px",cursor:"pointer"}} onClick={()=>setEditingNum(true)}>{zaincash}</div>
      )}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"14px"}}>
      {[["✅",totalReceived.toLocaleString()+" د.ع","المستلم"],["⏳",pending.length,"معلقة"],["✔",payments.filter(p=>p.status==="approved").length,"مؤكدة"]].map(([icon,val,label])=>(
        <div key={label} style={C.statCard}><div style={{fontSize:"18px"}}>{icon}</div><div style={{fontSize:"14px",fontWeight:"bold",color:"#4ade80",margin:"2px 0"}}>{val}</div><div style={{fontSize:"10px",color:"#71717a"}}>{label}</div></div>
      ))}
    </div>
    {pending.length>0&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#fbbf24",marginBottom:"8px"}}> طلبات تحتاج موافقة ({pending.length})</div>
      {pending.map(p=>(
        <div key={p.id} style={{...C.card,border:"1px solid rgba(234,179,8,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div><div style={{fontWeight:"bold",fontSize:"14px"}}>{p.studentName}</div><div style={{fontSize:"12px",color:"#71717a"}}> {p.studentPhone}</div><div style={{fontSize:"12px",color:"#38bdf8"}}> {p.subject} — {p.stage}{p.grade?" — الصف "+p.grade:""}</div><div style={{fontSize:"12px",color:"#a855f7"}}> {p.durationLabel}</div><div style={{fontSize:"13px",color:"#4ade80",fontWeight:"bold"}}> {p.amount} د.ع</div></div>
            {p.receiptUrl&&<img src={p.receiptUrl} alt="إيصال" style={{width:65,height:65,borderRadius:"10px",objectFit:"cover",border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer"}} onClick={()=>window.open(p.receiptUrl,"_blank")}/>}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>approvePayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"10px",color:"#4ade80",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✅ قبول وتفعيل</button>
            <button onClick={()=>rejectPayment(p)} style={{flex:1,padding:"11px",backgroundColor:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",color:"#f87171",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>✗ رفض</button>
          </div>
        </div>
      ))}
    </div>}
    <div style={{fontSize:"13px",fontWeight:"bold",color:"#a1a1aa",marginBottom:"8px"}}> سجل المدفوعات</div>
    {payments.filter(p=>p.status!=="pending").slice(0,20).map(p=>(
      <div key={p.id} style={{...C.card,borderRight:`3px solid ${p.status==="approved"?"#4ade80":"#f87171"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{p.studentName}</div><div style={{fontSize:"11px",color:"#71717a"}}>{p.subject} • {p.stage}{p.grade?" • الصف "+p.grade:""}</div></div>
          <div style={{textAlign:"left"}}><div style={{fontWeight:"bold",fontSize:"13px",color:"#4ade80"}}>{p.amount} د.ع</div><div style={{fontSize:"11px",color:p.status==="approved"?"#4ade80":"#f87171"}}>{p.status==="approved"?" مقبول":" مرفوض"}</div></div>
        </div>
      </div>
    ))}
  </div>;
}

export { AdminWalletTab };
