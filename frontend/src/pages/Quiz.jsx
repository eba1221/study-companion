// QuizPage.jsx - AI-Powered Quiz with Database Integration
import "./Learn.css";
import "./Quiz.css";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home as HomeIcon, BookOpen, Settings, User } from "lucide-react";
import mascotImg from "../assets/Quiz.png";

const LETTERS = ["A", "B", "C", "D"];

function getAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem("sc_user"));
    const token = user?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function QuizPage() {
  useEffect(() => {
    document.title = "Quiz | Study Coach";
  }, []);

  const [stage, setStage] = useState("setup");

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [tier, setTier] = useState("foundation");

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [startTime, setStartTime] = useState(null);

  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubjects();
    loadHistory();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadTopics(selectedSubject);
    } else {
      setTopics([]);
      setSelectedTopic("");
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      const res = await fetch("https://study-companion-production-cec1.up.railway.app/api/subjects", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load subjects:", err);
      setSubjects([]);
    }
  };

  const loadTopics = async (subjectId) => {
    try {
      const res = await fetch(
        `https://study-companion-production-cec1.up.railway.app/api/subjects/${subjectId}/topics`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load topics:", err);
      setTopics([]);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("https://study-companion-production-cec1.up.railway.app/api/quiz/history/me", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json();
      setHistory(data.attempts || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const generateQuiz = async () => {
    if (!selectedTopic) {
      setError("Please select a topic");
      return;
    }

    setError("");
    setLoading(true);
    setStage("generating");

    try {
      const res = await fetch("https://study-companion-production-cec1.up.railway.app/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topicId: selectedTopic, tier }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate quiz");
      }

      const data = await res.json();
      await loadQuiz(data.quizId);
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError(err.message || "Failed to generate quiz");
      setStage("setup");
    } finally {
      setLoading(false);
    }
  };

  const loadQuiz = async (quizId) => {
    try {
      const res = await fetch(`https://study-companion-production-cec1.up.railway.app/api/quiz/${quizId}`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json();

      setQuiz(data.quiz);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelected(null);
      setAnswers({});
      setStartTime(Date.now());
      setStage("quiz");
    } catch (err) {
      console.error("Failed to load quiz:", err);
      setError("Failed to load quiz");
      setStage("setup");
    }
  };

  const submitAnswer = () => {
    if (selected === null) return;

    const questionId = questions[currentIndex].id;
    const userAnswer = LETTERS[selected];

    setAnswers((prev) => ({ ...prev, [questionId]: userAnswer }));
    setSelected(null);

    if (currentIndex + 1 >= questions.length) {
      submitQuiz({ ...answers, [questionId]: userAnswer });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const submitQuiz = async (finalAnswers) => {
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await fetch(`https://study-companion-production-cec1.up.railway.app/api/quiz/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ answers: finalAnswers, timeTaken }),
      });

      const data = await res.json();
      setResults(data);
      setStage("results");
      loadHistory();
    } catch (err) {
      console.error("Failed to submit quiz:", err);
      setError("Failed to submit quiz");
    }
  };

  const resetQuiz = () => {
    setStage("setup");
    setQuiz(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelected(null);
    setAnswers({});
    setResults(null);
    setError("");
  };

  const currentQuestion = questions[currentIndex];
  const progressPct = questions.length
    ? Math.round(((currentIndex + 1) / questions.length) * 100)
    : 0;

  useEffect(() => {
    if (stage !== "quiz") return;

    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();

      const letterIdx = LETTERS.map((x) => x.toLowerCase()).indexOf(k);
      if (letterIdx >= 0 && currentQuestion) {
        setSelected(letterIdx);
        return;
      }

      if (k === "arrowdown" || k === "arrowright") {
        e.preventDefault();
        setSelected((s) => (s === null ? 0 : Math.min(s + 1, 3)));
      }
      if (k === "arrowup" || k === "arrowleft") {
        e.preventDefault();
        setSelected((s) => (s === null ? 0 : Math.max(s - 1, 0)));
      }
      if (k === "enter") {
        e.preventDefault();
        submitAnswer();
      }
      if (k === "escape") {
        e.preventDefault();
        resetQuiz();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, currentQuestion, selected]);

  return (
    <div className="learnShell">
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>
        <Link className="navBtn" to="/learn" title="Learn" aria-label="Learn">
          <BookOpen className="navLucide" size={22} />
        </Link>
        <Link className="navBtn navBtnActive" to="/quiz" title="Quiz" aria-label="Quiz">
          <span className="navLucide" style={{ fontWeight: 900 }}>?</span>
        </Link>
        <div style={{ flex: 1 }} />
        <button className="navBtn" title="Settings" aria-label="Settings">
          <Settings className="navLucide" size={22} />
        </button>
        <button className="navBtn" title="Profile" aria-label="Profile">
          <User className="navLucide" size={22} />
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">
            🔎
            <input placeholder="Generate AI quiz from your flashcards..." />
          </div>
          <div className="pills">
            <div className="pill pillActive">AI Quiz</div>
            <div className="pill">
              History: {history.length} attempt{history.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <section className="quizGrid">
          <div className="card quizCardLike">
            <div className="quizHeaderRow">
              <div>
                <div className="cardLabel">AI-Powered Practice</div>
                <h1 className="quizTitle">Quiz</h1>
              </div>
              <div className="quizMascotHalo">
                <img className="quizMascotImg" src={mascotImg} alt="Quiz mascot" />
              </div>
            </div>

            {/* SETUP STAGE */}
            {stage === "setup" && (
              <>
                <p className="quizSub">
                  Select a topic and tier. AI will generate 10 GCSE-style questions from your flashcards.
                </p>

                <div className="quizSetupGrid">
                  <label className="quizLabel">
                    Subject
                    <select
                      className="quizSelect"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                    >
                      <option value="">Choose subject...</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="quizLabel">
                    Topic
                    <select
                      className="quizSelect"
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      disabled={!selectedSubject}
                    >
                      <option value="">Choose topic...</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="quizLabel">
                  Tier
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      className={`quizChoiceBtn ${tier === "foundation" ? "active" : ""}`}
                      onClick={() => setTier("foundation")}
                      style={{ flex: 1 }}
                    >
                      Foundation
                    </button>
                    <button
                      className={`quizChoiceBtn ${tier === "higher" ? "active" : ""}`}
                      onClick={() => setTier("higher")}
                      style={{ flex: 1 }}
                    >
                      Higher
                    </button>
                  </div>
                </label>

                {error && <p className="quizWarn">{error}</p>}

                <div className="quizButtonRow">
                  <button
                    className="primaryBtn"
                    onClick={generateQuiz}
                    disabled={!selectedTopic || loading}
                  >
                    {loading ? "Generating..." : "Generate Quiz →"}
                  </button>
                  <button
                    className="ghostBtn"
                    onClick={() => {
                      setSelectedSubject("");
                      setSelectedTopic("");
                      setTier("foundation");
                      setError("");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </>
            )}

            {/* GENERATING STAGE */}
            {stage === "generating" && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 1.5s ease-in-out infinite" }}>
                  🤖
                </div>
                <h3 style={{ margin: 0, marginBottom: "8px" }}>AI is generating your quiz...</h3>
                <p style={{ color: "rgba(58, 30, 16, 0.68)", fontSize: "14px" }}>This may take 10-20 seconds</p>
              </div>
            )}

            {/* QUIZ STAGE */}
            {stage === "quiz" && currentQuestion && (
              <>
                <div className="quizProgressMeta">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span className="quizTopicBadge">{tier.charAt(0).toUpperCase() + tier.slice(1)} Tier</span>
                </div>

                <div className="quizProgressWrap">
                  <div className="quizProgressFill" style={{ width: `${progressPct}%` }} />
                </div>

                <h2 className="quizQuestion animate-fade">{currentQuestion.question_text}</h2>

                <div className="quizChoices">
                  {[
                    currentQuestion.option_a,
                    currentQuestion.option_b,
                    currentQuestion.option_c,
                    currentQuestion.option_d,
                  ].map((option, i) => (
                    <button
                      key={i}
                      className={`quizChoiceBtn ${selected === i ? "active" : ""}`}
                      data-letter={LETTERS[i]}
                      onClick={() => setSelected(i)}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="quizButtonRow">
                  <button className="primaryBtn" onClick={submitAnswer} disabled={selected === null}>
                    Submit answer
                  </button>
                  <button className="ghostBtn" onClick={resetQuiz}>Quit</button>
                </div>
              </>
            )}

            {/* RESULTS STAGE */}
            {stage === "results" && results && (
              <>
                <div className="quizResultsTop">
                  <div>
                    <div className="cardLabel">Results</div>
                    <div className="quizScoreLine">
                      <span className="quizScoreBig">{results.score}</span>
                      <span className="quizScoreSmall">/ {results.totalQuestions} correct</span>
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "16px", fontWeight: 700, color: "rgba(58, 30, 16, 0.7)" }}>
                      {results.percentage}%
                    </div>
                  </div>
                  <div className="pill">
                    {results.percentage === 100 ? "Perfect 🎉" : `${results.totalQuestions - results.score} missed`}
                  </div>
                </div>

                <div className="quizButtonRow">
                  <button className="primaryBtn" onClick={resetQuiz}>New quiz →</button>
                  <button className="ghostBtn" onClick={() => loadQuiz(quiz.id)}>Retry same quiz</button>
                </div>

                <div className="quizReviewSection">
                  <h3 className="quizReviewTitle">Review answers</h3>

                  {results.percentage === 100 ? (
                    <div className="quizPerfectBox" />
                  ) : (
                    <div className="quizReviewList">
                      {results.results
                        .filter((r) => !r.isCorrect)
                        .map((result, idx) => {
                          const q = questions.find((q) => q.id === result.questionId);
                          return (
                            <div key={idx} className="quizReviewCard">
                              <div className="quizReviewQ">{q.question_text}</div>
                              <div className="quizReviewRow">
                                <span className="quizReviewRowLabel">Your answer</span>
                                <span className="quizIncorrect">
                                  {result.userAnswer}: {q[`option_${result.userAnswer.toLowerCase()}`]}
                                </span>
                              </div>
                              <div className="quizReviewRow">
                                <span className="quizReviewRowLabel">Correct</span>
                                <span className="quizCorrect">
                                  {result.correctAnswer}: {q[`option_${result.correctAnswer.toLowerCase()}`]}
                                </span>
                              </div>
                              {result.explanation && (
                                <div className="quizExplanation">{result.explanation}</div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Side card */}
          <div className="card quizSideCard">
            <div className="cardLabel">Recent attempts</div>
            <div className="quizTipTitle">Quiz History</div>

            {history.length === 0 ? (
              <p className="quizTipText">No quizzes taken yet. Generate your first AI quiz!</p>
            ) : (
              <div className="quizMiniStats">
                {history.slice(0, 5).map((attempt) => (
                  <div key={attempt.id} className="quizMiniStat">
                    <div>
                      <div className="quizMiniLabel">{attempt.topic_name}</div>
                      <div style={{ fontSize: "11px", color: "rgba(58, 30, 16, 0.5)", marginTop: "2px" }}>
                        {attempt.tier} • {new Date(attempt.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="quizMiniValue">{attempt.score}/{attempt.total_questions}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}