// ─── modals/BrowseSearchModal.jsx ────────────────────────
// يجمع وظيفتين مختلفتين بنافذة واحدة بتبويبين داخليين: "تصفح بالتصنيف"
// (مرحلة→صف→مادة→فصل) و"بحث دقيق" (بالاسم/المادة/المعلم/رقم الصفحة مباشرة).
// يُصدّر أيضاً NotificationsModal (نافذة الإشعارات للطالب) لصغر حجمها وقربها
// من هذا الملف بالكود الأصلي.
import React, { useState } from "react";
import { BookOpen, Search, Lock, Layers, Film, Bell } from "lucide-react";
import { C } from "../styles";
import { STAGES, GRADES } from "../constants";
import { isFreeSubject, topicKey } from "../helpers";
import { showMsg } from "../toast";
import { MHead } from "../components/Shared";

function BrowseModalContent({onClose, clips, globalPrices, onBrowse, role, examScores}) {
  const [step,setStep]=useState("stage");
  const [selStage,setSelStage]=useState("");
  const [selGrade,setSelGrade]=useState("");
  const [selSubject,setSelSubject]=useState("");
  const [searchQuery,setSearchQuery]=useState("");

  const availableSubjects = React.useMemo(()=>{
    if(!selStage||!selGrade) return [];
    const subjs=new Set();
    // نعرض فقط المواد المحدد لها نفس الصف تحديداً (مو كل المرحلة) — كل مادة معنونة لصفها الفعلي
    clips.forEach(c=>{ if(c.stage===selStage&&c.grade===selGrade) subjs.add(c.subject); });
    return [...subjs].sort();
  },[clips,selStage,selGrade]);

  const availableTopics = React.useMemo(()=>{
    if(!selStage||!selGrade||!selSubject) return [];
    // نرتب الفصول حسب تسلسلها الفعلي بالمنهج (أصغر رقم مقطع بكل فصل)، مو أبجدياً
    const topicMinNum={};
    clips.forEach(c=>{
      if(c.stage===selStage&&c.grade===selGrade&&c.subject===selSubject&&c.topic){
        const n=Number(c.num||0);
        if(!(c.topic in topicMinNum) || n<topicMinNum[c.topic]) topicMinNum[c.topic]=n;
      }
    });
    return Object.keys(topicMinNum).sort((a,b)=>topicMinNum[a]-topicMinNum[b]);
  },[clips,selStage,selGrade,selSubject]);

  // بحث سريع عبر كل المقاطع (بغض النظر عن الخطوة الحالية) — بالاسم أو المادة أو المعلم أو الفصل
  const searchResults = React.useMemo(()=>{
    const q=searchQuery.trim();
    if(!q) return [];
    // نجمّع نتائج البحث حسب "فصل" فريد (مادة+مرحلة+فصل)، عشان ما نكرر نفس الفصل لعدة مقاطع
    const seen=new Set();
    const results=[];
    clips.forEach(c=>{
      const hit = c.title?.includes(q)||c.subject?.includes(q)||c.teacher?.includes(q)||c.topic?.includes(q);
      if(!hit) return;
      const key = c.subject+"__"+c.stage+"__"+(c.topic||"");
      if(seen.has(key)) return;
      seen.add(key);
      results.push(c);
    });
    return results.slice(0,30);
  },[clips,searchQuery]);

  const stageEmoji={"الابتدائية":"🏫","المتوسطة":"📚","الإعدادية":"🎓"};

  return <>
    {/* بحث سريع — يبحث بالمادة أو المعلم أو الفصل أو اسم المقطع، بغض النظر عن خطوة التصفح الحالية */}
    <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="ابحث بالمادة أو المعلم أو الفصل..." style={{...C.input,marginBottom:searchQuery.trim()?"10px":"14px"}}/>

    {searchQuery.trim()?(
      <div>
        {searchResults.length===0
          ?<div style={{textAlign:"center",padding:"20px",color:"#52525b",fontSize:"13px"}}>لا توجد نتائج مطابقة</div>
          :searchResults.map((c,i)=>{
            const isFree=isFreeSubject(globalPrices,c.subject,c.stage);
            return <div key={i} onClick={()=>{onBrowse(c.subject,c.stage,c.grade||"",c.topic||"",isFree);onClose();}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:`1px solid ${isFree?"rgba(52,211,153,0.2)":"rgba(129,140,248,0.2)"}`}}>
              <div style={{width:"40px",height:"40px",borderRadius:"10px",background:"rgba(129,140,248,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><BookOpen size={17} color="#818cf8"/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:"bold",fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.topic||c.title}</div>
                <div style={{fontSize:"11px",color:"#71717a"}}>{c.subject} • {c.stage}{c.grade?" • الصف "+c.grade:""}{c.teacher?" • "+c.teacher:""}</div>
              </div>
              <span style={{color:isFree?"#34d399":"#818cf8",fontSize:"16px",flexShrink:0}}>←</span>
            </div>;
          })
        }
      </div>
    ):<>

    {/* خبز الفتات */}
    {selStage&&<div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"14px",fontSize:"12px",flexWrap:"wrap"}}>
      <span style={{color:"#818cf8",cursor:"pointer"}} onClick={()=>{setStep("stage");setSelStage("");setSelGrade("");setSelSubject("");}}>المراحل</span>
      {selStage&&<><span style={{color:"#52525b"}}>←</span>
        <span style={{color:selGrade?"#818cf8":"#fff",cursor:selGrade?"pointer":"default"}}
          onClick={()=>{if(selGrade){setStep("grade");setSelGrade("");setSelSubject("");}}}>{selStage}</span></>}
      {selGrade&&<><span style={{color:"#52525b"}}>←</span>
        <span style={{color:selSubject?"#818cf8":"#fff",cursor:selSubject?"pointer":"default"}}
          onClick={()=>{if(selSubject){setStep("subject");setSelSubject("");}}}>الصف {selGrade}</span></>}
      {selSubject&&<><span style={{color:"#52525b"}}>←</span><span style={{color:"#fff"}}>{selSubject}</span></>}
    </div>}

    {/* خطوة ١: المرحلة */}
    {step==="stage"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المرحلة الدراسية</div>
      {STAGES.map(s=>(
        <div key={s} onClick={()=>{setSelStage(s);setStep("grade");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(129,140,248,0.2)"}}>
          <span style={{fontSize:"32px"}}>{stageEmoji[s]||"📖"}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:"bold",fontSize:"15px"}}>{s}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{clips.filter(c=>c.stage===s).length} مقطع</div>
          </div>
          <span style={{color:"#818cf8",fontSize:"18px"}}>←</span>
        </div>
      ))}
    </div>}

    {/* خطوة ٢: الصف */}
    {step==="grade"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الصف الدراسي</div>
      {(GRADES[selStage]||["الأول","الثاني","الثالث"]).map((g,i)=>{
        const count=clips.filter(c=>c.stage===selStage&&c.grade===g).length;
        return <div key={g} onClick={()=>{setSelGrade(g);setStep("subject");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px",border:"1px solid rgba(129,140,248,0.2)"}}>
          <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:"bold",color:"#fff",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:"bold",fontSize:"15px"}}>الصف {g}</div>
            <div style={{fontSize:"11px",color:"#71717a"}}>{count} مقطع</div>
          </div>
          <span style={{color:"#818cf8",fontSize:"18px"}}>←</span>
        </div>;
      })}
    </div>}

    {/* خطوة ٣: المادة */}
    {step==="subject"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر المادة</div>
      {availableSubjects.length===0
        ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}>لا توجد مواد لهذا الصف</div>
        :availableSubjects.map(subj=>{
          const isFree=isFreeSubject(globalPrices,subj,selStage);
          const count=clips.filter(c=>c.stage===selStage&&c.subject===subj).length;
          const hasTopics=clips.some(c=>c.stage===selStage&&c.subject===subj&&c.topic);
          return <div key={subj} onClick={()=>{setSelSubject(subj);setStep("topic");}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:`1px solid ${isFree?"rgba(52,211,153,0.3)":"rgba(129,140,248,0.2)"}`}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:isFree?"linear-gradient(135deg,#059669,#34d399)":"linear-gradient(135deg,#4f46e5,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <BookOpen size={20} color="#fff"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px"}}>{subj}</div>
              <div style={{fontSize:"11px",color:"#71717a"}}>{count} مقطع • {isFree?"🆓 مجاني":"💰 مدفوع"}{hasTopics?" • فيها مباحث":""}</div>
            </div>
            <span style={{color:isFree?"#34d399":"#818cf8",fontSize:"18px"}}>←</span>
          </div>;
        })
      }
    </div>}

    {/* خطوة ٤: الفصل */}
    {step==="topic"&&<div>
      <div style={{fontSize:"13px",color:"#71717a",marginBottom:"12px",textAlign:"center"}}>اختر الفصل</div>
      <div onClick={()=>{const isFree=isFreeSubject(globalPrices,selSubject,selStage);onBrowse(selSubject,selStage,selGrade,"",isFree);onClose();}} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",border:"1px solid rgba(56,189,248,0.3)"}}>
        <div style={{width:"44px",height:"44px",borderRadius:"12px",background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"20px"}}>📋</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:"bold",fontSize:"14px"}}>كل الفصول</div>
          <div style={{fontSize:"11px",color:"#71717a"}}>جميع مقاطع {selSubject}</div>
        </div>
        <span style={{color:"#38bdf8",fontSize:"18px"}}>←</span>
      </div>
      {availableTopics.length===0
        ?<div style={{textAlign:"center",padding:"16px",color:"#52525b",fontSize:"12px"}}>لا توجد فصول محددة — اضغط "كل الفصول" أعلاه</div>
        :availableTopics.map((topic,i)=>{
          const isFree=isFreeSubject(globalPrices,selSubject,selStage);
          const count=clips.filter(c=>c.stage===selStage&&c.subject===selSubject&&c.topic===topic).length;
          // الفصل مقفول إذا كان الطالب لم يجتز امتحان الفصل الذي يسبقه بالتسلسل (الفصل الأول دائماً مفتوح)
          const prevTopic = i>0 ? availableTopics[i-1] : null;
          const locked = role==="student" && prevTopic && !examScores?.[topicKey(selSubject,selStage,prevTopic)]?.passed;
          return <div key={topic} onClick={()=>{
            if(locked){ showMsg("🔒 يجب اجتياز امتحان فصل \""+prevTopic+"\" أولاً بنسبة 60% على الأقل"); return; }
            onBrowse(selSubject,selStage,selGrade,topic,isFree);onClose();
          }} style={{...C.card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px",opacity:locked?0.55:1,border:`1px solid ${locked?"rgba(255,255,255,0.08)":isFree?"rgba(52,211,153,0.2)":"rgba(129,140,248,0.2)"}`}}>
            <div style={{width:"44px",height:"44px",borderRadius:"12px",background:locked?"rgba(255,255,255,0.05)":"rgba(129,140,248,0.15)",border:`1px solid ${locked?"rgba(255,255,255,0.1)":"rgba(129,140,248,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"16px",fontWeight:"bold",color:locked?"#71717a":"#818cf8"}}>
              {locked?<Lock size={16}/>:i+1}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold",fontSize:"14px",color:locked?"#71717a":"#fff"}}>{topic}</div>
              <div style={{fontSize:"11px",color:locked?"#f87171":"#71717a"}}>{locked?"🔒 يتطلب اجتياز امتحان الفصل السابق":count+" مقطع • "+(isFree?"🆓 كامل":"💰 أول 5 + عشوائي")}</div>
            </div>
            {!locked&&<span style={{color:isFree?"#34d399":"#818cf8",fontSize:"18px"}}>←</span>}
          </div>;
        })
      }
    </div>}
    </>}
  </>;
}

function SearchModalContent({onClose,allVideos,onSelectVideo,clips,examScores,role}) {
  const [q,setQ]=useState("");
  // رقم الصفحة قد يكون مدى ("120-121")، فنتحقق رقمياً هل رقم البحث يقع ضمن
  // المدى، أو يطابق رقم صفحة مفردة تطابقاً دقيقاً — عمداً بدون أي مطابقة نصية
  // جزئية (Substring) على الأرقام، لأنها كانت تسبب نتائج خاطئة (بحث "16" كان
  // يطابق أي رقم يحتوي "16" بأي مكان منه، مثل 160 و165 و216... إلخ)
  const matchesPage = (pageStr, query) => {
    if(!pageStr) return false;
    const p = String(pageStr).trim();
    if(p===query) return true; // مطابقة نصية دقيقة كاملة (يغطي مدى مكتوب بالكامل زي "120-121")
    const qNum = Number(query);
    if(!Number.isFinite(qNum)) return false; // البحث نفسه مو رقم، ما ينفع يطابق صفحة أصلاً
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if(range){ const [,a,b]=range; return qNum>=Number(a)&&qNum<=Number(b); }
    return Number(p)===qNum;
  };
  // نقسّم نص البحث لكلمات منفصلة، وكل كلمة لازم تطابق حقل واحد على الأقل
  // (عنوان/مادة/معلم/صف/صفحة) — يعني البحث "الرياضيات 100" يشترط وجود
  // "الرياضيات" بمكان ما (المادة مثلاً) و"100" بمكان ما (رقم الصفحة) بنفس
  // النتيجة، مو بحث عن الجملة الكاملة كنص واحد حرفي
  const terms = q.trim().split(/\s+/).filter(Boolean);
  const matchesTerm = (v, term) =>
    v.title?.includes(term)||v.subject?.includes(term)||v.teacher?.includes(term)||v.grade?.includes(term)||matchesPage(v.page,term);
  const filtered=allVideos.map((v,idx)=>({...v,_idx:idx})).filter(v=>
    terms.length===0 || terms.every(t=>matchesTerm(v,t))
  );

  // ─── فحص قفل الفصل — بنفس منطق تبويب "تصفح" بالضبط (ما ينفع نتيجة بحث
  // تتجاوز نظام القفل، وإلا صار البحث ثغرة يلتف فيها الطالب على شرط اجتياز
  // امتحان الفصل السابق بنسبة 60% قبل ما يفتح الفصل التالي) ───────────────
  // نحسب ترتيب الفصول الفعلي (بأصغر رقم مقطع بكل فصل) لكل مادة+مرحلة+صف على
  // حدة، مرة وحدة بس، ونعيد استخدامه لكل نتائج البحث
  const topicOrderMap = React.useMemo(()=>{
    if(!clips) return {};
    const map={}; // "subject__stage__grade" -> [topics بالترتيب]
    const minNum={};
    clips.forEach(c=>{
      if(!c.topic) return;
      const key = c.subject+"__"+c.stage+"__"+(c.grade||"");
      const n = Number(c.num||0);
      if(!minNum[key]) minNum[key]={};
      if(!(c.topic in minNum[key]) || n<minNum[key][c.topic]) minNum[key][c.topic]=n;
    });
    Object.keys(minNum).forEach(key=>{
      map[key] = Object.keys(minNum[key]).sort((a,b)=>minNum[key][a]-minNum[key][b]);
    });
    return map;
  },[clips]);

  const getLockInfo = (v) => {
    if(role!=="student"||!v.topic) return {locked:false};
    const key = v.subject+"__"+v.stage+"__"+(v.grade||"");
    const topics = topicOrderMap[key]||[];
    const idx = topics.indexOf(v.topic);
    if(idx<=0) return {locked:false}; // أول فصل، أو فصل غير مصنّف بترتيب — مفتوح دائماً
    const prevTopic = topics[idx-1];
    const locked = !examScores?.[topicKey(v.subject,v.stage,prevTopic)]?.passed;
    return {locked, prevTopic};
  };

  return <>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن درس أو مادة أو معلم أو رقم صفحة..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
    </div>
    {q&&<div style={{fontSize:"11px",color:"#71717a",marginBottom:"8px"}}>{filtered.length} نتيجة</div>}
    {filtered.slice(0,20).map((v,i)=>{
      const {locked,prevTopic} = getLockInfo(v);
      return (
        <div key={i} onClick={()=>{
            if(locked){ showMsg("🔒 يجب اجتياز امتحان فصل \""+prevTopic+"\" أولاً بنسبة 60% على الأقل"); return; }
            onSelectVideo(v._idx,v);onClose();
          }} style={{display:"flex",alignItems:"center",gap:"10px",...C.card,cursor:"pointer",marginBottom:"6px",opacity:locked?0.55:1,border:locked?"1px solid rgba(255,255,255,0.08)":undefined}}>
          <div style={{width:36,height:36,borderRadius:"8px",background:locked?"rgba(255,255,255,0.05)":(v.bg||"linear-gradient(135deg,#1e1b4b,#312e81)"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {locked?<Lock size={15} color="#71717a"/>:v.type==="شرائح AI"?<Layers size={16} color="#c4b5fd"/>:<Film size={16} color="#fff"/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:locked?"#71717a":"#fff"}}>{v.num?`#${v.num} `:""}{v.title}</div>
            <div style={{fontSize:"11px",color:locked?"#f87171":"#71717a"}}>{locked?"🔒 يتطلب اجتياز امتحان الفصل السابق":`${v.subject} • ${v.stage}${v.grade?` • الصف ${v.grade}`:""}${v.page?` • صفحة ${v.page}`:""}`}</div>
          </div>
          {!locked&&<div style={{fontSize:"10px",color:"#38bdf8",flexShrink:0}}>انتقال ←</div>}
        </div>
      );
    })}
    {filtered.length===0&&q&&<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Search size={36} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div>لا توجد نتائج لـ "{q}"</div></div>}
  </>;
}

// ─── SAVED MODAL ─────────────────────────────────────────
// ─── BROWSE + SEARCH MODAL (دمج زري "تصفح" و"البحث" بنافذة واحدة) ───
// الاثنين مختلفان بالوظيفة فعلياً: "تصفح" ينتقل خطوة بخطوة (مرحلة→صف→مادة→فصل)
// ويودّي لبداية الفصل، بينما "بحث دقيق" يوديك مباشرة لمقطع/شريحة محددة بالضبط
// (بما فيها البحث برقم الصفحة). عشان كذا نحافظ عليهم منفصلين تماماً كتبويبين
// داخليين بدل خلط منطقهم، بس بزر دخول واحد بمكان زرين منفصلين سابقاً.
function BrowseSearchModal({onClose, clips, globalPrices, onBrowse, role, examScores, allVideos, onSelectVideo}) {
  const [tab,setTab]=useState("browse"); // "browse" | "search"
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(99,102,241,0.3)"}}>
    <MHead icon={tab==="browse"?<BookOpen size={20} color="#818cf8"/>:<Search size={20} color="#38bdf8"/>} title={tab==="browse"?"تصفح المواد":"بحث دقيق"} color={tab==="browse"?"#818cf8":"#38bdf8"} onClose={onClose}/>

    {/* تبويبان — يحافظان على الوظيفتين منفصلتين تماماً بدون أي خلط بمنطقهما */}
    <div style={{display:"flex",gap:"6px",marginBottom:"14px",backgroundColor:"rgba(255,255,255,0.03)",borderRadius:"10px",padding:"4px"}}>
      <button onClick={()=>setTab("browse")} style={{flex:1,padding:"8px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"bold",backgroundColor:tab==="browse"?"rgba(129,140,248,0.18)":"transparent",color:tab==="browse"?"#818cf8":"#71717a"}}>
        <BookOpen size={13} style={{verticalAlign:"middle",marginLeft:"4px"}}/> تصفح بالتصنيف
      </button>
      <button onClick={()=>setTab("search")} style={{flex:1,padding:"8px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"bold",backgroundColor:tab==="search"?"rgba(56,189,248,0.18)":"transparent",color:tab==="search"?"#38bdf8":"#71717a"}}>
        <Search size={13} style={{verticalAlign:"middle",marginLeft:"4px"}}/> بحث دقيق (بالصفحة)
      </button>
    </div>

    {tab==="browse"
      ?<BrowseModalContent onClose={onClose} clips={clips} globalPrices={globalPrices} onBrowse={onBrowse} role={role} examScores={examScores}/>
      :<SearchModalContent onClose={onClose} allVideos={allVideos} onSelectVideo={onSelectVideo} clips={clips} examScores={examScores} role={role}/>
    }
  </div></div>;
}

// ─── NOTIFICATIONS MODAL (للطالب) ────────────────────────
function NotificationsModal({onClose,notifications}) {
  const formatTime=(ts)=>{
    if(!ts?.seconds) return "";
    try{ return new Date(ts.seconds*1000).toLocaleString("ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
    catch{ return ""; }
  };
  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(56,189,248,0.2)"}}>
    <MHead icon={<Bell size={20} color="#38bdf8"/>} title="الإشعارات" color="#38bdf8" onClose={onClose}/>
    {notifications.length===0
      ?<div style={{textAlign:"center",padding:"24px",color:"#52525b"}}><Bell size={40} color="#3f3f46" style={{margin:"0 auto 8px"}}/><div style={{fontSize:"14px"}}>لا توجد إشعارات حتى الآن</div></div>
      :notifications.map((n,i)=>(
        <div key={n.id||i} style={{...C.card,border:n.targetPhone?"1px solid rgba(168,85,247,0.25)":"1px solid rgba(56,189,248,0.15)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"4px"}}>
            <div style={{fontWeight:"bold",fontSize:"14px"}}>{n.title}</div>
            {n.targetPhone&&<span style={{backgroundColor:"rgba(168,85,247,0.15)",color:"#c4b5fd",fontSize:"10px",padding:"2px 8px",borderRadius:"6px",flexShrink:0}}>خاص بك</span>}
          </div>
          <div style={{fontSize:"13px",color:"#cbd5e1",lineHeight:"1.6",marginBottom:"6px"}}>{n.body}</div>
          <div style={{fontSize:"11px",color:"#52525b"}}>{formatTime(n.sentAt)}</div>
        </div>
      ))
    }
  </div></div>;
}

export { BrowseModalContent, SearchModalContent, BrowseSearchModal, NotificationsModal };
