import { formatRelativeTime } from "../../utils/formatDate";

function prStatus(pr) {
  if (pr.merged_at) return { label: "merged", style: "text-pink-300 border-pink-500/30 bg-pink-500/10" };
  if (pr.state === "open") return { label: "open", style: "text-green-300 border-green-400/30 bg-green-400/10" };
  return { label: "closed", style: "text-gray-400 border-white/10 bg-white/[0.04]" };
}

export default function PullRequestList({ pullRequests = [] }) {
  const list = Array.isArray(pullRequests) ? pullRequests : [];

  if (list.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic py-6 text-center">
        No pull requests yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {list.map((pr) => {
        const status = prStatus(pr);
        const author = pr.user?.login || "unknown";
        const date = pr.created_at;

        return (
          <li key={pr.id} className="py-3">
            <a
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-white group-hover:text-green-300 transition-colors leading-snug">
                  {pr.title}
                </p>
                <span
                  className={`text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border shrink-0 ${status.style}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                <span className="text-gray-400">{author}</span>
                {date && (
                  <>
                    <span className="text-gray-700 mx-1.5">·</span>
                    {formatRelativeTime(date)}
                  </>
                )}
              </p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
