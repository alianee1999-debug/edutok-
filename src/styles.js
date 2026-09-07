// ─── styles.js ──────────────────────────────────────────
// كل تنسيقات (CSS-in-JS) التطبيق مجمّعة بكائن واحد "C" — يُستورد بكل مكوّن
// يحتاج تنسيقًا مشتركًا، تجنّبًا لتكرار نفس القيم بعدة أماكن.

// ─── STYLES ─────────────────────────────────────────────
const C = {
  app:{width:"100%",maxWidth:"420px",minHeight:"100vh",backgroundColor:"#09090b",color:"#fff",fontFamily:"system-ui,-apple-system,sans-serif",direction:"rtl",margin:"0 auto",paddingBottom:"72px",boxSizing:"border-box",overflowX:"hidden",overflowY:"auto",position:"relative"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  logoRow:{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",pointerEvents:"auto"},
  section:{padding:"16px"},
  twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  tabsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"6px",padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  tab:(a)=>({padding:"8px 4px",borderRadius:"10px",border:"none",fontSize:"10px",fontWeight:"bold",cursor:"pointer",backgroundColor:a?"#f97316":"#27272a",color:"#fff",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:"3px"}),
  label:{display:"block",fontSize:"13px",color:"#a1a1aa",marginBottom:"6px"},
  input:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none"},
  select:{width:"100%",padding:"12px 14px",backgroundColor:"#18181b",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",color:"#fff",fontSize:"14px",marginBottom:"14px",boxSizing:"border-box",outline:"none",appearance:"none"},
  gradBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#f97316,#ef4444)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px",marginBottom:"10px"},
  blueBtn:{width:"100%",padding:"14px",backgroundColor:"#0ea5e9",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  redBtn:{width:"100%",padding:"14px",backgroundColor:"#ef4444",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",marginBottom:"14px"},
  purpleBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#7c3aed,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",display:"flex",justifyContent:"center",alignItems:"center",gap:"6px"},
  primaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"none",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer",marginBottom:"12px"},
  secondaryBtn:{width:"100%",padding:"15px",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.12)",backgroundColor:"#18181b",color:"#fff",fontSize:"15px",fontWeight:"bold",cursor:"pointer"},
  saveRow:{display:"flex",gap:"10px",marginTop:"8px"},
  cancelBtn:{flex:1,padding:"14px",backgroundColor:"#27272a",color:"#a1a1aa",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  saveBtn:{flex:1,padding:"14px",background:"linear-gradient(to right,#0ea5e9,#a855f7)",color:"#fff",border:"none",borderRadius:"12px",fontSize:"14px",fontWeight:"bold",cursor:"pointer"},
  adminBtn:{background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:"bold",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"},
  infoBanner:{backgroundColor:"rgba(8,47,73,0.4)",border:"1px solid #0369a1",borderRadius:"12px",padding:"12px",fontSize:"13px",color:"#38bdf8",marginBottom:"16px",display:"flex",alignItems:"center",gap:"6px"},
  card:{backgroundColor:"#18181b",borderRadius:"14px",padding:"14px 16px",marginBottom:"10px",border:"1px solid rgba(255,255,255,0.04)"},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"64px",backgroundColor:"#09090b",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:100,boxSizing:"border-box"},
  navItem:(a)=>({display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:a?"#38bdf8":"#71717a",gap:"2px",padding:"4px"}),
  welcomeWrap:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",minHeight:"88vh"},
  welcomeTitle:{fontSize:"36px",fontWeight:"900",background:"linear-gradient(to right,#38bdf8,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:"12px 0 4px"},
  priceRow:{display:"flex",alignItems:"center",justifyContent:"space-between",backgroundColor:"#18181b",padding:"10px 16px",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.04)"},
  priceInput:{width:"100%",background:"none",border:"none",color:"#fff",textAlign:"right",fontSize:"14px",outline:"none"},
  statsGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"10px"},
  statCard:{backgroundColor:"#18181b",padding:"16px 12px",borderRadius:"14px",textAlign:"center",border:"1px solid rgba(255,255,255,0.03)"},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:200,padding:"16px"},
  modalBox:{backgroundColor:"#18181b",borderRadius:"24px",padding:"24px",width:"100%",maxWidth:"380px",maxHeight:"88vh",overflowY:"auto"},
  videoWrap:{position:"relative",width:"calc(100% - 32px)",height:"500px",margin:"16px auto",borderRadius:"24px",border:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"center",alignItems:"center",overflow:"hidden"},
  confirmBox:{backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"14px",padding:"16px",marginBottom:"14px",textAlign:"center"},
  sidebar:{position:"absolute",left:"10px",bottom:"96px",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",gap:"14px",zIndex:15},
  sideBtn:(a)=>({width:"40px",height:"40px",background:"transparent",border:"none",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",cursor:"pointer",color:a?"#22d3ee":"#fff",gap:"3px",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.9)) drop-shadow(0 0 1px rgba(0,0,0,0.6))"}),
  sideTxt:(a)=>({fontSize:"9px",fontWeight:"600",color:a?"#22d3ee":"#fff",textShadow:"0 1px 3px rgba(0,0,0,0.9)"}),
  moreMenu:{position:"absolute",bottom:"20px",left:"16px",right:"16px",backgroundColor:"rgba(24,24,27,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"20px",padding:"14px 12px",display:"flex",justifyContent:"space-around",alignItems:"center",zIndex:30,backdropFilter:"blur(12px)"},
  moreItem:{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",background:"none",border:"none",color:"#fff",padding:"4px 8px"},
  // ── وضع ملء الشاشة (الشاشة الرئيسية فقط) ──
  fullScreenWrap:{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",height:"100vh",backgroundColor:"#000",overflow:"hidden",zIndex:1},
  // ✅ إصلاح: كان هذا الهيدر يمتد بعرض الشاشة كاملة (left:0,right:0) بـ zIndex:20
  // (أعلى من زر 📖 صورة صفحة الكتاب اللي عنده zIndex:6)، فيعترض الضغطة قبل ما توصل
  // للزر حتى لو بصرياً يبدو فاضياً بتلك المنطقة. pointer-events:"none" هنا يخلي
  // الضغطات "تخترق" الهيدر لما يكون تحته عنصر تفاعلي فعلي، وأعدنا تفعيل النقر
  // فقط على عنصر الشعار (logoRow) اللي فعلاً يحتاج يستقبل الضغطات.
  fullHeader:{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",zIndex:20,background:"linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0))",pointerEvents:"none"},
  floatingNav:{position:"absolute",bottom:0,left:0,right:0,display:"flex",justifyContent:"space-around",alignItems:"center",padding:"10px 0 48px",zIndex:25,background:"linear-gradient(0deg,rgba(0,0,0,0.75),rgba(0,0,0,0))"},
};
export { C };
