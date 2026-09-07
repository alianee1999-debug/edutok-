// ─── admin/StatsChart.jsx ────────────────────────────────
// رسم بياني بسيط (SVG مباشر بدون مكتبات) لتطوّر عدد الطلاب والإيرادات عبر
// الزمن، بالاعتماد على لقطات يومية بمجموعة "dailyStats".
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Spinner } from "../components/Shared";

function MiniLineChart({points, color, formatValue}) {
  if(points.length===0) return null;
  if(points.length===1){
    // نقطة وحدة بس — نعرضها كرقم بدل خط ما له معنى
    return <div style={{textAlign:"center",padding:"20px",color:"#71717a",fontSize:"12px"}}>يوم واحد بس مسجّل لحد الآن — الخط البياني بيظهر بعد يومين فأكثر</div>;
  }
  const W=280,H=90,pad=8;
  const vals=points.map(p=>p.value);
  const min=Math.min(...vals), max=Math.max(...vals);
  const range=(max-min)||1;
  const stepX=(W-pad*2)/(points.length-1);
  const coords=points.map((p,i)=>{
    const x=pad+i*stepX;
    const y=H-pad-((p.value-min)/range)*(H-pad*2);
    return {x,y,...p};
  });
  const pathD=coords.map((c,i)=>(i===0?"M":"L")+c.x.toFixed(1)+","+c.y.toFixed(1)).join(" ");
  const areaD=pathD+` L${coords[coords.length-1].x.toFixed(1)},${H-pad} L${coords[0].x.toFixed(1)},${H-pad} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"90px"}}>
        <path d={areaD} fill={color} opacity="0.12"/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="2"/>
        {coords.map((c,i)=>(
          <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={color}/>
        ))}
      </svg>
      <div dir="ltr" style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#52525b",marginTop:"2px"}}>
        <span>{points[0].date}</span>
        <span>{points[points.length-1].date}</span>
      </div>
    </div>
  );
}

function StatsChartCard() {
  const [dailyStats,setDailyStats]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const q=query(collection(db,"dailyStats"),orderBy("date","asc"),limit(90));
    const unsub=onSnapshot(q,snap=>{
      setDailyStats(snap.docs.map(d=>d.data()));
      setLoading(false);
    },()=>setLoading(false));
    return()=>unsub();
  },[]);

  const shortDate=(d)=>{ const parts=(d||"").split("-"); return parts.length===3?parts[2]+"/"+parts[1]:d; };

  const studentsPoints = dailyStats.map(s=>({date:shortDate(s.date),value:Number(s.totalStudents||0)}));
  const revenuePoints = dailyStats.map(s=>({date:shortDate(s.date),value:Number(s.totalRevenue||0)}));
  const newStudentsTotal = dailyStats.reduce((sum,s)=>sum+Number(s.newStudentsToday||0),0);

  return (
    <div style={{backgroundColor:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
      <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px",color:"#c084fc"}}>
        📈 تطوّر الأداء بمرور الوقت
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"16px"}}><Spinner color="#c084fc"/></div>
      ):dailyStats.length===0?(
        <div style={{textAlign:"center",padding:"16px",color:"#71717a",fontSize:"12px"}}>
          ما فيه بيانات تاريخية بعد. السجل اليومي يبدأ يتجمّع تلقائياً من اليوم اللي يُفعَّل فيه جدول Vercel Cron، وبعد يومين يبدأ يظهر رسم بياني هنا.
        </div>
      ):(
        <div>
          <div style={{fontSize:"11px",color:"#a1a1aa",marginBottom:"6px"}}>عدد الطلاب الكلي</div>
          <MiniLineChart points={studentsPoints} color="#a855f7"/>
          <div style={{fontSize:"11px",color:"#a1a1aa",margin:"14px 0 6px"}}>إجمالي الإيرادات المقبولة (د.ع)</div>
          <MiniLineChart points={revenuePoints} color="#4ade80"/>
          <div style={{fontSize:"11px",color:"#71717a",marginTop:"10px",textAlign:"center"}}>
            {newStudentsTotal} طالب جديد خلال آخر {dailyStats.length} يوم مسجَّل
          </div>
        </div>
      )}
    </div>
  );
}

export { MiniLineChart, StatsChartCard };
