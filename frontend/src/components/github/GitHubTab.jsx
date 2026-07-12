import { useState } from "react";
import { toast } from "sonner";
import { useGithub } from "../../hooks/useGithub";
import * as githubApi from "../../api/github.api";
import ConnectRepoDialog from "./ConnectRepoDialog";
import RepoOverviewCard from "./RepoOverviewCard";
import CommitList from "./CommitList";
import PullRequestList from "./PullRequestList";
import ContributorList from "./ContributorList";
import IssueList from "./IssueList";
import ContributionAnalyzer from "./ContributionAnalyzer";

const GH_SECTIONS = [
  { id: "commits", label: "Commits" },
  { id: "pull-requests", label: "Pull Requests" },
  { id: "contributors", label: "Contributors" },
  { id: "issues", label: "Issues" },
  { id: "ai-analysis", label: "AI Analysis" },
];

export default function GitHubTab({ projectId, isOwner, isMember }) {
  const canView = isOwner || isMember;
  const { connected, data, loading, error, refetch } = useGithub(projectId, {
    enabled: canView,
  });
  const [showConnect, setShowConnect] = useState(false);
  const [section, setSection] = useState("commits");
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!canView) {
    return (
      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">
          Join this project to view its GitHub activity.
        </p>
      </div>
    );
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      const ok = await refetch();
      if (ok) toast.success("Repository synced");
      else toast.error("Sync failed — try again");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await githubApi.disconnectRepository(projectId);
      toast.success("Repository disconnected");
      await refetch();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to disconnect repository"
      );
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-12 flex flex-col items-center justify-center gap-3">
        <Spinner className="w-8 h-8 text-green-400" />
        <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">
          Fetching from GitHub…
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <>
        <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl p-10 text-center">
          {error && (
            <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2 mb-4 inline-block">
              {error}
            </p>
          )}
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
            <GitHubIcon className="w-6 h-6 text-gray-500" />
          </div>
          {isOwner ? (
            <>
              <p className="text-sm text-gray-400 mb-1">
                No repository connected yet
              </p>
              <p className="text-xs text-gray-600 mb-6 max-w-sm mx-auto">
                Link your GitHub repo to see commits, pull requests, contributors,
                and issues right inside TeamForge.
              </p>
              <button
                type="button"
                onClick={() => setShowConnect(true)}
                className="text-xs font-semibold text-white tracking-wider uppercase px-5 py-2.5 rounded-lg border border-green-400/40 bg-green-500/10 hover:bg-green-500/20 hover:shadow-[0_0_25px_rgba(74,222,128,0.25)] transition-all inline-flex items-center gap-2"
              >
                <GitHubIcon className="w-4 h-4" />
                Connect GitHub
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Repository not connected</p>
          )}
        </div>

        {showConnect && (
          <ConnectRepoDialog
            projectId={projectId}
            onClose={() => setShowConnect(false)}
            onConnected={async () => {
              await refetch();
              toast.success("Repository connected");
            }}
          />
        )}
      </>
    );
  }

  const repo = data?.repository;
  const owner = repo?.owner;
  const repoName = repo?.repoName;

  return (
    <div className="space-y-4">
      <RepoOverviewCard
        repository={repo}
        onSync={handleSync}
        onDisconnect={handleDisconnect}
        syncing={syncing || disconnecting}
        isOwner={isOwner}
      />

      {error && (
        <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-[#0a0a12]/40 backdrop-blur-md border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 overflow-x-auto">
          {GH_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={
                "px-3 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase whitespace-nowrap transition-colors relative " +
                (section === s.id
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300")
              }
            >
              {s.label}
              {section === s.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green-400 to-pink-500" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {section === "commits" && (
            <CommitList
              commits={data?.commits}
              owner={owner}
              repoName={repoName}
            />
          )}
          {section === "pull-requests" && (
            <PullRequestList pullRequests={data?.pullRequests} />
          )}
          {section === "contributors" && (
            <ContributorList contributors={data?.contributors} />
          )}
          {section === "issues" && <IssueList issues={data?.issues} />}
          {section === "ai-analysis" && (
            <ContributionAnalyzer projectId={projectId} />
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
