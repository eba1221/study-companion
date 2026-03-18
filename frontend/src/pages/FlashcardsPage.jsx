// frontend/src/pages/FlashcardsPage.jsx

import "./Learn.css";
import "./FlashcardsPage.css";

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Home as HomeIcon, BookOpen, Settings, User, Check, X, Search, Brain } from "lucide-react";

import booksMascot from "../assets/Books.png";
import { getDecks, getCards, getSubjects, getTopicsBySubject, getStoredUser } from "../api";

const API_BASE = "https://study-companion-production-cec1.up.railway.app";

function getAuthHeaders() {
  try {
    const user = getStoredUser();
    const token = user?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [cards, setCards] = useState([]);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState("ALL");
  const [activeTopicId, setActiveTopicId] = useState("ALL");

  const [mode, setMode] = useState("manage"); // manage | study | review
  const [query, setQuery] = useState("");

  // Study mode state
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [pileKnown, setPileKnown] = useState([]);
  const [pileUnknown, setPileUnknown] = useState([]);

  // Review (SM-2) state
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewStats, setReviewStats] = useState(null); // { due, total, upcoming }
  const [reviewResults, setReviewResults] = useState([]); // { cardId, quality }

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load decks + subjects + review stats on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBusy(true);
        setErrorMsg("");
        const [ds, subs] = await Promise.all([getDecks(), getSubjects()]);
        if (!alive) return;
        setDecks(Array.isArray(ds) ? ds : []);
        setSubjects(Array.isArray(subs) ? subs : []);
        setActiveSubjectId("ALL");
        setActiveTopicId("ALL");
        const firstId = Array.isArray(ds) && ds.length ? ds[0].id : null;
        setActiveDeckId(firstId);
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "Failed to load decks/subjects");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load review stats
  useEffect(() => {
    loadReviewStats();
  }, []);

  async function loadReviewStats() {
    try {
      const res = await fetch(`${API_BASE}/api/review/stats`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (res.ok) setReviewStats(await res.json());
    } catch (e) {
      console.error("Failed to load review stats:", e);
    }
  }

  // Load topics when subject changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErrorMsg("");
        if (activeSubjectId === "ALL") {
          setTopics([]);
          setActiveTopicId("ALL");
          return;
        }
        const ts = await getTopicsBySubject(activeSubjectId);
        if (!alive) return;
        setTopics(Array.isArray(ts) ? ts : []);
        setActiveTopicId("ALL");
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "Failed to load topics");
      }
    })();
    return () => { alive = false; };
  }, [activeSubjectId]);

  // Filter decks by subject + topic
  const filteredDecks = useMemo(() => {
    const wantedSubject = activeSubjectId === "ALL" ? null : Number(activeSubjectId);
    const wantedTopic = activeTopicId === "ALL" ? null : Number(activeTopicId);
    return decks.filter((d) => {
      const deckSubject = d.subject_id ?? d.subjectId ?? null;
      const deckTopic = d.topic_id ?? d.topicId ?? null;
      const subjOk = wantedSubject === null ? true : deckSubject !== null && Number(deckSubject) === wantedSubject;
      const topicOk = wantedTopic === null ? true : deckTopic !== null && Number(deckTopic) === wantedTopic;
      return subjOk && topicOk;
    });
  }, [decks, activeSubjectId, activeTopicId]);

  // Keep active deck valid when filters change
  useEffect(() => {
    if (!filteredDecks.length) { setActiveDeckId(null); return; }
    if (!filteredDecks.some((d) => d.id === activeDeckId)) {
      setActiveDeckId(filteredDecks[0].id);
    }
  }, [filteredDecks]);

  const activeDeck = useMemo(
    () => filteredDecks.find((d) => d.id === activeDeckId) || null,
    [filteredDecks, activeDeckId]
  );

  // Load cards when activeDeckId changes
  useEffect(() => {
    if (!activeDeckId) { setCards([]); return; }
    let alive = true;
    (async () => {
      try {
        setErrorMsg("");
        const cs = await getCards(activeDeckId);
        if (!alive) return;
        setCards(Array.isArray(cs) ? cs : []);
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "Failed to load cards");
      }
    })();
    return () => { alive = false; };
  }, [activeDeckId]);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) => String(c.front || "").toLowerCase().includes(q) || String(c.back || "").toLowerCase().includes(q)
    );
  }, [cards, query]);

  // ── Study mode ──────────────────────────────────────────────────────────
  const resetSessionState = () => {
    setStudyQueue([]);
    setStudyIndex(0);
    setIsFlipped(false);
    setPileKnown([]);
    setPileUnknown([]);
  };

  const startStudy = (sourceCards = cards) => {
    if (!activeDeck || sourceCards.length === 0) return;
    const queue = [...sourceCards].sort((a, b) => a.id - b.id).map((c) => c.id);
    setStudyQueue(queue);
    setStudyIndex(0);
    setIsFlipped(false);
    setPileKnown([]);
    setPileUnknown([]);
    setMode("study");
  };

  const currentCard = useMemo(() => {
    if (!activeDeck || studyQueue.length === 0) return null;
    const id = studyQueue[studyIndex];
    return cards.find((c) => c.id === id) || null;
  }, [activeDeck, studyQueue, studyIndex, cards]);

  const flipCard = () => setIsFlipped((v) => !v);

  const pushToPile = async (which) => {
  if (!currentCard) return;
  const id = currentCard.id;
  if (which === "known") setPileKnown((p) => [...p, id]);
  if (which === "unknown") setPileUnknown((p) => [...p, id]);
  setIsFlipped(false);
  setStudyIndex((i) => Math.min(i + 1, studyQueue.length));

  // Add to spaced repetition queue
  try {
    await fetch(`${API_BASE}/api/review/add/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ known: which === "known" }),
    });
  } catch (e) {
    console.error("Failed to add to review queue:", e);
  }
};

  const exitStudy = () => { setMode("manage"); resetSessionState(); };

  const done = mode === "study" && (!currentCard || studyIndex >= studyQueue.length);
  const progressPct = studyQueue.length ? Math.round((studyIndex / studyQueue.length) * 100) : 0;
  const deckCount = filteredDecks.length;

  const unknownCards = useMemo(() => {
    const set = new Set(pileUnknown);
    return cards.filter((c) => set.has(c.id));
  }, [cards, pileUnknown]);

  // ── Review (SM-2) mode ───────────────────────────────────────────────────
  async function startReview() {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/review/due`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const due = await res.json();
      if (!Array.isArray(due) || due.length === 0) {
        setErrorMsg("No cards due for review today! Come back later.");
        return;
      }
      setReviewQueue(due);
      setReviewIndex(0);
      setReviewFlipped(false);
      setReviewResults([]);
      setBusy(false);
      setMode("review");
    } catch (e) {
      setErrorMsg("Failed to load review cards");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(quality) {
    const card = reviewQueue[reviewIndex];
    if (!card) return;

    try {
      await fetch(`${API_BASE}/api/review/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ quality }),
      });
      setReviewResults((r) => [...r, { cardId: card.id, quality }]);
    } catch (e) {
      console.error("Failed to submit review:", e);
    }

    setReviewFlipped(false);
    setReviewIndex((i) => i + 1);
  }

  function exitReview() {
    setMode("manage");
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewFlipped(false);
    setReviewResults([]);
    loadReviewStats();
  }

  const reviewCard = reviewQueue[reviewIndex] || null;
  const reviewDone = mode === "review" && reviewIndex >= reviewQueue.length;
  const reviewProgressPct = reviewQueue.length
    ? Math.round((reviewIndex / reviewQueue.length) * 100)
    : 0;

  // Quality label helpers
  const QUALITY_BUTTONS = [
    { quality: 0, label: "Again",  hint: "Complete blackout",     color: "#dc2626" },
    { quality: 3, label: "Hard",   hint: "Correct but difficult", color: "#d97706" },
    { quality: 4, label: "Good",   hint: "Correct with effort",   color: "#16a34a" },
    { quality: 5, label: "Easy",   hint: "Perfect recall",        color: "#0284c7" },
  ];

  return (
    <div className="learnShell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>
        <Link className="navBtn navBtnActive" to="/flashcards" title="Flashcards" aria-label="Flashcards">
          <BookOpen className="navLucide" size={22} />
        </Link>
        <div style={{ flex: 1 }} />
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="fcRow fcFilters">
            <select
              className="fcInput"
              value={activeSubjectId}
              onChange={(e) => setActiveSubjectId(e.target.value)}
              disabled={busy}
            >
              <option value="ALL">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>

            <select
              className="fcInput"
              value={activeTopicId}
              onChange={(e) => setActiveTopicId(e.target.value)}
              disabled={busy || activeSubjectId === "ALL"}
            >
              <option value="ALL">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="search">
            <Search size={14} style={{ opacity: 0.45 }} />
            <input
              placeholder="Search cards..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="pills">
            <button className={`pill ${mode === "manage" ? "pillActive" : ""}`} onClick={() => setMode("manage")}>
              Browse
            </button>
            <button
              className={`pill ${mode === "study" ? "pillActive" : ""}`}
              onClick={() => startStudy(cards)}
              disabled={!activeDeck || cards.length === 0}
              style={{ opacity: !activeDeck || cards.length === 0 ? 0.6 : 1 }}
            >
              Study
            </button>
            <button
              className={`pill ${mode === "review" ? "pillActive" : ""}`}
              onClick={startReview}
              disabled={busy}
              style={{
                opacity: busy ? 0.6 : 1,
                background: reviewStats?.due > 0 ? "rgba(220,38,38,0.12)" : undefined,
                color: reviewStats?.due > 0 ? "#dc2626" : undefined,
                fontWeight: reviewStats?.due > 0 ? 900 : undefined,
              }}
            >
              <Brain size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Review {reviewStats?.due > 0 ? `(${reviewStats.due})` : ""}
            </button>
            <div className="pill" style={{ cursor: "default" }}>
              {deckCount} Deck{deckCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="card" style={{ marginBottom: 12, padding: 12 }}>
            <div className="planMeta" style={{ fontWeight: 800 }}>{errorMsg}</div>
          </div>
        )}

        <section className="fcGrid">
          {/* Left: Decks */}
          <div className="card fcDecks">
            <div className="cardHeaderRow">
              <div className="cardTitle">Decks</div>
              <div className="chip">{deckCount}</div>
            </div>

            {/* Review stats panel */}
            {reviewStats && (
              <div style={{
                margin: "8px 0 12px",
                padding: "10px 12px",
                borderRadius: 12,
                background: reviewStats.due > 0 ? "rgba(220,38,38,0.07)" : "rgba(58,30,16,0.04)",
                border: reviewStats.due > 0 ? "1px solid rgba(220,38,38,0.20)" : "1px solid rgba(58,30,16,0.08)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(58,30,16,0.5)", marginBottom: 4 }}>
                  SPACED REPETITION
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: reviewStats.due > 0 ? "#dc2626" : "#16a34a" }}>
                  {reviewStats.due > 0 ? `${reviewStats.due} cards due today` : "All caught up! ✓"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(58,30,16,0.5)", marginTop: 2 }}>
                  {reviewStats.total} total cards tracked
                </div>
                {reviewStats.upcoming?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(58,30,16,0.5)" }}>
                    Next: {reviewStats.upcoming[0].count} cards on {new Date(reviewStats.upcoming[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                )}
              </div>
            )}

            {filteredDecks.length === 0 ? (
              <div className="fcEmpty" style={{ marginTop: 12 }}>
                <div className="cardTitle">No decks found</div>
                <div className="planMeta">Try a different subject or topic.</div>
              </div>
            ) : (
              <div className="fcDeckList">
                {filteredDecks.map((d) => (
                  <button
                    key={d.id}
                    className={`fcDeckItem ${d.id === activeDeckId ? "active" : ""}`}
                    onClick={() => { setActiveDeckId(d.id); setMode("manage"); setQuery(""); resetSessionState(); }}
                  >
                    <div className="fcDeckName">{d.name}</div>
                    <div className="fcDeckMeta">{d.id === activeDeckId ? cards.length : "·"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Main */}
          <div className="card fcMain">
            {!activeDeck && mode !== "review" ? (
              <div className="fcEmpty">
                <div className="cardTitle">No deck selected</div>
                <div className="planMeta">Pick a deck from the left.</div>
              </div>

            ) : mode === "review" ? (
              /* ── REVIEW MODE ── */
              <div className="fcStudyWrap">
                <div className="cardHeaderRow">
                  <div>
                    <div className="cardTitle">Spaced Repetition Review</div>
                    <div className="planMeta">SM-2 Algorithm · {reviewStats?.due ?? reviewQueue.length} cards due</div>
                  </div>
                  <button className="fcBtn fcBtnGhost" onClick={exitReview}>Exit</button>
                </div>

                <div className="fcProgressTrack">
                  <div className="fcProgressFill" style={{ width: `${reviewProgressPct}%` }} />
                </div>

                {reviewDone ? (
                  /* Review complete screen */
                  <div className="fcDone">
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🧠</div>
                    <div className="continueTitle">Review complete!</div>
                    <div className="continueMeta" style={{ marginBottom: 16 }}>
                      You reviewed {reviewResults.length} cards
                    </div>

                    {/* Score breakdown */}
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
                      {[
                        { label: "Again", quality: 0, color: "#dc2626" },
                        { label: "Hard",  quality: 3, color: "#d97706" },
                        { label: "Good",  quality: 4, color: "#16a34a" },
                        { label: "Easy",  quality: 5, color: "#0284c7" },
                      ].map(({ label, quality, color }) => {
                        const count = reviewResults.filter((r) => r.quality === quality).length;
                        return (
                          <div key={label} style={{
                            padding: "8px 16px", borderRadius: 12,
                            background: `${color}15`, border: `1px solid ${color}40`,
                            textAlign: "center",
                          }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color }}>{count}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(58,30,16,0.6)" }}>{label}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="fcRow" style={{ justifyContent: "center" }}>
                      <button className="fcBtn fcBtnAccent" onClick={exitReview}>Back to browse</button>
                    </div>
                  </div>
                ) : (
                  /* Review card */
                  <div className="fcStudyStage">
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(58,30,16,0.45)", textAlign: "center", marginBottom: 8 }}>
                      {reviewIndex + 1} / {reviewQueue.length} · {reviewCard?.deck_name}
                    </div>

                    <div
                      className="fcStudyCard"
                      onClick={() => setReviewFlipped((v) => !v)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setReviewFlipped((v) => !v); }
                      }}
                    >
                      <img src={booksMascot} className="fcMascotOnCard" alt="" draggable="false" />
                      <div className={`fcStudyInner ${reviewFlipped ? "isFlipped" : ""}`}>
                        <div className="fcStudyFace fcStudyFront">
                          <div className="fcStudyHint">Question · click to reveal answer</div>
                          <div className="fcStudyText">{reviewCard?.front}</div>
                        </div>
                        <div className="fcStudyFace fcStudyBack">
                          <div className="fcStudyHint">Answer · rate how well you knew this</div>
                          <div className="fcStudyText">{reviewCard?.back}</div>
                        </div>
                      </div>
                    </div>

                    {/* Rating buttons — only show after flipping */}
                    {reviewFlipped ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
                        {QUALITY_BUTTONS.map(({ quality, label, hint, color }) => (
                          <button
                            key={quality}
                            onClick={() => submitReview(quality)}
                            style={{
                              padding: "10px 20px",
                              borderRadius: 12,
                              border: `1.5px solid ${color}50`,
                              background: `${color}12`,
                              color,
                              fontWeight: 900,
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 2,
                              minWidth: 70,
                            }}
                          >
                            <span>{label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>{hint}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", marginTop: 16, color: "rgba(58,30,16,0.45)", fontSize: 13, fontWeight: 700 }}>
                        Click the card to reveal the answer
                      </div>
                    )}
                  </div>
                )}
              </div>

            ) : mode === "study" ? (
              /* ── STUDY MODE (unchanged) ── */
              <div className="fcStudyWrap">
                <div className="cardHeaderRow">
                  <div>
                    <div className="cardTitle">Study mode</div>
                    <div className="planMeta">{activeDeck.name}</div>
                  </div>
                  <div className="fcRow">
                    <div className="fcPileChip fcPileChipKnown">
                      <Check size={11} /> {pileKnown.length}
                    </div>
                    <div className="fcPileChip fcPileChipUnknown">
                      <X size={11} /> {pileUnknown.length}
                    </div>
                    <button className="fcBtn fcBtnGhost" onClick={exitStudy}>Exit</button>
                  </div>
                </div>

                <div className="fcProgressTrack">
                  <div className="fcProgressFill" style={{ width: `${progressPct}%` }} />
                </div>

                {done ? (
                  <div className="fcDone">
                    <div className="continueTitle">All done</div>
                    <div className="continueMeta">
                      Known: <b>{pileKnown.length}</b> · Unsure: <b>{pileUnknown.length}</b>
                    </div>
                    <div className="fcRow" style={{ marginTop: 16, justifyContent: "center" }}>
                      <button
                        className="fcBtn fcBtnSage"
                        onClick={() => startStudy(unknownCards)}
                        disabled={pileUnknown.length === 0}
                        style={{ opacity: pileUnknown.length === 0 ? 0.5 : 1 }}
                      >
                        Study unsure pile
                      </button>
                      <button className="fcBtn fcBtnAccent" onClick={() => startStudy(cards)}>
                        Study all again
                      </button>
                      <button className="fcBtn" onClick={exitStudy}>Back to browse</button>
                    </div>
                  </div>
                ) : (
                  <div className="fcStudyStage">
                    <div
                      className="fcStudyCard"
                      onClick={flipCard}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); }
                        if (e.key === "1") pushToPile("unknown");
                        if (e.key === "2") pushToPile("known");
                      }}
                    >
                      <img src={booksMascot} className="fcMascotOnCard" alt="" draggable="false" />
                      <div className={`fcStudyInner ${isFlipped ? "isFlipped" : ""}`}>
                        <div className="fcStudyFace fcStudyFront">
                          <div className="fcStudyHint">Question · click to reveal</div>
                          <div className="fcStudyText">{currentCard?.front}</div>
                        </div>
                        <div className="fcStudyFace fcStudyBack">
                          <div className="fcStudyHint">Answer · click to flip back</div>
                          <div className="fcStudyText">{currentCard?.back}</div>
                        </div>
                      </div>
                    </div>

                    <div className="fcSortRow">
                      <button className="fcBtn fcBtnGhost" onClick={() => pushToPile("unknown")} title="Shortcut: 1">
                        <X size={14} /> I don't know this
                      </button>
                      <button className="fcBtn fcBtnSage" onClick={() => pushToPile("known")} title="Shortcut: 2">
                        <Check size={14} /> I know this
                      </button>
                    </div>

                    <div className="fcStudyCounter">
                      <span>{Math.min(studyIndex + 1, studyQueue.length)} / {studyQueue.length}</span>
                      <span className="planMeta" style={{ fontWeight: 800 }}>
                        Press 1 to skip · 2 to mark known
                      </span>
                    </div>
                  </div>
                )}
              </div>

            ) : (
              /* ── MANAGE MODE (unchanged) ── */
              <div>
                <div className="cardHeaderRow">
                  <div>
                    <div className="cardTitle">{activeDeck.name}</div>
                    <div className="planMeta">{cards.length} card{cards.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="fcRow">
                    <button
                      className="fcBtn fcBtnAccent"
                      onClick={() => startStudy(cards)}
                      disabled={cards.length === 0}
                      style={{ opacity: cards.length === 0 ? 0.45 : 1 }}
                    >
                      Study
                    </button>
                  </div>
                </div>

                <div className="fcList">
                  {filteredCards.length === 0 ? (
                    <div className="fcEmpty">
                      <div className="cardTitle">No cards found</div>
                      <div className="planMeta">Try a different search or choose another deck.</div>
                    </div>
                  ) : (
                    filteredCards.map((c) => (
                      <div key={c.id} className="fcListItem">
                        <div className="fcListText">
                          <div className="planTitle">{c.front}</div>
                          <div className="planMeta">{c.back}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}