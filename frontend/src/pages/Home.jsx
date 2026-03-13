import "./Home.css";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";

import StudyingImg  from "../assets/Studying.png";
import QuizImg      from "../assets/Quiz.png";
import DiagramsImg  from "../assets/Diagrams.png";
import WaveGif      from "../assets/Wave.GIF";

import { Home as HomeIcon, Settings, LogOut } from "lucide-react";
import { getStoredUser } from "../api";

const API_BASE = "https://study-companion-production-cec1.up.railway.app";

// ── tiny fetch helper that always sends x-user-id ─────────────────────────
async function apiFetch(path) {
  const user = getStoredUser();
  const token = user?.token;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function Home() {
  const navigate     = useNavigate();
  const user         = getStoredUser();
  const userId       = user?.id;
  const displayName  = user?.display_name || user?.email?.split("@")[0] || "there";

  // ── real stats state ────────────────────────────────────────────────────
  const [stats, setStats]   = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function loadStats() {
      try {
        const data = await apiFetch(`/api/quiz/history/${userId}`);
        const attempts = data?.attempts ?? [];

        const now        = Date.now();
        const oneWeekMs  = 7 * 24 * 3600 * 1000;
        const twoWeekMs  = 14 * 3600 * 1000 * 24;

        const thisWeek = attempts.filter(a => now - new Date(a.completed_at).getTime() < oneWeekMs);
        const lastWeek = attempts.filter(a => {
          const age = now - new Date(a.completed_at).getTime();
          return age >= oneWeekMs && age < twoWeekMs;
        });

        // Weekly study time in minutes
        const weeklyMins = Math.round(
          thisWeek.reduce((s, a) => s + (a.time_taken || 0), 0) / 60
        );

        // Quiz accuracy this week
        const weeklyAccuracy = thisWeek.length
          ? Math.round(thisWeek.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / thisWeek.length)
          : null;

        // Last week accuracy for trend
        const lastAccuracy = lastWeek.length
          ? Math.round(lastWeek.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / lastWeek.length)
          : null;

        const trend = weeklyAccuracy !== null && lastAccuracy !== null
          ? weeklyAccuracy - lastAccuracy : null;

        // Unique topics attempted
        const topicsAttempted = new Set(attempts.map(a => a.topic_name)).size;

        // Most recent attempt for "continue learning"
        const latest = attempts[0] ?? null;

        // Subject breakdown for progress bar (Biology specifically)
        const bioAttempts = attempts.filter(a => a.subject_name === "Biology");
        const bioAccuracy = bioAttempts.length
          ? Math.round(bioAttempts.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / bioAttempts.length)
          : null;

        // Day streak — count consecutive days with at least one attempt
        const daySet = new Set(
          attempts.map(a => new Date(a.completed_at).toDateString())
        );
        let streak = 0;
        for (let d = 0; d < 365; d++) {
          const day = new Date(now - d * 86400000).toDateString();
          if (daySet.has(day)) streak++;
          else if (d > 0) break; // allow today to be empty
        }

        setStats({ weeklyMins, weeklyAccuracy, trend, topicsAttempted, latest, bioAccuracy, streak });
      } catch (e) {
        console.error("Failed to load home stats:", e);
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, [userId]);

  // ── checklist (local state — could be persisted to DB later) ───────────
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Daily warm-up",    desc: "Answer 5 quick questions", done: false },
    { id: "t2", title: "Review weak topic", desc: "Check your analytics",    done: false },
    { id: "t3", title: "Flashcards",        desc: "10 cards (Biology)",       done: false },
  ]);
  const [newTask, setNewTask] = useState("");

  const doneCount   = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const totalCount  = tasks.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  function toggleTask(id) { setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setTasks(p => [...p, { id: crypto.randomUUID(), title, desc: "", done: false }]);
    setNewTask("");
  }
  function removeTask(id) { setTasks(p => p.filter(t => t.id !== id)); }
  function handleLogout() { localStorage.removeItem("sc_user"); navigate("/auth"); }

  // ── helpers ─────────────────────────────────────────────────────────────
  function fmtTime(mins) {
    if (mins === null || mins === undefined) return "–";
    if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
    return `${mins}m`;
  }

  function fmtTrend(trend) {
    if (trend === null || trend === undefined) return null;
    return trend >= 0 ? `+${trend}%` : `${trend}%`;
  }

  const latestTopic   = stats?.latest?.topic_name   ?? "–";
  const latestSubject = stats?.latest?.subject_name ?? "";
  const bioProgress   = stats?.bioAccuracy          ?? 0;

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn navBtnActive" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>
        <div style={{ flex: 1 }} />
        <button className="navBtn" title="Settings" aria-label="Settings">
          <Settings className="navLucide" size={22} />
        </button>
        <button className="navBtn" title="Logout" aria-label="Logout" onClick={handleLogout}>
          <LogOut className="navLucide" size={22} />
        </button>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="search">
            🔎
            <input placeholder="Search topics, quizzes, flashcards..." />
          </div>
          <div className="pills">
            <div className="pill">Today</div>
            {!statsLoading && stats?.streak > 0 && (
              <div className="pill">Streak 🔥 {stats.streak}</div>
            )}
          </div>
        </div>

        {/* Hero */}
        <section className="hero">
          <div className="heroCopy">
            <h1 className="heroTitle">Welcome back, {displayName}</h1>
            <p className="heroSub">Let's pick up where you left off.</p>

            <div className="heroStats">
              <div className="heroStatItem">
                <div className="heroStatValue">
                  {statsLoading ? "…" : `${bioProgress > 0 ? bioProgress : "–"}${bioProgress > 0 ? "%" : ""}`}
                </div>
                <div className="heroStatLabel">Biology accuracy</div>
              </div>
              <div className="heroStatDivider" />
              <div className="heroStatItem">
                <div className="heroStatValue">
                  {statsLoading ? "…" : stats?.topicsAttempted ?? 0}
                </div>
                <div className="heroStatLabel">Topics attempted</div>
              </div>
              <div className="heroStatDivider" />
              <div className="heroStatItem">
                <div className="heroStatValue">
                  {statsLoading ? "…" : stats?.streak ?? 0}
                </div>
                <div className="heroStatLabel">Day streak</div>
              </div>
            </div>
          </div>

          <div className="mascotWrap">
            <div className="heroHalo">
              <img src={WaveGif} alt="Study companion mascot" className="heroMascot" />
            </div>
          </div>
        </section>

        {/* Continue Learning */}
        <section className="continueSection">
          <div className="continueBanner">
            <div className="continueContent">
              <div className="continueLabel">
                {statsLoading ? "Loading…" : stats?.latest ? "Continue where you left off" : "Start learning"}
              </div>
              <div className="continueTitle">
                {statsLoading ? "…" : stats?.latest
                  ? `${latestSubject} • ${latestTopic}`
                  : "Pick a topic to begin"}
              </div>
              {!statsLoading && stats?.latest && (
                <div className="continueMeta">
                  <span>
                    Last attempt: {new Date(stats.latest.completed_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short"
                    })}
                  </span>
                  <span className="continueDot">•</span>
                  <span>Score: {stats.latest.score}/{stats.latest.total_questions}</span>
                </div>
              )}
              <div className="continueProgress">
                <div className="continueBar">
                  <div className="continueBarFill" style={{ width: `${bioProgress}%`, transition: "width 1s ease" }} />
                </div>
                <span className="continuePercent">
                  {bioProgress > 0 ? `${bioProgress}% Biology accuracy` : "No attempts yet"}
                </span>
              </div>
            </div>
            <Link className="continueBtn" to="/learn">
              {stats?.latest ? "Continue Learning →" : "Start Learning →"}
            </Link>
          </div>
        </section>

        {/* Nav Cards */}
        <section className="statsRow">
          <Link className="card navCard" to="/learn">
            <div className="cardTop"><div className="cardLabel">Learn</div></div>
            <img src={StudyingImg} alt="Learn" className="cardMascot" />
            <div className="cardValue">Lessons &amp; flashcards</div>
          </Link>

          <Link className="card navCard" to="/quiz">
            <div className="cardTop"><div className="cardLabel">Quiz</div></div>
            <img src={QuizImg} alt="Quiz" className="cardMascot" />
            <div className="cardValue">Quick questions</div>
          </Link>

          <Link className="card navCard" to="/analytics">
            <div className="cardTop"><div className="cardLabel">Analytics</div></div>
            <img src={DiagramsImg} alt="Analytics" className="cardMascot" />
            <div className="cardValue">Track progress</div>
          </Link>
        </section>
      </main>

      {/* Right panel */}
      <aside className="rightPanel">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Today's checklist</div>
            <div className="pill">{totalCount} tasks</div>
          </div>

          <div className="checklistProgress">
            <div className="checklistMeta">
              <span className="checklistCount">{doneCount} / {totalCount} done</span>
              <span className="checklistPercent">{progressPct}%</span>
            </div>
            <div className="progressBar">
              <div className="progressFill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="addTask">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task…"
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            />
            <button onClick={addTask}>Add</button>
          </div>

          <div className="checklist">
            {tasks.map((t) => (
              <label key={t.id} className="checkItem">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                <span className="checkBox" />
                <div className={`checkTitle ${t.done ? "done" : ""}`}>{t.title}</div>
                <button
                  type="button"
                  className="deleteTask"
                  onClick={(e) => { e.preventDefault(); removeTask(t.id); }}
                  title="Remove task"
                >✕</button>
              </label>
            ))}
          </div>
        </div>

        {/* This Week panel — real data */}
        <div className="panel miniStatsPanel">
          <div className="panelTitle" style={{ marginBottom: "14px" }}>This Week</div>

          <div className="miniStat">
            <div className="miniStatLabel">Study time</div>
            <div className="miniStatValue">
              {statsLoading ? "…" : fmtTime(stats?.weeklyMins)}
            </div>
          </div>

          <div className="miniStat">
            <div className="miniStatLabel">Topics attempted</div>
            <div className="miniStatValue">
              {statsLoading ? "…" : `${stats?.topicsAttempted ?? 0} topics`}
            </div>
          </div>

          <div className="miniStat">
            <div className="miniStatLabel">Quiz accuracy</div>
            <div className="miniStatValue" style={{
              color: stats?.weeklyAccuracy >= 75 ? "#16a34a"
                   : stats?.weeklyAccuracy >= 50 ? "#a16207"
                   : stats?.weeklyAccuracy != null ? "#dc2626" : "inherit"
            }}>
              {statsLoading ? "…"
                : stats?.weeklyAccuracy != null ? `${stats.weeklyAccuracy}%` : "–"}
            </div>
          </div>

          {!statsLoading && fmtTrend(stats?.trend) && (
            <div className="miniStat">
              <div className="miniStatLabel">vs last week</div>
              <div className="miniStatValue" style={{
                color: stats.trend >= 0 ? "#16a34a" : "#dc2626"
              }}>
                {fmtTrend(stats.trend)}
              </div>
            </div>
          )}

          <Link to="/analytics" className="miniStatsLink">
            View full analytics →
          </Link>
        </div>
      </aside>
    </div>
  );
}