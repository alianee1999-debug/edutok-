// ─── admin/AdminExamsTab.jsx ─────────────────────────────
// بنك أسئلة الامتحانات: توليد أسئلة بالذكاء الاصطناعي من محتوى شرائح الفصل
// (بدفعات تلقائية للأعداد الكبيرة، مع معالجة أخطاء JSON واستعادة الأسئلة
// السليمة من دفعة فاشلة جزئياً)، مراجعة قبل النشر، إضافة سؤال يدوياً،
// وعرض/حذف الأسئلة المنشورة.
import React, { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ClipboardList, Wand2, X, Pencil, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES } from "../constants";
import { callAI } from "../ai";
import { showMsg } from "../toast";
import { Spinner, MathText } from "../components/Shared";

function AdminExamsTab() {
  const [clips,setClips]=useState([]);
  const [published,setPublished]=useState([]);
  const [subject,setSubject]=useState(SUBJECTS[0]);
  const [stage,setStage]=useState(STAGES[0]);
  const [grade,setGrade]=useState((GRADES[STAGES[0]]||[])[0]||"");
  const [topic,setTopic]=useState("");
  const [count,setCount]=useState(20);
  const [generating,setGenerating]=useState(false);
  const [genProgress,setGenProgress]=useState(""); // نص تقدم التوليد عند تقسيمه لدفعات (أعداد كبيرة)
  const [genError,setGenError]=useState(""); // آخر رسالة خطأ تفصيلية (تُعرض ثابتة بالشاشة، لا تختفي مثل الـ Toast)
  const [drafts,setDrafts]=useState([]); // أسئلة مولّدة بانتظار المراجعة (لم تُنشر بعد)
  const [publishing,setPublishing]=useState(false);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"clips"),snap=>setClips(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,"examQuestions"),snap=>setPublished(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  },[]);

  // إعادة ضبط الصف تلقائياً عند تغيير المرحلة (لأن قائمة الصفوف تختلف باختلاف المرحلة)
  useEffect(()=>{ setGrade((GRADES[stage]||[])[0]||""); },[stage]);

  // نطابق الصف بنفس المرونة المستخدمة بباقي التطبيق: نقبل المقطع لو صفه مطابق أو لو ما حُدد له صف أصلاً
  const gradeMatches = (c)=> !grade || c.grade===grade || !c.grade;

  const topics = React.useMemo(()=>{
    const set=new Set();
    clips.forEach(c=>{ if(c.subject===subject&&c.stage===stage&&c.topic&&gradeMatches(c)) set.add(c.topic); });
    return [...set].sort();
  },[clips,subject,stage,grade]);
  useEffect(()=>{ setTopic(topics[0]||""); },[subject,stage,grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const topicPublished = published.filter(q=>q.subject===subject&&q.stage===stage&&q.topic===topic);

  // يجمع نصوص شرائح الفصل المختار لتُستخدم كمصدر يُغذّي به الذكاء الاصطناعي (أسئلة مبنية على المحتوى الفعلي وليست عشوائية)
  const buildGroundingText = ()=>{
    const topicClips = clips.filter(c=>c.subject===subject&&c.stage===stage&&c.topic===topic&&gradeMatches(c)&&Array.isArray(c.slides));
    const chunks=[];
    topicClips.forEach(c=>{
      (c.slides||[]).forEach(s=>{
        chunks.push("### "+(s.title||"")+"\n"+(s.points||[]).join("\n"));
      });
    });
    // نحدد طول النص المرسل للذكاء الاصطناعي تجنباً لتجاوز حد الطلب
    return chunks.join("\n\n").slice(0,12000);
  };

  // نطلب دفعة واحدة من الأسئلة (حد أقصى BATCH لضمان استجابة JSON كاملة وسليمة من النموذج)
  // يحاول استخراج مصفوفة الأسئلة من نص الرد بعدة طرق (النموذج أحياناً يغلّفها بكائن، أو يضيف نصاً حولها رغم التعليمات)
  // يصلح الـ backslashes الخام غير الصحيحة داخل نص JSON (مثل رموز LaTeX $\omega^{64}$ أو $\frac{1}{2}$)
  // مهم: نتعرف أولاً على أي تسلسل هروب صحيح أصلاً (\\ \" \n \uXXXX ...) ونتركه كما هو،
  // وأي "\" وحيدة متبقية (غير جزء من تسلسل صحيح) نضاعفها. هذا يمنع كسر "\\omega" الصحيحة أصلاً.
  const sanitizeJsonBackslashes = (s)=>{
    return s.replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g, (m)=> m.length>1 ? m : "\\\\");
  };
  // يزيل أحرف تحكم خام (سطر جديد/تاب حقيقي غير مهروب) قد يضيفها النموذج داخل النص، وهذي غير صالحة داخل نص JSON
  const squashRawControlChars = (s)=> s.replace(/[\r\n\t]+/g, " ");
  // يقسّم محتوى مصفوفة JSON إلى عناصرها top-level بحساب عمق الأقواس (يتجاهل الأقواس الموجودة داخل النصوص)
  // يُستخدم كخطة بديلة أخيرة: نحلّل كل سؤال لحاله، ونتجاهل السؤال الخربان فقط بدل رفض الدفعة كاملة
  const splitTopLevelObjects = (arrInner)=>{
    const items = [];
    let depth = 0, inStr = false, start = -1;
    for(let i=0;i<arrInner.length;i++){
      const ch = arrInner[i];
      if(inStr){
        if(ch === "\\"){ i++; continue; }
        if(ch === "\"") inStr = false;
        continue;
      }
      if(ch === "\""){ inStr = true; continue; }
      if(ch === "{"){ if(depth===0) start = i; depth++; continue; }
      if(ch === "}"){ depth--; if(depth===0 && start!==-1){ items.push(arrInner.slice(start,i+1)); start=-1; } continue; }
    }
    return items;
  };
  const extractQuestionsArray = (rawClean)=>{
    const fixed = sanitizeJsonBackslashes(squashRawControlChars(rawClean));
    const start = fixed.indexOf("[");
    const end = fixed.lastIndexOf("]");
    // المحاولة 1: تحليل المصفوفة كاملة دفعة واحدة (الحالة الشائعة والأسرع)
    if(start!==-1 && end!==-1 && end>start){
      try{
        const arr = JSON.parse(fixed.substring(start,end+1));
        if(Array.isArray(arr)) return arr;
      }catch{}
    }
    // المحاولة 2: النص كله كائن JSON صحيح، والمصفوفة بداخله بأي اسم حقل (questions/data/items/...)
    try{
      const obj = JSON.parse(fixed);
      if(Array.isArray(obj)) return obj;
      const firstArray = Object.values(obj).find(v=>Array.isArray(v));
      if(firstArray) return firstArray;
    }catch{}
    // المحاولة 3 (احتياطية): نحلّل كل سؤال بمصفوفة على حدة، ونحتفظ بالأسئلة السليمة فقط
    // بدل رفض الدفعة كاملة بسبب خطأ صياغة بسؤال واحد فقط
    if(start!==-1 && end!==-1 && end>start){
      const objTexts = splitTopLevelObjects(fixed.substring(start+1,end));
      const salvaged = [];
      for(const t of objTexts){
        try{ salvaged.push(JSON.parse(t)); }catch{ /* نتجاهل هذا السؤال فقط ونكمل الباقي */ }
      }
      if(salvaged.length>0) return salvaged;
    }
    throw new Error("لم يُرجع المساعد صيغة JSON يمكن قراءتها");
  };

  // يطبّع شكل السؤال المولّد (بعض النماذج تستخدم أسماء حقول مختلفة قليلاً رغم التعليمات الصريحة)
  const normalizeQuestion = (q)=>{
    const question = q.question ?? q.q ?? q.text ?? q.prompt ?? "";
    let options = q.options ?? q.choices ?? q.answers;
    if(options && !Array.isArray(options) && typeof options==="object") options = Object.values(options);
    let correctIndex = q.correctIndex ?? q.correct ?? q.correct_index ?? q.answerIndex ?? q.correctAnswer;
    if(typeof correctIndex==="string"){
      const letterMap={a:0,b:1,c:2,d:3,A:0,B:1,C:2,D:3};
      correctIndex = letterMap[correctIndex] ?? Number(correctIndex);
    }
    return { question, options, correctIndex };
  };

  // ننتظر المدة المطلوبة ثم نعيد المحاولة تلقائياً — بدل فشل فوري — عند الوصول لحد الاستخدام المؤقت بواجهة Groq
  const sleep = (ms)=> new Promise(resolve=>setTimeout(resolve,ms));
  // يستخرج عدد الثواني المقترح للانتظار من رسالة خطأ Groq، مثل: "Please try again in 10.315s"
  const parseRetrySeconds = (message)=>{
    const m = /try again in ([\d.]+)s/i.exec(message||"");
    return m ? Math.ceil(parseFloat(m[1])) : null;
  };
  const MAX_RATE_LIMIT_RETRIES = 2;

  const generateBatch = async(grounding, batchCount)=>{
    const prompt = "أنت معلّم متخصص. بناءً على المحتوى الدراسي التالي لمادة "+subject+" ("+stage+" — فصل: "+topic+"):\n\n"+grounding
      +"\n\nأنشئ بالضبط "+batchCount+" سؤال اختيار من متعدد (MCQ) مبنية حصراً على هذا المحتوى، بحيث كل سؤال له 4 خيارات وخيار واحد صحيح فقط. "
      +"إذا كان المحتوى يتضمن معادلات أو رموز كيميائية أو رياضية بصيغة $...$ فحافظ على نفس الصيغة داخل نص السؤال أو الخيارات. "
      +"نوّع بين أسئلة مفاهيمية وأسئلة حسابية (إن وُجدت مسائل بالمحتوى). اجعل الخيارات الخاطئة قريبة منطقياً من الصحيحة (أخطاء شائعة) وليست عشوائية بلا معنى.\n\n"
      +"مهم جداً بخصوص صيغة الرد: أجب بمصفوفة JSON فقط، بلا أي نص أو مقدمة أو شرح قبلها أو بعدها، وبلا أسوار markdown (```)، ابدأ ردك مباشرة بالحرف [ وأنهِه بالحرف ]. "
      +"قاعدة إلزامية للحفاظ على صحة JSON: أي رمز \\ داخل رموز LaTeX (مثل \\omega أو \\frac) يجب كتابته مضاعفاً \\\\ داخل نصوص JSON (مثال: اكتب \"$\\\\omega^{64}$\" وليس \"$\\omega^{64}$\")، وإلا يصبح الرد JSON غير صالح. "
      +"استخدم بالضبط أسماء الحقول التالية: \"question\" (نص)، \"options\" (مصفوفة من 4 نصوص بالضبط)، \"correctIndex\" (رقم صحيح من 0 إلى 3 يمثل فهرس الخيار الصحيح بالمصفوفة، حيث 0 هو الخيار الأول). "
      +"مثال دقيق لعنصر واحد صحيح الصيغة:\n"
      +'[{"question":"ما ناتج 2+2؟","options":["3","4","5","6"],"correctIndex":1}]';

    let raw;
    let rateLimitAttempt = 0;
    while(true){
      try{
        raw = await callAI(prompt);
        break;
      }catch(e){
        const isRateLimit = /rate limit/i.test(e.message||"");
        if(isRateLimit && rateLimitAttempt<MAX_RATE_LIMIT_RETRIES){
          const waitSec = parseRetrySeconds(e.message) || 15;
          setGenProgress("⏳ تم الوصول للحد الأقصى المؤقت لطلبات الذكاء الاصطناعي — إعادة المحاولة تلقائياً خلال "+waitSec+" ثانية...");
          await sleep((waitSec+1)*1000); // ثانية إضافية أمان فوق ما اقترحته Groq
          rateLimitAttempt++;
          continue;
        }
        throw e; // ليس تحديد معدل، أو استُنفدت محاولات الإعادة التلقائية
      }
    }

    const clean = raw.replace(/```json/gi,"").replace(/```/g,"").trim();
    let rawArray;
    try{
      rawArray = extractQuestionsArray(clean);
    }catch(e){
      // نرفق معاينة أطول من رد النموذج الفعلي هنا أيضاً (كانت غائبة سابقاً بهذا المسار تحديداً)
      throw new Error(e.message+" — معاينة رد المساعد: "+(clean?clean.slice(0,400):"(رد فارغ تماماً)"));
    }
    const normalized = rawArray.map(normalizeQuestion);
    const valid = normalized.filter(q=>q.question && Array.isArray(q.options) && q.options.length===4 && Number.isInteger(q.correctIndex) && q.correctIndex>=0 && q.correctIndex<=3);
    if(valid.length===0){
      // نعرض معاينة من رد النموذج الفعلي بدل رسالة عامة، عشان يكون سبب الفشل واضحاً وقابلاً للتشخيص
      throw new Error("لم يجتز أي سؤال التحقق من الصيغة. معاينة الرد: "+clean.slice(0,400));
    }
    return valid;
  };

  // العدد الأقصى لكل طلب واحد للذكاء الاصطناعي — أعداد كبيرة تُقسّم تلقائياً لعدة دفعات متتالية لضمان استجابة JSON سليمة وكاملة من النموذج في كل مرة، وتقليل احتمال تجاوز حد الاستخدام بالدقيقة الواحدة
  const AI_BATCH_SIZE = 12;

  const generate = async()=>{
    if(!topic){ showMsg("اختر فصلاً أولاً"); return; }
    const grounding = buildGroundingText();
    if(!grounding.trim()){ showMsg("لا يوجد محتوى (شرائح) لهذا الفصل بعد لبناء أسئلة منه"); return; }
    const total = Math.max(1, Number(count)||1);
    setGenerating(true);
    setGenError(""); // نمسح أي خطأ سابق ظاهر بالشاشة قبل محاولة جديدة
    let collected = [];
    let lastBatchError = ""; // نحتفظ بآخر رسالة خطأ فعلية (فيها معاينة رد النموذج) لعرضها لو فشلت كل الدفعات
    try{
      const batches = Math.ceil(total/AI_BATCH_SIZE);
      for(let b=0;b<batches;b++){
        const remaining = total - collected.length;
        const thisBatch = Math.min(AI_BATCH_SIZE, remaining);
        if(batches>1) setGenProgress("جارٍ توليد الدفعة "+(b+1)+" من "+batches+" ("+collected.length+"/"+total+" سؤال حتى الآن)...");
        else setGenProgress("جارٍ توليد "+thisBatch+" سؤال...");
        if(b>0) await sleep(2000); // فاصل زمني بسيط بين الدفعات لتقليل احتمال تجاوز حد الاستخدام بالدقيقة
        try{
          const valid = await generateBatch(grounding, thisBatch);
          collected = [...collected, ...valid];
        }catch(e){
          // لو فشلت دفعة واحدة (مثلاً استجابة ناقصة من النموذج) نكمل بقية الدفعات بدل إلغاء كل شيء
          lastBatchError = e.message;
          if(batches>1) showMsg("تنبيه: فشلت دفعة ("+(b+1)+"/"+batches+")، جارٍ متابعة الباقي...");
        }
      }
      if(collected.length===0) throw new Error(lastBatchError || "لم يتم توليد أي سؤال صالح");
      setDrafts(prev=>[...prev, ...collected.map(q=>({...q, _tempId:Math.random().toString(36).slice(2)}))]);
      showMsg("تم توليد "+collected.length+" من أصل "+total+" سؤال مطلوب — راجعها ثم انشرها");
    }catch(e){
      setGenError(e.message); // نعرضها بشكل ثابت بالشاشة (مو Toast يختفي) عشان تكون قابلة للقراءة كاملة
      showMsg("فشل التوليد — التفاصيل ظاهرة تحت الزر");
    }
    setGenProgress("");
    setGenerating(false);
  };

  const updateDraft = (tempId,field,value)=>{
    setDrafts(prev=>prev.map(d=>d._tempId===tempId?{...d,[field]:value}:d));
  };
  const updateDraftOption = (tempId,optIdx,value)=>{
    setDrafts(prev=>prev.map(d=>{
      if(d._tempId!==tempId) return d;
      const opts=[...d.options]; opts[optIdx]=value; return {...d,options:opts};
    }));
  };
  const removeDraft = (tempId)=> setDrafts(prev=>prev.filter(d=>d._tempId!==tempId));

  const publishAll = async()=>{
    if(drafts.length===0) return;
    setPublishing(true);
    try{
      for(const d of drafts){
        await addDoc(collection(db,"examQuestions"),{
          subject, stage, grade, topic,
          question:d.question, options:d.options, correctIndex:d.correctIndex,
          published:true, createdAt:serverTimestamp(),
        });
      }
      showMsg("✅ تم نشر "+drafts.length+" سؤال بنجاح");
      setDrafts([]);
    }catch(e){ showMsg("فشل النشر: "+e.message); }
    setPublishing(false);
  };

  const deletePublished = async(id)=>{
    if(!window.confirm("حذف هذا السؤال نهائياً؟")) return;
    try{ await deleteDoc(doc(db,"examQuestions",id)); showMsg("تم الحذف"); }
    catch(e){ showMsg("فشل الحذف: "+e.message); }
  };

  // ─── إضافة سؤال يدوياً ───
  const [manualQ,setManualQ]=useState(""); const [manualOpts,setManualOpts]=useState(["","","",""]); const [manualCorrect,setManualCorrect]=useState(0); const [addingManual,setAddingManual]=useState(false);
  const addManual = async()=>{
    if(!topic){ showMsg("اختر فصلاً أولاً"); return; }
    if(!manualQ.trim()||manualOpts.some(o=>!o.trim())){ showMsg("أكمل نص السؤال وكل الخيارات الأربعة"); return; }
    setAddingManual(true);
    try{
      await addDoc(collection(db,"examQuestions"),{subject,stage,grade,topic,question:manualQ,options:manualOpts,correctIndex:manualCorrect,published:true,createdAt:serverTimestamp()});
      setManualQ(""); setManualOpts(["","","",""]); setManualCorrect(0);
      showMsg("✅ تمت إضافة السؤال");
    }catch(e){ showMsg("فشل: "+e.message); }
    setAddingManual(false);
  };

  return <div>
    <div style={C.infoBanner}><ClipboardList size={15}/> اختر الفصل ثم ولّد أسئلة بالذكاء الاصطناعي من محتوى شرائحه، راجعها، ثم انشرها ليراها الطلاب بامتحان الفصل.</div>

    <label style={C.label}>المادة</label>
    <select value={subject} onChange={e=>setSubject(e.target.value)} style={C.select}>
      {SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
    <label style={C.label}>المرحلة</label>
    <select value={stage} onChange={e=>setStage(e.target.value)} style={C.select}>
      {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
    <label style={C.label}>الصف</label>
    <select value={grade} onChange={e=>setGrade(e.target.value)} style={C.select}>
      {(GRADES[stage]||[]).map(g=><option key={g} value={g}>{g}</option>)}
    </select>
    <label style={C.label}>الفصل</label>
    {topics.length===0
      ?<div style={{...C.infoBanner,backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171"}}>لا توجد فصول (مقاطع فيها اسم فصل) لهذه المادة/المرحلة/الصف بعد</div>
      :<select value={topic} onChange={e=>setTopic(e.target.value)} style={C.select}>
        {topics.map(t=><option key={t} value={t}>{t}</option>)}
      </select>
    }

    {topic&&<div style={{fontSize:"12px",color:"#71717a",marginBottom:"14px"}}>📊 عدد الأسئلة المنشورة حالياً لهذا الفصل: <strong style={{color:"#c4b5fd"}}>{topicPublished.length}</strong></div>}

    <label style={C.label}>عدد الأسئلة المطلوب توليدها (بلا حد أقصى — يُقسَّم تلقائياً لدفعات إذا كان العدد كبيراً)</label>
    <input type="number" min={1} value={count} onChange={e=>setCount(Number(e.target.value)||1)} style={C.input}/>

    <button disabled={generating||!topic} onClick={generate} style={{...C.purpleBtn,opacity:(generating||!topic)?0.6:1,marginBottom:(genProgress||genError)?"8px":"18px"}}>
      {generating?<><Spinner size={16}/> جارٍ التوليد بالذكاء الاصطناعي...</>:<><Wand2 size={16}/> ولّد أسئلة بالذكاء الاصطناعي</>}
    </button>
    {genProgress&&<div style={{fontSize:"12px",color:"#c4b5fd",textAlign:"center",marginBottom:"18px"}}>{genProgress}</div>}
    {genError&&(
      <div style={{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px",padding:"12px",marginBottom:"18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"4px"}}>
          <span style={{color:"#f87171",fontWeight:"bold",fontSize:"13px"}}>⚠️ فشل التوليد — تفاصيل الخطأ</span>
          <button onClick={()=>setGenError("")} style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",flexShrink:0}}><X size={16}/></button>
        </div>
        <div style={{fontSize:"12px",color:"#fca5a5",lineHeight:"1.6",userSelect:"text",wordBreak:"break-word",maxHeight:"180px",overflowY:"auto"}}>{genError}</div>
      </div>
    )}

    {/* ─── مراجعة الأسئلة المولّدة قبل النشر ─── */}
    {drafts.length>0&&<div style={{marginBottom:"20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <span style={{fontWeight:"bold",fontSize:"14px",color:"#fbbf24"}}>📝 مراجعة قبل النشر ({drafts.length})</span>
        <button disabled={publishing} onClick={publishAll} style={{padding:"8px 16px",borderRadius:"10px",border:"none",background:"linear-gradient(to right,#059669,#34d399)",color:"#fff",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>
          {publishing?"جارٍ النشر...":"✅ نشر الكل"}
        </button>
      </div>
      {drafts.map(d=>(
        <div key={d._tempId} style={{...C.card,border:"1px solid rgba(251,191,36,0.25)",marginBottom:"8px"}}>
          <textarea value={d.question} onChange={e=>updateDraft(d._tempId,"question",e.target.value)} style={{...C.input,minHeight:"50px",marginBottom:"4px",fontFamily:"inherit"}}/>
          {d.question&&<div style={{backgroundColor:"#09090b",borderRadius:"8px",padding:"8px 10px",marginBottom:"10px",border:"1px dashed rgba(255,255,255,0.1)"}}>
            <div style={{fontSize:"9px",color:"#52525b",marginBottom:"3px"}}>معاينة الشكل النهائي للطالب:</div>
            <MathText text={d.question} style={{fontSize:"13px",color:"#e4e4e7"}}/>
          </div>}
          {d.options.map((opt,i)=>(
            <div key={i} style={{marginBottom:"8px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <input type="radio" checked={d.correctIndex===i} onChange={()=>updateDraft(d._tempId,"correctIndex",i)}/>
                <span style={{fontSize:"11px",fontWeight:"bold",color:"#a1a1aa",width:"14px",flexShrink:0}}>{String.fromCharCode(65+i)}</span>
                <input value={opt} onChange={e=>updateDraftOption(d._tempId,i,e.target.value)} style={{...C.input,marginBottom:0,padding:"8px 10px",fontSize:"12px",flex:1,border:d.correctIndex===i?"1px solid rgba(34,197,94,0.5)":C.input.border}}/>
              </div>
              {opt&&<div style={{marginRight:"22px",marginTop:"3px"}}><MathText text={opt} style={{fontSize:"12px",color:"#a1a1aa"}}/></div>}
            </div>
          ))}
          <button onClick={()=>removeDraft(d._tempId)} style={{width:"100%",padding:"7px",borderRadius:"8px",border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#f87171",fontSize:"12px",fontWeight:"bold",cursor:"pointer",marginTop:"4px"}}>🗑 حذف من المسودة</button>
        </div>
      ))}
    </div>}

    {/* ─── إضافة سؤال يدوياً ─── */}
    {topic&&<div style={{...C.card,border:"1px solid rgba(255,255,255,0.08)",marginBottom:"20px"}}>
      <div style={{fontWeight:"bold",fontSize:"13px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}><Pencil size={14}/> إضافة سؤال يدوياً</div>
      <textarea placeholder="نص السؤال..." value={manualQ} onChange={e=>setManualQ(e.target.value)} style={{...C.input,minHeight:"50px",fontFamily:"inherit"}}/>
      {manualOpts.map((opt,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
          <input type="radio" checked={manualCorrect===i} onChange={()=>setManualCorrect(i)}/>
          <span style={{fontSize:"11px",fontWeight:"bold",color:"#a1a1aa",width:"14px",flexShrink:0}}>{String.fromCharCode(65+i)}</span>
          <input placeholder={"الخيار "+(i+1)} value={opt} onChange={e=>{const n=[...manualOpts];n[i]=e.target.value;setManualOpts(n);}} style={{...C.input,marginBottom:0,padding:"8px 10px",fontSize:"12px",flex:1}}/>
        </div>
      ))}
      <button disabled={addingManual} onClick={addManual} style={{...C.blueBtn,marginTop:"6px",marginBottom:0,opacity:addingManual?0.6:1}}>{addingManual?"جارٍ الإضافة...":"➕ إضافة السؤال"}</button>
    </div>}

    {/* ─── الأسئلة المنشورة حالياً ─── */}
    {topic&&topicPublished.length>0&&<div>
      <div style={{fontWeight:"bold",fontSize:"14px",color:"#4ade80",marginBottom:"10px"}}>✅ الأسئلة المنشورة ({topicPublished.length})</div>
      {topicPublished.map((q,i)=>(
        <div key={q.id} style={{...C.card,border:"1px solid rgba(34,197,94,0.15)",marginBottom:"6px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px"}}>
            <MathText text={(i+1)+". "+q.question} style={{fontSize:"13px",color:"#fff",flex:1}}/>
            <button onClick={()=>deletePublished(q.id)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",flexShrink:0}}><Trash2 size={16}/></button>
          </div>
          <div style={{fontSize:"11px",color:"#4ade80",marginTop:"6px"}}>✓ {String.fromCharCode(65+(q.correctIndex||0))} — <MathText text={q.options?.[q.correctIndex]} style={{fontSize:"11px",color:"#4ade80"}}/></div>
        </div>
      ))}
    </div>}
  </div>;
}

export { AdminExamsTab };
