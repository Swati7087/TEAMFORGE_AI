import { useEffect, useMemo, useState } from "react";

// Hand-rolled Terminal Punk modal that shows AI-generated tasks and lets the
// user selectively add them to the board. We keep shadcn's Dialog out of the
// picture for the same reason as TaskDialog: its v4-only utilities don't
// animate on our Tailwind v3 setup.
//
// This dialog NEVER writes tasks itself. It calls `onCreate(payload)` per
// checked item — that hook is the existing Phase-2 createTask flow, which
// hits POST /api/tasks with membership auth already enforced.

const DIFFICULTY_STYLES = {
  easy: "text-green-300 border-green-400/30 bg-green-400/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  hard: "text-pink-300 border-pink-400/30 bg-pink-400/10",
};

const PRIORITY_STYLES = {
  low: "text-gray-400 border-white/10 bg-white/[0.04]",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  high: "text-pink-300 border-pink-400/30 bg-pink-400/10",
};

const ALLOWED_DIFFICULTY = new Set(["easy", "medium", "hard"]);
const ALLOWED_PRIORITY = new Set(["low", "medium", "high"]);

function normalizeTask(t) {
  return {
    title: String(t?.title || "").trim(),
    description: String(t?.description || "").trim(),
    difficulty: ALLOWED_DIFFICULTY.has(t?.difficulty) ? t.difficulty : "medium",
    priority: ALLOWED_PRIORITY.has(t?.priority) ? t.priority : "medium",
    estimatedTime: String(t?.estimatedTime || "").trim(),
    suggestedRole: String(t?.suggestedRole || "").trim(),
  };
}

export default function AIBreakdownDialog({
  tasks: rawTasks = [],
  onClose,
  onCreate,
}) {
  // Normalize once so downstream code always sees clean shapes even if Gemini
  // occasionally omits a field.
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks]);

  // All pre-checked per spec.
  const [checked, setChecked] = useState(() => tasks.map(() => true));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !adding) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, adding]);

  const toggle = (i) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const setAll = (val) => setChecked(tasks.map(() => val));

  const checkedCount = checked.filter(Boolean).length;

  const handleAdd = async () => {
    if (checkedCount === 0) return;
    setAdding(true);
    setError(null);
    const selected = tasks.filter((_, i) => checked[i]);
    setProgress({ done: 0, total: selected.length });

    // Sequential creation so the ordering in the resulting list matches the
    // dialog order. Also plays nicer with the backend if it ever adds
    // rate-limiting.
    for (let i = 0; i < selected.length; i++) {
      const t = selected[i];
      const payload = {
        title: t.title || "Untitled task",
        description: t.suggestedRole
          ? `${t.description ? t.description + "\n\n" : ""}Suggested role: ${t.suggestedRole}`
          : t.description,
        priority: t.priority,
        difficulty: t.difficulty,
        estimatedTime: t.estimatedTime,
        status: "todo",
      };
      try {
        await onCreate(payload);
        setProgress({ done: i + 1, total: selected.length });
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to add some tasks"
        );
        setAdding(false);
        return; // Stop on the first failure; user can close and retry.
      }
    }
    setAdding(false);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !adding) onClose?.();
      }}
    >
      <div className="relative w-full max-w-2xl">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-pink-500/40 via-transparent to-green-500/30 opacity-60 blur-sm pointer-events-none" />

        <div className="relative bg-[#0a0a12]/90 backdrop-blur-md border border-white/[0.12] rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-pink-400/30 bg-pink-400/5 text-pink-300 text-[9px] font-medium tracking-[0.25em] uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse" />
                AI Breakdown
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {tasks.length} suggested task{tasks.length === 1 ? "" : "s"}
              </h2>
              <p className="text-[11px] text-gray-500 mt-1">
                Uncheck anything you don't want, then add the rest to the To Do
                column.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="text-gray-500 hover:text-white w-8 h-8 rounded flex items-center justify-center hover:bg-white/5 disabled:opacity-40"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Select all / none */}
          <div className="flex items-center justify-between mb-3 text-[10px] tracking-[0.2em] uppercase">
            <span className="text-gray-500">
              {checkedCount} of {tasks.length} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAll(true)}
                disabled={adding}
                className="text-gray-400 hover:text-green-300 disabled:opacity-40"
              >
                Select all
              </button>
              <span className="text-gray-700">·</span>
              <button
                type="button"
                onClick={() => setAll(false)}
                disabled={adding}
                className="text-gray-400 hover:text-pink-300 disabled:opacity-40"
              >
                Select none
              </button>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {tasks.map((t, i) => (
              <label
                key={i}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked[i]
                    ? "border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.06]"
                    : "border-white/[0.06] bg-transparent opacity-55 hover:opacity-80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  disabled={adding}
                  className="mt-1 h-4 w-4 accent-pink-500 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {t.title || "Untitled task"}
                  </div>
                  {t.description && (
                    <div className="text-[12px] text-gray-400 mt-0.5 leading-snug">
                      {t.description}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span
                      className={`text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${
                        DIFFICULTY_STYLES[t.difficulty] || DIFFICULTY_STYLES.medium
                      }`}
                    >
                      {t.difficulty}
                    </span>
                    <span
                      className={`text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${
                        PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium
                      }`}
                    >
                      {t.priority} priority
                    </span>
                    {t.estimatedTime && (
                      <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-white/10 text-gray-400 bg-white/[0.03]">
                        {t.estimatedTime}
                      </span>
                    )}
                    {t.suggestedRole && (
                      <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-white/10 text-gray-400 bg-white/[0.03]">
                        {t.suggestedRole}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2">
              {error}
              {progress.total > 0 && (
                <span className="block text-[10px] text-gray-400 mt-1">
                  Added {progress.done} of {progress.total} before failure.
                </span>
              )}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/[0.06]">
            <span className="text-[10px] text-gray-600 tracking-[0.2em] uppercase">
              {adding
                ? `Adding ${progress.done} / ${progress.total}…`
                : `New tasks will land in the To Do column.`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={adding}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || checkedCount === 0}
                className="text-sm font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {adding
                  ? "Adding…"
                  : `Add ${checkedCount} task${checkedCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
