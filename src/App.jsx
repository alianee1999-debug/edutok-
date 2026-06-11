// ── Zain Cash Card ──
function ZainCashCard({wallet,isAdmin,phone,onTopUp,showNotif}) {
  const [amount,setAmount] = useState("");

  const handleTopUp = () => {
    const num = parseInt(amount);
    if (!num || num <= 0) {
      showNotif("يرجى إدخال مبلغ صحيح", "error");
      return;
    }
    onTopUp(num);
    setAmount("");
  };

  return (
    <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:14,padding:16,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:20}}>📱</span>
          <span style={{fontSize:14,fontWeight:700,color:"#22c55e"}}>بوابة زين كاش</span>
        </div>
        <div style={{fontSize:12,color:"#888"}}>{phone}</div>
      </div>
      
      <div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:12,marginBottom:12,textAlign:"center"}}>
        <div style={{fontSize:11,color:"#888",marginBottom:2}}>الرصيد الحالي</div>
        <div style={{fontSize:20,fontWeight:900,color:"#22c55e"}}>{wallet.balance.toLocaleString()} د.ع</div>
      </div>

      {!isAdmin && (
        <div style={{display:"flex",gap:8}}>
          <input 
            type="number" 
            value={amount} 
            onChange={e=>setAmount(e.target.value)} 
            placeholder="المبلغ د.ع"
            style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:13,outline:"none",textAlign:"center"}}
          />
          <Btn onClick={handleTopUp} style={{background:"#22c55e",borderRadius:10,padding:"8px 16px",color:"#fff",fontWeight:700,fontSize:13}}>
            شحن
          </Btn>
        </div>
      )}

      <div style={{marginTop:14}}>
        <div style={{fontSize:11,color:"#666",marginBottom:6,fontWeight:600}}>آخر العمليات</div>
        <div style={{maxHeight:120,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {wallet.txs.length === 0 ? (
            <div style={{fontSize:11,color:"#444",textAlign:"center",padding:10}}>لا توجد عمليات سابقة</div>
          ) : (
            wallet.txs.map(t=>(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",background:"rgba(255,255,255,0.02)",padding:"6px 10px",borderRadius:8,fontSize:11}}>
                <span style={{color:"#aaa"}}>{t.label}</span>
                <span style={{fontWeight:700,color:t.amount>0?"#22c55e":"#ef4444"}}>
                  {t.amount > 0 ? `+${t.amount.toLocaleString()}` : t.amount.toLocaleString()} د.ع
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ADMIN TAB
// ══════════════════════════════════════════════════════
function AdminTab({videos,setVideos,prices,updatePrice,adminWallet,adminPass,setAdminPass,adminPhone,setAdminPhone,adminTab,setAdminTab,showNotif,sendNotification,onPublish}) {
  const [vForm, setVForm] = useState({title:"",teacher:"",subject:SUBJECTS[0],stage:STAGES[0],grade:GRADES[STAGES[0]][0],type:"teacher",duration:"2:00",price:0,thumbnail:"📚",slidesText:""});
  const [notifForm, setNotifForm] = useState({title:"",body:""});

  const handlePublish = async () => {
    if (!vForm.title.trim() || !vForm.teacher.trim()) {
      showNotif("يرجى ملء جميع الحقول الأساسية", "error");
      return;
    }
    
    let parsedSlides = [];
    if (vForm.slidesText.trim()) {
      parsedSlides = vForm.slidesText.split("\n").filter(t=>t.trim()).map((text, i)=>({id:i+1,text,image:null}));
    }

    const newVideo = {
      id: Date.now(),
      title: vForm.title,
      teacher: vForm.teacher,
      subject: vForm.subject,
      stage: vForm.stage,
      grade: vForm.grade,
      type: vForm.type,
      duration: vForm.duration,
      price: parseInt(vForm.price) || 0,
      locked: parseInt(vForm.price) > 0,
      thumbnail: vForm.thumbnail,
      slides: parsedSlides,
      videoUrl: null
    };

    await saveVideoToDB(newVideo);
    setVideos(prev => [newVideo, ...prev]);
    showNotif("تم نشر الدرس بنجاح ✓");
    onPublish(newVideo);
  };

  const handleSendNotif = () => {
    if (!notifForm.title.trim() || !notifForm.body.trim()) {
      showNotif("أدخل عنوان ونص الإشعار", "error");
      return;
    }
    sendNotification(notifForm.title, notifForm.body);
    showNotif("تم إرسال الإشعار لجميع الطلاب ✓");
    setNotifForm({title:"",body:""});
  };

  const inp = {
    width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",marginBottom:10,display:"block"
  };

  return (
    <div style={{height:"100%",overflow:"auto",padding:"78px 16px 20px"}}>
      <div style={{display:"flex",gap:4,marginBottom:16,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:3}}>
        {/* أزرار التبديل الداخلية بلوحة التحكم */}
        {[["videos","📹 رفع درس"],["prices","🏷️ الأسعار"],["notifs","🔔 إشعار"],["wallet","💳 الخزنة"]].map(([t,l])=>(
          <Btn key={t} onClick={()=>setAdminTab(t)} style={{flex:1,background:adminTab===t?"#f59e0b":"transparent",borderRadius:8,padding:"8px 2px",color:adminTab===t?"#000":"#aaa",fontSize:11,fontWeight:700}}>
            {l}
          </Btn>
        ))}
      </div>

      {adminTab === "videos" && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:"#f59e0b"}}>🚀 نشر درس تعليمي جديد</div>
          <input style={inp} placeholder="عنوان الدرس" value={vForm.title} onChange={e=>setVForm(p=>({...p,title:e.target.value}))} />
          <input style={inp} placeholder="اسم المعلم" value={vForm.teacher} onChange={e=>setVForm(p=>({...p,teacher:e.target.value}))} />
          
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <select style={inp} value={vForm.subject} onChange={e=>setVForm(p=>({...p,subject:e.target.value}))}>
              {SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select style={inp} value={vForm.type} onChange={e=>setVForm(p=>({...p,type:e.target.value}))}>
              <option value="teacher">معلم حقيقي</option>
              <option value="ai">ذكاء اصطناعي</option>
              <option value="animation">رسوم متحركة</option>
            </select>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <select style={inp} value={vForm.stage} onChange={e=>setVForm(p=>({...p,stage:e.target.value,grade:GRADES[e.target.value][0]}))}>
              {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select style={inp} value={vForm.grade} onChange={e=>setVForm(p=>({...p,grade:e.target.value}))}>
              {GRADES[vForm.stage].map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <input style={inp} placeholder="الوقت (مثال 2:45)" value={vForm.duration} onChange={e=>setVForm(p=>({...p,duration:e.target.value}))} />
            <input style={inp} type="number" placeholder="السعر (0 للمجاني)" value={vForm.price} onChange={e=>setVForm(p=>({...p,price:e.target.value}))} />
          </div>

          <input style={inp} placeholder="رموز تعبيرية للغلاف (مثال: 🧬, 📐)" value={vForm.thumbnail} onChange={e=>setVForm(p=>({...p,thumbnail:e.target.value}))} />
          
          <div style={{fontSize:11,color:"#888",marginBottom:4}}>محتوى الشرائح التفاعلية (اكتب كل شريحة في سطر منفصل):</div>
          <textarea style={{...inp,height:80,resize:"none"}} placeholder="الشريحة الأولى: مقدمة الدرس...&#10;الشريحة الثانية: الشرح المفصل..." value={vForm.slidesText} onChange={e=>setVForm(p=>({...p,slidesText:e.target.value}))} />

          <Btn onClick={handlePublish} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:12,padding:12,color:"#fff",fontWeight:700,fontSize:14,marginTop:6}}>
            نشر وفك القفل للجميع ✓
          </Btn>
        </div>
      )}

      {adminTab === "prices" && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:"#f59e0b"}}>🏷️ التحكم بأسعار الاشتراكات للمواد</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"50vh",overflowY:"auto",paddingRight:2}}>
            {SUBJECTS.flatMap(s => STAGES.map(st => {
              const key = s + "_" + st;
              const current = prices[key] || {price:0, locked:false};
              return (
                <div key={key} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700}}>{s}</div>
                    <div style={{fontSize:10,color:"#666"}}>{st}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input 
                      type="number" 
                      style={{width:75,background:"#000",border:"1px solid #333",borderRadius:6,padding:"4px 6px",color:"#fff",fontSize:11,textAlign:"center"}} 
                      value={current.price} 
                      onChange={e=>updatePrice(key, "price", e.target.value)}
                    />
                    <Btn 
                      onClick={()=>updatePrice(key, "locked", !current.locked)}
                      style={{background:current.locked?"#ef4444":"#22c55e",borderRadius:6,padding:"4px 8px",color:"#fff",fontSize:10,fontWeight:700}}
                    >
                      {current.locked ? "مقفل 🔒" : "مفتوح 🔓"}
                    </Btn>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {adminTab === "notifs" && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:"#f59e0b"}}>🔔 إرسال إشعار عام للطلاب</div>
          <input style={inp} placeholder="عنوان الإشعار (مثال: تحديث جديد)" value={notifForm.title} onChange={e=>setNotifForm(p=>({...p,title:e.target.value}))} />
          <textarea style={{...inp,height:90,resize:"none"}} placeholder="اكتب نص الإشعار هنا للظهور الفوري لدى الطلاب..." value={notifForm.body} onChange={e=>setNotifForm(p=>({...p,body:e.target.value}))} />
          <Btn onClick={handleSendNotif} style={{width:"100%",background:"#f59e0b",borderRadius:10,padding:12,color:"#000",fontWeight:700,fontSize:13}}>
            إرسال الآن بث مباشر 🚀
          </Btn>
        </div>
      )}

      {adminTab === "wallet" && (
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:"#f59e0b"}}>💳 إجمالي أرباح المنصة المجمعة</div>
          <ZainCashCard wallet={adminWallet} isAdmin={true} phone={adminPhone} onTopUp={()=>{}} showNotif={showNotif} />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SLIDE PLAYER COMPONENT
// ══════════════════════════════════════════════════════
function SlidePlayer({video, isUnlocked, onTap, onClose}) {
  const [sIdx, setSIdx] = useState(0);
  const slides = video.slides || [];
  const currentSlide = slides[sIdx];

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:20,background:"#0c0c14",position:"relative"}}>
      {/* سهم الغلق المؤقت */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
        <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"6px 14px",color:"#fff",fontSize:13}}>✕ إغلاق</Btn>
        <div style={{fontSize:13,color:"#888"}}>{video.title}</div>
      </div>

      {/* منطقة محتوى الشريحة */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:10}}>
        {slides.length === 0 ? (
          <div style={{color:"#666"}}>لا توجد شرائح متوفرة في هذا الدرس.</div>
        ) : (
          <div style={{width:"100%",maxWidth:400,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:24,padding:24,textAlign:"center",boxShadow:"0 10px 40px rgba(168,85,247,0.05)",animation:"fadeIn 0.2s ease"}}>
            <div style={{fontSize:48,marginBottom:16}}>{video.thumbnail}</div>
            <div style={{fontSize:18,fontWeight:700,lineHeight:1.6,color:"#fff",whiteSpace:"pre-line"}}>{currentSlide?.text}</div>
          </div>
        )}
      </div>

      {/* أزرار التنقل والتحكم بالشرائح */}
      {slides.length > 0 && (
        <div style={{display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
          <div style={{display:"flex",gap:4}}>
            {slides.map((_, i)=>(
              <div key={i} onClick={()=>setSIdx(i)} style={{width:i===sIdx?24:6,height:6,background:i===sIdx?"#a855f7":"rgba(255,255,255,0.2)",borderRadius:3,cursor:"pointer",transition:"all 0.2s"}} />
            ))}
          </div>

          <div style={{display:"flex",width:"100%",maxWidth:400,gap:10,marginBottom:10}}>
            <Btn disabled={sIdx===0} onClick={()=>setSIdx(i=>i-1)} style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:12,color:sIdx===0?"#444":"#fff",fontWeight:600}}>
              السابق
            </Btn>
            <Btn 
              onClick={()=>{
                if (sIdx < slides.length - 1) setSIdx(i=>i+1);
                else onClose();
              }} 
              style={{flex:2,background:"#a855f7",borderRadius:12,padding:12,color:"#fff",fontWeight:700}}
            >
              {sIdx === slides.length - 1 ? "إنهاء الدرس 🎉" : "التالي ➔"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MODALS COMPONENTS
// ══════════════════════════════════════════════════════

// ── Pay Modal ──
function PayModal({v, wallet, onPay, onTopUp, onClose, showNotif}) {
  const canPay = wallet.balance >= v.price;

  const handlePay = () => {
    const success = onPay(v);
    if (success) {
      showNotif(`تم الاشتراك في مادة ${v.subject} بنجاح 🎉`);
      onClose();
    } else {
      showNotif("فشل الدفع، رصيدك غير كافٍ", "error");
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:360,background:"#12121a",border:"1px solid #f59e0b44",borderRadius:24,padding:24,textAlign:"center",animation:"slideUp 0.2s ease"}}>
        <div style={{fontSize:52,marginBottom:10}}>🔒</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>تأكيد الاشتراك المدفوع</div>
        <div style={{fontSize:12,color:"#aaa",marginBottom:16}}>أنت تشترك في مادة <span style={{color:"#f59e0b",fontWeight:700}}>{v.subject}</span> لجميع الفيديوهات التابعة للمرحلة.</div>
        
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:14,padding:14,marginBottom:20}}>
          <div style={{fontSize:11,color:"#666"}}>مبلغ الاشتراك المطلوب</div>
          <div style={{fontSize:26,fontWeight:900,color:"#f59e0b",margin:"2px 0"}}>{v.price.toLocaleString()} د.ع</div>
          <div style={{fontSize:11,color:canPay?"#22c55e":"#ef4444",fontWeight:600}}>رصيدك الحالي: {wallet.balance.toLocaleString()} د.ع</div>
        </div>

        {canPay ? (
          <Btn onClick={handlePay} style={{width:"100%",background:"#f59e0b",borderRadius:12,padding:12,color:"#000",fontWeight:700,fontSize:14,marginBottom:8}}>
            تأكيد الدفع والاشتراك الفوري ✓
          </Btn>
        ) : (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:"#ef4444",marginBottom:8,fontWeight:600}}>⚠️ رصيد محفظتك غير كافٍ لإتمام العملية</div>
            <Btn onClick={()=>{onTopUp(v.price - wallet.balance);}} style={{width:"100%",background:"rgba(34,197,94,0.15)",border:"1px solid #22c55e",borderRadius:12,padding:11,color:"#22c55e",fontWeight:700,fontSize:13,marginBottom:8}}>
              شحن العجز الحاصل عبر زين كاش ⚡
            </Btn>
          </div>
        )}
        <Btn onClick={onClose} style={{background:"transparent",color:"#666",fontSize:13,fontWeight:600,padding:4}}>إلغاء وتراجع</Btn>
      </div>
    </div>
  );
}

// ── Notification Bell Modal ──
function NotifModal({notifications, setNotifications, onClose}) {
  useEffect(() => {
    // تحديد جميع الإشعارات كمقروءة عند فتح النافذة
    setNotifications(prev => prev.map(n=>({...n, read:true})));
    try {
      const stored = JSON.parse(localStorage.getItem("edutok_notifs")||"[]");
      localStorage.setItem("edutok_notifs", JSON.stringify(stored.map(n=>({...n, read:true}))));
    } catch {}
  }, []);

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"end"}}>
      <div style={{width:"100%",background:"#0f0f15",borderRadius:"24px 24px 0 0",borderTop:"1px solid rgba(255,255,255,0.08)",padding:"16px 20px 32px",maxHeight:"75vh",overflowY:"auto",animation:"slideUp 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:800}}>🔔 التنبيهات والإشعارات</div>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"4px 12px",color:"#fff",fontSize:12}}>إغلاق</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {notifications.length === 0 ? (
            <div style={{textAlign:"center",color:"#444",padding:"40px 0",fontSize:13}}>لا توجد إشعارات واردة حتى الآن</div>
          ) : (
            notifications.map(n=>(
              <div key={n.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#00d4ff"}}>{n.title}</div>
                  <div style={{fontSize:9,color:"#555"}}>{n.date}</div>
                </div>
                <div style={{fontSize:11,color:"#ccc",lineHeight:1.5}}>{n.body}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wallet Modal ──
function WalletModal({wallet, adminWallet, isAdmin, onTopUp, onClose, showNotif}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:360,background:"#0f0f15",borderRadius:20,padding:20,border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700}}>💰 محفظتي الإلكترونية</div>
          <Btn onClick={onClose} style={{background:"transparent",color:"#888",fontSize:13}}>✕</Btn>
        </div>
        <ZainCashCard wallet={isAdmin?adminWallet:wallet} isAdmin={isAdmin} phone={isAdmin?"مدير النظام":"حساب الطالب"} onTopUp={onTopUp} showNotif={showNotif} />
      </div>
    </div>
  );
}

// ── AI Tutor Modal ──
function AIModal({onClose}) {
  const [messages, setMessages] = useState([{id:1,role:"ai",text:"مرحباً بك! أنا معلمك الذكي 🤖. أرسل لي أي سؤال برياضيات أو علوم وسأشرحه لك بالخطوات الممتعة."}]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = {id:Date.now(),role:"user",text:input};
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    
    setTimeout(() => {
      const aiResponse = {id:Date.now()+1,role:"ai",text:`لقد قمت بتحليل سؤالك المتميز! 🧠💡\nالجواب الشافي والمبسط هو تلخيص الفكرة في قاعدتين أساسيتين.\nهل تود مراجعة أمثلة تفاعلية عليها؟`};
      setMessages(prev => [...prev, aiResponse]);
    }, 800);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"#0a0a0f",display:"flex",flexDirection:"column"}}>
      <div style={{padding:16,borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:22}}>🤖</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#a855f7"}}>المعلم الذكي AI</div>
            <div style={{fontSize:9,color:"#22c55e"}}>نشط وجاهز لحل المسائل</div>
          </div>
        </div>
        <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"5px 12px",color:"#fff",fontSize:12}}>إغلاق</Btn>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {messages.map(m => (
          <div key={m.id} style={{alignSelf:m.role==="user"?"flex-start":"flex-end",maxWidth:"85%",background:m.role==="user"?"#22c55e":"rgba(168,85,247,0.12)",border:m.role==="user"?"none":"1px solid rgba(168,85,247,0.2)",padding:"10px 14px",borderRadius:14,color:"#fff",fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap"}}>
            {m.text}
          </div>
        ))}
      </div>

      <div style={{padding:12,borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8,background:"#0e0e16"}}>
        <input style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none"}} placeholder="اسأل الذكاء الاصطناعي..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} />
        <Btn onClick={handleSend} style={{background:"#a855f7",borderRadius:12,padding:"10px 16px",fontWeight:700,fontSize:13}}>إرسال</Btn>
      </div>
    </div>
  );
}

// ── Student Chat Modal ──
function ChatModal({onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:340,background:"#0f0f15",borderRadius:20,padding:20,textAlign:"center",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:40,marginBottom:8}}>💬</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>مجموعات النقاش الجماعية</div>
        <div style={{fontSize:12,color:"#888",marginBottom:16,lineHeight:1.5}}>انضم إلى غرف الدردشة التفاعلية الحية مع زملائك في نفس الصف لمناقشة حلول الواجبات المدرسية وتبادل الآراء.</div>
        <div style={{background:"rgba(255,255,255,0.02)",padding:12,borderRadius:12,fontSize:11,color:"#22c55e",fontWeight:600,marginBottom:16}}>💡 الميزة ستتاح بالكامل في التحديث القادم!</div>
        <Btn onClick={onClose} style={{width:"100%",background:"rgba(255,255,255,0.06)",borderRadius:10,padding:10,color:"#aaa",fontSize:13}}>حسناً</Btn>
      </div>
    </div>
  );
}

// ── Camera Solver Modal ──
function CameraModal({onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#f59e0b"}}>📷 ماسح الأسئلة السريع</div>
        <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"4px 12px",fontSize:12}}>إلغاء</Btn>
      </div>
      <div style={{alignSelf:"center",width:260,height:260,border:"2px dashed #f59e0b",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
        <div style={{position:"absolute",width:20,height:20,borderTop:"4px solid #f59e0b",borderRight:"4px solid #f59e0b",top:-2,right:-2}} />
        <div style={{fontSize:12,color:"#666",textAlign:"center",padding:20}}>ضع السؤال المكتوب في الورقة داخل المربع ليتم حله بالذكاء الاصطناعي</div>
      </div>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:68,height:68,background:"#fff",borderRadius:"50%",margin:"0 auto",cursor:"pointer",border:"4px solid rgba(255,255,255,0.3)"}} onClick={()=>alert("تطلب البيئة الوصول للكاميرا الحية للحل.")} />
      </div>
    </div>
  );
}

// ── PDF Attachment Modal ──
function PDFModal({onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:340,background:"#0f0f15",borderRadius:20,padding:20,textAlign:"center",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:40,marginBottom:8}}>📄</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>الملخصات وكتب الـ PDF</div>
        <div style={{fontSize:12,color:"#888",marginBottom:16,lineHeight:1.5}}>جميع ملازم المعلمين الملحقة والمطابقة للدرس الحالي ستكون متاحة للتنزيل المباشر على هاتفك المحمول.</div>
        <div style={{background:"rgba(239,68,68,0.1)",padding:10,borderRadius:10,fontSize:11,color:"#ef4444",fontWeight:600,marginBottom:16}}>لا توجد ملفات مرفقة لهذا المقطع حالياً</div>
        <Btn onClick={onClose} style={{width:"100%",background:"rgba(255,255,255,0.06)",borderRadius:10,padding:10,color:"#aaa",fontSize:13}}>رجوع</Btn>
      </div>
    </div>
  );
}

// ── Share Social Modal ──
function ShareModal({v, onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"end"}}>
      <div style={{width:"100%",background:"#0f0f15",borderRadius:"24px 24px 0 0",padding:"20px 20px 32px",animation:"slideUp 0.2s ease",textAlign:"center"}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.2)",margin:"0 auto 14px"} } />
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>مشاركة درس: {v.title}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          {[["WhatsApp","🟢"],["Telegram","🔵"],["نسخ الرابط","🔗"]].map(([name,ico],i)=>(
            <Btn key={i} onClick={()=>{alert("تم نسخ رابط المشاركة بنجاح! 🎉");onClose();}} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:14,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <span style={{fontSize:24}}>{ico}</span>
              <span style={{fontSize:11,color:"#ccc"}}>{name}</span>
            </Btn>
          ))}
        </div>
        <Btn onClick={onClose} style={{width:"100%",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:11,color:"#888",fontSize:13}}>إلغاء</Btn>
      </div>
    </div>
  );
}

// ── Class Filter Modal ──
function ClassModal({onClose, videos, onFilter}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:350,background:"#0f0f15",borderRadius:20,padding:20,border:"1px solid rgba(255,255,255,0.08)",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:800}}>🏫 تصفية المحتوى حسب المواد</div>
          <Btn onClick={onClose} style={{background:"transparent",color:"#666",fontSize:14}}>✕</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {SUBJECTS.map(subj => {
            const matches = videos.filter(v => v.subject === subj);
            return (
              <Btn 
                key={subj} 
                disabled={matches.length===0} 
                onClick={()=>onFilter(subj, matches)} 
                style={{display:"flex",justifyContent:"space-between",background:"rgba(255,255,255,0.03)",padding:12,borderRadius:10,color:matches.length>0?"#fff":"#444",textAlign:"right",fontSize:13}}
              >
                <span>{subj}</span>
                <span style={{fontSize:11,color:"#666"}}>{matches.length} درس</span>
              </Btn>
            );
          })}
        </div>
      </div>
    </div>
  );
}
