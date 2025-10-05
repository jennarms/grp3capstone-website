import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

export function Login() {
  // Auth fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // NEW: show/hide password
  const [showPassword, setShowPassword] = useState(false);

  // Forgot/Reset UI
  const [showResetModal, setShowResetModal] = useState(false);      // OTP send modal
  const [showPasswordReset, setShowPasswordReset] = useState(false); // form after OTP sent
  const [resetError, setResetError] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Login UX
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");

  // OTP UX
  const [otpError, setOtpError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const navigate = useNavigate();
  const REDIRECT_DELAY_MS = 1200;

  const apiUrl = import.meta.env.VITE_API_URL;
  console.log("API URL from env:", apiUrl);

  // ---------- Login ----------
const handleSubmit = async (e) => {
  e.preventDefault();

  if (!username || !password) {
    setLoginErrorMessage("Please enter username and password");
    return;
  }

  setIsSubmitting(true);
  setLoginErrorMessage("");

  try {
    const res = await axios.post(`${apiUrl}/api/auth/login`, { username, password });
    const data = res.data;

    // Persist existing info
    if (data.token) localStorage.setItem("token", data.token);
    if (data.admin_id) localStorage.setItem("admin_id", data.admin_id);
    if (data.role) localStorage.setItem("role", data.role);

    // Store the station name from the backend in localStorage
    if (data.station_name) {
      localStorage.setItem("StationName", data.station_name); // Store StationName in localStorage
    }

    // NEW: store username for navbar display
    if (data.username) localStorage.setItem("admin_name", data.username);

    setLoginMessage(data.message || "Login successful!");
    setShowLoginSuccess(true);

    setTimeout(() => {
      if (data.role === "main-admin") navigate("/announcement");
      else if (data.role === "station-admin") navigate("/dashboard");
      else navigate("/dashboard");
    }, REDIRECT_DELAY_MS);
  } catch (err) {
    const msg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message;
    setLoginErrorMessage(`Login failed: ${msg}`);
  } finally {
    setIsSubmitting(false);
  }
};

  // ---------- Send OTP ----------
  const sendOtp = async () => {
    if (!username) {
      setOtpError("Please enter your username first");
      return;
    }

    setIsSendingOtp(true);
    setOtpError("");

    try {
      const res = await axios.post(`${apiUrl}/api/auth/forgot-password`, { username });
      console.log("OTP response:", res.data);

      setShowResetModal(false);
      setShowPasswordReset(true);
      setResetError("");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message;
      setOtpError(msg || "Failed to send OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ---------- Reset password ----------
  const resetPassword = async () => {
    if (!enteredCode || !newPassword || !confirmPassword) {
      setResetError("Please fill all fields");
      setShowSuccessMessage(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      setShowSuccessMessage(false);
      return;
    }

    try {
      const res = await axios.post(`${apiUrl}/api/auth/reset-password`, {
        username,
        otp: enteredCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      console.log("Reset-password response:", res.data);

      setShowSuccessMessage(true);
      setResetError("");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message;
      setResetError(`Error: ${msg}`);
      setShowSuccessMessage(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img
          src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png"
          alt="User Icon"
          className="login-icon"
        />

        {/* --- Welcome header (new) --- */}
        <div className="welcome">
          <h1 className="welcome-title">Welcome!</h1>
          <p className="welcome-subtitle">Sign in to your Admin Account</p>
        </div>

        {/* Inline error banner */}
        {loginErrorMessage && (
          <div className="error-message login-error" role="alert" aria-live="assertive">
            <img
              src="https://cdn-icons-png.flaticon.com/512/463/463612.png"
              alt="Error Icon"
              className="error-icon"
            />
            <span>{loginErrorMessage}</span>
            <button
              className="error-close"
              aria-label="Dismiss error"
              onClick={() => setLoginErrorMessage("")}
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
              disabled={isSubmitting || showLoginSuccess}
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            {/* --- Show/Hide wrapper (NEW) --- */}
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                autoComplete="current-password"
                disabled={isSubmitting || showLoginSuccess}
              />

              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {/* Eye icon: shows a slash when visible */}
                <svg
                  width="22" height="22" viewBox="0 0 24 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3.2"
                          stroke="currentColor" strokeWidth="1.6" />
                  {showPassword && (
                    <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  )}
                </svg>
              </button>
            </div>
            {/* --- End show/hide --- */}
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting || showLoginSuccess}
            title={isSubmitting ? "Signing in…" : "Log in"}
          >
            {isSubmitting ? "Signing in…" : "Log in"}
          </button>
        </form>

        <a
          href="#"
          className="forgot-password"
          onClick={(e) => {
            e.preventDefault();
            setOtpError("");
            setShowResetModal(true);
          }}
        >
          Forgot password?
        </a>
      </div>

      {/* Success overlay */}
      {showLoginSuccess && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="success-modal">
            <img
              src="https://cdn-icons-png.flaticon.com/512/845/845646.png"
              alt="Success"
              className="success-big-icon"
            />
            <h3 className="success-title">{loginMessage || "Login successful!"}</h3>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {showResetModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowResetModal(false)}
        >
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Reset Password</strong></h2>
            <p>
              An OTP will be sent to your registered email address to reset your password.
              Click <em>Send Code</em> to receive it.
            </p>

            {otpError && (
              <div className="error-message" role="alert" aria-live="assertive">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/463/463612.png"
                  alt="Error Icon"
                  className="error-icon"
                />
                <span>{otpError}</span>
              </div>
            )}

            <div className="button-wrapper">
              <button
                className="send-code-button"
                onClick={sendOtp}
                disabled={isSendingOtp}
                title={isSendingOtp ? "Sending…" : "Send Code"}
              >
                {isSendingOtp ? "Sending…" : "Send Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal (after OTP is sent) */}
      {showPasswordReset && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPasswordReset(false)}
        >
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Reset Password</strong></h2>
            <p>The verification code has been sent to your email.</p>

            {showSuccessMessage && (
              <div className="success-message">Password reset successfully!</div>
            )}
            {resetError && (
              <div className="error-message" role="alert" aria-live="assertive">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/463/463612.png"
                  alt="Error Icon"
                  className="error-icon"
                />
                <span>{resetError}</span>
              </div>
            )}

            <div className="form-group">
              <label>Code</label>
              <input
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <button className="send-code-button" onClick={resetPassword}>
              Reset Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
