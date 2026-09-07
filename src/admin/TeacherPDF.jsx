// ─── admin/TeacherPDF.jsx ────────────────────────────────
// طلبات رفع الملازم من الأساتذة (مراجعة المدير: موافقة/رفض/حذف)، ونموذج
// رفع ملزمة جديدة (يستخدمه الأستاذ نفسه، بانتظار موافقة الإدارة).
import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { BookOpen, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES } from "../constants";
import { showMsg } from "../toast";
import { Spinner, MHead } from "../components/Shared";

function TeacherPDFRequests() {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const unsub=onSnapshot(
      query(collection(db,"teacherPdfs"),orderBy("createdAt","desc")),
      snap=>{setRequests(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);}
    );
    return()=>unsub();
  },[]);

  const approve=async(req)=>{
    try{
      await addDoc(collection(db,"pdfs"),{
        name:req.name,subject:req.subject,stage:req.stage,grade:req.grade||"",
        url:req.url,watermark:req.watermark||"",teacherName:req.teacherName,
        uploadedBy:req.phone,approvedAt:serverTimestamp(),
      });
      await updateDoc(doc(db,"teacherPdfs",req.id),{status:"approved",approvedAt:serverTimestamp()});
      showMsg("✅ تمت الموافقة ونُشرت الملزمة");
    }catch(e){showMsg("فشل: "+e.message);}
  };

  const reject=async(req)=>{
    try{
      await updateDoc(doc(db,"teacherPdfs",req.id),{status:"rejected",rejectedAt:serverTimestamp()});
      // لو كانت الملزمة منشورة فعلاً (موافق عليها سابقاً)، نسحبها من القائمة المنشورة للطلاب
      if(req.status==="approved"){
        const snap=await getDocs(query(collection(db,"pdfs"),where("url","==",req.url)));
        for(const d of snap.docs){ await deleteDoc(doc(db,"pdfs",d.id)); }
      }
      showMsg("تم الرفض");
    }catch(e){showMsg("فشل: "+e.message);}
  };

  const deleteRequest=async(req)=>{
    try{
      await deleteDoc(doc(db,"teacherPdfs",req.id));
      showMsg("تم حذف الطلب");
    }catch(e){showMsg("فشل الحذف: "+e.message);}
  };

  const statusColor={"pending":"#fbbf24","approved":"#4ade80","rejected":"#f87171"};
  const statusLabel={"pending":"⏳ بانتظار المراجعة","approved":"✅ تمت الموافقة","rejected":"❌ مرفوض"};

  return <div>
    <div style={{...C.infoBanner,marginBottom:"14px"}}><BookOpen size={15}/> طلبات رفع الملازم من الأساتذة</div>
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :requests.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><BookOpen size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد طلبات بعد</div></div>
      :requests.map(r=>(
        <div key={r.id} style={{...C.card,border:`1px solid ${r.status==="pending"?"rgba(251,191,36,0.3)":r.status==="approved"?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`,marginBottom:"10px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
            <div>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{r.name}</div>
              <div style={{fontSize:"12px",color:"#71717a",marginTop:"2px"}}>{r.teacherName} • {r.subject} • {r.stage}{r.grade?" • الصف "+r.grade:""}</div>
            </div>
            <span style={{fontSize:"11px",fontWeight:"bold",color:statusColor[r.status]||"#fbbf24"}}>{statusLabel[r.status]||"⏳"}</span>
          </div>
          {r.watermark&&<div style={{fontSize:"11px",color:"#a855f7",marginBottom:"8px"}}>💧 علامة مائية: "{r.watermark}"</div>}
          <div style={{display:"flex",gap:"8px"}}>
            <a href={r.url} target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",background:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>معاينة 👁</a>
            {r.status!=="approved"&&<button onClick={()=>approve(r)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.1)",color:"#4ade80",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>موافقة ✅</button>}
            {r.status!=="rejected"&&<button onClick={()=>reject(r)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(248,113,113,0.3)",background:"rgba(248,113,113,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>رفض ❌</button>}
            <button onClick={()=>deleteRequest(r)} style={{padding:"8px 10px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#a1a1aa",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}><Trash2 size={13}/></button>
          </div>
        </div>
      ))
    }
  </div>;
}

// ─── نموذج رفع ملزمة (للأستاذ) ──────────────────────────
function UploadPDFModal({onClose, currentStudent}) {
  const [name,setName]=useState("");
  const [subject,setSubject]=useState("الرياضيات");
  const [stage,setStage]=useState("الابتدائية");
  const [grade,setGrade]=useState("الأول");
  const [url,setUrl]=useState("");
  const [watermark,setWatermark]=useState("");
  const [useWatermark,setUseWatermark]=useState(false);
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);

  const submit=async()=>{
    if(!name.trim()) return showMsg("أدخل اسم الملزمة");
    if(!url.trim()) return showMsg("أدخل رابط الملزمة");
    setSaving(true);
    try{
      await addDoc(collection(db,"teacherPdfs"),{
        name:name.trim(),subject,stage,grade,
        url:url.trim(),
        watermark:useWatermark?watermark.trim():"",
        teacherName:currentStudent?.name||"أستاذ",
        phone:currentStudent?.phone||"",
        status:"pending",
        createdAt:serverTimestamp(),
      });
      setDone(true);
    }catch(e){showMsg("فشل: "+e.message);}
    setSaving(false);
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.3)"}}>
    <MHead icon={<BookOpen size={20} color="#f97316"/>} title="رفع ملزمة" color="#f97316" onClose={onClose}/>

    {done?<div style={{textAlign:"center",padding:"24px"}}>
      <div style={{fontSize:"48px",marginBottom:"12px"}}>✅</div>
      <div style={{fontWeight:"bold",fontSize:"16px",color:"#4ade80",marginBottom:"8px"}}>تم إرسال الطلب!</div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"20px"}}>سيراجع المدير ملزمتك ويوافق عليها قريباً</div>
      <button onClick={onClose} style={{...C.primaryBtn,marginBottom:0}}>حسناً</button>
    </div>:<>
      <div style={{backgroundColor:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:"12px",padding:"10px 14px",marginBottom:"14px",fontSize:"12px",color:"#f97316"}}>
        📋 ستُنشر الملزمة للطلاب بعد مراجعة وموافقة المدير
      </div>

      <label style={C.label}>اسم الملزمة</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: ملزمة الكيمياء للسادس العلمي" style={C.input}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
        <div>
          <label style={C.label}>المادة</label>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={C.label}>المرحلة</label>
          <select value={stage} onChange={e=>{setStage(e.target.value);setGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={C.select}>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <label style={C.label}>الصف</label>
      <select value={grade} onChange={e=>setGrade(e.target.value)} style={{...C.select,marginBottom:"12px"}}>
        {(GRADES[stage]||[]).map(g=><option key={g}>{g}</option>)}
      </select>

      <label style={C.label}>رابط الملزمة (PDF)</label>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={C.input} dir="ltr"/>

      {/* العلامة المائية */}
      <div style={{backgroundColor:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"12px",padding:"12px",marginBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:useWatermark?"10px":"0"}}>
          <div>
            <div style={{fontWeight:"bold",fontSize:"13px",display:"flex",alignItems:"center",gap:"6px"}}>💧 علامة مائية</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>اسمك يظهر شفافاً على كل صفحة</div>
          </div>
          <button onClick={()=>setUseWatermark(w=>!w)} style={{padding:"6px 14px",borderRadius:"8px",border:`1px solid ${useWatermark?"rgba(168,85,247,0.4)":"rgba(255,255,255,0.1)"}`,background:useWatermark?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.03)",color:useWatermark?"#a855f7":"#71717a",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
            {useWatermark?"مفعّلة ✓":"تفعيل"}
          </button>
        </div>
        {useWatermark&&<input value={watermark} onChange={e=>setWatermark(e.target.value)} placeholder={`مثال: ${currentStudent?.name||"اسم الأستاذ"}`} style={C.input}/>}
      </div>

      <button onClick={submit} disabled={saving} style={{...C.primaryBtn,background:"linear-gradient(to left,#f97316,#fb923c)",marginBottom:0,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={16}/> جارٍ الإرسال...</>:<><BookOpen size={16}/> إرسال الطلب للمدير</>}
      </button>
    </>}
  </div></div>;
}

export { TeacherPDFRequests, UploadPDFModal };
