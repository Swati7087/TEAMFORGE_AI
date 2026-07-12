import { formatRelativeTime } from "../../utils/formatDate";

function issueStatus(issue) {
  if (issue.state === "open") {
    return { label: "open", style: "text-green-300 border-green-400/30 bg-green-400/10" };
  }
  return { label: "closed", style: "text-gray-400 border-white/10 bg-white/[0.04]" };
}

export default function IssueList({ issues = [] }) {
  // GitHub's /issues endpoint also returns PRs — filter those out.
  const list = Array.isArray(issues)
    ? issues.filter((item) => !item.pull_request)
    : [];

  if (list.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic py-6 text-center">
        No issues yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {list.map((issue) => {
        const status = issueStatus(issue);
        const author = issue.user?.login || "unknown";
        const date = issue.created_at;

        return (
          <li key={issue.id} className="py-3">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-white group-hover:text-pink-300 transition-colors leading-snug">
                  {issue.title}
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
