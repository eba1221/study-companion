import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import WaveGif from "../assets/Wave.GIF";
import { login, register } from "../api";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const title = useMemo(() => (mode === "login" ? "Welcome back" : "Create account"), [mode]);
  const subtitle = useMemo(() =>
    mode === "login"
      ? "Sign in to continue your study journey"
      : "Get started with Study Coach today",
    [mode]
  );

  function showError(text) { setMsg({ type: "error", text }); }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!email.trim()) return showError("Please enter your email.");
    if (!password.trim()) return showError("Please enter your password.");

    if (mode === "register") {
      if (!name.trim()) return showError("Please enter your name.");
      if (password.length < 6) return showError("Password must be at least 6 characters.");
      if (password !== confirm) return showError("Passwords do not match.");
    }

    try {
      setLoading(true);
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
      navigate("/");
    } catch (err) {
      showError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authInner">

        {/* Mascot */}
        <div className="authMascotWrap">
          <img src={WaveGif} alt="Study Coach mascot" className="authMascot" />
        </div>

        {/* Brand */}
        <div className="authBrand">
          <span className="authAppName">Study Coach</span>
        </div>

        {/* Headings */}
        <div className="authHeading">
          <h1 className="authTitle">{title}</h1>
          <p className="authSubtitle">{subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="authTabs">
          <button
            type="button"
            className={`authTab ${mode === "login" ? "isActive" : ""}`}
            onClick={() => { setMode("login"); setMsg({ type: "", text: "" }); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`authTab ${mode === "register" ? "isActive" : ""}`}
            onClick={() => { setMode("register"); setMsg({ type: "", text: "" }); }}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form className="authForm" onSubmit={onSubmit}>
          {mode === "register" && (
            <div className="authField">
              <label className="authLabel" htmlFor="name">Name</label>
              <input
                id="name"
                className="authInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="authField">
            <label className="authLabel" htmlFor="email">Email</label>
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
            <label className="authLabel" htmlFor="password">Password</label>
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
              <label className="authLabel" htmlFor="confirm">Confirm password</label>
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

          {msg.text && (
            <p className={`authMsg ${msg.type === "error" ? "isError" : "isOk"}`}>
              {msg.text}
            </p>
          )}

          <button className="authButton" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}