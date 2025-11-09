import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function TokenPage() {
  const router = useRouter();
  const { token } = router.query;
  const path = router.asPath.toLowerCase();

  // Common states
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(100);
  const hasRun = useRef(false);

  // Password states (only for reset)
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const isReset = path.includes("reset");

  // Countdown for progress bar (for success messages)
  useEffect(() => {
    if (status) {
      setProgress(100);
      const interval = setInterval(() => setProgress((p) => (p > 0 ? p - 2 : 0)), 100);
      const timeout = setTimeout(() => setStatus(""), 5000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [status]);

  // 🔹 Handle Email Verification Automatically
  useEffect(() => {
  if (!token || !path.includes("verify") || hasRun.current) return;
  hasRun.current = true;

  const verifyEmail = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("✅ Email verified successfully! Redirecting to login...");
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(data.error || "❌ Invalid or expired token.");
      }
    } catch (error) {
      setError("❌ Server error. Please try again later.");
      console.error("Verification error:", error);
    }
  };

  verifyEmail();
}, [token, path, router]);

  // 🔹 Handle Password Reset (manual form)
  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/reset-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, password }),
});

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
      } else {
        setStatus("✅ Password reset successful! Redirecting to login...");
        setTimeout(() => router.push("/login"), 2500);
      }
    } catch {
      setError("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          {isReset ? "Reset Your Password" : "Email Verification"}
        </h1>

        {error && <p className="error">{error}</p>}
        {status && (
          <div className="success">
            {status}
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {/* Only show reset form if it's a password reset route */}
        {isReset && (
          <form onSubmit={handleReset} className="auth-form" noValidate>
            <div className="password-wrapper">
              <input
                className="form-input"
                type={passwordVisible ? "text" : "password"}
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setPasswordVisible((prev) => !prev)}
              >
                {passwordVisible ? (
                  <EyeSlashIcon className="eye-icon" style={{ width: "22px", height: "22px", color: "#111827" }} />
                ) : (
                  <EyeIcon className="eye-icon" style={{ width: "22px", height: "22px", color: "#111827" }} />
                )}
              </button>
            </div>

            <div className="password-wrapper">
              <input
                className="form-input"
                type={confirmVisible ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setConfirmVisible((prev) => !prev)}
              >
                {confirmVisible ? (
                  <EyeSlashIcon className="eye-icon" style={{ width: "22px", height: "22px", color: "#111827" }} />
                ) : (
                  <EyeIcon className="eye-icon" style={{ width: "22px", height: "22px", color: "#111827" }} />
                )}
              </button>
            </div>

            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {!isReset && (
          <button
            className="link-button"
            onClick={() => router.push("/login")}
            style={{ marginTop: "1rem" }}
          >
            ← Back to Login
          </button>
        )}
      </div>

      {/* ✅ Shared CSS styling */}
      <style jsx>{`
        :root {
          --blue: #007bff;
          --bg: #eaf3ff;
          --card-bg: #fff;
          --border: #d1d5db;
          --input-bg: #f9fafb;
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
          text-align: center;
        }

        .auth-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: var(--blue);
        }

        .error {
          color: #dc2626;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .success {
          color: #16a34a;
          background: #dcfce7;
          border: 1px solid #86efac;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          position: relative;
          overflow: hidden;
        }

        .progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 4px;
          background-color: #16a34a;
          transition: width 0.1s linear;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
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
        }

        .form-input {
          width: 100%;
          padding: 0.9rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--input-bg);
          font-size: 1rem;
          outline: none;
        }

        .form-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
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

        .link-button {
          background: none;
          border: none;
          color: var(--blue);
          cursor: pointer;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}