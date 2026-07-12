import { formatRelativeTime } from "../../utils/formatDate";

export default function RepoOverviewCard({
  repository,
  onSync,
  onDisconnect,
  syncing = false,
  isOwner = false,
}) {
  if (!repository) return null;

  const { owner, repoName, repoUrl, lastSyncedAt } = repository;
  const githubUrl =
    repoUrl || `https://github.com/${owner}/${repoName}`;

  const handleDisconnect = () => {
    if (
      window.confirm(
        "Disconnect this repository? You'll need to reconnect with a token to sync again."
      )
    ) {
      onDisconnect?.();
    }
  };

  return (
    <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-green-300 mb-2">
            Connected repository
          </h3>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-white hover:text-green-300 transition-colors inline-flex items-center gap-1.5"
          >
            <GitHubIcon className="w-5 h-5 text-gray-400" />
            <span>
              {owner}/{repoName}
            </span>
            <span className="text-gray-600 text-sm">↗</span>
          </a>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {lastSyncedAt
              ? `Synced ${formatRelativeTime(lastSyncedAt)}`
              : "Not synced yet"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="text-xs font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
          >
            {syncing ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                Syncing…
              </>
            ) : (
              "Sync now"
            )}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={syncing}
              className="text-xs font-semibold tracking-wider uppercase text-gray-500 hover:text-pink-400 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GitHubIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
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
