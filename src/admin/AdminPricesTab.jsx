// ─── admin/AdminPricesTab.jsx ────────────────────────────
// تحديد سعر كل مادة حسب المرحلة (+ ملازم PDF) — يُحفظ كمستند منفصل لكل
// مادة+مرحلة بمجموعة "prices"، وهو المصدر الحقيقي الوحيد المستخدم بكل
// أنحاء التطبيق لتحديد إذا كانت المادة مجانية أو مدفوعة وبكم.
import React, { useState, useEffect } from "react";
import { collection, doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Save } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { PRICE_SUBJECTS, STAGES } from "../constants";
import { showMsg } from "../toast";
import { Spinner } from "../components/Shared";

function AdminPricesTab() {
  const [prices,setPrices]=useState({}); // key: "subject__stage" -> price
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"prices"),snap=>{
      const vals={};
      snap.docs.forEach(d=>{
        const data=d.data();
        if(data.subject&&data.stage) vals[data.subject+"__"+data.stage]=data.value||"";
      });
      setPrices(vals);
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const setPrice=(subj,stage,val)=>{
    const key=subj+"__"+stage;
    setPrices(p=>({...p,[key]:val}));
  };

  const savePrices=async()=>{
    setSaving(true);
    try{
      // نحفظ كل مادة+مرحلة كوثيقة منفصلة في مجموعة prices
      const saves=Object.entries(prices).map(([key,value])=>{
        const [subject,stage]=key.split("__");
        return setDoc(doc(db,"prices",key),{key,subject,stage,value,updatedAt:serverTimestamp()});
      });
      await Promise.all(saves);
      showMsg("تم حفظ الأسعار بنجاح");
    }catch(e){ showMsg("فشل حفظ الأسعار: "+e.message); }
    setSaving(false);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;

  return (
    <div>
      <div style={C.infoBanner}> حدد سعراً لكل مادة حسب المرحلة + سعر ملازم PDF</div>
      {PRICE_SUBJECTS.map(subj=>(
        <div key={subj}>
          <div style={{fontSize:"14px",color:"#38bdf8",textAlign:"center",margin:"14px 0 8px"}}> {subj}</div>
          {STAGES.map(stage=>{
            const key=subj+"__"+stage;
            return (
              <div key={stage} style={C.priceRow}>
                <span style={{fontSize:"14px",color:"#e4e4e7",minWidth:"60px"}}>{stage}</span>
                <div style={{display:"flex",alignItems:"center",gap:"6px",backgroundColor:"#09090b",padding:"6px 10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.08)",flex:1,margin:"0 10px"}}>
                  <input type="number" placeholder="0" value={prices[key]??""} onChange={e=>setPrice(subj,stage,e.target.value)} style={C.priceInput}/>
                </div>
                <span style={{color:"#71717a",fontSize:"12px"}}>د.ع</span>
              </div>
            );
          })}
        </div>
      ))}
      <button disabled={saving} style={{...C.gradBtn,marginTop:"16px",opacity:saving?0.7:1}} onClick={savePrices}>
        {saving?<><Spinner size={15}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الأسعار</>}
      </button>
    </div>
  );
}

export { AdminPricesTab };
