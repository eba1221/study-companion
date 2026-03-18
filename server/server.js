import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

console.log("Anthropic key loaded:", !!process.env.ANTHROPIC_API_KEY);

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

const pool = await mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------- Health ----------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/db-health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- Dev seed user ----------------
try {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, display_name)
     VALUES (1, 'test@test.com', 'dev_placeholder', 'Test User')
     ON DUPLICATE KEY UPDATE id=id`
  );
  console.log("Dev seed: user id=1 is ready");
} catch (err) {
  console.warn("Dev seed skipped:", err.message);
}

// ---------------- Middleware ----------------
function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing or invalid token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.user = { id: decoded.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------------- Auth ----------------

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: "An account with this email already exists" });

    const hash = await bcrypt.hash(password, 12);
    const displayName = name?.trim() || email.split("@")[0];

    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
      [email, hash, displayName]
    );

    const user = { id: result.insertId, email, display_name: displayName };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ---------------- Flashcards ----------------

app.get("/api/decks", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.user_id, d.topic_id, d.name, d.created_at, d.updated_at, t.subject_id
       FROM decks d
       LEFT JOIN topics t ON t.id = d.topic_id
       ORDER BY d.id DESC`
    );
    console.log("DECKS ROUTE HIT. First row:", rows?.[0]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/decks failed:", err);
    res.status(500).json({ error: "Failed to load decks" });
  }
});

app.post("/api/decks", requireUser, async (req, res) => {
  try {
    const { name, topic_id } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ error: "Deck name is required" });

    const topicId =
      topic_id === undefined || topic_id === null || String(topic_id) === ""
        ? null : Number(topic_id);

    const [result] = await pool.query(
      `INSERT INTO decks (user_id, topic_id, name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
      [req.userId, topicId, String(name).trim()]
    );

    const [rows] = await pool.query(
      `SELECT d.id, d.user_id, d.topic_id, d.name, d.created_at, d.updated_at, t.subject_id
       FROM decks d LEFT JOIN topics t ON t.id = d.topic_id WHERE d.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/decks failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/decks/:id", requireUser, async (req, res) => {
  try {
    const deckId = Number(req.params.id);
    const { name, topic_id } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ error: "Deck name is required" });

    const topicId =
      topic_id === undefined || topic_id === null || String(topic_id) === ""
        ? null : Number(topic_id);

    await pool.query(
      `UPDATE decks SET name = ?, topic_id = ?, updated_at = NOW() WHERE id = ?`,
      [String(name).trim(), topicId, deckId]
    );

    const [rows] = await pool.query(
      `SELECT d.id, d.user_id, d.topic_id, d.name, d.created_at, d.updated_at, t.subject_id
       FROM decks d LEFT JOIN topics t ON t.id = d.topic_id WHERE d.id = ?`,
      [deckId]
    );
    if (!rows.length) return res.status(404).json({ error: "Deck not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /api/decks/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/decks/:id", requireUser, async (req, res) => {
  try {
    await pool.query("DELETE FROM decks WHERE id = ?", [Number(req.params.id)]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/decks/:deckId/cards", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.front, c.back, c.created_at FROM cards c
       WHERE c.deck_id = ? ORDER BY c.created_at ASC`,
      [Number(req.params.deckId)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Notes ----------------

app.get("/api/subjects", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM subjects ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

app.get("/api/subjects/:subjectId/topics", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM topics WHERE subject_id = ? ORDER BY name ASC",
      [Number(req.params.subjectId)]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET topics failed:", err);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

app.get("/api/topics/:topicId/spec-points", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.id, sp.spec_code AS code, sp.statement AS description, sp.tier, sp.position
       FROM spec_points sp JOIN subtopics st ON st.id = sp.subtopic_id
       WHERE st.topic_id = ? ORDER BY sp.position ASC, sp.spec_code ASC`,
      [Number(req.params.topicId)]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET spec points failed:", err);
    res.status(500).json({ error: "Failed to fetch spec points" });
  }
});

app.get("/api/notes", requireUser, async (req, res) => {
  try {
    const { topic_id, spec_point_id, tier, status } = req.query;
    if (!topic_id) return res.status(400).json({ error: "topic_id is required" });

    const where = ["topic_id = ?", "(user_id = ? OR user_id IS NULL)"];
    const params = [Number(topic_id), req.userId];

    if (spec_point_id) { where.push("spec_point_id = ?"); params.push(Number(spec_point_id)); }
    if (tier && String(tier) !== "BOTH") { where.push("(tier = ? OR tier = 'BOTH')"); params.push(String(tier)); }
    if (status) { where.push("status = ?"); params.push(String(status)); }

    const [rows] = await pool.query(
      `SELECT id, topic_id, spec_point_id, title, content, tier, status, version, created_at, updated_at
       FROM notes WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/notes failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notes", requireUser, async (req, res) => {
  try {
    const { topic_id, spec_point_id, title, content, tier, status } = req.body;
    if (!topic_id) return res.status(400).json({ error: "topic_id is required" });
    if (!title || !String(title).trim()) return res.status(400).json({ error: "title is required" });

    const [result] = await pool.query(
      `INSERT INTO notes (user_id, topic_id, spec_point_id, title, content, tier, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [req.userId, Number(topic_id), spec_point_id ? Number(spec_point_id) : null,
       String(title).trim(), content ?? "", tier ?? "BOTH", status ?? "DRAFT"]
    );

    const [rows] = await pool.query(
      `SELECT id, topic_id, spec_point_id, title, content, tier, status, version, created_at, updated_at
       FROM notes WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/notes failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/notes/:id", requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, content, tier, status } = req.body;

    await pool.query(
      `UPDATE notes SET title = ?, content = ?, tier = ?, status = ?, version = version + 1, updated_at = NOW()
       WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      [title ?? "", content ?? "", tier ?? "BOTH", status ?? "DRAFT", id, req.userId]
    );

    const [rows] = await pool.query(
      `SELECT id, topic_id, spec_point_id, title, content, tier, status, version, created_at, updated_at
       FROM notes WHERE id = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /api/notes/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/notes/:id", requireUser, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notes WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      [Number(req.params.id), req.userId]
    );
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/notes/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================================
// QUIZ ENDPOINTS
// ================================================================================

app.post("/api/quiz/generate", requireUser, async (req, res) => {
  const { topicId, tier } = req.body;

  if (!topicId || !tier)
    return res.status(400).json({ error: "Missing topicId or tier" });
  if (!["foundation", "higher"].includes(tier))
    return res.status(400).json({ error: "Invalid tier (must be foundation or higher)" });

  try {
    const [topicRows] = await pool.query(
      `SELECT t.name as topic_name, s.name as subject_name
       FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE t.id = ?`,
      [topicId]
    );
    if (topicRows.length === 0)
      return res.status(404).json({ error: "Topic not found" });

    const { topic_name, subject_name } = topicRows[0];

    const [cardRows] = await pool.query(
      `SELECT c.front, c.back FROM cards c JOIN decks d ON c.deck_id = d.id
       WHERE d.topic_id = ? LIMIT 50`,
      [topicId]
    );
    if (cardRows.length === 0)
      return res.status(404).json({ error: "No flashcards found for this topic. Add some flashcards first!" });

    const flashcardContext = cardRows.map(card => `Q: ${card.front}\nA: ${card.back}`).join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a GCSE ${subject_name} exam question generator. Generate 10 multiple-choice questions for the topic "${topic_name}" at ${tier} tier difficulty.

CONTEXT (flashcard content for this topic):
${flashcardContext}

REQUIREMENTS:
- Generate EXACTLY 10 questions
- Each question must have 4 options (A, B, C, D)
- Only ONE correct answer per question
- ${tier === "foundation" ? "Foundation tier: Focus on basic recall, definitions, and simple application." : "Higher tier: Include challenging multi-step problems and deeper understanding."}
- Questions should cover different aspects of the topic
- Include a brief explanation for the correct answer
- Use GCSE exam style and terminology

OUTPUT FORMAT - respond with ONLY valid JSON, no markdown, no backticks, no extra text:
{
  "questions": [
    {
      "question": "What is photosynthesis?",
      "options": { "A": "Respiration in plants", "B": "Process where plants make glucose using light energy", "C": "Breaking down of glucose", "D": "Water absorption by roots" },
      "correct_answer": "B",
      "explanation": "Photosynthesis is the process where plants use light energy to convert CO2 and water into glucose and oxygen."
    }
  ]
}`
      }]
    });

    let quizData;
    try {
      const text = message.content[0].text;
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      quizData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", message.content[0].text);
      return res.status(500).json({ error: "Failed to parse quiz data from AI" });
    }

    if (!quizData.questions || quizData.questions.length !== 10)
      return res.status(500).json({ error: "AI did not generate exactly 10 questions" });

    const quizTitle = `${topic_name} - ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Quiz`;

    const [quizResult] = await pool.query(
      "INSERT INTO quizzes (user_id, topic_id, tier, title) VALUES (?, ?, ?, ?)",
      [req.userId, topicId, tier, quizTitle]
    );
    const quizId = quizResult.insertId;

    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.question, q.options.A, q.options.B, q.options.C, q.options.D, q.correct_answer, q.explanation || "", i + 1]
      );
    }

    res.json({ quizId, title: quizTitle, message: "Quiz generated successfully" });
  } catch (error) {
    console.error("Quiz generation error:", error);
    res.status(500).json({ error: "Failed to generate quiz", detail: error.message });
  }
});

app.get("/api/quiz/:quizId", requireUser, async (req, res) => {
  const { quizId } = req.params;
  try {
    const [quizRows] = await pool.query(
      `SELECT q.*, t.name as topic_name, s.name as subject_name
       FROM quizzes q JOIN topics t ON q.topic_id = t.id JOIN subjects s ON t.subject_id = s.id
       WHERE q.id = ?`,
      [quizId]
    );
    if (quizRows.length === 0)
      return res.status(404).json({ error: "Quiz not found" });

    const [questions] = await pool.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, position
       FROM quiz_questions WHERE quiz_id = ? ORDER BY position`,
      [quizId]
    );
    res.json({ quiz: quizRows[0], questions });
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});

app.post("/api/quiz/:quizId/submit", requireUser, async (req, res) => {
  const { quizId } = req.params;
  const { answers, timeTaken } = req.body;

  try {
    const [questions] = await pool.query(
      "SELECT id, correct_answer, explanation FROM quiz_questions WHERE quiz_id = ?",
      [quizId]
    );

    let score = 0;
    const results = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      if (isCorrect) score++;
      results.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        explanation: question.explanation,
      });
    }

    const [attemptResult] = await pool.query(
      "INSERT INTO quiz_attempts (quiz_id, user_id, score, total_questions, time_taken) VALUES (?, ?, ?, ?, ?)",
      [quizId, req.userId, score, questions.length, timeTaken]
    );
    const attemptId = attemptResult.insertId;

    for (const result of results) {
      await pool.query(
        "INSERT INTO quiz_user_answers (attempt_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?)",
        [attemptId, result.questionId, result.userAnswer, result.isCorrect]
      );
    }

    res.json({
      attemptId,
      score,
      totalQuestions: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      results,
    });
  } catch (error) {
    console.error("Submit quiz error:", error);
    res.status(500).json({ error: "Failed to submit quiz" });
  }
});

// /api/quiz/history/me — uses JWT user, no hardcoded ID needed
app.get("/api/quiz/history/me", requireUser, async (req, res) => {
  try {
    const [attempts] = await pool.query(
      `SELECT qa.id, qa.score, qa.total_questions, qa.time_taken, qa.completed_at,
              q.title, q.tier, t.name as topic_name, s.name as subject_name
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN topics t ON q.topic_id = t.id
       JOIN subjects s ON t.subject_id = s.id
       WHERE qa.user_id = ?
       ORDER BY qa.completed_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ attempts });
  } catch (error) {
    console.error("Get history/me error:", error);
    res.status(500).json({ error: "Failed to fetch quiz history" });
  }
});

// Keep old route for backwards compatibility
app.get("/api/quiz/history/:userId", requireUser, async (req, res) => {
  try {
    const [attempts] = await pool.query(
      `SELECT qa.id, qa.score, qa.total_questions, qa.time_taken, qa.completed_at,
              q.title, q.tier, t.name as topic_name, s.name as subject_name
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN topics t ON q.topic_id = t.id
       JOIN subjects s ON t.subject_id = s.id
       WHERE qa.user_id = ?
       ORDER BY qa.completed_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ attempts });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to fetch quiz history" });
  }
});

// ================================================================================
// ANALYTICS — ML PREDICTIONS (proxies to Flask ML server on port 5001)
// ================================================================================

const ML_SERVER = process.env.ML_SERVER_URL || "https://ml-production-7ceb.up.railway.app";

app.post("/api/analytics/predict", requireUser, async (req, res) => {
  try {
    const userId = req.userId;

    const [attempts, quizzes, topics] = await Promise.all([
      pool.query(
        `SELECT id, quiz_id, user_id, score, total_questions, time_taken,
                DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i:%s') as completed_at
         FROM quiz_attempts WHERE user_id = ?`,
        [userId]
      ),
      pool.query(`SELECT id, user_id, topic_id, tier, title FROM quizzes`),
      pool.query(`SELECT id, subject_id, name FROM topics`),
    ]);

    const payload = {
      attempts: attempts[0],
      quizzes:  quizzes[0],
      topics:   topics[0],
    };

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

    const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const now = new Date();
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = yyyy + "-" + mm + "-" + dd;
      const dayLabel = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
      chartDays.push({ label: dayLabel + " " + d.getDate(), mins: 0, key });
    }
    (attempts[0] || []).forEach(a => {
      const dateStr = String(a.completed_at).slice(0, 10);
      const entry = chartDays.find(c => c.key === dateStr);
      if (entry) entry.mins += Math.round((a.time_taken || 0) / 60);
    });
    predictions.studyChart = chartDays.map(({ label, mins }) => ({ label, mins }));

    res.json(predictions);
  } catch (err) {
    console.error("[analytics/predict]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analytics/health", async (req, res) => {
  try {
    const r = await fetch(`${ML_SERVER}/health`);
    const body = await r.json();
    res.json({ express: "ok", flask: body });
  } catch {
    res.status(503).json({ express: "ok", flask: "unreachable — is predict.py running?" });
  }
});

// ── Update display name ──────────────────────────────────────────────────
app.patch("/api/users/:id", requireUser, async (req, res) => {
  try {
    const { display_name } = req.body;
    if (!display_name?.trim())
      return res.status(400).json({ error: "Display name required" });

    await pool.query(
      "UPDATE users SET display_name = ? WHERE id = ?",
      [display_name.trim(), req.userId]
    );
    res.json({ ok: true, display_name: display_name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change password ──────────────────────────────────────────────────────
app.patch("/api/users/:id/password", requireUser, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: "Both passwords required" });
    if (new_password.length < 8)
      return res.status(400).json({ error: "New password must be 8+ characters" });

    const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.userId]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Incorrect current password" });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================================
// Global error handler (keep last)
// ================================================================================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

// ================================================================================
// SPACED REPETITION (SM-2 Algorithm)
// ================================================================================

// Get all cards due for review today
app.get("/api/review/due", requireUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.front, c.back, d.name as deck_name,
              cr.easiness,
              cr.interval_days,
              cr.repetitions,
              cr.next_review
       FROM card_reviews cr
      JOIN cards c ON c.id = cr.card_id
      JOIN decks d ON c.deck_id = d.id
      WHERE cr.user_id = ? AND cr.next_review <= CURDATE()
      ORDER BY cr.next_review ASC
      LIMIT 20`,
      [req.userId]
    );
    res.json(rows);  
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a review for a card (quality 0-5)
app.post("/api/review/:cardId", requireUser, async (req, res) => {
  const { quality } = req.body;

  if (quality === undefined || quality < 0 || quality > 5)
    return res.status(400).json({ error: "Quality must be 0-5" });

  try {
    // Get existing review record for this user+card
    const [rows] = await pool.query(
      `SELECT * FROM card_reviews WHERE card_id = ? AND user_id = ?`,
      [req.params.cardId, req.userId]
    );

    let easiness = 2.5;
    let interval_days = 1;
    let repetitions = 0;

    if (rows.length) {
      easiness = rows[0].easiness;
      interval_days = rows[0].interval_days;
      repetitions = rows[0].repetitions;
    }

    // SM-2 Algorithm
    if (quality < 3) {
      repetitions = 0;
      interval_days = 1;
    } else {
      if (repetitions === 0) interval_days = 1;
      else if (repetitions === 1) interval_days = 6;
      else interval_days = Math.round(interval_days * easiness);
      repetitions += 1;
    }

    // Update easiness factor
    easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easiness < 1.3) easiness = 1.3;

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval_days);
    const nextReviewStr = nextReview.toISOString().split("T")[0];

    // Upsert into card_reviews
    await pool.query(
      `INSERT INTO card_reviews (user_id, card_id, easiness, interval_days, repetitions, next_review)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         easiness = VALUES(easiness),
         interval_days = VALUES(interval_days),
         repetitions = VALUES(repetitions),
         next_review = VALUES(next_review)`,
      [req.userId, req.params.cardId, easiness, interval_days, repetitions, nextReviewStr]
    );

    res.json({ easiness, interval_days, repetitions, next_review: nextReviewStr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get review stats for a user
app.get("/api/review/stats", requireUser, async (req, res) => {
  try {
    const [due] = await pool.query(
      `SELECT COUNT(*) as count FROM card_reviews
       WHERE user_id = ? AND next_review <= CURDATE()`,
      [req.userId]
    );
    const [total] = await pool.query(
      `SELECT COUNT(*) as count FROM card_reviews WHERE user_id = ?`,
      [req.userId]
    );
    const [upcoming] = await pool.query(
      `SELECT DATE(next_review) as date, COUNT(*) as count
       FROM card_reviews
       WHERE user_id = ? AND next_review > CURDATE()
       GROUP BY DATE(next_review) ORDER BY date ASC LIMIT 7`,
      [req.userId]
    );
    res.json({ due: due[0].count, total: total[0].count, upcoming });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a card to review queue (called from study mode)
app.post("/api/review/add/:cardId", requireUser, async (req, res) => {
  const { known } = req.body; // true = knew it, false = didn't know
  try {
    const nextReview = new Date();
    if (known) nextReview.setDate(nextReview.getDate() + 1); // knew it = review tomorrow
    // didn't know = review today

    await pool.query(
      `INSERT INTO card_reviews (user_id, card_id, next_review)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         next_review = LEAST(next_review, VALUES(next_review))`,
      [req.userId, req.params.cardId, nextReview.toISOString().split("T")[0]]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── TASKS ──────────────────────────────────────────────────────────────────
app.get("/api/tasks", requireUser, async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC", [req.userId]);
  res.json(rows);
});
app.post("/api/tasks", requireUser, async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const [r] = await pool.query("INSERT INTO tasks (user_id, title) VALUES (?,?)", [req.userId, title.trim()]);
  res.json({ id: r.insertId, user_id: req.userId, title: title.trim(), done: 0 });
});
app.patch("/api/tasks/:id", requireUser, async (req, res) => {
  const { done } = req.body;
  await pool.query("UPDATE tasks SET done=? WHERE id=? AND user_id=?", [done ? 1 : 0, req.params.id, req.userId]);
  res.json({ ok: true });
});
app.delete("/api/tasks/:id", requireUser, async (req, res) => {
  await pool.query("DELETE FROM tasks WHERE id=? AND user_id=?", [req.params.id, req.userId]);
  res.json({ ok: true });
});
