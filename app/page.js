"use client";
import { useState, useEffect, useRef } from "react";

const STAGES = [
  { id: 1, key: "problem",     label: "Problem",            icon: "🔍", question: "Problem net tanımlandı mı? Kimin acısı, ne zaman, nasıl oluşuyor — bunlar açık mı?" },
  { id: 2, key: "customer",    label: "Target Customer",    icon: "👤", question: "Hedef müşteri segmenti somut mu? Kim oldukları, ne istedikleri, nerede oldukları net mi?" },
  { id: 3, key: "existing",    label: "Existing Solutions", icon: "🏛", question: "Mevcut çözümler ve rakipler tartışıldı mı? Neden yetersiz kaldıkları açıklandı mı?" },
  { id: 4, key: "value",       label: "Unique Value",       icon: "💎", question: "Benzersiz değer önerisi net mi? Neden bu girişim, neden şimdi, neden bu founder?" },
  { id: 5, key: "validation",  label: "Validation",         icon: "✅", question: "Varsayımları test eden somut kanıt var mı? Kullanıcıyla konuşuldu mu?" },
  { id: 6, key: "business",    label: "Business Model",     icon: "💰", question: "Gelir modeli somut mu? Kim ödüyor, ne kadar, hangi kanaldan?" },
  { id: 7, key: "mvp",         label: "MVP",                icon: "🛠", question: "MVP tanımı yapıldı mı? İlk çıkarılacak şey, kime, ne zaman — net mi?" },
  { id: 8, key: "gtm",         label: "Go to Market",       icon: "🚀", question: "İlk 100 müşteriyi kazanma stratejisi var mı? Kanal ve mesaj belli mi?" },
  { id: 9, key: "fundraising", label: "Fundraising",        icon: "🏆", question: "Yatırım ihtiyacı ve kullanım alanları netleşti mi? Ne kadar, neden, ne zaman?" },
];

const CANVAS_FIELDS = ["Problem","Customer","Solution","Value Proposition","Revenue","Channels","Costs","Moat"];

const buildPrompt = (persona, stage, userName, insights) => {
  const insightBlock = insights?.biggestRisk ? `
Konuşmadan biriktirdiğin notlar:
- En büyük risk: ${insights.biggestRisk}
- Hâlâ belirsiz olan: ${insights.unclearPart}
- Güçlü taraf: ${insights.strength}
Bu notları göz önünde bulundurarak daha akıllı sorular sor.` : "";
  return `${persona.core}
Kullanıcı adı: ${userName}
Şu an odaklanılan aşama: "${stage}"
${insightBlock}

MESAJ FORMATI — Her mesajda tam olarak şu ikisini yap:
1. Yorum (max 2 cümle): Somut, actionable gözlem. Soyut eleştiri değil — ne yapması gerektiğini söyle.
2. Soru (1 cümle): Bu aşamayla doğrudan ilgili, tek, net soru.

YASAK: Uzun paragraflar. Boş genel tavsiyeler. Birden fazla soru.
Toplam cevap 4 cümleyi asla geçmesin.`;
};

const MENTORS = [
  { id: "razor", name: "The Razor", avatar: "TR", color: "#f97316", title: "Seri girişimci & erken dönem yatırımcı", style: "Seni dinler, sonra tek bir soruyla zemini kaydırır.", core: `Sen "The Razor" — keskin, doğrudan, dürüst. Türkçe konuş. Kısa cümleler. Eleştiri yaparken daima somut bir alternatif öner.` },
  { id: "contrarian", name: "The Contrarian", avatar: "TC", color: "#6366f1", title: "Teknoloji felsefecisi & monopol avcısı", style: "Seni rahatlatmaz. Doğru sandığın şeyi tersine çevirir.", core: `Sen "The Contrarian" — kontrarian, monopol avcısı. Türkçe konuş. KISA yaz — felsefi olmak uzun yazmak değil. Eleştirini 1 cümlede bitir.` },
  { id: "navigator", name: "The Navigator", avatar: "TN", color: "#10b981", title: "Kullanıcı araştırmacısı & ürün stratejisti", style: "Sabırlı ve sıcak — ama 'henüz bakmadım' cevabına alışkın değil.", core: `Sen "The Navigator" — metodolojik, lean startup odaklı. Türkçe konuş. Kanıt iste. MVP'yi küçük tut.` },
  { id: "investor", name: "The Investor", avatar: "TI", color: "#eab308", title: "Büyüme odaklı yatırımcı", style: "Rakamlar yalan söylemez. CAC, LTV, büyüme — bunlar olmadan konuşmaz.", core: `Sen "The Investor" — büyüme odaklı, sayılarla düşünen. Türkçe konuş. CAC, LTV, market size, scalability sorgula.` },
  { id: "builder", name: "The Builder", avatar: "TB", color: "#06b6d4", title: "Ürün mimarı & teknik stratejist", style: "Fikri değil, nasıl yapılacağını sorar. MVP'yi en küçük haliyle çizer.", core: `Sen "The Builder" — ürün odaklı, teknik düşünen. Türkçe konuş. MVP'yi en küçük haliyle tanımla.` },
  { id: "customer", name: "The Customer", avatar: "CX", color: "#ec4899", title: "Kullanıcı sesi & pazar gerçekçisi", style: "Müşteri gözünden bakar. Neden kullansın, neden ödesin — bunlar olmadan ürün yok.", core: `Sen "The Customer" — kullanıcı perspektifli. Türkçe konuş. "Ben neden kullansam?" sorusunu daima sor.` },
];

async function callAI(system, messages, maxTokens = 800) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages, maxTokens }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    const data = await res.json();
    return data.text || data.error || "Hata.";
  } catch (e) {
    clearTimeout(tid);
    return e.name === "AbortError" ? "__TIMEOUT__" : "__ERROR__";
  }
}

async function checkStageComplete(criterion, lastUser, lastAssistant) {
  const r = await callAI(
    `Startup mentörlük seansı değerlendiriyorsun. SADECE "YES" veya "NO" yaz.`,
    [{ role: "user", content: `Aşama kriteri: "${criterion}"\nGirişimci: "${lastUser}"\nMentor: "${lastAssistant}"\nTamamlandı mı?` }], 10
  );
  return r.trim().toUpperCase().startsWith("YES");
}

async function updateCanvasIncremental(current, conv) {
  const r = await callAI(
    `Canvas güncelleyici. SADECE JSON döndür. Mevcut değerleri koru. Emin değilsen değiştirme.\nFormat: {"Problem":"","Customer":"","Solution":"","Value Proposition":"","Revenue":"","Channels":"","Costs":"","Moat":""}`,
    [{ role: "user", content: `Mevcut:\n${JSON.stringify(current)}\n\nKonuşma:\n${conv}` }], 400
  );
  try { return JSON.parse(r.replace(/```json|```/g, "").trim()); } catch { return current; }
}

async function updateInsights(current, conv) {
  const r = await callAI(
    `3 insight çıkar. SADECE JSON: {"biggestRisk":"...","unclearPart":"...","strength":"..."}`,
    [{ role: "user", content: conv }], 200
  );
  try { return JSON.parse(r.replace(/```json|```/g, "").trim()); } catch { return current; }
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
const SK = "vo-next-profiles";
function loadLocal() { try { return JSON.parse(localStorage.getItem(SK) || "{}"); } catch { return {}; } }
function saveLocal(p) { try { localStorage.setItem(SK, JSON.stringify(p)); } catch {} }

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function Bg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "linear-gradient(150deg,#060a10 0%,#0a1020 60%,#07111e 100%)", overflow: "hidden" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", opacity: 0.06 + i*.02, background: ["#3b82f6","#6366f1","#0ea5e9"][i], width: [600,400,500][i], height: [400,300,350][i], left: ["-10%","60%","20%"][i], top: ["60%","-10%","30%"][i], animation: `orb${i} ${10+i*4}s ease-in-out infinite alternate` }} />
      ))}
      <style>{`
        @keyframes orb0{to{transform:translate(40px,-60px)}} @keyframes orb1{to{transform:translate(-50px,40px)}} @keyframes orb2{to{transform:translate(60px,30px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono&display=swap');
        *{box-sizing:border-box} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:2px} textarea:focus,input:focus{outline:none}
      `}</style>
    </div>
  );
}

function StageBar({ currentStage, completedStages }) {
  return (
    <div style={{ display: "flex", gap: 2, overflowX: "auto", padding: "0 2px", scrollbarWidth: "none" }}>
      {STAGES.map(s => {
        const active = s.id === currentStage, done = completedStages.includes(s.id);
        return (
          <div key={s.id} style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 99, background: active ? "rgba(255,255,255,.1)" : done ? "rgba(34,197,94,.08)" : "transparent", color: active ? "#e2e8f0" : done ? "#22c55e" : "#1e293b", fontFamily: "DM Sans", fontSize: 10.5, fontWeight: active ? 500 : 300, display: "flex", alignItems: "center", gap: 3, outline: active ? "1px solid rgba(255,255,255,.12)" : done ? "1px solid rgba(34,197,94,.15)" : "none", transition: "all .3s" }}>
            <span>{done ? "✓" : s.icon}</span><span style={{ whiteSpace: "nowrap" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function InsightBadge({ insights }) {
  if (!insights?.biggestRisk) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 0 0" }}>
      {[{ label: "Risk", value: insights.biggestRisk, color: "#ef4444" }, { label: "Belirsiz", value: insights.unclearPart, color: "#f97316" }, { label: "Güç", value: insights.strength, color: "#22c55e" }].map(b => b.value && (
        <div key={b.label} style={{ fontSize: 10, fontFamily: "DM Sans", color: b.color, background: `${b.color}10`, border: `1px solid ${b.color}20`, borderRadius: 99, padding: "2px 8px", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ opacity: .6 }}>{b.label}:</span> {b.value}
        </div>
      ))}
    </div>
  );
}

function CanvasPanel({ canvas }) {
  const filled = CANVAS_FIELDS.filter(f => canvas[f]);
  const pct = Math.round((filled.length / CANVAS_FIELDS.length) * 100);
  return (
    <div style={{ animation: "slideIn .3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 15, color: "#e2e8f0", fontStyle: "italic" }}>Startup Canvas</span>
        <span style={{ fontFamily: "DM Mono", fontSize: 11, color: "#475569" }}>{pct}%</span>
      </div>
      <div style={{ height: 2, background: "rgba(255,255,255,.05)", borderRadius: 99, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)", transition: "width 1s cubic-bezier(.4,0,.2,1)", borderRadius: 99 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {CANVAS_FIELDS.map(f => (
          <div key={f} style={{ padding: "9px 11px", borderRadius: 9, background: canvas[f] ? "rgba(59,130,246,.07)" : "rgba(255,255,255,.02)", border: `1px solid ${canvas[f] ? "rgba(59,130,246,.18)" : "rgba(255,255,255,.04)"}`, transition: "all .5s" }}>
            <div style={{ fontSize: 9, color: "#334155", fontFamily: "DM Sans", letterSpacing: .8, textTransform: "uppercase", marginBottom: 3 }}>{f}</div>
            <div style={{ fontSize: 11.5, color: canvas[f] ? "#94a3b8" : "#1e293b", fontFamily: "DM Sans", fontWeight: 300, lineHeight: 1.5, minHeight: 14 }}>{canvas[f] || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SidePanel({ tab, canvas, multiResult, multiLoading, onMulti, brutalResult, brutalLoading, onBrutal, ycResult, ycLoading, onYC, userMsgCount, onClose, setTab }) {
  return (
    <div style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,.05)", background: "rgba(6,10,16,.7)", backdropFilter: "blur(16px)", overflowY: "auto", padding: "16px 14px", flexShrink: 0, animation: "slideIn .3s ease both" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ t:"canvas",l:"Canvas"},{t:"multi",l:"🔮"},{t:"brutal",l:"⚡"},{t:"yc",l:"🎯"}].map(x => (
          <button key={x.t} onClick={() => setTab(x.t)} style={{ flex: 1, background: tab===x.t?"rgba(255,255,255,.07)":"transparent", border:`1px solid ${tab===x.t?"rgba(255,255,255,.1)":"rgba(255,255,255,.03)"}`, borderRadius: 7, padding: "5px 3px", color: tab===x.t?"#94a3b8":"#1e293b", fontFamily:"DM Sans", fontSize:9.5, cursor:"pointer" }}>{x.l}</button>
        ))}
        <button onClick={onClose} style={{ background:"transparent",border:"none",color:"#1e293b",cursor:"pointer",fontSize:14,padding:"0 3px" }}>×</button>
      </div>
      {tab==="canvas" && <CanvasPanel canvas={canvas} />}
      {tab==="multi" && <MultiPanel result={multiResult} loading={multiLoading} onRun={onMulti} />}
      {tab==="brutal" && <BrutalPanel result={brutalResult} loading={brutalLoading} onRun={onBrutal} hasEnough={userMsgCount>=4} />}
      {tab==="yc" && <YCPanel result={ycResult} loading={ycLoading} onRun={onYC} hasEnough={userMsgCount>=5} />}
    </div>
  );
}

function MultiPanel({ result, loading, onRun }) {
  if (loading) return <Spinner color="#8b5cf6" label="3 perspektif hazırlanıyor..." />;
  if (!result) return <CTA icon="🔮" title="3 Perspectives" desc={"Aynı anda 3 farklı mentor bakışı.\nKeskin, felsefi, kullanıcı odaklı."} btnLabel="Get 3 Perspectives" btnColor="#7c3aed" onClick={onRun} />;
  return (
    <div style={{ animation:"slideIn .3s ease both" }}>
      <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:15, color:"#e2e8f0", fontStyle:"italic", marginBottom:14 }}>🔮 3 Perspectives</div>
      {[{key:"razor",name:"The Razor",color:"#f97316"},{key:"contrarian",name:"The Contrarian",color:"#6366f1"},{key:"builder",name:"The Builder",color:"#06b6d4"}].map(p => result[p.key] && (
        <div key={p.key} style={{ marginBottom:12, padding:"12px 14px", borderRadius:10, background:`${p.color}07`, border:`1px solid ${p.color}20` }}>
          <div style={{ fontSize:10, color:p.color, fontFamily:"DM Mono", letterSpacing:.8, marginBottom:6 }}>{p.name}</div>
          <div style={{ fontSize:12.5, color:"#94a3b8", fontFamily:"DM Sans", fontWeight:300, lineHeight:1.65 }}>{result[p.key]}</div>
        </div>
      ))}
      <button onClick={onRun} style={{ width:"100%", background:"rgba(124,58,237,.1)", border:"1px solid rgba(124,58,237,.2)", borderRadius:8, padding:9, color:"#7c3aed", fontFamily:"DM Sans", fontSize:11, cursor:"pointer", marginTop:8 }}>Yenile</button>
    </div>
  );
}

function BrutalPanel({ result, loading, onRun, hasEnough }) {
  if (!hasEnough) return <CTA icon="⚡" title="Brutal Test" desc="Önce mentörünle en az 4 mesaj konuş." />;
  if (loading) return <Spinner color="#ef4444" label="Acımasız analiz yapılıyor..." />;
  if (!result) return <CTA icon="⚡" title="Brutal Test" desc={"Neden başarısız olur. Kim umursamaz.\nBüyükler ne yapar. Kurucular nerede takılır."} btnLabel="⚡ Brutal Test" btnColor="#ef4444" onClick={onRun} />;
  return (
    <div style={{ animation:"slideIn .3s ease both" }}>
      <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:15, color:"#ef4444", fontStyle:"italic", marginBottom:14 }}>⚡ Brutal Test</div>
      {[{key:"fail",label:"Neden başarısız olur",color:"#ef4444"},{key:"ignore",label:"Kim umursamaz",color:"#f97316"},{key:"incumbent",label:"Büyükler ne yapar",color:"#eab308"},{key:"founders",label:"Kurucular nerede takılır",color:"#a855f7"}].map(s => result[s.key] && (
        <div key={s.key} style={{ marginBottom:10, padding:"11px 13px", borderRadius:9, background:`${s.color}07`, border:`1px solid ${s.color}18` }}>
          <div style={{ fontSize:9, color:s.color, fontFamily:"DM Mono", letterSpacing:.8, textTransform:"uppercase", marginBottom:5 }}>{s.label}</div>
          <div style={{ fontSize:12.5, color:"#94a3b8", fontFamily:"DM Sans", fontWeight:300, lineHeight:1.65 }}>{result[s.key]}</div>
        </div>
      ))}
    </div>
  );
}

function YCPanel({ result, loading, onRun, hasEnough }) {
  if (!hasEnough) return <CTA icon="🎯" title="YC Mode" desc="En az 5 mesaj gerekli." />;
  if (loading) return <Spinner color="#eab308" label="YC partnerleri değerlendiriyor..." />;
  if (!result) return <CTA icon="🎯" title="YC Mode" desc={"5 YC sorusu. Partner simülasyonu.\nSonunda: Invest / Maybe / No."} btnLabel="🎯 YC Simülasyonu" btnColor="#d97706" onClick={onRun} />;
  const vc=result.verdict, vcColor=vc==="Invest"?"#22c55e":vc==="Maybe"?"#eab308":"#ef4444";
  return (
    <div style={{ animation:"slideIn .3s ease both" }}>
      <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:15, color:"#eab308", fontStyle:"italic", marginBottom:14 }}>🎯 YC Simulation</div>
      {result.questions?.map((q,i) => (
        <div key={i} style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:"#334155", fontFamily:"DM Mono", marginBottom:3 }}>Q{i+1}</div>
          <div style={{ fontSize:12.5, color:"#94a3b8", fontFamily:"DM Sans", fontWeight:400, marginBottom:5, lineHeight:1.5 }}>{q.q}</div>
          <div style={{ fontSize:12, color:"#475569", fontFamily:"DM Sans", fontWeight:300, lineHeight:1.6, paddingLeft:10, borderLeft:"2px solid rgba(255,255,255,.05)" }}>{q.a}</div>
        </div>
      ))}
      <div style={{ marginTop:16, padding:14, borderRadius:10, background:`${vcColor}0d`, border:`1px solid ${vcColor}25`, textAlign:"center" }}>
        <div style={{ fontSize:10, color:"#334155", fontFamily:"DM Mono", letterSpacing:1, marginBottom:6 }}>VERDICT</div>
        <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:30, color:vcColor, fontWeight:700 }}>{vc}</div>
        <div style={{ fontSize:12, color:"#475569", fontFamily:"DM Sans", fontWeight:300, marginTop:6, lineHeight:1.6 }}>{result.reason}</div>
      </div>
    </div>
  );
}

function Spinner({ color, label }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, padding:"36px 0" }}>
      <div style={{ width:28, height:28, border:`2px solid ${color}22`, borderTopColor:color, borderRadius:"50%", animation:"spin .8s linear infinite" }} />
      <div style={{ fontFamily:"DM Sans", fontSize:11, color:"#475569" }}>{label}</div>
    </div>
  );
}

function CTA({ icon, title, desc, btnLabel, btnColor, onClick }) {
  return (
    <div style={{ textAlign:"center", padding:"28px 16px" }}>
      <div style={{ fontSize:28, marginBottom:10 }}>{icon}</div>
      <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:17, color:"#e2e8f0", marginBottom:6 }}>{title}</div>
      <div style={{ fontFamily:"DM Sans", fontWeight:300, fontSize:12.5, color:"#475569", lineHeight:1.7, marginBottom: btnLabel ? 18 : 0, whiteSpace:"pre-line" }}>{desc}</div>
      {btnLabel && <button onClick={onClick} style={{ background:`linear-gradient(135deg,${btnColor}88,${btnColor})`, border:"none", borderRadius:10, padding:"11px 22px", color:"white", fontFamily:"DM Sans", fontSize:13, cursor:"pointer", fontWeight:500 }}>{btnLabel}</button>}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function VentureOcean() {
  const [screen, setScreen] = useState("welcome");
  const [profiles, setProfiles] = useState({});
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [mentor, setMentor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [currentStage, setCurrentStage] = useState(1);
  const [completedStages, setCompletedStages] = useState([]);
  const [canvas, setCanvas] = useState({});
  const [insights, setInsights] = useState({});
  const [sideTab, setSideTab] = useState("canvas");
  const [showSide, setShowSide] = useState(true);
  const [brutalResult, setBrutalResult] = useState(null);
  const [brutalLoading, setBrutalLoading] = useState(false);
  const [ycResult, setYcResult] = useState(null);
  const [ycLoading, setYcLoading] = useState(false);
  const [multiResult, setMultiResult] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { setProfiles(loadLocal()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const persist = (key, data) => {
    const updated = { ...profiles, [key]: { ...data, updatedAt: Date.now() } };
    setProfiles(updated);
    saveLocal(updated);
  };

  const startChat = async (m) => {
    setMentor(m);
    const key = `${userName}__${m.id}`;
    setSessionKey(key);
    const ex = profiles[key];
    if (ex?.messages?.length > 0) {
      setMessages(ex.messages); setCurrentStage(ex.stage||1); setCompletedStages(ex.completedStages||[]);
      setCanvas(ex.canvas||{}); setInsights(ex.insights||{}); setBrutalResult(ex.brutalResult||null);
      setYcResult(ex.ycResult||null); setMultiResult(ex.multiResult||null);
      setScreen("chat"); return;
    }
    setMessages([]); setCurrentStage(1); setCompletedStages([]); setCanvas({}); setInsights({});
    setBrutalResult(null); setYcResult(null); setMultiResult(null);
    setScreen("chat"); setIsTyping(true);
    const reply = await callAI(buildPrompt(m, STAGES[0].label, userName, {}), [{ role:"user", content:"Merhaba, seninle çalışmaya hazırım." }]);
    const msgs = [{ role:"assistant", content:reply }];
    setMessages(msgs); setIsTyping(false);
    persist(key, { name:userName, mentor:m.id, messages:msgs, stage:1, completedStages:[], canvas:{}, insights:{}, brutalResult:null, ycResult:null, multiResult:null });
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");
    const newMsgs = [...messages, { role:"user", content:userMsg }];
    setMessages(newMsgs); setIsTyping(true);
    const stageObj = STAGES[currentStage-1];
    const reply = await callAI(buildPrompt(mentor, stageObj.label, userName, insights), newMsgs.map(m=>({role:m.role,content:m.content})));
    setIsTyping(false);
    if (reply === "__TIMEOUT__" || reply === "__ERROR__") {
      setMessages([...newMsgs, { role:"assistant", content:reply, isError:true }]); return;
    }
    const finalMsgs = [...newMsgs, { role:"assistant", content:reply }];
    setMessages(finalMsgs);
    let newStage=currentStage, newCompleted=[...completedStages];
    const uCount = finalMsgs.filter(m=>m.role==="user").length;
    if (uCount>=2 && !completedStages.includes(currentStage)) {
      const done = await checkStageComplete(stageObj.question, userMsg, reply);
      if (done && currentStage<9) { newCompleted=[...newCompleted,currentStage]; newStage=currentStage+1; setCompletedStages(newCompleted); setCurrentStage(newStage); }
    }
    let newCanvas=canvas, newInsights=insights;
    if (uCount%2===0) {
      const lastFew = finalMsgs.slice(-4).map(m=>`${m.role==="user"?"Girişimci":"Mentor"}: ${m.content}`).join("\n");
      [newCanvas, newInsights] = await Promise.all([updateCanvasIncremental(canvas,lastFew), updateInsights(insights,lastFew)]);
      setCanvas(newCanvas); setInsights(newInsights);
    }
    persist(sessionKey, { name:userName, mentor:mentor.id, messages:finalMsgs, stage:newStage, completedStages:newCompleted, canvas:newCanvas, insights:newInsights, brutalResult, ycResult, multiResult });
  };

  const runBrutal = async () => {
    setBrutalLoading(true); setSideTab("brutal"); setShowSide(true);
    const conv = messages.slice(-10).map(m=>`${m.role==="user"?"Girişimci":"Mentor"}: ${m.content}`).join("\n");
    const r = await callAI(`Startup acımasız analiz. SADECE JSON: {"fail":"...","ignore":"...","incumbent":"...","founders":"..."}`, [{role:"user",content:conv}], 600);
    try { const p=JSON.parse(r.replace(/```json|```/g,"").trim()); setBrutalResult(p); persist(sessionKey,{name:userName,mentor:mentor.id,messages,stage:currentStage,completedStages,canvas,insights,brutalResult:p,ycResult,multiResult}); } catch { setBrutalResult({fail:r,ignore:"",incumbent:"",founders:""}); }
    setBrutalLoading(false);
  };

  const runYC = async () => {
    setYcLoading(true); setSideTab("yc"); setShowSide(true);
    const conv = messages.map(m=>`${m.role==="user"?"Girişimci":"Mentor"}: ${m.content}`).join("\n");
    const r = await callAI(`YC partner simülasyonu. SADECE JSON: {"questions":[{"q":"...","a":"..."}],"verdict":"Invest","reason":"..."}`, [{role:"user",content:conv}], 800);
    try { const p=JSON.parse(r.replace(/```json|```/g,"").trim()); setYcResult(p); persist(sessionKey,{name:userName,mentor:mentor.id,messages,stage:currentStage,completedStages,canvas,insights,brutalResult,ycResult:p,multiResult}); } catch { setYcResult({questions:[],verdict:"Maybe",reason:r}); }
    setYcLoading(false);
  };

  const runMulti = async () => {
    setMultiLoading(true); setSideTab("multi"); setShowSide(true);
    const conv = messages.slice(-8).map(m=>`${m.role==="user"?"Girişimci":"Mentor"}: ${m.content}`).join("\n");
    const r = await callAI(`3 mentor perspektifi. SADECE JSON: {"razor":"...","contrarian":"...","builder":"..."}. Her biri 2-3 cümle, farklı açı.`, [{role:"user",content:conv}], 600);
    try { const p=JSON.parse(r.replace(/```json|```/g,"").trim()); setMultiResult(p); persist(sessionKey,{name:userName,mentor:mentor.id,messages,stage:currentStage,completedStages,canvas,insights,brutalResult,ycResult,multiResult:p}); } catch { setMultiResult({razor:r,contrarian:"",builder:""}); }
    setMultiLoading(false);
  };

  const handleKey = e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const userMsgCount = messages.filter(m=>m.role==="user").length;
  const returningUsers = Object.values(profiles).reduce((a,p)=>{ if(!a.find(u=>u.name===p.name)) a.push({name:p.name}); return a; },[]);
  const iStyle = { width:"100%", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, color:"#e2e8f0", fontFamily:"DM Sans", fontWeight:300, fontSize:14, padding:"12px 15px" };

  return (
    <div style={{ minHeight:"100vh", position:"relative" }}>
      <Bg />
      <div style={{ position:"relative", zIndex:1 }}>

        {screen==="welcome" && (
          <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ width:"100%", maxWidth:400, animation:"fadeUp .7s ease both" }}>
              <div style={{ textAlign:"center", marginBottom:40 }}>
                <div style={{ fontFamily:"DM Mono", fontSize:9, letterSpacing:4, color:"#1e3a5f", textTransform:"uppercase", marginBottom:14 }}>Venture Ocean</div>
                <h1 style={{ fontFamily:"Cormorant Garamond, serif", fontSize:42, fontWeight:600, color:"#f1f5f9", lineHeight:1.1, margin:"0 0 10px", background:"linear-gradient(180deg,#f1f5f9,#64748b)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                  Efsane mentöründen<br /><em>tavsiye al.</em>
                </h1>
                <p style={{ fontFamily:"DM Sans", fontWeight:300, color:"#334155", fontSize:13 }}>Mentörünü seç, fikrini anlat.</p>
              </div>
              <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:18, padding:24 }}>
                <label style={{ display:"block", fontSize:9, letterSpacing:1.5, color:"#334155", textTransform:"uppercase", fontFamily:"DM Sans", marginBottom:8 }}>Adın nedir?</label>
                <input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nameInput.trim()&&(setUserName(nameInput.trim()),setScreen("select"))} placeholder="Adını yaz..." style={iStyle} />
                <button onClick={()=>{ if(nameInput.trim()){setUserName(nameInput.trim());setScreen("select");}}} style={{ marginTop:10, width:"100%", background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)", border:"none", borderRadius:11, padding:13, color:"white", fontFamily:"DM Sans", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                  Mentörümü seç →
                </button>
                {returningUsers.length>0 && (
                  <div style={{ marginTop:18, paddingTop:18, borderTop:"1px solid rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize:9, color:"#1e293b", fontFamily:"DM Sans", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Devam et</div>
                    {returningUsers.map(u=>(
                      <button key={u.name} onClick={()=>{setUserName(u.name);setScreen("select");}} style={{ width:"100%", background:"transparent", border:"1px solid rgba(255,255,255,.04)", borderRadius:9, padding:"8px 12px", color:"#475569", fontFamily:"DM Sans", fontSize:12, cursor:"pointer", textAlign:"left", marginBottom:5 }}>👤 {u.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {screen==="select" && (
          <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ width:"100%", maxWidth:580, animation:"fadeUp .6s ease both" }}>
              <button onClick={()=>setScreen("welcome")} style={{ background:"none", border:"none", color:"#334155", fontFamily:"DM Sans", fontSize:12, cursor:"pointer", padding:0, marginBottom:24 }}>← Geri</button>
              <div style={{ fontFamily:"Cormorant Garamond, serif", fontStyle:"italic", color:"#334155", fontSize:13, marginBottom:3 }}>Merhaba, {userName}</div>
              <h2 style={{ fontFamily:"Cormorant Garamond, serif", fontSize:28, color:"#e2e8f0", margin:"0 0 4px", fontWeight:600 }}>Mentörünü seç</h2>
              <p style={{ fontFamily:"DM Sans", fontWeight:300, color:"#334155", fontSize:12, marginBottom:22 }}>Konuşmalar kaydedilir. Kaldığın yerden devam edebilirsin.</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9 }}>
                {MENTORS.map(m=>{
                  const has = profiles[`${userName}__${m.id}`]?.messages?.length>0;
                  return (
                    <button key={m.id} onClick={()=>startChat(m)} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:12, padding:"14px", cursor:"pointer", textAlign:"left", transition:"all .2s", position:"relative" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.borderColor=`${m.color}30`;}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.03)";e.currentTarget.style.borderColor="rgba(255,255,255,.06)";}}>
                      {has && <div style={{ position:"absolute", top:9, right:9, width:5, height:5, borderRadius:"50%", background:m.color, boxShadow:`0 0 5px ${m.color}` }} />}
                      <div style={{ width:30, height:30, borderRadius:"50%", background:`${m.color}1a`, border:`1.5px solid ${m.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:m.color, fontFamily:"DM Mono", fontWeight:600, marginBottom:8 }}>{m.avatar}</div>
                      <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:14, color:"#e2e8f0", fontWeight:600, marginBottom:2 }}>{m.name}</div>
                      <div style={{ fontSize:10, color:"#334155", fontFamily:"DM Sans", marginBottom:6 }}>{m.title}</div>
                      <div style={{ fontSize:10.5, color:"#1e293b", fontFamily:"DM Sans", fontWeight:300, lineHeight:1.5 }}>{m.style}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {screen==="chat" && mentor && (
          <div style={{ height:"100vh", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"rgba(6,10,16,.92)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.05)", padding:"8px 14px", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <button onClick={()=>setScreen("select")} style={{ background:"none", border:"none", color:"#334155", fontSize:15, cursor:"pointer", padding:"0 3px", flexShrink:0 }}>←</button>
                <div style={{ width:26, height:26, borderRadius:"50%", background:`${mentor.color}1a`, border:`1.5px solid ${mentor.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:mentor.color, fontFamily:"DM Mono", fontWeight:600, flexShrink:0 }}>{mentor.avatar}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"Cormorant Garamond, serif", fontSize:14, color:"#e2e8f0", fontWeight:600 }}>{mentor.name}</div>
                  <InsightBadge insights={insights} />
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <button onClick={()=>{setSideTab("canvas");setShowSide(s=>sideTab==="canvas"?!s:true);}} style={{ background:showSide&&sideTab==="canvas"?"rgba(59,130,246,.12)":"rgba(255,255,255,.03)", border:`1px solid ${showSide&&sideTab==="canvas"?"rgba(59,130,246,.25)":"rgba(255,255,255,.06)"}`, borderRadius:7, padding:"4px 8px", color:showSide&&sideTab==="canvas"?"#60a5fa":"#334155", fontFamily:"DM Sans", fontSize:10, cursor:"pointer" }}>Canvas</button>
                  <button onClick={()=>{setSideTab("multi");setShowSide(s=>sideTab==="multi"?!s:true);}} style={{ background:showSide&&sideTab==="multi"?"rgba(124,58,237,.12)":"rgba(255,255,255,.03)", border:`1px solid ${showSide&&sideTab==="multi"?"rgba(124,58,237,.25)":"rgba(255,255,255,.06)"}`, borderRadius:7, padding:"4px 8px", color:showSide&&sideTab==="multi"?"#a78bfa":"#334155", fontFamily:"DM Sans", fontSize:10, cursor:"pointer" }}>🔮 3x</button>
                  <button onClick={runBrutal} style={{ background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.15)", borderRadius:7, padding:"4px 8px", color:"#ef4444", fontFamily:"DM Sans", fontSize:10, cursor:"pointer" }}>⚡</button>
                  <button onClick={()=>{setSideTab("yc");setShowSide(s=>sideTab==="yc"?!s:true);}} style={{ background:showSide&&sideTab==="yc"?"rgba(234,179,8,.12)":"rgba(255,255,255,.03)", border:`1px solid ${showSide&&sideTab==="yc"?"rgba(234,179,8,.25)":"rgba(255,255,255,.06)"}`, borderRadius:7, padding:"4px 8px", color:showSide&&sideTab==="yc"?"#eab308":"#334155", fontFamily:"DM Sans", fontSize:10, cursor:"pointer" }}>🎯</button>
                </div>
              </div>
              <StageBar currentStage={currentStage} completedStages={completedStages} />
            </div>

            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
              <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", display:"flex", flexDirection:"column", gap:16 }}>
                {messages.map((m,i)=>{
                  const isUser=m.role==="user";
                  return (
                    <div key={i} style={{ display:"flex", gap:9, justifyContent:isUser?"flex-end":"flex-start", animation:"msgIn .3s ease both" }}>
                      {!isUser && <div style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, marginTop:3, background:`${mentor.color}1a`, border:`1.5px solid ${mentor.color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:mentor.color, fontFamily:"DM Mono", fontWeight:600 }}>{mentor.avatar}</div>}
                      {m.isError ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:"78%" }}>
                          <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:"3px 14px 14px 14px", padding:"10px 13px", fontFamily:"DM Sans", fontSize:13, color:"#fca5a5" }}>
                            {m.content==="__TIMEOUT__"?"Cevap 20 saniyede gelmedi.":"Bağlantı hatası."} Tekrar dene.
                          </div>
                          <button onClick={()=>{setMessages(prev=>prev.filter((_,i2)=>i2!==i)); const lu=messages.filter(x=>x.role==="user").slice(-1)[0]; if(lu)setInput(lu.content);}} style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.2)", borderRadius:8, padding:"6px 12px", color:"#fca5a5", fontFamily:"DM Sans", fontSize:11, cursor:"pointer", alignSelf:"flex-start" }}>↩ Tekrar dene</button>
                        </div>
                      ):(
                        <div style={{ maxWidth:"78%", background:isUser?"rgba(255,255,255,.07)":"rgba(255,255,255,.04)", border:`1px solid ${isUser?"rgba(255,255,255,.09)":"rgba(255,255,255,.05)"}`, borderRadius:isUser?"14px 3px 14px 14px":"3px 14px 14px 14px", padding:"10px 13px", fontFamily:"DM Sans", fontWeight:300, fontSize:13, lineHeight:1.75, color:isUser?"#cbd5e1":"#94a3b8", whiteSpace:"pre-wrap" }}>{m.content}</div>
                      )}
                    </div>
                  );
                })}
                {isTyping && (
                  <div style={{ display:"flex", gap:9 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", background:`${mentor.color}1a`, border:`1.5px solid ${mentor.color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:mentor.color, fontFamily:"DM Mono", fontWeight:600 }}>{mentor.avatar}</div>
                    <div style={{ display:"flex", gap:4, padding:"12px 14px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.05)", borderRadius:"3px 14px 14px 14px" }}>
                      {[0,1,2].map(i=><div key={i} style={{ width:5, height:5, borderRadius:"50%", background:mentor.color, animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {showSide && <SidePanel tab={sideTab} setTab={setSideTab} canvas={canvas} multiResult={multiResult} multiLoading={multiLoading} onMulti={runMulti} brutalResult={brutalResult} brutalLoading={brutalLoading} onBrutal={runBrutal} ycResult={ycResult} ycLoading={ycLoading} onYC={runYC} userMsgCount={userMsgCount} onClose={()=>setShowSide(false)} />}
            </div>

            <div style={{ background:"rgba(6,10,16,.92)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.05)", padding:"10px 14px", flexShrink:0 }}>
              <div style={{ display:"flex", gap:7, alignItems:"flex-end", maxWidth:680, margin:"0 auto" }}>
                <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Yaz... (Enter gönder, Shift+Enter yeni satır)" rows={1} style={{ flex:1, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:11, color:"#e2e8f0", fontFamily:"DM Sans", fontWeight:300, fontSize:13, padding:"10px 13px", resize:"none", lineHeight:1.6, maxHeight:90, overflow:"auto" }} />
                <button onClick={sendMessage} disabled={!input.trim()||isTyping} style={{ width:38, height:38, borderRadius:9, flexShrink:0, background:input.trim()&&!isTyping?`linear-gradient(135deg,${mentor.color}80,${mentor.color})`:"rgba(255,255,255,.03)", border:"none", cursor:input.trim()&&!isTyping?"pointer":"default", color:"white", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}>↑</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
