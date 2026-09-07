// ─── modals/PDFModal.jsx ─────────────────────────────────
// ملازم وبحوث PDF — عرض حسب المرحلة/الصف، مع التحقق من الاشتراك والسماح
// بالتحميل من عدمه (يشمل نسخة كاملة بلا قيود للمدير).
import React, { useState, useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { FileText } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { isFreeSubject, hasAccess } from "../helpers";
import { showMsg } from "../toast";
import { Spinner, MHead } from "../components/Shared";

function PDFModal({onClose, studentStage, studentGrade, globalPrices, mySubscriptions, onWallet, isAdmin}) {
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [downloadEnabled,setDownloadEnabled]=useState(true);
  const [searchText,setSearchText]=useState("");

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"pdfs"),snap=>{setFiles(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(doc(db,"settings","pdfDownload"),snap=>{
      if(snap.exists()) setDownloadEnabled(snap.data().enabled!==false);
      else setDownloadEnabled(true);
    });
    return ()=>{ u1(); u2(); };
  },[]);

  const goToWallet = () => { onWallet && onWallet(); };

  // المدير يرى كل شيء بدون قيود
  if(isAdmin){
    const adminFiltered = files.filter(f=>{
      if(!searchText.trim()) return true;
      const q=searchText.trim();
      return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
    });
    return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    {files.length>0&&<input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملف أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :adminFiltered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>{files.length===0?"لا توجد ملفات بعد":"لا توجد نتائج"}</div></div>
      :adminFiltered.map(f=>(
        <div key={f.id} style={{...C.card}}>
          <div style={{marginBottom:"8px"}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <a href={f.url} target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>قراءة 👁</a>
            <a href={f.url} download target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(249,115,22,0.3)",backgroundColor:"rgba(249,115,22,0.15)",color:"#f97316",fontSize:"12px",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>تحميل ⬇</a>
          </div>
        </div>
      ))
    }
  </div></div>;
  }

  // الطالب: التحقق من السعر والاشتراك
  const pdfFree = isFreeSubject(globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  const pdfSubscribed = hasAccess(mySubscriptions, globalPrices,"ملازم PDF", studentStage||"الابتدائية");
  // يمكن القراءة: مجاني أو مشترك
  const canRead = pdfFree || pdfSubscribed;
  // يمكن التحميل: يمكن القراءة + التحميل مسموح من الإدارة
  const canDownload = canRead && downloadEnabled;
  const myFiles = files.filter(f=>{
    if(f.stage && f.stage!==studentStage) return false;
    if(f.grade && studentGrade && f.grade!==studentGrade) return false;
    return true;
  });
  const myFilesFiltered = myFiles.filter(f=>{
    if(!searchText.trim()) return true;
    const q=searchText.trim();
    return f.name?.includes(q)||f.subject?.includes(q)||f.teacherName?.includes(q);
  });

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(249,115,22,0.2)"}}>
    <MHead icon={<FileText size={20} color="#f97316"/>} title="ملازم وبحوث" color="#f97316" onClose={onClose}/>
    <div style={{fontSize:"12px",color:"#a1a1aa",marginBottom:"10px",textAlign:"center"}}>
      المرحلة: <strong style={{color:"#f97316"}}>{studentStage}</strong>
    </div>

    {myFiles.length>1&&<input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="ابحث باسم الملزمة أو المادة أو الأستاذ..." style={{...C.input,marginBottom:"10px"}}/>}

    {/* غير مؤهل للقراءة */}
    {!canRead&&(
      <div style={{backgroundColor:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
        <div style={{color:"#fbbf24",fontWeight:"bold",fontSize:"14px",marginBottom:"4px"}}>محتوى مدفوع</div>
        <div style={{color:"#71717a",fontSize:"12px",marginBottom:"10px"}}>اشترك للوصول لملازم {studentStage}</div>
        <button onClick={goToWallet} style={{backgroundColor:"#f97316",border:"none",borderRadius:"10px",padding:"8px 20px",color:"#fff",fontSize:"13px",fontWeight:"bold",cursor:"pointer"}}>اشترك الآن عبر زين كاش</button>
      </div>
    )}

    {/* التحميل موقوف من الإدارة */}
    {canRead&&!downloadEnabled&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#f87171",textAlign:"center"}}>
        🔒 التحميل موقوف مؤقتاً من قبل المدير
      </div>
    )}

    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#f97316"/></div>
    :myFilesFiltered.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><FileText size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>{myFiles.length===0?"لا توجد ملازم لمرحلتك بعد":"لا توجد نتائج مطابقة للبحث"}</div></div>
      :myFilesFiltered.map(f=>(
        <div key={f.id} style={{...C.card}}>
          <div style={{marginBottom:"8px"}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{f.name}</div>
            <div style={{fontSize:"11px",color:"#71717a",marginTop:"2px"}}>{f.subject} • {f.stage}{f.grade?" • الصف "+f.grade:""}{f.teacherName?" • "+f.teacherName:""}</div>
          </div>
          {!canRead
            // غير مؤهل → اشترك
            ?<button onClick={goToWallet} style={{width:"100%",padding:"8px",borderRadius:"8px",border:"1px solid rgba(234,179,8,0.3)",backgroundColor:"rgba(234,179,8,0.1)",color:"#fbbf24",fontSize:"12px",cursor:"pointer",fontWeight:"bold"}}>اشترك للوصول</button>
            :<div style={{display:"flex",gap:"8px"}}>
              {/* زر القراءة مع العلامة المائية */}
              <a href={f.url} target="_blank" rel="noreferrer" onClick={()=>{
                if(f.watermark){showMsg("💧 هذه الملزمة محمية بعلامة مائية");}
              }} style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.3)",backgroundColor:"rgba(56,189,248,0.1)",color:"#38bdf8",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>
                قراءة 👁{f.watermark?" 💧":""}
              </a>
              {/* زر التحميل — حسب الإعداد العام + إعداد الملف */}
              {canDownload && !f.downloadBlocked
                ?<a href={f.url} download target="_blank" rel="noreferrer" style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(249,115,22,0.3)",backgroundColor:"rgba(249,115,22,0.15)",color:"#f97316",fontSize:"12px",cursor:"pointer",fontWeight:"bold",textDecoration:"none",textAlign:"center"}}>تحميل ⬇</a>
                :<span style={{flex:1,padding:"8px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.08)",backgroundColor:"rgba(255,255,255,0.04)",color:"#52525b",fontSize:"12px",textAlign:"center"}}>موقوف 🔒</span>
              }
            </div>
          }
        </div>
      ))
    }
  </div></div>;
}

export { PDFModal };
