import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

import { login, register } from "../api";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register-only
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" }); // type: "error" | "ok"

  const title = useMemo(() => (mode === "login" ? "Welcome back" : "Create your account"), [mode]);
  const subtitle = useMemo(
    () => (mode === "login" ? "Log in to continue your study journey." : "Make an account to save progress and notes."),
    [mode]
  );

  function showError(text) {
    setMsg({ type: "error", text });
  }
  function showOk(text) {
    setMsg({ type: "ok", text });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!email.trim()) return showError("Please enter your email.");
    if (!password.trim()) return showError("Please enter your password.");

    if (mode === "register") {
      if (!name.trim()) return showError("Please enter your name.");
      if (password.length < 6) return showError("Password should be at least 6 characters.");
      if (password !== confirm) return showError("Passwords do not match.");
    }

    try {
      setLoading(true);

      if (mode === "login") {
        // expected response: { user: { id, name, email } } OR { id, ... }
        const data = await login({ email, password });
        const user = data.user ?? data;

        localStorage.setItem("sc_user", JSON.stringify(user));
        showOk("Logged in! Redirecting...");
        setTimeout(() => navigate("/learn"), 300);
      } else {
        const data = await register({ name, email, password });
        const user = data.user ?? data;

        localStorage.setItem("sc_user", JSON.stringify(user));
        showOk("Account created! Redirecting...");
        setTimeout(() => navigate("/learn"), 300);
      }
    } catch (err) {
      // your backend currently throws text in some cases — handle both
      const text = (err?.message || "").trim();
      showError(text || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authShell">
        <div className="authCard">
          <div className="authTop">
            <div className="authBrand">
              <div className="authLogo">🌿</div>
              <div className="authBrandText">
                <div className="authAppName">CosyCoach</div>
                <div className="authTagline">Study smarter, gently.</div>
              </div>
            </div>

            <div className="authTabs" role="tablist" aria-label="Authentication tabs">
              <button
                type="button"
                className={`authTab ${mode === "login" ? "isActive" : ""}`}
                onClick={() => setMode("login")}
                role="tab"
                aria-selected={mode === "login"}
              >
                Login
              </button>
              <button
                type="button"
                className={`authTab ${mode === "register" ? "isActive" : ""}`}
                onClick={() => setMode("register")}
                role="tab"
                aria-selected={mode === "register"}
              >
                Register
              </button>
            </div>
          </div>

          <div className="authHeader">
            <h1 className="authTitle">{title}</h1>
            <p className="authSubtitle">{subtitle}</p>
          </div>

          {msg.text && (
            <div className={`authMsg ${msg.type === "error" ? "isError" : "isOk"}`} role="status">
              {msg.text}
            </div>
          )}

          <form className="authForm" onSubmit={onSubmit}>
            {mode === "register" && (
              <div className="authField">
                <label className="authLabel" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="authInput"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ayesha"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="authField">
              <label className="authLabel" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="authInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="authField">
              <label className="authLabel" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="authInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "register" && (
              <div className="authField">
                <label className="authLabel" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  className="authInput"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            )}

            <button className="authButton" type="submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
            </button>

            <div className="authMetaRow">
              <span className="authMetaText">
                {mode === "login" ? "New here?" : "Already have an account?"}
              </span>
              <button
                type="button"
                className="authLinkBtn"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </div>

            <div className="authTiny">
              <Link className="authTinyLink" to="/">
                ← Back to Home
              </Link>
            </div>
          </form>
        </div>

        <div className="authSide">
          <div className="authSideCard">
            <div className="authSideTitle">What you’ll get</div>
            <ul className="authSideList">
              <li>✅ Notes saved by topic</li>
              <li>✅ Flashcards + spaced review</li>
              <li>✅ Quizzes + review wrong answers</li>
              <li>✅ Progress tracking</li>
            </ul>
            <div className="authSideHint">
              Tip: keep passwords simple in dev, but we’ll hash them properly in production.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
