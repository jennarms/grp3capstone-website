import React, { useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import "./accountSettings.css";

export function AccountSettings() {
  // Pretend “current” values (replace with real data from your store/api)
  const [currentEmail, setCurrentEmail] = useState("mainadmin@email");
  const [currentUsername, setCurrentUsername] = useState("mainadmin");

  // Draft fields
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  // Message banner
  const [banner, setBanner] = useState({ type: "", text: "" });

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: "", text: "" }), 3000);
  };

  const saveEmail = () => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
    if (!ok) return showBanner("error", "Please enter a valid email address.");
    setCurrentEmail(newEmail);
    setNewEmail("");
    showBanner("success", "Email updated.");
  };

  const saveUsername = () => {
    if (!newUsername.trim()) return showBanner("error", "Username cannot be empty.");
    setCurrentUsername(newUsername.trim());
    setNewUsername("");
    showBanner("success", "Username updated.");
  };

  const updatePassword = () => {
    if (!pw.current || !pw.next || !pw.confirm)
      return showBanner("error", "Please fill out all password fields.");
    if (pw.next.length < 8)
      return showBanner("error", "New password must be at least 8 characters.");
    if (pw.next !== pw.confirm)
      return showBanner("error", "New passwords do not match.");
    setPw({ current: "", next: "", confirm: "" });
    showBanner("success", "Password updated.");
  };

  return (
    <>
      <Navbar />

      <div className="acct-main">
        <div className="acct-header-row">
          <div className="acct-title-wrap">
            <svg className="acct-title-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.14 12.94a7.88 7.88 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.6 7.6 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42L9.84 4.42a7.6 7.6 0 00-1.62.94l-2.4-.96a.5.5 0 00-.6.22L3.3 7.94a.5.5 0 00.12.64l2.03 1.58c-.06.62-.06 1.25 0 1.88L3.42 13.6a.5.5 0 00-.12.64l1.92 3.32c.12.2.37.28.6.22l2.4-.96c.5.38 1.05.7 1.62.95l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.57-.26 1.12-.58 1.62-.95l2.39.96c.23.06.48-.02.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.02-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z"/>
            </svg>
            <h1 className="acct-title">Edit Account</h1>
          </div>

          <HeaderButton />
        </div>

        <hr className="acct-title-rule" />

        {!!banner.text && (
          <div className={`acct-banner ${banner.type}`} role="status" aria-live="polite">
            {banner.text}
          </div>
        )}

        {/* ===== EMAIL ===== */}
        <section className="acct-section">
          <div className="acct-section-head">
            <div className="acct-section-title">
              Current Email:&nbsp;<b>{currentEmail}</b>
            </div>
          </div>

          <div className="acct-row">
            <label className="acct-label" htmlFor="email">Update Email</label>
            <input
              id="email"
              type="email"
              className="acct-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div className="acct-actions">
            <button className="acct-btn acct-btn-primary" onClick={saveEmail}>
              Save Changes
            </button>
          </div>
        </section>

        <hr className="acct-rule" />

        {/* ===== USERNAME ===== */}
        <section className="acct-section">
          <div className="acct-section-head">
            <div className="acct-section-title">
              Current Username:&nbsp;<b>{currentUsername}</b>
            </div>
          </div>

          <div className="acct-row">
            <label className="acct-label" htmlFor="username">New Username</label>
            <input
              id="username"
              type="text"
              className="acct-input"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>

          <div className="acct-actions">
            <button className="acct-btn acct-btn-primary" onClick={saveUsername}>
              Save Changes
            </button>
          </div>
        </section>

        <hr className="acct-rule" />

        {/* ===== PASSWORD ===== */}
        <section className="acct-section">
          <div className="acct-section-head">
            <div className="acct-section-title">Change Password</div>
          </div>

          <div className="acct-row">
            <label className="acct-label" htmlFor="pw-current">Current Password</label>
            <input
              id="pw-current"
              type="password"
              className="acct-input"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <div className="acct-row">
            <label className="acct-label" htmlFor="pw-new">New Password</label>
            <input
              id="pw-new"
              type="password"
              className="acct-input"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div className="acct-row">
            <label className="acct-label" htmlFor="pw-confirm">Confirm New Password</label>
            <input
              id="pw-confirm"
              type="password"
              className="acct-input"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div className="acct-actions">
            <button className="acct-btn acct-btn-primary" onClick={updatePassword}>
              Update Password
            </button>
          </div>
        </section>
      </div>
    </>
  );
}