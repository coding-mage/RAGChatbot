import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await axios.post("/api/auth/login", { email, password });
      router.push("/dashboard");
    } catch (e) {
      setError(
        e.response?.data?.error ||
        "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Welcome back</h1>
        <p className="subtitle">Sign in to continue</p>

        <form onSubmit={handleLogin} className="form">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>

      {/* -------- STYLES -------- */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #eef2ff, #f8fafc);
          font-family: system-ui, -apple-system, BlinkMacSystemFont;
        }

        .card {
          width: 100%;
          max-width: 380px;
          background: #fff;
          border-radius: 12px;
          padding: 28px;
          box-shadow:
            0 10px 25px rgba(0, 0, 0, 0.08),
            0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .title {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
        }

        .subtitle {
          margin: 6px 0 22px;
          text-align: center;
          font-size: 14px;
          color: #666;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field label {
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .field input {
          padding: 10px 12px;
          font-size: 14px;
          border-radius: 8px;
          border: 1px solid #ddd;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .field input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }

        .error {
          font-size: 13px;
          color: #b91c1c;
          background: #fee2e2;
          padding: 8px 10px;
          border-radius: 6px;
        }

        button {
          margin-top: 8px;
          padding: 11px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: #4f46e5;
          color: #fff;
          transition: background 0.2s, transform 0.05s;
        }

        button:hover:not(:disabled) {
          background: #4338ca;
        }

        button:active:not(:disabled) {
          transform: translateY(1px);
        }

        button:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
