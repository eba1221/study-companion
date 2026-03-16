"""
train.py
========
GCSE Science Study Companion — ML Pipeline
==========================================
1. Generates a synthetic dataset of 2000 simulated GCSE students
2. Engineers features from quiz attempt patterns
3. Trains a Gradient Boosting Classifier (scikit-learn)
4. Saves the trained model to model.pkl

Run once:  python train.py
Re-run whenever you want to retrain with new data patterns.
"""

import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

np.random.seed(42)

# ── SUBJECT / TOPIC DEFINITIONS ────────────────────────────────────────────
TOPICS = {
    "Biology": [
        "Cell Biology", "Organisation", "Infection and Response",
        "Bioenergetics", "Homeostasis and Response",
        "Inheritance, Variation and Evolution", "Ecology",
    ],
    "Chemistry": [
        "Atomic Structure and the Periodic Table",
        "Bonding, Structure, and Properties of Matter",
        "Quantitative Chemistry", "Chemical Changes", "Energy Changes",
        "Rate and Extent of Chemical Change", "Organic Chemistry",
        "Chemical Analysis", "Chemistry of the Atmosphere", "Using Resources",
    ],
    "Physics": [
        "Forces", "Energy", "Waves", "Electricity",
        "Magnetism and Electromagnetism", "Particle Model of Matter",
        "Atomic Structure", "Space Physics",
    ],
}

ALL_TOPICS = [(subj, topic) for subj, topics in TOPICS.items() for topic in topics]

# Priority labels — what we are predicting
PRIORITY_LABELS = ["urgent", "high", "medium", "low"]

# ── SYNTHETIC DATA GENERATION ──────────────────────────────────────────────
def generate_student_topic_data(n_students=2000):
    """
    Simulate realistic GCSE student quiz attempt patterns.
    Each row = one student × one topic combination.
    Features are engineered the same way as the real pipeline.
    """
    rows = []

    for student_id in range(n_students):
        # Each student has a baseline ability (normally distributed)
        baseline_ability = np.random.normal(65, 15)
        baseline_ability = np.clip(baseline_ability, 10, 99)

        # Study consistency trait (0=very inconsistent, 1=very consistent)
        consistency_trait = np.random.beta(2, 2)

        # Speed trait (affects time_taken)
        speed_trait = np.random.normal(1.0, 0.3)
        speed_trait = max(0.4, speed_trait)

        for subject, topic in ALL_TOPICS:
            # Topic difficulty modifier
            difficulty = np.random.uniform(0.7, 1.3)

            # How many attempts has the student done on this topic?
            n_attempts = np.random.choice([0, 1, 2, 3, 4, 5], p=[0.1, 0.25, 0.3, 0.2, 0.1, 0.05])
            if n_attempts == 0:
                continue

            # Simulate scores across attempts (improving over time)
            scores = []
            for i in range(n_attempts):
                improvement = i * np.random.uniform(1, 4)  # learning curve
                noise = np.random.normal(0, 10 * (1 - consistency_trait))
                score = (baseline_ability / difficulty) + improvement + noise
                score = np.clip(score, 0, 100)
                scores.append(score)

            # Simulate time taken per attempt (seconds, 20q quiz = ~120–300s typical)
            avg_time = np.random.normal(180 / speed_trait, 40)
            avg_time = max(30, avg_time)

            # ── Feature engineering ────────────────────────────────────────
            latest_score     = scores[-1]
            mean_score       = np.mean(scores)
            min_score        = np.min(scores)
            score_std        = np.std(scores) if len(scores) > 1 else 0
            score_trend      = (scores[-1] - scores[0]) if len(scores) > 1 else 0
            # Exponential decay weighted score (λ = ln2/14)
            weights = [np.exp(-0.0495 * (n_attempts - 1 - i)) for i in range(n_attempts)]
            weighted_score   = np.average(scores, weights=weights)
            time_per_q       = avg_time / 10  # assuming 10q quiz
            attempts_count   = n_attempts
            score_gap        = max(0, 75 - weighted_score)  # gap to 75% target
            is_below_target  = int(weighted_score < 75)
            is_inconsistent  = int(score_std > 15)
            is_fast          = int(time_per_q < 8)  # <8s/q = likely guessing

            # ── Label assignment ───────────────────────────────────────────
            # Priority = function of weighted score, consistency, attempts
            if weighted_score < 45 or (weighted_score < 55 and score_std > 20):
                label = "urgent"
            elif weighted_score < 60 or (weighted_score < 65 and is_inconsistent):
                label = "high"
            elif weighted_score < 75:
                label = "medium"
            else:
                label = "low"

            rows.append({
                "subject":         subject,
                "latest_score":    latest_score,
                "mean_score":      mean_score,
                "min_score":       min_score,
                "score_std":       score_std,
                "score_trend":     score_trend,
                "weighted_score":  weighted_score,
                "time_per_q":      time_per_q,
                "attempts_count":  attempts_count,
                "score_gap":       score_gap,
                "is_below_target": is_below_target,
                "is_inconsistent": is_inconsistent,
                "is_fast":         is_fast,
                "label":           label,
            })

    return pd.DataFrame(rows)


# ── FEATURE ENGINEERING ────────────────────────────────────────────────────
FEATURE_COLS = [
    "latest_score", "mean_score", "min_score", "score_std",
    "score_trend", "weighted_score", "time_per_q", "attempts_count",
    "score_gap", "is_below_target", "is_inconsistent", "is_fast",
    "subject_encoded",
]

def encode_features(df):
    le = LabelEncoder()
    df = df.copy()
    df["subject_encoded"] = le.fit_transform(df["subject"])
    return df, le


# ── TRAINING ───────────────────────────────────────────────────────────────
def train():
    print("🔧 Generating synthetic dataset...")
    df = generate_student_topic_data(n_students=2000)
    print(f"   {len(df)} student-topic rows generated.")
    print(f"   Label distribution:\n{df['label'].value_counts()}\n")

    df, subject_encoder = encode_features(df)

    X = df[FEATURE_COLS]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("🤖 Training Gradient Boosting Classifier...")
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=80,
            learning_rate=0.1,
            max_depth=4,
            min_samples_leaf=10,
            subsample=0.85,
            random_state=42,
        )),
    ])

    model.fit(X_train, y_train)

    print("\n🔁 5-Fold Stratified Cross-Validation:")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=cv, scoring="f1_weighted")
    print(f"   F1 (weighted) per fold: {[round(s,3) for s in cv_scores]}")
    print(f"   Mean F1: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    print("\n📊 Evaluation on held-out test set:")
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    # Save model + encoder together
    artifact = {
        "model": model,
        "subject_encoder": subject_encoder,
        "feature_cols": FEATURE_COLS,
        "label_order": PRIORITY_LABELS,
    }

    with open("model.pkl", "wb") as f:
        pickle.dump(artifact, f)

    print("✅ Model saved to model.pkl")
    print("   Now run: python predict.py  (to start the prediction server)")


if __name__ == "__main__":
    train()