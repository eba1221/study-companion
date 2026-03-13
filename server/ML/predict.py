import os
"""
predict.py
==========
Flask microservice — GCSE Study Companion ML Prediction Server
==============================================================
Loads the trained Gradient Boosting model and exposes a single endpoint:

  POST /predict
  Body: { "attempts": [...], "quizzes": [...], "topics": [...] }

  Returns: {
    "weakTopics":  [{ topic, subject, priority, confidence, reason, studyMinsPerDay }],
    "trajectory":  [{ week, predictedScore, isPast }],
    "studyRecs":   [{ subject, minutesPerDay, reason }],
    "kpis":        { weeklyStudyTimeMins, overallAccuracy, trend }
  }

Run: python predict.py
     Starts on http://localhost:5001
"""

import pickle
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import math

app = Flask(__name__)
CORS(app)  # Allow requests from your React frontend

# ── Load trained model ─────────────────────────────────────────────────────
with open("model.pkl", "rb") as f:
    artifact = pickle.load(f)

MODEL           = artifact["model"]
SUBJECT_ENCODER = artifact["subject_encoder"]
FEATURE_COLS    = artifact["feature_cols"]

SUBJECT_MAP = {1: "Biology", 2: "Chemistry", 3: "Physics"}
TARGET_SCORE = 75
HALF_LIFE_DAYS = 14
LAMBDA = math.log(2) / HALF_LIFE_DAYS


# ── HELPERS ────────────────────────────────────────────────────────────────

def decay_weight(date_obj):
    days_since = (datetime.now() - date_obj).days
    return math.exp(-LAMBDA * max(days_since, 0))


def enrich(attempts, quizzes, topics):
    """Join attempts → quizzes → topics → subject name."""
    quiz_map  = {q["id"]: q for q in quizzes}
    topic_map = {t["id"]: t for t in topics}
    enriched  = []

    for a in attempts:
        quiz  = quiz_map.get(a["quiz_id"])
        if not quiz:
            continue
        topic = topic_map.get(quiz["topic_id"])
        if not topic:
            continue
        subject = SUBJECT_MAP.get(topic["subject_id"], "Other")
        total_q = a.get("total_questions", 1) or 1
        pct     = (a["score"] / total_q) * 100
        try:
            date = datetime.strptime(a["completed_at"], "%Y-%m-%d %H:%M:%S")
        except Exception:
            date = datetime.now()

        enriched.append({
            **a,
            "subject":    subject,
            "topic_name": topic["name"],
            "topic_id":   topic["id"],
            "subject_id": topic["subject_id"],
            "pct":        pct,
            "date":       date,
        })

    return sorted(enriched, key=lambda x: x["date"])


def build_topic_features(attempts_for_topic, subject):
    """
    Engineer the exact same features used during training.
    Returns a dict of feature values.
    """
    scores    = [a["pct"] for a in attempts_for_topic]
    times     = [a.get("time_taken", 120) for a in attempts_for_topic]
    total_qs  = [a.get("total_questions", 10) for a in attempts_for_topic]
    dates     = [a["date"] for a in attempts_for_topic]
    n         = len(scores)

    # Weighted score (exponential decay)
    weights       = [decay_weight(d) for d in dates]
    weighted_score = np.average(scores, weights=weights) if weights else np.mean(scores)

    # Time per question
    avg_time   = np.mean(times)
    avg_total_q = np.mean(total_qs) or 10
    time_per_q  = avg_time / avg_total_q

    score_std   = float(np.std(scores)) if n > 1 else 0.0
    score_trend = scores[-1] - scores[0] if n > 1 else 0.0

    # Encode subject safely
    try:
        subject_encoded = int(SUBJECT_ENCODER.transform([subject])[0])
    except Exception:
        subject_encoded = 0

    return {
        "latest_score":    scores[-1],
        "mean_score":      float(np.mean(scores)),
        "min_score":       float(np.min(scores)),
        "score_std":       score_std,
        "score_trend":     score_trend,
        "weighted_score":  float(weighted_score),
        "time_per_q":      float(time_per_q),
        "attempts_count":  n,
        "score_gap":       max(0, TARGET_SCORE - weighted_score),
        "is_below_target": int(weighted_score < TARGET_SCORE),
        "is_inconsistent": int(score_std > 15),
        "is_fast":         int(time_per_q < 8),
        "subject_encoded": subject_encoded,
        # Keep for response (not model input)
        "_weighted_score": float(weighted_score),
        "_score_std":      score_std,
        "_attempts":       n,
        "_time_per_q":     float(time_per_q),
    }


def predict_priority(features):
    """Run model inference. Returns (label, confidence_dict)."""
    row = pd.DataFrame([{k: features[k] for k in FEATURE_COLS}])
    label      = MODEL.predict(row)[0]
    proba      = MODEL.predict_proba(row)[0]
    classes    = MODEL.classes_
    confidence = {c: round(float(p), 3) for c, p in zip(classes, proba)}
    return label, confidence


def build_reason(features, label):
    ws  = features["_weighted_score"]
    std = features["_score_std"]
    n   = features["_attempts"]
    tpq = features["_time_per_q"]

    if label == "urgent":
        if ws < 40:
            return f"Very low accuracy ({ws:.0f}%) — this topic needs immediate daily attention."
        return f"Highly inconsistent results (±{std:.0f}%) — core concepts are not secured."
    if label == "high":
        if n < 2:
            return "Too few attempts to establish a reliable score — practise more."
        return f"Below target at {ws:.0f}% — consistent revision sessions recommended."
    if label == "medium":
        if tpq < 8:
            return f"Completing questions quickly ({tpq:.0f}s/q) — may be guessing. Slow down and review."
        return f"Approaching target ({ws:.0f}%) — a few focused sessions will push you over."
    return f"Above target ({ws:.0f}%) — maintain with weekly review quizzes."


def compute_kpis(enriched):
    now = datetime.now()
    one_week  = timedelta(days=7)
    two_weeks = timedelta(days=14)

    this_week = [a for a in enriched if (now - a["date"]) <= one_week]
    last_week = [a for a in enriched if one_week < (now - a["date"]) <= two_weeks]

    weekly_study_mins = round(sum(a.get("time_taken", 0) for a in this_week) / 60)
    overall_acc = round(np.mean([a["pct"] for a in enriched])) if enriched else 0

    this_acc = np.mean([a["pct"] for a in this_week]) if this_week else None
    last_acc = np.mean([a["pct"] for a in last_week]) if last_week else None
    trend = round(this_acc - last_acc) if (this_acc is not None and last_acc is not None) else None

    return {
        "weeklyStudyTimeMins": weekly_study_mins,
        "overallAccuracy":     overall_acc,
        "thisAccuracy":        round(this_acc) if this_acc is not None else overall_acc,
        "trend":               trend,
    }


def compute_trajectory(enriched):
    """Linear regression over all attempts → 6-week forward projection."""
    if len(enriched) < 2:
        base = enriched[0]["pct"] if enriched else 60
        result = []
        for w in range(-3, 7):
            result.append({"week": w, "predictedScore": round(base), "isPast": w <= 0})
        return result

    first_date = enriched[0]["date"]
    points     = [(((a["date"] - first_date).days), a["pct"]) for a in enriched]
    xs = np.array([p[0] for p in points], dtype=float)
    ys = np.array([p[1] for p in points], dtype=float)

    # Ordinary least squares
    xm, ym = xs.mean(), ys.mean()
    slope   = np.sum((xs - xm) * (ys - ym)) / (np.sum((xs - xm) ** 2) + 1e-9)
    intercept = ym - slope * xm

    days_now = (datetime.now() - first_date).days
    result   = []

    for w in range(-3, 7):
        day = days_now + w * 7
        pred = slope * day + intercept
        # Diminishing returns above 70%
        if pred > 70:
            excess = pred - 70
            pred   = 70 + excess * (1 - (min(pred, 98) - 70) / 100)
        pred = float(np.clip(pred, 0, 98))
        result.append({"week": w, "predictedScore": round(pred), "isPast": w <= 0})

    return result


def compute_study_recs(subject_stats):
    recs = []
    for subj, ws in subject_stats.items():
        gap  = max(0, TARGET_SCORE - ws)
        mins = round(20 + gap * 0.8)
        if gap > 30:
            reason = f"{subj} is significantly below target. Prioritise daily sessions."
        elif gap > 15:
            reason = f"{subj} needs consistent practice to reach the 75% target."
        elif gap > 0:
            reason = f"{subj} is close — maintenance sessions will get you there."
        else:
            reason = f"{subj} is at or above target. Keep it up with weekly reviews."
        recs.append({"subject": subj, "minutesPerDay": mins, "currentScore": round(ws), "reason": reason})
    return sorted(recs, key=lambda r: -r["minutesPerDay"])


# ── ENDPOINT ───────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    try:
        body     = request.get_json()
        attempts = body.get("attempts", [])
        quizzes  = body.get("quizzes",  [])
        topics   = body.get("topics",   [])

        if not attempts:
            return jsonify({"error": "No attempts provided"}), 400

        enriched = enrich(attempts, quizzes, topics)
        if not enriched:
            return jsonify({"error": "Could not enrich attempts — check quiz/topic data"}), 400

        # ── Group by topic ────────────────────────────────────────────────
        by_topic = {}
        for a in enriched:
            key = (a["subject"], a["topic_name"])
            by_topic.setdefault(key, []).append(a)

        # ── Run model per topic ───────────────────────────────────────────
        weak_topics = []
        for (subject, topic_name), topic_attempts in by_topic.items():
            features         = build_topic_features(topic_attempts, subject)
            label, confidence = predict_priority(features)
            reason           = build_reason(features, label)

            weak_topics.append({
                "topic":         topic_name,
                "subject":       subject,
                "priority":      label,
                "confidence":    confidence,
                "weightedScore": round(features["_weighted_score"], 1),
                "attempts":      features["_attempts"],
                "reason":        reason,
            })

        # Sort: urgent → high → medium → low, then by weighted score asc
        order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        weak_topics.sort(key=lambda t: (order[t["priority"]], t["weightedScore"]))

        # ── Subject-level weighted scores ─────────────────────────────────
        by_subject = {}
        for a in enriched:
            by_subject.setdefault(a["subject"], []).append(a)

        subject_stats = {}
        for subj, subj_attempts in by_subject.items():
            weights = [decay_weight(a["date"]) for a in subj_attempts]
            subject_stats[subj] = float(np.average([a["pct"] for a in subj_attempts], weights=weights))

        return jsonify({
            "weakTopics":  weak_topics,
            "subjectStats": [
                {"subject": s, "wScore": round(ws)} for s, ws in subject_stats.items()
            ],
            "trajectory":  compute_trajectory(enriched),
            "studyRecs":   compute_study_recs(subject_stats),
            "kpis":        compute_kpis(enriched),
        })

    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "GradientBoostingClassifier"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"🚀 ML prediction server running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)