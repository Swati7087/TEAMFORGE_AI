import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";

export default function ReadmeGeneratorCard({
  projectId,
  projectTitle,
  disabled = false,
  onLoadingChange,
}) {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (loading || disabled || !projectId) return;
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      const data = await aiApi.generateReadme(projectId);
      setMarkdown(data?.markdown || "");
      toast.success("README generated");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!markdown) return;
    const safeName = (projectTitle || "project")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName || "readme"}-README.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("README downloaded");
  };

  return (
    <div className="relative bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-1">
            AI README Generator
          </h3>
          <p className="text-[11px] text-gray-500">
            One-click portfolio-ready README from your project data and tasks.
            Run one AI feature at a time on the free Gemini tier.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || disabled}
          className="text-xs font-semibold text-white tracking-wider uppercase px-3.5 py-2 rounded-lg border border-green-400/40 bg-green-500/10 hover:bg-green-500/20 hover:shadow-[0_0_25px_rgba(74,222,128,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <>
              <Spinner className="w-3.5 h-3.5" />
              Generating…
            </>
          ) : markdown ? (
            "Regenerate README"
          ) : (
            "Generate README"
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {!markdown && !loading && !error && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] text-[11px] text-gray-500 tracking-wider uppercase text-center">
          No README yet — hit generate.
        </div>
      )}

      {loading && !markdown && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] text-[11px] text-gray-500 tracking-wider uppercase text-center">
          Writing your README…
        </div>
      )}

      {markdown && (
        <div className="mt-2 pt-4 border-t border-white/[0.05] space-y-4">
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="text-[10px] font-semibold tracking-wider uppercase text-gray-400 hover:text-white px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="text-[10px] font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors"
            >
              Download as README.md
            </button>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#050508] p-5 max-h-[480px] overflow-y-auto readme-preview">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        </div>
      )}

      <style>{`
        .readme-preview h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.75rem;
        }
        .readme-preview h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #86efac;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .readme-preview h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #f9a8d4;
          margin-top: 1rem;
          margin-bottom: 0.4rem;
        }
        .readme-preview p,
        .readme-preview li {
          font-size: 0.875rem;
          color: #d1d5db;
          line-height: 1.6;
        }
        .readme-preview ul,
        .readme-preview ol {
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .readme-preview code {
          font-size: 0.8rem;
          background: rgba(255,255,255,0.06);
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          color: #fde68a;
        }
        .readme-preview pre {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          overflow-x: auto;
          margin: 0.75rem 0;
        }
        .readme-preview pre code {
          background: none;
          padding: 0;
        }
      `}</style>
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
