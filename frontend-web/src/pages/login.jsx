import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  // Login handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      alert('Please enter username and password');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/main-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Login successful!');
        navigate('/dashboard'); // adjust route as needed
      } else {
        alert(data.error || 'Invalid username or password');
      }
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  };

  // Send OTP for forgot password
  const sendOtp = async () => {
    if (!username) {
      alert('Please enter your username first');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/main-admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'OTP sent. Please check your email.');
        setShowResetModal(false);
        setShowPasswordReset(true);
        setResetError('');
      } else {
        alert(data.error || 'Failed to send OTP.');
      }
    } catch (error) {
      alert('Error sending OTP: ' + error.message);
    }
  };

  // Reset password call
  const resetPassword = async () => {
    if (!enteredCode || !newPassword || !confirmPassword) {
      setResetError('Please fill all fields');
      setShowSuccessMessage(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      setShowSuccessMessage(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/main-admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          otp: enteredCode,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowSuccessMessage(true);
        setResetError('');
      } else {
        setResetError(data.error || 'Failed to reset password');
        setShowSuccessMessage(false);
      }
    } catch (error) {
      setResetError('Error: ' + error.message);
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
        <h1 className="login-title">Log in</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button">
            Log in
          </button>
        </form>

        <a
          href="#"
          className="forgot-password"
          onClick={(e) => {
            e.preventDefault();
            setShowResetModal(true);
          }}
        >
          Forgot password?
        </a>
      </div>

      {/* OTP send modal */}
      {showResetModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowResetModal(false);
            setShowPasswordReset(false);
          }}
        >
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              <strong>Reset Password</strong>
            </h2>
            <p>
              An OTP will be sent to your registered email address to reset your
              password. Click 'Send Code' to receive it.
            </p>
            <div className="button-wrapper">
              <button
                className="send-code-button"
                onClick={sendOtp}
              >
                Send Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password reset modal */}
      {showPasswordReset && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowResetModal(false);
            setShowPasswordReset(false);
          }}
        >
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              <strong>Reset Password</strong>
            </h2>
            <p>The verification code has been sent to your email.</p>

            {showSuccessMessage && (
              <div className="success-message">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/845/845646.png"
                  alt="Success Icon"
                  className="success-icon"
                />
                <span>Password has been reset successfully</span>
              </div>
            )}

            {resetError && (
              <div className="error-message">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/463/463612.png"
                  alt="Error Icon"
                  className="error-icon"
                />
                <span>{resetError}</span>
              </div>
            )}

            <div className="form-group">
              <label>
                Code<span className="required"> *</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                New Password<span className="required"> *</span>
              </label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                Confirm Password<span className="required"> *</span>
              </label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="button-wrapper">
              <button className="send-code-button" onClick={resetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
