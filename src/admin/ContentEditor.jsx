// ─── admin/ContentEditor.jsx ─────────────────────────────
// محرر محتوى الشرائح: تصفح/فلترة كل المقاطع (شرائح أو فيديو)، ثم تعديل/حذف/
// إضافة/إعادة ترتيب شرائح مقطع "شرائح AI" محدد.
import React, { useState, useEffect } from "react";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { Search, Layers, Film, Save, Plus, HelpCircle, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { SUBJECTS, STAGES, GRADES } from "../constants";
import { callAI } from "../ai";
import { showMsg } from "../toast";
import { Spinner, MathText } from "../components/Shared";

function ContentEditor() {
  const [clips, setClips] = useState([]);
  const [selClip, setSelClip] = useState(null);
  const [slides, setSlides] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  // ─── سؤال الشريحة (اختياري) — نفس ميزة الاستوديو، لكن هنا لمقاطع محفوظة سابقاً ───
  const [qEditIdx, setQEditIdx] = useState(null);
  const [qDraft, setQDraft] = useState({q:"",options:["","","",""],correctIndex:0});
  const [qGenLoading, setQGenLoading] = useState(null); // رقم الشريحة التي يجري توليد سؤال لها حالياً، أو null
  // ─── فلتر المادة والصف ───
  const [filterSubj, setFilterSubj] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const u = onSnapshot(collection(db, "clips"), snap => {
      setClips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => u();
  }, []);

  const openClip = (clip) => {
    setSelClip(clip);
    setSlides(clip.slides || []);
    setEditIdx(null);
    setShowAddSlide(false);
    setQEditIdx(null);
  };

  const saveSlides = async (newSlides) => {
    if (!selClip?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "clips", selClip.id), { slides: newSlides });
      setSlides(newSlides);
      setSelClip({ ...selClip, slides: newSlides });
      showMsg("تم حفظ التعديلات");
    } catch (e) { showMsg("فشل: " + e.message); }
    setSaving(false);
  };

  const openEdit = (idx) => {
    setEditIdx(idx);
    setEditTitle(slides[idx].title || "");
    setEditPoints((slides[idx].points || []).join("\n"));
    setShowAddSlide(false);
    setQEditIdx(null);
  };

  const saveEdit = async () => {
    const newSlides = [...slides];
    newSlides[editIdx] = {
      ...newSlides[editIdx],
      title: editTitle,
      points: editPoints.split("\n").filter(p => p.trim())
    };
    await saveSlides(newSlides);
    setEditIdx(null);
  };

  // ─── سؤال الشريحة (اختياري) ───
  const openAddQuestion = (idx) => {
    setQDraft({q:"",options:["","","",""],correctIndex:0});
    setQEditIdx(idx);
  };
  const openEditQuestion = (idx) => {
    const cur = slides[idx]?.question;
    setQDraft(cur
      ? {q:cur.q||"", options:(cur.options&&cur.options.length===4)?[...cur.options]:["","","",""], correctIndex:cur.correctIndex||0}
      : {q:"",options:["","","",""],correctIndex:0});
    setQEditIdx(idx);
  };
  const saveQuestion = async () => {
    if(!qDraft.q.trim()) return showMsg("أدخل نص السؤال");
    if(qDraft.options.some(o=>!o.trim())) return showMsg("عبّئ كل الخيارات الأربعة");
    const newSlides = [...slides];
    newSlides[qEditIdx] = {...newSlides[qEditIdx], question:{q:qDraft.q.trim(), options:qDraft.options.map(o=>o.trim()), correctIndex:qDraft.correctIndex}};
    await saveSlides(newSlides);
    setQEditIdx(null);
  };
  const removeQuestion = async (idx) => {
    const newSlides = [...slides];
    const {question, ...rest} = newSlides[idx] || {};
    newSlides[idx] = rest;
    await saveSlides(newSlides);
  };
  const generateQuestionAI = async (idx) => {
    const sl = slides[idx];
    if(!sl) return;
    setQGenLoading(idx);
    try{
      const prompt='بناءً على محتوى هذه الشريحة التعليمية — العنوان: "'+(sl.title||"")+'" والنقاط: '+JSON.stringify(sl.points||[])+' — أنشئ سؤال اختيار من متعدد سريع لاختبار فهم الطالب لهذه الشريحة تحديداً. أجب بـ JSON فقط بلا أي نص خارجه بهذا الشكل: {"q":"نص السؤال","options":["خيار 1","خيار 2","خيار 3","خيار 4"],"correctIndex":0}. رقم correctIndex هو فهرس الإجابة الصحيحة بالمصفوفة (يبدأ من 0).';
      const raw=await callAI(prompt);
      const clean=raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const start=clean.indexOf("{");
      const end=clean.lastIndexOf("}");
      const fixed=clean.substring(start,end+1).replace(/\\u[0-9a-fA-F]{4}|\\["\\\/bfnrt]|\\/g,(m)=>m.length>1?m:"\\\\");
      const parsed=JSON.parse(fixed);
      if(!parsed.q||!Array.isArray(parsed.options)||parsed.options.length!==4) throw new Error("رد غير صالح");
      setQDraft({q:parsed.q,options:parsed.options,correctIndex:Number(parsed.correctIndex)||0});
      setQEditIdx(idx);
    }catch(e){
      showMsg("تعذّر توليد السؤال: "+e.message+". جرّب الكتابة اليدوية.");
    }
    setQGenLoading(null);
  };

  const deleteSlide = async (idx) => {
    const newSlides = slides.filter((_, i) => i !== idx);
    await saveSlides(newSlides);
    setConfirmDel(null);
  };

  const addSlide = async () => {
    if (!newTitle.trim()) { showMsg("ادخل عنوان الشريحة"); return; }
    const newSlides = [...slides, {
      title: newTitle,
      points: newPoints.split("\n").filter(p => p.trim())
    }];
    await saveSlides(newSlides);
    setNewTitle("");
    setNewPoints("");
    setShowAddSlide(false);
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const newSlides = [...slides];
    [newSlides[idx - 1], newSlides[idx]] = [newSlides[idx], newSlides[idx - 1]];
    await saveSlides(newSlides);
  };

  const moveDown = async (idx) => {
    if (idx === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[idx + 1], newSlides[idx]] = [newSlides[idx], newSlides[idx + 1]];
    await saveSlides(newSlides);
  };

  const allClips = clips.filter(c => c.slides && c.slides.length > 0);
  const regularClips = clips.filter(c => !c.slides || c.slides.length === 0);

  // تطبيق الفلتر
  const filteredAllClips = allClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  const filteredRegularClips = regularClips.filter(c=>{
    if(filterSubj && c.subject!==filterSubj) return false;
    if(filterStage && c.stage!==filterStage) return false;
    if(filterGrade && c.grade!==filterGrade) return false;
    if(filterText && !c.title?.includes(filterText)&&!c.subject?.includes(filterText)) return false;
    return true;
  }).sort((a,b)=>Number(a.num||0)-Number(b.num||0));

  if (!selClip) return (
    <div>
      {/* فلتر البحث */}
      <div style={{backgroundColor:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:"14px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",color:"#38bdf8",fontWeight:"bold",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}><Search size={13}/> بحث وفلتر</div>
        {/* بحث نصي */}
        <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="ابحث عن اسم المقطع..." style={{...C.input,marginBottom:"8px",fontSize:"13px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
          <select value={filterSubj} onChange={e=>{setFilterSubj(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterSubj?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المواد</option>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterStage} onChange={e=>{setFilterStage(e.target.value);setFilterGrade("");}} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterStage?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل المراحل</option>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"8px"}}>
          <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} style={{padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:filterGrade?"#fff":"#71717a",fontSize:"12px"}}>
            <option value="">كل الصفوف</option>
            {(GRADES[filterStage]||["الأول","الثاني","الثالث","الرابع","الخامس","السادس"]).map(g=><option key={g}>{g}</option>)}
          </select>
          {(filterSubj||filterStage||filterGrade||filterText)&&<button onClick={()=>{setFilterSubj("");setFilterStage("");setFilterGrade("");setFilterText("");}} style={{padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",color:"#f87171",fontSize:"12px",cursor:"pointer"}}>مسح</button>}
        </div>
        {(filterSubj||filterStage||filterGrade||filterText)&&<div style={{fontSize:"11px",color:"#71717a",marginTop:"8px"}}>
          النتائج: {filteredAllClips.length+filteredRegularClips.length} مقطع
        </div>}
      </div>
      {filteredAllClips.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#a855f7", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={14} /> مقاطع الشرائح ({filteredAllClips.length})
          </div>
          {filteredAllClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }} onClick={() => openClip(clip)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.num?`#${clip.num} `:""}{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}{clip.grade?` - ${clip.grade}`:""} - {clip.slides.length} شريحة</div>
                </div>
                <div style={{ backgroundColor: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "8px", padding: "6px 12px", color: "#a855f7", fontSize: "12px", fontWeight: "bold" }}>تعديل</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredRegularClips.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Film size={14} /> مقاطع الفيديو ({filteredRegularClips.length})
          </div>
          {filteredRegularClips.map(clip => (
            <div key={clip.id} style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{clip.title}</div>
                  <div style={{ fontSize: "12px", color: "#71717a" }}>{clip.subject} - {clip.stage}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#52525b" }}>لا يحتوي شرائح</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {allClips.length === 0 && regularClips.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525b" }}>لا توجد مقاطع بعد</div>
      )}
    </div>
  );

  return (
    <div>
      <button onClick={() => { setSelClip(null); setEditIdx(null); }}
        style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
        رجوع للقائمة
      </button>
      <div style={{ ...C.card, border: "1px solid rgba(139,92,246,0.3)", marginBottom: "14px" }}>
        <div style={{ fontWeight: "bold", fontSize: "15px", color: "#a855f7", marginBottom: "4px" }}>{selClip.title}</div>
        <div style={{ fontSize: "12px", color: "#71717a" }}>{selClip.subject} - {selClip.stage} - {slides.length} شريحة</div>
      </div>
      {editIdx !== null ? (
        <div style={{ ...C.card, border: "1px solid rgba(56,189,248,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "10px" }}>تعديل الشريحة {editIdx + 1}</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={6} value={editPoints} onChange={e => setEditPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setEditIdx(null)} style={C.cancelBtn}>الغاء</button>
            <button onClick={saveEdit} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Spinner size={15}/> : <Save size={15}/>} حفظ
            </button>
          </div>
        </div>
      ) : showAddSlide ? (
        <div style={{ ...C.card, border: "1px solid rgba(34,197,94,0.2)" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4ade80", marginBottom: "10px" }}>اضافة شريحة جديدة</div>
          <label style={C.label}>عنوان الشريحة</label>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={C.input} placeholder="عنوان الشريحة الجديدة"/>
          <label style={C.label}>النقاط (كل نقطة في سطر جديد)</label>
          <textarea rows={5} value={newPoints} onChange={e => setNewPoints(e.target.value)} style={{ ...C.input, resize: "none" }} placeholder="نقطة 1&#10;نقطة 2&#10;نقطة 3"/>
          <div style={C.saveRow}>
            <button onClick={() => setShowAddSlide(false)} style={C.cancelBtn}>الغاء</button>
            <button onClick={addSlide} disabled={saving} style={{ ...C.saveBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {saving ? <Spinner size={15}/> : <Plus size={15}/>} اضافة
            </button>
          </div>
        </div>
      ) : (
        <>
          {confirmDel !== null && (
            <div style={C.confirmBox}>
              <div style={{ color: "#f87171", fontWeight: "bold", marginBottom: "8px" }}>هل تريد حذف الشريحة {confirmDel + 1}؟</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button onClick={() => deleteSlide(confirmDel)} style={{ padding: "8px 20px", backgroundColor: "#ef4444", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>نعم</button>
                <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 20px", backgroundColor: "#27272a", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer" }}>لا</button>
              </div>
            </div>
          )}
          {slides.map((sl, idx) => (
            <div key={idx} style={{ ...C.card, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "2px" }}>شريحة {idx + 1}</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "6px" }}><MathText text={sl.title}/></div>
                  {(sl.points || []).slice(0, 2).map((p, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "2px" }}>◆ <MathText text={p}/></div>
                  ))}
                  {(sl.points || []).length > 2 && (
                    <div style={{ fontSize: "11px", color: "#52525b" }}>+{sl.points.length - 2} نقاط اخرى</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginRight: "8px" }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === 0 ? "#1c1c1e" : "#27272a", color: idx === 0 ? "#3f3f46" : "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", fontSize: "12px" }}>↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === slides.length - 1} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: idx === slides.length - 1 ? "#1c1c1e" : "#27272a", color: idx === slides.length - 1 ? "#3f3f46" : "#fff", cursor: idx === slides.length - 1 ? "not-allowed" : "pointer", fontSize: "12px" }}>↓</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => openEdit(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>تعديل</button>
                <button onClick={() => setConfirmDel(idx)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>حذف</button>
              </div>

              {/* ─── سؤال هذه الشريحة (اختياري) ─── */}
              {qEditIdx === idx ? (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: "10px" }}>
                  <textarea rows={2} value={qDraft.q} onChange={e=>setQDraft(d=>({...d,q:e.target.value}))} placeholder="نص السؤال" style={{...C.input,resize:"none",marginBottom:"8px",fontSize:"12px"}}/>
                  {qDraft.options.map((opt,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                      <input type="radio" name={"correctOpt"+idx} checked={qDraft.correctIndex===i} onChange={()=>setQDraft(d=>({...d,correctIndex:i}))} style={{flexShrink:0}}/>
                      <input value={opt} onChange={e=>{const opts=[...qDraft.options];opts[i]=e.target.value;setQDraft(d=>({...d,options:opts}));}} placeholder={"الخيار "+(i+1)+(i===qDraft.correctIndex?" (صحيح)":"")} style={{flex:1,padding:"8px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff",fontSize:"12px"}}/>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <button onClick={saveQuestion} disabled={saving} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: "linear-gradient(to right,#059669,#4ade80)", color: "#fff", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>حفظ السؤال</button>
                    <button onClick={() => setQEditIdx(null)} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "transparent", color: "#a1a1aa", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>إلغاء</button>
                  </div>
                </div>
              ) : sl.question ? (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: "10px" }}>
                  <div style={{ fontSize: "11px", color: "#facc15", fontWeight: "bold", marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "5px" }}><HelpCircle size={12} style={{marginTop:"1px",flexShrink:0}}/> {sl.question.q}</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openEditQuestion(idx)} style={{ flex: 1, padding: "7px", borderRadius: "7px", border: "1px solid rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.08)", color: "#38bdf8", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>تعديل السؤال</button>
                    <button onClick={() => removeQuestion(idx)} style={{ flex: 1, padding: "7px", borderRadius: "7px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><Trash2 size={11}/> حذف</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  {qGenLoading===idx ? (
                    <div style={{ flex: 1, textAlign: "center", padding: "7px", fontSize: "11px", color: "#facc15" }}><Spinner size={13} color="#facc15"/> جارٍ توليد السؤال...</div>
                  ) : (
                    <>
                      <button onClick={() => openAddQuestion(idx)} style={{ flex: 1, padding: "7px", borderRadius: "7px", border: "1px dashed rgba(250,204,21,0.4)", backgroundColor: "transparent", color: "#facc15", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>+ سؤال يدوي</button>
                      <button onClick={() => generateQuestionAI(idx)} style={{ flex: 1, padding: "7px", borderRadius: "7px", border: "none", background: "linear-gradient(to right,#7c3aed,#a855f7)", color: "#fff", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>🤖 توليد سؤال</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <button onClick={() => { setShowAddSlide(true); setQEditIdx(null); }} style={{ ...C.gradBtn, background: "linear-gradient(to right,#059669,#4ade80)" }}>
            <Plus size={18}/> اضافة شريحة جديدة
          </button>
        </>
      )}
    </div>
  );
}

export { ContentEditor };
