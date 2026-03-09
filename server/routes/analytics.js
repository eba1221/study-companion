// server/routes/analytics.js
// Express route — proxies ML prediction requests to the Flask server.
// Mount in server.js with: app.use("/api/analytics", require("./routes/analytics"));

const express = require("express");
const router  = express.Router();

const ML_SERVER = process.env.ML_SERVER_URL || "http://localhost:5001";

/**
 * POST /api/analytics/predict
 * Fetches quiz attempts, quizzes and topics from your DB,
 * sends them to the Flask ML server, and returns predictions.
 */
router.post("/predict", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    // ── Pull data from your existing DB ──────────────────────────────────
    // Replace `db` with however you query your database
    // e.g. knex, pg, mysql2, sequelize — just match your existing pattern
    const db = req.app.get("db"); // assumes you do app.set("db", yourDbInstance)

    const [attempts, quizzes, topics] = await Promise.all([
      db.query(
        `SELECT id, quiz_id, user_id, score, total_questions, time_taken, completed_at
         FROM quiz_attempts WHERE user_id = ?`,
        [user_id]
      ),
      db.query(
        `SELECT id, user_id, topic_id, tier, title FROM quizzes`
      ),
      db.query(
        `SELECT id, subject_id, name FROM topics`
      ),
    ]);

    // Normalise result shape (handles both mysql2 [rows] and knex plain arrays)
    const normalise = r => (Array.isArray(r[0]) ? r[0] : r);

    const payload = {
      attempts: normalise(attempts).map(a => ({
        ...a,
        completed_at: a.completed_at instanceof Date
          ? a.completed_at.toISOString().slice(0, 19).replace("T", " ")
          : a.completed_at,
      })),
      quizzes: normalise(quizzes),
      topics:  normalise(topics),
    };

    // ── Call Flask ML server ──────────────────────────────────────────────
    const mlRes = await fetch(`${ML_SERVER}/predict`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!mlRes.ok) {
      const err = await mlRes.json();
      return res.status(502).json({ error: "ML server error", detail: err });
    }

    const predictions = await mlRes.json();
    return res.json(predictions);

  } catch (err) {
    console.error("[analytics/predict]", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/analytics/health
 * Quick check that the ML server is reachable.
 */
router.get("/health", async (req, res) => {
  try {
    const r = await fetch(`${ML_SERVER}/health`);
    const body = await r.json();
    res.json({ express: "ok", flask: body });
  } catch {
    res.status(503).json({ express: "ok", flask: "unreachable" });
  }
});

module.exports = router;