// ─── admin/SlidesStudio.jsx ──────────────────────────────
// استوديو الشرائح الذكي: توليد شرائح بالذكاء الاصطناعي (من صورة أو موضوع
// نصي)، استيراد JSON (مقطع واحد أو دفعة)، ومعاينة/حفظ النتيجة بـFirestore.
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Sparkles, Camera, BookOpen, FileText, Layers, Save, HelpCircle, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES, THEMES, THEME_STYLES } from "../constants";
import { callAI } from "../ai";
import { showMsg } from "../toast";
import { Spinner, MathText } from "../components/Shared";

function SlidesStudio({slidesTheme,setSlidesTheme,onSaveClip,clips}) {
  // يحسب رقم المقطع التالي واسم الفصل المقترح تلقائياً، بناءً على آخر مقطع محفوظ بنفس المادة/المرحلة/الصف
  const getAutoFill=(subject,stage,grade)=>{
    const matches=(clips||[]).filter(c=>c.subject===subject && c.stage===stage && (!grade||c.grade===grade));
    if(matches.length===0) return {nextNum:1,topic:""};
    let maxNum=0, topicOfMax="";
    matches.forEach(c=>{
      const n=Number(c.num||0);
      if(n>=maxNum){ maxNum=n; topicOfMax=c.topic||topicOfMax; }
    });
    return {nextNum:maxNum+1, topic:topicOfMax};
  };
  const [mode,setMode]=useState("menu");
  const [topic,setTopic]=useState("");
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [slidesCount,setCount]=useState(6);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [slides,setSlides]=useState([]);
  const [curSlide,setCurSlide]=useState(0);
  // ─── سؤال الشريحة (اختياري) — يضيفه المدير يدوياً أو بمساعدة الذكاء
  // الاصطناعي، ويظهر للطالب كرمز ❓ عائم فوق هذه الشريحة تحديداً فقط ───
  const [showQEditor,setShowQEditor]=useState(false);
  const [qDraft,setQDraft]=useState({q:"",options:["","","",""],correctIndex:0});
  const [qGenLoading,setQGenLoading]=useState(false);
  useEffect(()=>{ setShowQEditor(false); },[curSlide]); // نغلق محرر السؤال عند الانتقال لشريحة ثانية
  const openAddQuestion=()=>{ setQDraft({q:"",options:["","","",""],correctIndex:0}); setShowQEditor(true); };
  const openEditQuestion=()=>{
    const cur=slides[curSlide]?.question;
    setQDraft(cur?{q:cur.q||"",options:(cur.options&&cur.options.length===4)?[...cur.options]:["","","",""],correctIndex:cur.correctIndex||0}:{q:"",options:["","","",""],correctIndex:0});
    setShowQEditor(true);
  };
  const saveQuestion=()=>{
    if(!qDraft.q.trim()) return showMsg("أدخل نص السؤال");
    if(qDraft.options.some(o=>!o.trim())) return showMsg("عبّئ كل الخيارات الأربعة");
    setSlides(prev=>{
      const next=[...prev];
      next[curSlide]={...next[curSlide],question:{q:qDraft.q.trim(),options:qDraft.options.map(o=>o.trim()),correctIndex:qDraft.correctIndex}};
      return next;
    });
    setShowQEditor(false);
  };
  const removeQuestion=()=>{
    setSlides(prev=>{
      const next=[...prev];
      const {question,...rest}=next[curSlide]||{};
      next[curSlide]=rest;
      return next;
    });
  };
  const generateQuestionAI=async()=>{
    const cur=slides[curSlide];
    if(!cur) return;
    setQGenLoading(true);
    try{
      const prompt='بناءً على محتوى هذه الشريحة التعليمية — العنوان: "'+(cur.title||"")+'" والنقاط: '+JSON.stringify(cur.points||[])+' — أنشئ سؤال اختيار من متعدد سريع لاختبار فهم الطالب لهذه الشريحة تحديداً. أجب بـ JSON فقط بلا أي نص خارجه بهذا الشكل: {"q":"نص السؤال","options":["خيار 1","خيار 2","خيار 3","خيار 4"],"correctIndex":0}. رقم correctIndex هو فهرس الإجابة الصحيحة بالمصفوفة (يبدأ من 0).';
      const raw=await callAI(prompt);
      const clean=raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const start=clean.indexOf("{");
      const end=clean.lastIndexOf("}");
      const fixed=clean.substring(start,end+1).replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      const parsed=JSON.parse(fixed);
      if(!parsed.q||!Array.isArray(parsed.options)||parsed.options.length!==4) throw new Error("رد غير صالح");
      setQDraft({q:parsed.q,options:parsed.options,correctIndex:Number(parsed.correctIndex)||0});
      setShowQEditor(true);
    }catch(e){
      showMsg("تعذّر توليد السؤال: "+e.message+". جرّب الكتابة اليدوية.");
    }
    setQGenLoading(false);
  };
  const [clipTitle,setClipTitle]=useState("");
  const [clipSubj,setClipSubj]=useState("الرياضيات");
  const [clipStage,setClipStage]=useState("الابتدائية");
  const [clipGrade,setClipGrade]=useState("الأول");
  const [clipTopic,setClipTopic]=useState("");
  const [clipNum,setClipNum]=useState(1);
  const [saving,setSaving]=useState(false);
  // تعبئة تلقائية للفصل ورقم المقطع كلما تغيّرت المادة/المرحلة/الصف (تبقى قابلة للتعديل يدوياً)
  useEffect(()=>{
    const auto=getAutoFill(clipSubj,clipStage,clipGrade);
    setClipTopic(auto.topic);
    setClipNum(auto.nextNum);
  },[clipSubj,clipStage,clipGrade]);
  // ─── JSON Import ───
  const [jsonText,setJsonText]=useState("");
  const [jsonErr,setJsonErr]=useState("");
  const JSONSUFFIX=' أجب بـ JSON فقط بلا أي نص خارجه: {"title":"العنوان","slides":[{"title":"عنوان الشريحة","points":["نقطة 1","نقطة 2","نقطة 3"]}]}. مهم: أي رمز \\ داخل معادلات LaTeX (مثل \\omega أو \\frac) يجب كتابته مضاعفاً \\\\ داخل نصوص JSON وإلا يصبح الرد غير صالح.';

  const generate=async(fromImage)=>{
    setLoading(true);
    setLoadMsg(fromImage?" Gemini يقرأ الورقة...":" Gemini يبني الشرائح...");
    try{
      let raw;
      if(fromImage){
        if(!imgB64){showMsg("يرجى رفع صورة أولاً");setLoading(false);return;}
        raw=await callAI("اقرأ هذه الورقة الدراسية وحوّل محتواها إلى "+slidesCount+" شرائح تعليمية."+JSONSUFFIX,imgB64);
      }else{
        if(!topic.trim()){showMsg("يرجى إدخال الموضوع");setLoading(false);return;}
        raw=await callAI("أنشئ "+slidesCount+" شرائح تعليمية احترافية عن الموضوع التالي: "+topic+". اجعل كل شريحة تحتوي على 3-4 نقاط مفيدة وواضحة."+JSONSUFFIX);
      }
      const clean=raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const start=clean.indexOf("{");
      const end=clean.lastIndexOf("}");
      // نصلح أي "\" وحيدة غير صحيحة (رموز LaTeX مثل \omega) بدون كسر تسلسلات الهروب الصحيحة أصلاً مثل \\ أو \n
      const fixed=clean.substring(start,end+1).replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      const parsed=JSON.parse(fixed);
      setSlides(parsed.slides||[]);
      setClipTitle(parsed.title||(fromImage?"شرائح من ورقة":topic));
      setCurSlide(0);
      setMode("result");
    }catch(e){
      showMsg("حدث خطأ: "+e.message+". حاول مرة أخرى.");
    }
    setLoading(false);
  };

  const saveToFirestore=async()=>{
    if(!clipTitle.trim()) return showMsg("أدخل عنوان المقطع");
    setSaving(true);
    try{
      await addDoc(collection(db,"clips"),{title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,topic:clipTopic,num:Number(clipNum)||1,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)",createdAt:serverTimestamp()});
      onSaveClip({title:clipTitle,subject:clipSubj,stage:clipStage,grade:clipGrade,topic:clipTopic,num:Number(clipNum)||1,slides,theme:slidesTheme,type:"شرائح AI",bg:"linear-gradient(135deg,#1e1b4b,#312e81)"});
      showMsg(" تم حفظ الشرائح في Firebase!");
      setMode("menu");
    }catch(e){showMsg("فشل الحفظ: "+e.message);}
    setSaving(false);
  };

  const importFromJSON=()=>{
    setJsonErr("");
    if(!jsonText.trim()) return setJsonErr("الصق كود JSON أولاً");
    try{
      const clean0=jsonText.replace(/```json/g,"").replace(/```/g,"").trim();
      // نصلح أي "\" وحيدة غير صحيحة بدون كسر تسلسلات الهروب الصحيحة أصلاً مثل \\ أو \n
      const clean=clean0.replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      // تحقق: هل هو مصفوفة (استيراد جماعي) أم مقطع واحد؟
      const firstChar=clean[0];
      if(firstChar==="["){
        // ─── استيراد جماعي ───
        const arr=JSON.parse(clean);
        if(!Array.isArray(arr)||arr.length===0) throw new Error("المصفوفة فارغة");
        arr.forEach((item,i)=>{
          if(!item.slides||!Array.isArray(item.slides)||item.slides.length===0)
            throw new Error("المقطع "+(i+1)+" لا يحتوي على شرائح");
          item.slides.forEach((s,j)=>{
            if(!s.title) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها عنوان");
            if(!Array.isArray(s.points)) throw new Error("المقطع "+(i+1)+" - الشريحة "+(j+1)+" ليس فيها نقاط");
          });
        });
        setBulkClips(arr);
        setJsonText("");
        setMode("bulk");
      } else {
        // ─── مقطع واحد ───
        const start=clean.indexOf("{");
        const end=clean.lastIndexOf("}");
        if(start===-1||end===-1) throw new Error("تنسيق JSON غير صحيح");
        const parsed=JSON.parse(clean.substring(start,end+1));
        if(!parsed.slides||!Array.isArray(parsed.slides)||parsed.slides.length===0)
          throw new Error("الـ JSON لا يحتوي على شرائح");
        parsed.slides.forEach((s,i)=>{
          if(!s.title) throw new Error("الشريحة "+(i+1)+" ليس فيها عنوان");
          if(!Array.isArray(s.points)) throw new Error("الشريحة "+(i+1)+" ليس فيها نقاط");
        });
        setSlides(parsed.slides);
        setClipTitle(parsed.title||"شرائح مستوردة");
        setCurSlide(0);
        setJsonText("");
        setMode("result");
      }
    }catch(e){
      setJsonErr("خطأ: "+e.message);
    }
  };

  // ─── حفظ جماعي ───────────────────────────────────────────
  const [bulkClips,setBulkClips]=useState([]);
  const [bulkSubj,setBulkSubj]=useState("الرياضيات");
  const [bulkStage,setBulkStage]=useState("الابتدائية");
  const [bulkGrade,setBulkGrade]=useState("الأول");
  const [bulkTopic,setBulkTopic]=useState("");
  const [bulkStartNum,setBulkStartNum]=useState(1);
  const [bulkSaving,setBulkSaving]=useState(false);
  const [bulkProgress,setBulkProgress]=useState(0);
  // تعبئة تلقائية للفصل ورقم بداية المقاطع كلما تغيّرت المادة/المرحلة/الصف (تبقى قابلة للتعديل يدوياً)
  useEffect(()=>{
    const auto=getAutoFill(bulkSubj,bulkStage,bulkGrade);
    setBulkTopic(auto.topic);
    setBulkStartNum(auto.nextNum);
  },[bulkSubj,bulkStage,bulkGrade]);

  const saveBulk=async()=>{
    if(!bulkClips.length) return;
    setBulkSaving(true);
    setBulkProgress(0);
    try{
      for(let i=0;i<bulkClips.length;i++){
        const c=bulkClips[i];
        await addDoc(collection(db,"clips"),{
          title:c.title||"مقطع "+(i+1),
          subject:bulkSubj,
          stage:bulkStage,
          grade:bulkGrade,
          topic:bulkTopic,
          slides:c.slides,
          theme:slidesTheme,
          type:"شرائح AI",
          bg:"linear-gradient(135deg,#1e1b4b,#312e81)",
          num:Number(bulkStartNum)+i,
          createdAt:serverTimestamp()
        });
        setBulkProgress(i+1);
      }
      onSaveClip({title:"جماعي"});
      showMsg("✅ تم حفظ "+bulkClips.length+" مقطع بنجاح!");
      setBulkClips([]);
      setMode("menu");
    }catch(e){
      showMsg("فشل الحفظ: "+e.message);
    }
    setBulkSaving(false);
  };

  const ts=THEME_STYLES[slidesTheme]||THEME_STYLES["أزرق متدرج"];
  const countBtns=<div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>{[4,6,8,10,12].map(n=><button key={n} onClick={()=>setCount(n)} style={{flex:1,padding:"9px",borderRadius:"10px",border:"none",backgroundColor:slidesCount===n?"#7c3aed":"#27272a",color:slidesCount===n?"#fff":"#a1a1aa",fontWeight:"bold",fontSize:"13px",cursor:"pointer"}}>{n}</button>)}</div>;
  const back=<button onClick={()=>setMode("menu")} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"13px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"4px"}}>← رجوع</button>;

  if(mode==="menu") return <div>
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"16px",padding:"24px",textAlign:"center",marginBottom:"16px"}}>
      <Sparkles size={36} color="#c4b5fd" style={{margin:"0 auto 8px"}}/>
      <div style={{fontSize:"18px",fontWeight:"bold",color:"#c4b5fd",marginBottom:"4px"}}>استوديو الشرائح الذكي</div>
      <div style={{fontSize:"13px",color:"#8b8ba0"}}>مدعوم بـ Google Gemini AI</div>
    </div>
    <div style={{...C.twoCol,marginBottom:"10px"}}>
      <div onClick={()=>setMode("image")} style={{backgroundColor:"rgba(88,28,135,0.25)",border:"1px solid rgba(139,92,246,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <Camera size={32} color="#a855f7" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#c4b5fd"}}>صوّر ورقة الكتاب</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يقرأها ويحوّلها</div>
      </div>
      <div onClick={()=>setMode("text")} style={{backgroundColor:"rgba(3,105,161,0.25)",border:"1px solid rgba(56,189,248,0.35)",borderRadius:"16px",padding:"20px 14px",textAlign:"center",cursor:"pointer"}}>
        <BookOpen size={32} color="#38bdf8" style={{margin:"0 auto 8px"}}/>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8"}}>كتابة موضوع</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"4px"}}>Gemini يبني الشرائح</div>
      </div>
    </div>
    {/* ─── خيار استيراد JSON ─── */}
    <div onClick={()=>{setJsonText("");setJsonErr("");setMode("json");}} style={{backgroundColor:"rgba(20,83,45,0.25)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:"16px",padding:"16px 14px",textAlign:"center",cursor:"pointer",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px"}}>
      <FileText size={28} color="#4ade80" style={{flexShrink:0}}/>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#4ade80"}}>استيراد شرائح JSON</div>
        <div style={{fontSize:"11px",color:"#71717a",marginTop:"3px"}}>الصق JSON جاهز من Claude مباشرة</div>
      </div>
    </div>
    <div style={{fontSize:"13px",color:"#38bdf8",fontWeight:"bold",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"}}><Layers size={14}/> الثيم</div>
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
      {THEMES.map(t=><button key={t.label} onClick={()=>setSlidesTheme(t.label)} style={{padding:"8px 14px",borderRadius:"10px",border:slidesTheme===t.label?"2px solid #38bdf8":"none",backgroundColor:t.color,color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>{t.label}</button>)}
    </div>
  </div>;

  if(mode==="json") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><FileText size={18} color="#4ade80"/> استيراد شرائح JSON</div>
    <div style={{backgroundColor:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#4ade80"}}>
      الصق JSON مقطع واحد <strong style={{color:"#fff"}}>{"{ }"}</strong> أو عدة مقاطع دفعة واحدة <strong style={{color:"#fff"}}>{"[ ]"}</strong>
    </div>
    <textarea
      rows={10}
      value={jsonText}
      onChange={e=>{setJsonText(e.target.value);setJsonErr("");}}
      placeholder={'مقطع واحد: {"title":"...","slides":[...]}\nعدة مقاطع: [{"title":"...","slides":[...]},{"title":"...","slides":[...]}]'}
      style={{...C.input,resize:"none",fontFamily:"monospace",fontSize:"12px",direction:"ltr",textAlign:"left"}}
    />
    {jsonErr&&<div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"10px",padding:"10px",fontSize:"13px",color:"#f87171",marginBottom:"10px"}}>⚠ {jsonErr}</div>}
    <button onClick={importFromJSON} disabled={!jsonText.trim()} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:jsonText.trim()?1:0.5,marginBottom:0}}>
      <FileText size={16}/> استيراد الشرائح
    </button>
  </div>;

  if(mode==="bulk") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
      <Layers size={18} color="#4ade80"/> استيراد جماعي — {bulkClips.length} مقطع
    </div>
    {/* قائمة المقاطع */}
    <div style={{marginBottom:"14px"}}>
      {bulkClips.map((c,i)=>(
        <div key={i} style={{...C.card,display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"bold",color:"#4ade80",flexShrink:0}}>{Number(bulkStartNum)+i}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"13px",fontWeight:"bold"}}>{c.title||"مقطع "+(i+1)}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{c.slides?.length||0} شرائح</div>
          </div>
        </div>
      ))}
    </div>
    {/* إعدادات مشتركة */}
    <div style={{...C.card,border:"1px solid rgba(34,197,94,0.2)",marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",fontWeight:"bold",marginBottom:"10px"}}>إعدادات مشتركة لكل المقاطع</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
        <select value={bulkSubj} onChange={e=>setBulkSubj(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {SUBJECTS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={bulkStage} onChange={e=>{setBulkStage(e.target.value);setBulkGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:"8px"}}>
        <select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}>
          {(GRADES[bulkStage]||[]).map(g=><option key={g}>{g}</option>)}
        </select>
      </div>
      <div style={{fontSize:"10px",color:"#71717a",margin:"8px 0 6px"}}>الفصل ورقم بداية المقاطع مُعبّآن تلقائياً حسب آخر مقطع محفوظ بنفس المادة/المرحلة/الصف — تقدر تعدّلهما يدوياً:</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
        <input value={bulkTopic} onChange={e=>setBulkTopic(e.target.value)} placeholder="الفصل" style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
        <input type="number" value={bulkStartNum} onChange={e=>setBulkStartNum(e.target.value)} placeholder="رقم أول مقطع" style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
      </div>
    </div>
    {/* شريط التقدم */}
    {bulkSaving&&<div style={{marginBottom:"12px"}}>
      <div style={{fontSize:"12px",color:"#4ade80",marginBottom:"6px",textAlign:"center"}}>جارٍ الحفظ... {bulkProgress} / {bulkClips.length}</div>
      <div style={{height:"6px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",overflow:"hidden"}}>
        <div style={{height:"100%",background:"linear-gradient(to right,#059669,#4ade80)",width:(bulkProgress/bulkClips.length*100)+"%",transition:"width 0.3s"}}/>
      </div>
    </div>}
    <button onClick={saveBulk} disabled={bulkSaving} style={{...C.primaryBtn,background:"linear-gradient(to right,#059669,#4ade80)",opacity:bulkSaving?0.6:1,marginBottom:0}}>
      {bulkSaving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Layers size={16}/> حفظ {bulkClips.length} مقطع دفعة واحدة</>}
    </button>
  </div>;



  if(mode==="image") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><Camera size={18} color="#a855f7"/> صوّر ورقة الكتاب</div>
    <div style={{backgroundColor:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"12px",padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:"#c4b5fd"}}>
       صوّر صفحة الكتاب أو الورقة — Groq سيقرأها ويحوّلها لشرائح تعليمية
    </div>
    <div style={{marginBottom:"12px"}}>
      {imgPreview&&<img src={imgPreview} alt="معاينة" style={{width:"100%",maxHeight:"200px",objectFit:"contain",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.1)"}}/>}
      <label style={{display:"block",width:"100%",padding:"14px",backgroundColor:"rgba(139,92,246,0.08)",border:"2px dashed rgba(139,92,246,0.35)",borderRadius:"14px",textAlign:"center",cursor:"pointer",boxSizing:"border-box"}}>
        <Camera size={26} color="#a855f7" style={{margin:"0 auto 6px"}}/>
        <div style={{fontSize:"13px",color:"#a855f7",fontWeight:"bold"}}>{imgPreview?"تغيير الصورة":"صوّر صفحة الكتاب أو اختر من المعرض"}</div>
        <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
          const file=e.target.files[0]; if(!file) return;
          const reader=new FileReader();
          reader.onload=(ev)=>{
            const img=new Image();
            img.onload=()=>{
              const MAX=800;
              let w=img.width, h=img.height;
              if(w>MAX||h>MAX){
                if(w>h){h=Math.round(h*MAX/w);w=MAX;}
                else{w=Math.round(w*MAX/h);h=MAX;}
              }
              const canvas=document.createElement("canvas");
              canvas.width=w; canvas.height=h;
              const ctx=canvas.getContext("2d");
              ctx.drawImage(img,0,0,w,h);
              const compressed=canvas.toDataURL("image/jpeg",0.5);
              setImgPreview(compressed);
              setImgB64(compressed.split(",")[1]);
            };
            img.src=ev.target.result;
          };
          reader.readAsDataURL(file);
        }}/>
      </label>
    </div>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner color="#a855f7"/><div style={{marginTop:"10px",fontSize:"14px",color:"#a855f7",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button disabled={!imgB64} onClick={()=>generate(true)} style={{...C.purpleBtn,opacity:imgB64?1:0.5}}> Groq يقرأ الورقة ويبني الشرائح</button>}
  </div>;

  if(mode==="text") return <div>{back}
    <div style={{fontSize:"15px",fontWeight:"bold",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}><BookOpen size={18} color="#38bdf8"/> كتابة موضوع</div>
    <label style={C.label}> موضوع الشرائح</label>
    <textarea rows={3} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="مثال: الجهاز التنفسي في جسم الإنسان&#10;أو: قوانين نيوتن الثلاثة&#10;أو: الكسور العشرية وعمليات الجمع والطرح" style={{...C.input,resize:"none"}}/>
    <label style={C.label}> عدد الشرائح</label>{countBtns}
    {loading?<div style={{textAlign:"center",padding:"20px"}}><Spinner/><div style={{marginTop:"10px",fontSize:"14px",color:"#38bdf8",fontWeight:"bold"}}>{loadMsg}</div></div>
      :<button onClick={()=>generate(false)} disabled={!topic.trim()} style={{...C.purpleBtn,opacity:topic.trim()?1:0.5}}> Gemini يبني الشرائح الآن</button>}
  </div>;

  if(mode==="result"){const sl=slides[curSlide]||{}; return <div style={{paddingBottom:"80px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
      {back}
      <span dir="ltr" style={{color:"#a1a1aa",fontSize:"12px"}}>{curSlide+1} / {slides.length}</span>
    </div>
    <div style={{background:ts.bg,borderRadius:"20px",padding:"24px 18px",minHeight:"220px",marginBottom:"14px",border:"1px solid rgba(255,255,255,0.08)"}}>
      <div style={{backgroundColor:ts.card,borderRadius:"8px",padding:"4px 12px",display:"inline-block",marginBottom:"12px",border:"1px solid "+ts.accent+"44"}}><span style={{color:ts.accent,fontSize:"11px",fontWeight:"bold"}}>شريحة {curSlide+1}</span></div>
      <h3 style={{color:"#fff",fontSize:"17px",fontWeight:"bold",margin:"0 0 12px",lineHeight:"1.5"}}><MathText text={sl.title}/></h3>
      <ul style={{listStyle:"none",padding:0,margin:0}}>
        {(sl.points||[]).map((pt,i)=><li key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"8px",color:"rgba(255,255,255,0.88)",fontSize:"13px",lineHeight:"1.6"}}><span style={{color:ts.accent,flexShrink:0}}>◆</span><MathText text={pt}/></li>)}
      </ul>
    </div>
    <div style={{display:"flex",gap:"5px",justifyContent:"center",marginBottom:"12px",flexWrap:"wrap"}}>
      {slides.map((_,i)=><div key={i} onClick={()=>setCurSlide(i)} style={{width:i===curSlide?"18px":"7px",height:"7px",borderRadius:"4px",backgroundColor:i===curSlide?ts.accent:"#3f3f46",cursor:"pointer",transition:"width 0.2s"}}/>)}
    </div>
    <div style={{display:"flex",gap:"10px",marginBottom:"12px"}}>
      <button disabled={curSlide===0} onClick={()=>setCurSlide(i=>i-1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===0?"#1c1c1e":"#27272a",color:curSlide===0?"#3f3f46":"#fff",cursor:curSlide===0?"not-allowed":"pointer",fontWeight:"bold"}}>◀ السابق</button>
      <button disabled={curSlide===slides.length-1} onClick={()=>setCurSlide(i=>i+1)} style={{flex:1,padding:"11px",borderRadius:"12px",border:"none",backgroundColor:curSlide===slides.length-1?"#1c1c1e":"#27272a",color:curSlide===slides.length-1?"#3f3f46":"#fff",cursor:curSlide===slides.length-1?"not-allowed":"pointer",fontWeight:"bold"}}>التالي ▶</button>
    </div>

    {/* ─── سؤال هذه الشريحة (اختياري) ─── */}
    <div style={{...C.card,border:"1px solid rgba(250,204,21,0.25)",marginBottom:"12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:(sl.question||showQEditor)?"10px":0}}>
        <div style={{fontSize:"13px",fontWeight:"bold",color:"#facc15",display:"flex",alignItems:"center",gap:"6px"}}><HelpCircle size={15}/> سؤال هذه الشريحة (اختياري)</div>
        {sl.question&&!showQEditor&&(
          <button onClick={openEditQuestion} style={{background:"none",border:"none",color:"#38bdf8",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>تعديل</button>
        )}
      </div>

      {!showQEditor&&!sl.question&&(
        qGenLoading?(
          <div style={{textAlign:"center",padding:"10px"}}><Spinner size={16} color="#facc15"/><div style={{marginTop:"6px",fontSize:"12px",color:"#facc15"}}>جارٍ توليد سؤال مناسب لهذه الشريحة...</div></div>
        ):(
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={openAddQuestion} style={{flex:1,padding:"10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.12)",backgroundColor:"#27272a",color:"#e4e4e7",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>✍️ اكتب يدويًا</button>
            <button onClick={generateQuestionAI} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#7c3aed,#a855f7)",color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>🤖 توليد بالذكاء الاصطناعي</button>
          </div>
        )
      )}

      {!showQEditor&&sl.question&&(
        <div>
          <div style={{fontSize:"12px",color:"#d4d4d8",marginBottom:"8px",lineHeight:1.6}}>{sl.question.q}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"4px",marginBottom:"10px"}}>
            {sl.question.options.map((opt,i)=>(
              <div key={i} style={{fontSize:"11px",color:i===sl.question.correctIndex?"#4ade80":"#71717a",display:"flex",alignItems:"center",gap:"6px"}}>
                <span>{i===sl.question.correctIndex?"✔":"—"}</span><span>{opt}</span>
              </div>
            ))}
          </div>
          <button onClick={removeQuestion} style={{display:"flex",alignItems:"center",gap:"5px",background:"none",border:"none",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer",padding:0}}><Trash2 size={13}/> حذف السؤال</button>
        </div>
      )}

      {showQEditor&&(
        <div>
          <textarea rows={2} value={qDraft.q} onChange={e=>setQDraft(d=>({...d,q:e.target.value}))} placeholder="نص السؤال" style={{...C.input,resize:"none",marginBottom:"8px",fontSize:"12px"}}/>
          {qDraft.options.map((opt,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
              <input type="radio" name="correctOpt" checked={qDraft.correctIndex===i} onChange={()=>setQDraft(d=>({...d,correctIndex:i}))} style={{flexShrink:0}}/>
              <input value={opt} onChange={e=>{const opts=[...qDraft.options];opts[i]=e.target.value;setQDraft(d=>({...d,options:opts}));}} placeholder={"الخيار "+(i+1)+(i===qDraft.correctIndex?" (صحيح)":"")} style={{flex:1,padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:"8px",marginTop:"8px"}}>
            <button onClick={saveQuestion} style={{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#059669,#4ade80)",color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>حفظ السؤال</button>
            <button onClick={()=>setShowQEditor(false)} style={{flex:1,padding:"10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.12)",backgroundColor:"transparent",color:"#a1a1aa",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>إلغاء</button>
          </div>
        </div>
      )}
    </div>

    <div style={{...C.card,border:"1px solid rgba(56,189,248,0.15)"}}>
      <div style={{fontSize:"13px",fontWeight:"bold",color:"#38bdf8",marginBottom:"10px"}}> حفظ في Firebase</div>
      <input value={clipTitle} onChange={e=>setClipTitle(e.target.value)} placeholder="عنوان المقطع" style={{...C.input,marginBottom:"8px"}}/>
      <div style={{...C.twoCol,marginBottom:"8px"}}>
        <select value={clipSubj} onChange={e=>setClipSubj(e.target.value)} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={clipStage} onChange={e=>{setClipStage(e.target.value);setClipGrade((GRADES[e.target.value]||[])[0]||"الأول");}} style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div style={{marginBottom:"10px"}}>
        <select value={clipGrade} onChange={e=>setClipGrade(e.target.value)} style={{width:"100%",padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}>{(GRADES[clipStage]||[]).map(g=><option key={g}>{g}</option>)}</select>
      </div>
      <div style={{...C.twoCol,marginBottom:"10px"}}>
        <input value={clipTopic} onChange={e=>setClipTopic(e.target.value)} placeholder="الفصل (تلقائي، قابل للتعديل)" style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}/>
        <input type="number" value={clipNum} onChange={e=>setClipNum(e.target.value)} placeholder="رقم المقطع" style={{padding:"10px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"12px",outline:"none"}}/>
      </div>
      <button onClick={saveToFirestore} disabled={saving} style={{...C.primaryBtn,marginBottom:0,opacity:saving?0.7:1}}>
        {saving?<><Spinner size={16}/> جارٍ الحفظ...</>:<><Save size={16}/> حفظ الشرائح في Firebase</>}
      </button>
    </div>
  </div>;}
  return null;
}

export { SlidesStudio };
