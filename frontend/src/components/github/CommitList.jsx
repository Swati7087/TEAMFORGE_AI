import { formatRelativeTime } from "../../utils/formatDate";

const MAX_COMMITS = 20;

function firstLine(message = "") {
  return String(message).split("\n")[0].trim();
}

export default function CommitList({ commits = [], owner, repoName }) {
  const list = Array.isArray(commits) ? commits.slice(0, MAX_COMMITS) : [];
  const githubRepoUrl = `https://github.com/${owner}/${repoName}`;

  if (list.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic py-6 text-center">
        No commits yet.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-white/[0.06]">
        {list.map((c) => {
          const sha = c.sha || "";
          const shortSha = sha.slice(0, 7);
          const message = firstLine(c.commit?.message);
          const date = c.commit?.author?.date || c.commit?.committer?.date;
          const avatar =
            c.author?.avatar_url || "https://github.com/identicons/jasonlong.png";
          const login = c.author?.login || c.commit?.author?.name || "unknown";
          const commitUrl = `${githubRepoUrl}/commit/${sha}`;

          return (
            <li key={sha} className="flex items-start gap-3 py-3">
              <img
                src={avatar}
                alt=""
                className="w-8 h-8 rounded-full border border-white/10 shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white leading-snug truncate" title={message}>
                  {message || "(no message)"}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  <span className="text-gray-400">{login}</span>
                  {date && (
                    <>
                      <span className="text-gray-700 mx-1.5">·</span>
                      {formatRelativeTime(date)}
                    </>
                  )}
                </p>
              </div>
              {shortSha && (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-green-300 hover:text-green-200 shrink-0 px-2 py-1 rounded border border-green-400/20 bg-green-400/5 hover:bg-green-400/10"
                >
                  {shortSha}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {commits.length > MAX_COMMITS && (
        <div className="pt-4 text-center">
          <a
            href={`${githubRepoUrl}/commits`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-pink-300 tracking-[0.15em] uppercase"
          >
            View all on GitHub ↗
          </a>
        </div>
      )}
    </div>
  );
}
