export default function ContributorList({ contributors = [] }) {
  const list = Array.isArray(contributors)
    ? [...contributors].sort(
        (a, b) => (b.contributions || 0) - (a.contributions || 0)
      )
    : [];

  if (list.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic py-6 text-center">
        No contributors yet.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((c) => (
        <a
          key={c.id || c.login}
          href={c.html_url || `https://github.com/${c.login}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors"
        >
          <img
            src={c.avatar_url}
            alt=""
            className="w-9 h-9 rounded-full border border-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">
              {c.login}
            </div>
            <div className="text-[11px] text-gray-500">
              {c.contributions ?? 0} commit
              {(c.contributions ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
