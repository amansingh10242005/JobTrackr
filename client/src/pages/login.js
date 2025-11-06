import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function AuthPage() {
  const API_BASE = (() => {
    const base = (process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api").replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  })();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [email, setEmail] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null | true | false
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAUsername, setTwoFAUsername] = useState("");
  const [twoFAEmail, setTwoFAEmail] = useState("");
  const [otp, setOtp] = useState("");

  // Refs to clear auto-hide timers safely
  const errorTimerRef = useRef(null);
  const successTimerRef = useRef(null);
  const usernameCheckTimerRef = useRef(null);

  const validatePassword = (value) => {
    const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
    return regex.test(value);
  };

  // ------------- helpers: showError / showSuccess -------------
  const clearErrorTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };
  const clearSuccessTimer = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  const showError = (msg) => {
    clearErrorTimer();
    setError(msg);
    errorTimerRef.current = setTimeout(() => {
      setError("");
      errorTimerRef.current = null;
    }, 5000);
  };

  const showSuccess = (msg) => {
    clearSuccessTimer();
    setSuccess(msg);
    successTimerRef.current = setTimeout(() => {
      setSuccess("");
      successTimerRef.current = null;
    }, 6000);
  };

  // Check for invitation link in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitationId = urlParams.get('invitationId');
    
    if (invitationId) {
      // Store invitation ID for later use after login
      localStorage.setItem('pendingInvitation', invitationId);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearErrorTimer();
      clearSuccessTimer();
      if (usernameCheckTimerRef.current) {
        clearTimeout(usernameCheckTimerRef.current);
        usernameCheckTimerRef.current = null;
      }
    };
  }, []);

  // clear messages when switching main views
  useEffect(() => {
    setError("");
    setSuccess("");
    if (!requires2FA) {
      // Reset 2FA state when not in 2FA mode
      setOtp("");
      setTwoFAUsername("");
      setTwoFAEmail("");
    }
  }, [isLogin, isForgotPassword, requires2FA]);

  // Resets all form state (single place)
  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setError("");
    setSuccess("");
    setUsernameAvailable(null);
    setCheckingUsername(false);
    setIsForgotPassword(false);
    setRequires2FA(false);
    setTwoFAUsername("");
    setTwoFAEmail("");
    setOtp("");
    // clear timers if any
    clearErrorTimer();
    clearSuccessTimer();
    if (usernameCheckTimerRef.current) {
      clearTimeout(usernameCheckTimerRef.current);
      usernameCheckTimerRef.current = null;
    }
  };

  // Generic input change handler that clears messages
  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) {
      clearErrorTimer();
      setError("");
    }
    if (success) {
      clearSuccessTimer();
      setSuccess("");
    }
  };

  // Username change with availability check debounce
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);

    // Clear messages on typing
    if (error) {
      clearErrorTimer();
      setError("");
    }
    if (success) {
      clearSuccessTimer();
      setSuccess("");
    }

    // Only check on Register and after 5 chars
    if (!isLogin && value.length >= 5) {
      setCheckingUsername(true);

      if (usernameCheckTimerRef.current) {
        clearTimeout(usernameCheckTimerRef.current);
      }
      usernameCheckTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://jobtrackr-4e48.onrender.com/api/users/check-username?username=${encodeURIComponent(
              value
            )}`
          );
          const data = await res.json();
          setUsernameAvailable(data.available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
          usernameCheckTimerRef.current = null;
        }
      }, 300); // debounce 300ms
    } else if (!isLogin) {
      setUsernameAvailable(null);
    }
  };

  // ---------------- Submit (Login / Register) ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    // clear old timers/messages immediately
    clearErrorTimer();
    clearSuccessTimer();
    setError("");
    setSuccess("");
    setLoading(true);

    // Basic validation
    if (!username || !password || (!isLogin && !confirm)) {
      setLoading(false);
      showError("All fields are required.");
      return;
    }

    if (!isLogin && password !== confirm) {
      setLoading(false);
      showError("Passwords do not match.");
      return;
    }

    if (!validatePassword(password)) {
      setLoading(false);
      showError(
        "Password must be at least 8 characters long and include a number & special character."
      );
      return;
    }

    try {
      if (isLogin) {
        // Login API
          const res = await fetch(`${API_BASE}/users/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoading(false);
          showError(data.error || "Invalid credentials");
          return;
        }

        // Check if 2FA is required
        if (data.requires2FA) {
          setRequires2FA(true);
          setTwoFAUsername(data.username);
          setTwoFAEmail(data.email);
          setPassword(""); // Clear password for security
          showSuccess(`Verification code sent to ${data.email}. Please check your email.`);
          setLoading(false);
          return;
        }

        // Save token and user info
        localStorage.setItem("token", data.token);
        if (data.user && data.user.username) {
          localStorage.setItem("username", data.user.username);
        } else if (data.user && data.user.email) {
          // Decode username from token as fallback
          try {
            const payload = JSON.parse(atob(data.token.split('.')[1]));
            if (payload.username) {
              localStorage.setItem("username", payload.username);
            }
          } catch (e) {
            console.error("Failed to decode username from token:", e);
          }
        }

        // Redirect
        window.location.href = "/home";
      } else {
        // Register API
        // Register API
const res = await fetch(`${API_BASE}/users/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, email, password, confirmPassword: confirm }),
});
const data = await res.json();

if (!res.ok) {
  setLoading(false);
  showError(data.error || "Registration failed");
  return;
}

showSuccess("We've sent you a verification email. Please check your inbox.");

// After a short delay switch to login and reset form
setTimeout(() => {
  setIsLogin(true);
  resetForm();
}, 2500);

      }
    } catch (err) {
      showError("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Verify 2FA OTP ----------------
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    clearErrorTimer();
    clearSuccessTimer();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!otp || otp.length !== 6) {
      setLoading(false);
      showError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/verify-login-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: twoFAUsername, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        showError(data.error || "Invalid OTP");
        return;
      }

      // Save token and user info
      localStorage.setItem("token", data.token);
      if (data.user && data.user.username) {
        localStorage.setItem("username", data.user.username);
      }

      // Reset 2FA state
      setRequires2FA(false);
      setTwoFAUsername("");
      setTwoFAEmail("");
      setOtp("");
      setPassword("");
      setUsername("");

      // Redirect
      window.location.href = "/home";
    } catch (err) {
      setLoading(false);
      showError("Server error. Try again later.");
    }
  };

  // ---------------- Forgot Password ----------------
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearErrorTimer();
    clearSuccessTimer();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // your backend expects `username` (username OR email). keep that.
        body: JSON.stringify({ username: resetEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Failed to send reset link");
      } else {
        showSuccess("Password reset link sent! Check your email.");
        // close forgot password view after a short delay
        setTimeout(() => {
          setIsForgotPassword(false);
          // keep message visible for its timeout
        }, 2500);
      }
    } catch (err) {
      showError("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{isLogin ? "Login" : "Register"} to JobTrackr</h1>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="auth-form" noValidate>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Enter the 6-digit verification code sent to:
              </p>
              <p style={{ fontWeight: "600", color: "var(--text)", marginTop: "0.25rem" }}>
                {twoFAEmail}
              </p>
            </div>
            <input
              className="form-input"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
                if (error) {
                  clearErrorTimer();
                  setError("");
                }
              }}
              maxLength="6"
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                letterSpacing: "0.5rem",
                fontFamily: "monospace"
              }}
              required
            />
            <button type="submit" className="btn primary" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <p className="switch">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFAUsername("");
                  setTwoFAEmail("");
                  setOtp("");
                  setError("");
                  setSuccess("");
                }}
              >
                ← Back to Login
              </button>
            </p>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="auth-form" noValidate>
            <input
              className="form-input"
              type="text"
              placeholder="Enter your username or email"
              value={resetEmail}
              onChange={handleInputChange(setResetEmail)}
              required
            />
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? "Sending reset link..." : "Send Reset Link"}
            </button>
            <p className="switch">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  // Back to login / clear everything
                  setIsForgotPassword(false);
                  resetForm();
                }}
              >
                ← Back to Login
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Username or Email */}
            <div className="username-wrapper">
              <input
                className="form-input"
                type="text"
                placeholder={isLogin ? "Username or Email" : "Username"}
                value={username}
                onChange={handleUsernameChange}
                required
              />

              {/* Username validation messages */}
              {!isLogin && username.length > 0 && (
                <p
                  className="username-status"
                  style={{
                    color:
                      username.length < 5
                        ? "#dc2626"
                        : usernameAvailable === false
                        ? "#dc2626"
                        : usernameAvailable === true
                        ? "#16a34a"
                        : "#6b7280",
                    fontSize: "0.85rem",
                    marginTop: "4px",
                    minHeight: "18px",
                  }}
                >
                  {username.length < 5
                    ? "Must be at least 5 characters"
                    : usernameAvailable === false
                    ? "Username already taken"
                    : usernameAvailable === true
                    ? "Username available"
                    : checkingUsername
                    ? "Checking..."
                    : ""}
                </p>
              )}
            </div>

            {/* Email (Register only) */}
            {!isLogin && (
              <input
                className="form-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={handleInputChange(setEmail)}
                required
              />
            )}

            {/* Password */}
            <div className="password-wrapper">
              <input
                className="form-input"
                type={passwordVisible ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={handleInputChange(setPassword)}
                required
              />
              <button
                type="button"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                className="eye-btn"
                onClick={() => setPasswordVisible((p) => !p)}
              >
                {passwordVisible ? (
                  <EyeSlashIcon
                    className="eye-icon"
                    style={{ width: "22px", height: "22px", color: "#111827" }}
                  />
                ) : (
                  <EyeIcon
                    className="eye-icon"
                    style={{ width: "22px", height: "22px", color: "#111827" }}
                  />
                )}
              </button>
            </div>

            {/* Forgot Password Button */}
            {isLogin && (
              <div style={{ textAlign: "right", marginTop: "-0.5rem" }}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    // open forgot password and clear messages
                    setIsForgotPassword(true);
                    setError("");
                    setSuccess("");
                    setResetEmail("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Confirm (register only) */}
            {!isLogin && (
              <div className="password-wrapper">
                <input
                  className="form-input"
                  type={confirmVisible ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirm}
                  onChange={handleInputChange(setConfirm)}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setConfirmVisible((p) => !p)}
                  aria-label={
                    confirmVisible ? "Hide confirm password" : "Show confirm password"
                  }
                >
                  {confirmVisible ? (
                    <EyeSlashIcon
                      className="eye-icon"
                      style={{ width: "22px", height: "22px", color: "#111827" }}
                    />
                  ) : (
                    <EyeIcon
                      className="eye-icon"
                      style={{ width: "22px", height: "22px", color: "#111827" }}
                    />
                  )}
                </button>
              </div>
            )}

            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? (isLogin ? "Logging in..." : "Registering...") : isLogin ? "Login" : "Register"}
            </button>
          </form>
        )}

        {/* Hide bottom links when in Forgot Password or 2FA mode */}
        {!isForgotPassword && !requires2FA && (
          <>
            <p className="switch">
              {isLogin ? (
                <>
                  Don’t have an account?{" "}
                  <button
                    className="link-button"
                    onClick={() => {
                      resetForm();
                      setIsLogin(false);
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="link-button"
                    onClick={() => {
                      resetForm();
                      setIsLogin(true);
                    }}
                  >
                    Login
                  </button>
                </>
              )}
            </p>

            <p className="back-home">
              <Link href="/" style={{ color: "#111827", fontWeight: "500", textDecoration: "none" }}>
                ← Back to Home
              </Link>
            </p>
          </>
        )}
      </div>

      {/* CSS preserved exactly */}
      <style jsx>{`
        :root {
          --blue: #007bff;
          --bg: #eaf3ff;
          --card-bg: #fff;
          --border: #d1d5db;
          --input-bg: #f9fafb;
          --muted: #6b7280;
          --shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .auth-page {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: var(--bg);
        }

        .auth-card {
          background: var(--card-bg);
          padding: 2.5rem;
          border-radius: 16px;
          box-shadow: var(--shadow);
          width: 100%;
          max-width: 420px;
        }

        .auth-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          text-align: center;
          color: var(--blue);
        }

        .error {
          color: #dc2626;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-align: center;
        }

        .success {
          color: #16a34a; /* Green color */
          background: #dcfce7;
          border: 1px solid #86efac;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-align: center;
          animation: fadeInOut 5s ease forwards;
        }

        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translateY(-5px);
          }
          10% {
            opacity: 1;
            transform: translateY(0);
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-5px);
          }
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-input {
          width: 100%;
          padding: 0.9rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--input-bg);
          font-size: 1rem;
          outline: none;
          transition: border 0.2s;
        }

        .form-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
        }

        .password-wrapper {
          position: relative;
          width: 100%;
        }

        .eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn.primary {
          background: var(--blue);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 0.9rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
        }

        .btn.primary:hover {
          background: #0056b3;
        }

        .switch {
          margin-top: 1.25rem;
          text-align: center;
          font-size: 0.95rem;
        }

        .link-button {
          background: none;
          border: none;
          color: var(--blue);
          cursor: pointer;
          font-weight: 600;
        }
        .username-status {
          font-size: 0.85rem;
          margin-top: 4px;
          transition: color 0.25s ease;
        }

        .back-home {
          margin-top: 1rem;
          text-align: center;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
