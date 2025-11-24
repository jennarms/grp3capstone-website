import axios from "axios";
import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./accountSettings.css";

const apiUrl = import.meta.env.VITE_API_URL;

// Simple email validator
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return emailRegex.test(email.trim());
}

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
    const trimmed = newEmail.trim();

    // Frontend validations
    if (!trimmed) {
      showBanner("error", "Please enter a new email address.");
      return;
    }

    if (trimmed === currentEmail) {
      showBanner("error", "Your new email must be different from your current email.");
      return;
    }

    if (!isValidEmail(trimmed)) {
      showBanner(
        "error",
        "That doesn’t look like a valid email. Please use a format like name@example.com."
      );
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/request-email-change`,
        { new_email: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowOtpModal(true);
      showBanner("success", `We’ve sent an OTP to ${trimmed}.`);
    } catch (err) {
      console.error(err);

      const backendMsg = err.response?.data?.error;

      if (backendMsg) {
        // Show backend error nicely (e.g. "Email already in use")
        showBanner("error", backendMsg);
      } else if (err.code === "ERR_NETWORK") {
        showBanner(
          "error",
          "Unable to reach the server right now. Please check your internet connection and try again."
        );
      } else {
        showBanner("error", "We couldn’t process that email change. Please try again.");
      }
      // 👉 Do NOT clear newEmail so the user can edit it
    }
  };

  // 🔹 Confirm email change with OTP
  const confirmEmailChange = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/confirm-email-change`,
        { otp_code: otpCode, new_email: newEmail.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentEmail(newEmail.trim());
      setNewEmail("");
      setOtpCode("");
      setShowOtpModal(false);
      showBanner("success", "Email updated.");
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Invalid OTP.");
      setOtpCode(""); // clear OTP field on error so they can retype
    }
  };

  // 🔹 Save username → open password modal
  const saveUsername = () => {
    if (!newUsername.trim()) {
      showBanner("error", "Please enter a new username.");
      return;
    }
    setShowPwModal(true);
  };

  // 🔹 Confirm username change
  const confirmUsernameChange = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${apiUrl}/api/account/update-username`,
        { new_username: newUsername.trim(), password: usernamePw },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentUsername(newUsername.trim());
      setNewUsername("");
      setUsernamePw("");
      setShowPwModal(false);
      showBanner("success", "Username updated.");
    } catch (err) {
      console.error(err);
      showBanner("error", err.response?.data?.error || "Failed to update username.");
      setUsernamePw(""); // clear password, keep username so they can retry
    }
  };

  // 🔹 Update password
  const updatePassword = async () => {
    if (!pw.current || !pw.next || !pw.confirm) {
      showBanner("error", "Please fill out all password fields.");
      return;
    }
    if (pw.next !== pw.confirm) {
      showBanner("error", "New password and confirm password do not match.");
      setPw((p) => ({ ...p, next: "", confirm: "" }));
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
      setPw({ current: "", next: "", confirm: "" });
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
              placeholder="name@example.com"
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
            <h2>
              <strong>Confirm Email Change</strong>
            </h2>
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
            <h2>
              <strong>Confirm Username Change</strong>
            </h2>
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
