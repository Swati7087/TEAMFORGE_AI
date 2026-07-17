import { useState } from "react";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";
import * as teamApi from "../../api/team.api";

export default function TeamMatcherPanel({ projectId, onInvited }) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const handleFindMatches = async () => {
    if (loading || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.matchTeam(projectId);
      setMatches(Array.isArray(result) ? result : []);
      if (!result?.length) {
        toast.info("No matching candidates found");
      } else {
        toast.success(`Found ${result.length} potential match${result.length === 1 ? "" : "es"}`);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId) => {
    setBusyId(userId);
    try {
      await teamApi.inviteToTeam(projectId, { userId });
      toast.success("Invite sent");
      onInvited?.();
      setMatches((prev) =>
        prev ? prev.filter((m) => m.userId !== userId) : prev
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err.message || "Invite failed"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-1">
            AI Team Matcher
          </h3>
          <p className="text-[11px] text-gray-500">
            Find students whose skills fill gaps on your team.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFindMatches}
          disabled={loading}
          className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2 rounded-lg border border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 hover:shadow-[0_0_25px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Spinner className="w-3.5 h-3.5" />
              Finding matches…
            </>
          ) : (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              Find Matches
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!matches && !loading && !error && (
        <p className="text-xs text-gray-600 italic">
          Hit Find Matches to get AI-ranked invite suggestions.
        </p>
      )}

      {matches && matches.length === 0 && !loading && (
        <p className="text-xs text-gray-600 italic">
          No candidates available right now.
        </p>
      )}

      {matches && matches.length > 0 && (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-start gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]"
            >
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center text-sm font-bold shrink-0">
                {m.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">
                    {m.name}
                  </span>
                  <span className="text-xs font-bold text-pink-300">
                    {m.matchScore}% match
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2 max-w-xs">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-pink-500"
                    style={{ width: `${Math.min(100, m.matchScore || 0)}%` }}
                  />
                </div>
                {m.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.skills.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded border border-white/10 text-gray-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {m.reason && (
                  <p className="text-[12px] text-gray-400 leading-snug">
                    {m.reason}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleInvite(m.userId)}
                disabled={busyId === m.userId}
                className="text-[10px] font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors disabled:opacity-40 shrink-0"
              >
                {busyId === m.userId ? "…" : "Invite"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SparklesIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
    </svg>
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
