import axios from "axios";
import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./accountSettings.css";

const apiUrl = import.meta.env.VITE_API_URL;

export function AccountSettings() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const [banner, setBanner] = useState({ type: "", text: "" });

  // OTP Modal for email
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Password modal for username change
  const [showPwModal, setShowPwModal] = useState(false);
  const [usernamePw, setUsernamePw] = useState("");

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: "", text: "" }), 3000);
  };

  // 🔹 Fetch account info
  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${apiUrl}/api/account/get-details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentEmail(res.data.email);
        setCurrentUsername(res.data.username);
      } catch (err) {
        console.error(err);
        showBanner("error", "Failed to load account info.");
      }
    };
    fetchAdmin();
  }, []);

  // 🔹 Request email change
  const saveEmail = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/request-email-change`,
        { new_email: newEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowOtpModal(true);
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Failed to request email change.");
      setNewEmail(""); // ❌ clear email field on error
    }
  };

  // 🔹 Confirm email change with OTP
  const confirmEmailChange = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/confirm-email-change`,
        { otp_code: otpCode, new_email: newEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentEmail(newEmail);
      setNewEmail("");
      setOtpCode("");
      setShowOtpModal(false);
      showBanner("success", "Email updated.");
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Invalid OTP.");
      setOtpCode(""); // ❌ clear OTP field on error
    }
  };

  // 🔹 Save username → open password modal
  const saveUsername = () => {
    if (!newUsername) return showBanner("error", "Please enter a new username.");
    setShowPwModal(true);
  };

  // 🔹 Confirm username change
  const confirmUsernameChange = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/update-username`,
        { new_username: newUsername, password: usernamePw },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentUsername(newUsername);
      setNewUsername("");
      setUsernamePw("");
      setShowPwModal(false);
      showBanner("success", "Username updated.");
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Failed to update username.");
      setNewUsername(""); // ❌ clear username field
      setUsernamePw(""); // ❌ clear password field
    }
  };

  // 🔹 Update password
  const updatePassword = async () => {
    if (!pw.current || !pw.next || !pw.confirm)
      return showBanner("error", "Please fill out all password fields.");
    if (pw.next !== pw.confirm) {
      showBanner("error", "Passwords do not match.");
      setPw((p) => ({ ...p, next: "", confirm: "" })); // ❌ clear mismatch fields
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/update-password`,
        {
          current_password: pw.current,
          new_password: pw.next,
          confirm_password: pw.confirm,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPw({ current: "", next: "", confirm: "" });
      showBanner("success", "Password updated.");
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Failed to update password.");
      setPw({ current: "", next: "", confirm: "" }); // ❌ clear all password fields
    }
  };

  return (
    <>
      <Navbar />
      <div className="acct-main">
        <div className="acct-header-row">
          <div className="acct-title-wrap">
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
          <div className="acct-section-title">
            Current Email:&nbsp;<b>{currentEmail}</b>
          </div>
          <div className="acct-row">
            <label className="acct-label">Update Email</label>
            <input
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
          <div className="acct-section-title">
            Current Username:&nbsp;<b>{currentUsername}</b>
          </div>
          <div className="acct-row">
            <label className="acct-label">New Username</label>
            <input
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
          <div className="acct-section-title">Change Password</div>
          <div className="acct-row">
            <label className="acct-label">Current Password</label>
            <input
              type="password"
              className="acct-input"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div className="acct-row">
            <label className="acct-label">New Password</label>
            <input
              type="password"
              className="acct-input"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
          </div>
          <div className="acct-row">
            <label className="acct-label">Confirm New Password</label>
            <input
              type="password"
              className="acct-input"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>
          <div className="acct-actions">
            <button className="acct-btn acct-btn-primary" onClick={updatePassword}>
              Update Password
            </button>
          </div>
        </section>
      </div>

      {/* ===== OTP Modal for Email ===== */}
      {showOtpModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Confirm Email Change</strong></h2>
            <p>An OTP has been sent to your new email. Enter it below:</p>
            <input
              type="text"
              className="form-input"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
            <div className="button-wrapper">
              <button className="send-code-button" onClick={confirmEmailChange}>
                Confirm
              </button>
              <button className="send-code-button" onClick={() => setShowOtpModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Password Modal for Username ===== */}
      {showPwModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Confirm Username Change</strong></h2>
            <p>Please enter your password to confirm:</p>
            <input
              type="password"
              className="form-input"
              value={usernamePw}
              onChange={(e) => setUsernamePw(e.target.value)}
            />
            <div className="button-wrapper">
              <button className="send-code-button" onClick={confirmUsernameChange}>
                Confirm
              </button>
              <button className="send-code-button" onClick={() => setShowPwModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
