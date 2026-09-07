import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import * as teamApi from "../../api/team.api";

export default function PendingInvitesWidget({ invites, onUpdate }) {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const currentUserId = user?._id || user?.id;

  if (!invites?.length) return null;

  const handleRespond = async (projectId, status) => {
    setBusyId(projectId);
    setError(null);
    try {
      await teamApi.respondToInvite(projectId, {
        userId: currentUserId,
        status,
      });
      onUpdate?.(projectId, status);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to respond to invite"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold text-gray-300 tracking-[0.25em] uppercase mb-4">
        Pending invites
      </h2>

      {error && (
        <div className="mb-3 text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <ul className="bg-[#0a0a12]/50 backdrop-blur-md border border-pink-500/20 rounded-xl overflow-hidden divide-y divide-white/[0.05]">
        {invites.map((inv) => (
          <li
            key={inv.projectId}
            className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {inv.projectTitle}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {inv.status === "invited" ? (
                  <>
                    Invited by{" "}
                    <span className="text-gray-300">
                      {inv.invitedBy || inv.ownerName}
                    </span>
                  </>
                ) : (
                  <span className="text-amber-300/80">
                    You requested to join — waiting on{" "}
                    {inv.ownerName}
                  </span>
                )}
              </div>
            </div>

            {inv.status === "invited" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyId === inv.projectId}
                  onClick={() => handleRespond(inv.projectId, "accepted")}
                  className="text-xs font-semibold tracking-wider uppercase text-green-300 hover:text-green-200 px-3 py-1.5 rounded-md border border-green-400/30 hover:border-green-400/50 hover:bg-green-400/5 transition-colors disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.projectId}
                  onClick={() => handleRespond(inv.projectId, "rejected")}
                  className="text-xs font-semibold tracking-wider uppercase text-gray-400 hover:text-pink-400 px-3 py-1.5 rounded-md border border-white/10 hover:border-pink-500/30 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {inv.status === "requested" && (
              <span className="text-[10px] tracking-[0.2em] uppercase text-amber-300/70 shrink-0">
                Pending owner
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
