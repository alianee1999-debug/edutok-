// ─── modals/VideoDescriptionModal.jsx ────────────────────
// شاشة "تقدّمي" — تقدّم الطالب بفصل المقطع الحالي فقط (منفصلة تماماً عن أي
// محتوى متعلق بالاشتراكات، راجع SubscriptionDetailsModal لذلك).
import React from "react";
import { ClipboardList } from "lucide-react";
import { C } from "../styles";
import { MAX_SKIPPED_CLIPS, topicKey } from "../helpers";
import { MHead, FirstUseTip } from "../components/Shared";

function VideoDescriptionModal({onClose,video,role,videoIdx,totalVideos,clips,watchedClipIds,examScores,allVideos,onJumpToVideo}) {
  // ─── تقدّم الطالب بفصل هذا المقطع (لو منتمي لفصل محدد) ───
  // نحسبها هنا بدل ما نعتمد على أي حالة جاهزة، عشان تنعكس فوراً بمجرد ما
  // يتغيّر watchedClipIds (بعد إكمال مشاهدة مقطع جديد مثلاً)
  const chapterInfo = (()=>{
    if(role!=="student"||!video.topic||!video.subject||!clips) return null;
    const topicClips = clips.filter(c=>c.subject===video.subject && c.stage===video.stage && c.topic===video.topic)
      .sort((a,b)=>Number(a.num||0)-Number(b.num||0));
    if(topicClips.length===0) return null;
    const watchedCount = topicClips.filter(c=>watchedClipIds?.includes(c.id)).length;
    const missingCount = topicClips.length - watchedCount;
    const unlocked = missingCount<=MAX_SKIPPED_CLIPS;
    const remainingAllowance = Math.max(0, MAX_SKIPPED_CLIPS - missingCount);
    const stillNeededToUnlock = Math.max(0, missingCount - MAX_SKIPPED_CLIPS);
    const missingClips = topicClips.filter(c=>!watchedClipIds?.includes(c.id));
    const firstUnwatched = missingClips[0] || null;
    const tKey = topicKey(video.subject,video.stage,video.topic);
    const score = examScores?.[tKey];
    return {topicClips,watchedCount,missingCount,unlocked,remainingAllowance,stillNeededToUnlock,firstUnwatched,missingClips,score};
  })();

  const jumpToClip = (clip) => {
    if(!clip||!allVideos||!onJumpToVideo) return;
    const idx = allVideos.findIndex(v=>v.id===clip.id);
    if(idx>=0){ onJumpToVideo(idx); onClose(); }
  };

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(255,255,255,0.1)"}}>
    <MHead icon={<ClipboardList size={20} color="#38bdf8"/>} title="تقدّمي بالفصل" color="#38bdf8" onClose={onClose}/>

    {/* رقم المقطع */}
    {totalVideos>0&&<div style={{textAlign:"center",marginBottom:"10px"}}>
      <span style={{backgroundColor:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.3)",borderRadius:"20px",padding:"4px 14px",fontSize:"12px",color:"#38bdf8",fontWeight:"bold"}}>
        {video.type==="شرائح AI"?"شريحة":"مقطع"} رقم {video.num||(videoIdx+1)}
      </span>
    </div>}

    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
      <h2 style={{fontSize:"17px",fontWeight:"bold",margin:0}}>{video.title}</h2>
      <span style={{backgroundColor:"rgba(14,116,144,0.3)",border:"1px solid #0e7490",color:"#22d3ee",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.type||"معلم"}</span>
      {video.duration&&<span style={{backgroundColor:"rgba(255,255,255,0.08)",color:"#d1d5db",padding:"2px 8px",borderRadius:"6px",fontSize:"11px"}}>{video.duration}</span>}
    </div>
    <p style={{fontSize:"13px",color:"#cbd5e1",margin:"0 0 14px"}}>‍ {video.teacher} • {video.subject} • {video.stage}{video.grade?" - الصف "+video.grade:""}</p>

    {chapterInfo&&<FirstUseTip tipKey="chapter_progress_card" text="📊 هذي البطاقة تعرض كم مقطع شاهدت من الفصل، وتنبهك قبل ما يُقفل الامتحان — تقدر تتابع تقدّمك بأي وقت من هنا."/>}

    {/* تقدّم الفصل — شريط تقدّم + تحذير عند اقتراب الحد + رابط نتيجة الامتحان + زر الانتقال لأول مقطع غير مشاهد */}
    {chapterInfo?(
      <div style={{backgroundColor:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"12px 14px",marginBottom:"12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
          <div style={{fontSize:"12px",fontWeight:"bold",color:"#e4e4e7"}}>تقدّمك بفصل «{video.topic}»</div>
          <div dir="ltr" style={{fontSize:"12px",fontWeight:"900",color:chapterInfo.missingCount===0?"#4ade80":chapterInfo.unlocked?"#38bdf8":"#f87171"}}>
            {chapterInfo.watchedCount} / {chapterInfo.topicClips.length}
          </div>
        </div>

        <div style={{width:"100%",height:"6px",backgroundColor:"rgba(255,255,255,0.08)",borderRadius:"4px",overflow:"hidden",marginBottom:"10px"}}>
          <div style={{width:(chapterInfo.watchedCount/chapterInfo.topicClips.length*100)+"%",height:"100%",backgroundColor:chapterInfo.missingCount===0?"#4ade80":chapterInfo.unlocked?"#38bdf8":"#f87171",borderRadius:"4px",transition:"width 0.4s ease"}}/>
        </div>

        {chapterInfo.missingCount===0?(
          <div style={{fontSize:"12px",color:"#4ade80",marginBottom:chapterInfo.score!=null?"8px":0}}>✓ أكملت كل مقاطع هذا الفصل</div>
        ):chapterInfo.unlocked?(
          <div style={{fontSize:"12px",color:chapterInfo.remainingAllowance<=1?"#fbbf24":"#a1a1aa",marginBottom:"8px"}}>
            {chapterInfo.remainingAllowance<=1
              ?`⚠️ فوّت ${chapterInfo.missingCount} مقطع — مقطع واحد إضافي وراح يُقفل الامتحان`
              :`فوّت ${chapterInfo.missingCount} من ${chapterInfo.topicClips.length} — يقدر يفوّت ${chapterInfo.remainingAllowance} إضافي ولسه الامتحان متاح`}
          </div>
        ):(
          <div style={{fontSize:"12px",color:"#f87171",marginBottom:"8px"}}>
            🔒 الامتحان مقفل حالياً — شاهد {chapterInfo.stillNeededToUnlock} مقطع إضافي على الأقل ليفتح
          </div>
        )}

        {chapterInfo.score!=null&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:chapterInfo.score>=60?"rgba(74,222,128,0.08)":"rgba(248,113,113,0.08)",border:`1px solid ${chapterInfo.score>=60?"rgba(74,222,128,0.25)":"rgba(248,113,113,0.25)"}`,borderRadius:"8px",padding:"7px 10px",marginBottom:chapterInfo.firstUnwatched?"8px":0}}>
            <span style={{fontSize:"12px",color:"#d4d4d8"}}>نتيجتك بامتحان هذا الفصل</span>
            <span style={{fontSize:"13px",fontWeight:"900",color:chapterInfo.score>=60?"#4ade80":"#f87171"}}>{chapterInfo.score}%</span>
          </div>
        )}

        {chapterInfo.firstUnwatched&&(
          <div style={{marginTop:"4px"}}>
            <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px",fontWeight:"bold"}}>المقاطع الناقصة ({chapterInfo.missingClips.length}):</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"200px",overflowY:"auto"}}>
              {chapterInfo.missingClips.map(clip=>(
                <button key={clip.id} onClick={()=>jumpToClip(clip)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 10px",borderRadius:"8px",border:"1px solid rgba(56,189,248,0.25)",backgroundColor:"rgba(56,189,248,0.06)",color:"#e4e4e7",fontSize:"12px",cursor:"pointer",textAlign:"right"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{clip.num?`#${clip.num} `:""}{clip.title}</span>
                  <span style={{color:"#38bdf8",fontSize:"11px",flexShrink:0,marginRight:"8px"}}>مشاهدة ←</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    ):(
      <div style={{backgroundColor:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"14px",textAlign:"center",fontSize:"12px",color:"#71717a"}}>
        هذا المقطع غير تابع لفصل محدد، فلا يوجد تقدّم أو امتحان مرتبط به.
      </div>
    )}
  </div></div>;
}

export { VideoDescriptionModal };
