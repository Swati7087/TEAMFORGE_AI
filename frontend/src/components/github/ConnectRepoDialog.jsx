import { useEffect, useState } from "react";
import * as githubApi from "../../api/github.api";

// Owner-only dialog. Token is write-only — submitted in the request body
// and never logged or stored client-side.

export default function ConnectRepoDialog({
  projectId,
  onClose,
  onConnected,
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await githubApi.connectRepository(projectId, repoUrl.trim(), token);
      setToken("");
      onConnected?.();
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to connect repository"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/30 via-transparent to-pink-500/30 opacity-60 blur-sm pointer-events-none" />

        <form
          onSubmit={handleSubmit}
          className="relative bg-[#0a0a12]/85 backdrop-blur-md border border-white/[0.12] rounded-2xl p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-green-400/30 bg-green-400/5 text-green-300 text-[9px] font-medium tracking-[0.25em] uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                GitHub
              </div>
              <h2 className="text-lg font-bold text-white">Connect repository</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-gray-500 hover:text-white w-8 h-8 rounded flex items-center justify-center hover:bg-white/5 disabled:opacity-40"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <label className="block mb-4">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
              Repository URL
            </span>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 disabled:opacity-50"
              autoFocus
            />
          </label>

          <label className="block mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
              Personal Access Token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_… or github_pat_…"
              required
              disabled={loading}
              autoComplete="off"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 disabled:opacity-50"
            />
          </label>

          <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
            Generate a fine-grained token at github.com → Settings → Developer
            settings, scoped to this repo with read-only access to Contents,
            Pull requests, and Issues.
          </p>

          {error && (
            <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !repoUrl.trim() || !token.trim()}
              className="text-sm font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Spinner({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} animate-spin`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
