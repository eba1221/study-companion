import "./Settings.css";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Home as HomeIcon, Settings, LogOut, Check, X } from "lucide-react";
import { getStoredUser } from "../api";

const API_BASE = "https://study-companion-production-cec1.up.railway.app";

async function apiFetch(path, options = {}) {
  const user = getStoredUser();
  const token = user?.token;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function SettingsPage() {
  const navigate    = useNavigate();
  const user        = getStoredUser();
  const userId      = user?.id;

  // ── profile state ───────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [email]                        = useState(user?.email || "");
  const [profileStatus, setProfileStatus] = useState(null); // "saving" | "saved" | "error"

  // ── password state ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus,  setPasswordStatus]  = useState(null); // "saving" | "saved" | "error" | "mismatch"

  // ── avatar ──────────────────────────────────────────────────────────────
  const initials = (displayName || email || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  function handleLogout() {
    localStorage.removeItem("sc_user");
    navigate("/auth");
  }

  // ── save profile ────────────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setProfileStatus("saving");
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      // Update local storage
      const updated = { ...user, display_name: displayName.trim() };
      localStorage.setItem("sc_user", JSON.stringify(updated));
      setProfileStatus("saved");
      setTimeout(() => setProfileStatus(null), 3000);
    } catch {
      setProfileStatus("error");
      setTimeout(() => setProfileStatus(null), 3000);
    }
  }

  // ── change password ─────────────────────────────────────────────────────
  async function changePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus("mismatch");
      setTimeout(() => setPasswordStatus(null), 3000);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus("tooshort");
      setTimeout(() => setPasswordStatus(null), 3000);
      return;
    }
    setPasswordStatus("saving");
    try {
      await apiFetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setPasswordStatus("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordStatus(null), 3000);
    } catch {
      setPasswordStatus("error");
      setTimeout(() => setPasswordStatus(null), 3000);
    }
  }

  const passwordMsg = {
    mismatch: { text: "Passwords don't match.",        ok: false },
    tooshort: { text: "Password must be 8+ characters.", ok: false },
    error:    { text: "Incorrect current password.",   ok: false },
    saved:    { text: "Password updated!",             ok: true  },
  }[passwordStatus];

  const profileMsg = {
    error: { text: "Failed to save. Try again.", ok: false },
    saved: { text: "Profile saved!",             ok: true  },
  }[profileStatus];

  return (
    <div className="shell">
      {/* Sidebar — identical structure to Home */}
      <aside className="sidebar">
        <div className="sideLogo">SC</div>
        <Link className="navBtn" to="/" title="Home" aria-label="Home">
          <HomeIcon className="navLucide" size={22} />
        </Link>
        <div style={{ flex: 1 }} />
        <Link className="navBtn navBtnActive" to="/settings" title="Settings" aria-label="Settings">
          <Settings className="navLucide" size={22} />
        </Link>
        <button className="navBtn" title="Logout" aria-label="Logout" onClick={handleLogout}>
          <LogOut className="navLucide" size={22} />
        </button>
      </aside>

      {/* Main content */}
      <main className="settingsMain">
        <div className="settingsHeader">
          <h1 className="settingsTitle">Settings</h1>
          <p className="settingsSub">Manage your profile and account security.</p>
        </div>

        <div className="settingsSections">

          {/* ── Profile card ─────────────────────────────────────────────── */}
          <section className="settingsCard">
            <div className="settingsCardHeader">
              <div className="settingsCardTitle">Profile</div>
              <div className="settingsCardDesc">How others see you in the app.</div>
            </div>

            

            <form className="settingsForm" onSubmit={saveProfile}>
              <div className="fieldGroup">
                <label className="fieldLabel">Display name</label>
                <input
                  className="fieldInput"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={40}
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Email</label>
                <input
                  className="fieldInput fieldInputDisabled"
                  value={email}
                  disabled
                  title="Email cannot be changed here"
                />
                <span className="fieldHint">Contact support to change your email.</span>
              </div>

              <div className="formFooter">
                {profileMsg && (
                  <span className={`statusMsg ${profileMsg.ok ? "statusOk" : "statusErr"}`}>
                    {profileMsg.ok ? <Check size={14} /> : <X size={14} />}
                    {profileMsg.text}
                  </span>
                )}
                <button
                  className="saveBtn"
                  type="submit"
                  disabled={profileStatus === "saving"}
                >
                  {profileStatus === "saving" ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>

          {/* ── Password card ─────────────────────────────────────────────── */}
          <section className="settingsCard">
            <div className="settingsCardHeader">
              <div className="settingsCardTitle">Change password</div>
              <div className="settingsCardDesc">Use a strong password you don't use elsewhere.</div>
            </div>

            <form className="settingsForm" onSubmit={changePassword}>
              <div className="fieldGroup">
                <label className="fieldLabel">Current password</label>
                <input
                  className="fieldInput"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">New password</label>
                <input
                  className="fieldInput"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Confirm new password</label>
                <input
                  className={`fieldInput ${passwordStatus === "mismatch" ? "fieldInputError" : ""}`}
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div className="strengthWrap">
                  <div className="strengthBar">
                    <div
                      className="strengthFill"
                      data-strength={
                        newPassword.length >= 12 && /[^a-zA-Z0-9]/.test(newPassword) ? "strong"
                        : newPassword.length >= 8 ? "medium"
                        : "weak"
                      }
                    />
                  </div>
                  <span className="strengthLabel">
                    {newPassword.length >= 12 && /[^a-zA-Z0-9]/.test(newPassword) ? "Strong"
                      : newPassword.length >= 8 ? "Medium"
                      : "Weak"}
                  </span>
                </div>
              )}

              <div className="formFooter">
                {passwordMsg && (
                  <span className={`statusMsg ${passwordMsg.ok ? "statusOk" : "statusErr"}`}>
                    {passwordMsg.ok ? <Check size={14} /> : <X size={14} />}
                    {passwordMsg.text}
                  </span>
                )}
                <button
                  className="saveBtn"
                  type="submit"
                  disabled={passwordStatus === "saving" || !currentPassword || !newPassword || !confirmPassword}
                >
                  {passwordStatus === "saving" ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          </section>

        </div>
      </main>
    </div>
  );
}