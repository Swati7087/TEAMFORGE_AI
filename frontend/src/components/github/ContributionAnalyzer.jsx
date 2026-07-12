import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as contributionApi from "../../api/contribution.api";
import { formatRelativeTime } from "../../utils/formatDate";

const AREA_STYLES = {
  frontend: "text-green-300 border-green-400/30 bg-green-400/10",
  backend: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  database: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  testing: "text-pink-300 border-pink-500/30 bg-pink-500/10",
  docs: "text-gray-300 border-white/10 bg-white/[0.04]",
  deployment: "text-gray-300 border-white/10 bg-white/[0.04]",
  devops: "text-gray-300 border-white/10 bg-white/[0.04]",
  "AI-integration": "text-pink-300 border-pink-500/30 bg-pink-500/10",
  design: "text-green-300 border-green-400/30 bg-green-400/10",
  other: "text-gray-400 border-white/10 bg-white/[0.03]",
};

export default function ContributionAnalyzer({ projectId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSaved(true);
      try {
        const saved = await contributionApi.getLatestContribution(projectId);
        if (!cancelled) setAnalysis(saved);
      } catch (err) {
        if (err?.response?.status !== 404 && !cancelled) {
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load saved analysis"
          );
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const runAnalysis = async () => {
    if (loading || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await contributionApi.generateContributionAnalysis(
        projectId
      );
      setAnalysis(result);
      toast.success("Contribution analysis complete");
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

  if (loadingSaved) {
    return (
      <div className="flex items-center justify-center py-10 gap-3">
        <Spinner className="w-5 h-5 text-pink-400" />
        <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">
          Loading analysis…
        </p>
      </div>
    );
  }

  const contributors = analysis?.contributors || [];
  const hasAnalysis = contributors.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-1">
            AI Contribution Analysis
          </h3>
          <p className="text-[11px] text-gray-500 max-w-md">
            Gemini interprets who worked on what — frontend, backend, testing, and
            more — based on real commit history and file paths.
          </p>
          {analysis?.generatedAt && (
            <p className="text-[10px] text-gray-600 mt-1.5 tracking-[0.15em] uppercase">
              Snapshot from {formatRelativeTime(analysis.generatedAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2 rounded-lg border border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 hover:shadow-[0_0_25px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                Analyzing…
              </>
            ) : hasAnalysis ? (
              <>
                <SparklesIcon className="w-3.5 h-3.5" />
                Re-analyze
              </>
            ) : (
              <>
                <SparklesIcon className="w-3.5 h-3.5" />
                Analyze Contributions
              </>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 mb-4">
          Analyzing commit history… this fetches GitHub data and runs AI — may
          take 15–30 seconds.
        </p>
      )}

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!hasAnalysis && !loading && !error && (
        <p className="text-xs text-gray-600 italic text-center py-8">
          No analysis yet — hit Analyze Contributions to interpret your team's
          GitHub activity.
        </p>
      )}

      {hasAnalysis && (
        <ul className="space-y-4">
          {[...contributors]
            .sort(
              (a, b) =>
                (b.contributionPercentage || 0) - (a.contributionPercentage || 0)
            )
            .map((c) => (
              <li
                key={c.githubUsername}
                className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center text-sm font-bold shrink-0">
                    {c.githubUsername?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {c.githubUsername}
                      </span>
                      {c.user?.name && (
                        <span className="text-[11px] text-gray-500">
                          → {c.user.name} on TeamForge
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {c.commitCount} commit{c.commitCount === 1 ? "" : "s"}
                      {(c.linesAdded > 0 || c.linesDeleted > 0) && (
                        <>
                          {" "}
                          · +{c.linesAdded} / -{c.linesDeleted} lines
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-pink-300 shrink-0">
                    {c.contributionPercentage ?? 0}%
                  </span>
                </div>

                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-pink-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, c.contributionPercentage || 0))}%`,
                    }}
                  />
                </div>

                {c.areas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {c.areas.map((area) => (
                      <span
                        key={area}
                        className={`text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${
                          AREA_STYLES[area] || AREA_STYLES.other
                        }`}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                )}

                {c.summary && (
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {c.summary}
                  </p>
                )}
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
