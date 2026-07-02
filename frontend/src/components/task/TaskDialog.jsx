import { useEffect, useState } from "react";

// Reusable dialog for creating + editing tasks. Kept as a bespoke modal
// (rather than shadcn's Dialog) so it perfectly matches the Terminal Punk
// glassmorphic card treatment used everywhere else in the app.

const PRIORITIES = ["low", "medium", "high"];
const DIFFICULTIES = ["easy", "medium", "hard"];

function toDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function TaskDialog({
  mode = "create",
  task = null,
  initialStatus = "todo",
  members = [],
  currentUserId,
  ownerId,
  onClose,
  onSubmit,
  onDelete,
}) {
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignedTo: task?.assignedTo?._id || task?.assignedTo || "",
    priority: task?.priority ?? "medium",
    difficulty: task?.difficulty ?? "medium",
    deadline: toDateInput(task?.deadline),
    status: task?.status ?? initialStatus,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Escape key closes.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const canDelete =
    mode === "edit" &&
    task &&
    (ownerId === currentUserId ||
      (task.assignedTo?._id || task.assignedTo) === currentUserId);

  const canEditStatusOnly = false; // status here is only in create mode; PATCH endpoint handles drag-to-status separately

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        assignedTo: form.assignedTo || null,
        priority: form.priority,
        difficulty: form.difficulty,
        deadline: form.deadline || null,
      };
      // Status is only settable at create time (dragging changes it after).
      if (mode === "create") payload.status = form.status;
      await onSubmit?.(payload);
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="relative w-full max-w-lg">
        {/* Gradient border glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/30 via-transparent to-pink-500/30 opacity-60 blur-sm pointer-events-none" />

        <form
          onSubmit={handleSubmit}
          className="relative bg-[#0a0a12]/85 backdrop-blur-md border border-white/[0.12] rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {mode === "create" ? "New task" : "Edit task"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-white w-8 h-8 rounded flex items-center justify-center hover:bg-white/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Title
              </label>
              <input
                value={form.title}
                onChange={set("title")}
                required
                autoFocus
                placeholder="What needs to be done?"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={set("description")}
                rows={3}
                placeholder="Optional detail…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors resize-none"
              />
            </div>

            {/* Assignee + Deadline row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                  Assignee
                </label>
                <select
                  value={form.assignedTo || ""}
                  onChange={set("assignedTo")}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50 [&>option]:bg-[#0a0a12]"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                  Deadline
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={set("deadline")}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50 [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Priority + Difficulty row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={set("priority")}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50 [&>option]:bg-[#0a0a12]"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                  Difficulty
                </label>
                <select
                  value={form.difficulty}
                  onChange={set("difficulty")}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50 [&>option]:bg-[#0a0a12]"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column (only when creating) */}
            {mode === "create" && (
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                  Column
                </label>
                <select
                  value={form.status}
                  onChange={set("status")}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50 [&>option]:bg-[#0a0a12]"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            )}

            {error && (
              <p className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-white/[0.06]">
            <div>
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Delete this task?")) await onDelete();
                  }}
                  className="text-xs text-pink-400 hover:text-pink-300 tracking-wider uppercase"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "…" : mode === "create" ? "Create task" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
