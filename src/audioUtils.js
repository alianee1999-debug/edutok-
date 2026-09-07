// ─── audioUtils.js ──────────────────────────────────────
// أدوات صوتية بسيطة: قراءة نصية (Text-to-Speech)، مؤثرات صوتية قصيرة مولّدة
// برمجياً (بدون ملفات صوت خارجية)، ورمز "رفيق النمو" (Growth Mascot) المرتبط
// بمستوى الطالب. لا تعتمد على React، فقط Web APIs (speechSynthesis, AudioContext).

// ─── قراءة صوتية (Text-to-Speech) ────────────────────────
let _currentUtterance = null;
const stopSpeaking = () => { try{ window.speechSynthesis?.cancel(); }catch{} _currentUtterance=null; };
const getArabicVoice = () => {
  try{
    if(!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v=>v.lang?.toLowerCase().startsWith("ar")) || null;
  }catch{ return null; }
};
const speakText = (text, onEnd) => {
  try{
    if(!("speechSynthesis" in window)) return false;
    stopSpeaking();
    const spoken = String(text).replace(/\$[^$]+\$/g, " معادلة ").replace(/\s+/g," ").trim();
    if(!spoken) return false;
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = "ar-SA";
    utter.rate = 0.95;
    const arVoice = getArabicVoice();
    if(arVoice) utter.voice = arVoice;
    utter.onend = ()=>{ _currentUtterance=null; if(onEnd) onEnd(); };
    utter.onerror = ()=>{ _currentUtterance=null; if(onEnd) onEnd(); };
    _currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return true;
  }catch{ return false; }
};

// ─── أصوات تفاعلية بسيطة (Sound Design) ─────────────────
let _audioCtx = null;
const playTone = (freq, duration=150, volume=0.12) => {
  try{
    if(!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==="suspended") _audioCtx.resume();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain); gain.connect(_audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + duration/1000);
    osc.stop(_audioCtx.currentTime + duration/1000);
  }catch(e){ /* بعض المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بصمت، غير حرج */ }
};
const playCorrectSound = () => { playTone(880,110); setTimeout(()=>playTone(1175,150),90); };
const playWrongSound = () => { playTone(220,220); };
const playFanfareSound = () => { playTone(523,110); setTimeout(()=>playTone(659,110),110); setTimeout(()=>playTone(784,220),220); };
const playLevelUpSound = () => { playTone(659,90); setTimeout(()=>playTone(784,90),90); setTimeout(()=>playTone(988,90),180); setTimeout(()=>playTone(1319,260),270); };

// ─── رفيق النمو (Growth Mascot) — يتطوّر شكله مع ارتفاع مستوى الطالب ───
const getMascot = (level) => {
  if(level>=11) return {emoji:"🐉", label:"أسطورة"};
  if(level>=8)  return {emoji:"🦉", label:"حكيم"};
  if(level>=5)  return {emoji:"🌳", label:"شجرة يانعة"};
  if(level>=3)  return {emoji:"🌿", label:"نبتة نامية"};
  return {emoji:"🌱", label:"بذرة"};
};

export { stopSpeaking, getArabicVoice, speakText, playTone, playCorrectSound, playWrongSound, playFanfareSound, playLevelUpSound, getMascot };
