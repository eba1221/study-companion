import "./Learn.css";
import "./Analytics.css";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  Home as HomeIcon, BookOpen, BarChart3, Settings, User,
  Search, TrendingUp, Target, Clock, AlertTriangle, BookMarked,
  Zap, RefreshCw,
} from "lucide-react";
import diagramsMascot from "../assets/Diagrams.png";
import { getStoredUser } from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

function Sk({ h=16, w="100%", r=8 }) {
  return <div style={{ height:h, width:w, borderRadius:r, background:"linear-gradient(90deg,rgba(58,30,16,0.07) 25%,rgba(58,30,16,0.13) 50%,rgba(58,30,16,0.07) 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }} />;
}

function StudyChart({ data }) {
  const max = Math.max(...data.map(d => d.mins), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:180, padding:"0 4px" }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, height:"100%" }}>
          <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
            <div title={`${d.mins} min`} style={{ width:"100%", height:`${Math.max((d.mins/max)*100, d.mins>0?6:2)}%`, borderRadius:"10px 10px 6px 6px", background:d.mins>0?"linear-gradient(180deg,rgba(58,30,16,0.55),rgba(58,30,16,0.28))":"rgba(58,30,16,0.08)", transition:"height 0.7s cubic-bezier(.34,1.56,.64,1)" }} />
          </div>
          <span style={{ fontSize:11, fontWeight:800, color:"rgba(58,30,16,0.50)" }}>{d.label}</span>
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

function ConfidenceBar({ confidence, priority }) {
  const pct=Math.round((confidence?.[priority]??0)*100);
  const style=PS[priority]??PS.medium;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ flex:1, height:4, background:"rgba(58,30,16,0.10)", borderRadius:999, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:style.text, borderRadius:999, transition:"width 0.8s ease" }}/>
      </div>
      <span style={{ fontSize:10, fontWeight:900, color:style.text, minWidth:30 }}>{pct}%</span>
    </div>
  );
}

export default function AnalyticsPage() {
  useEffect(()=>{ document.title="Analytics | Study Coach"; },[]);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  async function fetchPredictions() {
    setLoading(true); setError(null);
    try {
      const user = getStoredUser();
      const userId = user?.id;
      if (!userId) { setError("Not logged in."); setLoading(false); return; }
      const res=await fetch(`${API_BASE}/api/analytics/predict`,{method:"POST",headers:{"Content-Type":"application/json","x-user-id":String(userId)},body:JSON.stringify({user_id:userId})});
      if(!res.ok) throw new Error(`Server responded with ${res.status}`);
      setData(await res.json());
    } catch(e){ setError(e.message); } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchPredictions(); },[]);

  const kpis=data?.kpis??{};
  const weakTopics=data?.weakTopics??[];
  const studyRecs=data?.studyRecs??[];
  const trajectory=data?.trajectory??[];
  const subjects=data?.subjectStats??[];
  const studyChart=useMemo(()=>["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(label=>({label,mins:0})),[data]);

  return (
    <div className="learnShell">
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .aiCard{animation:fadeUp 0.45s ease both}
      `}</style>
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn" to="/"><HomeIcon size={22}/></Link>
        <Link className="navBtn" to="/learn"><BookOpen size={22}/></Link>
        <Link className="navBtn navBtnActive" to="/analytics"><BarChart3 size={22}/></Link>
        <div style={{flex:1}}/>
        <button className="navBtn"><Settings size={22}/></button>
        <button className="navBtn"><User size={22}/></button>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="search"><Search size={16} className="topbarLucide"/><input placeholder="Search analytics…"/></div>
          <div className="pills">
            <div className="pill pillActive">Analytics</div>
            <div className="pill">{loading?"…":`${kpis.overallAccuracy??"–"}% avg`}</div>
            <button onClick={fetchPredictions} title="Refresh" style={{background:"none",border:"none",cursor:"pointer",padding:4,opacity:0.55,display:"flex"}}><RefreshCw size={14}/></button>
          </div>
        </div>
        {error&&(
          <div style={{marginBottom:12,padding:"12px 16px",borderRadius:14,background:"rgba(239,68,68,0.10)",border:"1px solid rgba(239,68,68,0.30)",color:"#b91c1c",fontSize:13,fontWeight:700}}>
            ⚠️ ML server unreachable: {error} — make sure <code>python predict.py</code> is running on port 5001.
          </div>
        )}
        <section className="analyticsGrid">
          <div className="card analyticsHero">
            <div className="analyticsHeroRow">
              <div className="analyticsHeroText">
                <div className="analyticsLabel">ML-Powered · Gradient Boosting Classifier</div>
                <h1 className="analyticsTitle">Your analytics</h1>
                <p className="analyticsSub">Predictions powered by a Gradient Boosting model trained on 2,000 synthetic GCSE student profiles — tuned to your real quiz history.</p>
                <div className="analyticsHeroChips">
                  <div className="aChip"><Clock size={16} className="aChipIcon"/><span>Time</span></div>
                  <div className="aChip"><Target size={16} className="aChipIcon"/><span>Accuracy</span></div>
                  <div className="aChip"><TrendingUp size={16} className="aChipIcon"/><span>Trend</span></div>
                  <div className="aChip"><Zap size={16} className="aChipIcon"/><span>AI Priority</span></div>
                </div>
              </div>
              <div className="analyticsMascotHalo" aria-hidden="true"><img className="analyticsMascotImg" src={diagramsMascot} alt="Mascot"/></div>
            </div>
          </div>
          <div className="analyticsKpis">
            <div className="card kpiCard">
              <div className="kpiTop"><div className="kpiLabel">This week</div><Clock className="kpiIcon" size={18}/></div>
              {loading?<Sk h={32} w={80}/>:<div className="kpiValue">{kpis.weeklyStudyTimeMins>=60?`${(kpis.weeklyStudyTimeMins/60).toFixed(1)}h`:`${kpis.weeklyStudyTimeMins??0}m`}</div>}
              <div className="kpiHint">Study time logged</div>
            </div>
            <div className="card kpiCard">
              <div className="kpiTop"><div className="kpiLabel">Accuracy</div><Target className="kpiIcon" size={18}/></div>
              {loading?<Sk h={32} w={60}/>:<div className="kpiValue">{kpis.thisAccuracy??"–"}%</div>}
              <div className="kpiHint">Last 7 days</div>
            </div>
            <div className="card kpiCard">
              <div className="kpiTop"><div className="kpiLabel">Trend</div><TrendingUp className="kpiIcon" size={18}/></div>
              {loading?<Sk h={32} w={60}/>:<div className="kpiValue" style={{color:kpis.trend==null?"var(--ink)":kpis.trend>=0?"#16a34a":"#dc2626"}}>{kpis.trend==null?"–":kpis.trend>=0?`+${kpis.trend}%`:`${kpis.trend}%`}</div>}
              <div className="kpiHint">vs last week</div>
            </div>
          </div>
          <div style={{display:"grid",gap:16}}>
            <div className="card analyticsPanel">
              <div className="panelHeader"><div><div className="panelLabel">Study time</div><div className="panelTitle">Minutes per day</div></div><div className="panelPill">Last 7 days</div></div>
              {loading?<Sk h={180} r={16}/>:<StudyChart data={studyChart}/>}
              <div className="panelHint">Aggregated from <code>time_taken</code> on each quiz attempt.</div>
            </div>
            <div className="card analyticsPanel">
              <div className="panelHeader"><div><div className="panelLabel">Quiz</div><div className="panelTitle">Accuracy by subject</div></div><div className="panelPill">Decay-weighted</div></div>
              <div className="progressList">
                {loading?[1,2,3].map(i=><Sk key={i} h={48} r={14}/>):subjects.map(s=>(
                  <div key={s.subject} className="progressRow">
                    <div className="progressName" style={{color:sc(s.subject,"text")}}>{s.subject}</div>
                    <div className="progressBar"><div className="progressFill" style={{width:`${s.wScore}%`,background:sc(s.subject,"fill"),transition:"width 0.9s cubic-bezier(.34,1.56,.64,1)"}}/></div>
                    <div className="progressPct">{s.wScore}%</div>
                  </div>
                ))}
              </div>
              <div className="panelHint">Exponential decay weighting — half-life 14 days. Formula: w(t) = e^(−λ·days).</div>
            </div>
            <div className="card analyticsPanel">
              <div className="panelHeader"><div><div className="panelLabel">Prediction</div><div className="panelTitle">Score trajectory</div></div><div className="panelPill">Linear regression</div></div>
              {loading?<Sk h={190} r={16}/>:<TrajectoryChart data={trajectory}/>}
              <div className="panelHint">OLS regression on your attempt history. Dashed = predicted. Diminishing-returns applied above 70%.</div>
            </div>
          </div>
          <div style={{display:"grid",gap:12,alignContent:"start"}}>
            <div className="card analyticsPanel aiCard">
              <div className="panelHeader">
                <div><div className="panelLabel">ML Classification · Gradient Boosting</div><div className="panelTitle">Topics to focus on</div></div>
                <AlertTriangle size={18} style={{opacity:0.55,marginTop:4}}/>
              </div>
              <div style={{display:"grid",gap:8}}>
                {loading?[1,2,3,4].map(i=><Sk key={i} h={95} r={14}/>):weakTopics.slice(0,6).map(t=>{
                  const ps=PS[t.priority]??PS.medium;
                  return (
                    <div key={t.topic} style={{padding:"10px 12px",borderRadius:14,border:`1px solid ${ps.border}`,background:ps.bg,display:"grid",gap:5}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:900,fontSize:13,color:"var(--ink)"}}>{t.topic}</span>
                        <span style={{fontSize:10,fontWeight:900,color:ps.text,background:ps.bg,border:`1px solid ${ps.border}`,borderRadius:999,padding:"2px 8px"}}>{ps.label}</span>
                      </div>
                      <div style={{fontSize:11,color:"rgba(58,30,16,0.60)",fontWeight:700}}>{t.subject} · {t.weightedScore}% weighted · {t.attempts} attempt{t.attempts!==1?"s":""}</div>
                      <div style={{fontSize:11,color:"rgba(58,30,16,0.72)",fontWeight:650,lineHeight:1.45}}>{t.reason}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,fontWeight:800,color:"rgba(58,30,16,0.45)",minWidth:68}}>Confidence</span>
                        <ConfidenceBar confidence={t.confidence} priority={t.priority}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="panelHint">GBM trained on 2,000 synthetic GCSE profiles. Features: weighted score, std dev, attempt count, time-per-question, score trend.</div>
            </div>
            <div className="card analyticsPanel aiCard" style={{animationDelay:"0.1s"}}>
              <div className="panelHeader">
                <div><div className="panelLabel">Recommendation</div><div className="panelTitle">Daily study time</div></div>
                <BookMarked size={18} style={{opacity:0.55,marginTop:4}}/>
              </div>
              <div style={{display:"grid",gap:8}}>
                {loading?[1,2,3].map(i=><Sk key={i} h={85} r={14}/>):studyRecs.map(r=>(
                  <div key={r.subject} style={{padding:"12px 14px",borderRadius:14,border:`1px solid ${sc(r.subject,"border")}`,background:sc(r.subject,"fill").replace("0.85","0.12")}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontWeight:900,fontSize:14,color:"var(--ink)"}}>{r.subject}</span>
                      <span style={{fontWeight:900,fontSize:18,color:sc(r.subject,"text")}}>{r.minutesPerDay} min/day</span>
                    </div>
                    <div style={{fontSize:11,color:"rgba(58,30,16,0.68)",fontWeight:650,lineHeight:1.45,marginBottom:6}}>{r.reason}</div>
                    <div style={{height:4,background:"rgba(58,30,16,0.10)",borderRadius:999,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${r.currentScore}%`,background:sc(r.subject,"fill"),borderRadius:999,transition:"width 1s ease"}}/>
                    </div>
                    <div style={{fontSize:10,fontWeight:800,color:"rgba(58,30,16,0.45)",marginTop:3}}>Current: {r.currentScore}% → Target: 75%</div>
                  </div>
                ))}
              </div>
              <div className="panelHint">20 min base + 0.8 min × score gap to 75% target, ordered by priority.</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}