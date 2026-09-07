// ─── modals/SubscriptionDetailsModal.jsx ─────────────────
// شاشة "تفاصيل الاشتراك" — مستقلة تماماً عن أي مقطع محدد: قائمة المواد
// المشترك بها + تاريخ الانتهاء + التقدّم، حالة كل مادة (مجانية/مدفوعة)،
// وأزرار المحفظة/كود التفعيل/بوت تيليجرام/كود الشراكة.
import React from "react";
import { FileText, Key, Users } from "lucide-react";
import { C } from "../styles";
import { SUBJECTS } from "../constants";
import { daysLeft, subKey } from "../helpers";
import { MHead } from "../components/Shared";

function SubscriptionDetailsModal({onClose,mySubscriptions,globalPrices,student,clips,studentProgress,progressUpdatedAt,onOpenWallet,onOpenCode,onOpenPartnerCode,onSelectSubject}) {
  const formatLastActivity = (ts) => {
    if(!ts?.seconds) return null;
    try{ return new Date(ts.seconds*1000).toLocaleString("ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
    catch{ return null; }
  };
  const lastActivityText = formatLastActivity(progressUpdatedAt);

  // ✅ إضافة: حالة كل مادة (مجانية أو مدفوعة وبكم) بمرحلة الطالب تحديداً — حتى
  // يعرف الطالب بوضوح قبل ما يحاول يشترك: هل المادة أصلاً مجانية (ما تحتاج أي
  // اشتراك)، أو مدفوعة ولازم يفعّلها فعلاً. السعر مرتبط بالمادة والمرحلة فقط
  // (وليس بالصف)، فنعرضه هنا لمرحلة الطالب نفسها دون تكرار لكل صف على حدة.
  const subjectsStatus = student?.stage
    ? SUBJECTS.map(subj=>{
        const price = globalPrices?.[subj+"__"+student.stage];
        const free = !price || Number(price)<=0;
        return {subject:subj, free, price};
      })
    : [];
  const subEntries = Object.entries(mySubscriptions||{}).filter(([,s])=>new Date(s.expiresAt)>new Date());

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(255,255,255,0.1)"}}>
    <MHead icon={<FileText size={20} color="#38bdf8"/>} title="تفاصيل الاشتراك" color="#38bdf8" onClose={onClose}/>

    {subEntries.length>0?(
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"8px"}}>اشتراكاتي:</div>
        {subEntries.map(([key,sub])=>{
          const parts=key.split("__");
          const d=daysLeft(mySubscriptions,parts[0],parts[1],parts[2]);
          const subClips=(clips||[]).filter(c=>c.subject===sub.subject&&c.stage===sub.stage);
          const lastIdx=studentProgress?.[subKey(sub.subject,sub.stage)];
          const progress=subClips.length>0&&lastIdx!==undefined?Math.round(((lastIdx+1)/subClips.length)*100):0;
          return (
            <div key={key} style={{...C.card,border:"1px solid rgba(56,189,248,0.15)",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div><div style={{fontWeight:"bold",fontSize:"13px"}}>{sub.subject}</div><div style={{fontSize:"11px",color:"#71717a"}}>{sub.stage}{sub.grade?" — الصف "+sub.grade:""}</div></div>
                <div style={{textAlign:"left"}}>
                  <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
                  <div style={{fontSize:"10px",color:"#52525b"}}>ينتهي {new Date(sub.expiresAt).toLocaleDateString("ar")}</div>
                </div>
              </div>
              {subClips.length>0&&<>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                  <span style={{fontSize:"11px",color:"#71717a"}}>
                    {lastIdx!==undefined?`مقطع ${lastIdx+1} من ${subClips.length}`:"لم تبدأ بعد"}
                  </span>
                  <span style={{fontSize:"11px",fontWeight:"bold",color:progress===100?"#4ade80":"#38bdf8"}}>{progress}%</span>
                </div>
                <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden",marginBottom:onSelectSubject?"10px":0}}>
                  <div style={{height:"100%",width:progress+"%",background:progress===100?"linear-gradient(to left,#4ade80,#22c55e)":"linear-gradient(to left,#6366f1,#38bdf8)",borderRadius:"3px",transition:"width 0.4s ease"}}/>
                </div>
              </>}
              {onSelectSubject&&(
                <button onClick={()=>{onSelectSubject(sub.subject,sub.stage);onClose();}} style={{width:"100%",padding:"7px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:"11px",fontWeight:"bold",cursor:"pointer"}}>
                  تصفّح هذه المادة ←
                </button>
              )}
            </div>
          );
        })}
      </div>
    ):(
      <div style={{textAlign:"center",padding:"20px 10px",marginBottom:"6px",color:"#71717a",fontSize:"13px"}}>
        ما عندك أي اشتراك فعّال حالياً
      </div>
    )}

    {/* ✅ إضافة: حالة كل مادة بمرحلة الطالب (مجانية/مدفوعة وبكم) — يشوفها الطالب
        بوضوح قبل ما يفتح المحفظة، فيعرف مسبقاً وين يحتاج فعلاً يشترك ووين لا */}
    {subjectsStatus.length>0&&(
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#a1a1aa",marginBottom:"8px"}}>حالة المواد بمرحلتك ({student.stage}):</div>
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          {subjectsStatus.map(({subject,free,price})=>(
            <div key={subject} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:"8px",backgroundColor:free?"rgba(74,222,128,0.06)":"rgba(251,191,36,0.06)",border:`1px solid ${free?"rgba(74,222,128,0.2)":"rgba(251,191,36,0.2)"}`}}>
              <span style={{fontSize:"12px",color:"#e4e4e7"}}>{subject}</span>
              {free?(
                <span style={{fontSize:"11px",fontWeight:"bold",color:"#4ade80",backgroundColor:"rgba(74,222,128,0.12)",padding:"2px 8px",borderRadius:"6px"}}>✓ مجانية</span>
              ):(
                <span style={{fontSize:"11px",fontWeight:"bold",color:"#fbbf24",backgroundColor:"rgba(251,191,36,0.12)",padding:"2px 8px",borderRadius:"6px"}}>مدفوعة — {price} د.ع</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    <button style={{...C.primaryBtn,marginBottom:"10px"}} onClick={onOpenWallet}> اشترك أو جدد اشتراك</button>
    <a href="https://t.me/edutok_sub_bot" target="_blank" rel="noreferrer" style={{...C.secondaryBtn,marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",textDecoration:"none",borderColor:"rgba(56,189,248,0.4)",color:"#7dd3fc"}}>📱 اشترك عبر بوت تيليجرام</a>
    <button style={{...C.secondaryBtn,marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} onClick={onOpenCode}><Key size={16}/> لدي كود تفعيل</button>
    {onOpenPartnerCode&&(
      <button style={{...C.secondaryBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",borderColor:"rgba(168,85,247,0.4)",color:"#c4b5fd"}} onClick={onOpenPartnerCode}><Users size={16}/> كود شراكة</button>
    )}

    {lastActivityText&&(
      <div style={{marginTop:"12px",textAlign:"center",fontSize:"10px",color:"#52525b"}}>
        آخر نشاط لك بالتطبيق: {lastActivityText}
      </div>
    )}
  </div></div>;
}

export { SubscriptionDetailsModal };
