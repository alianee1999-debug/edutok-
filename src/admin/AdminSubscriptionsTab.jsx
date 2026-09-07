// ─── admin/AdminSubscriptionsTab.jsx ─────────────────────
// نظرة شاملة على كل الاشتراكات النشطة: عدد المشتركين، عدد اشتراكات المواد
// الفعّالة، وقائمة لكل طالب بمواده وتاريخ انتهاء كل واحدة (مرتّبة بالأقرب
// انتهاءً أو الأكثر مواداً).
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { ClipboardList } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { Spinner } from "../components/Shared";

function AdminSubscriptionsTab() {
  const [subs,setSubs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [search,setSearch]=useState("");
  const [sortBy,setSortBy]=useState("expiry"); // "expiry" | "subjectCount"

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"subscriptions"),
      snap=>{ setSubs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      error=>{ setErr("تعذّر تحميل الاشتراكات: "+error.message); setLoading(false); }
    );
    return ()=>unsub();
  },[]);

  // نجمّع الاشتراكات حسب الطالب، ونحتفظ فقط بالاشتراكات النشطة فعلياً (لم
  // تنتهِ صلاحيتها بعد) — لو الطالب عنده أكثر من سجل لنفس المادة (تجديد
  // سابق مثلاً)، نحتفظ بأبعد تاريخ انتهاء فقط لتلك المادة تحديداً
  const grouped = React.useMemo(()=>{
    const now = new Date();
    const byStudent = {}; // phone -> {name, phone, subjects:{subjectKey: expiresAt}}
    subs.forEach(s=>{
      const expiry = new Date(s.expiresAt);
      if(!(expiry>now)) return; // تجاهل أي اشتراك منتهي فعلاً
      const phone = s.studentPhone;
      if(!phone) return;
      if(!byStudent[phone]) byStudent[phone]={name:s.studentName||"—",phone,subjects:{}};
      // المفتاح يشمل الصف كذلك (بعد تفعيل تقييد الاشتراك بالصف) — وإلا لو كان
      // الطالب مشتركاً بنفس المادة/المرحلة لصفّين مختلفين، سيُدمَجان خطأً بسطر واحد
      // ويختفي أحدهما من عرض الأدمن
      const sKey = s.subject+"__"+s.stage+"__"+(s.grade||"");
      const existing = byStudent[phone].subjects[sKey];
      if(!existing || new Date(existing.expiresAt)<expiry){
        byStudent[phone].subjects[sKey]={subject:s.subject,stage:s.stage,grade:s.grade||"",expiresAt:s.expiresAt};
      }
    });
    let list = Object.values(byStudent).map(st=>{
      const subjectList = Object.values(st.subjects);
      const nearestExpiry = subjectList.reduce((min,sub)=>{
        const t = new Date(sub.expiresAt).getTime();
        return (min===null||t<min) ? t : min;
      },null);
      return {...st, subjectList, subjectCount:subjectList.length, nearestExpiry};
    });
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list = list.filter(st=>st.name.toLowerCase().includes(q)||st.phone.includes(q));
    }
    list.sort((a,b)=> sortBy==="expiry" ? a.nearestExpiry-b.nearestExpiry : b.subjectCount-a.subjectCount);
    return list;
  },[subs,search,sortBy]);

  const totalActiveSubscriptions = grouped.reduce((sum,st)=>sum+st.subjectCount,0);
  const daysLeftOf = (iso) => Math.max(0,Math.ceil((new Date(iso)-new Date())/86400000));

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;
  if(err) return <div style={{textAlign:"center",padding:"24px"}}><ClipboardList size={40} color="#f87171" style={{margin:"0 auto 10px"}}/><div style={{color:"#f87171",fontSize:"13px"}}>{err}</div></div>;

  return (
    <div>
      {/* إحصائيات إجمالية */}
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        <div style={{flex:1,...C.card,textAlign:"center"}}>
          <div style={{fontSize:"22px",fontWeight:"900",color:"#38bdf8"}}>{grouped.length}</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>طالب مشترك حالياً</div>
        </div>
        <div style={{flex:1,...C.card,textAlign:"center"}}>
          <div style={{fontSize:"22px",fontWeight:"900",color:"#4ade80"}}>{totalActiveSubscriptions}</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>اشتراك مادة نشط</div>
        </div>
      </div>

      {/* بحث + فرز */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." style={{...C.input,marginBottom:"8px"}}/>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
        <button onClick={()=>setSortBy("expiry")} style={{flex:1,padding:"7px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:"bold",backgroundColor:sortBy==="expiry"?"rgba(56,189,248,0.18)":"rgba(255,255,255,0.04)",color:sortBy==="expiry"?"#38bdf8":"#71717a"}}>⏰ الأقرب للانتهاء أولاً</button>
        <button onClick={()=>setSortBy("subjectCount")} style={{flex:1,padding:"7px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:"bold",backgroundColor:sortBy==="subjectCount"?"rgba(56,189,248,0.18)":"rgba(255,255,255,0.04)",color:sortBy==="subjectCount"?"#38bdf8":"#71717a"}}>📚 الأكثر مواد أولاً</button>
      </div>

      {grouped.length===0?(
        <div style={{textAlign:"center",padding:"30px",color:"#52525b"}}>
          <ClipboardList size={44} color="#3f3f46" style={{margin:"0 auto 10px"}}/>
          <div>{search.trim()?"لا توجد نتائج مطابقة":"لا يوجد طلاب مشتركين حالياً"}</div>
        </div>
      ):grouped.map(st=>(
        <div key={st.phone} style={{...C.card,marginBottom:"8px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
            <div>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{st.name}</div>
              <div dir="ltr" style={{fontSize:"11px",color:"#71717a",textAlign:"left"}}>{st.phone}</div>
            </div>
            <div style={{backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:"bold",color:"#38bdf8"}}>
              {st.subjectCount} مادة
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {st.subjectList.map((sub,i)=>{
              const days = daysLeftOf(sub.expiresAt);
              const urgent = days<=3;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",backgroundColor:urgent?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.03)",borderRadius:"8px",padding:"6px 10px"}}>
                  <span style={{fontSize:"12px",color:"#d4d4d8"}}>{sub.subject} <span style={{color:"#52525b"}}>• {sub.stage}{sub.grade?" • الصف "+sub.grade:""}</span></span>
                  <span style={{fontSize:"11px",fontWeight:"bold",color:urgent?"#f87171":"#a1a1aa"}}>
                    {urgent&&"⚠️ "}{days===0?"ينتهي اليوم":`${days} يوم متبقي`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export { AdminSubscriptionsTab };
