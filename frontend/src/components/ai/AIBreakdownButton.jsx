import { useState } from "react";
import { toast } from "sonner";
import * as aiApi from "../../api/ai.api";
import AIBreakdownDialog from "./AIBreakdownDialog";

// Self-contained "AI Breakdown" widget: renders the button, drives the
// generate-tasks API call, opens the review dialog on success, loops through
// the checked items via the supplied `onCreateTask` handler.
//
// Kept as one component so both the standalone TaskBoard page and the
// ProjectDetails Tasks tab can drop it in without duplicating state.

export default function AIBreakdownButton({ projectId, onCreateTask }) {
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState(null);

  const handleClick = async () => {
    if (loading || !projectId) return;
    setLoading(true);
    try {
      const generated = await aiApi.generateTasks(projectId);
      if (!Array.isArray(generated) || generated.length === 0) {
        toast.error("AI didn't return any tasks — try again");
        return;
      }
      setBreakdown(generated);
      toast.success(
        `Generated ${generated.length} task${generated.length === 1 ? "" : "s"} — review and add`
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-semibold text-white tracking-wider uppercase px-4 py-2 rounded-lg border border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 hover:shadow-[0_0_25px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {loading ? (
          <>
            <Spinner className="w-3.5 h-3.5" />
            Breaking down…
          </>
        ) : (
          <>
            <SparklesIcon className="w-3.5 h-3.5" />
            AI Breakdown
          </>
        )}
      </button>

      {breakdown && (
        <AIBreakdownDialog
          tasks={breakdown}
          onClose={() => setBreakdown(null)}
          onCreate={async (payload) => {
            await onCreateTask(payload);
          }}
        />
      )}
    </>
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
