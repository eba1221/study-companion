// frontend/src/pages/FlashcardsPage.jsx

import "./Learn.css";
import "./FlashcardsPage.css";

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Home as HomeIcon, BookOpen, Settings, User, Check, X, Search } from "lucide-react";

import booksMascot from "../assets/Books.png";
import { getDecks, getCards, getSubjects, getTopicsBySubject } from "../api";

export default function FlashcardsPage() {
  const [decks, setDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [cards, setCards] = useState([]);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState("ALL");
  const [activeTopicId, setActiveTopicId] = useState("ALL");

  const [mode, setMode] = useState("manage");
  const [query, setQuery] = useState("");

  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [pileKnown, setPileKnown] = useState([]);
  const [pileUnknown, setPileUnknown] = useState([]);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load decks + subjects on mount
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

  const pushToPile = (which) => {
    if (!currentCard) return;
    const id = currentCard.id;
    if (which === "known") setPileKnown((p) => [...p, id]);
    if (which === "unknown") setPileUnknown((p) => [...p, id]);
    setIsFlipped(false);
    setStudyIndex((i) => Math.min(i + 1, studyQueue.length));
  };

  const exitStudy = () => { setMode("manage"); resetSessionState(); };

  const done = mode === "study" && (!currentCard || studyIndex >= studyQueue.length);
  const progressPct = studyQueue.length ? Math.round((studyIndex / studyQueue.length) * 100) : 0;
  const deckCount = filteredDecks.length;

  const unknownCards = useMemo(() => {
    const set = new Set(pileUnknown);
    return cards.filter((c) => set.has(c.id));
  }, [cards, pileUnknown]);

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
        <button className="navBtn" title="Settings" aria-label="Settings">
          <Settings className="navLucide" size={22} />
        </button>
        <button className="navBtn" title="Profile" aria-label="Profile">
          <User className="navLucide" size={22} />
        </button>
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
            {!activeDeck ? (
              <div className="fcEmpty">
                <div className="cardTitle">No deck selected</div>
                <div className="planMeta">Pick a deck from the left.</div>
              </div>
            ) : mode === "study" ? (
              <div className="fcStudyWrap">
                {/* Header */}
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

                {/* Progress */}
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
                    {/* Flip card */}
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

                    {/* Sort controls */}
                    <div className="fcSortRow">
                      <button className="fcBtn fcBtnGhost" onClick={() => pushToPile("unknown")} title="Shortcut: 1">
                        <X size={14} /> I don't know this
                      </button>
                      <button className="fcBtn fcBtnSage" onClick={() => pushToPile("known")} title="Shortcut: 2">
                        <Check size={14} /> I know this
                      </button>
                    </div>

                    {/* Counter */}
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