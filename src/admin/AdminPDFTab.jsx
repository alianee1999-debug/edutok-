// ─── admin/AdminPDFTab.jsx ───────────────────────────────
// إدارة ملازم PDF: التحكم بالسماح بالتحميل عمومياً، إضافة/تعديل/حذف ملف.
import React, { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, updateDoc, doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { FileText, Plus, Save } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES } from "../constants";
import { showMsg } from "../toast";
import { Spinner, ImageUploader } from "../components/Shared";

function AdminPDFTab() {
  const [pdfs,setPdfs]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [editingPdf,setEditingPdf]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [pdfName,setPdfName]=useState("");
  const [pdfSubject,setPdfSubject]=useState("الرياضيات");
  const [pdfStage,setPdfStage]=useState("الابتدائية");
  const [pdfGrade,setPdfGrade]=useState("الأول");
  const [pdfTeacher,setPdfTeacher]=useState("");
  const [pdfUrl,setPdfUrl]=useState("");
  const [pdfThumb,setPdfThumb]=useState(null);
  const [saving,setSaving]=useState(false);
  const [downloadEnabled,setDownloadEnabled]=useState(true);
  const [togglingDownload,setTogglingDownload]=useState(false);
  const [searchText,setSearchText]=useState("");

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"pdfs"),snap=>{
      setPdfs(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","pdfDownload"),snap=>{
      if(snap.exists()) setDownloadEnabled(snap.data().enabled!==false);
      else setDownloadEnabled(true);
    });
    return()=>unsub();
  },[]);

  const toggleDownload=async()=>{
    setTogglingDownload(true);
    try{
      await setDoc(doc(db,"settings","pdfDownload"),{enabled:!downloadEnabled,updatedAt:serverTimestamp()});
      setDownloadEnabled(e=>!e);
    }catch(e){showMsg("فشل: "+e.message);}
    setTogglingDownload(false);
  };

  const openEdit=(f)=>{
    setEditingPdf(f);
    setPdfName(f.name||"");
    setPdfSubject(f.subject||"الرياضيات");
    setPdfStage(f.stage||"الابتدائية");
    setPdfGrade(f.grade||(GRADES[f.stage||"الابتدائية"]||[])[0]||"الأول");
    setPdfTeacher(f.teacherName||"");
    setPdfUrl(f.url||"");
    setShowForm(true);
  };

  const doDelete=async(f)=>{
    try{ await deleteDoc(doc(db,"pdfs",f.id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل: "+e.message); }
    setConfirmDelete(null);
  };

  const savePDF=async()=>{
    if(!pdfName.trim()||!pdfUrl.trim()) return showMsg("أدخل الاسم والرابط");
    setSaving(true);
    try{
      if(editingPdf&&editingPdf.id){
        await updateDoc(doc(db,"pdfs",editingPdf.id),{name:pdfName,subject:pdfSubject,stage:pdfStage,grade:pdfGrade,teacherName:pdfTeacher.trim(),url:pdfUrl});
        showMsg("تم تعديل الملف");
      } else {
        await addDoc(collection(db,"pdfs"),{name:pdfName,subject:pdfSubject,stage:pdfStage,grade:pdfGrade,teacherName:pdfTeacher.trim(),url:pdfUrl,thumbUrl:pdfThumb,createdAt:serverTimestamp()});
        showMsg("تم حفظ الملف");
      }
      setShowForm(false);setEditingPdf(null);setPdfName("");setPdfUrl("");setPdfThumb(null);setPdfTeacher("");
    }catch(e){showMsg("فشل: "+e.message);}
    setSaving(false);
  };
  return <div>
    {/* زر تحكم التحميل */}
    <div style={{backgroundColor:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}><FileText size={16} color="#f97316"/> تحميل الملازم</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>{downloadEnabled?"مسموح — الطلاب المؤهلون يستطيعون التحميل":"موقوف — لا أحد يستطيع التحميل"}</div>
      </div>
      <button onClick={toggleDownload} disabled={togglingDownload} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:downloadEnabled?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)",color:downloadEnabled?"#f87171":"#4ade80",fontWeight:"bold",fontSize:"13px",cursor:"pointer",border:`1px solid ${downloadEnabled?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)"}`}}>
        {togglingDownload?"...":downloadEnabled?"⏸ إيقاف التحميل":"▶ السماح بالتحميل"}
      </button>
    </div>
    <div style={C.infoBanner}><FileText size={15}/> الملازم والبحوث المدفوعة — للطلاب المشتركين فقط</div>
    <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملف أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>
    {confirmDelete&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#f87171",fontWeight:"bold",marginBottom:"8px"}}>هل تريد حذف هذا الملف؟</div>
        <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
          <button onClick={()=>doDelete(confirmDelete)} style={{padding:"8px 20px",backgroundColor:"#ef4444",border:"none",borderRadius:"8px",color:"#fff",fontWeight:"bold",cursor:"pointer"}}>نعم</button>
          <button onClick={()=>setConfirmDelete(null)} style={{padding:"8px 20px",backgroundColor:"#27272a",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer"}}>لا</button>
        </div>
      </div>
    )}
    {pdfs.filter(f=>{
      if(!searchText.trim()) return true;
      const q=searchText.trim();
      return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
    }).map(f=>(
      <div key={f.id} style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
          {f.thumbUrl&&<img src={f.thumbUrl} alt="" style={{width:40,height:40,borderRadius:"8px",objectFit:"cover"}}/>}
          <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:"14px"}}>{f.name}</div><div style={{fontSize:"12px",color:"#71717a"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div></div>
          <a href={f.url} target="_blank" rel="noreferrer" style={{backgroundColor:"rgba(249,115,22,0.15)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"8px",padding:"6px 10px",color:"#f97316",fontSize:"12px",textDecoration:"none",fontWeight:"bold"}}>فتح</a>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>openEdit(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
          <button onClick={()=>setConfirmDelete(f)} style={{flex:1,padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",backgroundColor:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حذف</button>
          <button onClick={()=>updateDoc(doc(db,"pdfs",f.id),{downloadBlocked:!f.downloadBlocked})} style={{flex:1,padding:"7px",borderRadius:"8px",border:`1px solid ${f.downloadBlocked?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,backgroundColor:f.downloadBlocked?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.08)",color:f.downloadBlocked?"#4ade80":"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
            {f.downloadBlocked?"▶ تفعيل":"⏸ إيقاف"}
          </button>
        </div>
      </div>
    ))}
    {!showForm?<button style={C.gradBtn} onClick={()=>{setEditingPdf(null);setPdfName("");setPdfUrl("");setPdfGrade((GRADES[pdfStage]||[])[0]||"الأول");setPdfTeacher("");setShowForm(true);}}><Plus size={18}/> إضافة ملف PDF جديد</button>
    :<div style={{...C.card,border:"1px solid rgba(249,115,22,0.2)"}}>
      <div style={{color:"#f97316",fontWeight:"bold",fontSize:"14px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"6px"}}><FileText size={16}/> بيانات الملف الجديد</div>
      <label style={C.label}>اسم الملف</label>
      <input type="text" value={pdfName} onChange={e=>setPdfName(e.target.value)} placeholder="مثال: ملزمة الرياضيات الفصل الأول" style={C.input}/>
      <div style={C.twoCol}>
        <div><label style={C.label}>المادة</label><select value={pdfSubject} onChange={e=>setPdfSubject(e.target.value)} style={C.select}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={C.label}>المرحلة</label><select value={pdfStage} onChange={e=>{const s=e.target.value;setPdfStage(s);setPdfGrade((GRADES[s]||[])[0]||"الأول");}} style={C.select}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <label style={C.label}>الصف</label>
      <select value={pdfGrade} onChange={e=>setPdfGrade(e.target.value)} style={C.select}>{(GRADES[pdfStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
      <label style={C.label}> اسم الأستاذ (اختياري)</label>
      <input type="text" value={pdfTeacher} onChange={e=>setPdfTeacher(e.target.value)} placeholder="مثال: أ. محمد" style={C.input}/>
      <label style={C.label}> رابط PDF (Google Drive)</label>
      <input type="url" value={pdfUrl} onChange={e=>setPdfUrl(e.target.value)} placeholder="https://drive.google.com/file/..." style={C.input}/>
      <label style={C.label}> صورة مصغرة (اختياري)</label>
      <ImageUploader onUpload={url=>setPdfThumb(url)} onBase64={()=>{}} color="#f97316" label="اختر صورة للملف"/>
      <div style={C.saveRow}>
        <button style={C.cancelBtn} onClick={()=>{setShowForm(false);setEditingPdf(null);}}>إلغاء</button>
        <button disabled={saving} style={{...C.saveBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",opacity:saving?0.7:1}} onClick={savePDF}>
          {saving?<><Spinner size={15}/> جارٍ...</>:<><Save size={15}/> حفظ</>}
        </button>
      </div>
    </div>}
  </div>;
}

export { AdminPDFTab };
