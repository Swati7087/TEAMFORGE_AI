import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useProject } from "../hooks/useProjects";
import * as aiApi from "../api/ai.api";
import { formatRelativeTime } from "../utils/formatDate";

const PRIORITY_STYLE = {
  high: "text-pink-300 border-pink-500/30 bg-pink-500/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  low: "text-green-300 border-green-400/30 bg-green-400/10",
};

export default function MeetingNotes() {
  const { id: projectId } = useParams();
  const { project, loading, error } = useProject(projectId);

  const [rawNotes, setRawNotes] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const loadHistory = async () => {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const items = await aiApi.getMeetingHistory(projectId);
      setHistory(Array.isArray(items) ? items : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSummarize = async () => {
    if (!rawNotes.trim() || summarizing) return;
    setSummarizing(true);
    setApiError(null);
    try {
      const data = await aiApi.summarizeMeeting(projectId, rawNotes.trim());
      setResult(data);
      toast.success("Meeting summarized");
      await loadHistory();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      setApiError(msg);
      toast.error(msg);
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-sm text-gray-500 tracking-[0.25em] uppercase">
          Loading…
        </p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-pink-400 text-sm">{error || "Project not found"}</p>
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-green-500/[0.08] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-500/[0.08] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to={`/projects/${projectId}`}
            className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
          >
            ← {project.title}
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Meeting Notes
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Paste raw notes from your sync — AI will extract a summary, action
          items, and next-meeting goals.
        </p>

        <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5 mb-6">
          <label
            htmlFor="raw-notes"
            className="block text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-3"
          >
            Raw meeting notes
          </label>
          <textarea
            id="raw-notes"
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            rows={10}
            placeholder="e.g. Rahul will finish the auth API by Friday. Priya is blocked on MongoDB indexes. We agreed to demo the login flow next Tuesday…"
            className="w-full rounded-lg bg-[#050508] border border-white/10 text-sm text-gray-200 placeholder:text-gray-600 px-4 py-3 focus:outline-none focus:border-green-400/40 resize-y min-h-[180px]"
          />

          {apiError && (
            <p className="mt-3 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2">
              {apiError}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSummarize}
              disabled={summarizing || !rawNotes.trim()}
              className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2.5 rounded-lg border border-green-400/40 bg-green-500/10 hover:bg-green-500/20 hover:shadow-[0_0_25px_rgba(74,222,128,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {summarizing ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  Summarizing…
                </>
              ) : (
                "Summarize with AI"
              )}
            </button>
          </div>
        </div>

        {result && (
          <SummaryPanel title="Latest summary" data={result} className="mb-6" />
        )}

        <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-4">
            Meeting history
          </h3>

          {historyLoading && (
            <p className="text-xs text-gray-600 tracking-wider uppercase">
              Loading history…
            </p>
          )}

          {!historyLoading && history.length === 0 && (
            <p className="text-xs text-gray-600 italic">
              No past summaries yet — summarize your first meeting above.
            </p>
          )}

          {!historyLoading && history.length > 0 && (
            <ul className="space-y-4">
              {history.map((entry) => (
                <li
                  key={entry.meetingId}
                  className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] text-gray-500 tracking-wider uppercase">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      by {entry.createdByName}
                    </span>
                  </div>
                  <SummaryPanel data={entry} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({ title, data, compact = false, className = "" }) {
  const actionItems = Array.isArray(data?.actionItems) ? data.actionItems : [];
  const goals = Array.isArray(data?.nextMeetingGoals)
    ? data.nextMeetingGoals
    : [];

  return (
    <div className={className}>
      {title && (
        <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-3">
          {title}
        </h3>
      )}

      {data?.summary && (
        <p
          className={`text-gray-200 leading-relaxed whitespace-pre-line ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {data.summary}
        </p>
      )}

      {actionItems.length > 0 && (
        <div className={compact ? "mt-3" : "mt-5"}>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-amber-300 mb-2">
            Action items
          </p>
          <ul className="space-y-2">
            {actionItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block w-4 h-4 rounded border border-white/20 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{item.task}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    → {item.assignedTo || "Unassigned"}
                  </p>
                </div>
                <span
                  className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border shrink-0 ${
                    PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium
                  }`}
                >
                  {item.priority || "medium"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {goals.length > 0 && (
        <div className={compact ? "mt-3" : "mt-5"}>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-pink-300 mb-2">
            Next meeting goals
          </p>
          <ul className="space-y-1.5">
            {goals.map((goal, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-gray-300"
              >
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-pink-500 shrink-0" />
                <span>{goal}</span>
              </li>
            ))}
          </ul>
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
