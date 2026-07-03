import { useState } from "react";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";

// Weekly summary widget for a single project. Shown on ProjectDetails'
// Overview tab. Same button-then-panel pattern as AIBreakdownButton, but the
// output is a rich text card (summary / highlights / concerns / next steps),
// not a task list — so it's a distinct component instead of a dialog.

export default function WeeklySummaryCard({ projectId }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (loading || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await aiApi.generateProductivityReport(projectId);
      setReport(r);
      toast.success("Weekly summary generated");
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

  const canRegenerate = Boolean(report) && !loading;

  return (
    <div className="relative bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-1">
            AI Weekly Summary
          </h3>
          <p className="text-[11px] text-gray-500">
            One-click recap of last week — highlights, risks, and what to hit
            next.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs font-semibold text-white tracking-wider uppercase px-3.5 py-2 rounded-lg border border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 hover:shadow-[0_0_25px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <>
              <Spinner className="w-3.5 h-3.5" />
              Generating…
            </>
          ) : canRegenerate ? (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              Regenerate
            </>
          ) : (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              Generate summary
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {!report && !loading && !error && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] text-[11px] text-gray-500 tracking-wider uppercase text-center">
          No summary yet — hit generate.
        </div>
      )}

      {loading && !report && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] text-[11px] text-gray-500 tracking-wider uppercase text-center">
          Analyzing this project's activity…
        </div>
      )}

      {report && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] space-y-4">
          {report.summary && (
            <div>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                {report.summary}
              </p>
            </div>
          )}

          <ReportList
            title="Highlights"
            items={report.highlights}
            accent="green"
            emptyText="No highlights called out."
          />
          <ReportList
            title="Concerns"
            items={report.concerns}
            accent="pink"
            emptyText="No concerns flagged."
          />
          <ReportList
            title="Suggested next steps"
            items={report.suggestedNextSteps}
            accent="amber"
            emptyText="No next-step suggestions."
          />
        </div>
      )}
    </div>
  );
}

function ReportList({ title, items, accent, emptyText }) {
  const accentMap = {
    green: {
      dot: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]",
      text: "text-green-300",
    },
    pink: {
      dot: "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.7)]",
      text: "text-pink-300",
    },
    amber: {
      dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
      text: "text-amber-300",
    },
  };
  const { dot, text } = accentMap[accent] || accentMap.green;
  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div>
      <p
        className={`text-[10px] font-bold tracking-[0.25em] uppercase ${text} mb-2`}
      >
        {title}
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-gray-600 italic">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] text-gray-300 leading-snug"
            >
              <span
                aria-hidden="true"
                className={`mt-[7px] inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`}
              />
              <span>{String(line)}</span>
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
