// ─── modals/ChatModal.jsx ────────────────────────────────
// غرفة نقاش لكل مادة — رسائل، ردود، تفاعلات (إيموجي)، وتحديد "أفضل إجابة".
import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp, updateDoc, doc, query, where, orderBy, arrayUnion, arrayRemove } from "firebase/firestore";
import { MessageCircle, User } from "lucide-react";
import { db } from "../firebase";
import { C } from "../styles";
import { showMsg } from "../toast";
import { MHead } from "../components/Shared";

const REACTION_EMOJIS = ["👍","❤️","🤔"];

function ChatModal({onClose, currentStudent, role, subject}) {
  const [msg,setMsg]=useState("");
  const [msgs,setMsgs]=useState([]);
  const [sending,setSending]=useState(false);
  const [chatEnabled,setChatEnabled]=useState(true);
  const [isQuestion,setIsQuestion]=useState(false);
  const [replyingTo,setReplyingTo]=useState(null); // {id,name,text}
  const bottomRef=useRef(null);
  const roomSubject = subject || "عام";
  const myAccount = role==="admin" ? "admin" : (currentStudent?.account||"");

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"settings","chat"),snap=>{
      if(snap.exists()) setChatEnabled(snap.data().enabled!==false);
      else setChatEnabled(true);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(
      query(collection(db,"chat"), where("subject","==",roomSubject), orderBy("sentAt","asc")),
      snap=>{ setMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))); }
    );
    return ()=>unsub();
  },[roomSubject]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[msgs]);

  const send=async()=>{
    if(!msg.trim()||sending) return;
    setSending(true);
    try{
      const name = role==="admin" ? "المدير" : (currentStudent?.name||"طالب");
      const account = myAccount;
      const payload = {
        text:msg.trim(), name, account,
        from: role==="admin"?"admin":"student",
        subject: roomSubject,
        isQuestion,
        sentAt:serverTimestamp()
      };
      if(replyingTo) payload.replyTo = {id:replyingTo.id, name:replyingTo.name, text:replyingTo.text.slice(0,80)};
      await addDoc(collection(db,"chat"), payload);
      setMsg(""); setIsQuestion(false); setReplyingTo(null);
    }catch(e){console.error(e);}
    setSending(false);
  };

  const toggleReaction=async(m,emoji)=>{
    if(!myAccount) return;
    const already = (m.reactions?.[emoji]||[]).includes(myAccount);
    try{
      await updateDoc(doc(db,"chat",m.id),{
        [`reactions.${emoji}`]: already ? arrayRemove(myAccount) : arrayUnion(myAccount)
      });
    }catch(e){console.error(e);}
  };

  const markBestAnswer=async(question,reply)=>{
    try{
      await updateDoc(doc(db,"chat",question.id),{bestAnswerId:reply.id});
      showMsg("⭐ تم اعتماد أفضل إجابة");
    }catch(e){console.error(e);}
  };

  const canMarkBest=(question)=> role==="admin" || question.account===myAccount;

  return <div style={C.overlay}><div style={{...C.modalBox,border:"1px solid rgba(168,85,247,0.2)",display:"flex",flexDirection:"column",maxHeight:"85vh"}}>
    <MHead icon={<MessageCircle size={20} color="#a855f7"/>} title={"نقاش: "+roomSubject} color="#a855f7" onClose={onClose}/>

    {/* النقاش موقوف */}
    {!chatEnabled&&role!=="admin"&&(
      <div style={{textAlign:"center",padding:"24px",backgroundColor:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"12px",marginBottom:"12px"}}>
        <div style={{fontSize:"28px",marginBottom:"8px"}}>🔕</div>
        <div style={{fontWeight:"bold",color:"#f87171",marginBottom:"4px"}}>النقاش موقوف مؤقتاً</div>
        <div style={{fontSize:"12px",color:"#71717a"}}>قام المدير بإيقاف غرفة النقاش</div>
      </div>
    )}

    <div style={{flex:1,backgroundColor:"#09090b",borderRadius:"12px",padding:"12px",marginBottom:"12px",overflowY:"auto",minHeight:"200px",maxHeight:"340px"}}>
      {msgs.length===0&&<div style={{textAlign:"center",color:"#52525b",fontSize:"13px",padding:"20px"}}>لا توجد رسائل بعد بهذه المادة — كن أول من يكتب!</div>}
      {msgs.map((m,i)=>{
        const isMe = m.account===myAccount;
        return (
          <div key={m.id||i} style={{display:"flex",gap:"8px",marginBottom:"12px",justifyContent:isMe?"flex-end":"flex-start"}}>
            {!isMe&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><User size={14} color="#fff"/></div>}
            <div style={{maxWidth:"78%"}}>
              {m.replyTo&&<div style={{fontSize:"10px",color:"#a1a1aa",backgroundColor:"rgba(255,255,255,0.04)",borderRight:"2px solid rgba(168,85,247,0.4)",padding:"3px 8px",borderRadius:"6px",marginBottom:"3px"}}>↩ {m.replyTo.name}: {m.replyTo.text}</div>}
              <div style={{backgroundColor:isMe?"rgba(168,85,247,0.2)":m.from==="admin"?"rgba(251,191,36,0.1)":"#1c1c1e",borderRadius:"10px",padding:"8px 12px",border:m.from==="admin"?"1px solid rgba(251,191,36,0.3)":m.isQuestion?"1px solid rgba(56,189,248,0.35)":"none"}}>
                <div style={{fontSize:"10px",color:m.from==="admin"?"#fbbf24":"#71717a",marginBottom:"2px",fontWeight:"bold",display:"flex",alignItems:"center",gap:"5px"}}>
                  {m.name}{m.account&&m.from!=="admin"?" @"+m.account:""}
                  {m.isQuestion&&<span style={{color:"#38bdf8",fontSize:"9px",fontWeight:"bold"}}>❓ سؤال</span>}
                </div>
                <div style={{fontSize:"13px",color:"#fff"}}>{m.text}</div>
                {m.bestAnswerId&&<div style={{fontSize:"10px",color:"#4ade80",marginTop:"4px",fontWeight:"bold"}}>⭐ تم اعتماد إجابة لهذا السؤال</div>}
              </div>
              {/* أزرار التفاعل والرد */}
              <div style={{display:"flex",gap:"6px",marginTop:"3px",flexWrap:"wrap",alignItems:"center"}}>
                {REACTION_EMOJIS.map(em=>{
                  const users=m.reactions?.[em]||[];
                  const mine=users.includes(myAccount);
                  return (
                    <button key={em} onClick={()=>toggleReaction(m,em)} style={{fontSize:"11px",padding:"2px 6px",borderRadius:"8px",border:mine?"1px solid rgba(168,85,247,0.5)":"1px solid rgba(255,255,255,0.08)",backgroundColor:mine?"rgba(168,85,247,0.15)":"transparent",color:"#cbd5e1",cursor:"pointer"}}>{em}{users.length>0?" "+users.length:""}</button>
                  );
                })}
                <button onClick={()=>setReplyingTo({id:m.id,name:m.name,text:m.text})} style={{fontSize:"11px",color:"#818cf8",background:"none",border:"none",cursor:"pointer"}}>↩ رد</button>
                {/* زر اعتماد كأفضل إجابة: يظهر على أي رد لسؤال يملكه صاحبه أو المدير */}
                {(()=>{
                  if(!m.replyTo) return null;
                  const question = msgs.find(q=>q.id===m.replyTo.id);
                  if(!question || !canMarkBest(question) || question.bestAnswerId===m.id) return null;
                  return <button onClick={()=>markBestAnswer(question,m)} style={{fontSize:"11px",color:"#fbbf24",background:"none",border:"none",cursor:"pointer"}}>⭐ اعتماد كأفضل إجابة</button>;
                })()}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef}/>
    </div>

    {/* معاينة الرد قبل الإرسال */}
    {replyingTo&&<div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:"8px",padding:"6px 10px",marginBottom:"8px",fontSize:"11px"}}>
      <span style={{flex:1,color:"#cbd5e1"}}>↩ رد على {replyingTo.name}: {replyingTo.text.slice(0,50)}</span>
      <button onClick={()=>setReplyingTo(null)} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"14px"}}>✕</button>
    </div>}

    {/* حقل الإرسال — يُعطَّل للطلاب لما النقاش موقوف */}
    {(chatEnabled||role==="admin")&&<div>
      <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"#a1a1aa",marginBottom:"6px",cursor:"pointer"}}>
        <input type="checkbox" checked={isQuestion} onChange={e=>setIsQuestion(e.target.checked)}/> علّم هذه الرسالة كسؤال ❓
      </label>
      <div style={{display:"flex",gap:"8px"}}>
        <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="اكتب رسالتك..." style={{flex:1,padding:"10px 14px",backgroundColor:"#09090b",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",color:"#fff",fontSize:"13px",outline:"none"}}/>
        <button onClick={send} disabled={sending||!msg.trim()} style={{padding:"10px 14px",backgroundColor:"#a855f7",border:"none",borderRadius:"10px",color:"#fff",cursor:"pointer",fontWeight:"bold",opacity:sending||!msg.trim()?0.5:1}}>إرسال</button>
      </div>
    </div>}
  </div></div>;
}

export { ChatModal };
