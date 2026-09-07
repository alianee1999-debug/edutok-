// ─── modals/SubscriptionModals.jsx ───────────────────────
// نوافذ الاشتراك المدفوع: المحفظة (تحويل زين كاش يدوي + مراجعة الإدارة)،
// تفعيل بكود اشتراك مباشر، وتفعيل كود شراكة (أيام هدية).
import React, { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { DollarSign, Key, Users } from "lucide-react";
import { db, sendNotification } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES, DURATIONS, ZAINCASH_NUM } from "../constants";
import { daysLeft, CODE_VALIDITY_DAYS, computeExtendedExpiry } from "../helpers";
import { showMsg } from "../toast";
import { Spinner, MHead, ErrBox, FirstUseTip, ImageUploader } from "../components/Shared";

function WalletModal({onClose,student,subscriptions}) {
  const [selSubject,setSelSubject]=useState(SUBJECTS[0]);
  const [selStage,setSelStage]=useState(STAGES[0]);
  const [selGrade,setSelGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [selDuration,setSelDuration]=useState(DURATIONS[0]);
  const [amount,setAmount]=useState("");
  const [receipt,setReceipt]=useState(null);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [prices,setPrices]=useState({});

  // لازم نصفّر الصف المختار كل ما تتغيّر المرحلة، حتى لا يبقى صف من مرحلة سابقة
  // غير موجود أصلاً بالمرحلة الجديدة (مثلاً "السادس" من الإعدادية بعد التحويل للمتوسطة)
  const onStageChange=(s)=>{ setSelStage(s); setSelGrade((GRADES[s]||[])[0]||""); };

  useEffect(()=>{
    // ✅ إصلاح: نفس مشكلة شاشة الأكواد — نقرأ من مجموعة "prices" الحقيقية
    // بدل مستند "settings/prices" الذي لا يُكتب فيه شيء أبداً.
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

  const recommendedPrice = prices[selSubject+"__"+selStage];

  const sendPayment=async()=>{
    if(!amount.trim()) return showMsg("أدخل المبلغ المحوّل");
    setSending(true);
    try{
      await addDoc(collection(db,"payments"),{
        studentName:student?.name||"",studentPhone:student?.phone||"",studentId:student?.id||"",
        subject:selSubject,stage:selStage,grade:selGrade,duration:selDuration.days,durationLabel:selDuration.label,
        amount,receiptUrl:receipt||"",status:"pending",createdAt:serverTimestamp()
      });
      setSent(true);
    }catch(e){showMsg("حدث خطأ: "+e.message);}
    setSending(false);
  };

  if(sent) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم إرسال طلب الاشتراك!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"4px"}}>المادة: <strong style={{color:"#fff"}}>{selSubject} — {selStage} — الصف {selGrade}</strong></div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>سيتم تفعيل اشتراكك بعد مراجعة المدير</div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)"}}>
    <MHead icon={<DollarSign size={20} color="#4ade80"/>} title="محفظة زين كاش" color="#4ade80" onClose={onClose}/>
    {subscriptions&&Object.keys(subscriptions).length>0&&(
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:"bold",color:"#38bdf8",marginBottom:"6px"}}>اشتراكاتي النشطة:</div>
        {Object.entries(subscriptions).map(([key,sub])=>{
          const parts=key.split("__");
          const d=daysLeft(subscriptions,parts[0],parts[1],parts[2]);
          return <div key={key} style={{...C.card,marginBottom:"6px",border:"1px solid rgba(34,197,94,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:"bold",fontSize:"12px"}}>{sub.subject}</div><div style={{fontSize:"10px",color:"#71717a"}}>{sub.stage}{sub.grade?" — الصف "+sub.grade:""}</div></div>
              <div style={{color:d>3?"#4ade80":d>0?"#fbbf24":"#f87171",fontSize:"12px",fontWeight:"bold"}}>{d>0?d+" يوم":" منتهي"}</div>
            </div>
          </div>;
        })}
      </div>
    )}
    <a href="https://t.me/edutok_sub_bot" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",backgroundColor:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textDecoration:"none",color:"#7dd3fc",fontWeight:"bold",fontSize:"13px"}}>📱 أو اشترك بشكل أسرع عبر بوت تيليجرام</a>
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:"12px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
      <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"4px"}}>رقم زين كاش للمدير</div>
      <div style={{fontSize:"22px",fontWeight:"bold",color:"#4ade80",letterSpacing:"2px"}}>{ZAINCASH_NUM}</div>
      <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>حوّل المبلغ ثم أرسل الإيصال</div>
    </div>
    <label style={C.label}> المادة</label>
    <select value={selSubject} onChange={e=>setSelSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> المرحلة</label>
    <select value={selStage} onChange={e=>onStageChange(e.target.value)} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
    <label style={C.label}> الصف</label>
    <select value={selGrade} onChange={e=>setSelGrade(e.target.value)} style={C.select}>{(GRADES[selStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
    <label style={C.label}> مدة الاشتراك</label>
    <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
      {DURATIONS.map(d=><button key={d.days} onClick={()=>setSelDuration(d)} style={{flex:1,padding:"9px 4px",borderRadius:"10px",border:"none",backgroundColor:selDuration.days===d.days?"#4ade80":"#27272a",color:selDuration.days===d.days?"#000":"#a1a1aa",fontWeight:"bold",fontSize:"10px",cursor:"pointer"}}>{d.label}</button>)}
    </div>
    <label style={C.label}> المبلغ المحوّل (د.ع)</label>
    {recommendedPrice&&<div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px"}}>السعر المحدد لهذا الاشتراك: {recommendedPrice} د.ع</div>}
    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="أدخل المبلغ" style={C.input}/>
    <label style={C.label}> إيصال التحويل</label>
    <ImageUploader onUpload={url=>setReceipt(url)} onBase64={()=>{}} color="#4ade80" label="صوّر إيصال زين كاش"/>
    {sending?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#4ade80"/></div>
    :<button onClick={sendPayment} style={{...C.primaryBtn,background:"linear-gradient(to right,#15803d,#4ade80)",marginBottom:0}}>إرسال طلب الاشتراك للمدير</button>}
  </div></div>;
}

// ─── CODE MODAL (تفعيل اشتراك عبر كود) ───────────────────
function CodeModal({onClose,student,mySubscriptions,onRedirectToPartnerCode}) {
  const [code,setCode]=useState("");
  const [checking,setChecking]=useState(false);
  const [err,setErr]=useState("");
  const [wrongType,setWrongType]=useState(false);
  const [result,setResult]=useState(null); // {subject,stage,newExpiry}

  const redeem=async()=>{
    const c=code.trim().toUpperCase();
    if(!c) return setErr("أدخل الكود أولاً");
    if(!student?.phone) return setErr("يجب تسجيل الدخول كطالب أولاً");
    setErr(""); setWrongType(false); setChecking(true);
    try{
      const ref=doc(db,"codes",c);
      const snap=await getDoc(ref);
      if(!snap.exists()){
        // تحقق إضافي: هل هذا فعلياً كود شراكة (أيام هدية) كتبه الطالب بالغلط هنا؟
        // نميّز الحالة بوضوح بدل رسالة "غير صحيح" مبهمة — نفس المنطق المطبّق
        // بالاتجاه المعاكس في api/redeem-partner-code.js
        let isPartnerCode=false;
        try{
          const campSnap=await getDoc(doc(db,"campaignCodes",c));
          isPartnerCode=campSnap.exists();
        }catch{}
        if(isPartnerCode){
          setErr("هذا كود شراكة (أيام هدية)، مو كود تفعيل مادة — فعّله من «كود شراكة» بدل هنا");
          setWrongType(true);
        } else {
          setErr("الكود غير صحيح، تأكد من كتابته بشكل سليم");
        }
        setChecking(false); return;
      }
      const data=snap.data();
      if(data.used){ setErr("هذا الكود تم استخدامه مسبقاً"); setChecking(false); return; }
      // التحقق من صلاحية الكود الزمنية (قبل الاستخدام)
      const createdMs = data.createdAt?.seconds ? data.createdAt.seconds*1000 : null;
      if(createdMs && (Date.now()-createdMs) > CODE_VALIDITY_DAYS*86400000){
        setErr("انتهت صلاحية هذا الكود، تواصل مع المدير للحصول على كود جديد");
        setChecking(false); return;
      }
      // حساب تاريخ الانتهاء الجديد (يمدد الاشتراك الحالي لنفس الصف إن وجد وإلا يبدأ من الآن)
      let newExpiry = computeExtendedExpiry(mySubscriptions, data.subject, data.stage, data.durationDays, data.grade);
      // لو الطالب مسجّل بكود شراكة ولم يستلم هديته بعد، نضيفها هنا أيضاً (أول اشتراك فعلي، سواء عبر كود أو دفع مباشر)
      let bonusApplied = 0;
      try{
        const studentSnap = await getDoc(doc(db,"students",student.phone));
        if(studentSnap.exists()){
          const sd = studentSnap.data();
          if(sd.campaignCode && !sd.campaignBonusGiven && Number(sd.campaignBonusDays)>0){
            bonusApplied = Number(sd.campaignBonusDays);
            newExpiry = new Date(newExpiry);
            newExpiry.setDate(newExpiry.getDate()+bonusApplied);
          }
        }
      }catch{}
      // 1) إنشاء/تمديد سجل الاشتراك
      await addDoc(collection(db,"subscriptions"),{
        studentPhone: student.phone,
        studentName: student.name||"",
        subject: data.subject,
        stage: data.stage,
        grade: data.grade||"",
        duration: data.durationDays,
        expiresAt: newExpiry.toISOString(),
        activatedAt: serverTimestamp(),
        viaCode: c,
      });
      if(bonusApplied>0){
        await updateDoc(doc(db,"students",student.phone),{campaignBonusGiven:true});
      }
      // 2) تعليم الكود كمستخدم (يمنع إعادة استخدامه)
      await updateDoc(ref,{
        used:true, usedBy: student.phone, usedByName: student.name||"", usedAt: serverTimestamp(),
      });
      // 3) إشعار الطالب
      await sendNotification({
        phone: student.phone,
        title:"✅ تم تفعيل اشتراكك بالكود!",
        body:"تم تفعيل/تمديد اشتراكك في "+data.subject+" ("+data.stage+(data.grade?" - "+data.grade:"")+")"+(bonusApplied>0?" (تشمل "+bonusApplied+" يوم هدية ترحيبية 🎁)":"")+". ينتهي في "+newExpiry.toLocaleDateString("ar"),
      });
      setResult({subject:data.subject,stage:data.stage,grade:data.grade,newExpiry,bonusApplied});
    }catch(e){
      setErr("حدث خطأ: "+e.message);
    }
    setChecking(false);
  };

  if(result) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>✅</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم تفعيل الاشتراك بنجاح!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"4px"}}>المادة: <strong style={{color:"#fff"}}>{result.subject} — {result.stage}{result.grade?" — الصف "+result.grade:""}</strong></div>
    {result.bonusApplied>0&&<div style={{color:"#fbbf24",fontSize:"13px",marginBottom:"4px"}}>🎁 تمت إضافة {result.bonusApplied} يوم هدية ترحيبية!</div>}
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>ينتهي الاشتراك في: <strong style={{color:"#fbbf24"}}>{result.newExpiry.toLocaleDateString("ar")}</strong></div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.25)"}}>
    <MHead icon={<Key size={20} color="#c4b5fd"/>} title="تفعيل بالكود" color="#c4b5fd" onClose={onClose}/>
    <div style={{...C.infoBanner,backgroundColor:"rgba(88,28,135,0.2)",border:"1px solid rgba(168,85,247,0.35)",color:"#c4b5fd"}}>
      احصل على الكود بالتواصل مع المدير، ثم أدخله هنا لتفعيل اشتراكك فوراً.
    </div>
    <FirstUseTip tipKey="subscription_vs_partner_code" text="ℹ️ هذا الكود يفتح مادة كاملة فوراً. لو الكود اللي وصلك من صفحة/مجموعة شريكة (يعطي أيام هدية بس، مو مادة)، استخدم «كود شراكة» من حسابك بدل هذا."/>
    <label style={C.label}>كود التفعيل</label>
    <input
      value={code}
      onChange={e=>{setCode(e.target.value.toUpperCase());setErr("");setWrongType(false);}}
      onKeyDown={e=>e.key==="Enter"&&redeem()}
      placeholder="مثال: A7K9PXQ"
      maxLength={12}
      style={{...C.input,textAlign:"center",fontSize:"18px",fontWeight:"bold",letterSpacing:"3px",fontFamily:"monospace"}}
    />
    <ErrBox msg={err}/>
    {wrongType&&onRedirectToPartnerCode&&(
      <button onClick={()=>{onClose();onRedirectToPartnerCode();}} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(168,85,247,0.4)",backgroundColor:"rgba(168,85,247,0.1)",color:"#c4b5fd",fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <Users size={14}/> افتح «كود شراكة» بدلاً من هذا
      </button>
    )}
    {checking
      ?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#c4b5fd"/></div>
      :<button onClick={redeem} disabled={!code.trim()} style={{...C.purpleBtn,opacity:code.trim()?1:0.5,marginBottom:0}}><Key size={16}/> تفعيل الكود</button>
    }
  </div></div>;
}

// ─── PARTNER CODE MODAL (إضافة كود شراكة بعد التسجيل) ────
// يسمح لطالب مسجَّل مسبقاً بإضافة كود شراكة لم يدخله وقت إنشاء الحساب — عبر
// مسار سيرفر مخصص (راجع api/redeem-partner-code.js) لأن قواعد أمان Firestore
// تمنع الطالب من كتابة حقلي campaignCode/campaignBonusDays مباشرة من المتصفح
function PartnerCodeModal({onClose,student,onRedirectToCode}) {
  const [code,setCode]=useState("");
  const [checking,setChecking]=useState(false);
  const [err,setErr]=useState("");
  const [wrongType,setWrongType]=useState(false);
  const [result,setResult]=useState(null); // {bonusDays}

  const redeem=async()=>{
    const c=code.trim().toUpperCase();
    if(!c) return setErr("أدخل الكود أولاً");
    if(!student?.phone) return setErr("يجب تسجيل الدخول كطالب أولاً");
    setErr(""); setWrongType(false); setChecking(true);
    try{
      const res=await fetch("/api/redeem-partner-code",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ phone: student.phone, code: c })
      });
      let d;
      try{ d = await res.json(); }
      catch{ setErr("تعذّر الاتصال بالخادم (رمز "+res.status+")"); setChecking(false); return; }
      if(!d.ok){
        setErr(d.error||"فشل تفعيل كود الشراكة");
        if(d.wrongType==="subscription") setWrongType(true);
        setChecking(false); return;
      }
      setResult({bonusDays:d.bonusDays||0});
    }catch(e){
      setErr("حدث خطأ: "+e.message);
    }
    setChecking(false);
  };

  if(result) return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(34,197,94,0.2)",textAlign:"center"}}>
    <div style={{fontSize:"56px",marginBottom:"12px"}}>🎁</div>
    <div style={{color:"#4ade80",fontWeight:"bold",fontSize:"18px",marginBottom:"8px"}}>تم تسجيل كود الشراكة بنجاح!</div>
    <div style={{color:"#a1a1aa",fontSize:"13px",marginBottom:"16px"}}>
      {result.bonusDays>0
        ?<>ستحصل على <strong style={{color:"#fbbf24"}}>{result.bonusDays} يوم هدية</strong> تلقائياً عند تفعيل أول اشتراك لك (بكود أو دفع مباشر).</>
        :"تم تسجيل الكود بنجاح."}
    </div>
    <button onClick={onClose} style={C.primaryBtn}>إغلاق</button>
  </div></div>;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.25)"}}>
    <MHead icon={<Users size={20} color="#c4b5fd"/>} title="كود شراكة" color="#c4b5fd" onClose={onClose}/>
    <div style={{...C.infoBanner,backgroundColor:"rgba(88,28,135,0.2)",border:"1px solid rgba(168,85,247,0.35)",color:"#c4b5fd"}}>
      لو وصلك كود من صفحة أو مجموعة شريكة ولم تدخله وقت إنشاء حسابك، أدخله هنا — تحصل على أيام هدية عند تفعيل أول اشتراك لك.
    </div>
    <FirstUseTip tipKey="partner_vs_subscription_code" text="⚠️ هذا غير كود تفعيل المادة! كود الشراكة يعطيك أيام هدية بس، ما يفتح مادة لحاله. لو عندك كود لتفعيل مادة معيّنة، استخدم «لدي كود تفعيل» من حسابك بدل هذا."/>
    <label style={C.label}>كود الشراكة</label>
    <input
      value={code}
      onChange={e=>{setCode(e.target.value.toUpperCase());setErr("");setWrongType(false);}}
      onKeyDown={e=>e.key==="Enter"&&redeem()}
      placeholder="مثال: A7K9PXQ"
      maxLength={12}
      style={{...C.input,textAlign:"center",fontSize:"18px",fontWeight:"bold",letterSpacing:"3px",fontFamily:"monospace"}}
    />
    <ErrBox msg={err}/>
    {wrongType&&onRedirectToCode&&(
      <button onClick={()=>{onClose();onRedirectToCode();}} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px solid rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <Key size={14}/> افتح «تفعيل كود اشتراك» بدلاً من هذا
      </button>
    )}
    {checking
      ?<div style={{textAlign:"center",padding:"12px"}}><Spinner color="#c4b5fd"/></div>
      :<button onClick={redeem} disabled={!code.trim()} style={{...C.purpleBtn,opacity:code.trim()?1:0.5,marginBottom:0}}><Users size={16}/> تسجيل الكود</button>
    }
  </div></div>;
}

export { WalletModal, CodeModal, PartnerCodeModal };
