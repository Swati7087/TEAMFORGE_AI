import { useState } from "react";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";

export default function SkillGapPanel({ projectId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCheck = async () => {
    if (loading || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.analyzeSkillGap(projectId);
      setResult(data);
      toast.success("Skill gap analysis ready");
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

  return (
    <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-1">
            Skill Gap Detector
          </h3>
          <p className="text-[11px] text-gray-500">
            See what your team covers vs what the project still needs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCheck}
          disabled={loading}
          className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2 rounded-lg border border-green-400/40 bg-green-500/10 hover:bg-green-500/20 hover:shadow-[0_0_25px_rgba(74,222,128,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Spinner className="w-3.5 h-3.5" />
              Analyzing…
            </>
          ) : (
            "Check Skill Gaps"
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!result && !loading && !error && (
        <p className="text-xs text-gray-600 italic">
          Run an analysis to compare team skills against the project tech stack.
        </p>
      )}

      {result && (
        <div className="space-y-4">
          {result.missingSkills?.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-pink-300 mb-2">
                Missing
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border text-pink-300 border-pink-500/30 bg-pink-500/10"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.coveredSkills?.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-green-300 mb-2">
                Covered
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.coveredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border text-green-300 border-green-400/30 bg-green-400/10"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-300 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-300 leading-relaxed pl-3 border-l-2 border-amber-400/30"
                  >
                    {rec.skill && (
                      <span className="text-amber-300 font-medium">
                        {rec.skill}:{" "}
                      </span>
                    )}
                    {rec.suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
