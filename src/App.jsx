<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App.jsx</title>
<style>
body { margin: 0; background: #1e1e1e; color: #d4d4d4; font-family: monospace; }
#header { padding: 10px; background: #333; position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; }
button { padding: 8px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
#code { padding: 16px; white-space: pre; font-size: 12px; line-height: 1.5; overflow-x: auto; }
#msg { color: #4ade80; margin-right: 10px; display: none; }
</style>
</head>
<body>
<div id="header">
  <span style="color:#38bdf8;font-weight:bold;">App.jsx — 1457 lines</span>
  <div>
    <span id="msg">Copied!</span>
    <button onclick="copyCode()">Copy All</button>
  </div>
</div>
<pre id="code">import React, { useState, useEffect, useRef } from &quot;react&quot;;
import { initializeApp } from &quot;firebase/app&quot;;
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, updateDoc, doc } from &quot;firebase/firestore&quot;;
import { Bookmark, Share2, Bot, MessageCircle, MoreHorizontal, FileText, Camera, Search, ChevronUp, ChevronDown, Settings, User, Home, Bell, DollarSign, Users, Layers, Film, Sparkles, X, Save, BookOpen, GraduationCap, Plus, Play, Pause, Loader } from &quot;lucide-react&quot;;

// ─── FIREBASE ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:&quot;AIzaSyA1mskTWMsVV9dpO3I7hVxZx9LUtbzNjuo&quot;,
  authDomain:&quot;edutok-a48f9.firebaseapp.com&quot;,
  projectId:&quot;edutok-a48f9&quot;,
  storageBucket:&quot;edutok-a48f9.firebasestorage.app&quot;,
  messagingSenderId:&quot;742519479032&quot;,
  appId:&quot;1:742519479032:web:0d0606bcaf75c95a51f90d&quot;
};
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(firebaseApp);

// ─── KEYS &amp; CONSTANTS ───────────────────────────────────
const GROQ_KEY = &quot;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&quot;;
const IMGBB_KEY    = &quot;92c2c743edc0ac25a6e50a247f811b95&quot;;
const ADMIN_PHONE  = &quot;07700000000&quot;;
const ADMIN_PASS   = &quot;admin123&quot;;
const ZAINCASH_NUM = &quot;07700000000&quot;;
const LOGO         = &quot;https://cdn-icons-png.flaticon.com/512/8841/8841503.png&quot;;
const GROQ_URL = &quot;https://api.groq.com/openai/v1/chat/completions&quot;;

const SUBJECTS     = [&quot;الرياضيات&quot;,&quot;العلوم&quot;,&quot;اللغة العربية&quot;,&quot;اللغة الإنجليزية&quot;,&quot;الفيزياء&quot;,&quot;الكيمياء&quot;,&quot;الأحياء&quot;,&quot;التربية الإسلامية&quot;,&quot;التاريخ&quot;];
const STAGES       = [&quot;الابتدائية&quot;,&quot;المتوسطة&quot;,&quot;الإعدادية&quot;];
const GRADES       = {&quot;الابتدائية&quot;:[&quot;الأول&quot;,&quot;الثاني&quot;,&quot;الثالث&quot;,&quot;الرابع&quot;,&quot;الخامس&quot;,&quot;السادس&quot;],&quot;المتوسطة&quot;:[&quot;الأول&quot;,&quot;الثاني&quot;,&quot;الثالث&quot;],&quot;الإعدادية&quot;:[&quot;الأول&quot;,&quot;الثاني&quot;,&quot;الثالث&quot;]};
const SEMESTERS    = [&quot;الأول&quot;,&quot;الثاني&quot;,&quot;الثالث&quot;];
const CLIP_TYPES   = [&quot;معلم&quot;,&quot;طالب&quot;,&quot;مراجعة&quot;,&quot;اختبار&quot;];
const PRICE_SUBJECTS = [&quot;الرياضيات&quot;,&quot;العلوم&quot;,&quot;اللغة العربية&quot;,&quot;اللغة الإنجليزية&quot;,&quot;الفيزياء&quot;,&quot;الكيمياء&quot;,&quot;الأحياء&quot;,&quot;التربية الإسلامية&quot;,&quot;ملازم PDF&quot;];
const THEMES       = [{label:&quot;برتقالي&quot;,color:&quot;#b45309&quot;},{label:&quot;أخضر&quot;,color:&quot;#166534&quot;},{label:&quot;بنفسجي&quot;,color:&quot;#5b21b6&quot;},{label:&quot;أزرق متدرج&quot;,color:&quot;#0c4a6e&quot;},{label:&quot;داكن&quot;,color:&quot;#27272a&quot;}];
const THEME_STYLES = {
  &quot;برتقالي&quot;    :{bg:&quot;linear-gradient(135deg,#7c2d12,#c2410c)&quot;,accent:&quot;#fb923c&quot;,card:&quot;rgba(194,65,12,0.25)&quot;},
  &quot;أخضر&quot;       :{bg:&quot;linear-gradient(135deg,#14532d,#15803d)&quot;,accent:&quot;#4ade80&quot;,card:&quot;rgba(21,128,61,0.25)&quot;},
  &quot;بنفسجي&quot;     :{bg:&quot;linear-gradient(135deg,#4c1d95,#6d28d9)&quot;,accent:&quot;#c4b5fd&quot;,card:&quot;rgba(109,40,217,0.25)&quot;},
  &quot;أزرق متدرج&quot;:{bg:&quot;linear-gradient(135deg,#0c4a6e,#0369a1)&quot;,accent:&quot;#38bdf8&quot;,card:&quot;rgba(3,105,161,0.25)&quot;},
  &quot;داكن&quot;       :{bg:&quot;linear-gradient(135deg,#09090b,#18181b)&quot;,accent:&quot;#a1a1aa&quot;,card:&quot;rgba(255,255,255,0.06)&quot;},
};
const DURATIONS    = [{label:&quot;شهري — 30 يوم&quot;,days:30},{label:&quot;فصلي — 90 يوم&quot;,days:90},{label:&quot;سنوي — 365 يوم&quot;,days:365}];
const ADMIN_TABS   = [
  {key:&quot;clips&quot;,         label:&quot;المقاطع&quot;,   Icon:Film},
  {key:&quot;slides&quot;,        label:&quot;شرائح&quot;,     Icon:Layers},
  {key:&quot;pdf&quot;,           label:&quot;PDF&quot;,        Icon:FileText},
  {key:&quot;wallet&quot;,        label:&quot;المحفظة&quot;,   Icon:DollarSign},
  {key:&quot;students&quot;,      label:&quot;الطلاب&quot;,    Icon:Users},
  {key:&quot;prices&quot;,        label:&quot;الأسعار&quot;,   Icon:Bell},
  {key:&quot;notifications&quot;, label:&quot;إشعارات&quot;,   Icon:Bell},
  {key:&quot;settings&quot;,      label:&quot;الإعدادات&quot;, Icon:Settings},
];
const SAMPLE_VIDEOS = [
  {id:&quot;s1&quot;,title:&quot;مقدمة في الجبر&quot;,teacher:&quot;أ. أحمد&quot;,subject:&quot;الرياضيات&quot;,stage:&quot;الابتدائية&quot;,duration:&quot;2:30&quot;,bg:&quot;linear-gradient(180deg,#0f172a,#1e1b4b)&quot;,videoUrl:&quot;&quot;,youtubeId:&quot;&quot;},
  {id:&quot;s2&quot;,title:&quot;قوانين نيوتن&quot;,teacher:&quot;أ. سارة&quot;,subject:&quot;الفيزياء&quot;,stage:&quot;الإعدادية&quot;,duration:&quot;3:15&quot;,bg:&quot;linear-gradient(180deg,#042f2e,#0d3b2e)&quot;,videoUrl:&quot;&quot;,youtubeId:&quot;&quot;},
  {id:&quot;s3&quot;,title:&quot;الجهاز التنفسي&quot;,teacher:&quot;أ. خالد&quot;,subject:&quot;الأحياء&quot;,stage:&quot;المتوسطة&quot;,duration:&quot;4:00&quot;,bg:&quot;linear-gradient(180deg,#1a1a2e,#16213e)&quot;,videoUrl:&quot;&quot;,youtubeId:&quot;&quot;},
];

// ─── SUBSCRIPTION HELPERS ───────────────────────────────
const subKey = (subject,stage) =&gt; subject+&quot;__&quot;+stage;
const isSubscribed = (subs,subject,stage) =&gt; {
  if(!subs||!subject||!stage) return false;
  const s=subs[subKey(subject,stage)];
  return s &amp;&amp; new Date(s.expiresAt)&gt;new Date();
};
const daysLeft = (subs,subject,stage) =&gt; {
  if(!subs||!subject||!stage) return 0;
  const s=subs[subKey(subject,stage)];
  if(!s) return 0;
  return Math.max(0,Math.ceil((new Date(s.expiresAt)-new Date())/86400000));
};

// ─── SESSION PERSISTENCE ─────────────────────────────────
const saveSession = (student, role) =&gt; {
  try { localStorage.setItem(&quot;edutok_session&quot;, JSON.stringify({student, role})); } catch{}
};
const loadSession = () =&gt; {
  try { return JSON.parse(localStorage.getItem(&quot;edutok_session&quot;)||&quot;null&quot;); } catch{ return null; }
};
const clearSession = () =&gt; {
  try { localStorage.removeItem(&quot;edutok_session&quot;); } catch{}
};

// ─── PREVENT PULL TO REFRESH (only on home video screen) ─
// We handle this via CSS overscroll-behavior instead of JS
// to avoid blocking scroll in admin pages

// ─── YOUTUBE HELPER ─────────────────────────────────────
const getYoutubeId = (url) =&gt; {
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&amp;\n?#]+)/);
  return m ? m[1] : null;
};

// ─── GROQ AI ────────────────────────────────────────────
const callGroq = async (prompt, imageBase64=null, imageMime=&quot;image/jpeg&quot;) =&gt; {
  // For text only - use fast llama model
  if (!imageBase64) {
    const res = await fetch(GROQ_URL, {
      method:&quot;POST&quot;,
      headers:{&quot;Content-Type&quot;:&quot;application/json&quot;,&quot;Authorization&quot;:&quot;Bearer &quot;+GROQ_KEY},
      body: JSON.stringify({
        model:&quot;llama-3.3-70b-versatile&quot;,
        messages:[{role:&quot;user&quot;, content: prompt}],
        temperature:0.7,
        max_tokens:2000
      })
    });
    const d = await res.json();
    if(d.error) throw new Error(d.error.message||&quot;Groq error&quot;);
    return d.choices?.[0]?.message?.content || &quot;&quot;;
  }
  // For images - use llama-4-scout vision model
  const res = await fetch(GROQ_URL, {
    method:&quot;POST&quot;,
    headers:{&quot;Content-Type&quot;:&quot;application/json&quot;,&quot;Authorization&quot;:&quot;Bearer &quot;+GROQ_KEY},
    body: JSON.stringify({
      model:&quot;meta-llama/llama-4-scout-17b-16e-instruct&quot;,
      messages:[{role:&quot;user&quot;, content:[
        {type:&quot;image_url&quot;, image_url:{url:`data:${imageMime};base64,${imageBase64}`}},
        {type:&quot;text&quot;, text: prompt}
      ]}],
      temperature:0.7,
      max_tokens:2000
    })
  });
  const d = await res.json();
  if(d.error) throw new Error(d.error.message||&quot;Groq vision error&quot;);
  return d.choices?.[0]?.message?.content || &quot;&quot;;
};
const callGemini = callGroq;

// ─── IMGBB UPLOAD ────────────────────────────────────────
const uploadToImgBB = async (file) =&gt; {
  const form = new FormData();
  form.append(&quot;image&quot;, file);
  form.append(&quot;key&quot;, IMGBB_KEY);
  const res = await fetch(&quot;https://api.imgbb.com/1/upload&quot;,{method:&quot;POST&quot;,body:form});
  const d = await res.json();
  if(d.success) return {url:d.data.url, base64:d.data.image?.base64||null};
  throw new Error(&quot;فشل رفع الصورة&quot;);
};

// ─── STYLES ─────────────────────────────────────────────
const C = {
  app:{width:&quot;100%&quot;,maxWidth:&quot;420px&quot;,minHeight:&quot;100vh&quot;,backgroundColor:&quot;#09090b&quot;,color:&quot;#fff&quot;,fontFamily:&quot;system-ui,-apple-system,sans-serif&quot;,direction:&quot;rtl&quot;,margin:&quot;0 auto&quot;,paddingBottom:&quot;72px&quot;,boxSizing:&quot;border-box&quot;,overflowX:&quot;hidden&quot;,position:&quot;relative&quot;},
  header:{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;center&quot;,padding:&quot;12px 16px&quot;,borderBottom:&quot;1px solid rgba(255,255,255,0.06)&quot;},
  logoRow:{display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;8px&quot;,cursor:&quot;pointer&quot;},
  section:{padding:&quot;16px&quot;},
  twoCol:{display:&quot;grid&quot;,gridTemplateColumns:&quot;1fr 1fr&quot;,gap:&quot;10px&quot;},
  tabsGrid:{display:&quot;grid&quot;,gridTemplateColumns:&quot;1fr 1fr 1fr 1fr&quot;,gap:&quot;6px&quot;,padding:&quot;10px 12px&quot;,borderBottom:&quot;1px solid rgba(255,255,255,0.06)&quot;},
  tab:(a)=&gt;({padding:&quot;8px 4px&quot;,borderRadius:&quot;10px&quot;,border:&quot;none&quot;,fontSize:&quot;10px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,backgroundColor:a?&quot;#f97316&quot;:&quot;#27272a&quot;,color:&quot;#fff&quot;,textAlign:&quot;center&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;center&quot;,gap:&quot;3px&quot;}),
  label:{display:&quot;block&quot;,fontSize:&quot;13px&quot;,color:&quot;#a1a1aa&quot;,marginBottom:&quot;6px&quot;},
  input:{width:&quot;100%&quot;,padding:&quot;12px 14px&quot;,backgroundColor:&quot;#18181b&quot;,border:&quot;1px solid rgba(255,255,255,0.06)&quot;,borderRadius:&quot;12px&quot;,color:&quot;#fff&quot;,fontSize:&quot;14px&quot;,marginBottom:&quot;14px&quot;,boxSizing:&quot;border-box&quot;,outline:&quot;none&quot;},
  select:{width:&quot;100%&quot;,padding:&quot;12px 14px&quot;,backgroundColor:&quot;#18181b&quot;,border:&quot;1px solid rgba(255,255,255,0.06)&quot;,borderRadius:&quot;12px&quot;,color:&quot;#fff&quot;,fontSize:&quot;14px&quot;,marginBottom:&quot;14px&quot;,boxSizing:&quot;border-box&quot;,outline:&quot;none&quot;,appearance:&quot;none&quot;},
  gradBtn:{width:&quot;100%&quot;,padding:&quot;15px&quot;,borderRadius:&quot;14px&quot;,border:&quot;none&quot;,background:&quot;linear-gradient(to right,#f97316,#ef4444)&quot;,color:&quot;#fff&quot;,fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,display:&quot;flex&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;,gap:&quot;6px&quot;,marginBottom:&quot;10px&quot;},
  blueBtn:{width:&quot;100%&quot;,padding:&quot;14px&quot;,backgroundColor:&quot;#0ea5e9&quot;,color:&quot;#fff&quot;,border:&quot;none&quot;,borderRadius:&quot;12px&quot;,fontSize:&quot;14px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,marginBottom:&quot;14px&quot;},
  redBtn:{width:&quot;100%&quot;,padding:&quot;14px&quot;,backgroundColor:&quot;#ef4444&quot;,color:&quot;#fff&quot;,border:&quot;none&quot;,borderRadius:&quot;12px&quot;,fontSize:&quot;14px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,marginBottom:&quot;14px&quot;},
  purpleBtn:{width:&quot;100%&quot;,padding:&quot;15px&quot;,borderRadius:&quot;14px&quot;,border:&quot;none&quot;,background:&quot;linear-gradient(to right,#7c3aed,#a855f7)&quot;,color:&quot;#fff&quot;,fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,display:&quot;flex&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;,gap:&quot;6px&quot;},
  primaryBtn:{width:&quot;100%&quot;,padding:&quot;15px&quot;,borderRadius:&quot;14px&quot;,border:&quot;none&quot;,background:&quot;linear-gradient(to right,#0ea5e9,#a855f7)&quot;,color:&quot;#fff&quot;,fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,marginBottom:&quot;12px&quot;},
  secondaryBtn:{width:&quot;100%&quot;,padding:&quot;15px&quot;,borderRadius:&quot;14px&quot;,border:&quot;1px solid rgba(255,255,255,0.12)&quot;,backgroundColor:&quot;#18181b&quot;,color:&quot;#fff&quot;,fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;},
  saveRow:{display:&quot;flex&quot;,gap:&quot;10px&quot;,marginTop:&quot;8px&quot;},
  cancelBtn:{flex:1,padding:&quot;14px&quot;,backgroundColor:&quot;#27272a&quot;,color:&quot;#a1a1aa&quot;,border:&quot;none&quot;,borderRadius:&quot;12px&quot;,fontSize:&quot;14px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;},
  saveBtn:{flex:1,padding:&quot;14px&quot;,background:&quot;linear-gradient(to right,#0ea5e9,#a855f7)&quot;,color:&quot;#fff&quot;,border:&quot;none&quot;,borderRadius:&quot;12px&quot;,fontSize:&quot;14px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;},
  adminBtn:{background:&quot;linear-gradient(135deg,#f97316,#ef4444)&quot;,color:&quot;#fff&quot;,border:&quot;none&quot;,padding:&quot;6px 14px&quot;,borderRadius:&quot;20px&quot;,fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;4px&quot;},
  infoBanner:{backgroundColor:&quot;rgba(8,47,73,0.4)&quot;,border:&quot;1px solid #0369a1&quot;,borderRadius:&quot;12px&quot;,padding:&quot;12px&quot;,fontSize:&quot;13px&quot;,color:&quot;#38bdf8&quot;,marginBottom:&quot;16px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;6px&quot;},
  card:{backgroundColor:&quot;#18181b&quot;,borderRadius:&quot;14px&quot;,padding:&quot;14px 16px&quot;,marginBottom:&quot;10px&quot;,border:&quot;1px solid rgba(255,255,255,0.04)&quot;},
  bottomNav:{position:&quot;fixed&quot;,bottom:0,left:&quot;50%&quot;,transform:&quot;translateX(-50%)&quot;,width:&quot;100%&quot;,maxWidth:&quot;420px&quot;,height:&quot;64px&quot;,backgroundColor:&quot;#09090b&quot;,borderTop:&quot;1px solid rgba(255,255,255,0.07)&quot;,display:&quot;flex&quot;,justifyContent:&quot;space-around&quot;,alignItems:&quot;center&quot;,zIndex:100,boxSizing:&quot;border-box&quot;},
  navItem:(a)=&gt;({display:&quot;flex&quot;,flexDirection:&quot;column&quot;,alignItems:&quot;center&quot;,cursor:&quot;pointer&quot;,background:&quot;none&quot;,border:&quot;none&quot;,color:a?&quot;#38bdf8&quot;:&quot;#71717a&quot;,gap:&quot;2px&quot;,padding:&quot;4px&quot;}),
  welcomeWrap:{display:&quot;flex&quot;,flexDirection:&quot;column&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;center&quot;,padding:&quot;40px 24px&quot;,minHeight:&quot;88vh&quot;},
  welcomeTitle:{fontSize:&quot;36px&quot;,fontWeight:&quot;900&quot;,background:&quot;linear-gradient(to right,#38bdf8,#a855f7)&quot;,WebkitBackgroundClip:&quot;text&quot;,WebkitTextFillColor:&quot;transparent&quot;,margin:&quot;12px 0 4px&quot;},
  priceRow:{display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;space-between&quot;,backgroundColor:&quot;#18181b&quot;,padding:&quot;10px 16px&quot;,borderRadius:&quot;12px&quot;,marginBottom:&quot;8px&quot;,border:&quot;1px solid rgba(255,255,255,0.04)&quot;},
  priceInput:{width:&quot;100%&quot;,background:&quot;none&quot;,border:&quot;none&quot;,color:&quot;#fff&quot;,textAlign:&quot;right&quot;,fontSize:&quot;14px&quot;,outline:&quot;none&quot;},
  statsGrid:{display:&quot;grid&quot;,gridTemplateColumns:&quot;1fr 1fr&quot;,gap:&quot;10px&quot;,marginTop:&quot;10px&quot;},
  statCard:{backgroundColor:&quot;#18181b&quot;,padding:&quot;16px 12px&quot;,borderRadius:&quot;14px&quot;,textAlign:&quot;center&quot;,border:&quot;1px solid rgba(255,255,255,0.03)&quot;},
  overlay:{position:&quot;fixed&quot;,top:0,left:0,right:0,bottom:0,backgroundColor:&quot;rgba(0,0,0,0.75)&quot;,display:&quot;flex&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;,zIndex:200,padding:&quot;16px&quot;},
  modalBox:{backgroundColor:&quot;#18181b&quot;,borderRadius:&quot;24px&quot;,padding:&quot;24px&quot;,width:&quot;100%&quot;,maxWidth:&quot;380px&quot;,maxHeight:&quot;88vh&quot;,overflowY:&quot;auto&quot;},
  videoWrap:{position:&quot;relative&quot;,width:&quot;calc(100% - 32px)&quot;,height:&quot;500px&quot;,margin:&quot;16px auto&quot;,borderRadius:&quot;24px&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,display:&quot;flex&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;,overflow:&quot;hidden&quot;},
  sidebar:{position:&quot;absolute&quot;,left:&quot;16px&quot;,top:&quot;8%&quot;,display:&quot;flex&quot;,flexDirection:&quot;column&quot;,gap:&quot;14px&quot;,zIndex:15},
  sideBtn:(a)=&gt;({width:&quot;50px&quot;,height:&quot;50px&quot;,borderRadius:&quot;50%&quot;,backgroundColor:a?&quot;rgba(34,211,238,0.2)&quot;:&quot;rgba(15,23,42,0.75)&quot;,border:a?&quot;1px solid #22d3ee&quot;:&quot;1px solid rgba(255,255,255,0.1)&quot;,display:&quot;flex&quot;,flexDirection:&quot;column&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;,cursor:&quot;pointer&quot;,color:&quot;#fff&quot;,gap:&quot;1px&quot;}),
  sideTxt:(a)=&gt;({fontSize:&quot;10px&quot;,color:a?&quot;#22d3ee&quot;:&quot;#cbd5e1&quot;}),
  moreMenu:{position:&quot;absolute&quot;,bottom:&quot;20px&quot;,left:&quot;16px&quot;,right:&quot;16px&quot;,backgroundColor:&quot;rgba(24,24,27,0.97)&quot;,border:&quot;1px solid rgba(255,255,255,0.1)&quot;,borderRadius:&quot;20px&quot;,padding:&quot;14px 12px&quot;,display:&quot;flex&quot;,justifyContent:&quot;space-around&quot;,alignItems:&quot;center&quot;,zIndex:30,backdropFilter:&quot;blur(12px)&quot;},
  moreItem:{display:&quot;flex&quot;,flexDirection:&quot;column&quot;,alignItems:&quot;center&quot;,cursor:&quot;pointer&quot;,background:&quot;none&quot;,border:&quot;none&quot;,color:&quot;#fff&quot;,padding:&quot;4px 8px&quot;},
};

// ─── SHARED COMPONENTS ──────────────────────────────────
const Spinner = ({color=&quot;#38bdf8&quot;,size=24}) =&gt; (
  &lt;div style={{display:&quot;inline-block&quot;,animation:&quot;spin 1s linear infinite&quot;}}&gt;
    &lt;Loader size={size} color={color}/&gt;
    &lt;style dangerouslySetInnerHTML={{__html:&quot;@keyframes spin{to{transform:rotate(360deg)}}&quot;}}/&gt;
  &lt;/div&gt;
);
const MHead = ({icon,title,color,onClose}) =&gt; (
  &lt;div style={{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;center&quot;,marginBottom:&quot;16px&quot;}}&gt;
    &lt;div style={{display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;8px&quot;}}&gt;{icon}&lt;span style={{fontWeight:&quot;bold&quot;,fontSize:&quot;16px&quot;,color:color||&quot;#fff&quot;}}&gt;{title}&lt;/span&gt;&lt;/div&gt;
    &lt;button onClick={onClose} style={{background:&quot;none&quot;,border:&quot;none&quot;,cursor:&quot;pointer&quot;,color:&quot;#71717a&quot;}}&gt;&lt;X size={20}/&gt;&lt;/button&gt;
  &lt;/div&gt;
);
const ErrBox = ({msg}) =&gt; msg?&lt;div style={{backgroundColor:&quot;rgba(239,68,68,0.1)&quot;,border:&quot;1px solid rgba(239,68,68,0.3)&quot;,borderRadius:&quot;10px&quot;,padding:&quot;10px&quot;,fontSize:&quot;13px&quot;,color:&quot;#f87171&quot;,marginBottom:&quot;14px&quot;,textAlign:&quot;center&quot;}}&gt;! {msg}&lt;/div&gt;:null;


// ─── TOAST NOTIFICATION ──────────────────────────────────
let _setToast = null;
const showMsg = (msg) =&gt; { if(_setToast) _setToast(msg); };
const Toast = () =&gt; {
  const [msg,setMsg] = useState(&quot;&quot;);
  _setToast = (m) =&gt; { setMsg(m); setTimeout(()=&gt;setMsg(&quot;&quot;),3000); };
  if(!msg) return null;
  return (
    &lt;div style={{position:&quot;fixed&quot;,top:&quot;20px&quot;,left:&quot;50%&quot;,transform:&quot;translateX(-50%)&quot;,
      backgroundColor:&quot;#18181b&quot;,border:&quot;1px solid rgba(255,255,255,0.15)&quot;,
      borderRadius:&quot;12px&quot;,padding:&quot;12px 20px&quot;,fontSize:&quot;13px&quot;,color:&quot;#fff&quot;,
      zIndex:9999,boxShadow:&quot;0 8px 24px rgba(0,0,0,0.5)&quot;,maxWidth:&quot;320px&quot;,
      textAlign:&quot;center&quot;,direction:&quot;rtl&quot;}}&gt;
      {msg}
    &lt;/div&gt;
  );
};

// ─── IMAGE UPLOADER ──────────────────────────────────────
const ImageUploader = ({onUpload, onBase64, color=&quot;#34d399&quot;, label=&quot;اضغط لرفع صورة&quot;}) =&gt; {
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  const handleFile=async(e)=&gt;{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    try{
      const result=await uploadToImgBB(file);
      setPreview(result.url);
      onUpload &amp;&amp; onUpload(result.url);
      onBase64 &amp;&amp; onBase64(result.base64);
    }catch{showMsg(&quot;فشل رفع الصورة، حاول مرة أخرى&quot;);}
    setUploading(false);
  };
  return (
    &lt;div style={{marginBottom:&quot;12px&quot;}}&gt;
      {preview&amp;&amp;&lt;img src={preview} alt=&quot;معاينة&quot; style={{width:&quot;100%&quot;,maxHeight:&quot;200px&quot;,objectFit:&quot;contain&quot;,borderRadius:&quot;12px&quot;,marginBottom:&quot;8px&quot;,border:&quot;1px solid rgba(255,255,255,0.1)&quot;}}/&gt;}
      {uploading
        ?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;16px&quot;,color}}&gt;&lt;Spinner color={color}/&gt;&lt;div style={{marginTop:&quot;8px&quot;,fontSize:&quot;12px&quot;}}&gt;جارٍ رفع الصورة...&lt;/div&gt;&lt;/div&gt;
        :&lt;label style={{display:&quot;block&quot;,width:&quot;100%&quot;,padding:&quot;16px&quot;,backgroundColor:&quot;rgba(52,211,153,0.08)&quot;,border:&quot;2px dashed rgba(52,211,153,0.35)&quot;,borderRadius:&quot;14px&quot;,textAlign:&quot;center&quot;,cursor:&quot;pointer&quot;,boxSizing:&quot;border-box&quot;}}&gt;
          &lt;Camera size={28} color={color} style={{margin:&quot;0 auto 6px&quot;}}/&gt;
          &lt;div style={{fontSize:&quot;13px&quot;,color,fontWeight:&quot;bold&quot;}}&gt;{preview?&quot;تغيير الصورة&quot;:label}&lt;/div&gt;
          &lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;,marginTop:&quot;3px&quot;}}&gt;من الكاميرا أو معرض الصور&lt;/div&gt;
          &lt;input type=&quot;file&quot; accept=&quot;image/*&quot; style={{display:&quot;none&quot;}} onChange={handleFile}/&gt;
        &lt;/label&gt;
      }
    &lt;/div&gt;
  );
};

// ─── VIDEO PLAYER ────────────────────────────────────────
const VideoPlayer = ({video, playing, onClick}) =&gt; {
  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef(null);

  // Auto-advance slides when playing
  useEffect(()=&gt;{
    if(video.type===&quot;شرائح AI&quot; &amp;&amp; video.slides?.length &amp;&amp; playing){
      slideTimer.current = setInterval(()=&gt;{
        setSlideIdx(i=&gt; i &lt; video.slides.length-1 ? i+1 : 0);
      }, 4000);
    }
    return ()=&gt;clearInterval(slideTimer.current);
  },[playing, video]);

  // Slides player
  if(video.type===&quot;شرائح AI&quot; &amp;&amp; video.slides?.length){
    const ts = THEME_STYLES[video.theme] || THEME_STYLES[&quot;أزرق متدرج&quot;];
    const sl = video.slides[slideIdx] || {};
    return (
      &lt;div style={{position:&quot;absolute&quot;,inset:0,zIndex:2,background:ts.bg,display:&quot;flex&quot;,flexDirection:&quot;column&quot;,justifyContent:&quot;center&quot;,padding:&quot;20px 16px&quot;,overflowY:&quot;auto&quot;}} onClick={onClick}&gt;
        {/* Slide counter */}
        &lt;div style={{position:&quot;absolute&quot;,top:&quot;12px&quot;,left:&quot;16px&quot;,backgroundColor:ts.card,borderRadius:&quot;8px&quot;,padding:&quot;3px 10px&quot;,border:&quot;1px solid &quot;+ts.accent+&quot;44&quot;}}&gt;
          &lt;span style={{color:ts.accent,fontSize:&quot;11px&quot;,fontWeight:&quot;bold&quot;}}&gt;{slideIdx+1} / {video.slides.length}&lt;/span&gt;
        &lt;/div&gt;
        {/* Subject badge */}
        &lt;div style={{position:&quot;absolute&quot;,top:&quot;12px&quot;,right:&quot;16px&quot;,backgroundColor:&quot;rgba(0,0,0,0.3)&quot;,borderRadius:&quot;8px&quot;,padding:&quot;3px 10px&quot;}}&gt;
          &lt;span style={{color:&quot;rgba(255,255,255,0.7)&quot;,fontSize:&quot;10px&quot;}}&gt;{video.subject}&lt;/span&gt;
        &lt;/div&gt;
        {/* Slide content */}
        &lt;div style={{marginTop:&quot;32px&quot;}}&gt;
          &lt;h3 style={{color:&quot;#fff&quot;,fontSize:&quot;18px&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;16px&quot;,lineHeight:&quot;1.5&quot;,textAlign:&quot;center&quot;}}&gt;{sl.title}&lt;/h3&gt;
          &lt;ul style={{listStyle:&quot;none&quot;,padding:0,margin:0}}&gt;
            {(sl.points||[]).map((pt,i)=&gt;(
              &lt;li key={i} style={{display:&quot;flex&quot;,alignItems:&quot;flex-start&quot;,gap:&quot;8px&quot;,marginBottom:&quot;10px&quot;,color:&quot;rgba(255,255,255,0.9)&quot;,fontSize:&quot;13px&quot;,lineHeight:&quot;1.6&quot;}}&gt;
                &lt;span style={{color:ts.accent,flexShrink:0,fontSize:&quot;16px&quot;}}&gt;◆&lt;/span&gt;{pt}
              &lt;/li&gt;
            ))}
          &lt;/ul&gt;
        &lt;/div&gt;
        {/* Progress dots */}
        &lt;div style={{display:&quot;flex&quot;,gap:&quot;5px&quot;,justifyContent:&quot;center&quot;,marginTop:&quot;16px&quot;,flexWrap:&quot;wrap&quot;}}&gt;
          {video.slides.map((_,i)=&gt;(
            &lt;div key={i} onClick={e=&gt;{e.stopPropagation();setSlideIdx(i);}} style={{width:i===slideIdx?&quot;18px&quot;:&quot;7px&quot;,height:&quot;7px&quot;,borderRadius:&quot;4px&quot;,backgroundColor:i===slideIdx?ts.accent:&quot;rgba(255,255,255,0.3)&quot;,cursor:&quot;pointer&quot;,transition:&quot;width 0.2s&quot;}}/&gt;
          ))}
        &lt;/div&gt;
        {/* Nav buttons */}
        &lt;div style={{display:&quot;flex&quot;,gap:&quot;10px&quot;,marginTop:&quot;14px&quot;}}&gt;
          &lt;button disabled={slideIdx===0} onClick={e=&gt;{e.stopPropagation();setSlideIdx(i=&gt;i-1);}} style={{flex:1,padding:&quot;10px&quot;,borderRadius:&quot;12px&quot;,border:&quot;none&quot;,backgroundColor:slideIdx===0?&quot;rgba(255,255,255,0.05)&quot;:&quot;rgba(255,255,255,0.15)&quot;,color:slideIdx===0?&quot;rgba(255,255,255,0.3)&quot;:&quot;#fff&quot;,cursor:slideIdx===0?&quot;not-allowed&quot;:&quot;pointer&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;}}&gt;◀ السابق&lt;/button&gt;
          &lt;button
            disabled={slideIdx===video.slides.length-1}
            onClick={e=&gt;{e.stopPropagation();setSlideIdx(i=&gt;i+1);}}
            style={{flex:1,padding:&quot;10px&quot;,borderRadius:&quot;12px&quot;,border:&quot;none&quot;,
              backgroundColor:slideIdx===video.slides.length-1?&quot;rgba(255,255,255,0.05)&quot;:&quot;rgba(255,255,255,0.15)&quot;,
              color:slideIdx===video.slides.length-1?&quot;rgba(255,255,255,0.3)&quot;:&quot;#fff&quot;,
              cursor:slideIdx===video.slides.length-1?&quot;not-allowed&quot;:&quot;pointer&quot;,
              fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;}}&gt;
            التالي
          &lt;/button&gt;
        &lt;/div&gt;
        {/* Play indicator */}
        {playing&amp;&amp;&lt;div style={{position:&quot;absolute&quot;,bottom:&quot;12px&quot;,right:&quot;12px&quot;,fontSize:&quot;10px&quot;,color:ts.accent}}&gt;▶ تشغيل تلقائي&lt;/div&gt;}
      &lt;/div&gt;
    );
  }

  const ytId = getYoutubeId(video.videoUrl);
  if(ytId) return (
    &lt;div style={{position:&quot;absolute&quot;,inset:0,zIndex:2}}&gt;
      &lt;iframe
        src={`https://www.youtube.com/embed/${ytId}?autoplay=${playing?1:0}&amp;mute=0&amp;controls=1&amp;rel=0`}
        style={{width:&quot;100%&quot;,height:&quot;100%&quot;,border:&quot;none&quot;}}
        allow=&quot;autoplay; fullscreen&quot;
        allowFullScreen
      /&gt;
    &lt;/div&gt;
  );
  if(video.videoUrl) return (
    &lt;video
      src={video.videoUrl}
      autoPlay={playing} loop muted playsInline
      style={{position:&quot;absolute&quot;,inset:0,width:&quot;100%&quot;,height:&quot;100%&quot;,objectFit:&quot;cover&quot;,zIndex:2}}
    /&gt;
  );
  // No video — show thumbnail or gradient bg
  return (
    &lt;&gt;
      {video.thumbUrl&amp;&amp;&lt;img src={video.thumbUrl} alt={video.title} style={{position:&quot;absolute&quot;,inset:0,width:&quot;100%&quot;,height:&quot;100%&quot;,objectFit:&quot;cover&quot;,zIndex:1,opacity:0.6}}/&gt;}
      {!playing&amp;&amp;(
        &lt;div style={{position:&quot;absolute&quot;,zIndex:5,display:&quot;flex&quot;,flexDirection:&quot;column&quot;,alignItems:&quot;center&quot;,gap:&quot;8px&quot;,pointerEvents:&quot;none&quot;}}&gt;
          &lt;div style={{width:70,height:70,borderRadius:&quot;50%&quot;,backgroundColor:&quot;rgba(0,0,0,0.6)&quot;,display:&quot;flex&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;}}&gt;
            &lt;Play size={30} color=&quot;#fff&quot; fill=&quot;#fff&quot;/&gt;
          &lt;/div&gt;
          &lt;span style={{color:&quot;rgba(255,255,255,0.8)&quot;,fontSize:&quot;12px&quot;}}&gt;اضغط للتشغيل&lt;/span&gt;
        &lt;/div&gt;
      )}
      {playing&amp;&amp;(
        &lt;div style={{position:&quot;absolute&quot;,bottom:&quot;16px&quot;,right:&quot;16px&quot;,display:&quot;flex&quot;,alignItems:&quot;flex-end&quot;,gap:&quot;3px&quot;,zIndex:6,pointerEvents:&quot;none&quot;}}&gt;
          {[1,2,3,4].map(i=&gt;&lt;div key={i} style={{width:&quot;3px&quot;,borderRadius:&quot;2px&quot;,backgroundColor:&quot;#38bdf8&quot;,animation:`eq${i} 0.8s ease-in-out infinite alternate`,height:(8+i*4)+&quot;px&quot;,animationDelay:(i*0.15)+&quot;s&quot;}}/&gt;)}
          &lt;style dangerouslySetInnerHTML={{__html:&quot;@keyframes eq1{to{height:16px}}@keyframes eq2{to{height:8px}}@keyframes eq3{to{height:20px}}@keyframes eq4{to{height:10px}}&quot;}}/&gt;
        &lt;/div&gt;
      )}
    &lt;/&gt;
  );
};

// ─── AI MODAL ────────────────────────────────────────────
function AIModal({onClose,video}) {
  const [q,setQ]=useState(&quot;&quot;); const [ans,setAns]=useState(&quot;&quot;); const [loading,setLoading]=useState(false);
  const ask=async()=&gt;{
    if(!q.trim())return; setLoading(true); setAns(&quot;&quot;);
    try{
      const r=await callGemini(&quot;أنت مساعد تعليمي. الطالب يشاهد درس: &quot;+video.title+&quot; في مادة &quot;+video.subject+&quot;. سؤاله: &quot;+q+&quot;. أجب بإيجاز وبالعربية.&quot;);
      setAns(r||&quot;لم أتمكن من الإجابة.&quot;);
    }catch(e){setAns(&quot;حدث خطأ: &quot;+e.message);}
    setLoading(false);
  };
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(56,189,248,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;Bot size={20} color=&quot;#38bdf8&quot;/&gt;} title=&quot;المساعد الذكي&quot; color=&quot;#38bdf8&quot; onClose={onClose}/&gt;
    &lt;div style={{...C.infoBanner,marginBottom:&quot;12px&quot;}}&gt; اسألني عن درس: &lt;strong&gt;{video.title}&lt;/strong&gt;&lt;/div&gt;
    {ans&amp;&amp;&lt;div style={{backgroundColor:&quot;#09090b&quot;,borderRadius:&quot;12px&quot;,padding:&quot;14px&quot;,fontSize:&quot;14px&quot;,color:&quot;#e4e4e7&quot;,lineHeight:&quot;1.7&quot;,marginBottom:&quot;14px&quot;,border:&quot;1px solid rgba(56,189,248,0.15)&quot;,whiteSpace:&quot;pre-wrap&quot;}}&gt;&lt;div style={{color:&quot;#38bdf8&quot;,fontSize:&quot;11px&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;6px&quot;}}&gt; الإجابة:&lt;/div&gt;{ans}&lt;/div&gt;}
    {loading&amp;&amp;&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;12px&quot;}}&gt;&lt;Spinner/&gt;&lt;div style={{marginTop:&quot;8px&quot;,fontSize:&quot;13px&quot;,color:&quot;#38bdf8&quot;}}&gt;جارٍ البحث...&lt;/div&gt;&lt;/div&gt;}
    &lt;textarea rows={3} value={q} onChange={e=&gt;setQ(e.target.value)} placeholder=&quot;اكتب سؤالك هنا...&quot; style={{...C.input,resize:&quot;none&quot;,marginBottom:&quot;10px&quot;}}/&gt;
    &lt;button onClick={ask} disabled={loading||!q.trim()} style={{...C.primaryBtn,opacity:q.trim()?1:0.5,marginBottom:0}}&gt;&lt;Bot size={16}/&gt; أرسل السؤال&lt;/button&gt;
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── SHARE MODAL ─────────────────────────────────────────
function ShareModal({onClose,video}) {
  const link=&quot;https://edutok-neon.vercel.app/v/&quot;+video.id;
  return &lt;div style={C.overlay}&gt;&lt;div style={C.modalBox}&gt;
    &lt;MHead icon={&lt;Share2 size={20} color=&quot;#38bdf8&quot;/&gt;} title=&quot;مشاركة الدرس&quot; onClose={onClose}/&gt;
    &lt;div style={{...C.card,marginBottom:&quot;14px&quot;}}&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;,marginBottom:&quot;4px&quot;}}&gt;{video.title}&lt;/div&gt;&lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#71717a&quot;}}&gt;{link}&lt;/div&gt;&lt;/div&gt;
    &lt;div style={{display:&quot;grid&quot;,gridTemplateColumns:&quot;1fr 1fr&quot;,gap:&quot;10px&quot;}}&gt;
      {[[&quot;واتساب&quot;,&quot;#25D366&quot;],[&quot;تيليغرام&quot;,&quot;#229ED9&quot;],[&quot;نسخ الرابط&quot;,&quot;#6366f1&quot;],[&quot;المزيد&quot;,&quot;#f97316&quot;]].map(([n,c])=&gt;(
        &lt;button key={n} onClick={()=&gt;{if(n===&quot;نسخ الرابط&quot;)navigator.clipboard?.writeText(link);onClose();}} style={{padding:&quot;12px&quot;,borderRadius:&quot;12px&quot;,border:&quot;none&quot;,backgroundColor:c,color:&quot;#fff&quot;,fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;{n}&lt;/button&gt;
      ))}
    &lt;/div&gt;
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── CHAT MODAL ──────────────────────────────────────────
function ChatModal({onClose}) {
  const [msg,setMsg]=useState(&quot;&quot;);
  const [msgs,setMsgs]=useState([{text:&quot;هل شرح الأستاذ واضح؟&quot;,from:&quot;other&quot;,name:&quot;أحمد&quot;},{text:&quot;نعم ممتاز &quot;,from:&quot;me&quot;}]);
  const send=()=&gt;{if(!msg.trim())return;setMsgs(p=&gt;[...p,{text:msg,from:&quot;me&quot;}]);setMsg(&quot;&quot;);};
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(168,85,247,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;MessageCircle size={20} color=&quot;#a855f7&quot;/&gt;} title=&quot;غرفة النقاش&quot; color=&quot;#a855f7&quot; onClose={onClose}/&gt;
    &lt;div style={{backgroundColor:&quot;#09090b&quot;,borderRadius:&quot;12px&quot;,padding:&quot;12px&quot;,marginBottom:&quot;12px&quot;,maxHeight:&quot;200px&quot;,overflowY:&quot;auto&quot;}}&gt;
      {msgs.map((m,i)=&gt;(
        &lt;div key={i} style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,marginBottom:&quot;10px&quot;,justifyContent:m.from===&quot;me&quot;?&quot;flex-end&quot;:&quot;flex-start&quot;}}&gt;
          {m.from!==&quot;me&quot;&amp;&amp;&lt;div style={{width:28,height:28,borderRadius:&quot;50%&quot;,background:&quot;linear-gradient(135deg,#0ea5e9,#a855f7)&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;center&quot;,flexShrink:0}}&gt;&lt;User size={14} color=&quot;#fff&quot;/&gt;&lt;/div&gt;}
          &lt;div style={{backgroundColor:m.from===&quot;me&quot;?&quot;rgba(168,85,247,0.2)&quot;:&quot;#1c1c1e&quot;,borderRadius:&quot;10px&quot;,padding:&quot;8px 12px&quot;,maxWidth:&quot;70%&quot;}}&gt;
            {m.name&amp;&amp;&lt;div style={{fontSize:&quot;10px&quot;,color:&quot;#71717a&quot;,marginBottom:&quot;2px&quot;}}&gt;{m.name}&lt;/div&gt;}
            &lt;div style={{fontSize:&quot;13px&quot;}}&gt;{m.text}&lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;}}&gt;
      &lt;input value={msg} onChange={e=&gt;setMsg(e.target.value)} onKeyDown={e=&gt;e.key===&quot;Enter&quot;&amp;&amp;send()} placeholder=&quot;اكتب رسالتك...&quot; style={{flex:1,padding:&quot;10px 14px&quot;,backgroundColor:&quot;#09090b&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#fff&quot;,fontSize:&quot;13px&quot;,outline:&quot;none&quot;}}/&gt;
      &lt;button onClick={send} style={{padding:&quot;10px 14px&quot;,backgroundColor:&quot;#a855f7&quot;,border:&quot;none&quot;,borderRadius:&quot;10px&quot;,color:&quot;#fff&quot;,cursor:&quot;pointer&quot;,fontWeight:&quot;bold&quot;}}&gt;إرسال&lt;/button&gt;
    &lt;/div&gt;
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── PDF MODAL ───────────────────────────────────────────
function PDFModal({onClose,isSubbed}) {
  const [files,setFiles]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=&gt;{
    const unsub=onSnapshot(collection(db,&quot;pdfs&quot;),snap=&gt;{setFiles(snap.docs.map(d=&gt;({id:d.id,...d.data()})));setLoading(false);});
    return ()=&gt;unsub();
  },[]);
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(249,115,22,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;FileText size={20} color=&quot;#f97316&quot;/&gt;} title=&quot;ملازم وبحوث&quot; color=&quot;#f97316&quot; onClose={onClose}/&gt;
    {!isSubbed&amp;&amp;(
      &lt;div style={{backgroundColor:&quot;rgba(234,179,8,0.1)&quot;,border:&quot;1px solid rgba(234,179,8,0.3)&quot;,borderRadius:&quot;12px&quot;,padding:&quot;12px&quot;,marginBottom:&quot;14px&quot;,textAlign:&quot;center&quot;}}&gt;
        &lt;div style={{color:&quot;#fbbf24&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;14px&quot;,marginBottom:&quot;4px&quot;}}&gt;محتوى مدفوع&lt;/div&gt;
        &lt;div style={{color:&quot;#71717a&quot;,fontSize:&quot;12px&quot;,marginBottom:&quot;10px&quot;}}&gt;اشترك للوصول لجميع الملازم&lt;/div&gt;
        &lt;button onClick={onClose} style={{backgroundColor:&quot;#f97316&quot;,border:&quot;none&quot;,borderRadius:&quot;10px&quot;,padding:&quot;8px 20px&quot;,color:&quot;#fff&quot;,fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;اشترك الآن عبر زين كاش&lt;/button&gt;
      &lt;/div&gt;
    )}
    {loading?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;20px&quot;}}&gt;&lt;Spinner color=&quot;#f97316&quot;/&gt;&lt;/div&gt;
    :files.length===0?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;24px&quot;,color:&quot;#52525b&quot;}}&gt;&lt;FileText size={40} color=&quot;#3f3f46&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;&lt;div&gt;لا توجد ملفات بعد&lt;/div&gt;&lt;/div&gt;
    :files.map(f=&gt;(
      &lt;div key={f.id} style={{display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;space-between&quot;,...C.card}}&gt;
        &lt;div&gt;&lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;}}&gt;{f.name}&lt;/div&gt;&lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;,marginTop:&quot;2px&quot;}}&gt;{f.subject} • {f.stage}&lt;/div&gt;&lt;/div&gt;
        {isSubbed?&lt;a href={f.url} target=&quot;_blank&quot; rel=&quot;noreferrer&quot; style={{backgroundColor:&quot;rgba(249,115,22,0.15)&quot;,border:&quot;1px solid rgba(249,115,22,0.3)&quot;,borderRadius:&quot;8px&quot;,padding:&quot;6px 12px&quot;,color:&quot;#f97316&quot;,fontSize:&quot;12px&quot;,cursor:&quot;pointer&quot;,fontWeight:&quot;bold&quot;,textDecoration:&quot;none&quot;}}&gt;تحميل&lt;/a&gt;
        :&lt;button onClick={onClose} style={{backgroundColor:&quot;rgba(234,179,8,0.15)&quot;,border:&quot;1px solid rgba(234,179,8,0.3)&quot;,borderRadius:&quot;8px&quot;,padding:&quot;6px 12px&quot;,color:&quot;#fbbf24&quot;,fontSize:&quot;12px&quot;,cursor:&quot;pointer&quot;,fontWeight:&quot;bold&quot;}}&gt; اشترك&lt;/button&gt;}
      &lt;/div&gt;
    ))}
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── SOLVE MODAL (with FileReader + Groq Vision) ─────────
function SolveModal({onClose,video}) {
  const [tab,setTab]=useState(&quot;text&quot;);
  const [q,setQ]=useState(&quot;&quot;);
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [ans,setAns]=useState(&quot;&quot;);
  const [loading,setLoading]=useState(false);

  const handleImageFile=(e)=&gt;{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=&gt;{
      const full=ev.target.result;
      setImgPreview(full);
      setImgB64(full.split(&quot;,&quot;)[1]);
    };
    reader.readAsDataURL(file);
  };

  const solve=async()=&gt;{
    setLoading(true); setAns(&quot;&quot;);
    try{
      let r;
      if(tab===&quot;text&quot;){
        r=await callGemini(&quot;أنت مساعد تعليمي. الطالب يدرس &quot;+video.subject+&quot;. السؤال: &quot;+q+&quot;. حله خطوة بخطوة بالعربية.&quot;);
      } else {
        if(!imgB64){setAns(&quot;يرجى رفع صورة أولاً.&quot;);setLoading(false);return;}
        r=await callGemini(&quot;أنت مساعد تعليمي. الطالب يدرس &quot;+video.subject+&quot;. انظر للصورة وحل هذا السؤال خطوة بخطوة بالعربية.&quot;,imgB64);
      }
      setAns(r||&quot;لم أتمكن من الإجابة.&quot;);
    }catch(e){setAns(&quot; خطأ: &quot;+e.message);}
    setLoading(false);
  };

  const canSolve=tab===&quot;text&quot;?q.trim():imgB64;
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(52,211,153,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;Camera size={20} color=&quot;#34d399&quot;/&gt;} title=&quot;حل الأسئلة الذكي&quot; color=&quot;#34d399&quot; onClose={onClose}/&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,marginBottom:&quot;14px&quot;}}&gt;
      &lt;button onClick={()=&gt;setTab(&quot;text&quot;)} style={{flex:1,padding:&quot;10px&quot;,borderRadius:&quot;10px&quot;,border:&quot;none&quot;,backgroundColor:tab===&quot;text&quot;?&quot;#34d399&quot;:&quot;#27272a&quot;,color:tab===&quot;text&quot;?&quot;#000&quot;:&quot;#a1a1aa&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;,cursor:&quot;pointer&quot;}}&gt; اكتب السؤال&lt;/button&gt;
      &lt;button onClick={()=&gt;setTab(&quot;img&quot;)} style={{flex:1,padding:&quot;10px&quot;,borderRadius:&quot;10px&quot;,border:&quot;none&quot;,backgroundColor:tab===&quot;img&quot;?&quot;#34d399&quot;:&quot;#27272a&quot;,color:tab===&quot;img&quot;?&quot;#000&quot;:&quot;#a1a1aa&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;,cursor:&quot;pointer&quot;}}&gt; صوّر السؤال&lt;/button&gt;
    &lt;/div&gt;
    {tab===&quot;text&quot;&amp;&amp;&lt;textarea rows={4} value={q} onChange={e=&gt;setQ(e.target.value)} placeholder=&quot;مثال: احسب مساحة مثلث قاعدته 6سم وارتفاعه 4سم&quot; style={{...C.input,resize:&quot;none&quot;}}/&gt;}
    {tab===&quot;img&quot;&amp;&amp;(
      &lt;div style={{marginBottom:&quot;12px&quot;}}&gt;
        {imgPreview&amp;&amp;&lt;img src={imgPreview} alt=&quot;معاينة&quot; style={{width:&quot;100%&quot;,maxHeight:&quot;200px&quot;,objectFit:&quot;contain&quot;,borderRadius:&quot;12px&quot;,marginBottom:&quot;8px&quot;,border:&quot;1px solid rgba(255,255,255,0.1)&quot;}}/&gt;}
        &lt;label style={{display:&quot;block&quot;,width:&quot;100%&quot;,padding:&quot;14px&quot;,backgroundColor:&quot;rgba(52,211,153,0.08)&quot;,border:&quot;2px dashed rgba(52,211,153,0.35)&quot;,borderRadius:&quot;14px&quot;,textAlign:&quot;center&quot;,cursor:&quot;pointer&quot;,boxSizing:&quot;border-box&quot;}}&gt;
          &lt;Camera size={26} color=&quot;#34d399&quot; style={{margin:&quot;0 auto 6px&quot;}}/&gt;
          &lt;div style={{fontSize:&quot;13px&quot;,color:&quot;#34d399&quot;,fontWeight:&quot;bold&quot;}}&gt;{imgPreview?&quot;تغيير الصورة&quot;:&quot;صوّر السؤال أو اختره من المعرض&quot;}&lt;/div&gt;
          &lt;input type=&quot;file&quot; accept=&quot;image/*&quot; style={{display:&quot;none&quot;}} onChange={handleImageFile}/&gt;
        &lt;/label&gt;
      &lt;/div&gt;
    )}
    {ans&amp;&amp;&lt;div style={{backgroundColor:&quot;#09090b&quot;,borderRadius:&quot;12px&quot;,padding:&quot;14px&quot;,fontSize:&quot;14px&quot;,color:&quot;#e4e4e7&quot;,lineHeight:&quot;1.8&quot;,marginBottom:&quot;14px&quot;,border:&quot;1px solid rgba(52,211,153,0.15)&quot;,whiteSpace:&quot;pre-wrap&quot;,maxHeight:&quot;240px&quot;,overflowY:&quot;auto&quot;}}&gt;&lt;div style={{color:&quot;#34d399&quot;,fontSize:&quot;11px&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;6px&quot;}}&gt; الحل:&lt;/div&gt;{ans}&lt;/div&gt;}
    {loading&amp;&amp;&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;12px&quot;}}&gt;&lt;Spinner color=&quot;#34d399&quot;/&gt;&lt;div style={{marginTop:&quot;8px&quot;,fontSize:&quot;13px&quot;,color:&quot;#34d399&quot;}}&gt;جارٍ الحل...&lt;/div&gt;&lt;/div&gt;}
    {!ans&amp;&amp;!loading&amp;&amp;&lt;button onClick={solve} disabled={!canSolve} style={{...C.purpleBtn,background:canSolve?&quot;linear-gradient(to right,#059669,#34d399)&quot;:&quot;#27272a&quot;,opacity:canSolve?1:0.5}}&gt;&lt;Bot size={16}/&gt; حل السؤال بالذكاء الاصطناعي&lt;/button&gt;}
    {ans&amp;&amp;&lt;div style={{display:&quot;flex&quot;,gap:&quot;10px&quot;}}&gt;&lt;button onClick={()=&gt;{setAns(&quot;&quot;);setQ(&quot;&quot;);setImgB64(null);setImgPreview(null);}} style={C.cancelBtn}&gt;سؤال جديد&lt;/button&gt;&lt;button onClick={onClose} style={C.saveBtn}&gt;إغلاق &lt;/button&gt;&lt;/div&gt;}
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── SEARCH MODAL ────────────────────────────────────────
function SearchModal({onClose,allVideos}) {
  const [q,setQ]=useState(&quot;&quot;);
  const filtered=allVideos.filter(v=&gt;!q||v.title?.includes(q)||v.subject?.includes(q));
  return &lt;div style={C.overlay}&gt;&lt;div style={C.modalBox}&gt;
    &lt;MHead icon={&lt;Search size={20} color=&quot;#38bdf8&quot;/&gt;} title=&quot;البحث في المقاطع&quot; onClose={onClose}/&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,marginBottom:&quot;14px&quot;}}&gt;
      &lt;input value={q} onChange={e=&gt;setQ(e.target.value)} placeholder=&quot;ابحث عن درس أو مادة...&quot; style={{flex:1,padding:&quot;10px 14px&quot;,backgroundColor:&quot;#09090b&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#fff&quot;,fontSize:&quot;13px&quot;,outline:&quot;none&quot;}}/&gt;
    &lt;/div&gt;
    {filtered.map((v,i)=&gt;(
      &lt;div key={i} onClick={onClose} style={{display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;10px&quot;,...C.card,cursor:&quot;pointer&quot;}}&gt;
        &lt;div style={{width:36,height:36,borderRadius:&quot;8px&quot;,background:v.bg||&quot;linear-gradient(135deg,#1e1b4b,#312e81)&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;center&quot;,flexShrink:0}}&gt;{v.thumbUrl?&lt;img src={v.thumbUrl} alt=&quot;&quot; style={{width:&quot;100%&quot;,height:&quot;100%&quot;,objectFit:&quot;cover&quot;,borderRadius:&quot;8px&quot;}}/&gt;:&lt;Film size={16} color=&quot;#fff&quot;/&gt;}&lt;/div&gt;
        &lt;div&gt;&lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;}}&gt;{v.title}&lt;/div&gt;&lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;}}&gt;{v.subject} • {v.stage}&lt;/div&gt;&lt;/div&gt;
      &lt;/div&gt;
    ))}
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── SAVED MODAL ─────────────────────────────────────────
function SavedModal({onClose,saved,video}) {
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(34,211,238,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;Bookmark size={20} color=&quot;#22d3ee&quot;/&gt;} title=&quot;المحفوظات&quot; color=&quot;#22d3ee&quot; onClose={onClose}/&gt;
    {saved?&lt;div style={{display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;10px&quot;,...C.card,border:&quot;1px solid rgba(34,211,238,0.2)&quot;}}&gt;&lt;Bookmark size={18} color=&quot;#22d3ee&quot; fill=&quot;#22d3ee&quot;/&gt;&lt;div&gt;&lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;}}&gt;{video.title}&lt;/div&gt;&lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;}}&gt;{video.subject}&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;
    :&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;24px&quot;,color:&quot;#52525b&quot;}}&gt;&lt;Bookmark size={40} color=&quot;#3f3f46&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;&lt;div style={{fontSize:&quot;14px&quot;}}&gt;لا توجد مقاطع محفوظة بعد&lt;/div&gt;&lt;/div&gt;}
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── ADMIN LOGIN MODAL ───────────────────────────────────
function AdminLoginModal({onClose,onSuccess}) {
  const [phone,setPhone]=useState(&quot;&quot;); const [pass,setPass]=useState(&quot;&quot;); const [err,setErr]=useState(&quot;&quot;);
  const login=()=&gt;{if(phone===ADMIN_PHONE&amp;&amp;pass===ADMIN_PASS)onSuccess();else setErr(&quot;رقم الهاتف أو كلمة المرور غير صحيحة&quot;);};
  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,maxWidth:&quot;340px&quot;,border:&quot;1px solid rgba(234,179,8,0.2)&quot;}}&gt;
    &lt;div style={{textAlign:&quot;center&quot;,marginBottom:&quot;20px&quot;}}&gt;
      &lt;GraduationCap size={40} color=&quot;#eab308&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;
      &lt;h3 style={{color:&quot;#eab308&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;18px&quot;,margin:&quot;0 0 4px&quot;}}&gt;دخول المدير&lt;/h3&gt;
    &lt;/div&gt;
    &lt;label style={C.label}&gt; رقم الهاتف&lt;/label&gt;
    &lt;input type=&quot;text&quot; value={phone} onChange={e=&gt;{setPhone(e.target.value);setErr(&quot;&quot;);}} placeholder=&quot;07XX XXX XXXX&quot; style={C.input}/&gt;
    &lt;label style={C.label}&gt; كلمة المرور&lt;/label&gt;
    &lt;input type=&quot;password&quot; value={pass} onChange={e=&gt;{setPass(e.target.value);setErr(&quot;&quot;);}} placeholder=&quot;كلمة المرور&quot; style={C.input} onKeyDown={e=&gt;e.key===&quot;Enter&quot;&amp;&amp;login()}/&gt;
    &lt;ErrBox msg={err}/&gt;
    &lt;button onClick={login} style={{...C.gradBtn,background:&quot;linear-gradient(to right,#eab308,#f97316)&quot;}}&gt;دخول لوحة الإدارة ←&lt;/button&gt;
    &lt;button onClick={onClose} style={{width:&quot;100%&quot;,padding:&quot;12px&quot;,backgroundColor:&quot;transparent&quot;,color:&quot;#71717a&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,borderRadius:&quot;12px&quot;,fontSize:&quot;14px&quot;,cursor:&quot;pointer&quot;}}&gt;إلغاء&lt;/button&gt;
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── WALLET MODAL ────────────────────────────────────────
function WalletModal({onClose,student,subscriptions}) {
  const [selSubject,setSelSubject]=useState(SUBJECTS[0]);
  const [selStage,setSelStage]=useState(STAGES[0]);
  const [selDuration,setSelDuration]=useState(DURATIONS[0]);
  const [amount,setAmount]=useState(&quot;&quot;);
  const [receipt,setReceipt]=useState(null);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  const sendPayment=async()=&gt;{
    if(!amount.trim()) return showMsg(&quot;أدخل المبلغ المحوّل&quot;);
    setSending(true);
    try{
      await addDoc(collection(db,&quot;payments&quot;),{
        studentName:student?.name||&quot;&quot;,studentPhone:student?.phone||&quot;&quot;,studentId:student?.id||&quot;&quot;,
        subject:selSubject,stage:selStage,duration:selDuration.days,durationLabel:selDuration.label,
        amount,receiptUrl:receipt||&quot;&quot;,status:&quot;pending&quot;,createdAt:serverTimestamp()
      });
      setSent(true);
    }catch(e){showMsg(&quot;حدث خطأ: &quot;+e.message);}
    setSending(false);
  };

  if(sent) return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(34,197,94,0.2)&quot;,textAlign:&quot;center&quot;}}&gt;
    &lt;div style={{fontSize:&quot;56px&quot;,marginBottom:&quot;12px&quot;}}&gt;OK&lt;/div&gt;
    &lt;div style={{color:&quot;#4ade80&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;18px&quot;,marginBottom:&quot;8px&quot;}}&gt;تم إرسال طلب الاشتراك!&lt;/div&gt;
    &lt;div style={{color:&quot;#a1a1aa&quot;,fontSize:&quot;13px&quot;,marginBottom:&quot;4px&quot;}}&gt;المادة: &lt;strong style={{color:&quot;#fff&quot;}}&gt;{selSubject} — {selStage}&lt;/strong&gt;&lt;/div&gt;
    &lt;div style={{color:&quot;#a1a1aa&quot;,fontSize:&quot;13px&quot;,marginBottom:&quot;16px&quot;}}&gt;سيتم تفعيل اشتراكك بعد مراجعة المدير&lt;/div&gt;
    &lt;button onClick={onClose} style={C.primaryBtn}&gt;إغلاق&lt;/button&gt;
  &lt;/div&gt;&lt;/div&gt;;

  return &lt;div style={C.overlay}&gt;&lt;div style={{...C.modalBox,border:&quot;1px solid rgba(34,197,94,0.2)&quot;}}&gt;
    &lt;MHead icon={&lt;DollarSign size={20} color=&quot;#4ade80&quot;/&gt;} title=&quot;محفظة زين كاش&quot; color=&quot;#4ade80&quot; onClose={onClose}/&gt;
    {subscriptions&amp;&amp;Object.keys(subscriptions).length&gt;0&amp;&amp;(
      &lt;div style={{marginBottom:&quot;14px&quot;}}&gt;
        &lt;div style={{fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#38bdf8&quot;,marginBottom:&quot;6px&quot;}}&gt;اشتراكاتي النشطة:&lt;/div&gt;
        {Object.entries(subscriptions).map(([key,sub])=&gt;{
          const d=daysLeft(subscriptions,key.split(&quot;__&quot;)[0],key.split(&quot;__&quot;)[1]);
          return &lt;div key={key} style={{...C.card,marginBottom:&quot;6px&quot;,border:&quot;1px solid rgba(34,197,94,0.2)&quot;}}&gt;
            &lt;div style={{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;center&quot;}}&gt;
              &lt;div&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;12px&quot;}}&gt;{sub.subject}&lt;/div&gt;&lt;div style={{fontSize:&quot;10px&quot;,color:&quot;#71717a&quot;}}&gt;{sub.stage}&lt;/div&gt;&lt;/div&gt;
              &lt;div style={{color:d&gt;3?&quot;#4ade80&quot;:d&gt;0?&quot;#fbbf24&quot;:&quot;#f87171&quot;,fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;}}&gt;{d&gt;0?d+&quot; يوم&quot;:&quot; منتهي&quot;}&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;;
        })}
      &lt;/div&gt;
    )}
    &lt;div style={{backgroundColor:&quot;rgba(34,197,94,0.08)&quot;,border:&quot;1px solid rgba(34,197,94,0.2)&quot;,borderRadius:&quot;12px&quot;,padding:&quot;16px&quot;,marginBottom:&quot;14px&quot;,textAlign:&quot;center&quot;}}&gt;
      &lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#a1a1aa&quot;,marginBottom:&quot;4px&quot;}}&gt;رقم زين كاش للمدير&lt;/div&gt;
      &lt;div style={{fontSize:&quot;22px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#4ade80&quot;,letterSpacing:&quot;2px&quot;}}&gt;{ZAINCASH_NUM}&lt;/div&gt;
      &lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;,marginTop:&quot;4px&quot;}}&gt;حوّل المبلغ ثم أرسل الإيصال&lt;/div&gt;
    &lt;/div&gt;
    &lt;label style={C.label}&gt; المادة&lt;/label&gt;
    &lt;select value={selSubject} onChange={e=&gt;setSelSubject(e.target.value)} style={C.select}&gt;{SUBJECTS.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;
    &lt;label style={C.label}&gt; المرحلة&lt;/label&gt;
    &lt;select value={selStage} onChange={e=&gt;setSelStage(e.target.value)} style={C.select}&gt;{STAGES.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;
    &lt;label style={C.label}&gt; مدة الاشتراك&lt;/label&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;6px&quot;,marginBottom:&quot;14px&quot;}}&gt;
      {DURATIONS.map(d=&gt;&lt;button key={d.days} onClick={()=&gt;setSelDuration(d)} style={{flex:1,padding:&quot;9px 4px&quot;,borderRadius:&quot;10px&quot;,border:&quot;none&quot;,backgroundColor:selDuration.days===d.days?&quot;#4ade80&quot;:&quot;#27272a&quot;,color:selDuration.days===d.days?&quot;#000&quot;:&quot;#a1a1aa&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;10px&quot;,cursor:&quot;pointer&quot;}}&gt;{d.label}&lt;/button&gt;)}
    &lt;/div&gt;
    &lt;label style={C.label}&gt; المبلغ المحوّل (د.ع)&lt;/label&gt;
    &lt;input type=&quot;number&quot; value={amount} onChange={e=&gt;setAmount(e.target.value)} placeholder=&quot;أدخل المبلغ&quot; style={C.input}/&gt;
    &lt;label style={C.label}&gt; إيصال التحويل&lt;/label&gt;
    &lt;ImageUploader onUpload={url=&gt;setReceipt(url)} onBase64={()=&gt;{}} color=&quot;#4ade80&quot; label=&quot;صوّر إيصال زين كاش&quot;/&gt;
    {sending?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;12px&quot;}}&gt;&lt;Spinner color=&quot;#4ade80&quot;/&gt;&lt;/div&gt;
    :&lt;button onClick={sendPayment} style={{...C.primaryBtn,background:&quot;linear-gradient(to right,#15803d,#4ade80)&quot;,marginBottom:0}}&gt;إرسال طلب الاشتراك للمدير&lt;/button&gt;}
  &lt;/div&gt;&lt;/div&gt;;
}

// ─── SLIDES STUDIO (with Gemini) ─────────────────────────
function SlidesStudio({slidesTheme,setSlidesTheme,onSaveClip}) {
  const [mode,setMode]=useState(&quot;menu&quot;);
  const [topic,setTopic]=useState(&quot;&quot;);
  const [imgB64,setImgB64]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [slidesCount,setCount]=useState(6);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState(&quot;&quot;);
  const [slides,setSlides]=useState([]);
  const [curSlide,setCurSlide]=useState(0);
  const [clipTitle,setClipTitle]=useState(&quot;&quot;);
  const [clipSubj,setClipSubj]=useState(&quot;الرياضيات&quot;);
  const [clipStage,setClipStage]=useState(&quot;الابتدائية&quot;);
  const [saving,setSaving]=useState(false);
  const JSONSUFFIX=' أجب بـ JSON فقط بلا أي نص خارجه: {&quot;title&quot;:&quot;العنوان&quot;,&quot;slides&quot;:[{&quot;title&quot;:&quot;عنوان الشريحة&quot;,&quot;points&quot;:[&quot;نقطة 1&quot;,&quot;نقطة 2&quot;,&quot;نقطة 3&quot;]}]}';

  const generate=async(fromImage)=&gt;{
    setLoading(true);
    setLoadMsg(fromImage?&quot; Gemini يقرأ الورقة...&quot;:&quot; Gemini يبني الشرائح...&quot;);
    try{
      let raw;
      if(fromImage){
        if(!imgB64){showMsg(&quot;يرجى رفع صورة أولاً&quot;);setLoading(false);return;}
        raw=await callGemini(&quot;اقرأ هذه الورقة الدراسية وحوّل محتواها إلى &quot;+slidesCount+&quot; شرائح تعليمية.&quot;+JSONSUFFIX,imgB64);
      }else{
        if(!topic.trim()){showMsg(&quot;يرجى إدخال الموضوع&quot;);setLoading(false);return;}
        raw=await callGemini(&quot;أنشئ &quot;+slidesCount+&quot; شرائح تعليمية احترافية عن الموضوع التالي: &quot;+topic+&quot;. اجعل كل شريحة تحتوي على 3-4 نقاط مفيدة وواضحة.&quot;+JSONSUFFIX);
      }
      const clean=raw.replace(/```json/g,&quot;&quot;).replace(/```/g,&quot;&quot;).trim();
      const start=clean.indexOf(&quot;{&quot;);
      const end=clean.lastIndexOf(&quot;}&quot;);
      const parsed=JSON.parse(clean.substring(start,end+1));
      setSlides(parsed.slides||[]);
      setClipTitle(parsed.title||(fromImage?&quot;شرائح من ورقة&quot;:topic));
      setCurSlide(0);
      setMode(&quot;result&quot;);
    }catch(e){
      showMsg(&quot;حدث خطأ: &quot;+e.message+&quot;. حاول مرة أخرى.&quot;);
    }
    setLoading(false);
  };

  const saveToFirestore=async()=&gt;{
    if(!clipTitle.trim()) return showMsg(&quot;أدخل عنوان المقطع&quot;);
    setSaving(true);
    try{
      await addDoc(collection(db,&quot;clips&quot;),{title:clipTitle,subject:clipSubj,stage:clipStage,slides,theme:slidesTheme,type:&quot;شرائح AI&quot;,bg:&quot;linear-gradient(135deg,#1e1b4b,#312e81)&quot;,createdAt:serverTimestamp()});
      onSaveClip({title:clipTitle,subject:clipSubj,stage:clipStage,slides,theme:slidesTheme,type:&quot;شرائح AI&quot;,bg:&quot;linear-gradient(135deg,#1e1b4b,#312e81)&quot;});
      showMsg(&quot; تم حفظ الشرائح في Firebase!&quot;);
      setMode(&quot;menu&quot;);
    }catch(e){showMsg(&quot;فشل الحفظ: &quot;+e.message);}
    setSaving(false);
  };

  const ts=THEME_STYLES[slidesTheme]||THEME_STYLES[&quot;أزرق متدرج&quot;];
  const countBtns=&lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,marginBottom:&quot;14px&quot;}}&gt;{[4,6,8,10,12].map(n=&gt;&lt;button key={n} onClick={()=&gt;setCount(n)} style={{flex:1,padding:&quot;9px&quot;,borderRadius:&quot;10px&quot;,border:&quot;none&quot;,backgroundColor:slidesCount===n?&quot;#7c3aed&quot;:&quot;#27272a&quot;,color:slidesCount===n?&quot;#fff&quot;:&quot;#a1a1aa&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;,cursor:&quot;pointer&quot;}}&gt;{n}&lt;/button&gt;)}&lt;/div&gt;;
  const back=&lt;button onClick={()=&gt;setMode(&quot;menu&quot;)} style={{background:&quot;none&quot;,border:&quot;none&quot;,color:&quot;#71717a&quot;,cursor:&quot;pointer&quot;,fontSize:&quot;13px&quot;,marginBottom:&quot;14px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;4px&quot;}}&gt;← رجوع&lt;/button&gt;;

  if(mode===&quot;menu&quot;) return &lt;div&gt;
    &lt;div style={{background:&quot;linear-gradient(135deg,#1e1b4b,#312e81)&quot;,border:&quot;1px solid rgba(139,92,246,0.3)&quot;,borderRadius:&quot;16px&quot;,padding:&quot;24px&quot;,textAlign:&quot;center&quot;,marginBottom:&quot;16px&quot;}}&gt;
      &lt;Sparkles size={36} color=&quot;#c4b5fd&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;
      &lt;div style={{fontSize:&quot;18px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#c4b5fd&quot;,marginBottom:&quot;4px&quot;}}&gt;استوديو الشرائح الذكي&lt;/div&gt;
      &lt;div style={{fontSize:&quot;13px&quot;,color:&quot;#8b8ba0&quot;}}&gt;مدعوم بـ Google Gemini AI&lt;/div&gt;
    &lt;/div&gt;
    &lt;div style={{...C.twoCol,marginBottom:&quot;16px&quot;}}&gt;
      &lt;div onClick={()=&gt;setMode(&quot;image&quot;)} style={{backgroundColor:&quot;rgba(88,28,135,0.25)&quot;,border:&quot;1px solid rgba(139,92,246,0.35)&quot;,borderRadius:&quot;16px&quot;,padding:&quot;20px 14px&quot;,textAlign:&quot;center&quot;,cursor:&quot;pointer&quot;}}&gt;
        &lt;Camera size={32} color=&quot;#a855f7&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;
        &lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#c4b5fd&quot;}}&gt;صوّر ورقة الكتاب&lt;/div&gt;
        &lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;,marginTop:&quot;4px&quot;}}&gt;Gemini يقرأها ويحوّلها&lt;/div&gt;
      &lt;/div&gt;
      &lt;div onClick={()=&gt;setMode(&quot;text&quot;)} style={{backgroundColor:&quot;rgba(3,105,161,0.25)&quot;,border:&quot;1px solid rgba(56,189,248,0.35)&quot;,borderRadius:&quot;16px&quot;,padding:&quot;20px 14px&quot;,textAlign:&quot;center&quot;,cursor:&quot;pointer&quot;}}&gt;
        &lt;BookOpen size={32} color=&quot;#38bdf8&quot; style={{margin:&quot;0 auto 8px&quot;}}/&gt;
        &lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#38bdf8&quot;}}&gt;كتابة موضوع&lt;/div&gt;
        &lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;,marginTop:&quot;4px&quot;}}&gt;Gemini يبني الشرائح&lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
    &lt;div style={{fontSize:&quot;13px&quot;,color:&quot;#38bdf8&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;8px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;6px&quot;}}&gt;&lt;Layers size={14}/&gt; الثيم&lt;/div&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,flexWrap:&quot;wrap&quot;}}&gt;
      {THEMES.map(t=&gt;&lt;button key={t.label} onClick={()=&gt;setSlidesTheme(t.label)} style={{padding:&quot;8px 14px&quot;,borderRadius:&quot;10px&quot;,border:slidesTheme===t.label?&quot;2px solid #38bdf8&quot;:&quot;none&quot;,backgroundColor:t.color,color:&quot;#fff&quot;,fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;{t.label}&lt;/button&gt;)}
    &lt;/div&gt;
  &lt;/div&gt;;

  if(mode===&quot;image&quot;) return &lt;div&gt;{back}
    &lt;div style={{fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;12px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;8px&quot;}}&gt;&lt;Camera size={18} color=&quot;#a855f7&quot;/&gt; صوّر ورقة الكتاب&lt;/div&gt;
    &lt;div style={{backgroundColor:&quot;rgba(139,92,246,0.1)&quot;,border:&quot;1px solid rgba(139,92,246,0.3)&quot;,borderRadius:&quot;12px&quot;,padding:&quot;10px 14px&quot;,marginBottom:&quot;12px&quot;,fontSize:&quot;12px&quot;,color:&quot;#c4b5fd&quot;}}&gt;
       صوّر صفحة الكتاب أو الورقة — Groq سيقرأها ويحوّلها لشرائح تعليمية
    &lt;/div&gt;
    &lt;div style={{marginBottom:&quot;12px&quot;}}&gt;
      {imgPreview&amp;&amp;&lt;img src={imgPreview} alt=&quot;معاينة&quot; style={{width:&quot;100%&quot;,maxHeight:&quot;200px&quot;,objectFit:&quot;contain&quot;,borderRadius:&quot;12px&quot;,marginBottom:&quot;8px&quot;,border:&quot;1px solid rgba(255,255,255,0.1)&quot;}}/&gt;}
      &lt;label style={{display:&quot;block&quot;,width:&quot;100%&quot;,padding:&quot;14px&quot;,backgroundColor:&quot;rgba(139,92,246,0.08)&quot;,border:&quot;2px dashed rgba(139,92,246,0.35)&quot;,borderRadius:&quot;14px&quot;,textAlign:&quot;center&quot;,cursor:&quot;pointer&quot;,boxSizing:&quot;border-box&quot;}}&gt;
        &lt;Camera size={26} color=&quot;#a855f7&quot; style={{margin:&quot;0 auto 6px&quot;}}/&gt;
        &lt;div style={{fontSize:&quot;13px&quot;,color:&quot;#a855f7&quot;,fontWeight:&quot;bold&quot;}}&gt;{imgPreview?&quot;تغيير الصورة&quot;:&quot;صوّر صفحة الكتاب أو اختر من المعرض&quot;}&lt;/div&gt;
        &lt;input type=&quot;file&quot; accept=&quot;image/*&quot; style={{display:&quot;none&quot;}} onChange={e=&gt;{
          const file=e.target.files[0]; if(!file) return;
          const reader=new FileReader();
          reader.onload=(ev)=&gt;{const full=ev.target.result;setImgPreview(full);setImgB64(full.split(&quot;,&quot;)[1]);};
          reader.readAsDataURL(file);
        }}/&gt;
      &lt;/label&gt;
    &lt;/div&gt;
    &lt;label style={C.label}&gt; عدد الشرائح&lt;/label&gt;{countBtns}
    {loading?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;20px&quot;}}&gt;&lt;Spinner color=&quot;#a855f7&quot;/&gt;&lt;div style={{marginTop:&quot;10px&quot;,fontSize:&quot;14px&quot;,color:&quot;#a855f7&quot;,fontWeight:&quot;bold&quot;}}&gt;{loadMsg}&lt;/div&gt;&lt;/div&gt;
      :&lt;button disabled={!imgB64} onClick={()=&gt;generate(true)} style={{...C.purpleBtn,opacity:imgB64?1:0.5}}&gt; Groq يقرأ الورقة ويبني الشرائح&lt;/button&gt;}
  &lt;/div&gt;;

  if(mode===&quot;text&quot;) return &lt;div&gt;{back}
    &lt;div style={{fontSize:&quot;15px&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;12px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;8px&quot;}}&gt;&lt;BookOpen size={18} color=&quot;#38bdf8&quot;/&gt; كتابة موضوع&lt;/div&gt;
    &lt;label style={C.label}&gt; موضوع الشرائح&lt;/label&gt;
    &lt;textarea rows={3} value={topic} onChange={e=&gt;setTopic(e.target.value)} placeholder=&quot;مثال: الجهاز التنفسي في جسم الإنسان&amp;#10;أو: قوانين نيوتن الثلاثة&amp;#10;أو: الكسور العشرية وعمليات الجمع والطرح&quot; style={{...C.input,resize:&quot;none&quot;}}/&gt;
    &lt;label style={C.label}&gt; عدد الشرائح&lt;/label&gt;{countBtns}
    {loading?&lt;div style={{textAlign:&quot;center&quot;,padding:&quot;20px&quot;}}&gt;&lt;Spinner/&gt;&lt;div style={{marginTop:&quot;10px&quot;,fontSize:&quot;14px&quot;,color:&quot;#38bdf8&quot;,fontWeight:&quot;bold&quot;}}&gt;{loadMsg}&lt;/div&gt;&lt;/div&gt;
      :&lt;button onClick={()=&gt;generate(false)} disabled={!topic.trim()} style={{...C.purpleBtn,opacity:topic.trim()?1:0.5}}&gt; Gemini يبني الشرائح الآن&lt;/button&gt;}
  &lt;/div&gt;;

  if(mode===&quot;result&quot;){const sl=slides[curSlide]||{}; return &lt;div&gt;
    &lt;div style={{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;center&quot;,marginBottom:&quot;14px&quot;}}&gt;
      {back}
      &lt;span style={{color:&quot;#a1a1aa&quot;,fontSize:&quot;12px&quot;}}&gt;{curSlide+1} / {slides.length}&lt;/span&gt;
    &lt;/div&gt;
    &lt;div style={{background:ts.bg,borderRadius:&quot;20px&quot;,padding:&quot;24px 18px&quot;,minHeight:&quot;220px&quot;,marginBottom:&quot;14px&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;}}&gt;
      &lt;div style={{backgroundColor:ts.card,borderRadius:&quot;8px&quot;,padding:&quot;4px 12px&quot;,display:&quot;inline-block&quot;,marginBottom:&quot;12px&quot;,border:&quot;1px solid &quot;+ts.accent+&quot;44&quot;}}&gt;&lt;span style={{color:ts.accent,fontSize:&quot;11px&quot;,fontWeight:&quot;bold&quot;}}&gt;شريحة {curSlide+1}&lt;/span&gt;&lt;/div&gt;
      &lt;h3 style={{color:&quot;#fff&quot;,fontSize:&quot;17px&quot;,fontWeight:&quot;bold&quot;,margin:&quot;0 0 12px&quot;,lineHeight:&quot;1.5&quot;}}&gt;{sl.title}&lt;/h3&gt;
      &lt;ul style={{listStyle:&quot;none&quot;,padding:0,margin:0}}&gt;
        {(sl.points||[]).map((pt,i)=&gt;&lt;li key={i} style={{display:&quot;flex&quot;,alignItems:&quot;flex-start&quot;,gap:&quot;8px&quot;,marginBottom:&quot;8px&quot;,color:&quot;rgba(255,255,255,0.88)&quot;,fontSize:&quot;13px&quot;,lineHeight:&quot;1.6&quot;}}&gt;&lt;span style={{color:ts.accent,flexShrink:0}}&gt;◆&lt;/span&gt;{pt}&lt;/li&gt;)}
      &lt;/ul&gt;
    &lt;/div&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;5px&quot;,justifyContent:&quot;center&quot;,marginBottom:&quot;12px&quot;,flexWrap:&quot;wrap&quot;}}&gt;
      {slides.map((_,i)=&gt;&lt;div key={i} onClick={()=&gt;setCurSlide(i)} style={{width:i===curSlide?&quot;18px&quot;:&quot;7px&quot;,height:&quot;7px&quot;,borderRadius:&quot;4px&quot;,backgroundColor:i===curSlide?ts.accent:&quot;#3f3f46&quot;,cursor:&quot;pointer&quot;,transition:&quot;width 0.2s&quot;}}/&gt;)}
    &lt;/div&gt;
    &lt;div style={{display:&quot;flex&quot;,gap:&quot;10px&quot;,marginBottom:&quot;12px&quot;}}&gt;
      &lt;button disabled={curSlide===0} onClick={()=&gt;setCurSlide(i=&gt;i-1)} style={{flex:1,padding:&quot;11px&quot;,borderRadius:&quot;12px&quot;,border:&quot;none&quot;,backgroundColor:curSlide===0?&quot;#1c1c1e&quot;:&quot;#27272a&quot;,color:curSlide===0?&quot;#3f3f46&quot;:&quot;#fff&quot;,cursor:curSlide===0?&quot;not-allowed&quot;:&quot;pointer&quot;,fontWeight:&quot;bold&quot;}}&gt;◀ السابق&lt;/button&gt;
      &lt;button disabled={curSlide===slides.length-1} onClick={()=&gt;setCurSlide(i=&gt;i+1)} style={{flex:1,padding:&quot;11px&quot;,borderRadius:&quot;12px&quot;,border:&quot;none&quot;,backgroundColor:curSlide===slides.length-1?&quot;#1c1c1e&quot;:&quot;#27272a&quot;,color:curSlide===slides.length-1?&quot;#3f3f46&quot;:&quot;#fff&quot;,cursor:curSlide===slides.length-1?&quot;not-allowed&quot;:&quot;pointer&quot;,fontWeight:&quot;bold&quot;}}&gt;التالي ▶&lt;/button&gt;
    &lt;/div&gt;
    &lt;div style={{...C.card,border:&quot;1px solid rgba(56,189,248,0.15)&quot;}}&gt;
      &lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#38bdf8&quot;,marginBottom:&quot;10px&quot;}}&gt; حفظ في Firebase&lt;/div&gt;
      &lt;input value={clipTitle} onChange={e=&gt;setClipTitle(e.target.value)} placeholder=&quot;عنوان المقطع&quot; style={{...C.input,marginBottom:&quot;8px&quot;}}/&gt;
      &lt;div style={{...C.twoCol,marginBottom:&quot;10px&quot;}}&gt;
        &lt;select value={clipSubj} onChange={e=&gt;setClipSubj(e.target.value)} style={{padding:&quot;10px&quot;,backgroundColor:&quot;#09090b&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#fff&quot;,fontSize:&quot;12px&quot;,outline:&quot;none&quot;}}&gt;{SUBJECTS.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;
        &lt;select value={clipStage} onChange={e=&gt;setClipStage(e.target.value)} style={{padding:&quot;10px&quot;,backgroundColor:&quot;#09090b&quot;,border:&quot;1px solid rgba(255,255,255,0.08)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#fff&quot;,fontSize:&quot;12px&quot;,outline:&quot;none&quot;}}&gt;{STAGES.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;
      &lt;/div&gt;
      &lt;button onClick={saveToFirestore} disabled={saving} style={{...C.primaryBtn,marginBottom:0,opacity:saving?0.7:1}}&gt;
        {saving?&lt;&gt;&lt;Spinner size={16}/&gt; جارٍ الحفظ...&lt;/&gt;:&lt;&gt;&lt;Save size={16}/&gt; حفظ الشرائح في Firebase&lt;/&gt;}
      &lt;/button&gt;
    &lt;/div&gt;
  &lt;/div&gt;;}
  return null;
}

// ─── ADMIN PDF TAB ───────────────────────────────────────
function AdminPDFTab() {
  const [pdfs,setPdfs]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [editingPdf,setEditingPdf]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [pdfName,setPdfName]=useState(&quot;&quot;);
  const [pdfSubject,setPdfSubject]=useState(&quot;الرياضيات&quot;);
  const [pdfStage,setPdfStage]=useState(&quot;الابتدائية&quot;);
  const [pdfUrl,setPdfUrl]=useState(&quot;&quot;);
  const [pdfThumb,setPdfThumb]=useState(null);
  const [saving,setSaving]=useState(false);

  useEffect(()=&gt;{
    const unsub=onSnapshot(collection(db,&quot;pdfs&quot;),snap=&gt;{
      setPdfs(snap.docs.map(d=&gt;({id:d.id,...d.data()})));
    });
    return()=&gt;unsub();
  },[]);

  const openEdit=(f)=&gt;{
    setEditingPdf(f);
    setPdfName(f.name||&quot;&quot;);
    setPdfSubject(f.subject||&quot;الرياضيات&quot;);
    setPdfStage(f.stage||&quot;الابتدائية&quot;);
    setPdfUrl(f.url||&quot;&quot;);
    setShowForm(true);
  };

  const doDelete=async(f)=&gt;{
    try{ await deleteDoc(doc(db,&quot;pdfs&quot;,f.id)); showMsg(&quot;تم الحذف&quot;); }
    catch(e){ showMsg(&quot;فشل: &quot;+e.message); }
    setConfirmDelete(null);
  };

  const savePDF=async()=&gt;{
    if(!pdfName.trim()||!pdfUrl.trim()) return showMsg(&quot;أدخل الاسم والرابط&quot;);
    setSaving(true);
    try{
      if(editingPdf&amp;&amp;editingPdf.id){
        await updateDoc(doc(db,&quot;pdfs&quot;,editingPdf.id),{name:pdfName,subject:pdfSubject,stage:pdfStage,url:pdfUrl});
        showMsg(&quot;تم تعديل الملف&quot;);
      } else {
        await addDoc(collection(db,&quot;pdfs&quot;),{name:pdfName,subject:pdfSubject,stage:pdfStage,url:pdfUrl,thumbUrl:pdfThumb,createdAt:serverTimestamp()});
        showMsg(&quot;تم حفظ الملف&quot;);
      }
      setShowForm(false);setEditingPdf(null);setPdfName(&quot;&quot;);setPdfUrl(&quot;&quot;);setPdfThumb(null);
    }catch(e){showMsg(&quot;فشل: &quot;+e.message);}
    setSaving(false);
  };
  return &lt;div&gt;
    &lt;div style={C.infoBanner}&gt;&lt;FileText size={15}/&gt; الملازم والبحوث المدفوعة — للطلاب المشتركين فقط&lt;/div&gt;
    {confirmDelete&amp;&amp;(
      &lt;div style={{backgroundColor:&quot;rgba(239,68,68,0.1)&quot;,border:&quot;1px solid rgba(239,68,68,0.3)&quot;,borderRadius:&quot;14px&quot;,padding:&quot;16px&quot;,marginBottom:&quot;14px&quot;,textAlign:&quot;center&quot;}}&gt;
        &lt;div style={{color:&quot;#f87171&quot;,fontWeight:&quot;bold&quot;,marginBottom:&quot;8px&quot;}}&gt;هل تريد حذف هذا الملف؟&lt;/div&gt;
        &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,justifyContent:&quot;center&quot;}}&gt;
          &lt;button onClick={()=&gt;doDelete(confirmDelete)} style={{padding:&quot;8px 20px&quot;,backgroundColor:&quot;#ef4444&quot;,border:&quot;none&quot;,borderRadius:&quot;8px&quot;,color:&quot;#fff&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;نعم&lt;/button&gt;
          &lt;button onClick={()=&gt;setConfirmDelete(null)} style={{padding:&quot;8px 20px&quot;,backgroundColor:&quot;#27272a&quot;,border:&quot;none&quot;,borderRadius:&quot;8px&quot;,color:&quot;#fff&quot;,cursor:&quot;pointer&quot;}}&gt;لا&lt;/button&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    )}
    {pdfs.map(f=&gt;(
      &lt;div key={f.id} style={{...C.card,border:&quot;1px solid rgba(249,115,22,0.2)&quot;}}&gt;
        &lt;div style={{display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;10px&quot;,marginBottom:&quot;8px&quot;}}&gt;
          {f.thumbUrl&amp;&amp;&lt;img src={f.thumbUrl} alt=&quot;&quot; style={{width:40,height:40,borderRadius:&quot;8px&quot;,objectFit:&quot;cover&quot;}}/&gt;}
          &lt;div style={{flex:1}}&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;14px&quot;}}&gt;{f.name}&lt;/div&gt;&lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#71717a&quot;}}&gt;{f.subject} • {f.stage}&lt;/div&gt;&lt;/div&gt;
          &lt;a href={f.url} target=&quot;_blank&quot; rel=&quot;noreferrer&quot; style={{backgroundColor:&quot;rgba(249,115,22,0.15)&quot;,border:&quot;1px solid rgba(249,115,22,0.3)&quot;,borderRadius:&quot;8px&quot;,padding:&quot;6px 10px&quot;,color:&quot;#f97316&quot;,fontSize:&quot;12px&quot;,textDecoration:&quot;none&quot;,fontWeight:&quot;bold&quot;}}&gt;فتح&lt;/a&gt;
        &lt;/div&gt;
        &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;}}&gt;
          &lt;button onClick={()=&gt;openEdit(f)} style={{flex:1,padding:&quot;7px&quot;,borderRadius:&quot;8px&quot;,border:&quot;1px solid rgba(56,189,248,0.3)&quot;,backgroundColor:&quot;rgba(56,189,248,0.1)&quot;,color:&quot;#38bdf8&quot;,fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;تعديل&lt;/button&gt;
          &lt;button onClick={()=&gt;setConfirmDelete(f)} style={{flex:1,padding:&quot;7px&quot;,borderRadius:&quot;8px&quot;,border:&quot;1px solid rgba(239,68,68,0.3)&quot;,backgroundColor:&quot;rgba(239,68,68,0.1)&quot;,color:&quot;#f87171&quot;,fontSize:&quot;12px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;حذف&lt;/button&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    ))}
    {!showForm?&lt;button style={C.gradBtn} onClick={()=&gt;{setEditingPdf(null);setPdfName(&quot;&quot;);setPdfUrl(&quot;&quot;);setShowForm(true);}}&gt;&lt;Plus size={18}/&gt; إضافة ملف PDF جديد&lt;/button&gt;
    :&lt;div style={{...C.card,border:&quot;1px solid rgba(249,115,22,0.2)&quot;}}&gt;
      &lt;div style={{color:&quot;#f97316&quot;,fontWeight:&quot;bold&quot;,fontSize:&quot;14px&quot;,marginBottom:&quot;14px&quot;,display:&quot;flex&quot;,alignItems:&quot;center&quot;,gap:&quot;6px&quot;}}&gt;&lt;FileText size={16}/&gt; بيانات الملف الجديد&lt;/div&gt;
      &lt;label style={C.label}&gt;اسم الملف&lt;/label&gt;
      &lt;input type=&quot;text&quot; value={pdfName} onChange={e=&gt;setPdfName(e.target.value)} placeholder=&quot;مثال: ملزمة الرياضيات الفصل الأول&quot; style={C.input}/&gt;
      &lt;div style={C.twoCol}&gt;
        &lt;div&gt;&lt;label style={C.label}&gt;المادة&lt;/label&gt;&lt;select value={pdfSubject} onChange={e=&gt;setPdfSubject(e.target.value)} style={C.select}&gt;{SUBJECTS.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;&lt;/div&gt;
        &lt;div&gt;&lt;label style={C.label}&gt;المرحلة&lt;/label&gt;&lt;select value={pdfStage} onChange={e=&gt;setPdfStage(e.target.value)} style={C.select}&gt;{STAGES.map(s=&gt;&lt;option key={s}&gt;{s}&lt;/option&gt;)}&lt;/select&gt;&lt;/div&gt;
      &lt;/div&gt;
      &lt;label style={C.label}&gt; رابط PDF (Google Drive)&lt;/label&gt;
      &lt;input type=&quot;url&quot; value={pdfUrl} onChange={e=&gt;setPdfUrl(e.target.value)} placeholder=&quot;https://drive.google.com/file/...&quot; style={C.input}/&gt;
      &lt;label style={C.label}&gt; صورة مصغرة (اختياري)&lt;/label&gt;
      &lt;ImageUploader onUpload={url=&gt;setPdfThumb(url)} onBase64={()=&gt;{}} color=&quot;#f97316&quot; label=&quot;اختر صورة للملف&quot;/&gt;
      &lt;div style={C.saveRow}&gt;
        &lt;button style={C.cancelBtn} onClick={()=&gt;{setShowForm(false);setEditingPdf(null);}}&gt;إلغاء&lt;/button&gt;
        &lt;button disabled={saving} style={{...C.saveBtn,display:&quot;flex&quot;,alignItems:&quot;center&quot;,justifyContent:&quot;center&quot;,gap:&quot;6px&quot;,opacity:saving?0.7:1}} onClick={savePDF}&gt;
          {saving?&lt;&gt;&lt;Spinner size={15}/&gt; جارٍ...&lt;/&gt;:&lt;&gt;&lt;Save size={15}/&gt; حفظ&lt;/&gt;}
        &lt;/button&gt;
      &lt;/div&gt;
    &lt;/div&gt;}
  &lt;/div&gt;;
}

// ─── ADMIN WALLET TAB ────────────────────────────────────
function AdminWalletTab() {
  const [payments,setPayments]=useState([]);
  const [zaincash,setZaincash]=useState(ZAINCASH_NUM);
  const [editingNum,setEditingNum]=useState(false);
  const [newNum,setNewNum]=useState(ZAINCASH_NUM);
  useEffect(()=&gt;{const unsub=onSnapshot(collection(db,&quot;payments&quot;),snap=&gt;{setPayments(snap.docs.map(d=&gt;({id:d.id,...d.data()})).sort((a,b)=&gt;(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));});return()=&gt;unsub();},[]);
  const totalReceived=payments.filter(p=&gt;p.status===&quot;approved&quot;).reduce((s,p)=&gt;s+Number(p.amount||0),0);
  const pending=payments.filter(p=&gt;p.status===&quot;pending&quot;);
  const approvePayment=async(p)=&gt;{
    const days=p.duration||30;
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+days);
    try{
      await addDoc(collection(db,&quot;subscriptions&quot;),{studentPhone:p.studentPhone,studentName:p.studentName,subject:p.subject,stage:p.stage,duration:days,expiresAt:expiresAt.toISOString(),activatedAt:serverTimestamp()});
      await addDoc(collection(db,&quot;notifications&quot;),{title:&quot; تم تفعيل اشتراكك!&quot;,body:&quot;تم تفعيل اشتراكك في &quot;+p.subject+&quot; (&quot;+p.stage+&quot;) لمدة &quot;+days+&quot; يوم. ينتهي في &quot;+expiresAt.toLocaleDateString(&quot;ar&quot;),targetPhone:p.studentPhone,sentAt:serverTimestamp()});
      await addDoc(collection(db,&quot;payments&quot;),{...p,status:&quot;approved&quot;,approvedAt:serverTimestamp()});
      showMsg(&quot; تم تفعيل اشتراك &quot;+p.subject+&quot; لـ &quot;+p.studentName);
    }catch(e){showMsg(&quot;فشل: &quot;+e.message);}
  };
  const rejectPayment=async(p)=&gt;{
    try{await addDoc(collection(db,&quot;payments&quot;),{...p,status:&quot;rejected&quot;});showMsg(&quot;تم رفض الدفع&quot;);}catch(e){showMsg(&quot;فشل&quot;);}
  };
  return &lt;div&gt;
    &lt;div style={{background:&quot;linear-gradient(135deg,#14532d,#15803d)&quot;,borderRadius:&quot;16px&quot;,padding:&quot;20px&quot;,marginBottom:&quot;14px&quot;,textAlign:&quot;center&quot;}}&gt;
      &lt;div style={{fontSize:&quot;12px&quot;,color:&quot;rgba(255,255,255,0.7)&quot;,marginBottom:&quot;4px&quot;}}&gt;رقم زين كاش للاستلام&lt;/div&gt;
      {editingNum?(
        &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;,justifyContent:&quot;center&quot;,alignItems:&quot;center&quot;}}&gt;
          &lt;input value={newNum} onChange={e=&gt;setNewNum(e.target.value)} style={{padding:&quot;8px 12px&quot;,backgroundColor:&quot;rgba(0,0,0,0.3)&quot;,border:&quot;1px solid rgba(255,255,255,0.3)&quot;,borderRadius:&quot;8px&quot;,color:&quot;#fff&quot;,fontSize:&quot;16px&quot;,outline:&quot;none&quot;,textAlign:&quot;center&quot;,width:&quot;170px&quot;}}/&gt;
          &lt;button onClick={()=&gt;{setZaincash(newNum);setEditingNum(false);}} style={{backgroundColor:&quot;#4ade80&quot;,border:&quot;none&quot;,borderRadius:&quot;8px&quot;,padding:&quot;8px 14px&quot;,color:&quot;#000&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;,fontSize:&quot;13px&quot;}}&gt;حفظ&lt;/button&gt;
        &lt;/div&gt;
      ):(
        &lt;div style={{fontSize:&quot;22px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#4ade80&quot;,letterSpacing:&quot;2px&quot;,cursor:&quot;pointer&quot;}} onClick={()=&gt;setEditingNum(true)}&gt;{zaincash}&lt;/div&gt;
      )}
    &lt;/div&gt;
    &lt;div style={{display:&quot;grid&quot;,gridTemplateColumns:&quot;1fr 1fr 1fr&quot;,gap:&quot;8px&quot;,marginBottom:&quot;14px&quot;}}&gt;
      {[[&quot;&quot;,totalReceived.toLocaleString()+&quot; د.ع&quot;,&quot;المستلم&quot;],[&quot;⏳&quot;,pending.length,&quot;معلقة&quot;],[&quot;&quot;,payments.filter(p=&gt;p.status===&quot;approved&quot;).length,&quot;مؤكدة&quot;]].map(([icon,val,label])=&gt;(
        &lt;div key={label} style={C.statCard}&gt;&lt;div style={{fontSize:&quot;18px&quot;}}&gt;{icon}&lt;/div&gt;&lt;div style={{fontSize:&quot;14px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#4ade80&quot;,margin:&quot;2px 0&quot;}}&gt;{val}&lt;/div&gt;&lt;div style={{fontSize:&quot;10px&quot;,color:&quot;#71717a&quot;}}&gt;{label}&lt;/div&gt;&lt;/div&gt;
      ))}
    &lt;/div&gt;
    {pending.length&gt;0&amp;&amp;&lt;div style={{marginBottom:&quot;12px&quot;}}&gt;
      &lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#fbbf24&quot;,marginBottom:&quot;8px&quot;}}&gt; طلبات تحتاج موافقة ({pending.length})&lt;/div&gt;
      {pending.map(p=&gt;(
        &lt;div key={p.id} style={{...C.card,border:&quot;1px solid rgba(234,179,8,0.3)&quot;}}&gt;
          &lt;div style={{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;flex-start&quot;,marginBottom:&quot;10px&quot;}}&gt;
            &lt;div&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;14px&quot;}}&gt;{p.studentName}&lt;/div&gt;&lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#71717a&quot;}}&gt; {p.studentPhone}&lt;/div&gt;&lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#38bdf8&quot;}}&gt; {p.subject} — {p.stage}&lt;/div&gt;&lt;div style={{fontSize:&quot;12px&quot;,color:&quot;#a855f7&quot;}}&gt; {p.durationLabel}&lt;/div&gt;&lt;div style={{fontSize:&quot;13px&quot;,color:&quot;#4ade80&quot;,fontWeight:&quot;bold&quot;}}&gt; {p.amount} د.ع&lt;/div&gt;&lt;/div&gt;
            {p.receiptUrl&amp;&amp;&lt;img src={p.receiptUrl} alt=&quot;إيصال&quot; style={{width:65,height:65,borderRadius:&quot;10px&quot;,objectFit:&quot;cover&quot;,border:&quot;1px solid rgba(255,255,255,0.15)&quot;,cursor:&quot;pointer&quot;}} onClick={()=&gt;window.open(p.receiptUrl,&quot;_blank&quot;)}/&gt;}
          &lt;/div&gt;
          &lt;div style={{display:&quot;flex&quot;,gap:&quot;8px&quot;}}&gt;
            &lt;button onClick={()=&gt;approvePayment(p)} style={{flex:1,padding:&quot;11px&quot;,backgroundColor:&quot;rgba(34,197,94,0.15)&quot;,border:&quot;1px solid rgba(34,197,94,0.3)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#4ade80&quot;,fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;OK قبول وتفعيل&lt;/button&gt;
            &lt;button onClick={()=&gt;rejectPayment(p)} style={{flex:1,padding:&quot;11px&quot;,backgroundColor:&quot;rgba(239,68,68,0.15)&quot;,border:&quot;1px solid rgba(239,68,68,0.3)&quot;,borderRadius:&quot;10px&quot;,color:&quot;#f87171&quot;,fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,cursor:&quot;pointer&quot;}}&gt;X رفض&lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;}
    &lt;div style={{fontSize:&quot;13px&quot;,fontWeight:&quot;bold&quot;,color:&quot;#a1a1aa&quot;,marginBottom:&quot;8px&quot;}}&gt; سجل المدفوعات&lt;/div&gt;
    {payments.filter(p=&gt;p.status!==&quot;pending&quot;).slice(0,20).map(p=&gt;(
      &lt;div key={p.id} style={{...C.card,borderRight:`3px solid ${p.status===&quot;approved&quot;?&quot;#4ade80&quot;:&quot;#f87171&quot;}`}}&gt;
        &lt;div style={{display:&quot;flex&quot;,justifyContent:&quot;space-between&quot;,alignItems:&quot;center&quot;}}&gt;
          &lt;div&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;}}&gt;{p.studentName}&lt;/div&gt;&lt;div style={{fontSize:&quot;11px&quot;,color:&quot;#71717a&quot;}}&gt;{p.subject} • {p.stage}&lt;/div&gt;&lt;/div&gt;
          &lt;div style={{textAlign:&quot;left&quot;}}&gt;&lt;div style={{fontWeight:&quot;bold&quot;,fontSize:&quot;13px&quot;,color:&quot;#4ade80&quot;}}&gt;{p.amount} د.ع&lt;/div&gt;&lt;div style={{fontSize:&quot;11px&quot;,color:p.status===&quot;approved&quot;?&quot;#4ade80&quot;:&quot;#f87171&quot;}}&gt;{p.status===&quot;approved&quot;?&quot; مقبول&quot;:&quot; مرفوض&quot;}&lt;/div&gt;&lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    ))}
  &lt;/div&gt;;
}

// ─── MAIN APP ────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState(&quot;welcome&quot;);
  const [role,setRole]=useState(&quot;guest&quot;);
  const [currentStudent,setCurrentStudent]=useState(null);
  const [students,setStudents]=useState([]);
  const [clips,setClips]=useState([]);
  const [mySubscriptions,setMySubscriptions]=useState({});

  // Load saved session on startup - only if student has valid data
  useEffect(()=&gt;{
    const session = loadSession();
    if(session?.student?.phone &amp;&amp; session?.student?.pass &amp;&amp; session?.role){
      // Verify session is valid (has required fields)
      if(session.role === &quot;admin&quot; || (session.student.name &amp;&amp; session.student.account)){
        setCurrentStudent(session.student);
        setRole(session.role);
        setScreen(&quot;home&quot;);
      } else {
        clearSession();
      }
    }
  },[]);

  const [regName,setRegName]=useState(&quot;&quot;); const [regPhone,setRegPhone]=useState(&quot;&quot;); const [regAccount,setRegAccount]=useState(&quot;&quot;); const [regPass,setRegPass]=useState(&quot;&quot;); const [regErr,setRegErr]=useState(&quot;&quot;);
  const [loginPhone,setLoginPhone]=useState(&quot;&quot;); const [loginPass,setLoginPass]=useState(&quot;&quot;); const [loginErr,setLoginErr]=useState(&quot;&quot;);

  const [adminTab,setAdminTab]=useState(&quot;clips&quot;); const [showClipForm,setShowClipForm]=useState(false);
  const [editingClip,setEditingClip]=useState(null);
  const [confirmDeleteClip,setConfirmDeleteClip]=useState(null);
  const [clipStage,setClipStage]=useState(&quot;الابتدائية&quot;); const [clipGrade,setClipGrade]=useState(&quot;الأول&quot;);
  const [clipSubject,setClipSubject]=useState(&quot;الرياضيات&quot;); const [clipSemester,setClipSemester]=useState(&quot;الأول&quot;);
  const [clipType,setClipType]=useState(&quot;معلم&quot;); const [clipNum,setClipNum]=useState(&quot;01&quot;);
  const [clipTitle,setClipTitle]=useState(&quot;&quot;); const [clipTeacher,setClipTeacher]=useState(&quot;&quot;);
  const [clipVideoUrl,setClipVideoUrl]=useState(&quot;&quot;); const [savingClip,setSavingClip]=useState(false);
  const [clipThumbUrl,setClipThumbUrl]=useState(null);
  const [slidesTheme,setSlidesTheme]=useState(&quot;أزرق متدرج&quot;);
  const [notifTitle,setNotifTitle]=useState(&quot;&quot;); const [notifBody,setNotifBody]=useState(&quot;&quot;); const [sendingNotif,setSendingNotif]=useState(false);

  const [videoIdx,setVideoIdx]=useState(0); const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState(false); const [showMore,setShowMore]=useState(false);
  const [modal,setModal]=useState(null);
  const [tapCount,setTapCount]=useState(0); const [showAdminLogin,setShowAdminLogin]=useState(false);
  const tapTimer=useRef(null); const touchStartY=useRef(null);

  // Firebase listeners
  useEffect(()=&gt;{
    const u1=onSnapshot(collection(db,&quot;students&quot;),snap=&gt;{setStudents(snap.docs.map(d=&gt;({id:d.id,...d.data()})));});
    const u2=onSnapshot(collection(db,&quot;clips&quot;),snap=&gt;{setClips(snap.docs.map(d=&gt;({id:d.id,...d.data()})));});
    return ()=&gt;{u1();u2();};
  },[]);

  // Load subscriptions for current student
  useEffect(()=&gt;{
    if(!currentStudent?.phone) return;
    const unsub=onSnapshot(collection(db,&quot;subscriptions&quot;),snap=&gt;{
      const subs={};
      snap.docs.forEach(d=&gt;{
        const s=d.data();
        if(s.studentPhone===currentStudent.phone) subs[subKey(s.subject,s.stage)]=s;
      });
      setMySubscriptions(subs);
    });
    return ()=&gt;unsub();
  },[currentStudent]);

  // Check subscription expiry notifications
  useEffect(()=&gt;{
    if(!currentStudent||!Object.keys(mySubscriptions).length) return;
    Object.entries(mySubscriptions).forEach(([key,sub])=&gt;{
      const d=daysLeft(mySubscriptions,key.split(&quot;__&quot;)[0],key.split(&quot;__&quot;)[1]);
      if(d===3||d===1) {
        // Could add push notification here
        console.log(&quot;اشتراك &quot;+sub.subject+&quot; ينتهي خلال &quot;+d+&quot; يوم&quot;);
      }
    });
  },[mySubscriptions]);

  useEffect(()=&gt;{if(screen===&quot;home&quot;)setPlaying(true);else setPlaying(false);},[screen]);
  useEffect(()=&gt;{if(screen===&quot;home&quot;)setPlaying(true);},[videoIdx]);

  // All videos: Firebase clips first, then samples
  const allVideos=[...clips,...SAMPLE_VIDEOS];
  const video=allVideos[videoIdx]||SAMPLE_VIDEOS[0];

  const handleLogoTap=()=&gt;{setTapCount(c=&gt;{const n=c+1;if(n&gt;=6){setShowAdminLogin(true);clearTimeout(tapTimer.current);return 0;}clearTimeout(tapTimer.current);tapTimer.current=setTimeout(()=&gt;setTapCount(0),2000);return n;});};
  const handleTouchStart=(e)=&gt;{
    touchStartY.current=e.touches[0].clientY;
  };
  const handleTouchEnd=(e)=&gt;{
    if(touchStartY.current===null)return;
    const diff=touchStartY.current-e.changedTouches[0].clientY;
    if(Math.abs(diff)&lt;50){touchStartY.current=null;return;}
    if(diff&gt;0)setVideoIdx(i=&gt;Math.min(i+1,allVideos.length-1));
    else setVideoIdx(i=&gt;Math.max(i-1,0));
    touchStartY.current=null;
  };
  const handleTouchMove=(e)=&gt;{
    // Prevent pull-to-refresh on home screen only when at top
    if(e.touches[0].clientY &gt; touchStartY.current &amp;&amp; window.scrollY === 0){
      e.preventDefault();
    }
  };

  const doRegister=async()=&gt;{
    if(!regName.trim())return setRegErr(&quot;الرجاء إدخال الاسم&quot;);
    if(!regPhone.trim())return setRegErr(&quot;الرجاء إدخال رقم الموبايل&quot;);
    if(!regAccount.trim())return setRegErr(&quot;الرجاء إدخال اسم الحساب&quot;);
    if(!regPass.trim())return setRegErr(&quot;الرجاء إدخال كلمة المرور&quot;);
    if(students.find(s=&gt;s.phone===regPhone.trim()))return setRegErr(&quot;رقم الموبايل مسجل مسبقاً&quot;);
    try{const s={name:regName.trim(),phone:regPhone.trim(),account:regAccount.trim(),pass:regPass.trim(),createdAt:serverTimestamp()};await addDoc(collection(db,&quot;students&quot;),s);setCurrentStudent(s);setRole(&quot;student&quot;);setScreen(&quot;home&quot;);saveSession(s,&quot;student&quot;);setRegName(&quot;&quot;);setRegPhone(&quot;&quot;);setRegAccount(&quot;&quot;);setRegPass(&quot;&quot;);setRegErr(&quot;&quot;);}
    catch(e){setRegErr(&quot;فشل التسجيل: &quot;+e.message);}
  };

  const doLogin=()=&gt;{
    if(!loginPhone.trim()||!loginPass.trim())return setLoginErr(&quot;أدخل رقم الموبايل وكلمة المرور&quot;);
    const found=students.find(s=&gt;s.phone===loginPhone.trim()&amp;&amp;s.pass===loginPass.trim());
    if(found){setCurrentStudent(found);setRole(&quot;student&quot;);setScreen(&quot;home&quot;);saveSession(found,&quot;student&quot;);setLoginPhone(&quot;&quot;);setLoginPass(&quot;&quot;);setLoginErr(&quot;&quot;);}
    else{const ex=students.find(s=&gt;s.phone===loginPhone.trim());setLoginErr(ex?&quot;كلمة المرور غير صحيحة&quot;:&quot;رقم الموبايل غير مسجل&quot;);}
  };

  const openEditClip=(clip)=&gt;{
    setEditingClip(clip);
    setClipTitle(clip.title||&quot;&quot;);
    setClipTeacher(clip.teacher||&quot;&quot;);
    setClipStage(clip.stage||&quot;الابتدائية&quot;);
    setClipGrade(clip.grade||&quot;الأول&quot;);
    setClipSubject(clip.subject||&quot;الرياضيات&quot;);
    setClipSemester(clip.semester||&quot;الأول&quot;);
    setClipType(clip.type||&quot;معلم&quot;);
    setClipNum(clip.num||&quot;01&quot;);
    setClipVideoUrl(clip.videoUrl||&quot;&quot;);
    setClipThumbUrl(clip.thumbUrl||null);
    setShowClipForm(true);
  };

  const resetClipForm=()=&gt;{
    setEditingClip(null);
    setClipTitle(&quot;&quot;);setClipTeacher(&quot;&quot;);setClipVideoUrl(&quot;&quot;);
    setClipThumbUrl(null);setClipNum(&quot;01&quot;);
    setClipStage(&quot;الابتدائية&quot;);setClipGrade(&quot;الأول&quot;);
    setClipSubject(&quot;الرياضيات&quot;);setClipSemester(&quot;الأول&quot;);
    setClipType(&quot;معلم&quot;);
    setShowClipForm(false);
  };

  const saveClip=async()=&gt;{
    if(!clipTitle.trim())return showMsg(&quot;أدخل عنوان المقطع&quot;);
    setSavingClip(true);
    try{
      const data={
        title:clipTitle,stage:clipStage,grade:clipGrade,subject:clipSubject,
        semester:clipSemester,type:clipType,num:clipNum,teacher:clipTeacher,
        videoUrl:clipVideoUrl,thumbUrl:clipThumbUrl,
        bg:&quot;linear-gradient(180deg,#0f172a,#1e1b4b)&quot;
      };
      if(editingClip?.id){
        // Edit mode
        await updateDoc(doc(db,&quot;clips&quot;,editingClip.id),data);
        showMsg(&quot; تم تعديل المقطع!&quot;);
      } else {
        // Add mode
        await addDoc(collection(db,&quot;clips&quot;),{...data,createdAt:serverTimestamp()});
        showMsg(&quot; تم حفظ المقطع وسيظهر في الشاشة الرئيسية!&quot;);
      }
      resetClipForm();
    }catch(e){showMsg(&quot;فشل الحفظ: &quot;+e.message);}
    setSavingClip(false);
  };

  const sendNotif=async()=&gt;{
    if(!notifTitle.trim()||!notifBody.trim())return showMsg(&quot;أدخل العنوان والنص&quot;);
    setSendingNotif(true);
    try{await addDoc(collection(db,&quot;notifications&quot;),{title:notifTitle,body:notifBody,sentAt:serverTimestamp(),sentTo:students.length});showMsg(&quot; تم إرسال الإشعار لـ &quot;+students.length+&quot; طالب!&quot;);setNotifTitle(&quot;&quot;);setNotifBody(&quot;&quot;);}
    catch(e){showMsg(&quot;فشل: &quot;+e.message);}
    setSendingNotif(false);
  };

  const applyTemplate=(t)=&gt;{const T={expire:[&quot;تنبيه انتهاء الاشتراك&quot;,&quot;عزيزي الطالب، يرجى تجديد اشتراكك.&quot;],new_video:[&quot;تم رفع درس جديد! &quot;,&quot;قام الأستاذ برفع مقطع تعليمي جديد الآن.&quot;],remind:[&quot;حان وقت المذاكرة &quot;,&quot;ادخل وراجع دروسك ربع ساعة.&quot;],offer:[&quot;خصم 50% لفترة محدودة &quot;,&quot;اشترك الآن بنصف السعر.&quot;]};setNotifTitle(T[t][0]);setNotifBody(T[t][1]);};

  const closeModal=()=&gt;setModal(null);
  const showNav=screen!==&quot;welcome&quot;&amp;&amp;screen!==&quot;login&quot;&amp;&amp;screen!==&quot;register&quot;;
  const isSubbed=Object.values(mySubscriptions).some(s=&gt;new Date(s.expiresAt)&gt;new Date());

  return (
    &lt;div style={C.app}&gt;

      {/* HEADER */}
      {showNav&amp;&amp;(
        &lt;div style={C.header}&gt;
          &lt;div style={C.logoRow} onClick={handleLogoTap}&gt;
            &lt;img src={LOGO} alt=&quot;logo&quot; style={{width:28,height:28}}/&gt;
            &lt;div&gt;&lt;span style={{fontSize:&quot;20px&quot;,fontWeight:&quot;900&quot;,color:&quot;#38bdf8&quot;}}&gt;EduTok&lt;/span&gt;&lt;span style={{fontSize:&quot;10px&quot;,color:&quot;#71717a&quot;,display:&quot;block&quot;}}&gt;التعلم بطريقة ممتعة&lt;/span&gt;&lt;/div&gt;
          &lt;/div&gt;
          {role===&quot;admin&quot;&amp;&amp;&lt;button style={C.adminBtn} onClick={()=&gt;setScreen(&quot;admin&quot;)}&gt;&lt;Settings size={13}/&gt; إدارة&lt;/button&gt;}
        &lt;/div&gt;
      )}

      {/* WELCOME */}
      {screen===&quot;welcome&quot;&amp;&amp;(
        &lt;div style={C.welcomeWrap}&gt;
          &lt;img src={LOGO} alt=&quot;EduTok&quot; style={{width:120,height:120,marginBottom:16}}/&gt;
          &lt;h1 style={C.welcomeTitle}&gt;EduTok&lt;/h1&gt;
          &lt;p style={{color:&quot;
