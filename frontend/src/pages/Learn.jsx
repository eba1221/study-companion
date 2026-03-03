// src/pages/Learn.jsx
// FULL corrected Learn.jsx (Fix: Notes links now go to /learn/notes)

import "./Learn.css";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
  Home as HomeIcon,
  BookOpen,
  Settings,
  User,
  Dna,
  FlaskConical,
  Atom,
  Layers,
  Target,
  Search,
  Play,
  Pause,
  RotateCcw,
  X,
  Timer,
} from "lucide-react";

import booksMascot from "../assets/Books.png"; // adjust path if needed

const LS_FOCUS_KEY = "studycoach_focus_v1";
const DEFAULT_MINUTES = 25;
const DEFAULT_SECONDS = DEFAULT_MINUTES * 60;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Learn() {
  // ---------------- Data ----------------
  const [plan] = useState([
    {
      id: "p1",
      title: "Flashcards warm-up",
      meta: "10 mins • Mixed topics",
      cta: "Start",
      to: "/learn/flashcards",
      iconType: "flashcards",
      progress: 0,
    },
    {
      id: "p2",
      title: "Notes: Cell transport",
      meta: "6 mins • Biology",
      cta: "Open",
      to: "/learn/notes", // ✅ FIXED (was /learn/notes/biology)
      iconType: "biology",
      progress: 60,
    },
    {
      id: "p3",
      title: "Mini practice",
      meta: "5 questions • Quick check",
      cta: "Go",
      to: "/quiz",
      iconType: "practice",
      progress: 0,
    },
  ]);

  const subjects = [
    {
      name: "Biology",
      iconType: "biology",
      topics: 12,
      progress: 65,
      color: "#A8C9A4",
      to: "/learn/notes", // ✅ FIXED (was /learn/notes/biology)
    },
    {
      name: "Chemistry",
      iconType: "chemistry",
      topics: 15,
      progress: 42,
      color: "#F6B38E",
      to: "/learn/notes", // ✅ FIXED (was /learn/notes/chemistry)
    },
    {
      name: "Physics",
      iconType: "physics",
      topics: 10,
      progress: 28,
      color: "#A9D6E6",
      to: "/learn/notes", // ✅ FIXED (was /learn/notes/physics)
    },
  ];

  // ---------------- Icons ----------------
  function Icon({ type, className = "", size = 20 }) {
    const props = { className: `lucideIcon ${className}`, size };
    switch (type) {
      case "biology":
        return <Dna {...props} />;
      case "chemistry":
        return <FlaskConical {...props} />;
      case "physics":
        return <Atom {...props} />;
      case "flashcards":
        return <Layers {...props} />;
      case "practice":
        return <Target {...props} />;
      default:
        return null;
    }
  }

  // ---------------- Focus timer state ----------------
  const [focusOn, setFocusOn] = useState(false);
  const [running, setRunning] = useState(false);

  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);

  // Duration picker UI state (string for input)
  const [minsUI, setMinsUI] = useState(String(DEFAULT_MINUTES));
  const [dirtyMins, setDirtyMins] = useState(false);

  function applyMinutes(mins) {
    const m = clamp(Number(mins) || DEFAULT_MINUTES, 1, 120);
    const nextTotal = m * 60;

    setTotalSeconds(nextTotal);
    setSecondsLeft(nextTotal);
    setMinsUI(String(m));
    setDirtyMins(false);
  }

  function pickPreset(mins) {
    if (running) return;
    applyMinutes(mins);
  }

  function turnOnFocus() {
    setFocusOn(true);
  }

  function turnOffFocus() {
    setFocusOn(false);
    setRunning(false);
  }

  function toggleRun() {
    if (!focusOn) setFocusOn(true);
    if (secondsLeft === 0) setSecondsLeft(totalSeconds);
    setRunning((r) => !r);
  }

  function resetFocus() {
    setRunning(false);
    setSecondsLeft(totalSeconds);
  }

  // Load from localStorage (once)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_FOCUS_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);

      const on = !!data.focusOn;
      const run = !!data.running;
      const total = clamp(Number(data.totalSeconds) || DEFAULT_SECONDS, 60, 60 * 120);
      const left = clamp(Number(data.secondsLeft) || total, 0, total);
      const mins = clamp(Math.round(total / 60), 1, 120);

      setFocusOn(on);
      setRunning(run);
      setTotalSeconds(total);
      setSecondsLeft(left);
      setMinsUI(String(mins));
      setDirtyMins(false);
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    const payload = {
      focusOn,
      running,
      totalSeconds,
      secondsLeft,
      minsUI,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(LS_FOCUS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [focusOn, running, totalSeconds, secondsLeft, minsUI]);

  // Tick
  useEffect(() => {
    if (!focusOn || !running) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [focusOn, running]);

  const progressPct = useMemo(() => {
    if (!focusOn || totalSeconds <= 0) return 0;
    const done = totalSeconds - secondsLeft;
    return clamp((done / totalSeconds) * 100, 0, 100);
  }, [focusOn, totalSeconds, secondsLeft]);

  const statusText = useMemo(() => {
    if (running) return "Running";
    if (secondsLeft === 0) return "Finished";
    return "Paused";
  }, [running, secondsLeft]);

  const minsNumber = useMemo(
    () => clamp(Number(minsUI) || DEFAULT_MINUTES, 1, 120),
    [minsUI]
  );

  // ---------------- Page ----------------
  return (
    <div className="learnShell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>

        <Link className="navBtn" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>

        <Link className="navBtn navBtnActive" to="/learn" title="Learn" aria-label="Learn">
          <BookOpen className="navLucide" size={22} />
        </Link>

        <div style={{ flex: 1 }} />

        <button className="navBtn" title="Settings" aria-label="Settings" type="button">
          <Settings className="navLucide" size={22} />
        </button>

        <button className="navBtn" title="Profile" aria-label="Profile" type="button">
          <User className="navLucide" size={22} />
        </button>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="search">
            <Search size={16} className="topbarLucide" />
            <input placeholder="Search a topic (e.g., osmosis, acids, forces)..." />
          </div>

          <div className="pills">
            <div className="pill pillActive">Learn</div>
            <div className="pill">Streak 3</div>
          </div>
        </div>

        {/* Dashboard grid */}
        <section className="learnGrid">
          {/* Left: Today's plan */}
          <div className="card planCard">
            <div className="cardHeaderRow">
              <div className="cardTitle">Today's plan</div>
              <div className="chip">{plan.length} tasks</div>
            </div>

            <div className="planList">
              {plan.map((item) => (
                <Link key={item.id} to={item.to} className="planItem">
                  <div className="planIcon">
                    <Icon type={item.iconType} size={20} />
                  </div>

                  <div className="planText">
                    <div className="planTitle">{item.title}</div>
                    <div className="planMeta">{item.meta}</div>

                    {item.progress > 0 && (
                      <div className="planProgressMini">
                        <div className="planProgressBar">
                          <div className="planProgressFill" style={{ width: `${item.progress}%` }} />
                        </div>
                        <span className="planProgressText">{item.progress}%</span>
                      </div>
                    )}
                  </div>

                  <div className="planCta">{item.cta} →</div>
                </Link>
              ))}
            </div>

            <div className="planStats">
              <div className="planStat">
                <div className="planStatValue">38m</div>
                <div className="planStatLabel">Today</div>
              </div>
              <div className="planStatDivider" />
              <div className="planStat">
                <div className="planStatValue">4.5h</div>
                <div className="planStatLabel">This week</div>
              </div>
            </div>
          </div>

          {/* Center: Hero + Subjects */}
          <div className="centerStack">
            <div className="card heroCard">
              <div className="heroRow">
                <div className="heroText">
                  <div className="heroLabel">Study Coach</div>
                  <div className="heroTitle">Pick a subject and start small.</div>
                  <div className="heroSub">Try 10 minutes of flashcards, then one topic of notes.</div>

                  <div className="heroBtns">
                    <Link className="primaryBtn" to="/learn/flashcards">
                      Start flashcards →
                    </Link>
                    <Link className="ghostBtn" to="/quiz">
                      Mini practice →
                    </Link>
                  </div>
                </div>

                <div className="heroMascotHalo" aria-hidden="true">
                  <img className="heroMascotImg" src={booksMascot} alt="Books mascot" />
                </div>
              </div>
            </div>

            <div className="subjectGrid">
              {subjects.map((subject) => (
                <Link
                  key={subject.name}
                  to={subject.to}
                  className="subjectCard"
                  style={{ "--subject-color": subject.color }}
                >
                  <div className="subjectHeader">
                    <div className="subjectIcon">
                      <Icon type={subject.iconType} size={22} className="subjectLucide" />
                    </div>
                    <div className="subjectBadge">{subject.topics} topics</div>
                  </div>

                  <div className="subjectName">{subject.name}</div>

                  <div className="subjectProgress">
                    <div className="subjectProgressBar">
                      <div
                        className="subjectProgressFill"
                        style={{ width: `${subject.progress}%`, background: subject.color }}
                      />
                    </div>
                    <span className="subjectProgressText">{subject.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Collapsed bar (only when focus OFF) */}
        {!focusOn && (
          <div className="focusBar">
            <div className="focusLeft">
              <span className="focusDot focusDotAnimated" />
              <span>Focus mode</span>
              <button className="focusToggleBtn" type="button" onClick={turnOnFocus}>
                Turn on
              </button>
            </div>

            <div className="focusRight">
              <span className="focusTip">Tip: Set a 25-minute timer for focused study sessions</span>
            </div>
          </div>
        )}

        {/* Expanded Focus Dock */}
        {focusOn && (
          <div className="focusDock" role="region" aria-label="Focus timer">
            <div className="focusDockFill" style={{ width: `${progressPct}%` }} />

            <div className="focusDockInner">
              {/* Left: status */}
              <div className="focusDockLeft">
                <span className={`focusDot ${running ? "focusDotRunning" : ""}`} />
                <div className="focusDockText">
                  <div className="focusDockTitle">
                    <Timer size={16} className="dockLucide" />
                    Focus session
                  </div>
                  <div className="focusDockSub">{statusText}</div>
                </div>
              </div>

              {/* Center: BIG time */}
              <div className="focusDockCenter">
                <div className="timeLabel">Time left</div>
                <div className="timeBig">{fmtTime(secondsLeft)}</div>
              </div>

              {/* Right: duration + controls */}
              <div className="focusDockRight">
                <div className="focusDockMid">
                  <div className="dockLabel">Duration</div>

                  <div className="dockPresets">
                    <button
                      type="button"
                      className={`dockChip ${minsNumber === 10 && !dirtyMins ? "active" : ""}`}
                      onClick={() => pickPreset(10)}
                      disabled={running}
                    >
                      10m
                    </button>
                    <button
                      type="button"
                      className={`dockChip ${minsNumber === 25 && !dirtyMins ? "active" : ""}`}
                      onClick={() => pickPreset(25)}
                      disabled={running}
                    >
                      25m
                    </button>
                    <button
                      type="button"
                      className={`dockChip ${minsNumber === 45 && !dirtyMins ? "active" : ""}`}
                      onClick={() => pickPreset(45)}
                      disabled={running}
                    >
                      45m
                    </button>
                  </div>

                  <div className="dockCustom">
                    <input
                      className="dockInput"
                      type="number"
                      min={1}
                      max={120}
                      inputMode="numeric"
                      value={minsUI}
                      disabled={running}
                      onChange={(e) => {
                        setMinsUI(e.target.value);
                        setDirtyMins(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyMinutes(minsUI);
                      }}
                    />
                    <span className="dockUnit">min</span>

                    <button
                      type="button"
                      className="dockApply"
                      onClick={() => applyMinutes(minsUI)}
                      disabled={running || !dirtyMins}
                      title={running ? "Pause to change duration" : "Apply duration"}
                    >
                      Apply
                    </button>
                  </div>

                  {running && <div className="dockHint">Pause to change duration</div>}
                </div>

                <div className="focusDockCtrls">
                  <button
                    className="dockBtn"
                    type="button"
                    onClick={toggleRun}
                    aria-label={running ? "Pause" : "Start"}
                  >
                    {running ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <button className="dockBtn" type="button" onClick={resetFocus} aria-label="Reset">
                    <RotateCcw size={18} />
                  </button>

                  <button
                    className="dockBtn dockBtnDanger"
                    type="button"
                    onClick={turnOffFocus}
                    aria-label="Close focus mode"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
