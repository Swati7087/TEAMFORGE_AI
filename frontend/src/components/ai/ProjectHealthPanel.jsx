import { useState } from "react";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";

const SEVERITY_BORDER = {
  low: "border-l-green-400",
  medium: "border-l-amber-400",
  high: "border-l-pink-500",
};

const SEVERITY_BADGE = {
  low: "text-green-300 border-green-400/30 bg-green-400/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  high: "text-pink-300 border-pink-500/30 bg-pink-500/10",
};

const CATEGORY_LABEL = {
  technical: "Technical",
  team: "Team",
  timeline: "Timeline",
};

export default function ProjectHealthPanel({
  projectId,
  hasTimeline = false,
  disabled = false,
  onLoadingChange,
}) {
  const [bottleneckLoading, setBottleneckLoading] = useState(false);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);

  const [bottlenecks, setBottlenecks] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [risks, setRisks] = useState(null);

  const [bottleneckError, setBottleneckError] = useState(null);
  const [deadlineError, setDeadlineError] = useState(null);
  const [riskError, setRiskError] = useState(null);

  const anyCardLoading =
    bottleneckLoading || deadlineLoading || riskLoading;
  const buttonsDisabled = disabled || anyCardLoading;

  const wrapAnalyze = async (setCardLoading, fn, onSuccess, setError) => {
    if (disabled || !projectId || anyCardLoading) return;

    setCardLoading(true);
    setError(null);
    onLoadingChange?.(true);
    try {
      const data = await fn(projectId);
      onSuccess(data);
      toast.success("Analysis complete");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      setError(msg);
      toast.error(msg);
    } finally {
      setCardLoading(false);
      onLoadingChange?.(false);
    }
  };

  const handleBottleneck = () =>
    wrapAnalyze(
      setBottleneckLoading,
      aiApi.detectBottlenecks,
      setBottlenecks,
      setBottleneckError
    );

  const handleDeadline = () =>
    wrapAnalyze(
      setDeadlineLoading,
      aiApi.predictDeadline,
      setDeadline,
      setDeadlineError
    );

  const handleRisk = () =>
    wrapAnalyze(
      setRiskLoading,
      aiApi.analyzeProjectRisk,
      setRisks,
      setRiskError
    );

  return (
    <div className="space-y-4">
      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
        <p className="text-[11px] text-gray-500 mb-4">
          AI-powered project health checks using your live task data. Run one
          analysis at a time on the free Gemini tier.
        </p>

        {/* Bottleneck Detector */}
        <section className="border border-white/[0.06] rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-1">
                Bottleneck Detector
              </h3>
              <p className="text-[11px] text-gray-500">
                Surfaces overdue work, unassigned clusters, and overloaded
                members.
              </p>
            </div>
            <AnalyzeButton
              onClick={handleBottleneck}
              loading={bottleneckLoading}
              disabled={buttonsDisabled}
              label="Analyze bottlenecks"
              accent="green"
            />
          </div>

          {bottleneckError && <ErrorBox message={bottleneckError} />}

          {bottlenecks && (
            <div className="space-y-3">
              {bottlenecks.insufficientData && (
                <InfoBox message={bottlenecks.summary || bottlenecks.message} />
              )}
              {!bottlenecks.insufficientData &&
                bottlenecks.bottlenecks?.length === 0 && (
                  <p className="text-xs text-green-300/90">{bottlenecks.summary}</p>
                )}
              {bottlenecks.bottlenecks?.map((b, i) => (
                <div
                  key={`${b.type}-${i}`}
                  className={`border-l-4 ${SEVERITY_BORDER[b.severity] || SEVERITY_BORDER.medium} bg-white/[0.02] rounded-r-lg px-3 py-2.5`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${SEVERITY_BADGE[b.severity] || SEVERITY_BADGE.medium}`}
                    >
                      {b.severity || "medium"}
                    </span>
                    <span className="text-[9px] text-gray-500 tracking-wider uppercase">
                      {String(b.type || "").replace(/-/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {b.description}
                  </p>
                  {b.affectedTasks?.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {b.affectedTasks.map((t) => (
                        <li key={t} className="text-[11px] text-gray-500">
                          · {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {!bottlenecks.insufficientData && bottlenecks.summary && (
                <p className="text-[11px] text-gray-500 border-t border-white/[0.06] pt-3">
                  {bottlenecks.summary}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Deadline Predictor */}
        <section className="border border-white/[0.06] rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-amber-300 mb-1">
                Deadline Predictor
              </h3>
              <p className="text-[11px] text-gray-500">
                {hasTimeline
                  ? "Estimate completion probability before your project deadline."
                  : "Set a project timeline on Overview to unlock deadline prediction."}
              </p>
            </div>
            <AnalyzeButton
              onClick={handleDeadline}
              loading={deadlineLoading}
              disabled={buttonsDisabled}
              label="Predict deadline"
              accent="amber"
            />
          </div>

          {deadlineError && <ErrorBox message={deadlineError} />}

          {deadline && (
            <div>
              {deadline.insufficientData || deadline.completionProbability == null ? (
                <InfoBox message={deadline.reasoning || deadline.message} />
              ) : (
                <>
                  <div className="flex items-end gap-3 mb-3">
                    <div className="text-5xl font-bold text-white tabular-nums">
                      {deadline.completionProbability}
                      <span className="text-2xl text-gray-500">%</span>
                    </div>
                    <p className="text-xs text-gray-400 pb-2 flex-1">
                      chance of completing before the deadline
                    </p>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">
                    {deadline.reasoning}
                  </p>
                  {deadline.riskFactors?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-[9px] font-bold tracking-[0.2em] uppercase text-pink-300 mb-2">
                        Risk factors
                      </h4>
                      <ul className="space-y-1">
                        {deadline.riskFactors.map((r) => (
                          <li key={r} className="text-xs text-gray-400">
                            · {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deadline.recommendedActions?.length > 0 && (
                    <div>
                      <h4 className="text-[9px] font-bold tracking-[0.2em] uppercase text-amber-300 mb-2">
                        Recommended actions
                      </h4>
                      <ul className="space-y-1">
                        {deadline.recommendedActions.map((a) => (
                          <li key={a} className="text-xs text-gray-400">
                            · {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* Risk Analyzer */}
        <section className="border border-white/[0.06] rounded-lg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-1">
                Risk Analyzer
              </h3>
              <p className="text-[11px] text-gray-500">
                Technical, team, and timeline risks with mitigations.
              </p>
            </div>
            <AnalyzeButton
              onClick={handleRisk}
              loading={riskLoading}
              disabled={buttonsDisabled}
              label="Analyze risks"
              accent="pink"
            />
          </div>

          {riskError && <ErrorBox message={riskError} />}

          {risks && (
            <div className="space-y-3">
              {risks.insufficientData && (
                <InfoBox message={risks.message} />
              )}
              {!risks.insufficientData && risks.risks?.length === 0 && (
                <p className="text-xs text-green-300/90">
                  No significant risks detected for this project.
                </p>
              )}
              {risks.risks?.map((r, i) => (
                <div
                  key={`${r.category}-${i}`}
                  className={`border-l-4 ${SEVERITY_BORDER[r.severity] || SEVERITY_BORDER.medium} bg-white/[0.02] rounded-r-lg px-3 py-2.5`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-gray-400">
                      {CATEGORY_LABEL[r.category] || r.category}
                    </span>
                    <span
                      className={`text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${SEVERITY_BADGE[r.severity] || SEVERITY_BADGE.medium}`}
                    >
                      {r.severity || "medium"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed mb-2">
                    {r.description}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    <span className="text-green-400/80">Mitigation:</span>{" "}
                    {r.mitigation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AnalyzeButton({ onClick, loading, disabled, label, accent }) {
  const styles = {
    green:
      "border-green-400/40 bg-green-500/10 hover:bg-green-500/20 hover:shadow-[0_0_25px_rgba(74,222,128,0.25)]",
    amber:
      "border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 hover:shadow-[0_0_25px_rgba(251,191,36,0.25)]",
    pink: "border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 hover:shadow-[0_0_25px_rgba(236,72,153,0.25)]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`text-xs font-semibold text-white tracking-wider uppercase px-3.5 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap ${styles[accent]}`}
    >
      {loading ? (
        <>
          <Spinner />
          Analyzing…
        </>
      ) : (
        label
      )}
    </button>
  );
}

function ErrorBox({ message }) {
  return (
    <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-3">
      {message}
    </p>
  );
}

function InfoBox({ message }) {
  return (
    <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/20 rounded px-3 py-2">
      {message}
    </p>
  );
}

function Spinner({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
