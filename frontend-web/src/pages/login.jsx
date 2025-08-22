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

  // Handle login
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return alert('Please enter username and password');

    try {
      const res = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Login successful!');
        // Redirect based on role
        if (data.role === 'main-admin') navigate('/announcement');
        else if (data.role === 'station-admin') navigate('/dashboard');
      } else {
        alert(data.error || 'Invalid username or password');
      }
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  // Send OTP for forgot password
  const sendOtp = async () => {
    if (!username) return alert('Please enter your username first');

    try {
      const res = await fetch('http://localhost:5000/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'OTP sent. Check your email.');
        setShowResetModal(false);
        setShowPasswordReset(true);
        setResetError('');
      } else {
        alert(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      alert('Error sending OTP: ' + err.message);
    }
  };

  // Reset password
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
      const res = await fetch('http://localhost:5000/auth/reset-password', {
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
    } catch (err) {
      setResetError('Error: ' + err.message);
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
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button">Log in</button>
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

      {/* OTP Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Reset Password</strong></h2>
            <p>Click 'Send Code' to receive an OTP on your registered email.</p>
            <button className="send-code-button" onClick={sendOtp}>Send Code</button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="modal-overlay" onClick={() => setShowPasswordReset(false)}>
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <h2><strong>Reset Password</strong></h2>
            <p>OTP has been sent to your email.</p>

            {showSuccessMessage && <div className="success-message">Password reset successfully!</div>}
            {resetError && <div className="error-message">{resetError}</div>}

            <div className="form-group">
              <label>Code</label>
              <input type="text" value={enteredCode} onChange={(e) => setEnteredCode(e.target.value)} className="form-input"/>
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input"/>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input"/>
            </div>

            <button className="send-code-button" onClick={resetPassword}>Reset Password</button>
          </div>
        </div>
      )}
    </div>
  );
}
