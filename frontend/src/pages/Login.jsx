import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import FloatingShapes from "../components/common/FloatingShapes";
import FloatingCube from "../components/common/FloatingCube";

const inputCls =
  "w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-green-400/60 focus:ring-2 focus:ring-green-400/20 focus:outline-none transition-all duration-200";

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await loginUser(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogle() {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
  }

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] bg-green-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] bg-pink-500/15 rounded-full blur-[140px] pointer-events-none" />
      <FloatingShapes />
      {/* Central cube — sits directly behind the card so it's visible through the glass */}
      <FloatingCube
        size={180}
        color="amber"
        speed="slow"
        floatDelay={3}
        className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      />

      <div className="relative w-full max-w-md">
        {/* Subtle gradient border glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/30 via-transparent to-pink-500/30 opacity-60 blur-sm" />

        <div className="relative bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.12] rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <div className="text-2xl font-bold text-white">
                Team
                <span className="bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent">
                  Forge
                </span>
              </div>
            </Link>
            <h1 className="text-xl font-semibold text-white mt-4">Welcome back</h1>
            <p className="text-sm text-gray-400 mt-1">Log in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputCls}
              />
            </div>

            {error && (
              <div className="border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-green-500 to-pink-500 text-white font-semibold py-2.5 rounded-lg hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-none"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">
              or
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full border border-white/10 bg-white/[0.02] rounded-lg py-2.5 text-gray-200 font-medium hover:bg-white/[0.06] hover:border-white/20 transition-all duration-200"
          >
            Continue with Google
          </button>

          <p className="text-sm text-center text-gray-400 mt-6">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-green-400 hover:text-green-300 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
