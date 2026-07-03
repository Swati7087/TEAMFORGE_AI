import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as projectApi from "../api/project.api";
import * as aiApi from "../api/ai.api";

// Manual project creation form + an AI-assisted section on top.
// The AI section only pre-fills the manual form; it never auto-submits — the
// user always gets a chance to review/edit before hitting "Create project".
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

  // AI-assist state (kept separate so an AI error never blocks the manual form).
  const [idea, setIdea] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiHint, setAiHint] = useState(null); // "Prefilled ..." after success

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Guard against garbage input that would still burn a Gemini call. We layer
  // a few cheap heuristics that together catch: single symbols ("/"), digits
  // only ("123"), too-short input ("hi"), and keyboard-mash gibberish
  // ("aftrgg 8uik o"). Rules:
  //   1. Trimmed length >= 10
  //   2. Contains at least one alphabetic run (a "word")
  //   3. Every alphabetic run of >= 3 chars must contain a vowel (a/e/i/o/u).
  //   4. No alphabetic run may contain 4+ consecutive consonants (y counted
  //      as a consonant). Real English almost never has this; keyboard mashes
  //      almost always do.
  const trimmedIdea = idea.trim();
  const ideaValidation = (() => {
    if (trimmedIdea.length === 0) return { ok: false, reason: "empty" };
    if (trimmedIdea.length < 10) {
      return { ok: false, reason: "short", remaining: 10 - trimmedIdea.length };
    }

    const words = trimmedIdea.match(/[a-zA-Z]+/g) || [];
    if (words.length === 0) return { ok: false, reason: "no-letters" };

    const VOWEL = /[aeiouAEIOU]/;
    const CONSONANT_RUN_4 = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{4,}/;

    for (const w of words) {
      if (w.length >= 3) {
        if (!VOWEL.test(w)) return { ok: false, reason: "gibberish" };
        if (CONSONANT_RUN_4.test(w)) return { ok: false, reason: "gibberish" };
      }
    }

    return { ok: true };
  })();
  const ideaIsValid = ideaValidation.ok;

  // Contextual instruction shown under the input. Every rejection reason gets
  // a distinct, actionable message.
  const ideaHint = (() => {
    if (ideaValidation.ok) {
      return { tone: "ok", text: "Looks good — hit Generate with AI." };
    }
    switch (ideaValidation.reason) {
      case "empty":
        return {
          tone: "idle",
          text: "Write a short sentence describing what you want to build.",
        };
      case "short":
        return {
          tone: "warn",
          text: `Add a bit more detail — ${ideaValidation.remaining} more character${
            ideaValidation.remaining === 1 ? "" : "s"
          } to unlock.`,
        };
      case "no-letters":
        return {
          tone: "warn",
          text: "Add some real words — the AI needs actual language, not just symbols or numbers.",
        };
      case "gibberish":
      default:
        return {
          tone: "warn",
          text: "That doesn't look like a real project idea — try plain English (e.g. \"Build a food delivery app\").",
        };
    }
  })();

  const handleGenerate = async () => {
    if (!ideaIsValid) {
      setAiError(
        trimmedIdea.length === 0
          ? "Describe your idea first — a short sentence is enough."
          : "Give the AI a real hint — at least 10 characters with actual words (e.g. \"Build an AI expense tracker\")."
      );
      return;
    }
    const cleanIdea = trimmedIdea;
    setAiLoading(true);
    setAiError(null);
    setAiHint(null);
    try {
      const g = await aiApi.generateProject(cleanIdea);
      setForm({
        title: g.title || "",
        description: g.description || "",
        techStack: Array.isArray(g.techStack) ? g.techStack.join(", ") : "",
        timeline: g.timeline || "",
      });
      const featureNote =
        Array.isArray(g.features) && g.features.length
          ? ` · ${g.features.length} suggested features`
          : "";
      setAiHint(
        `Prefilled from AI (${g.estimatedDifficulty || "unspecified"}${featureNote}). Edit anything before creating.`
      );
      toast.success("Project scaffold generated — review and edit");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

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
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative w-full max-w-xl">
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase mb-4 inline-block"
        >
          ← Dashboard
        </Link>

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
              Describe your idea and let AI draft the scaffold, or fill in the
              form below manually.
            </p>
          </div>

          {/* ================= AI-assist section ================= */}
          <div className="mb-6 rounded-xl border border-pink-500/25 bg-pink-500/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[10px] font-semibold text-pink-300 tracking-[0.25em] uppercase">
                AI Assist
              </span>
            </div>

            <label className="block text-[10px] font-semibold text-gray-400 tracking-[0.2em] uppercase mb-1.5">
              Describe your project idea
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. Build an AI Expense Tracker"
                disabled={aiLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!aiLoading && ideaIsValid) handleGenerate();
                  }
                }}
                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-pink-400/50 focus:bg-white/[0.05] transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={aiLoading || !ideaIsValid}
                title={
                  !ideaIsValid
                    ? "Enter at least 10 characters describing your idea"
                    : undefined
                }
                className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[9.5rem]"
              >
                {aiLoading ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    Generating…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Generate with AI
                  </>
                )}
              </button>
            </div>

            {/* State-driven instruction: idle → gray hint, warn → amber
                warning, ok → green go-signal. Suppressed once an aiError or
                aiHint from the server takes over the same slot below. */}
            {!aiError && !aiHint && (
              <p
                className={`mt-2 text-[11px] leading-relaxed flex items-start gap-1.5 ${
                  ideaHint.tone === "ok"
                    ? "text-green-400/90"
                    : ideaHint.tone === "warn"
                    ? "text-amber-300/90"
                    : "text-gray-500"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[3px] inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                    ideaHint.tone === "ok"
                      ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]"
                      : ideaHint.tone === "warn"
                      ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
                      : "bg-gray-600"
                  }`}
                />
                {ideaHint.text}
              </p>
            )}
            {aiError && (
              <p className="mt-2 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-2.5 py-1.5">
                {aiError}
              </p>
            )}
            {aiHint && !aiError && (
              <p className="mt-2 text-[11px] text-green-300/90">{aiHint}</p>
            )}
          </div>

          <div className="relative flex items-center gap-3 mb-6">
            <span className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-gray-600 tracking-[0.3em] uppercase">
              or edit manually
            </span>
            <span className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* ================= Manual form ================= */}
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

// Small local icons — avoids pulling a lucide-react version we don't have.
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
