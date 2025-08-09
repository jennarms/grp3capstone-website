import { useState } from 'react';
import './login.css';
import { useNavigate } from 'react-router-dom';


export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [resetError, setResetError] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [enteredCode, setEnteredCode] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
      e.preventDefault();
      console.log('Logging in with:', { email, password });
    
      // Simulated successful login
      if (email === 'mainadmin1234' && password === 'metrolayagadmin!') {
        navigate('/dashboard');
      } else {
        alert('Invalid email or password');
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
              <label htmlFor="email">Email</label>
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
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
            {showResetModal && (
        <div
            className="modal-overlay"
            onClick={() => {
            setShowResetModal(false);
            setShowPasswordReset(false);
            }}
        >
            <div
            className="reset-modal"
            onClick={(e) => e.stopPropagation()}
            >
                <h2><strong>Reset Password</strong></h2>
                <p>
                    An OTP will be sent to your registered email address to reset your password.
                    Click 'Send Code' to receive it.
                </p>
                    <div className="button-wrapper">
                        <button
                            className="send-code-button"
                            onClick={() => {
                                setShowResetModal(false);
                                setShowPasswordReset(true);
                            }}
                            >
                            Send Code
                            </button>
                    </div>
                </div>
            </div> 
        )}
        {showPasswordReset && (
  <div
    className="modal-overlay"
    onClick={() => {
      setShowResetModal(false);
      setShowPasswordReset(false);
    }}
  >
    <div
      className="reset-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h2><strong>Reset Password</strong></h2>
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

      <div className="form-group">
        <label>Code<span className="required"> *</span></label>
        <input
          type="text"
          className="form-input"
          value={enteredCode}
          onChange={(e) => setEnteredCode(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>New Password<span className="required"> *</span></label>
        <input type="password" className="form-input" />
      </div>

      <div className="form-group">
        <label>Confirm Password<span className="required"> *</span></label>
        <input type="password" className="form-input" />
      </div>

        {resetError && (
    <div className="error-message">
        <img
        src="https://cdn-icons-png.flaticon.com/512/463/463612.png"
        alt="Error Icon"
        className="error-icon"
        />
        <span>The verification code is incorrect or expired.</span>
    </div>
    )}

        <div className="password-hints">
    <div className="password-hint">
        <img
        src="https://cdn-icons-png.flaticon.com/512/471/471664.png"
        alt="Info Icon"
        className="hint-icon"
        />
        <span>Password must be at least 8 characters</span>
    </div>
    <div className="password-hint">
        <img
        src="https://cdn-icons-png.flaticon.com/512/471/471664.png"
        alt="Info Icon"
        className="hint-icon"
        />
        <span>Include at least 1 letter and 1 number</span>
    </div>
    </div>

      <div className="button-wrapper">
      <button
  className="send-code-button"
  onClick={() => {
    if (enteredCode === "997740") {
      setResetError(false);
      setShowSuccessMessage(true);
    } else {
      setResetError(true);
      setShowSuccessMessage(false);
    }
  }}
>
  Reset Password
</button>
      </div>
    </div>
  </div>
)}
      </div>

    );
  }