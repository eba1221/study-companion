import "./Home.css";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

import StudyingImg from "../assets/Studying.png";
import QuizImg from "../assets/Quiz.png";
import DiagramsImg from "../assets/Diagrams.png";
import WaveGif from "../assets/Wave.GIF";

// ✅ Lucide icons
import { Home as HomeIcon, Settings, User } from "lucide-react";

export default function Home() {
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Daily warm-up", desc: "Answer 5 quick questions", done: true },
    { id: "t2", title: "Review weak topic", desc: "Cell transport booster", done: false },
    { id: "t3", title: "Flashcards", desc: "10 cards (Biology)", done: false },
  ]);

  const [newTask, setNewTask] = useState("");

  const doneCount = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const totalCount = tasks.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  function toggleTask(id) {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) return;

    setTasks(prev => [
      ...prev,
      { id: crypto.randomUUID(), title, desc: "", done: false },
    ]);
    setNewTask("");
  }

  function removeTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>

        {/* ✅ Lucide Home icon */}
        <Link className="navBtn navBtnActive" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>

        <div style={{ flex: 1 }} />

        {/* ✅ Lucide Settings icon */}
        <button className="navBtn" title="Settings" aria-label="Settings">
          <Settings className="navLucide" size={22} />
        </button>

        {/* ✅ Lucide Profile icon */}
        <button className="navBtn" title="Profile" aria-label="Profile">
          <User className="navLucide" size={22} />
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
            <div className="pill">Streak 🔥 3</div>
          </div>
        </div>

        {/* Hero - Enhanced */}
        <section className="hero">
          <div className="heroCopy">
            <h1 className="heroTitle">Welcome back, Ayesha</h1>
            <p className="heroSub">Let's pick up where you left off.</p>

            <div className="heroStats">
              <div className="heroStatItem">
                <div className="heroStatValue">65%</div>
                <div className="heroStatLabel">Biology progress</div>
              </div>
              <div className="heroStatDivider" />
              <div className="heroStatItem">
                <div className="heroStatValue">12</div>
                <div className="heroStatLabel">Topics mastered</div>
              </div>
              <div className="heroStatDivider" />
              <div className="heroStatItem">
                <div className="heroStatValue">3</div>
                <div className="heroStatLabel">Day streak</div>
              </div>
            </div>
          </div>

          <div className="mascotWrap">
            <div className="heroHalo">
              <img
                src={WaveGif}
                alt="Study companion mascot"
                className="heroMascot"
              />
            </div>
          </div>
        </section>

        {/* Continue Learning */}
        <section className="continueSection">
          <div className="continueBanner">
            <div className="continueContent">
              <div className="continueLabel">Continue where you left off</div>
              <div className="continueTitle">Biology • Cell Transport</div>
              <div className="continueMeta">
                <span>Last studied 6 mins ago</span>
                <span className="continueDot">•</span>
                <span>3 topics remaining</span>
              </div>
              <div className="continueProgress">
                <div className="continueBar">
                  <div className="continueBarFill" style={{ width: "65%" }} />
                </div>
                <span className="continuePercent">65% complete</span>
              </div>
            </div>
            <Link className="continueBtn" to="/learn/notes/biology">
              Continue Learning →
            </Link>
          </div>
        </section>

        {/* Stats - Navigation Cards */}
        <section className="statsRow">
          <Link className="card navCard" to="/learn">
            <div className="cardTop">
              <div className="cardLabel">Learn</div>
            </div>
            <img src={StudyingImg} alt="Learn" className="cardMascot" />
            <div className="cardValue">Lessons &amp; flashcards</div>
          </Link>

          <Link className="card navCard" to="/quiz">
            <div className="cardTop">
              <div className="cardLabel">Quiz</div>
            </div>
            <img src={QuizImg} alt="Quiz" className="cardMascot" />
            <div className="cardValue">Quick questions</div>
          </Link>

          <Link className="card navCard" to="/analytics">
            <div className="cardTop">
              <div className="cardLabel">Analytics</div>
            </div>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <button onClick={addTask}>Add</button>
          </div>

          <div className="checklist">
            {tasks.map((t) => (
              <label key={t.id} className="checkItem">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                />
                <span className="checkBox" />
                <div className={`checkTitle ${t.done ? "done" : ""}`}>
                  {t.title}
                </div>
                <button
                  type="button"
                  className="deleteTask"
                  onClick={(e) => {
                    e.preventDefault();
                    removeTask(t.id);
                  }}
                  title="Remove task"
                >
                  ✕
                </button>
              </label>
            ))}
          </div>
        </div>

        <div className="panel miniStatsPanel">
          <div className="panelTitle" style={{ marginBottom: "14px" }}>This Week</div>

          <div className="miniStat">
            <div className="miniStatLabel">Study time</div>
            <div className="miniStatValue">4h 32m</div>
          </div>

          <div className="miniStat">
            <div className="miniStatLabel">Topics completed</div>
            <div className="miniStatValue">8 topics</div>
          </div>

          <div className="miniStat">
            <div className="miniStatLabel">Quiz accuracy</div>
            <div className="miniStatValue">87%</div>
          </div>

          <Link to="/analytics" className="miniStatsLink">
            View full analytics →
          </Link>
        </div>
      </aside>
    </div>
  );
}
