// ─── admin/AdminAudioTab.jsx ─────────────────────────────
// إدارة مكتبة الأناشيد/موسيقى الدراسة: رفع ملف صوتي مباشرة من الجهاز (أو
// لصق رابط مباشر)، إضافة/حذف من المكتبة الظاهرة للطالب بزر "مساعد".
import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { uploadBytesResumable, getDownloadURL, ref as storageRef } from "firebase/storage";
import { Volume2, Trash2 } from "lucide-react";
import { db, storage } from "../firebase";
import { C } from "../styles";
import { showMsg } from "../toast";
import { Spinner, ErrBox } from "../components/Shared";

function AdminAudioTab() {
  const [tracks,setTracks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [title,setTitle]=useState("");
  const [url,setUrl]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [confirmDeleteId,setConfirmDeleteId]=useState(null);
  // ─── رفع ملف صوتي مباشرة من الجهاز (بديل أسهل عن لصق رابط) ───
  const [uploading,setUploading]=useState(false);
  const [uploadPct,setUploadPct]=useState(0);
  const fileInputRef = useRef(null);
  const MAX_AUDIO_MB = 20; // حد أقصى معقول لملف نشيد/موسيقى (يتفادى رفع ملفات ضخمة بالغلط)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // يسمح باختيار نفس الملف مرة ثانية لاحقاً لو احتاج
    if(!file) return;
    setErr("");
    if(!file.type.startsWith("audio/")){ setErr("الملف المختار مو ملف صوتي — اختر MP3 أو صيغة صوت مشابهة"); return; }
    if(file.size > MAX_AUDIO_MB*1024*1024){ setErr("حجم الملف كبير جداً — الحد الأقصى "+MAX_AUDIO_MB+" ميجابايت"); return; }

    // اسم ملف فريد بالتخزين (وقت الرفع + الاسم الأصلي) لتفادي تعارض الأسماء
    const safeName = file.name.replace(/[^\w.\-]/g,"_");
    const path = "audioTracks/"+Date.now()+"_"+safeName;
    const fileRef = storageRef(storage, path);

    setUploading(true); setUploadPct(0);
    const task = uploadBytesResumable(fileRef, file);
    task.on("state_changed",
      snap=>{ setUploadPct(Math.round((snap.bytesTransferred/snap.totalBytes)*100)); },
      error=>{
        setUploading(false);
        setErr("فشل رفع الملف: "+error.message);
      },
      async()=>{
        try{
          const downloadUrl = await getDownloadURL(fileRef);
          setUrl(downloadUrl);
          // نقترح اسم تلقائي من اسم الملف لو الطالب ما كتب عنوان لسه (يقدر يعدّله)
          if(!title.trim()){ setTitle(file.name.replace(/\.[^.]+$/,"")); }
          showMsg("تم رفع الملف بنجاح — اضغط + إضافة لحفظه بالمكتبة");
        }catch(e){
          setErr("فشل الحصول على رابط الملف بعد الرفع: "+e.message);
        }
        setUploading(false);
      }
    );
  };

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"audioTracks"),
      snap=>{
        setTracks(snap.docs.map(d=>({id:d.id,...d.data()})));
        setLoading(false);
      },
      error=>{
        // لو فشل الاتصال (غالباً بسبب قواعد أمان Firestore ما تسمح بالوصول
        // لمجموعة audioTracks الجديدة)، نعرض الخطأ بوضوح بدل ما تبقى دائرة
        // التحميل معلّقة للأبد بصمت
        setErr("تعذّر تحميل الأناشيد: "+error.message);
        setLoading(false);
      }
    );
    return ()=>unsub();
  },[]);

  const addTrack=async()=>{
    setErr("");
    if(!title.trim()){ setErr("اكتب اسم النشيد أو المقطوعة"); return; }
    if(!url.trim()||!/^https?:\/\//i.test(url.trim())){ setErr("رابط الملف الصوتي غير صالح — لازم يبدأ بـ http:// أو https://"); return; }
    setSaving(true);
    try{
      await addDoc(collection(db,"audioTracks"),{title:title.trim(),url:url.trim(),createdAt:serverTimestamp()});
      setTitle(""); setUrl("");
      showMsg("تمت إضافة النشيد بنجاح");
    }catch(e){ setErr("فشل الإضافة: "+e.message); }
    setSaving(false);
  };

  const deleteTrack=async(id)=>{
    try{ await deleteDoc(doc(db,"audioTracks",id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل الحذف: "+e.message); }
    setConfirmDeleteId(null);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px"}}><Spinner/></div>;

  if(err&&tracks.length===0&&!title&&!url){
    // خطأ بمرحلة التحميل الأولي (قبل ما المستخدم يكتب أي شي بالنموذج) — نعرضه
    // بشكل واضح بدل ما يظهر جوا النموذج فقط ويسهل تفويته
    return (
      <div style={{textAlign:"center",padding:"24px"}}>
        <Volume2 size={40} color="#f87171" style={{margin:"0 auto 10px"}}/>
        <div style={{color:"#f87171",fontSize:"13px",lineHeight:"1.7"}}>{err}</div>
        <div style={{color:"#71717a",fontSize:"11px",marginTop:"8px"}}>غالباً السبب: قواعد أمان Firestore ما تسمح بالوصول لمجموعة "audioTracks" الجديدة — تأكد من إضافتها بقواعد الأمان بلوحة Firebase.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={C.infoBanner}>
        <Volume2 size={15}/> أضف روابط أناشيد أو موسيقى دراسة مباشرة (ملف MP3 برابط مباشر). تظهر للطالب داخل زر "مساعد" ليختار منها أثناء الدراسة.
        <br/>⚠️ استخدم مصادر مرخّصة فقط (مثل مكتبة يوتيوب الصوتية الرسمية — youtube.com/audiolibrary — أو مصادر Royalty-Free الأخرى)، تفادياً لأي مشكلة بحقوق النشر.
      </div>

      {/* نموذج الإضافة */}
      <div style={{backgroundColor:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"14px",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",marginBottom:"10px"}}>إضافة نشيد/موسيقى جديدة</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="اسم النشيد أو المقطوعة" style={{...C.input,marginBottom:"8px"}}/>

        {/* رفع مباشر من الجهاز — الطريقة الأسهل، يملأ خانة الرابط تلقائياً بعد الرفع */}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} style={{display:"none"}}/>
        <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
          style={{width:"100%",padding:"10px",borderRadius:"10px",border:"1px dashed rgba(56,189,248,0.4)",backgroundColor:"rgba(56,189,248,0.06)",color:"#38bdf8",fontSize:"13px",fontWeight:"bold",cursor:uploading?"default":"pointer",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
          <Volume2 size={15}/> {uploading?`جارٍ الرفع... ${uploadPct}%`:"رفع ملف صوتي من الجهاز"}
        </button>
        {uploading&&(
          <div style={{width:"100%",height:"5px",backgroundColor:"rgba(255,255,255,0.08)",borderRadius:"4px",overflow:"hidden",marginBottom:"8px"}}>
            <div style={{width:uploadPct+"%",height:"100%",backgroundColor:"#38bdf8",transition:"width 0.2s ease"}}/>
          </div>
        )}

        <div style={{fontSize:"11px",color:"#71717a",textAlign:"center",marginBottom:"8px"}}>— أو الصق رابط ملف صوتي مباشر —</div>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="رابط الملف الصوتي المباشر (MP3)" dir="ltr" style={{...C.input,marginBottom:"8px",textAlign:"left"}}/>
        <ErrBox msg={err}/>
        <button onClick={addTrack} disabled={saving||uploading} style={{width:"100%",padding:"10px",borderRadius:"10px",border:"none",backgroundColor:"#38bdf8",color:"#000",fontWeight:"bold",fontSize:"13px",cursor:(saving||uploading)?"default":"pointer",opacity:(saving||uploading)?0.6:1}}>
          {saving?"جارٍ الإضافة...":"+ إضافة"}
        </button>
      </div>

      {/* القائمة الحالية */}
      <div style={{fontSize:"13px",fontWeight:"bold",marginBottom:"8px",color:"#a1a1aa"}}>الأناشيد الحالية ({tracks.length})</div>
      {tracks.length===0?(
        <div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Volume2 size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد أناشيد مضافة بعد</div></div>
      ):tracks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:"10px",...C.card}}>
          <Volume2 size={16} color="#38bdf8" style={{flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
            <div dir="ltr" style={{fontSize:"10px",color:"#71717a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{t.url}</div>
          </div>
          {confirmDeleteId===t.id?(
            <div style={{display:"flex",gap:"4px",flexShrink:0}}>
              <button onClick={()=>deleteTrack(t.id)} style={{backgroundColor:"#ef4444",border:"none",borderRadius:"6px",padding:"5px 8px",color:"#fff",fontSize:"11px",cursor:"pointer"}}>تأكيد</button>
              <button onClick={()=>setConfirmDeleteId(null)} style={{backgroundColor:"rgba(255,255,255,0.1)",border:"none",borderRadius:"6px",padding:"5px 8px",color:"#fff",fontSize:"11px",cursor:"pointer"}}>إلغاء</button>
            </div>
          ):(
            <button onClick={()=>setConfirmDeleteId(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",flexShrink:0}}><Trash2 size={16}/></button>
          )}
        </div>
      ))}
    </div>
  );
}

export { AdminAudioTab };
