import "./Learn.css";          // reuse your whole layout + sidebar + topbar styles
import "./Analytics.css";      // analytics-specific styling
import { Link } from "react-router-dom";
import { useEffect } from "react";

import {
  Home as HomeIcon,
  BookOpen,
  BarChart3,
  Settings,
  User,
  Search,
  TrendingUp,
  Target,
  Clock,
} from "lucide-react";

import diagramsMascot from "../assets/Diagrams.png"; // <--

export default function AnalyticsPage() {
  useEffect(() => {
    document.title = "Analytics | Study Coach";
  }, []);

  return (
    <div className="learnShell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>

        <Link className="navBtn" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>

        <Link className="navBtn" to="/learn" title="Learn" aria-label="Learn">
          <BookOpen className="navLucide" size={22} />
        </Link>

        <Link
          className="navBtn navBtnActive"
          to="/analytics"
          title="Analytics"
          aria-label="Analytics"
        >
          <BarChart3 className="navLucide" size={22} />
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
            <input placeholder="Search analytics (e.g., biology, quizzes, streak)..." />
          </div>

          <div className="pills">
            <div className="pill pillActive">Analytics</div>
            <div className="pill">Streak 3</div>
          </div>
        </div>

        {/* Analytics layout */}
        <section className="analyticsGrid">
          {/* Hero */}
          <div className="card analyticsHero">
            <div className="analyticsHeroRow">
              <div className="analyticsHeroText">
                <div className="analyticsLabel">Progress</div>
                <h1 className="analyticsTitle">Your analytics</h1>
                <p className="analyticsSub">
                  Track your study time, quiz accuracy, and which topics need attention.
                </p>

                <div className="analyticsHeroChips">
                  <div className="aChip">
                    <Clock size={16} className="aChipIcon" />
                    <span>Time</span>
                  </div>
                  <div className="aChip">
                    <Target size={16} className="aChipIcon" />
                    <span>Accuracy</span>
                  </div>
                  <div className="aChip">
                    <TrendingUp size={16} className="aChipIcon" />
                    <span>Trend</span>
                  </div>
                </div>
              </div>

              <div className="analyticsMascotHalo" aria-hidden="true">
                <img className="analyticsMascotImg" src={diagramsMascot} alt="Diagrams mascot" />
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="analyticsKpis">
            <div className="card kpiCard">
              <div className="kpiTop">
                <div className="kpiLabel">This week</div>
                <Clock className="kpiIcon" size={18} />
              </div>
              <div className="kpiValue">4.5h</div>
              <div className="kpiHint">Study time logged</div>
            </div>

            <div className="card kpiCard">
              <div className="kpiTop">
                <div className="kpiLabel">Accuracy</div>
                <Target className="kpiIcon" size={18} />
              </div>
              <div className="kpiValue">72%</div>
              <div className="kpiHint">Last 7 days quizzes</div>
            </div>

            <div className="card kpiCard">
              <div className="kpiTop">
                <div className="kpiLabel">Trend</div>
                <TrendingUp className="kpiIcon" size={18} />
              </div>
              <div className="kpiValue">+6%</div>
              <div className="kpiHint">Compared to last week</div>
            </div>
          </div>

          {/* Main panels */}
          <div className="card analyticsPanel">
            <div className="panelHeader">
              <div>
                <div className="panelLabel">Study time</div>
                <div className="panelTitle">Minutes per day</div>
              </div>
              <div className="panelPill">Last 7 days</div>
            </div>

            {/* Placeholder chart */}
            <div className="chartPlaceholder">
              <div className="chartBar" style={{ height: "35%" }} />
              <div className="chartBar" style={{ height: "55%" }} />
              <div className="chartBar" style={{ height: "28%" }} />
              <div className="chartBar" style={{ height: "70%" }} />
              <div className="chartBar" style={{ height: "48%" }} />
              <div className="chartBar" style={{ height: "62%" }} />
              <div className="chartBar" style={{ height: "40%" }} />
            </div>

            <div className="panelHint">
              Hook this up to your real study session data when ready.
            </div>
          </div>

          <div className="card analyticsPanel">
            <div className="panelHeader">
              <div>
                <div className="panelLabel">Quiz</div>
                <div className="panelTitle">Accuracy by subject</div>
              </div>
              <div className="panelPill">This month</div>
            </div>

            <div className="progressList">
              <div className="progressRow">
                <div className="progressName">Biology</div>
                <div className="progressBar">
                  <div className="progressFill" style={{ width: "78%" }} />
                </div>
                <div className="progressPct">78%</div>
              </div>

              <div className="progressRow">
                <div className="progressName">Chemistry</div>
                <div className="progressBar">
                  <div className="progressFill" style={{ width: "64%" }} />
                </div>
                <div className="progressPct">64%</div>
              </div>

              <div className="progressRow">
                <div className="progressName">Physics</div>
                <div className="progressBar">
                  <div className="progressFill" style={{ width: "55%" }} />
                </div>
                <div className="progressPct">55%</div>
              </div>
            </div>

            <div className="panelHint">
              Later we can use real quiz_attempts + answers to compute this.
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
