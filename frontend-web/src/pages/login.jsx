import axios from 'axios';
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

 // ✅ Get API URL from .env
  const apiUrl = import.meta.env.VITE_API_URL;
  console.log("API URL from env:", apiUrl);

  // Handle login
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return alert('Please enter username and password');

    try {
      console.log('Sending login request...');
      const res = await axios.post(`${apiUrl}/auth/login`, { username, password });
      console.log('Login response:', res.data);

      if (res.data.role === 'main-admin') navigate('/announcement');
      else if (res.data.role === 'station-admin') navigate('/dashboard');

      alert(res.data.message || 'Login successful!');
    } catch (err) {
      console.error('Login error:', err.response ? err.response.data : err.message);
      alert('Login failed. See console for details.');
    }
  };

  // Send OTP for forgot password
  const sendOtp = async () => {
    if (!username) return alert('Please enter your username first');

    try {
      console.log('Sending OTP request...');
      const res = await axios.post(`${apiUrl}/auth/forgot-password`, { username });
      console.log('OTP response:', res.data);

      alert(res.data.message || 'OTP sent. Check your email.');
      setShowResetModal(false);
      setShowPasswordReset(true);
      setResetError('');
    } catch (err) {
      console.error('OTP error:', err.response ? err.response.data : err.message);
      alert('Error sending OTP. See console for details.');
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
      console.log('Sending reset-password request...');
      const res = await axios.post(`${apiUrl}/auth/reset-password`, {
        username,
        otp: enteredCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      console.log('Reset-password response:', res.data);

      setShowSuccessMessage(true);
      setResetError('');
    } catch (err) {
      console.error('Reset-password error:', err.response ? err.response.data : err.message);
      setResetError('Error: ' + (err.response?.data?.error || err.message));
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