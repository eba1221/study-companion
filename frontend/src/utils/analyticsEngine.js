// analyticsEngine.js
// Pure statistical ML — no external dependencies.
// Implements: weighted decay scoring, linear regression trajectory,
// adaptive study time recommendations using spaced repetition principles.

export const SUBJECT_MAP = { 1: "Biology", 2: "Chemistry", 3: "Physics" };

// ─── 1. DATA ENRICHMENT ────────────────────────────────────────────────────
// Joins attempts → quizzes → topics → subject name
export function enrichAttempts(attempts, quizzes, topics) {
  const quizMap = Object.fromEntries(quizzes.map(q => [q.id, q]));
  const topicMap = Object.fromEntries(topics.map(t => [t.id, t]));

  return attempts
    .map(a => {
      const quiz = quizMap[a.quiz_id];
      if (!quiz) return null;
      const topic = topicMap[quiz.topic_id];
      if (!topic) return null;
      const subject = SUBJECT_MAP[topic.subject_id] ?? "Other";
      const pct = a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0;
      return {
        ...a,
        quiz,
        topic,
        subject,
        topicName: topic.name,
        pct,
        date: new Date(a.completed_at),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

// ─── 2. EXPONENTIAL DECAY WEIGHTING ───────────────────────────────────────
// Recent attempts matter more. Half-life = 14 days.
// w(t) = e^(-λ * daysSince)   where λ = ln(2)/14
const HALF_LIFE_DAYS = 14;
const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;

function decayWeight(date) {
  const daysSince = (Date.now() - date.getTime()) / 86400000;
  return Math.exp(-LAMBDA * daysSince);
}

function weightedAvg(attempts) {
  if (!attempts.length) return null;
  let wSum = 0, wTotal = 0;
  for (const a of attempts) {
    const w = decayWeight(a.date);
    wSum += a.pct * w;
    wTotal += w;
  }
  return wTotal > 0 ? wSum / wTotal : null;
}

// ─── 3. LINEAR REGRESSION ─────────────────────────────────────────────────
// Used for score trajectory prediction.
// Returns { slope, intercept } where x = days since first attempt
function linearRegression(points) {
  // points: [{ x, y }]
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

// ─── 4. MAIN COMPUTE FUNCTION ─────────────────────────────────────────────
export function computeInsights(enriched) {
  if (!enriched.length) return null;

  const now = Date.now();
  const oneWeekMs = 7 * 24 * 3600 * 1000;

  // ── KPIs ──────────────────────────────────────────────────────────────
  const thisWeek = enriched.filter(a => now - a.date.getTime() < oneWeekMs);
  const lastWeek = enriched.filter(a => {
    const age = now - a.date.getTime();
    return age >= oneWeekMs && age < 2 * oneWeekMs;
  });

  const weeklyStudyTimeMins = Math.round(
    thisWeek.reduce((s, a) => s + (a.time_taken || 0), 0) / 60
  );

  const avgAcc = a =>
    a.length ? a.reduce((s, x) => s + x.pct, 0) / a.length : null;

  const thisAcc = avgAcc(thisWeek);
  const lastAcc = avgAcc(lastWeek);
  const trend =
    thisAcc !== null && lastAcc !== null
      ? Math.round(thisAcc - lastAcc)
      : null;

  const overallAccuracy = Math.round(
    enriched.reduce((s, a) => s + a.pct, 0) / enriched.length
  );

  // ── PER-TOPIC WEIGHTED SCORES ─────────────────────────────────────────
  const byTopic = {};
  for (const a of enriched) {
    const key = `${a.subject}|||${a.topicName}`;
    if (!byTopic[key]) byTopic[key] = { subject: a.subject, topicName: a.topicName, attempts: [] };
    byTopic[key].attempts.push(a);
  }

  const topicStats = Object.values(byTopic).map(({ subject, topicName, attempts }) => {
    const wScore = weightedAvg(attempts);
    const rawScore = attempts.reduce((s, a) => s + a.pct, 0) / attempts.length;
    const avgTime = attempts.reduce((s, a) => s + (a.time_taken || 0), 0) / attempts.length;
    const attemptCount = attempts.length;

    // Consistency score: std deviation of pct scores (lower = more consistent)
    const mean = rawScore;
    const stdDev = Math.sqrt(
      attempts.reduce((s, a) => s + (a.pct - mean) ** 2, 0) / attempts.length
    );

    return { subject, topicName, wScore, rawScore, avgTime, attemptCount, stdDev };
  });

  // ── PER-SUBJECT WEIGHTED SCORES ───────────────────────────────────────
  const bySubject = {};
  for (const a of enriched) {
    if (!bySubject[a.subject]) bySubject[a.subject] = [];
    bySubject[a.subject].push(a);
  }

  const subjectStats = Object.entries(bySubject).map(([subject, attempts]) => ({
    subject,
    wScore: Math.round(weightedAvg(attempts)),
    rawScore: Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length),
    attemptCount: attempts.length,
  }));

  // ── WEAK TOPICS (priority ranked) ────────────────────────────────────
  // Priority = low weighted score + high inconsistency + few attempts
  const weakTopics = topicStats
    .map(t => {
      // Normalise factors 0–1
      const scoreFactor = 1 - t.wScore / 100;           // low score → high priority
      const consistencyFactor = Math.min(t.stdDev / 50, 1); // high std dev → more uncertain
      const attemptFactor = Math.max(0, 1 - t.attemptCount / 5); // few attempts → needs more practice

      const priority = scoreFactor * 0.6 + consistencyFactor * 0.25 + attemptFactor * 0.15;

      const reason = buildWeakReason(t);
      return { ...t, priority, reason };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  // ── STUDY TIME RECOMMENDATIONS ────────────────────────────────────────
  // Based on score gap from target (75%) and avg time performance
  const TARGET = 75;
  const studyRecs = subjectStats.map(s => {
    const gap = Math.max(0, TARGET - s.wScore);
    // Base: 20 mins/day + 0.8 mins per % gap
    const mins = Math.round(20 + gap * 0.8);
    const reason = buildStudyReason(s, gap);
    return { subject: s.subject, minutesPerDay: mins, currentScore: s.wScore, gap, reason };
  }).sort((a, b) => b.gap - a.gap);

  // ── SCORE TRAJECTORY (6-week prediction) ─────────────────────────────
  const firstDate = enriched[0].date.getTime();
  const regressionPoints = enriched.map(a => ({
    x: (a.date.getTime() - firstDate) / 86400000, // days since first attempt
    y: a.pct,
  }));

  const reg = linearRegression(regressionPoints);
  const daysSinceStart = (now - firstDate) / 86400000;

  const trajectory = [];
  // Past: weekly buckets
  for (let w = -3; w <= 0; w++) {
    const day = daysSinceStart + w * 7;
    const predicted = reg
      ? Math.min(100, Math.max(0, reg.slope * day + reg.intercept))
      : overallAccuracy;
    trajectory.push({ week: w, predicted: Math.round(predicted), isPast: true });
  }
  // Future: 6 weeks ahead
  for (let w = 1; w <= 6; w++) {
    const day = daysSinceStart + w * 7;
    // Apply diminishing returns: harder to improve at higher scores
    let predicted = reg
      ? reg.slope * day + reg.intercept
      : overallAccuracy;
    predicted = applyDiminishingReturns(predicted, overallAccuracy);
    predicted = Math.min(98, Math.max(0, predicted));
    trajectory.push({ week: w, predicted: Math.round(predicted), isPast: false });
  }

  // ── STUDY TIME CHART (last 7 days) ────────────────────────────────────
  const studyChart = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date(now - d * oneWeekMs / 7);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayAttempts = enriched.filter(a => a.date >= dayStart && a.date < dayEnd);
    const mins = Math.round(dayAttempts.reduce((s, a) => s + (a.time_taken || 0), 0) / 60);
    studyChart.push({
      label: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
      mins,
    });
  }

  return {
    kpis: {
      weeklyStudyTimeMins,
      overallAccuracy,
      trend,
      thisAccuracy: thisAcc !== null ? Math.round(thisAcc) : overallAccuracy,
    },
    subjectStats,
    weakTopics,
    studyRecs,
    trajectory,
    studyChart,
  };
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function applyDiminishingReturns(predicted, current) {
  // Above 70%, each % point is harder to gain
  if (current > 70) {
    const excess = predicted - current;
    return current + excess * (1 - (current - 70) / 100);
  }
  return predicted;
}

function buildWeakReason({ wScore, stdDev, attemptCount, avgTime }) {
  if (wScore < 40) return "Very low accuracy — needs urgent focus.";
  if (stdDev > 25) return "Inconsistent results — concepts not fully secured.";
  if (attemptCount < 2) return "Not enough practice attempts yet.";
  if (avgTime < 20) return "Completing too quickly — may be guessing.";
  if (wScore < 60) return "Below target — regular revision recommended.";
  return "Close to target but room to improve.";
}

function buildStudyReason({ subject, wScore }, gap) {
  if (gap > 30) return `${subject} is significantly below the 75% target. Prioritise daily sessions.`;
  if (gap > 15) return `${subject} is developing but needs consistent practice to reach target.`;
  if (gap > 0) return `${subject} is close to target — maintenance sessions recommended.`;
  return `${subject} is at or above target. Keep it up with weekly review.`;
}