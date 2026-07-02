import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as projectApi from "../api/project.api";

// Manual project creation form. AI generation shows up in Phase 3 — this page
// stays as the fallback path even after that lands.
export default function CreateProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    techStack: "",
    timeline: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

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
        description: form.description.trim(),
        // Comma-separated free text → clean array on the backend.
        techStack: form.techStack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        timeline: form.timeline.trim(),
      };
      const project = await projectApi.createProject(payload);
      navigate(`/projects/${project._id}`);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to create project"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative w-full max-w-xl">
        {/* Breadcrumb */}
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase mb-4 inline-block"
        >
          ← Dashboard
        </Link>

        {/* Gradient border glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/30 via-transparent to-pink-500/30 opacity-60 blur-sm pointer-events-none" />

        <form
          onSubmit={handleSubmit}
          className="relative bg-[#0a0a12]/70 backdrop-blur-md border border-white/[0.12] rounded-2xl p-8 shadow-2xl"
        >
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-400/30 bg-green-400/5 text-green-300 text-[10px] font-medium tracking-[0.2em] uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
              New Project
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Spin up a new project
            </h1>
            <p className="text-sm text-gray-400">
              Fill in the essentials. You can invite teammates and add tasks
              from the project page once it's created.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Title
              </label>
              <input
                value={form.title}
                onChange={set("title")}
                required
                autoFocus
                placeholder="e.g. AI Study Buddy"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={set("description")}
                rows={4}
                placeholder="What problem does it solve? Who is it for?"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Tech stack
              </label>
              <input
                value={form.techStack}
                onChange={set("techStack")}
                placeholder="React, Node, MongoDB"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors"
              />
              <p className="text-[10px] text-gray-600 mt-1.5">
                Comma-separated. You can edit these later.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
                Timeline
              </label>
              <input
                value={form.timeline}
                onChange={set("timeline")}
                placeholder="e.g. 2 weeks, end of sprint"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 focus:bg-white/[0.05] transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-8 pt-5 border-t border-white/[0.06]">
            <Link
              to="/dashboard"
              className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
