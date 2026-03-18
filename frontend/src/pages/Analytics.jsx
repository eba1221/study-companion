import "./Learn.css";
import "./Analytics.css";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Home as HomeIcon, BookOpen, BarChart3, Settings, User, TrendingUp, Target, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import diagramsMascot from "../assets/Diagrams.png";
import { getStoredUser } from "../api";

const API_BASE = "https://study-companion-production-cec1.up.railway.app";

const SUBJECT_COLORS = {
  Biology:   { fill: "rgba(134,197,143,0.85)", border: "rgba(72,160,84,0.5)",   text: "#2d6e38" },
  Chemistry: { fill: "rgba(169,214,230,0.85)", border: "rgba(80,170,200,0.5)",  text: "#1a6f8a" },
  Physics:   { fill: "rgba(242,182,114,0.85)", border: "rgba(210,130,60,0.5)",  text: "#8a4f10" },
  Other:     { fill: "rgba(200,190,230,0.85)", border: "rgba(140,120,200,0.5)", text: "#4a3a7a" },
};
const sc = (s, p) => (SUBJECT_COLORS[s] ?? SUBJECT_COLORS.Other)[p];

const PS = {
  urgent: { bg:"rgba(239,68,68,0.10)",  border:"rgba(239,68,68,0.35)",  text:"#b91c1c", label:"Urgent" },
  high:   { bg:"rgba(249,115,22,0.10)", border:"rgba(249,115,22,0.35)", text:"#c2410c", label:"High"   },
  medium: { bg:"rgba(234,179,8,0.10)",  border:"rgba(234,179,8,0.35)",  text:"#a16207", label:"Medium" },
  low:    { bg:"rgba(34,197,94,0.10)",  border:"rgba(34,197,94,0.35)",  text:"#15803d", label:"Low"    },
};


function StudyChart({ data }) {
  const max = Math.max(...data.map(d => d.mins), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:180, padding:"0 4px" }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%" }}>
          <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
            <div title={`${d.mins} min`} style={{ width:"100%", height:`${Math.max((d.mins/max)*100, d.mins>0?6:2)}%`, borderRadius:"10px 10px 6px 6px", background:d.mins>0?"linear-gradient(180deg,rgba(58,30,16,0.55),rgba(58,30,16,0.28))":"rgba(58,30,16,0.08)", transition:"height 0.7s cubic-bezier(.34,1.56,.64,1)" }} />
          </div>
          <span style={{ fontSize:10, fontWeight:800, color:"rgba(58,30,16,0.50)", textAlign:"center", lineHeight:1.3, display:"flex", flexDirection:"column", alignItems:"center" }}>
            <span>{d.label.split(" ")[0]}</span>
            <span style={{opacity:0.7}}>{d.label.split(" ")[1]}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function TrajectoryChart({ data }) {
  if (!data?.length) return null;
  const W=560,H=190,P={t:16,r:16,b:32,l:38};
  const iW=W-P.l-P.r, iH=H-P.t-P.b;
  const sx=i=>P.l+(i/(data.length-1))*iW;
  const sy=v=>P.t+iH-(Math.max(0,Math.min(v,100))/100)*iH;
  const past=data.filter(d=>d.isPast), future=data.filter(d=>!d.isPast);
  const toPath=pts=>pts.map((d,i)=>`${i===0?"M":"L"}${sx(data.indexOf(d))},${sy(d.predictedScore)}`).join(" ");
  const fp=future.length?`M${sx(data.indexOf(past[past.length-1]))},${sy(past[past.length-1].predictedScore)} `+future.map(d=>`L${sx(data.indexOf(d))},${sy(d.predictedScore)}`).join(" "):"";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
      {[25,50,75].map(v=>(
        <g key={v}>
          <line x1={P.l} x2={W-P.r} y1={sy(v)} y2={sy(v)} stroke="rgba(58,30,16,0.08)" strokeWidth={1} strokeDasharray="4 3"/>
          <text x={P.l-6} y={sy(v)+4} fontSize={10} fontWeight={800} fill="rgba(58,30,16,0.38)" textAnchor="end">{v}%</text>
        </g>
      ))}
      {past.length>1&&<path d={toPath(past)} fill="none" stroke="rgba(58,30,16,0.50)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>}
      {fp&&<path d={fp} fill="none" stroke="rgba(58,30,16,0.28)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4"/>}
      {data.map((d,i)=>(
        <g key={i}>
          <circle cx={sx(i)} cy={sy(d.predictedScore)} r={d.isPast?4:3} fill={d.isPast?"rgba(58,30,16,0.72)":"rgba(255,255,255,0.95)"} stroke="rgba(58,30,16,0.45)" strokeWidth={1.5}/>
          {!d.isPast&&<text x={sx(i)} y={sy(d.predictedScore)-8} fontSize={9} fontWeight={800} fill="rgba(58,30,16,0.50)" textAnchor="middle">{d.predictedScore}%</text>}
        </g>
      ))}
      {data.map((d,i)=>(
        <text key={i} x={sx(i)} y={H-6} fontSize={10} fontWeight={800} fill="rgba(58,30,16,0.42)" textAnchor="middle">
          {d.week===0?"Now":d.week>0?`+${d.week}w`:`${d.week}w`}
        </text>
      ))}
      {future.length>0&&<text x={sx(data.indexOf(future[0]))+10} y={P.t+11} fontSize={9} fontWeight={900} fill="rgba(58,30,16,0.38)" letterSpacing={0.6}>PREDICTED</text>}
    </svg>
  );
}

function Sk({ h = 16, w = "100%", r = 8 }) {
  return <div style={{ height: h, width: w, borderRadius: r, background: "linear-gradient(90deg,rgba(58,30,16,0.07) 25%,rgba(58,30,16,0.13) 50%,rgba(58,30,16,0.07) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

export default function AnalyticsPage() {
  useEffect(() => { document.title = "Analytics | Study Coach"; }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchPredictions() {
    setLoading(true); setError(null);
    try {
      const user = getStoredUser();
      if (!user?.token) { setError("Not logged in."); setLoading(false); return; }
      const res = await fetch(`${API_BASE}/api/analytics/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { fetchPredictions(); }, []);

  const kpis = data?.kpis ?? {};
  const weakTopics = data?.weakTopics ?? [];
  const subjects = data?.subjectStats ?? [];
  const studyChart = useMemo(() => {
    if (data?.studyChart) return data.studyChart;
    const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return Array.from({length:7}, (_,i) => {
      const d = new Date(Date.now()-(6-i)*86400000);
      return {label: DAY_LABELS[d.getDay()===0?6:d.getDay()-1]+" "+d.getDate(), mins: 0};
    });
  }, [data]);

  return (
    <div className="learnShell">
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn" to="/"><HomeIcon size={22} /></Link>
        <Link className="navBtn" to="/learn"><BookOpen size={22} /></Link>
        <Link className="navBtn navBtnActive" to="/analytics"><BarChart3 size={22} /></Link>
        <div style={{ flex: 1 }} />
      </aside>

      <main className="main">
        {/* Hero */}
        <div className="card aHero">
          <div className="aHeroRow">
            <div>
              <div className="cardLabel">ML-Powered · Gradient Boosting</div>
              <h1 className="aHeroTitle">Your analytics</h1>
              <p className="aHeroSub">Predictions trained on 2,000 synthetic GCSE student profiles — tuned to your real quiz history.</p>
            </div>
            <img src={diagramsMascot} className="aHeroMascot" alt="" draggable="false" />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 14, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
            ⚠️ Could not load analytics: {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="aKpis">
          <div className="card aKpi">
            <div className="aKpiTop"><span className="aKpiLabel">Study time</span><Clock size={16} style={{ opacity: 0.5 }} /></div>
            {loading ? <Sk h={28} w={80} /> : <div className="aKpiValue">{kpis.weeklyStudyTimeMins >= 60 ? `${(kpis.weeklyStudyTimeMins / 60).toFixed(1)}h` : `${kpis.weeklyStudyTimeMins ?? 0}m`}</div>}
            <div className="aKpiHint">This week</div>
          </div>
          <div className="card aKpi">
            <div className="aKpiTop"><span className="aKpiLabel">Accuracy</span><Target size={16} style={{ opacity: 0.5 }} /></div>
            {loading ? <Sk h={28} w={60} /> : <div className="aKpiValue">{kpis.thisAccuracy ?? "–"}%</div>}
            <div className="aKpiHint">Last 7 days</div>
          </div>
          <div className="card aKpi">
            <div className="aKpiTop"><span className="aKpiLabel">Trend</span><TrendingUp size={16} style={{ opacity: 0.5 }} /></div>
            {loading ? <Sk h={28} w={60} /> : (
              <div className="aKpiValue" style={{ color: kpis.trend == null ? "var(--ink)" : kpis.trend >= 0 ? "#16a34a" : "#dc2626" }}>
                {kpis.trend == null ? "–" : kpis.trend >= 0 ? `+${kpis.trend}%` : `${kpis.trend}%`}
              </div>
            )}
            <div className="aKpiHint">vs last week</div>
          </div>
          <div className="card aKpi" style={{ cursor: "pointer" }} onClick={fetchPredictions}>
            <div className="aKpiTop"><span className="aKpiLabel">Refresh</span><RefreshCw size={16} style={{ opacity: 0.5 }} /></div>
            <div className="aKpiValue" style={{ fontSize: 14, opacity: 0.6 }}>Update</div>
            <div className="aKpiHint">Reload predictions</div>
          </div>
        </div>

        <div className="aGrid">
          {/* Subject accuracy */}
          <div className="card aPanel">
            <div className="aPanelHeader">
              <div className="cardTitle">Accuracy by subject</div>
              <div className="chip">Decay-weighted</div>
            </div>
            <div className="aPanelScroll">
              {loading ? [1, 2, 3].map(i => <Sk key={i} h={44} r={12} />) : subjects.map(s => (
                <div key={s.subject} style={{ display: "grid", gridTemplateColumns: "100px 1fr 44px", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 14, border: `1px solid ${sc(s.subject, "border")}`, background: sc(s.subject, "fill").replace("0.85", "0.12") }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: sc(s.subject, "text") }}>{s.subject}</div>
                  <div style={{ height: 8, background: "rgba(58,30,16,0.10)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.wScore}%`, background: sc(s.subject, "fill"), borderRadius: 999, transition: "width 0.9s ease" }} />
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 13, color: sc(s.subject, "text"), textAlign: "right" }}>{s.wScore}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weak topics */}
          <div className="card aPanel">
            <div className="aPanelHeader">
              <div className="cardTitle">Topics to focus on</div>
              <AlertTriangle size={16} style={{ opacity: 0.5 }} />
            </div>
            <div className="aPanelScroll">
              {loading ? [1, 2, 3, 4].map(i => <Sk key={i} h={80} r={12} />) : weakTopics.slice(0, 5).map(t => {
                const ps = PS[t.priority] ?? PS.medium;
                return (
                  <div key={t.topic} style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${ps.border}`, background: ps.bg, display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: "var(--ink)" }}>{t.topic}</span>
                      <span style={{ fontSize: 10, fontWeight: 900, color: ps.text, border: `1px solid ${ps.border}`, borderRadius: 999, padding: "2px 8px" }}>{ps.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(58,30,16,0.58)", fontWeight: 700 }}>{t.subject} · {t.weightedScore}% · {t.attempts} attempt{t.attempts !== 1 ? "s" : ""}</div>
                    <div style={{ fontSize: 11, color: "rgba(58,30,16,0.70)", fontWeight: 650, lineHeight: 1.4 }}>{t.reason}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Graphs */}
        <div className="aGraphs">
          <div className="card aPanel" style={{ height: "auto" }}>
            <div className="aPanelHeader">
              <div className="cardTitle">Score trajectory</div>
              <div className="chip">Predicted</div>
            </div>
            {loading ? <Sk h={190} r={16} /> : <TrajectoryChart data={data?.trajectory ?? []} />}
          </div>
          <div className="card aPanel" style={{ height: "auto" }}>
            <div className="aPanelHeader">
              <div className="cardTitle">Study time</div>
              <div className="chip">Last 7 days</div>
            </div>
            {loading ? <Sk h={180} r={16} /> : <StudyChart data={studyChart} />}
          </div>
        </div>
      </main>
    </div>
  );
}